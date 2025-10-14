import React, { useState, useMemo } from 'react';
import { RadioStation, MonitoringSettings, MonitoringStatus, MonitoringEvent } from '../types';

interface StreamMonitorProps {
    stations: RadioStation[];
    settings: MonitoringSettings;
    status: Record<string, MonitoringStatus>;
    events: MonitoringEvent[];
    onSaveSettings: (settings: MonitoringSettings) => void;
}

const UptimeBar: React.FC<{ history: number[] | undefined, barCount?: number }> = ({ history = [], barCount = 60 }) => {
    const bars = [...history].reverse().slice(0, barCount); // Get last X checks and reverse to show oldest first
    while (bars.length < barCount) {
        bars.push(-1); // Use -1 for empty slots
    }

    return (
        <div className="flex items-center gap-px h-full">
            {bars.map((result, index) => {
                let colorClass = 'bg-gray-200 dark:bg-gray-600';
                if (result === 1) colorClass = 'bg-green-500';
                if (result === 0) colorClass = 'bg-red-500';
                return <div key={index} className={`w-1.5 h-full rounded-sm ${colorClass}`}></div>;
            })}
        </div>
    );
};

const EventLog: React.FC<{ event: MonitoringEvent }> = ({ event }) => {
    const baseClasses = "px-2 py-0.5 text-xs font-semibold rounded-full";
    let typeClass = '';
    switch(event.type) {
        case 'success':
            typeClass = 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
            break;
        case 'error':
            typeClass = 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
            break;
        case 'info':
            typeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
            break;
    }
    return (
        <li className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-gray-50 dark:hover:bg-brand-dark-surface/50">
            <div>
                <span className="font-semibold text-brand-dark dark:text-gray-200">{event.stationName}</span>
                <span className="text-brand-text-light dark:text-gray-400 ml-2">{event.message}</span>
            </div>
            <div className="flex items-center space-x-4">
                 <span className="text-xs text-brand-text-light dark:text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</span>
                 <span className={`${baseClasses} ${typeClass}`}>{event.type}</span>
            </div>
        </li>
    );
};


const StreamMonitor: React.FC<StreamMonitorProps> = ({ stations, settings, status, events, onSaveSettings }) => {
    const [localSettings, setLocalSettings] = useState<MonitoringSettings>(settings);
    const [selectedStationId, setSelectedStationId] = useState<string | null>(stations[0]?.id || null);

    React.useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLocalSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : Number(value)
        }));
    };

    const handleSave = () => {
        onSaveSettings(localSettings);
        alert('Settings saved!');
    };

    const calculateUptime = (history: number[] = []) => {
        if (history.length === 0) return '100.00';
        const onlineChecks = history.filter(h => h === 1).length;
        return ((onlineChecks / history.length) * 100).toFixed(2);
    };

    const selectedStation = useMemo(() => stations.find(s => s.id === selectedStationId), [stations, selectedStationId]);
    const selectedStatus = useMemo(() => selectedStationId ? status[selectedStationId] : null, [status, selectedStationId]);
    const stationEvents = useMemo(() => 
        selectedStation ? events.filter(e => e.stationName === selectedStation.name).slice(0, 20) : [],
        [events, selectedStation]
    );

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
                            const stationStatus = status[station.id];
                            const isSelected = station.id === selectedStationId;
                            return (
                                <button 
                                    key={station.id} 
                                    onClick={() => setSelectedStationId(station.id)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${isSelected ? 'bg-brand-primary/20 border-brand-primary/50 dark:bg-brand-primary/10 dark:border-brand-primary/30' : 'border-transparent hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center space-x-3 mb-2">
                                        <span className={`px-2 py-1 text-sm font-bold rounded-md ${stationStatus?.status === 'online' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                                            {calculateUptime(stationStatus?.history)}%
                                        </span>
                                        <span className="font-semibold text-brand-dark dark:text-gray-200">{station.name}</span>
                                    </div>
                                    <div className="h-3">
                                       <UptimeBar history={stationStatus?.history} barCount={40} />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right Column: Detailed View */}
                <div className="lg:col-span-2 space-y-6">
                    {selectedStation && selectedStatus ? (
                         <>
                            <div className="bg-brand-surface dark:bg-brand-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                <h2 className="text-3xl font-bold dark:text-white">{selectedStation.name}</h2>
                                <div className="flex items-center justify-between mt-4">
                                    <div className="h-7 flex-grow pr-6">
                                       <UptimeBar history={selectedStatus.history} />
                                    </div>
                                    <div className={`px-6 py-2 rounded-full font-bold text-lg flex items-center justify-center ${selectedStatus.status === 'online' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                       {selectedStatus.status === 'online' ? 'Up' : 'Down'}
                                    </div>
                                </div>
                                <div className="text-xs text-brand-text-light dark:text-gray-500 flex justify-between mt-1">
                                    <span>{settings.interval * 60} seconds ago</span>
                                    <span>now</span>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                    <h4 className="text-sm text-brand-text-light dark:text-gray-400">Uptime (24h)</h4>
                                    <p className="text-xl font-bold dark:text-white">{calculateUptime(selectedStatus.history)}%</p>
                                </div>
                                <div className="bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                    <h4 className="text-sm text-brand-text-light dark:text-gray-400">Current Status</h4>
                                    <p className={`text-xl font-bold capitalize ${selectedStatus.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>{selectedStatus.status}</p>
                                </div>
                                <div className="bg-brand-surface dark:bg-brand-dark-surface p-4 rounded-2xl shadow-sm border border-brand-border dark:border-gray-700">
                                    <h4 className="text-sm text-brand-text-light dark:text-gray-400">Consecutive Fails</h4>
                                    <p className="text-xl font-bold dark:text-white">{selectedStatus.fails}</p>
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