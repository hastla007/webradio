import { ExportPayload, ExportProfile, ExportedStation, Genre, PlayerApp, RadioStation } from './types';
import { getStationLogoUrl, normalizeStationLogo } from './stationLogos';
import defaultDataJson from './data/defaultData.json';

type DataShape = {
    stations: RadioStation[];
    genres: Genre[];
    exportProfiles: ExportProfile[];
    playerApps: PlayerApp[];
};

const STORAGE_KEY = 'webradio-admin-data';

type RawGenre = Partial<Genre> & Pick<Genre, 'id' | 'name'>;

const defaultData: DataShape = JSON.parse(JSON.stringify(defaultDataJson)) as DataShape;

function sanitizeSubGenres(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string') {
            continue;
        }
        const trimmed = item.trim();
        if (!trimmed) {
            continue;
        }
        const key = trimmed.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(trimmed);
    }
    return result;
}

function normalizeGenre(genre: RawGenre): Genre {
    return {
        id: genre.id,
        name: genre.name,
        subGenres: sanitizeSubGenres(genre.subGenres),
    };
}

function normalizeGenres(genres: RawGenre[]): Genre[] {
    return genres.map(normalizeGenre);
}

function toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .map(entry => (typeof entry === 'string' ? entry.trim() : typeof entry === 'number' ? String(entry).trim() : ''))
            .filter((entry): entry is string => entry.length > 0);
    }

    if (typeof value === 'string') {
        return value
            .split(',')
            .map(entry => entry.trim())
            .filter((entry): entry is string => entry.length > 0);
    }

    return [];
}

function normalizeStationSubGenres(value: unknown, genreId: string, genres: Genre[]): string[] {
    if (!genreId) {
        return [];
    }

    const genre = genres.find(g => g.id === genreId);
    if (!genre || !Array.isArray(genre.subGenres) || genre.subGenres.length === 0) {
        return [];
    }

    const canonicalMap = new Map<string, string>();
    genre.subGenres
        .map(subGenre => subGenre.trim())
        .filter(Boolean)
        .forEach(subGenre => {
            canonicalMap.set(subGenre.toLowerCase(), subGenre);
        });

    if (canonicalMap.size === 0) {
        return [];
    }

    const parsed = toStringArray(value);
    const filtered = parsed
        .map(entry => canonicalMap.get(entry.toLowerCase()))
        .filter((entry): entry is string => Boolean(entry));

    return Array.from(new Set(filtered));
}

function normalizeStation(station: RadioStation, genres: Genre[]): RadioStation {
    const rawSubGenres = (station as RadioStation & { subGenres?: unknown }).subGenres;
    const normalizedSubGenres = normalizeStationSubGenres(rawSubGenres, station.genreId, genres);
    const normalizedStation = normalizeStationLogo({ ...station, subGenres: normalizedSubGenres });
    return { ...normalizedStation, subGenres: normalizedSubGenres };
}

function normalizeStations(stations: RadioStation[], genres: Genre[]): RadioStation[] {
    return stations.map(station => normalizeStation(station, genres));
}

defaultData.genres = normalizeGenres(defaultData.genres);
defaultData.stations = normalizeStations(defaultData.stations, defaultData.genres);
defaultData.exportProfiles = defaultData.exportProfiles.map(normalizeProfile);

function applyMigrations(data: DataShape): DataShape {
    const upgradedGenres = normalizeGenres(data.genres as unknown as RawGenre[]);

    const upgradedStations = data.stations.map(station => {
        const { logo, subGenres, ...rest } = station as RadioStation & { logo?: string; subGenres?: unknown };
        const currentLogo = rest.logoUrl || (typeof logo === 'string' ? logo : '');
        const baseStation: RadioStation = {
            ...rest,
            logoUrl: currentLogo,
            subGenres: toStringArray(subGenres),
        };
        return normalizeStation(baseStation, upgradedGenres);
    });

    const upgradedProfiles = data.exportProfiles.map(normalizeProfile);

    return { ...data, stations: upgradedStations, genres: upgradedGenres, exportProfiles: upgradedProfiles };
}

let inMemoryData: DataShape | null = null;

