import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { test } from './harness';

const TEMP_EXPORT_DIR = mkdtempSync(path.join(tmpdir(), 'webradio-exports-'));
process.env.EXPORT_OUTPUT_DIR = TEMP_EXPORT_DIR;
process.on('exit', () => {
    try {
        rmSync(TEMP_EXPORT_DIR, { recursive: true, force: true });
    } catch (error) {
        // ignore cleanup errors
    }
});

async function loadServerModule() {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    return require(path.join(process.cwd(), 'server', 'index.js')) as any;
}

const ANDROID_VAST_TEMPLATE =
    'https://pubads.g.doubleclick.net/gampad/ads?iu={iu}&env=vp&gdfp_req=1&unviewed_position_start=1&output=vast&sz={size}&description_url={encoded_page_url}&cust_params={encoded_cust_params}&npa={npa}&tfcd={tfcd}&us_privacy={us_privacy}';

const IOS_VMAP_URL =
    'https://pubads.g.doubleclick.net/gampad/ads?iu={iu}&env=vp&gdfp_req=1&output=vmap&ad_rule=1&description_url={encoded_page_url}&cust_params={encoded_cust_params}&npa={npa}&tfcd={tfcd}&us_privacy={us_privacy}';

test('buildPayloadForPlatform regenerates platform-specific ad payloads for multi-platform apps', async () => {
    const serverModule = await loadServerModule();
    const buildAdsPayload = serverModule.buildAdsPayload as (player: any, platform: string) => any;

    const player = {
        id: 'player-chillout',
        name: 'Chillout Essentials',
        platform: 'ios',
        platforms: ['iOS', 'Android', 'Home Assistant'],
        networkCode: '1234567',
        imaEnabled: true,
        videoPrerollDefaultSize: '960x540',
        placements: {
            preroll: '/1234567/radio/preroll',
            midroll: '/1234567/radio/midroll',
            rewarded: '',
        },
    };

    const stations = [
        {
            id: 'station-1',
            name: 'SomaFM Groove Salad',
            genre: 'chillout',
            url: 'https://ice1.somafm.com/groovesalad-256-mp3',
            logo: '/static/webradio_placeholder.png',
            description: 'A nicely chilled plate of ambient/downtempo beats and grooves.',
            bitrate: 256,
            language: 'en',
            region: 'Global',
            tags: ['ambient', 'downtempo', 'chillout'],
            subGenres: ['Downtempo'],
            isPlaying: false,
            isFavorite: false,
            imaAdType: 'audio',
        },
    ];

    const iosAds = buildAdsPayload(player, 'ios');
    assert.ok(iosAds);
    assert.strictEqual(iosAds.mode, 'vmap');
    assert.strictEqual(iosAds.vmap_url, IOS_VMAP_URL);

    const exportContext = {
        payload: {
            stations,
            app: {
                id: 'chillout-essentials',
                platform: 'ios',
                version: 1,
            },
            ads: iosAds,
        },
        player,
        platform: 'ios',
        stationCount: stations.length,
    };

    const androidPayload = serverModule.buildPayloadForPlatform(exportContext, ' Android ');
    assert.ok(androidPayload);
    assert.strictEqual(androidPayload.app?.platform, 'android');
    assert.strictEqual(androidPayload.app?.id, 'chillout-essentials');
    assert.strictEqual(androidPayload.ads?.mode, 'vast');
    assert.strictEqual(androidPayload.ads?.ad_tag_template, ANDROID_VAST_TEMPLATE);
    assert.strictEqual(androidPayload.ads?.network_code, '1234567');
    assert.deepStrictEqual(androidPayload.ads?.placements, {
        audio_preroll: {
            iu: '/1234567/webradio/audio_preroll',
            default_size: '1x1',
            enabled: true,
        },
        video_preroll: {
            iu: '/1234567/webradio/video_preroll',
            default_size: '960x540',
            enabled: true,
        },
    });
    assert.deepStrictEqual(androidPayload.ads?.route, {
        audio: 'audio_preroll',
        video: 'video_preroll',
        no: null,
    });

    const homeAssistantPayload = serverModule.buildPayloadForPlatform(exportContext, 'Home Assistant');
    assert.ok(homeAssistantPayload);
    assert.strictEqual(homeAssistantPayload.app?.platform, 'homeassistant');
    assert.strictEqual(homeAssistantPayload.ads?.mode, 'vast');
    assert.strictEqual(homeAssistantPayload.ads?.ad_tag_template, ANDROID_VAST_TEMPLATE);
    assert.deepStrictEqual(homeAssistantPayload.ads?.placements, {
        audio_preroll: {
            iu: '/1234567/webradio/audio_preroll',
            default_size: '1x1',
            enabled: true,
        },
        video_preroll: {
            iu: '/1234567/webradio/video_preroll',
            default_size: '960x540',
            enabled: true,
        },
    });
    assert.deepStrictEqual(homeAssistantPayload.ads?.route, {
        audio: 'audio_preroll',
        video: 'video_preroll',
        no: null,
    });
    assert.deepStrictEqual(homeAssistantPayload.settings, {
        autoplay: false,
        volume_default: 0.7,
        ads_enabled: true,
        ui_theme: 'dark',
    });

    const iosPayload = serverModule.buildPayloadForPlatform(exportContext, 'ios');
    assert.ok(iosPayload);
    assert.strictEqual(iosPayload.app?.platform, 'ios');
    assert.strictEqual(iosPayload.ads?.mode, 'vmap');
    assert.strictEqual(iosPayload.ads?.vmap_url, IOS_VMAP_URL);

    // Ensure the original export context remains iOS-specific.
    assert.strictEqual(exportContext.payload.app?.platform, 'ios');
    assert.strictEqual(exportContext.payload.ads?.mode, 'vmap');
});

