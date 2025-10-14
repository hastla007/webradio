import assert from 'node:assert/strict';
import { test } from './harness';
import {
    deleteGenre,
    exportProfile,
    getAllData,
    getExportProfiles,
    getStations,
    resetToDefault,
    saveExportProfile,
    saveGenre,
    savePlayerApp,
    saveStation,
} from '../localDataStore';
import { PLACEHOLDER_LOGO_URL } from '../stationLogos';
import type { ExportProfile, PlayerApp, RadioStation } from '../types';

test('saveStation normalises legacy logos and filters sub-genres', () => {
    resetToDefault();

    const genre = saveGenre({ id: 'deep-house', name: 'Deep House', subGenres: ['Late Night', 'After Hours'] });
    assert.deepStrictEqual(genre.subGenres, ['Late Night', 'After Hours']);

    const station: RadioStation = {
        id: 'legacy-station',
        name: 'Legacy Station',
        streamUrl: 'https://example.com/stream',
        description: 'Test',
        genreId: 'deep-house',
        subGenres: ['late night', 'Unknown', 'after hours'],
        logoUrl: 'https://raw.githubusercontent.com/hastla007/webradioadminpanel/refs/heads/main/webradio_logo.png',
        bitrate: 192,
        language: 'en',
        region: 'Global',
        tags: [],
        imaAdType: 'audio',
        isActive: true,
        isFavorite: false,
    };

    const saved = saveStation(station);
    assert.strictEqual(saved.logoUrl, '');
    assert.deepStrictEqual(saved.subGenres, ['Late Night', 'After Hours']);

    const stored = getStations().find(entry => entry.id === 'legacy-station');
    assert.ok(stored);
    assert.deepStrictEqual(stored?.subGenres, ['Late Night', 'After Hours']);
});

test('deleteGenre clears station assignments and export profile references', () => {
    resetToDefault();

    saveGenre({ id: 'temp-genre', name: 'Temporary', subGenres: ['Club'] });

    const station: RadioStation = {
        id: 'temp-station',
        name: 'Temp Station',
        streamUrl: 'https://example.com/temp',
        description: '',
        genreId: 'temp-genre',
        subGenres: ['Club'],
        logoUrl: '',
        bitrate: 128,
        language: 'en',
        region: 'Global',
        tags: [],
        imaAdType: 'audio',
        isActive: true,
        isFavorite: false,
    };

    saveStation(station);

    const profile: ExportProfile = {
        id: 'profile-temp',
        name: 'Temp Profile',
        genreIds: ['temp-genre'],
        stationIds: ['temp-station'],
        subGenres: ['Club'],
        playerId: null,
        autoExport: { enabled: false, interval: 'daily', time: '09:00' },
    };

    saveExportProfile(profile);

    deleteGenre('temp-genre');

    const data = getAllData();
    const storedStation = data.stations.find(entry => entry.id === 'temp-station');
    assert.ok(storedStation);
    assert.strictEqual(storedStation?.genreId, '');
    assert.deepStrictEqual(storedStation?.subGenres, []);

    const storedProfile = data.exportProfiles.find(entry => entry.id === 'profile-temp');
    assert.ok(storedProfile);
    assert.deepStrictEqual(storedProfile?.genreIds, []);
    assert.deepStrictEqual(storedProfile?.subGenres, []);
});

test('exportProfile assembles stations by genre, explicit selection, and sub-genres', () => {
    resetToDefault();

    saveGenre({ id: 'export-genre', name: 'Export Genre', subGenres: ['Morning', 'Evening'] });

    const baseStation: Omit<RadioStation, 'id' | 'name'> = {
        streamUrl: 'https://example.com/stream',
        description: '',
        genreId: 'export-genre',
        subGenres: ['Morning'],
        logoUrl: '',
        bitrate: 128,
        language: 'en',
        region: 'Global',
        tags: ['export'],
        imaAdType: 'audio',
        isActive: true,
        isFavorite: false,
    };

    saveStation({ ...baseStation, id: 'station-a', name: 'A Station' });
    saveStation({ ...baseStation, id: 'station-b', name: 'B Station', subGenres: ['Evening'], isActive: false });
    saveStation({ ...baseStation, id: 'station-c', name: 'C Station', subGenres: ['Morning'], isActive: false });

    const profile: ExportProfile = {
        id: 'export-profile',
        name: 'Export Profile',
        genreIds: ['export-genre'],
        stationIds: ['station-b'],
        subGenres: ['Morning'],
        playerId: null,
        autoExport: { enabled: false, interval: 'daily', time: '09:00' },
    };

    saveExportProfile(profile);

    const payload = exportProfile('export-profile');
    const stationNames = payload.stations.map(station => station.name);

    assert.deepStrictEqual(stationNames, ['A Station', 'B Station']);
    const stationB = payload.stations.find(station => station.id === 'station-b');
    assert.ok(stationB);
    assert.strictEqual(stationB?.logo, PLACEHOLDER_LOGO_URL);
    assert.deepStrictEqual(stationB?.subGenres, ['Evening']);
});