function getStorage(): Storage | null {
    if (typeof window === 'undefined' || !('localStorage' in window)) {
        return null;
    }
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function loadData(): DataShape {
    if (inMemoryData) {
        return inMemoryData;
    }

    const storage = getStorage();
    if (!storage) {
        inMemoryData = clone(defaultData);
        return inMemoryData;
    }

    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
        inMemoryData = clone(defaultData);
        storage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
        return inMemoryData;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<DataShape>;
        inMemoryData = applyMigrations({
            stations: Array.isArray(parsed.stations) ? (parsed.stations as RadioStation[]) : clone(defaultData.stations),
            genres: Array.isArray(parsed.genres)
                ? normalizeGenres(parsed.genres as RawGenre[])
                : clone(defaultData.genres),
            exportProfiles: Array.isArray(parsed.exportProfiles) ? (parsed.exportProfiles as ExportProfile[]) : clone(defaultData.exportProfiles),
            playerApps: Array.isArray(parsed.playerApps)
                ? (parsed.playerApps as PlayerApp[]).map(normalizePlayerApp)
                : clone(defaultData.playerApps),
        });
    } catch {
        inMemoryData = clone(defaultData);
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(inMemoryData));
    return inMemoryData;
}

function persist(data: DataShape) {
    inMemoryData = data;
    const storage = getStorage();
    if (storage) {
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            // Log persistence errors to help with debugging
            console.warn('Failed to persist data to localStorage:', error);
        }
    }
}

function clone<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

function findGenreName(genres: Genre[], genreId: string | null | undefined): string | null {
    if (!genreId) return null;
    const genre = genres.find(g => g.id === genreId);
    return genre ? genre.name : null;
}

export function getAllData(): DataShape {
    const data = loadData();
    return clone(data);
}

export function getStations(): RadioStation[] {
    return clone(loadData().stations);
}

export function saveStation(station: RadioStation): RadioStation {
    const data = loadData();
    const exists = data.stations.some(s => s.id === station.id);
    const normalized = normalizeStation(station, data.genres);
    const nextStations = exists
        ? data.stations.map(s => (s.id === normalized.id ? normalized : s))
        : [...data.stations, normalized];
    const nextData = { ...data, stations: nextStations };
    persist(nextData);
    return clone(normalized);
}

export function deleteStation(stationId: string) {
    const data = loadData();
    const nextStations = data.stations.filter(s => s.id !== stationId);
    if (nextStations.length === data.stations.length) {
        throw new Error('Station not found');
    }
    const nextProfiles = data.exportProfiles.map(profile => ({
        ...profile,
        stationIds: profile.stationIds.filter(id => id !== stationId),
    }));
    persist({ ...data, stations: nextStations, exportProfiles: nextProfiles });
}

export function getGenres(): Genre[] {
    return clone(loadData().genres);
}

export function getPlayerApps(): PlayerApp[] {
    return clone(loadData().playerApps);
}

export function saveGenre(genre: Genre): Genre {
    const data = loadData();
    const normalized = normalizeGenre(genre);
    const exists = data.genres.some(g => g.id === normalized.id);
    const nextGenres = exists
        ? data.genres.map(g => (g.id === normalized.id ? normalized : g))
        : [...data.genres, normalized];
    const allowedSubGenres = new Set<string>();
    nextGenres.forEach(g => {
        g.subGenres.forEach(sub => allowedSubGenres.add(sub.toLowerCase()));
    });
    const nextProfiles = data.exportProfiles.map(profile => ({
        ...profile,
        subGenres: profile.subGenres.filter(sub => allowedSubGenres.has(sub.toLowerCase())),
    }));
    persist({ ...data, genres: nextGenres, exportProfiles: nextProfiles });
    return clone(normalized);
}

export function deleteGenre(genreId: string) {
    const data = loadData();
    const nextGenres = data.genres.filter(g => g.id !== genreId);
    if (nextGenres.length === data.genres.length) {
        throw new Error('Genre not found');
    }
    const nextStations = data.stations.map(station =>
        station.genreId === genreId ? { ...station, genreId: '', subGenres: [] } : station
    );
    const removedGenre = data.genres.find(g => g.id === genreId);
    const removedSubGenres = new Set<string>(
        (removedGenre?.subGenres ?? []).map(sub => sub.toLowerCase())
    );
    const nextProfiles = data.exportProfiles.map(profile => ({
        ...profile,
        genreIds: profile.genreIds.filter(id => id !== genreId),
        subGenres: removedSubGenres.size
            ? profile.subGenres.filter(sub => !removedSubGenres.has(sub.toLowerCase()))
            : profile.subGenres,
    }));
    persist({ ...data, genres: nextGenres, stations: nextStations, exportProfiles: nextProfiles });
}

