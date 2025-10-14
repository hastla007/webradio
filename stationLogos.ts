import stationLogos from './data/stationLogos.json';
import type { RadioStation } from './types';

export const PLACEHOLDER_LOGO_URL = '/static/webradio_placeholder.png';

type StationLogoEntry = {
    id: string;
    name: string;
    logo: string;
};

const LOGO_ENTRIES: StationLogoEntry[] = (stationLogos as StationLogoEntry[]).filter(
    entry => Boolean(entry?.logo && entry?.name)
);

const LEGACY_LOGO_PATTERNS = [
    /https?:\/\/raw\.githubusercontent\.com\/hastla007\/webradioadminpanel\/refs\/heads\/main\/webradio_logo\.png/i,
    /https?:\/\/github\.com\/hastla007\/webradioadminpanel\/blob\/main\/webradio_logo\.png(?:\?raw=true)?/i,
];

const LOGOS_BY_ID = new Map<string, string>();
const LOGOS_BY_NAME = new Map<string, string>();

for (const entry of LOGO_ENTRIES) {
    const id = String(entry.id ?? '').trim();
    const name = String(entry.name ?? '').trim().toLowerCase();
    const logo = sanitizeLogoValue(entry.logo);
    if (!logo) {
        continue;
    }
    if (id) {
        LOGOS_BY_ID.set(id, logo);
    }
    if (name) {
        LOGOS_BY_NAME.set(name, logo);
    }
}

const PLACEHOLDER_LOGO_PATTERNS = [
    /picsum\.photos/i,
    /images\.unsplash\.com/i,
    /placehold/i,
    /placeholder/i,
    /dummyimage\.com/i,
    /^\/static\/webradio_placeholder\.png$/i,
];

function sanitizeLogoValue(url: unknown): string {
    if (typeof url !== 'string') {
        return '';
    }
    const trimmed = url.trim();
    if (!trimmed) {
        return '';
    }
    if (LEGACY_LOGO_PATTERNS.some(pattern => pattern.test(trimmed))) {
        return '';
    }
    return trimmed;
}

export function isPlaceholderLogo(url: string | null | undefined): boolean {
    const normalized = sanitizeLogoValue(url);
    if (!normalized) {
        return true;
    }
    return PLACEHOLDER_LOGO_PATTERNS.some(pattern => pattern.test(normalized));
}

export function lookupStationLogoById(id: unknown): string | undefined {
    if (id === null || id === undefined) {
        return undefined;
    }
    return LOGOS_BY_ID.get(String(id).trim());
}

export function lookupStationLogoByName(name: unknown): string | undefined {
    if (typeof name !== 'string') {
        return undefined;
    }
    const normalized = name.trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    return LOGOS_BY_NAME.get(normalized);
}

export function getStationLogoUrl(logoUrl: string | null | undefined): string {
    const sanitized = sanitizeLogoValue(logoUrl);
    return sanitized || PLACEHOLDER_LOGO_URL;
}

export function resolveStationLogoUrl(
    id: unknown,
    name: unknown,
    currentLogo: string | null | undefined
): { logoUrl: string; replaced: boolean } {
    const trimmed = sanitizeLogoValue(currentLogo);

    if (trimmed && !isPlaceholderLogo(trimmed)) {
        return { logoUrl: trimmed, replaced: false };
    }

    const byId = lookupStationLogoById(id);
    const byName = lookupStationLogoByName(name);
    const fallback = sanitizeLogoValue(byId || byName);
    const resolved = fallback || '';
    const replaced = resolved !== trimmed;

    return { logoUrl: resolved, replaced };
}

export function normalizeStationLogo(station: RadioStation): RadioStation {
    const { logoUrl: resolvedLogo } = resolveStationLogoUrl(station.id, station.name, station.logoUrl);
    if (resolvedLogo === station.logoUrl) {
        return station;
    }
    return { ...station, logoUrl: resolvedLogo };
}

export function normalizeStationLogos(stations: RadioStation[]): RadioStation[] {
    return stations.map(station => normalizeStationLogo(station));
}

export function suggestLogoForStation(name: string | null | undefined): string | undefined {
    return lookupStationLogoByName(name);
}