test('assigning the same player app to two profiles clears the older link', () => {
    resetToDefault();

    const app: PlayerApp = {
        id: 'player-one',
        name: 'Player One',
        platforms: ['ios'],
        platform: 'ios',
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        networkCode: '',
        imaEnabled: true,
        videoPrerollDefaultSize: '640x480',
        placements: { preroll: '', midroll: '', rewarded: '' },
    };

    savePlayerApp(app);

    const profileA: ExportProfile = {
        id: 'profile-a',
        name: 'Profile A',
        genreIds: [],
        stationIds: [],
        subGenres: [],
        playerId: 'player-one',
        autoExport: { enabled: false, interval: 'daily', time: '09:00' },
    };
    const profileB: ExportProfile = {
        id: 'profile-b',
        name: 'Profile B',
        genreIds: [],
        stationIds: [],
        subGenres: [],
        playerId: null,
        autoExport: { enabled: false, interval: 'daily', time: '09:00' },
    };

    saveExportProfile(profileA);
    saveExportProfile(profileB);

    saveExportProfile({ ...profileB, playerId: 'player-one' });

    const profiles = getExportProfiles();
    const storedA = profiles.find(entry => entry.id === 'profile-a');
    const storedB = profiles.find(entry => entry.id === 'profile-b');

    assert.strictEqual(storedA?.playerId, null);
    assert.strictEqual(storedB?.playerId, 'player-one');
});

test('exportProfile builds android ad payload with preroll placements', () => {
    resetToDefault();

    const androidApp: PlayerApp = {
        id: 'player-android',
        name: 'Android Player',
        platforms: ['Android'],
        platform: 'Android',
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        networkCode: '1234567',
        imaEnabled: true,
        videoPrerollDefaultSize: '1280x720',
        placements: {
            preroll: ' /1234567/radio/audio_adrules ',
            midroll: '/1234567/radio/video_adrules',
            rewarded: '',
        },
    };

    savePlayerApp(androidApp);

    const profile: ExportProfile = {
        id: 'android-export',
        name: 'Android Export',
        genreIds: [],
        stationIds: [],
        subGenres: [],
        playerId: androidApp.id,
        autoExport: { enabled: false, interval: 'daily', time: '09:00' },
    };

    saveExportProfile(profile);

    const payload = exportProfile(profile.id);

    assert.strictEqual(payload.app?.platform, 'android');
    const ads = payload.ads as Record<string, any>;
    assert.ok(ads);
    assert.strictEqual(ads.mode, 'vast');
    assert.strictEqual(ads.network_code, '1234567');
    assert.strictEqual(
        ads.ad_tag_template,
        'https://pubads.g.doubleclick.net/gampad/ads?iu={iu}&env=vp&gdfp_req=1&unviewed_position_start=1&output=vast&sz={size}&description_url={encoded_page_url}&cust_params={encoded_cust_params}&npa={npa}&tfcd={tfcd}&us_privacy={us_privacy}'
    );
    assert.deepStrictEqual(ads.placements, {
        audio_preroll: {
            iu: '/1234567/webradio/audio_preroll',
            default_size: '1x1',
            enabled: true,
        },
        video_preroll: {
            iu: '/1234567/webradio/video_preroll',
            default_size: '1280x720',
            enabled: true,
        },
    });
    assert.deepStrictEqual(ads.route, {
        audio: 'audio_preroll',
        video: 'video_preroll',
        no: null,
    });
});

test('android export coerces generic preroll inventory to typed preroll placements', () => {
    resetToDefault();

    const androidApp: PlayerApp = {
        id: 'player-android-generic',
        name: 'Android Generic',
        platforms: ['Android'],
        platform: 'Android',
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        networkCode: '1234567',
        imaEnabled: true,
        videoPrerollDefaultSize: '640x480',
        placements: {
            preroll: '/1234567/radio/preroll',
            midroll: '/1234567/radio/midroll',
            rewarded: '',
        },
    };

    savePlayerApp(androidApp);

    const profile: ExportProfile = {
        id: 'android-export-generic',
        name: 'Android Export Generic',
        genreIds: [],
        stationIds: [],
        subGenres: [],
        playerId: androidApp.id,
        autoExport: { enabled: false, interval: 'daily', time: '09:00' },
    };

    saveExportProfile(profile);

    const payload = exportProfile(profile.id);
    const ads = payload.ads as Record<string, any>;
    assert.ok(ads);
    assert.deepStrictEqual(ads.placements, {
        audio_preroll: {
            iu: '/1234567/webradio/audio_preroll',
            default_size: '1x1',
            enabled: true,
        },
        video_preroll: {
            iu: '/1234567/webradio/video_preroll',
            default_size: '640x480',
            enabled: true,
        },
    });
});

