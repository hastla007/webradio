const express = require('express');
const cors = require('cors');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { checkStreamHealth } = require('./monitor');

const defaultData = require('../data/defaultData.json');
const stationLogos = require('../data/stationLogos.json');

const PORT = Number(process.env.PORT || 4000);
const API_PREFIX = process.env.API_PREFIX || '/api';
const EXPORT_OUTPUT_DIRECTORY = path.resolve(
    process.env.EXPORT_OUTPUT_DIR || path.join(__dirname, '..', 'exports')
);
const DATA_FILE_PATH = path.resolve(process.env.API_DATA_PATH || path.join(__dirname, 'runtime-data.json'));

const PLACEHOLDER_LOGO = '/static/webradio_placeholder.png';
const LEGACY_LOGO_PATTERNS = [
    /https?:\/\/raw\.githubusercontent\.com\/hastla007\/webradioadminpanel\/refs\/heads\/main\/webradio_logo\.png/i,
    /https?:\/\/github\.com\/hastla007\/webradioadminpanel\/blob\/main\/webradio_logo\.png(?:\?raw=true)?/i,
];
const PLACEHOLDER_LOGO_PATTERNS = [
    /picsum\.photos/i,
    /images\.unsplash\.com/i,
    /placehold/i,
    /placeholder/i,
    /dummyimage\.com/i,
    /^\/static\/webradio_placeholder\.png$/i,
];

const LOGO_ENTRIES = Array.isArray(stationLogos) ? stationLogos : [];
const LOGOS_BY_ID = new Map();
const LOGOS_BY_NAME = new Map();

for (const entry of LOGO_ENTRIES) {
    if (!entry) continue;
    const id = typeof entry.id === 'string' || typeof entry.id === 'number' ? String(entry.id).trim() : '';
    const name = typeof entry.name === 'string' ? entry.name.trim().toLowerCase() : '';
    const logo = sanitizeLogoValue(entry.logo);
    if (!logo) continue;
    if (id) {
        LOGOS_BY_ID.set(id, logo);
    }
    if (name) {
        LOGOS_BY_NAME.set(name, logo);
    }
}

function sanitizeLogoValue(value) {
    if (typeof value !== 'string') {
        return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }
    if (LEGACY_LOGO_PATTERNS.some(pattern => pattern.test(trimmed))) {
        return '';
    }
    return trimmed;
}

function isPlaceholderLogo(url) {
    const normalized = sanitizeLogoValue(url);
    if (!normalized) {
        return true;
    }
    return PLACEHOLDER_LOGO_PATTERNS.some(pattern => pattern.test(normalized));
}

function resolveStationLogo(id, name, currentLogo) {
    const trimmed = sanitizeLogoValue(currentLogo);
    if (trimmed && !isPlaceholderLogo(trimmed)) {
        return trimmed;
    }

    const byId = id !== undefined && id !== null ? LOGOS_BY_ID.get(String(id).trim()) : undefined;
    const byName = typeof name === 'string' ? LOGOS_BY_NAME.get(name.trim().toLowerCase()) : undefined;
    const fallback = sanitizeLogoValue(byId || byName);
    return fallback || '';
}


function uniqueStrings(values) {
    const set = new Set();
    const result = [];
    for (const value of values || []) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (set.has(key)) continue;
        set.add(key);
        result.push(trimmed);
    }
    return result;
}

function normalizeGenre(genre) {
    const id = String(genre.id || '').trim() || slugifyName(genre.name || '', randomUUID());
    const name = String(genre.name || '').trim();
    const subGenres = uniqueStrings(genre.subGenres);
    return { id, name, subGenres };
}

function normalizeGenres(genres) {
    return genres.map(normalizeGenre);
}

function normalizeStationSubGenres(raw, genreId, genres) {
    const allowed = new Map();
    for (const genre of genres) {
        if (!genre || genre.id !== genreId) continue;
        for (const sub of genre.subGenres || []) {
            allowed.set(String(sub).toLowerCase(), String(sub));
        }
    }
    if (allowed.size === 0) {
        return [];
    }
    const unique = new Set();
    const result = [];
    for (const value of raw || []) {
        if (typeof value !== 'string') continue;
        const key = value.trim().toLowerCase();
        if (!key) continue;
        const canonical = allowed.get(key);
        if (!canonical || unique.has(canonical.toLowerCase())) continue;
        unique.add(canonical.toLowerCase());
        result.push(canonical);
    }
    return result;
}

function collectAllowedSubGenres(genres) {
    const allowed = new Set();
    for (const genre of genres) {
        for (const sub of genre.subGenres || []) {
            const normalized = String(sub || '').trim().toLowerCase();
            if (normalized) {
                allowed.add(normalized);
            }
        }
    }
    return allowed;
}

