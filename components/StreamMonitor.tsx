import React, { useState, useMemo } from 'react';
import { RadioStation, MonitoringSettings, MonitoringStatus, MonitoringEvent } from '../types';
import { useToast } from './ToastProvider';
import UptimeBar from './UptimeBar';
import StatusBadge from './StatusBadge';
import StationLogo from './StationLogo';

interface StreamMonitorProps {
    stations: RadioStation[];
    settings: MonitoringSettings;
    status: Record<string, MonitoringStatus>;
    events: MonitoringEvent[];
    onSaveSettings: (settings: MonitoringSettings) => void;
}

const EventLog: React.FC<{ event: MonitoringEvent }> = ({ event }) => {
    const badgeStatus = event.type === 'success' ? 'success' : event.type === 'error' ? 'error' : 'info';
    return (
        <li className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-gray-50 dark:hover:bg-brand-dark-surface/50">
            <div>
                <span className="font-semibold text-brand-dark dark:text-gray-200">{event.stationName}</span>
                <span className="text-brand-text-light dark:text-gray-400 ml-2">{event.message}</span>
            </div>
            <div className="flex items-center space-x-4">
                 <span className="text-xs text-brand-text-light dark:text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                 <StatusBadge status={badgeStatus} label={event.type} size="sm" />
            </div>
        </li>
    );
};


const DEFAULT_STATUS: MonitoringStatus = { status: 'unknown', history: [], fails: 0 };

