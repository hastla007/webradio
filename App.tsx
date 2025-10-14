import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StationManager from './components/StationManager';
import GenreManager from './components/GenreManager';
import ExportManager from './components/ExportManager';
import PlayerManager from './components/PlayerManager';
import StreamMonitor from './components/StreamMonitor';
import LogViewer from './components/LogViewer';
import ListenPage from './components/ListenPage';
import SettingsPage from './components/SettingsPage';
import { useToast, markToastHandled } from './components/ToastProvider';
import { useConfirm } from './components/ConfirmProvider';
import {
    RadioStation,
    Genre,
    ExportProfile,
    PlayerApp,
    MonitoringSettings,
    MonitoringStatus,
    MonitoringEvent,
    StreamHealthResult,
} from './types';
import {
    fetchStations,
    createStation,
    updateStation,
    removeStation,
    fetchGenres,
    createGenre,
    updateGenre,
    removeGenre,
    fetchExportProfiles,
    createExportProfile,
    updateExportProfile,
    removeExportProfile,
    fetchPlayerApps,
    createPlayerApp,
    updatePlayerApp,
    removePlayerApp,
    isApiOffline,
    onApiStatusChange,
    resetApiStatus,
    checkStreamsHealth,
} from './api';
import { describeOfflineResult, describeOnlineResult } from './utils/monitoring';

export type View =
    | 'dashboard'
    | 'stations'
    | 'genres'
    | 'export'
    | 'listen'
    | 'players'
    | 'monitoring'
    | 'logs'
    | 'settings';