function normalizeStation(station, genres) {
    const id = String(station.id || '').trim() || randomUUID();
    const name = String(station.name || '').trim();
    const genreId = String(station.genreId || '').trim();
    const subGenres = normalizeStationSubGenres(Array.isArray(station.subGenres) ? station.subGenres : [], genreId, genres);
    const tags = Array.isArray(station.tags)
        ? station.tags.map(tag => String(tag || '').trim()).filter(Boolean)
        : [];
    const normalizedLogo = resolveStationLogo(id, name, station.logoUrl || station.logo);
    return {
        id,
        name,
        streamUrl: String(station.streamUrl || station.stream_url || '').trim(),
        description: String(station.description || '').trim(),
        genreId,
        subGenres,
        logoUrl: normalizedLogo,
        bitrate: Number.isFinite(Number(station.bitrate)) ? Number(station.bitrate) : 128,
        language: String(station.language || 'en').trim() || 'en',
        region: String(station.region || 'Global').trim() || 'Global',
        tags,
        imaAdType: ['audio', 'video', 'no'].includes(String(station.imaAdType || '').toLowerCase())
            ? String(station.imaAdType).toLowerCase()
            : 'no',
        isActive: station.isActive !== false,
        isFavorite: station.isFavorite === true,
    };
}

function normalizeStations(stations, genres) {
    return stations.map(station => normalizeStation(station, genres));
}

function normalizePlayerApp(app) {
    const id = String(app.id || '').trim() || randomUUID();
    const normalizedPlatforms = Array.isArray(app.platforms)
        ? app.platforms.map(p => String(p || '').trim()).filter(Boolean)
        : [];
    const declaredPlatform = typeof app.platform === 'string' ? String(app.platform).trim() : '';
    if (declaredPlatform) {
        normalizedPlatforms.unshift(declaredPlatform);
    }
    const uniquePlatforms = [];
    const seen = new Set();
    for (const value of normalizedPlatforms) {
        const lowered = value.toLowerCase();
        if (seen.has(lowered)) continue;
        seen.add(lowered);
        uniquePlatforms.push(value);
    }
    if (uniquePlatforms.length === 0) {
        uniquePlatforms.push('web');
    }
    const primaryPlatform = uniquePlatforms[0];
    return {
        id,
        name: String(app.name || '').trim(),
        platforms: uniquePlatforms,
        platform: primaryPlatform,
        description: String(app.description || '').trim(),
        contactEmail: String(app.contactEmail || '').trim(),
        notes: String(app.notes || '').trim(),
        ftpEnabled: app.ftpEnabled === true,
        ftpServer: String(app.ftpServer || app.ftpHost || '').trim(),
        ftpUsername: String(app.ftpUsername || '').trim(),
        ftpPassword: String(app.ftpPassword || '').trim(),
        networkCode: String(app.networkCode || '').trim(),
        imaEnabled: app.imaEnabled !== false,
        videoPrerollDefaultSize: String(app.videoPrerollDefaultSize || '640x480').trim() || '640x480',
        placements: {
            preroll: String(app.placements?.preroll || '').trim(),
            midroll: String(app.placements?.midroll || '').trim(),
            rewarded: String(app.placements?.rewarded || '').trim(),
        },
    };
}

function normalizePlayerApps(apps) {
    return apps.map(normalizePlayerApp);
}

function normalizeProfile(profile) {
    const id = String(profile.id || '').trim() || `ep-${randomUUID()}`;
    return {
        id,
        name: String(profile.name || '').trim(),
        genreIds: uniqueStrings(profile.genreIds),
        stationIds: uniqueStrings(profile.stationIds),
        subGenres: uniqueStrings(profile.subGenres),
        playerId: profile.playerId ? String(profile.playerId).trim() : null,
        autoExport: {
            enabled: Boolean(profile.autoExport?.enabled),
            interval: ['daily', 'weekly', 'monthly'].includes(String(profile.autoExport?.interval || '').toLowerCase())
                ? String(profile.autoExport.interval).toLowerCase()
                : 'daily',
            time: String(profile.autoExport?.time || '09:00').trim() || '09:00',
        },
    };
}

function normalizeProfiles(profiles) {
    return profiles.map(normalizeProfile);
}

async function ensureDirectory(directory) {
    await fs.mkdir(directory, { recursive: true });
    return directory;
}

