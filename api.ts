import { ExportProfile, Genre, PlayerApp, ProfileExportSummary, RadioStation } from './types';
import {
    getStations as getOfflineStations,
    saveStation as saveOfflineStation,
    deleteStation as deleteOfflineStation,
    getGenres as getOfflineGenres,
    saveGenre as saveOfflineGenre,
    deleteGenre as deleteOfflineGenre,
    getExportProfiles as getOfflineExportProfiles,
    saveExportProfile as saveOfflineExportProfile,
    deleteExportProfile as deleteOfflineExportProfile,
    getPlayerApps as getOfflinePlayerApps,
    savePlayerApp as saveOfflinePlayerApp,
    deletePlayerApp as deleteOfflinePlayerApp,
} from './localDataStore';
import { normalizeStationLogo, normalizeStationLogos } from './stationLogos';

type ApiStatusListener = (offline: boolean) => void;

const DEFAULT_API_BASE_URL = 'http://localhost:4000/api';

let offlineMode = false;
const offlineListeners = new Set<ApiStatusListener>();

function notifyOfflineListeners() {
    offlineListeners.forEach(listener => {
        try {
            listener(offlineMode);
        } catch (error) {
            console.error('API status listener failed', error);
        }
    });
}

function sanitizeBaseUrl(baseUrl: unknown): string | null {
    if (typeof baseUrl !== 'string') {
        return null;
    }
    const trimmed = baseUrl.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.replace(/\/+$/, '');
}

function readBaseUrlFromEnv(): string | null {
    let candidate: unknown;

    if (typeof import.meta !== 'undefined' && typeof import.meta.env === 'object') {
        candidate = (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL ?? candidate;
    }

    if (typeof process !== 'undefined' && typeof process.env === 'object') {
        candidate = process.env.VITE_API_BASE_URL ?? candidate;
    }

    const sanitized = sanitizeBaseUrl(candidate);
    if (sanitized) {
        return sanitized;
    }

    return sanitizeBaseUrl(DEFAULT_API_BASE_URL);
}

let apiBaseUrl: string | null = readBaseUrlFromEnv();

function getApiBaseUrl() {
    return apiBaseUrl;
}

export const configureApiBaseUrl = (baseUrl: string | null | undefined) => {
    apiBaseUrl = sanitizeBaseUrl(baseUrl ?? null);
    if (!apiBaseUrl) {
        setOfflineMode(false);
    }
};

function setOfflineMode(next: boolean) {
    if (offlineMode === next) {
        return;
    }
    offlineMode = next;
    notifyOfflineListeners();
}

function isNetworkError(error: unknown) {
    if (error instanceof TypeError) {
        return true;
    }
    if (error instanceof Error) {
        return /Failed to fetch|NetworkError|Load failed/i.test(error.message);
    }
    return false;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) {
        throw new Error('Remote API is not configured.');
    }

    const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(options.headers as Record<string, string> | undefined),
    };

    if (options.body && !('Content-Type' in headers)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
    });

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
        const message = payload?.error || payload?.message || `Request failed with status ${response.status}`;
        throw new Error(message);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return payload as T;
}

async function withFallback<T>(remoteCall: () => Promise<T>, localCall: () => T | Promise<T>): Promise<T> {
    if (!getApiBaseUrl()) {
        return await Promise.resolve(localCall());
    }

    try {
        const result = await remoteCall();
        if (offlineMode) {
            setOfflineMode(false);
        }
        return result;
    } catch (error) {
        if (!isNetworkError(error)) {
            throw error;
        }
        console.warn('API unreachable, switching to offline mode.', error);
        setOfflineMode(true);
        return await Promise.resolve(localCall());
    }
}

export const onApiStatusChange = (listener: ApiStatusListener) => {
    offlineListeners.add(listener);
    return () => {
        offlineListeners.delete(listener);
    };
};

export const isApiOffline = () => offlineMode;

