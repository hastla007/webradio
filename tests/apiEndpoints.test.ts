import { test } from './harness';
import assert from 'node:assert/strict';
import path from 'node:path';

async function loadServerModule() {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    return require(path.join(process.cwd(), 'server', 'index.js')) as any;
}

// ============================================================================
// Export Payload Tests
// ============================================================================

test('buildExportPayload filters stations by genre correctly', async () => {
    const serverModule = await loadServerModule();
    const { buildExportPayload } = serverModule;

    const genres = [
        { id: 'rock', name: 'Rock', subGenres: ['classic-rock', 'hard-rock'] },
        { id: 'jazz', name: 'Jazz', subGenres: ['smooth-jazz'] },
    ];

    const stations = [
        {
            id: 's1',
            name: 'Rock Station',
            streamUrl: 'http://rock.stream',
            genreId: 'rock',
            subGenres: ['classic-rock'],
            logoUrl: 'http://logo.png',
            description: 'Rock station',
            bitrate: 128,
            language: 'en',
            region: 'US',
            tags: [],
            imaAdType: 'no',
            isActive: true,
            isFavorite: false,
        },
        {
            id: 's2',
            name: 'Jazz Station',
            streamUrl: 'http://jazz.stream',
            genreId: 'jazz',
            subGenres: ['smooth-jazz'],
            logoUrl: 'http://logo.png',
            description: 'Jazz station',
            bitrate: 128,
            language: 'en',
            region: 'US',
            tags: [],
            imaAdType: 'no',
            isActive: true,
            isFavorite: false,
        },
        {
            id: 's3',
            name: 'Inactive Rock',
            streamUrl: 'http://inactive.stream',
            genreId: 'rock',
            subGenres: [],
            logoUrl: 'http://logo.png',
            description: 'Inactive',
            bitrate: 128,
            language: 'en',
            region: 'US',
            tags: [],
            imaAdType: 'no',
            isActive: false,
            isFavorite: false,
        },
    ];

    const profile = {
        id: 'profile1',
        name: 'Rock Only',
        genreIds: ['rock'],
        stationIds: [],
        subGenres: [],
        playerId: null,
        autoExport: {
            enabled: false,
            interval: 'daily',
            time: '09:00',
        },
    };

    const data = { genres, stations, playerApps: [], exportProfiles: [] };
    const result = buildExportPayload(profile, data);

    assert.strictEqual(result.stationCount, 1, 'Should include only active rock stations');
    assert.strictEqual(result.payload.stations.length, 1);
    assert.strictEqual(result.payload.stations[0].id, 's1');
});

test('buildExportPayload includes explicitly selected inactive stations', async () => {
    const serverModule = await loadServerModule();
    const { buildExportPayload } = serverModule;

    const genres = [
        { id: 'rock', name: 'Rock', subGenres: [] },
    ];

    const stations = [
        {
            id: 's1',
            name: 'Inactive Station',
            streamUrl: 'http://inactive.stream',
            genreId: 'rock',
            subGenres: [],
            logoUrl: 'http://logo.png',
            description: 'Inactive',
            bitrate: 128,
            language: 'en',
            region: 'US',
            tags: [],
            imaAdType: 'no',
            isActive: false,
            isFavorite: false,
        },
    ];

    const profile = {
        id: 'profile1',
        name: 'Explicit Selection',
        genreIds: [],
        stationIds: ['s1'], // Explicitly selected
        subGenres: [],
        playerId: null,
        autoExport: {
            enabled: false,
            interval: 'daily',
            time: '09:00',
        },
    };

    const data = { genres, stations, playerApps: [], exportProfiles: [] };
    const result = buildExportPayload(profile, data);

    assert.strictEqual(result.stationCount, 1, 'Should include explicitly selected inactive stations');
    assert.strictEqual(result.payload.stations[0].id, 's1');
});