function normalizePlayerApp(app: PlayerApp): PlayerApp {
    const normalizedPlatforms = Array.isArray(app.platforms)
        ? app.platforms.map(platform => platform.trim()).filter(Boolean)
        : [];
    const declaredPlatform = typeof app.platform === 'string' ? app.platform.trim() : '';
    if (declaredPlatform) {
        normalizedPlatforms.unshift(declaredPlatform);
    }
    const uniquePlatforms: string[] = [];
    const seen = new Set<string>();
    for (const value of normalizedPlatforms) {
        const lowered = value.toLowerCase();
        if (seen.has(lowered)) {
            continue;
        }
        seen.add(lowered);
        uniquePlatforms.push(value);
    }
    if (uniquePlatforms.length === 0) {
        uniquePlatforms.push('web');
    }
    const primaryPlatform = uniquePlatforms[0];

    const ftpProtocol = (typeof app.ftpProtocol === 'string' ? app.ftpProtocol : 'ftp') as PlayerApp['ftpProtocol'];
    const ftpTimeoutValue = Number(app.ftpTimeout);
    const ftpTimeout = Number.isFinite(ftpTimeoutValue) && ftpTimeoutValue > 0 ? ftpTimeoutValue : 30000;

    return {
        id: app.id,
        name: app.name,
        platforms: uniquePlatforms,
        platform: primaryPlatform,
        description: app.description || '',
        contactEmail: app.contactEmail || '',
        notes: app.notes || '',
        ftpEnabled: Boolean(app.ftpEnabled),
        ftpServer: app.ftpServer || '',
        ftpUsername: app.ftpUsername || '',
        ftpPassword: app.ftpPassword || '',
        ftpProtocol,
        ftpTimeout,
        networkCode: app.networkCode || '',
        imaEnabled: app.imaEnabled !== false,
        videoPrerollDefaultSize: (app.videoPrerollDefaultSize || '640x480').trim() || '640x480',
        placements: {
            preroll: app.placements?.preroll || '',
            midroll: app.placements?.midroll || '',
            rewarded: app.placements?.rewarded || '',
        },
    };
}

export function savePlayerApp(app: PlayerApp): PlayerApp {
    const data = loadData();
    const exists = data.playerApps.some(a => a.id === app.id);
    const normalized = normalizePlayerApp(app);
    const nextApps = exists
        ? data.playerApps.map(a => (a.id === normalized.id ? normalized : a))
        : [...data.playerApps, normalized];
    persist({ ...data, playerApps: nextApps });
    return clone(normalized);
}

export function deletePlayerApp(appId: string) {
    const data = loadData();
    const nextApps = data.playerApps.filter(app => app.id !== appId);
    if (nextApps.length === data.playerApps.length) {
        throw new Error('Player app not found');
    }
    const nextProfiles = data.exportProfiles.map(profile =>
        profile.playerId === appId ? { ...profile, playerId: null } : profile
    );
    persist({ ...data, playerApps: nextApps, exportProfiles: nextProfiles });
}

export function getExportProfiles(): ExportProfile[] {
    return clone(loadData().exportProfiles);
}

function normalizeProfile(profile: ExportProfile): ExportProfile {
    return {
        id: profile.id,
        name: profile.name,
        genreIds: Array.isArray(profile.genreIds) ? profile.genreIds : [],
        stationIds: Array.isArray(profile.stationIds) ? profile.stationIds : [],
        subGenres: sanitizeSubGenres((profile as ExportProfile & { subGenres?: unknown }).subGenres),
        playerId: profile.playerId || null,
        autoExport: {
            enabled: Boolean(profile.autoExport?.enabled),
            interval: profile.autoExport?.interval || 'daily',
            time: profile.autoExport?.time || '09:00',
        },
    };
}

