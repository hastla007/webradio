import {
    ExportProfile,
    Genre,
    LogCategory,
    LogEntry,
    PlayerApp,
    ProfileExportSummary,
    RadioStation,
    StreamHealthResult,
} from './types';
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

function getDefaultApiBaseUrl(): string {
    if (typeof window !== 'undefined') {
        return '/api';
    }
    return 'http://localhost:4000/api';
}

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
    if (trimmed === '/') {
        return '/';
    }

    const withoutTrailing = trimmed.replace(/\/+$/, '');
    if (/^https?:\/\//i.test(withoutTrailing) || withoutTrailing.startsWith('/')) {
        return withoutTrailing;
    }

    return `/${withoutTrailing}`;
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

    return sanitizeBaseUrl(getDefaultApiBaseUrl());
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

    // Add authentication header if access token exists
    const accessToken = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    if (options.body && !('Content-Type' in headers)) {
        headers['Content-Type'] = 'application/json';
    }

    const targetUrl = baseUrl === '/' ? path : `${baseUrl}${path}`;

    const response = await fetch(targetUrl, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for refresh tokens
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

export interface TestFtpCredentialsPayload {
    ftpServer: string;
    ftpUsername: string;
    ftpPassword: string;
    ftpProtocol: 'ftp' | 'ftps' | 'sftp';
    ftpTimeout: number;
}

export const testFtpCredentials = (payload: TestFtpCredentialsPayload) =>
    request<{ success: boolean }>('/player-apps/test-ftp', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

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

interface StreamHealthRequest {
    stationId: string;
    streamUrl: string;
}

const simulateStreamHealth = (streams: StreamHealthRequest[]): StreamHealthResult[] => {
    return streams.map(stream => {
        const isOnline = Math.random() > 0.15;
        return {
            stationId: stream.stationId,
            isOnline,
            statusCode: isOnline ? 200 : 503,
            contentType: isOnline ? 'audio/mpeg' : null,
            responseTime: Math.floor(150 + Math.random() * 600),
            error: isOnline ? undefined : 'Stream unavailable in offline mode.',
        } satisfies StreamHealthResult;
    });
};

export const checkStreamsHealth = (streams: StreamHealthRequest[], timeoutMs = 5000) =>
    withFallback(
        () =>
            request<StreamHealthResult[]>('/monitor/check', {
                method: 'POST',
                body: JSON.stringify({ streams, timeoutMs }),
            }),
        () => simulateStreamHealth(streams),
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

interface LogListResponse {
    entries: LogEntry[];
    cursor: number | null;
}

export interface LogQueryOptions {
    categories?: LogCategory[];
    limit?: number;
    cursor?: number | null;
}

function buildLogQuery(options: LogQueryOptions = {}) {
    const params = new URLSearchParams();
    if (options.categories && options.categories.length > 0) {
        params.set('type', options.categories.join(','));
    }
    if (typeof options.limit === 'number' && Number.isFinite(options.limit)) {
        params.set('limit', String(options.limit));
    }
    if (typeof options.cursor === 'number' && Number.isFinite(options.cursor)) {
        params.set('cursor', String(options.cursor));
    }
    const query = params.toString();
    return query ? `?${query}` : '';
}

export const fetchLogs = (options: LogQueryOptions = {}) =>
    withFallback(
        () => request<LogListResponse>(`/logs${buildLogQuery(options)}`),
        () => ({ entries: [], cursor: options.cursor ?? null })
    );

export interface LogStreamOptions {
    categories?: LogCategory[];
    cursor?: number | null;
    limit?: number;
}

export interface LogStreamHandlers {
    onEntry?: (entry: LogEntry) => void;
    onError?: (event: Event) => void;
}

export interface LogStreamHandle {
    close: () => void;
}

export const subscribeToLogStream = (
    options: LogStreamOptions = {},
    handlers: LogStreamHandlers = {}
): LogStreamHandle => {
    const baseUrl = getApiBaseUrl();
    const globalWindow: typeof window | undefined = typeof window !== 'undefined' ? window : undefined;
    if (!baseUrl || !globalWindow || typeof globalWindow.EventSource === 'undefined') {
        return { close: () => {} };
    }

    const params = new URLSearchParams();
    if (options.categories && options.categories.length > 0) {
        params.set('type', options.categories.join(','));
    }
    if (typeof options.cursor === 'number' && Number.isFinite(options.cursor)) {
        params.set('cursor', String(options.cursor));
    }
    if (typeof options.limit === 'number' && Number.isFinite(options.limit)) {
        params.set('limit', String(options.limit));
    }

    const url = `${baseUrl}/logs/stream${params.toString() ? `?${params.toString()}` : ''}`;
    const eventSource = new globalWindow.EventSource(url);

    eventSource.addEventListener('log', event => {
        try {
            const parsed = JSON.parse((event as MessageEvent).data) as LogEntry;
            handlers.onEntry?.(parsed);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to parse log stream event', error);
        }
    });

    if (handlers.onError) {
        eventSource.onerror = handlers.onError;
    }

    return {
        close: () => {
            eventSource.close();
        },
    };
};