test('buildPayloadForPlatform coerces legacy iOS payloads into Android VAST exports', async () => {
    const serverModule = await loadServerModule();
    const buildPayloadForPlatform = serverModule.buildPayloadForPlatform as (context: any, platform: string) => any;

    const player = {
        id: 'player-chillout',
        name: 'Chillout Essentials',
        platform: 'ios',
        platforms: ['iOS', 'Android'],
        networkCode: '1234567',
        imaEnabled: true,
        videoPrerollDefaultSize: '720x405',
        placements: {
            preroll: '/1234567/webradio/audio_preroll',
            midroll: '/1234567/webradio/video_preroll',
            rewarded: '',
        },
    };

    const legacyIosAds = {
        network_code: '1234567',
        mode: 'vmap',
        vmap_url:
            'https://pubads.g.doubleclick.net/gampad/ads?iu={iu}&env=vp&gdfp_req=1&output=vmap&description_url={encoded_page_url}&cust_params={encoded_cust_params}&npa={npa}&tfcd={tfcd}&us_privacy={us_privacy}',
        placements: {
            audio_rules: {
                iu: '/1234567/webradio/audio_preroll',
                enabled: true,
            },
            video_rules: {
                iu: '/1234567/webradio/video_preroll',
                enabled: true,
            },
        },
        route: {
            audio: 'audio_rules',
            video: 'video_rules',
            no: null,
        },
    };

    const exportContext = {
        payload: {
            stations: [],
            app: {
                id: 'chillout-essentials',
                platform: 'ios',
                version: 1,
            },
            ads: legacyIosAds,
        },
        player,
        platform: 'ios',
        stationCount: 0,
    };

    const androidPayload = buildPayloadForPlatform(exportContext, 'android');
    assert.ok(androidPayload);
    assert.strictEqual(androidPayload.app?.platform, 'android');
    assert.strictEqual(androidPayload.ads?.mode, 'vast');
    assert.strictEqual(androidPayload.ads?.ad_tag_template, ANDROID_VAST_TEMPLATE);
    assert.deepStrictEqual(androidPayload.ads?.placements, {
        audio_preroll: {
            iu: '/1234567/webradio/audio_preroll',
            default_size: '1x1',
            enabled: true,
        },
        video_preroll: {
            iu: '/1234567/webradio/video_preroll',
            default_size: '720x405',
            enabled: true,
        },
    });
    assert.deepStrictEqual(androidPayload.ads?.route, {
        audio: 'audio_preroll',
        video: 'video_preroll',
        no: null,
    });

    const homeAssistantPayload = buildPayloadForPlatform(exportContext, 'home assistant');
    assert.ok(homeAssistantPayload);
    assert.strictEqual(homeAssistantPayload.app?.platform, 'homeassistant');
    assert.strictEqual(homeAssistantPayload.ads?.mode, 'vast');
    assert.strictEqual(homeAssistantPayload.ads?.ad_tag_template, ANDROID_VAST_TEMPLATE);
    assert.deepStrictEqual(homeAssistantPayload.ads?.placements, {
        audio_preroll: {
            iu: '/1234567/webradio/audio_preroll',
            default_size: '1x1',
            enabled: true,
        },
        video_preroll: {
            iu: '/1234567/webradio/video_preroll',
            default_size: '720x405',
            enabled: true,
        },
    });
    assert.deepStrictEqual(homeAssistantPayload.ads?.route, {
        audio: 'audio_preroll',
        video: 'video_preroll',
        no: null,
    });
    assert.deepStrictEqual(homeAssistantPayload.settings, {
        autoplay: false,
        volume_default: 0.7,
        ads_enabled: true,
        ui_theme: 'dark',
    });

    // Original export context should remain untouched so iOS exports keep legacy data until regenerated.
    assert.strictEqual(exportContext.payload.app?.platform, 'ios');
    assert.strictEqual(exportContext.payload.ads?.mode, 'vmap');
    assert.strictEqual(exportContext.payload.ads?.vmap_url, legacyIosAds.vmap_url);
});