async function loadDataFromDisk() {
    if (!fssync.existsSync(DATA_FILE_PATH)) {
        return null;
    }
    try {
        const raw = await fs.readFile(DATA_FILE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed;
    } catch (error) {
        console.warn('Failed to read API data file, using defaults instead.', error);
        return null;
    }
}

async function saveDataToDisk(data) {
    try {
        await ensureDirectory(path.dirname(DATA_FILE_PATH));
        await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.warn('Failed to persist API data file.', error);
    }
}

function buildInitialData() {
    const genres = normalizeGenres(defaultData.genres || []);
    const stations = normalizeStations(defaultData.stations || [], genres);
    const playerApps = normalizePlayerApps(defaultData.playerApps || []);
    const exportProfiles = normalizeProfiles(defaultData.exportProfiles || []);
    return { genres, stations, playerApps, exportProfiles };
}

function upgradeData(parsed) {
    const genres = normalizeGenres(Array.isArray(parsed.genres) ? parsed.genres : []);
    const stations = normalizeStations(Array.isArray(parsed.stations) ? parsed.stations : [], genres);
    const playerApps = normalizePlayerApps(Array.isArray(parsed.playerApps) ? parsed.playerApps : []);
    const exportProfiles = normalizeProfiles(Array.isArray(parsed.exportProfiles) ? parsed.exportProfiles : []);
    return { genres, stations, playerApps, exportProfiles };
}

async function loadDatabase() {
    const stored = await loadDataFromDisk();
    if (!stored) {
        const defaults = buildInitialData();
        await saveDataToDisk(defaults);
        return defaults;
    }
    const upgraded = upgradeData(stored);
    await saveDataToDisk(upgraded);
    return upgraded;
}

function slugifyName(value, fallback) {
    const base = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
    const trimmed = base.replace(/^-+|-+$/g, '');
    return trimmed || fallback;
}

function normalizePlatformKey(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase().replace(/\s+/g, '');
}

function determinePlatforms(player) {
    if (!player) return [];
    const platforms = new Set();

    const explicit = typeof (player === null || player === void 0 ? void 0 : player.platform) === 'string'
        ? player.platform.trim()
        : '';
    if (explicit) {
        const normalizedExplicit = normalizePlatformKey(explicit);
        if (normalizedExplicit) {
            platforms.add(normalizedExplicit);
        }
    }

    const platformList = Array.isArray(player === null || player === void 0 ? void 0 : player.platforms) ? player.platforms : [];
    for (const value of platformList) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (trimmed) {
            const normalized = normalizePlatformKey(trimmed);
            if (normalized) {
                platforms.add(normalized);
            }
        }
    }

    return Array.from(platforms);
}

function determinePlatform(player) {
    const platforms = determinePlatforms(player);
    return platforms.length > 0 ? platforms[0] : null;
}

function firstToken(input) {
    if (!input) return null;
    const match = String(input).match(/[a-z0-9]+/i);
    return match ? match[0].toLowerCase() : null;
}

function resolveAdSection(tags, normalizedGenre) {
    const loweredGenre = normalizedGenre ? normalizedGenre.toLowerCase() : null;
    const tagList = Array.isArray(tags) ? tags : [];

    if (loweredGenre) {
        const matchingTag = tagList.find(tag => tag.toLowerCase().includes(loweredGenre));
        if (matchingTag) {
            return firstToken(matchingTag) || loweredGenre;
        }
    }

    if (tagList.length > 0) {
        const token = firstToken(tagList[0]);
        if (token) {
            return token;
        }
    }

    return loweredGenre;
}

const IOS_VMAP_URL =
    'https://pubads.g.doubleclick.net/gampad/ads?iu={iu}&env=vp&gdfp_req=1&output=vmap&ad_rule=1&description_url={encoded_page_url}&cust_params={encoded_cust_params}&npa={npa}&tfcd={tfcd}&us_privacy={us_privacy}';
const ANDROID_VAST_TEMPLATE =
    'https://pubads.g.doubleclick.net/gampad/ads?iu={iu}&env=vp&gdfp_req=1&unviewed_position_start=1&output=vast&sz={size}&description_url={encoded_page_url}&cust_params={encoded_cust_params}&npa={npa}&tfcd={tfcd}&us_privacy={us_privacy}';

const DEFAULT_NETWORK_CODE = (() => {
    const codes = new Set(
        Array.isArray(defaultData.playerApps)
            ? defaultData.playerApps
                  .map(app => String((app === null || app === void 0 ? void 0 : app.networkCode) || '').trim())
                  .filter(code => code.length > 0)
            : []
    );
    if (codes.size === 1) {
        const [only] = Array.from(codes);
        return only;
    }
    return '';
})();

function extractNetworkCodeFromPlacement(iu) {
    if (typeof iu !== 'string') {
        return null;
    }
    const match = iu.trim().match(/\/(\d{3,})\b/);
    return match ? match[1] : null;
}

function resolveNetworkCode(rawNetworkCode, placements) {
    const trimmed = String(rawNetworkCode || '').trim();
    if (trimmed) {
        return trimmed;
    }

    const placementList = placements
        ? [placements.preroll, placements.midroll, placements.rewarded]
        : [];

    for (const candidate of placementList) {
        const extracted = extractNetworkCodeFromPlacement(candidate);
        if (extracted) {
            return extracted;
        }
    }

    return DEFAULT_NETWORK_CODE;
}