export function saveExportProfile(profile: ExportProfile): ExportProfile {
    const data = loadData();
    const normalized = normalizeProfile(profile);
    const exists = data.exportProfiles.some(p => p.id === normalized.id);
    const clearedConflicts = data.exportProfiles.map(p => {
        if (!normalized.playerId || p.id === normalized.id) {
            return p;
        }
        if (p.playerId === normalized.playerId) {
            return { ...p, playerId: null };
        }
        return p;
    });
    const nextProfiles = exists
        ? clearedConflicts.map(p => (p.id === normalized.id ? normalized : p))
        : [...clearedConflicts, normalized];
    persist({ ...data, exportProfiles: nextProfiles });
    return clone(normalized);
}

export function deleteExportProfile(profileId: string) {
    const data = loadData();
    const nextProfiles = data.exportProfiles.filter(p => p.id !== profileId);
    if (nextProfiles.length === data.exportProfiles.length) {
        throw new Error('Export profile not found');
    }
    persist({ ...data, exportProfiles: nextProfiles });
}

const IOS_VMAP_URL =
    'https://pubads.g.doubleclick.net/gampad/ads?iu={iu}&env=vp&gdfp_req=1&output=vmap&ad_rule=1&description_url={encoded_page_url}&cust_params={encoded_cust_params}&npa={npa}&tfcd={tfcd}&us_privacy={us_privacy}';
const ANDROID_VAST_TEMPLATE =
    'https://pubads.g.doubleclick.net/gampad/ads?iu={iu}&env=vp&gdfp_req=1&unviewed_position_start=1&output=vast&sz={size}&description_url={encoded_page_url}&cust_params={encoded_cust_params}&npa={npa}&tfcd={tfcd}&us_privacy={us_privacy}';

const DEFAULT_NETWORK_CODE = (() => {
    const codes = new Set(
        defaultData.playerApps
            .map(app => (app.networkCode || '').trim())
            .filter((code): code is string => code.length > 0)
    );
    if (codes.size === 1) {
        const [only] = Array.from(codes);
        return only;
    }
    return '';
})();

function extractNetworkCodeFromPlacement(iu: unknown): string | null {
    if (typeof iu !== 'string') {
        return null;
    }
    const match = iu.trim().match(/\/(\d{3,})\b/);
    return match ? match[1] : null;
}