export const resetApiStatus = () => {
    setOfflineMode(false);
};

export const fetchStations = () =>
    withFallback(
        () => request<RadioStation[]>('/stations').then(normalizeStationLogos),
        () => normalizeStationLogos(getOfflineStations()),
    );

export const createStation = (station: RadioStation) => withFallback(
    () =>
        request<RadioStation>('/stations', {
            method: 'POST',
            body: JSON.stringify(station),
        }).then(normalizeStationLogo),
    () => normalizeStationLogo(saveOfflineStation(station)),
);

export const updateStation = (station: RadioStation) => withFallback(
    () =>
        request<RadioStation>(`/stations/${station.id}`, {
            method: 'PUT',
            body: JSON.stringify(station),
        }).then(normalizeStationLogo),
    () => normalizeStationLogo(saveOfflineStation(station)),
);

export const removeStation = (stationId: string) => withFallback(
    () => request<void>(`/stations/${stationId}`, {
        method: 'DELETE',
    }),
    () => deleteOfflineStation(stationId),
);

export const fetchGenres = () => withFallback(
    () => request<Genre[]>('/genres'),
    () => getOfflineGenres(),
);

export const createGenre = (genre: Genre) => withFallback(
    () => request<Genre>('/genres', {
        method: 'POST',
        body: JSON.stringify(genre),
    }),
    () => saveOfflineGenre(genre),
);

export const updateGenre = (genre: Genre) => withFallback(
    () => request<Genre>(`/genres/${genre.id}`, {
        method: 'PUT',
        body: JSON.stringify(genre),
    }),
    () => saveOfflineGenre(genre),
);

export const removeGenre = (genreId: string) => withFallback(
    () => request<void>(`/genres/${genreId}`, {
        method: 'DELETE',
    }),
    () => deleteOfflineGenre(genreId),
);

export const fetchExportProfiles = () => withFallback(
    () => request<ExportProfile[]>('/export-profiles'),
    () => getOfflineExportProfiles(),
);

export const createExportProfile = (profile: ExportProfile) => withFallback(
    () => request<ExportProfile>('/export-profiles', {
        method: 'POST',
        body: JSON.stringify(profile),
    }),
    () => saveOfflineExportProfile(profile),
);

export const updateExportProfile = (profile: ExportProfile) => withFallback(
    () => request<ExportProfile>(`/export-profiles/${profile.id}`, {
        method: 'PUT',
        body: JSON.stringify(profile),
    }),
    () => saveOfflineExportProfile(profile),
);

export const removeExportProfile = (profileId: string) => withFallback(
    () => request<void>(`/export-profiles/${profileId}`, {
        method: 'DELETE',
    }),
    () => deleteOfflineExportProfile(profileId),
);

export const runProfileExport = (profileId: string) =>
    withFallback(
        () => request<ProfileExportSummary>(`/export-profiles/${profileId}/export`, { method: 'POST' }),
        () => {
            throw new Error('Exporting profiles requires a connected API server.');
        },
    );

export const fetchPlayerApps = () => withFallback(
    () => request<PlayerApp[]>('/player-apps'),
    () => getOfflinePlayerApps(),
);

export const createPlayerApp = (app: PlayerApp) => withFallback(
    () => request<PlayerApp>('/player-apps', {
        method: 'POST',
        body: JSON.stringify(app),
    }),
    () => saveOfflinePlayerApp(app),
);

export const updatePlayerApp = (app: PlayerApp) => withFallback(
    () => request<PlayerApp>(`/player-apps/${app.id}`, {
        method: 'PUT',
        body: JSON.stringify(app),
    }),
    () => saveOfflinePlayerApp(app),
);

export const removePlayerApp = (appId: string) => withFallback(
    () => request<void>(`/player-apps/${appId}`, {
        method: 'DELETE',
    }),
    () => deleteOfflinePlayerApp(appId),
);