test('buildExportPayload deduplicates stations matched by multiple criteria', async () => {
    const serverModule = await loadServerModule();
    const { buildExportPayload } = serverModule;

    const genres = [
        { id: 'rock', name: 'Rock', subGenres: ['classic-rock'] },
    ];

    const stations = [
        {
            id: 's1',
            name: 'Rock Station',
            streamUrl: 'http://rock.stream',
            genreId: 'rock',
            subGenres: ['classic-rock'],
            logoUrl: 'http://logo.png',
            description: 'Rock',
            bitrate: 128,
            language: 'en',
            region: 'US',
            tags: [],
            imaAdType: 'no',
            isActive: true,
            isFavorite: false,
        },
    ];

    const profile = {
        id: 'profile1',
        name: 'Rock Profile',
        genreIds: ['rock'], // Matches by genre
        stationIds: ['s1'], // Also explicitly selected
        subGenres: ['classic-rock'], // Also matches by sub-genre
        playerId: null,
        autoExport: {
            enabled: false,
            interval: 'daily',
            time: '09:00',
        },
    };

    const data = { genres, stations, playerApps: [], exportProfiles: [] };
    const result = buildExportPayload(profile, data);

    assert.strictEqual(result.stationCount, 1, 'Should deduplicate stations matched by multiple criteria');
    assert.strictEqual(result.payload.stations.length, 1);
});

test('buildExportPayload sorts stations alphabetically by name', async () => {
    const serverModule = await loadServerModule();
    const { buildExportPayload } = serverModule;

    const genres = [
        { id: 'rock', name: 'Rock', subGenres: [] },
    ];

    const stations = [
        {
            id: 's3',
            name: 'Zebra Station',
            streamUrl: 'http://zebra.stream',
            genreId: 'rock',
            subGenres: [],
            logoUrl: 'http://logo.png',
            description: 'Z',
            bitrate: 128,
            language: 'en',
            region: 'US',
            tags: [],
            imaAdType: 'no',
            isActive: true,
            isFavorite: false,
        },
        {
            id: 's1',
            name: 'Alpha Station',
            streamUrl: 'http://alpha.stream',
            genreId: 'rock',
            subGenres: [],
            logoUrl: 'http://logo.png',
            description: 'A',
            bitrate: 128,
            language: 'en',
            region: 'US',
            tags: [],
            imaAdType: 'no',
            isActive: true,
            isFavorite: false,
        },
        {
            id: 's2',
            name: 'Beta Station',
            streamUrl: 'http://beta.stream',
            genreId: 'rock',
            subGenres: [],
            logoUrl: 'http://logo.png',
            description: 'B',
            bitrate: 128,
            language: 'en',
            region: 'US',
            tags: [],
            imaAdType: 'no',
            isActive: true,
            isFavorite: false,
        },
    ];

    const profile = {
        id: 'profile1',
        name: 'All Stations',
        genreIds: ['rock'],
        stationIds: [],
        subGenres: [],
        playerId: null,
        autoExport: {
            enabled: false,
            interval: 'daily',
            time: '09:00',
        },
    };

    const data = { genres, stations, playerApps: [], exportProfiles: [] };
    const result = buildExportPayload(profile, data);

    assert.strictEqual(result.payload.stations[0].name, 'Alpha Station');
    assert.strictEqual(result.payload.stations[1].name, 'Beta Station');
    assert.strictEqual(result.payload.stations[2].name, 'Zebra Station');
});

// ============================================================================
// Platform Detection Tests
// ============================================================================

test('determinePlatforms extracts and deduplicates platforms', async () => {
    const serverModule = await loadServerModule();
    const { determinePlatforms } = serverModule;

    const player = {
        id: 'player1',
        name: 'Multi-Platform Player',
        platform: 'ios',
        platforms: ['iOS', 'ios', 'android'], // Duplicates with different casing
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        ftpProtocol: 'ftp',
        ftpTimeout: 30000,
        networkCode: '12345',
        imaEnabled: true,
        videoPrerollDefaultSize: '640x480',
        placements: {
            preroll: '',
            midroll: '',
            rewarded: '',
        },
    };

    const platforms = determinePlatforms(player);
    assert.strictEqual(platforms.length, 2, 'Should deduplicate platforms');
    assert.ok(platforms.includes('ios'));
    assert.ok(platforms.includes('android'));
});

test('determinePlatforms handles null player', async () => {
    const serverModule = await loadServerModule();
    const { determinePlatforms } = serverModule;

    const platforms = determinePlatforms(null);
    assert.deepStrictEqual(platforms, [], 'Should return empty array for null player');
});