test('writeExportFiles deduplicates platforms and preserves platform-specific payloads', async () => {
    const serverModule = await loadServerModule();
    const fs = await import('node:fs/promises');
    const buildAdsPayload = serverModule.buildAdsPayload as (player: any, platform: string) => any;
    const writeExportFiles = serverModule.writeExportFiles as (profile: any, exportContext: any) => Promise<any[]>;
    const determinePlatforms = serverModule.determinePlatforms as (player: any) => string[];

    const player = {
        id: 'player-chillout',
        name: 'Chillout Essentials',
        platform: ' Android ',
        platforms: ['iOS', 'android', 'ANDROID', '  ', 'Home Assistant'],
        networkCode: '1234567',
        imaEnabled: true,
        videoPrerollDefaultSize: '800x450',
        placements: {
            preroll: '/1234567/radio/preroll',
            midroll: '/1234567/radio/midroll',
            rewarded: '',
        },
    };

    assert.deepStrictEqual(determinePlatforms(player), ['android', 'ios', 'homeassistant']);

    const iosAds = buildAdsPayload(player, 'ios');
    const exportContext = {
        payload: {
            stations: [],
            app: {
                id: 'chillout-essentials',
                platform: 'ios',
                version: 1,
            },
            ads: iosAds,
        },
        player,
        platform: 'ios',
        stationCount: 0,
    };

    const profile = { id: 'profile-1', name: 'Chillout Essentials' };

    const targets = await writeExportFiles(profile, exportContext);
    assert.strictEqual(targets.length, 3);
    const platforms = targets.map(target => target.platform).sort();
    assert.deepStrictEqual(platforms, ['android', 'homeassistant', 'ios']);

    for (const target of targets) {
        const contents = await fs.readFile(target.outputPath, 'utf8');
        const parsed = JSON.parse(contents);
        assert.strictEqual(parsed.app?.platform, target.platform);
        if (target.platform === 'android') {
            assert.strictEqual(parsed.ads?.mode, 'vast');
            assert.ok(parsed.ads?.ad_tag_template);
            assert.ok(parsed.settings === undefined);
        } else if (target.platform === 'homeassistant') {
            assert.strictEqual(parsed.ads?.mode, 'vast');
            assert.ok(parsed.ads?.ad_tag_template);
            assert.deepStrictEqual(parsed.settings, {
                autoplay: false,
                volume_default: 0.7,
                ads_enabled: true,
                ui_theme: 'dark',
            });
        } else if (target.platform === 'ios') {
            assert.strictEqual(parsed.ads?.mode, 'vmap');
            assert.ok(parsed.ads?.vmap_url);
        }
        await fs.unlink(target.outputPath);
    }
});

