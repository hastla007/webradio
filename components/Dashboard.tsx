// FIX: Removed invalid text from the start of the file that was causing parsing errors.
import React from 'react';
import { RadioStation, Genre, ExportProfile, MonitoringStatus } from '../types';
import StationLogo from './StationLogo';

interface DashboardProps {
    stations: RadioStation[];
    genres: Genre[];
    profiles: ExportProfile[];
    monitoringStatus: Record<string, MonitoringStatus>;
}

const Dashboard: React.FC<DashboardProps> = ({ stations, genres, profiles, monitoringStatus }) => {
    let onlineCount = 0;
    let offlineCount = 0;

    stations.forEach(station => {
        const status = monitoringStatus[station.id];
        if (status?.status === 'online') {
            onlineCount++;
        } else if (status?.status === 'offline') {
            offlineCount++;
        }
    });
    
    return (
        <div className="dark:text-dark-text">
            <header className="mb-8">
                <h1 className="text-4xl font-bold text-brand-dark dark:text-dark-text">Dashboard</h1>
                <p className="text-brand-text-light dark:text-dark-text-light mt-1">Welcome! Here's an overview of your web radio manager.</p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-brand-surface dark:bg-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-dark-border">
                    <h2 className="text-xl font-bold text-brand-dark dark:text-dark-text">Total Stations</h2>
                    <p className="text-5xl font-bold text-brand-primary mt-2">{stations.length}</p>
                </div>
                <div className="bg-brand-surface dark:bg-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-dark-border">
                    <h2 className="text-xl font-bold text-brand-dark dark:text-dark-text">Total Genres</h2>
                    <p className="text-5xl font-bold text-brand-primary mt-2">{genres.length}</p>
                </div>
                <div className="bg-brand-surface dark:bg-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-dark-border">
                    <h2 className="text-xl font-bold text-brand-dark dark:text-dark-text">Export Profiles</h2>
                    <p className="text-5xl font-bold text-brand-primary mt-2">{profiles.length}</p>
                </div>
                 <div className="bg-brand-surface dark:bg-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-dark-border">
                    <h2 className="text-xl font-bold text-brand-dark dark:text-dark-text">Live Stream Status</h2>
                    <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <span className="h-2.5 w-2.5 rounded-full bg-green-500 mr-3"></span>
                                <span className="text-brand-text-light dark:text-dark-text-light">Online</span>
                            </div>
                            <p className="text-2xl font-bold text-brand-dark dark:text-dark-text">{onlineCount}</p>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <span className="h-2.5 w-2.5 rounded-full bg-red-500 mr-3"></span>
                                <span className="text-brand-text-light dark:text-dark-text-light">Offline</span>
                            </div>
                            <p className="text-2xl font-bold text-brand-dark dark:text-dark-text">{offlineCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-brand-surface dark:bg-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-dark-border">
                 <h2 className="text-xl font-bold mb-4 dark:text-dark-text">Recently Added Stations</h2>
                 {stations.length > 0 ? (
                    <ul className="space-y-3">
                        {stations.slice(-5).reverse().map(station => (
                            <li key={station.id} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5">
                                <StationLogo name={station.name} logoUrl={station.logoUrl} size={40} />
                                <div>
                                    <p className="font-semibold dark:text-dark-text">{station.name}</p>
                                    <p className="text-sm text-brand-text-light dark:text-dark-text-light">
                                        {genres.find(g => g.id === station.genreId)?.name}
                                    </p>
                                    {station.subGenres.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-brand-text-light dark:text-dark-text-light">
                                            {station.subGenres.map(subGenre => (
                                                <span key={subGenre} className="rounded-full bg-brand-primary/10 px-2 py-0.5">
                                                    {subGenre}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                 ) : (
                    <p className="text-center py-8 text-brand-text-light dark:text-dark-text-light">No stations added yet.</p>
                 )}
            </div>
        </div>
    );
};

export default Dashboard;