function resolveNetworkCode(rawNetworkCode: string | undefined, placements: PlayerApp['placements'] | undefined): string {
    const trimmed = (rawNetworkCode || '').trim();
    if (trimmed) {
        return trimmed;
    }

    const placementList: (string | undefined)[] = placements
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

function normalizeIosPlacement(raw: string | undefined, fallback: string): string {
    const base = (raw || '').trim() || fallback;
    if (!base) {
        return '';
    }

    let normalized = base.replace(/_preroll\b/gi, '_adrules').replace(/_midroll\b/gi, '_adrules');
    if (/_adrules\b/i.test(normalized) && /\/radio\//i.test(normalized)) {
        normalized = normalized.replace(/\/radio\//i, '/webradio/');
    }

    return normalized;
}

function normalizeAndroidPlacement(raw: string | undefined, fallback: string, expected: string): string {
    const trimmed = (raw || '').trim();
    const fallbackTrimmed = fallback.trim();
    const source = trimmed || fallbackTrimmed;
    if (!source) {
        return '';
    }

    const sourceMatch = source.match(/^(.*\/)?([^/]+)$/);
    let prefix = sourceMatch?.[1] ?? '';
    let leaf = sourceMatch?.[2] ?? source;

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
        if (fallbackMatch?.[1]) {
            prefix = fallbackMatch[1];
        }
    }

    let normalized = `${prefix}${leaf}`;
    if (/_preroll\b/i.test(leaf) && /\/radio\//i.test(normalized)) {
        normalized = normalized.replace(/\/radio\//gi, '/webradio/');
    }

    return normalized;
}

function slugifyName(value: string, fallback: string) {
    const base = (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const trimmed = base.replace(/^-+|-+$/g, '');
    return trimmed || fallback;
}

function firstToken(input: string | undefined | null): string | null {
    if (!input) return null;
    const match = input.match(/[a-z0-9]+/i);
    return match ? match[0].toLowerCase() : null;
}

function resolveAdSection(tags: string[] | undefined, normalizedGenre: string | null): string | null {
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

function determinePlatforms(player: PlayerApp | undefined): string[] {
    if (!player) return [];
    const platforms = new Set<string>();

    const explicit = typeof player.platform === 'string' ? player.platform.trim() : '';
    if (explicit) {
        platforms.add(explicit.toLowerCase());
    }

    const platformList = Array.isArray(player.platforms) ? player.platforms : [];
    for (const value of platformList) {
        if (typeof value !== 'string') {
            continue;
        }
        const trimmed = value.trim();
        if (trimmed) {
            platforms.add(trimmed.toLowerCase());
        }
    }

    return Array.from(platforms);
}

function determinePlatform(player: PlayerApp | undefined): string | null {
    const platforms = determinePlatforms(player);
    return platforms.length > 0 ? platforms[0] : null;
}

function buildAdsPayload(player: PlayerApp, platform: string) {
    const normalizedPlatform = typeof platform === 'string' ? platform.trim().toLowerCase() : '';
    const placements = player.placements || { preroll: '', midroll: '', rewarded: '' };
    const videoDefaultSize = (player.videoPrerollDefaultSize || '640x480').trim() || '640x480';
    const networkCode = resolveNetworkCode(player.networkCode, placements);
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
            exempt_placements: [] as string[],
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

    if (normalizedPlatform === 'android') {
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

export function exportProfile(profileId: string): ExportPayload {
    const data = loadData();
    const profile = data.exportProfiles.find(p => p.id === profileId);
    if (!profile) {
        throw new Error('Export profile not found');
    }

    const genreIds = Array.isArray(profile.genreIds) ? profile.genreIds : [];
    const stationIds = Array.isArray(profile.stationIds) ? profile.stationIds : [];
    const profileSubGenres = Array.isArray(profile.subGenres) ? profile.subGenres : [];

    const explicitStationIds = new Set(stationIds);
    const subGenreFilter = new Set(profileSubGenres.map(sub => sub.toLowerCase()));
    const byId = new Map<string, RadioStation>();

    for (const station of data.stations) {
        const matchesGenre = genreIds.includes(station.genreId);
        const matchesSubGenre = station.subGenres.some(sub => subGenreFilter.has(sub.toLowerCase()));
        const isExplicit = explicitStationIds.has(station.id);
        if (!matchesGenre && !matchesSubGenre && !isExplicit) {
            continue;
        }
        if (!isExplicit && station.isActive === false) {
            continue;
        }
        if (!byId.has(station.id)) {
            byId.set(station.id, station);
        }
    }

    const genreLookup = new Map(data.genres.map(g => [g.id, g.name] as const));

    const stations = Array.from(byId.values())
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(station => {
            const genreName = findGenreName(data.genres, station.genreId) || genreLookup.get(station.genreId) || null;
            const normalizedGenre = station.genreId || (genreName ? genreName.toLowerCase() : null);
            const section = resolveAdSection(station.tags, normalizedGenre);
            const baseStation: ExportedStation = {
                id: station.id,
                name: station.name,
                genre: normalizedGenre,
                url: station.streamUrl,
                logo: getStationLogoUrl(station.logoUrl),
                description: station.description,
                bitrate: Number.isFinite(station.bitrate) ? station.bitrate : 128,
                language: station.language || 'en',
                region: station.region || 'Global',
                tags: Array.isArray(station.tags) ? station.tags : [],
                subGenres: Array.isArray(station.subGenres) ? station.subGenres : [],
                isPlaying: false,
                isFavorite: Boolean(station.isFavorite),
                imaAdType: station.imaAdType || 'no',
            };

            if (section) {
                baseStation.adMeta = { section };
            }

            return baseStation;
        });

    const payload: ExportPayload = { stations };

    const player = profile.playerId ? data.playerApps.find(app => app.id === profile.playerId) : undefined;
    const platform = determinePlatform(player);

    if (player && platform && ['ios', 'android'].includes(platform)) {
        payload.app = {
            id: slugifyName(player.name, player.id),
            platform,
            version: 1,
        };
        const ads = buildAdsPayload(player, platform);
        if (ads) {
            payload.ads = ads;
        }
    }

    return payload;
}

export function resetToDefault() {
    persist(clone(defaultData));
}
