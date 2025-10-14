import assert from 'node:assert/strict';
import { test } from './harness';
import {
    configureApiBaseUrl,
    createStation,
    fetchStations,
    isApiOffline,
    resetApiStatus,
    runProfileExport,
} from '../api';
import { getStations as getOfflineStations, resetToDefault } from '../localDataStore';
import type { RadioStation } from '../types';

function createRemoteStations(): RadioStation[] {
    return [
        {
            id: 'remote-1',
            name: 'Remote Station',
            streamUrl: 'https://remote.example/stream',
            description: 'Remote station data.',
            genreId: 'house',
            logoUrl: 'https://remote.example/logo.png',
            bitrate: 256,
            language: 'en',
            region: 'Global',
            tags: ['house'],
            imaAdType: 'audio',
            isActive: true,
            isFavorite: false,
        },
    ];
}

test('fetchStations returns remote data when the API responds successfully', async () => {
    resetToDefault();
    resetApiStatus();
    configureApiBaseUrl('https://api.example.com');

    const remoteStations = createRemoteStations();
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
        new Response(JSON.stringify(remoteStations), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    try {
        const result = await fetchStations();
        assert.deepStrictEqual(result, remoteStations);
        assert.strictEqual(isApiOffline(), false);
    } finally {
        globalThis.fetch = originalFetch;
        configureApiBaseUrl(null);
    }
});

test('fetchStations falls back to offline data and marks the API as offline on network errors', async () => {
    resetToDefault();
    resetApiStatus();
    configureApiBaseUrl('https://api.example.com');

    const originalFetch = globalThis.fetch;
    const originalWarn = console.warn;
    const offlineStations = getOfflineStations();

    let attempts = 0;
    globalThis.fetch = async () => {
        attempts += 1;
        throw new TypeError('Failed to fetch');
    };
    console.warn = () => {};

    try {
        const result = await fetchStations();
        assert.deepStrictEqual(result, offlineStations);
        assert.strictEqual(attempts, 1);
        assert.strictEqual(isApiOffline(), true);

        resetApiStatus();
        assert.strictEqual(isApiOffline(), false);
    } finally {
        globalThis.fetch = originalFetch;
        console.warn = originalWarn;
        configureApiBaseUrl(null);
    }
});

test('fetchStations propagates non-network API errors without using the offline cache', async () => {
    resetToDefault();
    resetApiStatus();
    configureApiBaseUrl('https://api.example.com');

    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: 'Station fetch failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });

    try {
        await assert.rejects(fetchStations(), /Station fetch failed/);
        assert.strictEqual(isApiOffline(), false);
    } finally {
        globalThis.fetch = originalFetch;
        configureApiBaseUrl(null);
    }
});

test('fetchStations uses offline data silently when no remote API is configured', async () => {
    resetToDefault();
    configureApiBaseUrl(null);
    resetApiStatus();

    const result = await fetchStations();
    assert.deepStrictEqual(result, getOfflineStations());
    assert.strictEqual(isApiOffline(), false);
});

test('runProfileExport posts to the remote API and returns the export summary', async () => {
    resetApiStatus();
    configureApiBaseUrl('https://api.example.com');

    const summaryResponse = {
        profileId: 'ep-123',
        profileName: 'Night Mix',
        stationCount: 12,
        outputDirectory: '/data/app-json-export',
        files: [
            {
                platform: 'ios',
                fileName: 'night-mix-ios.json',
                outputPath: '/data/app-json-export/night-mix-ios.json',
                stationCount: 12,
                ftpUploaded: true,
            },
            {
                platform: 'android',
                fileName: 'night-mix-android.json',
                outputPath: '/data/app-json-export/night-mix-android.json',
                stationCount: 12,
                ftpUploaded: true,
            },
        ],
    };

    const originalFetch = globalThis.fetch;
    let capturedRequest;

    globalThis.fetch = async (input, init) => {
        capturedRequest = { input, init };
        return new Response(JSON.stringify(summaryResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    try {
        const result = await runProfileExport('ep-123');
        assert.deepStrictEqual(result, summaryResponse);
        assert.strictEqual(isApiOffline(), false);
        assert.ok(capturedRequest);
        assert.strictEqual(capturedRequest.input, 'https://api.example.com/export-profiles/ep-123/export');
        assert.strictEqual(capturedRequest.init?.method, 'POST');
    } finally {
        globalThis.fetch = originalFetch;
        configureApiBaseUrl(null);
    }
});

test('createStation posts to the remote API when online', async () => {
    resetToDefault();
    resetApiStatus();
    configureApiBaseUrl('https://api.example.com');

    const station: RadioStation = {
        id: 'remote-created',
        name: 'Remote Created Station',
        streamUrl: 'https://example.com/remote',
        description: 'Remote created',
        genreId: 'house',
        subGenres: ['Deep House'],
        logoUrl: 'https://cdn.example/logo.png',
        bitrate: 128,
        language: 'en',
        region: 'Global',
        tags: [],
        imaAdType: 'audio',
        isActive: true,
        isFavorite: false,
    };

    const responsePayload = { ...station };

    const originalFetch = globalThis.fetch;
    let capturedRequest: { input: RequestInfo | URL; init: RequestInit | undefined } | undefined;

    globalThis.fetch = async (input, init) => {
        capturedRequest = { input, init };
        return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };

    try {
        const created = await createStation(station);
        assert.deepStrictEqual(created, responsePayload);
        assert.ok(capturedRequest);
        assert.strictEqual(capturedRequest?.input, 'https://api.example.com/stations');
        assert.strictEqual(capturedRequest?.init?.method, 'POST');
        const body = capturedRequest?.init?.body;
        assert.ok(typeof body === 'string');
        assert.strictEqual(JSON.parse(body as string).name, 'Remote Created Station');
        assert.strictEqual(isApiOffline(), false);
    } finally {
        globalThis.fetch = originalFetch;
        configureApiBaseUrl(null);
    }
});

test('createStation falls back to the offline store when the API is unreachable', async () => {
    resetToDefault();
    resetApiStatus();
    configureApiBaseUrl('https://api.example.com');

    const station: RadioStation = {
        id: 'offline-station',
        name: 'Offline Station',
        streamUrl: 'https://example.com/offline',
        description: 'Offline data',
        genreId: 'house',
        subGenres: ['Deep House'],
        logoUrl: 'https://github.com/hastla007/webradioadminpanel/blob/main/webradio_logo.png?raw=true',
        bitrate: 192,
        language: 'en',
        region: 'Global',
        tags: ['offline'],
        imaAdType: 'audio',
        isActive: true,
        isFavorite: false,
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch');
    };

    try {
        const created = await createStation(station);
        assert.strictEqual(created.id, 'offline-station');
        assert.strictEqual(created.logoUrl, '');
        assert.strictEqual(isApiOffline(), true);
        const offlineStations = getOfflineStations();
        const stored = offlineStations.find(entry => entry.id === 'offline-station');
        assert.ok(stored);
        assert.deepStrictEqual(stored?.subGenres, ['Deep House']);
    } finally {
        globalThis.fetch = originalFetch;
        configureApiBaseUrl(null);
        resetApiStatus();
    }
});

test('runProfileExport throws when offline exports are attempted without a server', async () => {
    resetApiStatus();
    configureApiBaseUrl(null);

    await assert.rejects(runProfileExport('ep-1'), /requires a connected API server/);
    assert.strictEqual(isApiOffline(), false);
});