test('writeExportFiles exports full JSON payloads for every platform selected on the player', async () => {
    const serverModule = await loadServerModule();
    const fs = await import('node:fs/promises');
    const buildExportPayload = serverModule.buildExportPayload as (profile: any, data: any) => any;
    const writeExportFiles = serverModule.writeExportFiles as (profile: any, exportContext: any) => Promise<any[]>;

    const profile = {
        id: 'profile-chillout',
        name: 'Chillout Essentials Multi',
        playerId: 'player-chillout',
        genreIds: ['chillout'],
        stationIds: [],
        subGenres: [],
    };

    const player = {
        id: 'player-chillout',
        name: 'Chillout Essentials',
        platform: 'iOS',
        platforms: ['iOS', 'Android', 'Home Assistant'],
        networkCode: '1234567',
        imaEnabled: true,
        videoPrerollDefaultSize: '854x480',
        placements: {
            preroll: '/1234567/radio/audio_preroll',
            midroll: '/1234567/radio/video_preroll',
            rewarded: '',
        },
    };

    const data = {
        genres: [
            {
                id: 'chillout',
                name: 'Chillout',
                subGenres: ['Downtempo'],
            },
        ],
        stations: [
            {
                id: 'station-1',
                name: 'SomaFM Groove Salad',
                streamUrl: 'https://ice1.somafm.com/groovesalad-256-mp3',
                description: 'A nicely chilled plate of ambient/downtempo beats and grooves.',
                genreId: 'chillout',
                subGenres: ['Downtempo'],
                logoUrl: '',
                bitrate: 256,
                language: 'en',
                region: 'Global',
                tags: ['chillout vibes', 'ambient'],
                imaAdType: 'audio',
                isActive: true,
                isFavorite: false,
            },
        ],
        playerApps: [player],
        exportProfiles: [],
    };

    const exportContext = buildExportPayload(profile, data);

    assert.strictEqual(exportContext.platform, 'ios');
    assert.deepStrictEqual(exportContext.payload.app, {
        id: 'chillout-essentials',
        platform: 'ios',
        version: 1,
    });
    assert.deepStrictEqual(exportContext.payload.stations, [
        {
            id: 'station-1',
            name: 'SomaFM Groove Salad',
            genre: 'chillout',
            url: 'https://ice1.somafm.com/groovesalad-256-mp3',
            logo: '/static/webradio_placeholder.png',
            description: 'A nicely chilled plate of ambient/downtempo beats and grooves.',
            bitrate: 256,
            language: 'en',
            region: 'Global',
            tags: ['chillout vibes', 'ambient'],
            subGenres: ['Downtempo'],
            isPlaying: false,
            isFavorite: false,
            imaAdType: 'audio',
            adMeta: { section: 'chillout' },
        },
    ]);

    const targets = await writeExportFiles(profile, exportContext);
    assert.strictEqual(targets.length, 3);
    const platforms = targets.map(target => target.platform).sort();
    assert.deepStrictEqual(platforms, ['android', 'homeassistant', 'ios']);

    const expectedStations = exportContext.payload.stations;
    const expectedIosAds = {
        network_code: '1234567',
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
        mode: 'vmap',
        vmap_url: IOS_VMAP_URL,
        placements: {
            audio_rules: {
                iu: '/1234567/webradio/audio_adrules',
                enabled: true,
            },
            video_rules: {
                iu: '/1234567/webradio/video_adrules',
                enabled: true,
            },
        },
        route: {
            audio: 'audio_rules',
            video: 'video_rules',
            no: null,
        },
    } as const;
    const expectedAndroidAds = {
        network_code: '1234567',
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
        mode: 'vast',
        ad_tag_template: ANDROID_VAST_TEMPLATE,
        placements: {
            audio_preroll: {
                iu: '/1234567/webradio/audio_preroll',
                default_size: '1x1',
                enabled: true,
            },
            video_preroll: {
                iu: '/1234567/webradio/video_preroll',
                default_size: '854x480',
                enabled: true,
            },
        },
        route: {
            audio: 'audio_preroll',
            video: 'video_preroll',
            no: null,
        },
    } as const;
    const expectedHomeAssistantSettings = {
        autoplay: false,
        volume_default: 0.7,
        ads_enabled: true,
        ui_theme: 'dark',
    } as const;

    for (const target of targets) {
        const contents = await fs.readFile(target.outputPath, 'utf8');
        const parsed = JSON.parse(contents);
        assert.deepStrictEqual(parsed.stations, expectedStations);
        if (target.platform === 'ios') {
            assert.deepStrictEqual(parsed.app, {
                id: 'chillout-essentials',
                platform: 'ios',
                version: 1,
            });
            assert.deepStrictEqual(parsed.ads, expectedIosAds);
            assert.ok(parsed.settings === undefined);
        } else if (target.platform === 'android') {
            assert.deepStrictEqual(parsed.app, {
                id: 'chillout-essentials',
                platform: 'android',
                version: 1,
            });
            assert.deepStrictEqual(parsed.ads, expectedAndroidAds);
            assert.strictEqual(parsed.settings, undefined);
        } else if (target.platform === 'homeassistant') {
            assert.deepStrictEqual(parsed.app, {
                id: 'chillout-essentials',
                platform: 'homeassistant',
                version: 1,
            });
            assert.deepStrictEqual(parsed.ads, expectedAndroidAds);
            assert.deepStrictEqual(parsed.settings, expectedHomeAssistantSettings);
        } else {
            assert.fail(`Unexpected platform export: ${target.platform}`);
        }
        await fs.unlink(target.outputPath);
    }
});