function normalizeAndroidPlacement(raw, fallback, expected) {
    const trimmed = String(raw || '').trim();
    const fallbackTrimmed = fallback.trim();
    const source = trimmed || fallbackTrimmed;
    if (!source) {
        return '';
    }

    const sourceMatch = source.match(/^(.*\/)?([^/]+)$/);
    let prefix = (sourceMatch === null || sourceMatch === void 0 ? void 0 : sourceMatch[1]) || '';
    let leaf = (sourceMatch === null || sourceMatch === void 0 ? void 0 : sourceMatch[2]) || source;

    leaf = leaf.replace(/_adrules\b/gi, '_preroll').replace(/_midroll\b/gi, '_preroll');

    if (expected) {
        if (leaf.toLowerCase() !== expected.toLowerCase()) {
            leaf = expected;
        }
    } else if (!/_preroll\b/i.test(leaf)) {
        leaf = 'preroll';
    }

    if (!prefix && fallbackTrimmed) {
        const fallbackMatch = fallbackTrimmed.match(/^(.*\/)?([^/]+)$/);
        if ((fallbackMatch === null || fallbackMatch === void 0 ? void 0 : fallbackMatch[1])) {
            prefix = fallbackMatch[1];
        }
    }

    let normalized = `${prefix}${leaf}`;
    if (/_preroll\b/i.test(leaf) && /\/radio\//i.test(normalized)) {
        normalized = normalized.replace(/\/radio\//gi, '/webradio/');
    }

    return normalized;
}

function normalizeIosPlacement(raw, fallback) {
    const base = String(raw || '').trim() || fallback;
    if (!base) {
        return '';
    }

    let normalized = base.replace(/_preroll\b/gi, '_adrules').replace(/_midroll\b/gi, '_adrules');
    if (/_adrules\b/i.test(normalized) && /\/radio\//i.test(normalized)) {
        normalized = normalized.replace(/\/radio\//i, '/webradio/');
    }

    return normalized;
}

function buildAdsPayload(player, platform) {
    if (!player || player.imaEnabled === false) {
        return null;
    }

    const normalizedPlatform = normalizePlatformKey(platform);
    const placements = player.placements || { preroll: '', midroll: '', rewarded: '' };
    const videoDefaultSize = String(player.videoPrerollDefaultSize || '640x480').trim() || '640x480';
    const networkCode = resolveNetworkCode(player === null || player === void 0 ? void 0 : player.networkCode, placements);
    const base = {
        network_code: networkCode,
        privacy_defaults: {
            npa: 0,
            tfcd: 0,
            us_privacy: '1YNN',
        },
        ad_lock: {
            enabled: true,
            seconds: 300,
            scope: 'rolling',
            exempt_placements: [],
        },
    };

    if (normalizedPlatform === 'ios') {
        const audioRules = normalizeIosPlacement(
            placements.preroll,
            networkCode ? `/${networkCode}/webradio/audio_adrules` : ''
        );
        const videoRules = normalizeIosPlacement(
            placements.midroll || placements.rewarded,
            networkCode ? `/${networkCode}/webradio/video_adrules` : ''
        );
        return {
            ...base,
            mode: 'vmap',
            vmap_url: IOS_VMAP_URL,
            placements: {
                audio_rules: {
                    iu: audioRules || null,
                    enabled: Boolean(audioRules),
                },
                video_rules: {
                    iu: videoRules || null,
                    enabled: Boolean(videoRules),
                },
            },
            route: {
                audio: 'audio_rules',
                video: 'video_rules',
                no: null,
            },
        };
    }

    if (normalizedPlatform === 'android' || normalizedPlatform === 'homeassistant') {
        const audioPreroll = normalizeAndroidPlacement(
            placements.preroll,
            networkCode ? `/${networkCode}/webradio/audio_preroll` : '',
            'audio_preroll'
        );
        const videoPreroll = normalizeAndroidPlacement(
            placements.midroll || placements.rewarded,
            networkCode ? `/${networkCode}/webradio/video_preroll` : '',
            'video_preroll'
        );
        return {
            ...base,
            mode: 'vast',
            ad_tag_template: ANDROID_VAST_TEMPLATE,
            placements: {
                audio_preroll: {
                    iu: audioPreroll || null,
                    default_size: '1x1',
                    enabled: Boolean(audioPreroll),
                },
                video_preroll: {
                    iu: videoPreroll || null,
                    default_size: videoDefaultSize,
                    enabled: Boolean(videoPreroll),
                },
            },
            route: {
                audio: 'audio_preroll',
                video: 'video_preroll',
                no: null,
            },
        };
    }

    return null;
}

function buildHomeAssistantSettings(player, ads) {
    const adsEnabled = Boolean(ads) && player?.imaEnabled !== false;
    return {
        autoplay: false,
        volume_default: 0.7,
        ads_enabled: adsEnabled,
        ui_theme: 'dark',
    };
}

function buildExportPayload(profile, data) {
    const genreIds = new Set(profile.genreIds || []);
    const stationIds = new Set(profile.stationIds || []);
    const subGenreFilter = new Set((profile.subGenres || []).map(sub => sub.toLowerCase()));

    const stations = [];
    const seen = new Set();

    for (const station of data.stations) {
        const matchesGenre = genreIds.has(station.genreId);
        const matchesSubGenre = station.subGenres.some(sub => subGenreFilter.has(sub.toLowerCase()));
        const explicit = stationIds.has(station.id);
        if (!matchesGenre && !matchesSubGenre && !explicit) {
            continue;
        }
        if (!explicit && station.isActive === false) {
            continue;
        }
        if (seen.has(station.id)) {
            continue;
        }
        seen.add(station.id);
        const genre = data.genres.find(g => g.id === station.genreId);
        const normalizedGenre = station.genreId || (genre ? genre.name.toLowerCase() : null);
        const section = resolveAdSection(station.tags, normalizedGenre);
        const resolvedLogo = sanitizeLogoValue(station.logoUrl) || PLACEHOLDER_LOGO;
        const exportStation = {
            id: station.id,
            name: station.name,
            genre: normalizedGenre,
            url: station.streamUrl,
            logo: resolvedLogo,
            description: station.description,
            bitrate: station.bitrate,
            language: station.language,
            region: station.region,
            tags: station.tags,
            subGenres: station.subGenres,
            isPlaying: false,
            isFavorite: station.isFavorite === true,
            imaAdType: station.imaAdType,
        };
        if (section) {
            exportStation.adMeta = { section };
        }
        stations.push(exportStation);
    }

    stations.sort((a, b) => a.name.localeCompare(b.name));

    const player = profile.playerId ? data.playerApps.find(app => app.id === profile.playerId) : undefined;
    const platform = determinePlatform(player);

    const payload = { stations };
    if (player && platform && ['ios', 'android', 'homeassistant'].includes(platform)) {
        payload.app = {
            id: slugifyName(player.name, player.id),
            platform,
            version: 1,
        };
        const ads = buildAdsPayload(player, platform);
        if (ads) {
            payload.ads = ads;
        }
        if (platform === 'homeassistant') {
            payload.settings = buildHomeAssistantSettings(player, payload.ads);
        }
    }

    return { payload, player, platform, stationCount: stations.length };
}

function cloneStationsForExport(stations) {
    if (!Array.isArray(stations)) {
        return [];
    }
    return stations.map(station => {
        const copy = { ...station };
        if (station.adMeta) {
            copy.adMeta = { ...station.adMeta };
        }
        return copy;
    });
}

function coercePrivacyDefaults(existing) {
    const defaults = existing && typeof existing === 'object' ? existing : {};
    return {
        npa: Number.isFinite(Number(defaults.npa)) ? Number(defaults.npa) : 0,
        tfcd: Number.isFinite(Number(defaults.tfcd)) ? Number(defaults.tfcd) : 0,
        us_privacy: typeof defaults.us_privacy === 'string' && defaults.us_privacy.trim() ? defaults.us_privacy.trim() : '1YNN',
    };
}

function coerceAdLock(existing) {
    const lock = existing && typeof existing === 'object' ? existing : {};
    const seconds = Number(lock.seconds);
    return {
        enabled: lock.enabled !== false,
        seconds: Number.isFinite(seconds) ? seconds : 300,
        scope: typeof lock.scope === 'string' && lock.scope.trim() ? lock.scope.trim() : 'rolling',
        exempt_placements: Array.isArray(lock.exempt_placements)
            ? lock.exempt_placements.filter(item => typeof item === 'string' && item.trim().length > 0)
            : [],
    };
}

function deriveFallbackPlacements(ads) {
    const placements = (ads && typeof ads === 'object' ? ads.placements : null) || {};
    const byKey = key => {
        const value = placements && placements[key];
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (value && typeof value === 'object' && typeof value.iu === 'string') return value.iu;
        return '';
    };
    const audio = byKey('audio_preroll') || byKey('audio_rules') || '';
    const video = byKey('video_preroll') || byKey('video_rules') || '';
    const rewarded = byKey('rewarded') || '';
    return {
        preroll: audio,
        midroll: video,
        rewarded,
    };
}

function buildFallbackAds(ads, platform) {
    const normalizedPlatform = normalizePlatformKey(platform);
    const placements = deriveFallbackPlacements(ads);
    const networkCode = resolveNetworkCode(ads ? ads.network_code : '', placements);
    const base = {
        network_code: networkCode,
        privacy_defaults: coercePrivacyDefaults(ads ? ads.privacy_defaults : null),
        ad_lock: coerceAdLock(ads ? ads.ad_lock : null),
    };

    if (normalizedPlatform === 'ios') {
        const audioRules = normalizeIosPlacement(
            placements.preroll,
            networkCode ? `/${networkCode}/webradio/audio_adrules` : ''
        );
        const videoRules = normalizeIosPlacement(
            placements.midroll || placements.rewarded,
            networkCode ? `/${networkCode}/webradio/video_adrules` : ''
        );
        return {
            ...base,
            mode: 'vmap',
            vmap_url: IOS_VMAP_URL,
            placements: {
                audio_rules: {
                    iu: audioRules || null,
                    enabled: Boolean(audioRules),
                },
                video_rules: {
                    iu: videoRules || null,
                    enabled: Boolean(videoRules),
                },
            },
            route: {
                audio: 'audio_rules',
                video: 'video_rules',
                no: null,
            },
        };
    }

    if (normalizedPlatform === 'android' || normalizedPlatform === 'homeassistant') {
        const audioPreroll = normalizeAndroidPlacement(
            placements.preroll,
            networkCode ? `/${networkCode}/webradio/audio_preroll` : '',
            'audio_preroll'
        );
        const videoPreroll = normalizeAndroidPlacement(
            placements.midroll || placements.rewarded,
            networkCode ? `/${networkCode}/webradio/video_preroll` : '',
            'video_preroll'
        );
        return {
            ...base,
            mode: 'vast',
            ad_tag_template: ANDROID_VAST_TEMPLATE,
            placements: {
                audio_preroll: {
                    iu: audioPreroll || null,
                    default_size: '1x1',
                    enabled: Boolean(audioPreroll),
                },
                video_preroll: {
                    iu: videoPreroll || null,
                    default_size: '640x480',
                    enabled: Boolean(videoPreroll),
                },
            },
            route: {
                audio: 'audio_preroll',
                video: 'video_preroll',
                no: null,
            },
        };
    }

    return null;
}

function buildPayloadForPlatform(exportContext, platform) {
    // Ensure we use the explicitly passed platform, not the exportContext.platform
    const normalizedPlatform = normalizePlatformKey(platform) || 'generic';

    const baseStations = cloneStationsForExport(exportContext.payload?.stations || []);
    const payload = { stations: baseStations };

    if (exportContext.payload?.settings && typeof exportContext.payload.settings === 'object') {
        payload.settings = JSON.parse(JSON.stringify(exportContext.payload.settings));
    }

    const player = exportContext.player;
    if (player) {
        const fallbackAppId =
            slugifyName(player.name, player.id) || exportContext.payload?.app?.id || player.id || 'app';
        const fallbackVersion = Number.isFinite(Number(exportContext.payload?.app?.version))
            ? Number(exportContext.payload?.app?.version)
            : 1;

        // Use normalizedPlatform (from the parameter) instead of exportContext.platform
        const effectivePlatform = normalizedPlatform;

        payload.app = {
            id: fallbackAppId,
            platform: effectivePlatform,
            version: fallbackVersion || 1,
        };

        if (['ios', 'android', 'homeassistant'].includes(effectivePlatform)) {
            // Build ads using the correct platform from the parameter
            let ads = buildAdsPayload(player, effectivePlatform);
            if (!ads && player.imaEnabled !== false && exportContext.payload?.ads) {
                ads = buildFallbackAds(exportContext.payload.ads, effectivePlatform);
            }
            if (ads) {
                payload.ads = ads;
            } else {
                delete payload.ads;
            }
            if (effectivePlatform === 'homeassistant') {
                payload.settings = buildHomeAssistantSettings(player, ads);
            }
        } else if (exportContext.payload?.ads) {
            payload.ads = JSON.parse(JSON.stringify(exportContext.payload.ads));
        }

        return payload;
    }

    if (exportContext.payload?.app) {
        payload.app = { ...exportContext.payload.app };
    }
    if (exportContext.payload?.ads) {
        payload.ads = JSON.parse(JSON.stringify(exportContext.payload.ads));
    }

    return payload;
}

async function writeExportFiles(profile, exportContext) {
    await ensureDirectory(EXPORT_OUTPUT_DIRECTORY);
    const slug = slugifyName(profile.name, profile.id);
    const targets = [];

    const platformSet = new Set();
    if (exportContext.player) {
        for (const entry of determinePlatforms(exportContext.player)) {
            platformSet.add(entry);
        }
    }
    if (platformSet.size === 0 && exportContext.platform) {
        const normalized = String(exportContext.platform || '').trim().toLowerCase();
        if (normalized) {
            platformSet.add(normalized);
        }
    }
    if (platformSet.size === 0) {
        platformSet.add('generic');
    }

    for (const platform of platformSet) {
        const normalizedPlatform = String(platform || '').trim().toLowerCase() || 'generic';
        const payloadForPlatform = buildPayloadForPlatform(exportContext, normalizedPlatform);
        const fileName = `${slug}-${normalizedPlatform}.json`;
        const outputPath = path.join(EXPORT_OUTPUT_DIRECTORY, fileName);
        await fs.writeFile(outputPath, JSON.stringify(payloadForPlatform, null, 2), 'utf8');
        targets.push({ platform: normalizedPlatform, fileName, outputPath, ftpUploaded: false });
    }

    return targets;
}

const app = express();
app.use(cors());
app.use(express.json());

let database;

app.post(`${API_PREFIX}/monitor/check`, async (req, res) => {
    const payload = req.body || {};
    const streams = Array.isArray(payload.streams) ? payload.streams : [];
    if (streams.length === 0) {
        return res.status(400).json({ error: 'streams must be a non-empty array' });
    }

    const timeoutCandidate = Number(payload.timeoutMs);
    const timeoutMs = Number.isFinite(timeoutCandidate) ? timeoutCandidate : undefined;

    try {
        const results = await Promise.all(
            streams.map(async entry => {
                const stationId = typeof entry.stationId === 'string' ? entry.stationId : String(entry.stationId ?? '').trim();
                const streamUrl = typeof entry.streamUrl === 'string' ? entry.streamUrl : '';

                if (!stationId) {
                    return { stationId: '', isOnline: false, error: 'stationId is required' };
                }

                if (!streamUrl.trim()) {
                    return { stationId, isOnline: false, error: 'streamUrl is required' };
                }

                const health = await checkStreamHealth(streamUrl, { timeoutMs });
                return { stationId, ...health };
            })
        );

        res.json(results);
    } catch (error) {
        console.error('Failed to perform stream health check', error);
        res.status(500).json({ error: 'Failed to perform stream health check.' });
    }
});

app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({ status: 'ok' });
});

