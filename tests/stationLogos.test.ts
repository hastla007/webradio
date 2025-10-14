import assert from 'node:assert/strict';
import { test } from './harness';
import {
    getStationLogoUrl,
    isPlaceholderLogo,
    normalizeStationLogo,
    PLACEHOLDER_LOGO_URL,
    resolveStationLogoUrl,
} from '../stationLogos';
import type { RadioStation } from '../types';

test('getStationLogoUrl replaces empty or legacy URLs with the placeholder', () => {
    assert.strictEqual(getStationLogoUrl(''), PLACEHOLDER_LOGO_URL);
    assert.strictEqual(
        getStationLogoUrl(' https://raw.githubusercontent.com/hastla007/webradioadminpanel/refs/heads/main/webradio_logo.png '),
        PLACEHOLDER_LOGO_URL,
    );
    assert.strictEqual(getStationLogoUrl('https://cdn.example/logo.png'), 'https://cdn.example/logo.png');
});

test('isPlaceholderLogo detects placeholder assets and blank values', () => {
    assert.strictEqual(isPlaceholderLogo(null), true);
    assert.strictEqual(isPlaceholderLogo('/static/webradio_placeholder.png'), true);
    assert.strictEqual(isPlaceholderLogo('https://picsum.photos/200'), true);
    assert.strictEqual(isPlaceholderLogo('https://cdn.example/logo.png'), false);
});

test('resolveStationLogoUrl respects user-provided artwork and reports replacements', () => {
    const resultWithCustom = resolveStationLogoUrl('station-1', 'Custom Station', 'https://cdn.example/logo.png');
    assert.deepStrictEqual(resultWithCustom, { logoUrl: 'https://cdn.example/logo.png', replaced: false });

    const legacy = resolveStationLogoUrl(
        'station-1',
        'Custom Station',
        'https://github.com/hastla007/webradioadminpanel/blob/main/webradio_logo.png?raw=true',
    );
    assert.deepStrictEqual(legacy, { logoUrl: '', replaced: false });
});

test('normalizeStationLogo strips legacy artwork URLs from stations', () => {
    const station: RadioStation = {
        id: 'logo-test',
        name: 'Logo Test',
        streamUrl: 'https://example.com/stream',
        description: '',
        genreId: '',
        subGenres: [],
        logoUrl: 'https://raw.githubusercontent.com/hastla007/webradioadminpanel/refs/heads/main/webradio_logo.png',
        bitrate: 128,
        language: 'en',
        region: 'Global',
        tags: [],
        imaAdType: 'audio',
        isActive: true,
        isFavorite: false,
    };

    const normalized = normalizeStationLogo(station);
    assert.strictEqual(normalized.logoUrl, '');
});