test('android export falls back to default network code and preroll placements when missing', () => {
    resetToDefault();

    const androidApp: PlayerApp = {
        id: 'player-android-fallback',
        name: 'Android Fallback',
        platforms: ['Android'],
        platform: 'Android',
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        networkCode: '',
        imaEnabled: true,
        videoPrerollDefaultSize: '640x480',
        placements: {
            preroll: '',
            midroll: '',
            rewarded: '',
        },
    };

    savePlayerApp(androidApp);

    const profile: ExportProfile = {
        id: 'android-export-fallback',
        name: 'Android Export Fallback',
        genreIds: [],
        stationIds: [],
        subGenres: [],
        playerId: androidApp.id,
        autoExport: { enabled: false, interval: 'daily', time: '09:00' },
    };

    saveExportProfile(profile);

    const payload = exportProfile(profile.id);
    const ads = payload.ads as Record<string, any>;

    assert.ok(ads);
    assert.strictEqual(ads.network_code, '1234567');
    assert.deepStrictEqual(ads.placements, {
        audio_preroll: {
            iu: '/1234567/webradio/audio_preroll',
            default_size: '1x1',
            enabled: true,
        },
        video_preroll: {
            iu: '/1234567/webradio/video_preroll',
            default_size: '640x480',
            enabled: true,
        },
    });
});

test('android export honours explicit primary platform even when platforms list is mixed', () => {
    resetToDefault();

    const androidApp: PlayerApp = {
        id: 'player-android-mixed-platforms',
        name: 'Android Mixed Platforms',
        platforms: ['iOS', 'Android'],
        platform: 'Android',
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        networkCode: '1234567',
        imaEnabled: true,
        videoPrerollDefaultSize: '640x480',
        placements: {
            preroll: '/1234567/radio/preroll',
            midroll: '/1234567/radio/midroll',
            rewarded: '',
        },
    };

    savePlayerApp(androidApp);

    const profile: ExportProfile = {
        id: 'android-export-mixed-platforms',
        name: 'Android Export Mixed Platforms',
        genreIds: [],
        stationIds: [],
        subGenres: [],
        playerId: androidApp.id,
        autoExport: { enabled: false, interval: 'daily', time: '09:00' },
    };

    saveExportProfile(profile);

    const payload = exportProfile(profile.id);
    assert.strictEqual(payload.app?.platform, 'android');
    const ads = payload.ads as Record<string, any>;
    assert.ok(ads);
    assert.strictEqual(ads.mode, 'vast');
    assert.strictEqual(ads.network_code, '1234567');
    assert.deepStrictEqual(ads.placements, {
        audio_preroll: {
            iu: '/1234567/webradio/audio_preroll',
            default_size: '1x1',
            enabled: true,
        },
        video_preroll: {
            iu: '/1234567/webradio/video_preroll',
            default_size: '640x480',
            enabled: true,
        },
    });
    assert.deepStrictEqual(ads.route, {
        audio: 'audio_preroll',
        video: 'video_preroll',
        no: null,
    });
});

test('exportProfile builds ios ad payload with ad-rules placements', () => {
    resetToDefault();

    const iosApp: PlayerApp = {
        id: 'player-ios',
        name: 'iOS Player',
        platforms: ['iOS'],
        platform: 'iOS',
        description: '',
        contactEmail: '',
        notes: '',
        ftpEnabled: false,
        ftpServer: '',
        ftpUsername: '',
        ftpPassword: '',
        networkCode: '1234567',
        imaEnabled: true,
        videoPrerollDefaultSize: '640x480',
        placements: {
            preroll: ' /1234567/radio/audio_preroll ',
            midroll: '/1234567/radio/video_midroll',
            rewarded: '',
        },
    };

    savePlayerApp(iosApp);

    const profile: ExportProfile = {
        id: 'ios-export',
        name: 'iOS Export',
        genreIds: [],
        stationIds: [],
        subGenres: [],
        playerId: iosApp.id,
        autoExport: { enabled: false, interval: 'daily', time: '09:00' },
    };

    saveExportProfile(profile);

    const payload = exportProfile(profile.id);

    assert.strictEqual(payload.app?.platform, 'ios');
    const ads = payload.ads as Record<string, any>;
    assert.ok(ads);
    assert.strictEqual(ads.mode, 'vmap');
    assert.strictEqual(
        ads.vmap_url,
        'https://pubads.g.doubleclick.net/gampad/ads?iu={iu}&env=vp&gdfp_req=1&output=vmap&ad_rule=1&description_url={encoded_page_url}&cust_params={encoded_cust_params}&npa={npa}&tfcd={tfcd}&us_privacy={us_privacy}'
    );
    assert.deepStrictEqual(ads.placements, {
        audio_rules: {
            iu: '/1234567/webradio/audio_adrules',
            enabled: true,
        },
        video_rules: {
            iu: '/1234567/webradio/video_adrules',
            enabled: true,
        },
    });
    assert.deepStrictEqual(ads.route, {
        audio: 'audio_rules',
        video: 'video_rules',
        no: null,
    });
});
