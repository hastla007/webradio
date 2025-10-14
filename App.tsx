import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import StationManager from './components/StationManager';
import GenreManager from './components/GenreManager';
import ExportManager from './components/ExportManager';
import PlayerManager from './components/PlayerManager';
import StreamMonitor from './components/StreamMonitor';
import ListenPage from './components/ListenPage';
import SettingsPage from './components/SettingsPage';
import {
    RadioStation,
    Genre,
    ExportProfile,
    PlayerApp,
    MonitoringSettings,
    MonitoringStatus,
    MonitoringEvent,
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
} from './api';

export type View = 'dashboard' | 'stations' | 'genres' | 'export' | 'listen' | 'players' | 'monitoring' | 'settings';

const App: React.FC = () => {
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
        } catch (error) {
            console.error('Failed to save station', error);
            const message = error instanceof Error ? error.message : 'Failed to save station.';
            alert(message);
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
            alert(message);
            throw error;
        }
    };

    const handleDeleteStation = async (stationId: string) => {
        if (!window.confirm('Are you sure you want to delete this station?')) {
            return;
        }

        try {
            await removeStation(stationId);
            setStations(prev => prev.filter(s => s.id !== stationId));
            setMonitoringStatus(prev => {
                const { [stationId]: _removed, ...rest } = prev;
                return rest;
            });
        } catch (error) {
            console.error('Failed to delete station', error);
            const message = error instanceof Error ? error.message : 'Failed to delete station.';
            alert(message);
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
        } catch (error) {
            console.error('Failed to save genre', error);
            const message = error instanceof Error ? error.message : 'Failed to save genre.';
            alert(message);
            throw error;
        }
    };

    const handleDeleteGenre = async (genreId: string) => {
        if (!window.confirm('Are you sure you want to delete this genre?')) {
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
        } catch (error) {
            console.error('Failed to delete genre', error);
            const message = error instanceof Error ? error.message : 'Failed to delete genre.';
            alert(message);
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
        } catch (error) {
            console.error('Failed to save export profile', error);
            const message = error instanceof Error ? error.message : 'Failed to save export profile.';
            alert(message);
            throw error;
        }
    };

    const handleDeleteProfile = async (profileId: string) => {
        if (!window.confirm('Are you sure you want to delete this export profile?')) {
            return;
        }

        try {
            await removeExportProfile(profileId);
            setProfiles(prev => prev.filter(p => p.id !== profileId));
        } catch (error) {
            console.error('Failed to delete export profile', error);
            const message = error instanceof Error ? error.message : 'Failed to delete export profile.';
            alert(message);
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
        } catch (error) {
            console.error('Failed to save player app', error);
            const message = error instanceof Error ? error.message : 'Failed to save app.';
            alert(message);
            throw error;
        }
    };

    const handleDeletePlayerApp = async (appId: string) => {
        if (!window.confirm('Are you sure you want to delete this app/player?')) {
            return;
        }

        try {
            await removePlayerApp(appId);
            setPlayerApps(prev => prev.filter(app => app.id !== appId));
            setProfiles(prev => prev.map(profile => (profile.playerId === appId ? { ...profile, playerId: null } : profile)));
        } catch (error) {
            console.error('Failed to delete player app', error);
            const message = error instanceof Error ? error.message : 'Failed to delete app.';
            alert(message);
            throw error;
        }
    };

    // Monitoring simulation
    useEffect(() => {
        if (!monitoringSettings.enabled) {
            return;
        }

        const runCheck = () => {
            const generatedEvents: MonitoringEvent[] = [];

            setMonitoringStatus(prevStatus => {
                const updatedStatus: Record<string, MonitoringStatus> = {};

                stations.forEach(station => {
                    if (!station.isActive) {
                        updatedStatus[station.id] = prevStatus[station.id] || { status: 'unknown', history: [], fails: 0 };
                        return;
                    }

                    const current = prevStatus[station.id] || { status: 'unknown', history: [], fails: 0 };
                    const isOnline = Math.random() > 0.1; // 90% chance to be online
                    const newHistory = [isOnline ? 1 : 0, ...current.history].slice(0, 100);
                    const newFails = isOnline ? 0 : current.fails + 1;

                    const oldStatus = current.status;
                    const newLiveStatus: MonitoringStatus['status'] = isOnline ? 'online' : 'offline';

                    updatedStatus[station.id] = { status: newLiveStatus, history: newHistory, fails: newFails };

                    if (oldStatus !== 'unknown' && oldStatus !== newLiveStatus) {
                        generatedEvents.push({
                            id: `e${Date.now()}-${station.id}`,
                            stationName: station.name,
                            message: `Stream status changed to ${newLiveStatus}`,
                            timestamp: Date.now(),
                            type: newLiveStatus === 'online' ? 'success' : 'error',
                        });
                    }

                    if (!isOnline && monitoringSettings.threshold > 0 && newFails === monitoringSettings.threshold) {
                        generatedEvents.push({
                            id: `threshold-${Date.now()}-${station.id}`,
                            stationName: station.name,
                            message: `Stream failed ${newFails} checks in a row`,
                            timestamp: Date.now(),
                            type: 'error',
                        });
                    }
                });

                return { ...prevStatus, ...updatedStatus };
            });

            if (generatedEvents.length > 0) {
                setMonitoringEvents(prev => [...generatedEvents, ...prev].slice(0, 100));
            }
        };

        runCheck();

        const intervalMs = Math.max(1, monitoringSettings.interval) * 60 * 1000;
        const intervalId = setInterval(runCheck, intervalMs);

        return () => clearInterval(intervalId);
    }, [monitoringSettings.enabled, monitoringSettings.interval, monitoringSettings.threshold, stations]);

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