app.get(`${API_PREFIX}/genres`, (req, res) => {
    res.json(database.genres);
});

app.post(`${API_PREFIX}/genres`, async (req, res) => {
    const genre = normalizeGenre(req.body || {});
    if (!genre.name) {
        return res.status(400).json({ error: 'Genre name is required' });
    }
    const exists = database.genres.some(g => g.id === genre.id);
    database.genres = exists
        ? database.genres.map(g => (g.id === genre.id ? genre : g))
        : [...database.genres, genre];
    await saveDataToDisk(database);
    res.json(genre);
});

app.put(`${API_PREFIX}/genres/:id`, async (req, res) => {
    const { id } = req.params;
    const incoming = normalizeGenre({ ...req.body, id });
    const index = database.genres.findIndex(g => g.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Genre not found' });
    }
    database.genres[index] = incoming;
    database.stations = database.stations.map(station => {
        if (station.genreId !== id) {
            return station;
        }
        const subGenres = normalizeStationSubGenres(station.subGenres, id, database.genres);
        return { ...station, subGenres };
    });
    const allowedSubGenres = collectAllowedSubGenres(database.genres);
    database.exportProfiles = database.exportProfiles.map(profile => ({
        ...profile,
        subGenres: profile.subGenres.filter(sub => allowedSubGenres.has(sub.toLowerCase())),
    }));
    await saveDataToDisk(database);
    res.json(incoming);
});