const StreamMonitor: React.FC<StreamMonitorProps> = ({ stations, settings, status, events, onSaveSettings }) => {
    const [localSettings, setLocalSettings] = useState<MonitoringSettings>(settings);
    const [selectedStationId, setSelectedStationId] = useState<string | null>(stations[0]?.id || null);
    const { addToast } = useToast();

    React.useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    React.useEffect(() => {
        if (stations.length === 0) {
            setSelectedStationId(null);
            return;
        }

        setSelectedStationId(previous => {
            if (previous && stations.some(station => station.id === previous)) {
                return previous;
            }
            return stations[0]?.id ?? null;
        });
    }, [stations]);

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLocalSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : Number(value)
        }));
    };

    const handleSave = () => {
        onSaveSettings(localSettings);
        addToast('Monitoring settings saved.', { type: 'success' });
    };

    const calculateUptime = (history: number[] = []) => {
        if (history.length === 0) return '100.00';
        const onlineChecks = history.filter(h => h === 1).length;
        return ((onlineChecks / history.length) * 100).toFixed(2);
    };

    const selectedStation = useMemo(() => stations.find(s => s.id === selectedStationId) ?? null, [stations, selectedStationId]);
    const selectedStatus = useMemo<MonitoringStatus | null>(
        () => {
            if (!selectedStationId) {
                return null;
            }
            return status[selectedStationId] ?? DEFAULT_STATUS;
        },
        [status, selectedStationId]
    );
    const stationEvents = useMemo(() =>
        selectedStation ? events.filter(e => e.stationName === selectedStation.name).slice(0, 20) : [],
        [events, selectedStation]
    );
    const resolvedStatus = selectedStatus ?? DEFAULT_STATUS;
    const lastCheckedLabel = resolvedStatus.lastCheckedAt
        ? new Date(resolvedStatus.lastCheckedAt).toLocaleTimeString()
        : 'Not checked yet';
    const responseTimeLabel = resolvedStatus.responseTime != null ? `${resolvedStatus.responseTime} ms` : '—';
    const statusCodeLabel = resolvedStatus.statusCode != null ? resolvedStatus.statusCode : '—';
    const selectedStatusVariant = resolvedStatus.status;
    const selectedStatusLabel = resolvedStatus.status === 'online'
        ? 'Online'
        : resolvedStatus.status === 'offline'
        ? 'Offline'
        : 'Unknown';

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-4xl font-bold text-brand-dark dark:text-white">Stream Monitoring</h1>
                <p className="text-brand-text-light dark:text-gray-400 mt-1">An overview of the health of your radio streams.</p>
            </header>
            
            {/* New Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Station List */}
                <div className="lg:col-span-1 bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                    <h2 className="text-xl font-bold mb-4 px-2 dark:text-white">Stations</h2>
                    <div className="space-y-2 max-h-[80vh] overflow-y-auto">
                        {stations.map(station => {
                            const stationStatus = status[station.id] ?? DEFAULT_STATUS;
                            const isSelected = station.id === selectedStationId;
                            const badgeStatus = stationStatus?.status === 'online'
                                ? 'online'
                                : stationStatus?.status === 'offline'
                                ? 'offline'
                                : 'unknown';
                            return (
                                <button
                                    key={station.id}
                                    onClick={() => setSelectedStationId(station.id)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected ? 'bg-brand-primary/20 border-brand-primary/50 dark:bg-brand-primary/10 dark:border-brand-primary/30' : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <StationLogo name={station.name} logoUrl={station.logoUrl} size={36} />
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-brand-dark dark:text-gray-200">{station.name}</span>
                                            <StatusBadge
                                                status={badgeStatus}
                                                label={`${calculateUptime(stationStatus?.history)}%`}
                                                size="sm"
                                                className="mt-1 w-fit"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-2 h-3">
                                        <UptimeBar history={stationStatus?.history} barCount={40} className="h-full" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Detailed View */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedStation ? (
                        <>
                            <div className="bg-brand-surface dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                <div className="flex flex-wrap items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <StationLogo name={selectedStation.name} logoUrl={selectedStation.logoUrl} size={56} />
                                        <h2 className="text-3xl font-bold dark:text-white">{selectedStation.name}</h2>
                                    </div>
                                    <StatusBadge
                                        status={selectedStatusVariant}
                                        label={selectedStatusLabel}
                                        size="lg"
                                        className="justify-center min-w-[120px]"
                                    />
                                </div>
                                <div className="mt-4 h-7">
                                    <UptimeBar history={resolvedStatus.history} className="h-full" />
                                </div>
                                <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-brand-text-light dark:text-gray-500 gap-2">
                                    <span>Last checked: {lastCheckedLabel}</span>
                                    <span>Interval: every {settings.interval} min</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                <div className="bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                    <h4 className="text-sm text-brand-text-light dark:text-gray-400">Uptime (24h)</h4>
                                    <p className="text-xl font-bold dark:text-white">{calculateUptime(resolvedStatus.history)}%</p>
                                </div>
                                <div className="bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                    <h4 className="text-sm text-brand-text-light dark:text-gray-400">Current Status</h4>
                                    <StatusBadge status={selectedStatusVariant} label={selectedStatusLabel} size="md" />
                                </div>
                                <div className="bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                    <h4 className="text-sm text-brand-text-light dark:text-gray-400">Response Time</h4>
                                    <p className="text-xl font-bold dark:text-white">{responseTimeLabel}</p>
                                </div>
                                <div className="bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                    <h4 className="text-sm text-brand-text-light dark:text-gray-400">HTTP Status</h4>
                                    <p className="text-xl font-bold dark:text-white">{statusCodeLabel}</p>
                                </div>
                                <div className="bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                    <h4 className="text-sm text-brand-text-light dark:text-gray-400">Consecutive Fails</h4>
                                    <p className="text-xl font-bold dark:text-white">{resolvedStatus.fails}</p>
                                </div>
                                <div className="bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                    <h4 className="text-sm text-brand-text-light dark:text-gray-400">App Status</h4>
                                     <p className={`text-xl font-bold ${selectedStation.isActive ? 'text-green-500' : 'text-red-500'}`}>
                                        {selectedStation.isActive ? 'Active' : 'Deactivated'}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-brand-surface dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                <h2 className="text-xl font-bold mb-4 dark:text-white">Recent Events for {selectedStation.name}</h2>
                                {resolvedStatus.error && (
                                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
                                        {resolvedStatus.error}
                                    </div>
                                )}
                                {resolvedStatus.contentType && (
                                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
                                        Content type: {resolvedStatus.contentType}
                                    </div>
                                )}
                                <ul className="space-y-1">
                                    {stationEvents.length > 0 ? (
                                        stationEvents.map(event => <EventLog key={event.id} event={event} />)
                                    ) : (
                                        <p className="text-center py-8 text-brand-text-light dark:text-gray-500">No monitoring events for this station yet.</p>
                                    )}
                                </ul>
                            </div>
                         </>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-brand-surface dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                           <p className="text-brand-text-light dark:text-gray-400">Select a station from the list to see its details.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Configuration Panel */}
            <details className="bg-brand-surface dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                <summary className="text-xl font-bold cursor-pointer dark:text-white">Configuration</summary>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
                    <div>
                        <label htmlFor="interval" className="block text-sm font-medium text-brand-text-light dark:text-gray-400 mb-1">Check Interval (minutes)</label>
                        <input type="number" name="interval" id="interval" value={localSettings.interval} onChange={handleSettingsChange} min="1" className="w-full px-3 py-2 border border-brand-border dark:border-gray-600 dark:bg-brand-dark rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none dark:text-white"/>
                    </div>
                    <div>
                        <label htmlFor="threshold" className="block text-sm font-medium text-brand-text-light dark:text-gray-400 mb-1">Failure Threshold</label>
                        <input type="number" name="threshold" id="threshold" value={localSettings.threshold} onChange={handleSettingsChange} min="1" className="w-full px-3 py-2 border border-brand-border dark:border-gray-600 dark:bg-brand-dark rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none dark:text-white"/>
                    </div>
                    <div className="flex flex-col h-full justify-between">
                         <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" name="enabled" checked={localSettings.enabled} onChange={handleSettingsChange} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"/>
                            <span className="font-medium dark:text-white">Monitoring Enabled</span>
                        </label>
                        <button onClick={handleSave} className="w-full mt-2 px-5 py-2.5 bg-brand-dark text-white font-semibold rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors">
                            Save Settings
                        </button>
                    </div>
                </div>
            </details>
        </div>
    );
};

export default StreamMonitor;