const App: React.FC = () => {
    const { addToast } = useToast();
    const { confirm } = useConfirm();
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [stations, setStations] = useState<RadioStation[]>([]);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [profiles, setProfiles] = useState<ExportProfile[]>([]);
    const [playerApps, setPlayerApps] = useState<PlayerApp[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [monitoringSettings, setMonitoringSettings] = useState<MonitoringSettings>({ enabled: true, interval: 30, threshold: 48 });
    const [monitoringStatus, setMonitoringStatus] = useState<Record<string, MonitoringStatus>>({});
    const [monitoringEvents, setMonitoringEvents] = useState<MonitoringEvent[]>([]);
    const [isOfflineMode, setIsOfflineMode] = useState<boolean>(isApiOffline());
    const lastMonitorErrorRef = useRef<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            setLoadError(null);
            const [stationData, genreData, profileData, playerData] = await Promise.all([
                fetchStations(),
                fetchGenres(),
                fetchExportProfiles(),
                fetchPlayerApps(),
            ]);

            setStations(stationData);
            setGenres(genreData);
            setProfiles(profileData);
            setPlayerApps(playerData);
        } catch (error) {
            console.error('Failed to load data', error);
            setLoadError(error instanceof Error ? error.message : 'Failed to load application data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        setIsOfflineMode(isApiOffline());
        const unsubscribe = onApiStatusChange(setIsOfflineMode);
        return () => unsubscribe();
    }, []);

    const handleRetryConnection = () => {
        resetApiStatus();
        void loadData();
    };

    // CRUD Handlers
    const handleSaveStation = async (station: RadioStation) => {
        const exists = stations.some(s => s.id === station.id);
        try {
            const savedStation = exists ? await updateStation(station) : await createStation(station);
            setStations(prev => {
                if (exists) {
                    return prev.map(s => (s.id === savedStation.id ? savedStation : s));
                }
                return [...prev, savedStation];
            });
            addToast(exists ? 'Station updated successfully.' : 'Station created successfully.', {
                type: 'success',
            });
        } catch (error) {
            console.error('Failed to save station', error);
            const message = error instanceof Error ? error.message : 'Failed to save station.';
            addToast(message, { type: 'error' });
            markToastHandled(error);
            throw error;
        }
    };

    const handleImportStations = async (stationsToImport: RadioStation[]) => {
        try {
            let nextStations = [...stations];

            for (const station of stationsToImport) {
                const exists = nextStations.some(s => s.id === station.id);
                const savedStation = exists ? await updateStation(station) : await createStation(station);
                nextStations = exists
                    ? nextStations.map(s => (s.id === savedStation.id ? savedStation : s))
                    : [...nextStations, savedStation];
            }

            setStations(nextStations);
        } catch (error) {
            console.error('Failed to import stations', error);
            const message = error instanceof Error ? error.message : 'Failed to import stations.';
            addToast(message, { type: 'error' });
            markToastHandled(error);
            throw error;
        }
    };

    const handleDeleteStation = async (stationId: string) => {
        const station = stations.find(s => s.id === stationId);
        const confirmed = await confirm({
            title: 'Delete station',
            description: station
                ? `Are you sure you want to delete ${station.name}? This action cannot be undone.`
                : 'Are you sure you want to delete this station? This action cannot be undone.',
            confirmLabel: 'Delete station',
            cancelLabel: 'Keep station',
            tone: 'danger',
        });
        if (!confirmed) {
            return;
        }

        try {
            await removeStation(stationId);
            setStations(prev => prev.filter(s => s.id !== stationId));
            setMonitoringStatus(prev => {
                const { [stationId]: _removed, ...rest } = prev;
                return rest;
            });
            addToast('Station deleted.', { type: 'success' });
        } catch (error) {
            console.error('Failed to delete station', error);
            const message = error instanceof Error ? error.message : 'Failed to delete station.';
            addToast(message, { type: 'error' });
            markToastHandled(error);
            throw error;
        }
    };

    const handleSaveGenre = async (genre: Genre) => {
        const exists = genres.some(g => g.id === genre.id);
        try {
            const savedGenre = exists ? await updateGenre(genre) : await createGenre(genre);
            const nextGenres = exists
                ? genres.map(g => (g.id === savedGenre.id ? savedGenre : g))
                : [...genres, savedGenre];
            setGenres(nextGenres);
            const allowedSubGenres = new Set(
                nextGenres.flatMap(g => g.subGenres.map(sub => sub.toLowerCase()))
            );
            setProfiles(prev =>
                prev.map(profile => ({
                    ...profile,
                    subGenres: profile.subGenres.filter(sub => allowedSubGenres.has(sub.toLowerCase())),
                }))
            );
            addToast(exists ? 'Genre updated successfully.' : 'Genre created successfully.', {
                type: 'success',
            });
        } catch (error) {
            console.error('Failed to save genre', error);
            const message = error instanceof Error ? error.message : 'Failed to save genre.';
            addToast(message, { type: 'error' });
            markToastHandled(error);
            throw error;
        }
    };

    const handleDeleteGenre = async (genreId: string) => {
        const genre = genres.find(g => g.id === genreId);
        const confirmed = await confirm({
            title: 'Delete genre',
            description: genre
                ? `Delete the ${genre.name} genre and remove it from associated stations and export profiles?`
                : 'Delete this genre and remove it from associated stations and export profiles?',
            confirmLabel: 'Delete genre',
            cancelLabel: 'Keep genre',
            tone: 'danger',
        });
        if (!confirmed) {
            return;
        }

        try {
            const removedGenre = genres.find(g => g.id === genreId);
            const removedSubGenres = new Set(
                (removedGenre?.subGenres ?? []).map(sub => sub.toLowerCase())
            );
            await removeGenre(genreId);
            const nextGenres = genres.filter(g => g.id !== genreId);
            setGenres(nextGenres);
            setStations(prev =>
                prev.map(station =>
                    station.genreId === genreId ? { ...station, genreId: '', subGenres: [] } : station
                )
            );
            setProfiles(prev =>
                prev.map(profile => ({
                    ...profile,
                    genreIds: profile.genreIds.filter(id => id !== genreId),
                    subGenres:
                        removedSubGenres.size > 0
                            ? profile.subGenres.filter(
                                  sub => !removedSubGenres.has(sub.toLowerCase())
                              )
                            : profile.subGenres,
                }))
            );
            addToast('Genre deleted.', { type: 'success' });
        } catch (error) {
            console.error('Failed to delete genre', error);
            const message = error instanceof Error ? error.message : 'Failed to delete genre.';
            addToast(message, { type: 'error' });
            markToastHandled(error);
            throw error;
        }
    };

    const handleSaveProfile = async (profile: ExportProfile) => {
        const exists = profiles.some(p => p.id === profile.id);
        try {
            const savedProfile = exists ? await updateExportProfile(profile) : await createExportProfile(profile);
            setProfiles(prev => {
                const withoutConflicts = prev.map(p => {
                    if (p.id === savedProfile.id) {
                        return savedProfile;
                    }
                    if (savedProfile.playerId && p.playerId === savedProfile.playerId) {
                        return { ...p, playerId: null };
                    }
                    return p;
                });

                if (!exists) {
                    return [...withoutConflicts, savedProfile];
                }

                return withoutConflicts;
            });
            addToast(exists ? 'Export profile updated successfully.' : 'Export profile created successfully.', {
                type: 'success',
            });
        } catch (error) {
            console.error('Failed to save export profile', error);
            const message = error instanceof Error ? error.message : 'Failed to save export profile.';
            addToast(message, { type: 'error' });
            markToastHandled(error);
            throw error;
        }
    };

    const handleDeleteProfile = async (profileId: string) => {
        const profile = profiles.find(p => p.id === profileId);
        const confirmed = await confirm({
            title: 'Delete export profile',
            description: profile
                ? `Delete the export profile “${profile.name}”? Any linked automation will stop running.`
                : 'Delete this export profile? Any linked automation will stop running.',
            confirmLabel: 'Delete profile',
            cancelLabel: 'Keep profile',
            tone: 'danger',
        });
        if (!confirmed) {
            return;
        }

        try {
            await removeExportProfile(profileId);
            setProfiles(prev => prev.filter(p => p.id !== profileId));
            addToast('Export profile deleted.', { type: 'success' });
        } catch (error) {
            console.error('Failed to delete export profile', error);
            const message = error instanceof Error ? error.message : 'Failed to delete export profile.';
            addToast(message, { type: 'error' });
            markToastHandled(error);
            throw error;
        }
    };

    const handleSavePlayerApp = async (app: PlayerApp) => {
        const exists = playerApps.some(a => a.id === app.id);
        try {
            const savedApp = exists ? await updatePlayerApp(app) : await createPlayerApp(app);
            setPlayerApps(prev => {
                if (exists) {
                    return prev.map(a => (a.id === savedApp.id ? savedApp : a));
                }
                return [...prev, savedApp];
            });
            addToast(exists ? 'Player updated successfully.' : 'Player created successfully.', {
                type: 'success',
            });
        } catch (error) {
            console.error('Failed to save player app', error);
            const message = error instanceof Error ? error.message : 'Failed to save app.';
            addToast(message, { type: 'error' });
            markToastHandled(error);
            throw error;
        }
    };

    const handleDeletePlayerApp = async (appId: string) => {
        const app = playerApps.find(p => p.id === appId);
        const confirmed = await confirm({
            title: 'Delete player',
            description: app
                ? `Delete the player “${app.name}”? Linked profiles will lose their assignments.`
                : 'Delete this player? Linked profiles will lose their assignments.',
            confirmLabel: 'Delete player',
            cancelLabel: 'Keep player',
            tone: 'danger',
        });
        if (!confirmed) {
            return;
        }

        try {
            await removePlayerApp(appId);
            setPlayerApps(prev => prev.filter(app => app.id !== appId));
            setProfiles(prev => prev.map(profile => (profile.playerId === appId ? { ...profile, playerId: null } : profile)));
            addToast('Player deleted.', { type: 'success' });
        } catch (error) {
            console.error('Failed to delete player app', error);
            const message = error instanceof Error ? error.message : 'Failed to delete app.';
            addToast(message, { type: 'error' });
            markToastHandled(error);
            throw error;
        }
    };

    // Monitoring checks
    useEffect(() => {
        if (!monitoringSettings.enabled) {
            setMonitoringStatus(prevStatus => {
                const nextStatus: Record<string, MonitoringStatus> = {};
                stations.forEach(station => {
                    const previous = prevStatus[station.id] || { status: 'unknown', history: [], fails: 0 };
                    nextStatus[station.id] = {
                        ...previous,
                        status: 'unknown',
                        fails: 0,
                        responseTime: undefined,
                        statusCode: undefined,
                        contentType: undefined,
                        error: undefined,
                    };
                });
                return nextStatus;
            });
            return;
        }

        let cancelled = false;

        const runCheck = async () => {
            const activeStations = stations.filter(station => station.isActive && station.streamUrl);

            if (activeStations.length === 0) {
                setMonitoringStatus(prevStatus => {
                    const nextStatus: Record<string, MonitoringStatus> = {};
                    stations.forEach(station => {
                        const previous = prevStatus[station.id] || { status: 'unknown', history: [], fails: 0 };
                        nextStatus[station.id] = {
                            ...previous,
                            status: 'unknown',
                            fails: 0,
                            responseTime: undefined,
                            statusCode: undefined,
                            contentType: undefined,
                            error: undefined,
                        };
                    });
                    return nextStatus;
                });
                return;
            }

            try {
                const results = await checkStreamsHealth(
                    activeStations.map(station => ({ stationId: station.id, streamUrl: station.streamUrl }))
                );

                if (cancelled) {
                    return;
                }

                lastMonitorErrorRef.current = null;
                const timestamp = Date.now();
                const resultMap = new Map(results.map(result => [result.stationId, result] as const));
                const generatedEvents: MonitoringEvent[] = [];

                setMonitoringStatus(prevStatus => {
                    const nextStatus: Record<string, MonitoringStatus> = {};

                    stations.forEach(station => {
                        const previous = prevStatus[station.id] || { status: 'unknown', history: [], fails: 0 };

                        if (!station.isActive || !station.streamUrl) {
                            nextStatus[station.id] = {
                                ...previous,
                                status: 'unknown',
                                fails: 0,
                                responseTime: undefined,
                                statusCode: undefined,
                                contentType: undefined,
                                error: undefined,
                            };
                            return;
                        }

                        const result = resultMap.get(station.id);
                        const isOnline = result?.isOnline === true;
                        const historyValue = isOnline ? 1 : 0;
                        const history = [historyValue, ...previous.history].slice(0, 100);
                        const fails = isOnline ? 0 : previous.fails + 1;
                        const status: MonitoringStatus['status'] = isOnline ? 'online' : 'offline';
                        const errorMessage = result?.error ?? (!result ? 'No monitoring data available.' : undefined);

                        nextStatus[station.id] = {
                            status,
                            history,
                            fails,
                            responseTime: result?.responseTime,
                            statusCode: result?.statusCode,
                            contentType: result?.contentType,
                            lastCheckedAt: timestamp,
                            error: errorMessage,
                        };

                        if (previous.status !== 'unknown' && previous.status !== status) {
                            generatedEvents.push({
                                id: `status-${timestamp}-${station.id}`,
                                stationName: station.name,
                                message:
                                    status === 'online'
                                        ? `Stream is back online (${describeOnlineResult(result)})`
                                        : describeOfflineResult(result),
                                timestamp,
                                type: status === 'online' ? 'success' : 'error',
                            });
                        }

                        if (!isOnline && monitoringSettings.threshold > 0 && fails === monitoringSettings.threshold) {
                            generatedEvents.push({
                                id: `threshold-${timestamp}-${station.id}`,
                                stationName: station.name,
                                message: `Stream failed ${fails} checks in a row.`,
                                timestamp,
                                type: 'error',
                            });
                        }
                    });

                    return nextStatus;
                });

                if (generatedEvents.length > 0) {
                    setMonitoringEvents(prev => [...generatedEvents, ...prev].slice(0, 100));
                }
            } catch (error) {
                if (cancelled) {
                    return;
                }
                console.error('Failed to check stream health', error);
                const message = error instanceof Error ? error.message : 'Failed to check stream health.';
                if (lastMonitorErrorRef.current !== message) {
                    addToast(message, { type: 'error' });
                    lastMonitorErrorRef.current = message;
                    markToastHandled(error);
                }
            }
        };

        void runCheck();

        const intervalMs = Math.max(1, monitoringSettings.interval) * 60 * 1000;
        const intervalId = window.setInterval(() => {
            void runCheck();
        }, intervalMs);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [
        monitoringSettings.enabled,
        monitoringSettings.interval,
        monitoringSettings.threshold,
        stations,
        addToast,
        checkStreamsHealth,
    ]);

    const renderView = () => {
        switch (currentView) {
            case 'dashboard':
                return <Dashboard stations={stations} genres={genres} profiles={profiles} monitoringStatus={monitoringStatus} />;
            case 'stations':
                return (
                    <StationManager
                        stations={stations}
                        genres={genres}
                        monitoringStatus={monitoringStatus}
                        onSaveStation={handleSaveStation}
                        onDeleteStation={handleDeleteStation}
                        onImportStations={handleImportStations}
                    />
                );
            case 'genres':
                return <GenreManager genres={genres} onSaveGenre={handleSaveGenre} onDeleteGenre={handleDeleteGenre} />;
            case 'export':
                return (
                    <ExportManager
                        profiles={profiles}
                        stations={stations}
                        genres={genres}
                        playerApps={playerApps}
                        onSaveProfile={handleSaveProfile}
                        onDeleteProfile={handleDeleteProfile}
                    />
                );
            case 'players':
                return (
                    <PlayerManager
                        apps={playerApps}
                        profiles={profiles}
                        onSaveApp={handleSavePlayerApp}
                        onDeleteApp={handleDeletePlayerApp}
                    />
                );
            case 'listen':
                return <ListenPage stations={stations} genres={genres} />;
            case 'monitoring':
                return <StreamMonitor stations={stations} settings={monitoringSettings} status={monitoringStatus} events={monitoringEvents} onSaveSettings={setMonitoringSettings} />;
            case 'logs':
                return <LogViewer isOffline={isOfflineMode} />;
            case 'settings':
                return (
                    <SettingsPage
                        monitoringSettings={monitoringSettings}
                        onUpdateMonitoring={setMonitoringSettings}
                    />
                );
            default:
                return <Dashboard stations={stations} genres={genres} profiles={profiles} monitoringStatus={monitoringStatus} />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-background dark:bg-dark-background text-brand-dark dark:text-dark-text">
                <p className="text-lg font-medium">Loading application…</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-background dark:bg-dark-background text-brand-dark dark:text-dark-text">
                <div className="bg-white dark:bg-dark-surface border border-brand-border dark:border-dark-border rounded-xl p-8 max-w-lg text-center shadow-sm">
                    <h1 className="text-2xl font-bold mb-4">Unable to load data</h1>
                    <p className="text-brand-text-light dark:text-dark-text-light">{loadError}</p>
                    <button
                        className="mt-6 px-5 py-2.5 bg-brand-dark text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                        onClick={() => void loadData()}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex bg-brand-background dark:bg-dark-background min-h-screen">
            <Sidebar currentView={currentView} onNavigate={setCurrentView} />
            <main className="flex-1 p-8 overflow-y-auto">
                {isOfflineMode && (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="font-semibold">Offline mode enabled</p>
                                <p className="text-sm opacity-90">
                                    The backend API could not be reached. Data is loaded from this browser only and will persist locally until the connection is restored.
                                </p>
                            </div>
                            <button
                                onClick={handleRetryConnection}
                                className="self-start rounded-lg border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-500/20"
                            >
                                Retry API connection
                            </button>
                        </div>
                    </div>
                )}
                {renderView()}
            </main>
        </div>
    );
};

export default App;