app.delete(`${API_PREFIX}/genres/:id`, async (req, res) => {
    const { id } = req.params;
    const existing = database.genres.find(g => g.id === id);
    if (!existing) {
        return res.status(404).json({ error: 'Genre not found' });
    }
    database.genres = database.genres.filter(g => g.id !== id);
    database.stations = database.stations.map(station =>
        station.genreId === id
            ? { ...station, genreId: '', subGenres: [] }
            : station
    );
    const removedSubGenres = new Set((existing?.subGenres || []).map(sub => String(sub).toLowerCase()));
    database.exportProfiles = database.exportProfiles.map(profile => ({
        ...profile,
        genreIds: profile.genreIds.filter(g => g !== id),
        subGenres: removedSubGenres.size
            ? profile.subGenres.filter(sub => !removedSubGenres.has(sub.toLowerCase()))
            : profile.subGenres,
    }));
    await saveDataToDisk(database);
    res.status(204).end();
});

app.get(`${API_PREFIX}/stations`, (req, res) => {
    res.json(database.stations);
});

app.post(`${API_PREFIX}/stations`, async (req, res) => {
    const normalized = normalizeStation(req.body || {}, database.genres);
    if (!normalized.name || !normalized.streamUrl) {
        return res.status(400).json({ error: 'Station name and streamUrl are required' });
    }
    const exists = database.stations.some(station => station.id === normalized.id);
    if (exists) {
        return res.status(409).json({ error: 'Station already exists' });
    }
    database.stations = [...database.stations, normalized];
    await saveDataToDisk(database);
    res.json(normalized);
});

