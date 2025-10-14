import React, { useCallback, useMemo, useState } from 'react';
import { ExportProfile, Genre, PlayerApp, RadioStation } from '../types';
import ExportProfileFormModal from './ExportProfileFormModal';
import { PlusIcon, EditIcon, TrashIcon, ClockIcon } from './Icons';
import { runProfileExport } from '../api';
import { useToast, wasToastHandled, markToastHandled } from './ToastProvider';

interface ExportManagerProps {
    profiles: ExportProfile[];
    stations: RadioStation[];
    genres: Genre[];
    playerApps: PlayerApp[];
    onSaveProfile: (profile: ExportProfile) => Promise<void> | void;
    onDeleteProfile: (profileId: string) => Promise<void> | void;
}

const ExportManager: React.FC<ExportManagerProps> = ({ profiles, stations, genres, playerApps, onSaveProfile, onDeleteProfile }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<ExportProfile | null>(null);
    const [activeExportId, setActiveExportId] = useState<string | null>(null);
    const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
    const { addToast } = useToast();

    const getStationsForProfile = useCallback((profile: ExportProfile) => {
        const byId = new Map<string, RadioStation>();

        const subGenreSet = new Set(profile.subGenres?.map(sub => sub.toLowerCase()) ?? []);
        stations.forEach(station => {
            const isExplicit = profile.stationIds.includes(station.id);
            const matchesGenre = profile.genreIds.includes(station.genreId);
            const matchesSubGenre = station.subGenres.some(sub => subGenreSet.has(sub.toLowerCase()));

            if (((matchesGenre || matchesSubGenre) && station.isActive) || isExplicit) {
                byId.set(station.id, station);
            }
        });

        return Array.from(byId.values());
    }, [stations]);

    const profileStationCounts = useMemo(() => {
        return profiles.reduce<Record<string, number>>((acc, profile) => {
            acc[profile.id] = getStationsForProfile(profile).length;
            return acc;
        }, {});
    }, [profiles, getStationsForProfile]);

    const playerAssignments = useMemo(() => {
        return profiles.reduce<Record<string, { profileId: string; profileName: string }>>((acc, profile) => {
            if (profile.playerId) {
                acc[profile.playerId] = { profileId: profile.id, profileName: profile.name };
            }
            return acc;
        }, {});
    }, [profiles]);

    const handleAddNew = () => {
        setEditingProfile(null);
        setIsModalOpen(true);
    };

    const handleEdit = (profile: ExportProfile) => {
        setEditingProfile(profile);
        setIsModalOpen(true);
    };

    const handleSave = async (profile: ExportProfile) => {
        try {
            await onSaveProfile(profile);
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to save export profile', error);
            if (!wasToastHandled(error)) {
                addToast('Failed to save export profile.', { type: 'error' });
            }
        }
    };

    const handleDownload = async (profile: ExportProfile) => {
        try {
            setActiveDownloadId(profile.id);
            const response = await fetch(`/api/export-profiles/${profile.id}/download`);
            if (!response.ok) {
                throw new Error('Failed to download export profile');
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${profile.name}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download export profile', error);
            if (!wasToastHandled(error)) {
                addToast('Failed to download export profile.', { type: 'error' });
            }
            markToastHandled(error);
        } finally {
            setActiveDownloadId(null);
        }
    };

    const handleExport = async (profile: ExportProfile) => {
        try {
            setActiveExportId(profile.id);
            const summary = await runProfileExport(profile.id);
            const stationCount = summary ? Number(summary.stationCount) || 0 : 0;
            if (!summary || stationCount === 0 || !Array.isArray(summary.files) || summary.files.length === 0) {
                addToast('This export profile does not include any active stations to export.', { type: 'warning' });
                return;
            }

            const savedDirectory = summary.outputDirectory || '/data/app-json-export';
            const bulletPoints = summary.files.map(file => {
                const suffix = file.ftpUploaded ? ' (uploaded via FTP)' : '';
                return `• ${file.fileName}${suffix}`;
            });

            addToast(
                [
                    `Export complete! ${stationCount} ${stationCount === 1 ? 'station' : 'stations'} saved to ${savedDirectory}.`,
                    ...bulletPoints,
                ].join('\n'),
                { type: 'success', duration: 6000 },
            );
        } catch (error) {
            console.error('Failed to export profile', error);
            const message = error instanceof Error ? error.message : 'Failed to export profile.';
            if (!wasToastHandled(error)) {
                addToast(message, { type: 'error' });
            }
            markToastHandled(error);
        } finally {
            setActiveExportId(null);
        }
    };

    return (
        <div>
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-brand-dark">Export Profiles</h1>
                    <p className="text-brand-text-light mt-1">Manage profiles for exporting station lists.</p>
                </div>
                <button
                    onClick={handleAddNew}
                    className="flex items-center bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                >
                    <PlusIcon />
                    <span className="ml-2">Create New Profile</span>
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {profiles.map(profile => {
                    const linkedApp = profile.playerId ? playerApps.find(app => app.id === profile.playerId) : undefined;

                    return (
                        <div key={profile.id} className="bg-brand-surface p-6 rounded-2xl shadow-sm border border-brand-border flex flex-col">
                            <div className="flex-grow">
                                <h3 className="text-xl font-bold text-brand-dark">{profile.name}</h3>
                                <div className="mt-4 space-y-2 text-sm">
                                    <p><span className="font-semibold">{profile.genreIds.length}</span> Genres selected</p>
                                    <p><span className="font-semibold">{profile.subGenres?.length ?? 0}</span> Sub-genres selected</p>
                                    <p><span className="font-semibold">{profile.stationIds.length}</span> individual Stations selected</p>
                                    <p>
                                        <span className="font-semibold">{profileStationCounts[profile.id] ?? 0}</span> total stations exported
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <span className="font-semibold">App:</span>
                                        {linkedApp ? (
                                            <span>{linkedApp.name}</span>
                                        ) : (
                                            <span className="text-brand-text-light">No app linked</span>
                                        )}
                                    </p>
                                </div>
                                {profile.autoExport.enabled && (
                                    <div className="mt-4 flex items-center text-xs text-brand-text-light bg-gray-50 p-2 rounded-md">
                                        <ClockIcon />
                                        <span className="ml-2">Auto-exports <span className="font-semibold capitalize">{profile.autoExport.interval}</span> at <span className="font-semibold">{profile.autoExport.time}</span></span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-6 flex items-center justify-end space-x-2 border-t border-brand-border pt-4">
                                <button
                                    onClick={() => handleExport(profile)}
                                    disabled={activeExportId === profile.id}
                                    className="px-4 py-2 text-sm font-semibold bg-brand-primary text-brand-dark rounded-lg hover:bg-brand-primary/80 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {activeExportId === profile.id ? 'Exporting…' : 'Export Now'}
                                </button>
                                <button
                                    onClick={() => handleDownload(profile)}
                                    disabled={activeDownloadId === profile.id}
                                    className="px-4 py-2 text-sm font-semibold bg-white text-brand-dark border border-brand-border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {activeDownloadId === profile.id ? 'Preparing…' : 'Download Files'}
                                </button>
                                <button onClick={() => handleEdit(profile)} className="p-2 text-brand-text-light hover:bg-gray-100 rounded-lg transition-colors">
                                    <EditIcon />
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await onDeleteProfile(profile.id);
                                        } catch (error) {
                                            console.error('Failed to delete export profile', error);
                                        }
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {profiles.length === 0 && (
                <div className="text-center py-16 text-brand-text-light bg-brand-surface rounded-2xl border border-brand-border">
                    <p>No export profiles created yet.</p>
                </div>
            )}

            {isModalOpen && (
                <ExportProfileFormModal
                    profile={editingProfile}
                    genres={genres}
                    stations={stations}
                    playerApps={playerApps}
                    playerAssignments={playerAssignments}
                    onSave={handleSave}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default ExportManager;