test('buildExportPayload includes Home Assistant settings and honors disabled IMA', async () => {
    const serverModule = await loadServerModule();
    const buildExportPayload = serverModule.buildExportPayload as (profile: any, data: any) => any;

    const profile = {
        id: 'profile-homeassistant',
        name: 'Home Assistant Feed',
        playerId: 'player-homeassistant',
        genreIds: ['chillout'],
        stationIds: [],
        subGenres: [],
    };

    const player = {
        id: 'player-homeassistant',
        name: 'Home Assistant Player',
        platform: 'Home Assistant',
        platforms: ['Home Assistant'],
        networkCode: '7654321',
        imaEnabled: false,
        videoPrerollDefaultSize: '1280x720',
        placements: {
            preroll: '/7654321/webradio/audio_preroll',
            midroll: '/7654321/webradio/video_preroll',
            rewarded: '',
        },
    };

    const data = {
        genres: [
            {
                id: 'chillout',
                name: 'Chillout',
                subGenres: ['Downtempo'],
            },
        ],
        stations: [
            {
                id: 'station-1',
                name: 'SomaFM Groove Salad',
                streamUrl: 'https://ice1.somafm.com/groovesalad-256-mp3',
                description: 'A nicely chilled plate of ambient/downtempo beats and grooves.',
                genreId: 'chillout',
                subGenres: ['Downtempo'],
                logoUrl: '',
                bitrate: 256,
                language: 'en',
                region: 'Global',
                tags: ['chillout vibes', 'ambient'],
                imaAdType: 'audio',
                isActive: true,
                isFavorite: false,
            },
        ],
        playerApps: [player],
        exportProfiles: [],
    };

    const exportContext = buildExportPayload(profile, data);

    assert.strictEqual(exportContext.platform, 'homeassistant');
    assert.deepStrictEqual(exportContext.payload.app, {
        id: 'home-assistant-player',
        platform: 'homeassistant',
        version: 1,
    });
    assert.strictEqual(exportContext.payload.ads, undefined);
    assert.deepStrictEqual(exportContext.payload.settings, {
        autoplay: false,
        volume_default: 0.7,
        ads_enabled: false,
        ui_theme: 'dark',
    });
});