app.put(`${API_PREFIX}/stations/:id`, async (req, res) => {
    const { id } = req.params;
    const index = database.stations.findIndex(station => station.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Station not found' });
    }
    const normalized = normalizeStation({ ...req.body, id }, database.genres);
    database.stations[index] = normalized;
    await saveDataToDisk(database);
    res.json(normalized);
});

app.delete(`${API_PREFIX}/stations/:id`, async (req, res) => {
    const { id } = req.params;
    const before = database.stations.length;
    database.stations = database.stations.filter(station => station.id !== id);
    if (database.stations.length === before) {
        return res.status(404).json({ error: 'Station not found' });
    }
    database.exportProfiles = database.exportProfiles.map(profile => ({
        ...profile,
        stationIds: profile.stationIds.filter(stationId => stationId !== id),
    }));
    await saveDataToDisk(database);
    res.status(204).end();
});

app.get(`${API_PREFIX}/player-apps`, (req, res) => {
    res.json(database.playerApps);
});

app.post(`${API_PREFIX}/player-apps`, async (req, res) => {
    const normalized = normalizePlayerApp(req.body || {});
    if (!normalized.name) {
        return res.status(400).json({ error: 'Player app name is required' });
    }
    const exists = database.playerApps.some(app => app.id === normalized.id);
    if (exists) {
        return res.status(409).json({ error: 'Player app already exists' });
    }
    database.playerApps = [...database.playerApps, normalized];
    await saveDataToDisk(database);
    res.json(normalized);
});