test('determinePlatform returns primary platform', async () => {
    const serverModule = await loadServerModule();
    const { determinePlatform } = serverModule;

    const player = {
        id: 'player1',
        name: 'Player',
        platform: 'android',
        platforms: ['ios', 'android'],
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        ftpProtocol: 'ftp',
        ftpTimeout: 30000,
        networkCode: '12345',
        imaEnabled: true,
        videoPrerollDefaultSize: '640x480',
        placements: {
            preroll: '',
            midroll: '',
            rewarded: '',
        },
    };

    const platform = determinePlatform(player);
    assert.strictEqual(platform, 'android', 'Should return primary platform');
});

// ============================================================================
// Ad Configuration Tests
// ============================================================================

test('buildAdsPayload creates iOS VMAP configuration', async () => {
    const serverModule = await loadServerModule();
    const { buildAdsPayload } = serverModule;

    const player = {
        id: 'player1',
        name: 'iOS Player',
        platform: 'ios',
        platforms: ['ios'],
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        ftpProtocol: 'ftp',
        ftpTimeout: 30000,
        networkCode: '12345',
        imaEnabled: true,
        videoPrerollDefaultSize: '640x480',
        placements: {
            preroll: '/12345/webradio/audio_adrules',
            midroll: '/12345/webradio/video_adrules',
            rewarded: '',
        },
    };

    const ads = buildAdsPayload(player, 'ios');
    assert.ok(ads, 'Should create ads payload');
    assert.strictEqual(ads.mode, 'vmap');
    assert.ok(ads.vmap_url, 'Should include VMAP URL template');
    assert.strictEqual(ads.placements.audio_rules.iu, '/12345/webradio/audio_adrules');
    assert.strictEqual(ads.placements.video_rules.iu, '/12345/webradio/video_adrules');
    assert.strictEqual(ads.route.audio, 'audio_rules');
    assert.strictEqual(ads.route.video, 'video_rules');
});

test('buildAdsPayload creates Android VAST configuration', async () => {
    const serverModule = await loadServerModule();
    const { buildAdsPayload } = serverModule;

    const player = {
        id: 'player1',
        name: 'Android Player',
        platform: 'android',
        platforms: ['android'],
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        ftpProtocol: 'ftp',
        ftpTimeout: 30000,
        networkCode: '12345',
        imaEnabled: true,
        videoPrerollDefaultSize: '640x480',
        placements: {
            preroll: '/12345/webradio/audio_preroll',
            midroll: '/12345/webradio/video_preroll',
            rewarded: '',
        },
    };

    const ads = buildAdsPayload(player, 'android');
    assert.ok(ads, 'Should create ads payload');
    assert.strictEqual(ads.mode, 'vast');
    assert.ok(ads.ad_tag_template, 'Should include VAST template');
    assert.strictEqual(ads.placements.audio_preroll.iu, '/12345/webradio/audio_preroll');
    assert.strictEqual(ads.placements.video_preroll.iu, '/12345/webradio/video_preroll');
    assert.strictEqual(ads.route.audio, 'audio_preroll');
    assert.strictEqual(ads.route.video, 'video_preroll');
});

test('buildAdsPayload returns null when IMA disabled', async () => {
    const serverModule = await loadServerModule();
    const { buildAdsPayload } = serverModule;

    const player = {
        id: 'player1',
        name: 'Player',
        platform: 'ios',
        platforms: ['ios'],
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        ftpProtocol: 'ftp',
        ftpTimeout: 30000,
        networkCode: '12345',
        imaEnabled: false, // Disabled
        videoPrerollDefaultSize: '640x480',
        placements: {
            preroll: '/12345/webradio/audio_adrules',
            midroll: '',
            rewarded: '',
        },
    };

    const ads = buildAdsPayload(player, 'ios');
    assert.strictEqual(ads, null, 'Should return null when IMA is disabled');
});

test('buildAdsPayload handles null player', async () => {
    const serverModule = await loadServerModule();
    const { buildAdsPayload } = serverModule;

    const ads = buildAdsPayload(null, 'ios');
    assert.strictEqual(ads, null, 'Should return null for null player');
});