app.put(`${API_PREFIX}/player-apps/:id`, async (req, res) => {
    const { id } = req.params;
    const index = database.playerApps.findIndex(app => app.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Player app not found' });
    }
    const normalized = normalizePlayerApp({ ...req.body, id });
    database.playerApps[index] = normalized;
    await saveDataToDisk(database);
    res.json(normalized);
});

app.delete(`${API_PREFIX}/player-apps/:id`, async (req, res) => {
    const { id } = req.params;
    const before = database.playerApps.length;
    database.playerApps = database.playerApps.filter(app => app.id !== id);
    if (database.playerApps.length === before) {
        return res.status(404).json({ error: 'Player app not found' });
    }
    database.exportProfiles = database.exportProfiles.map(profile => ({
        ...profile,
        playerId: profile.playerId === id ? null : profile.playerId,
    }));
    await saveDataToDisk(database);
    res.status(204).end();
});

app.get(`${API_PREFIX}/export-profiles`, (req, res) => {
    res.json(database.exportProfiles);
});

app.post(`${API_PREFIX}/export-profiles`, async (req, res) => {
    const normalized = normalizeProfile(req.body || {});
    if (!normalized.name) {
        return res.status(400).json({ error: 'Profile name is required' });
    }
    const exists = database.exportProfiles.some(profile => profile.id === normalized.id);
    if (exists) {
        return res.status(409).json({ error: 'Export profile already exists' });
    }
    if (normalized.playerId) {
        database.exportProfiles = database.exportProfiles.map(profile =>
            profile.playerId === normalized.playerId ? { ...profile, playerId: null } : profile
        );
    }
    database.exportProfiles = [...database.exportProfiles, normalized];
    await saveDataToDisk(database);
    res.json(normalized);
});

app.put(`${API_PREFIX}/export-profiles/:id`, async (req, res) => {
    const { id } = req.params;
    const index = database.exportProfiles.findIndex(profile => profile.id === id);
    if (index === -1) {
        return res.status(404).json({ error: 'Export profile not found' });
    }
    const normalized = normalizeProfile({ ...req.body, id });
    if (normalized.playerId) {
        database.exportProfiles = database.exportProfiles.map(profile =>
            profile.playerId === normalized.playerId && profile.id !== id ? { ...profile, playerId: null } : profile
        );
    }
    database.exportProfiles[index] = normalized;
    await saveDataToDisk(database);
    res.json(normalized);
});

app.delete(`${API_PREFIX}/export-profiles/:id`, async (req, res) => {
    const { id } = req.params;
    const before = database.exportProfiles.length;
    database.exportProfiles = database.exportProfiles.filter(profile => profile.id !== id);
    if (database.exportProfiles.length === before) {
        return res.status(404).json({ error: 'Export profile not found' });
    }
    await saveDataToDisk(database);
    res.status(204).end();
});

app.post(`${API_PREFIX}/export-profiles/:id/export`, async (req, res) => {
    const { id } = req.params;
    const profile = database.exportProfiles.find(profile => profile.id === id);
    if (!profile) {
        return res.status(404).json({ error: 'Export profile not found' });
    }
    const exportContext = buildExportPayload(profile, database);
    if (exportContext.stationCount === 0) {
        return res.status(400).json({ error: 'This export profile does not include any active stations to export.' });
    }
    try {
        const files = await writeExportFiles(profile, exportContext);
        const summary = {
            profileId: profile.id,
            profileName: profile.name,
            stationCount: exportContext.stationCount,
            outputDirectory: EXPORT_OUTPUT_DIRECTORY,
            files: files.map(file => ({
                platform: file.platform,
                fileName: file.fileName,
                outputPath: file.outputPath,
                stationCount: exportContext.stationCount,
                ftpUploaded: Boolean(file.ftpUploaded),
            })),
        };
        res.json(summary);
    } catch (error) {
        console.error('Failed to write export files', error);
        res.status(500).json({ error: 'Failed to write export files' });
    }
});

async function start() {
    database = await loadDatabase();
    await ensureDirectory(EXPORT_OUTPUT_DIRECTORY);
    app.listen(PORT, () => {
        console.log(`WebRadio Admin API listening on port ${PORT}`);
    });
}

if (require.main === module) {
    start().catch(error => {
        console.error('Failed to start API server', error);
        process.exit(1);
    });
}

module.exports = {
    start,
    buildExportPayload,
    writeExportFiles,
    buildPayloadForPlatform,
    determinePlatforms,
    determinePlatform,
    buildAdsPayload,
};
