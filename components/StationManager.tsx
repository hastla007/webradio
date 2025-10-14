import React, { useState, useMemo, useRef } from 'react';
import { RadioStation, Genre, MonitoringStatus, ImaAdType } from '../types';
import StationFormModal from './StationFormModal';
import { PlusIcon, EditIcon, TrashIcon, UploadIcon } from './Icons';
import { getStationLogoUrl, normalizeStationLogo } from '../stationLogos';

interface StationManagerProps {
    stations: RadioStation[];
    genres: Genre[];
    monitoringStatus: Record<string, MonitoringStatus>;
    onSaveStation: (station: RadioStation) => Promise<void> | void;
    onDeleteStation: (stationId: string) => Promise<void> | void;
    onImportStations: (stations: RadioStation[]) => Promise<void> | void;
}

const UptimeBar: React.FC<{ history: number[] | undefined }> = ({ history = [] }) => {
    const barCount = 40;
    const bars = [...history].reverse().slice(0, barCount);
    while (bars.length < barCount) {
        bars.push(-1);
    }

    return (
        <div className="flex items-center gap-px h-5">
            {bars.map((result, index) => {
                let colorClass = 'bg-gray-200 dark:bg-gray-600';
                if (result === 1) colorClass = 'bg-green-500';
                if (result === 0) colorClass = 'bg-red-500';
                return <div key={index} className={`w-1.5 h-full rounded-sm ${colorClass}`}></div>;
            })}
        </div>
    );
};


const StationManager: React.FC<StationManagerProps> = ({ stations, genres, monitoringStatus, onSaveStation, onDeleteStation, onImportStations }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStation, setEditingStation] = useState<RadioStation | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGenre, setFilterGenre] = useState<string>('all');
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleAddNew = () => {
        setEditingStation(null);
        setIsModalOpen(true);
    };

    const handleEdit = (station: RadioStation) => {
        setEditingStation(station);
        setIsModalOpen(true);
    };
    
    const handleSave = async (station: RadioStation) => {
        try {
            await onSaveStation(station);
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to save station', error);
        }
    };

    const handleDelete = async (stationId: string) => {
        try {
            await onDeleteStation(stationId);
        } catch (error) {
            console.error('Failed to delete station', error);
        }
    };

    const filteredStations = useMemo(() => {
        const normalizedQuery = searchTerm.trim().toLowerCase();

        return stations.filter(station => {
            const genre = genres.find(g => g.id === station.genreId);
            const matchesSearch =
                normalizedQuery === '' ||
                station.name.toLowerCase().includes(normalizedQuery) ||
                station.description.toLowerCase().includes(normalizedQuery) ||
                station.language.toLowerCase().includes(normalizedQuery) ||
                station.region.toLowerCase().includes(normalizedQuery) ||
                station.tags.some(tag => tag.toLowerCase().includes(normalizedQuery)) ||
                station.subGenres.some(subGenre => subGenre.toLowerCase().includes(normalizedQuery)) ||
                genre?.name.toLowerCase().includes(normalizedQuery);

            const matchesGenre = filterGenre === 'all' || station.genreId === filterGenre;

            return matchesSearch && matchesGenre;
        });
    }, [stations, genres, searchTerm, filterGenre]);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const normaliseImaAdType = (value: unknown): ImaAdType => {
        if (typeof value !== 'string') return 'no';
        const normalised = value.toLowerCase();
        return normalised === 'audio' || normalised === 'video' ? normalised : 'no';
    };

    const parseTags = (value: unknown): string[] => {
        if (Array.isArray(value)) {
            return value
                .map(tag => (typeof tag === 'string' ? tag : String(tag)))
                .map(tag => tag.trim())
                .filter(Boolean);
        }

        if (typeof value === 'string') {
            return value
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean);
        }

        return [];
    };

    const parseSubGenres = (genreId: string, value: unknown): string[] => {
        if (!genreId) {
            return [];
        }

        const genre = genres.find(g => g.id === genreId);
        if (!genre || !Array.isArray(genre.subGenres) || genre.subGenres.length === 0) {
            return [];
        }

        const canonicalMap = new Map<string, string>();
        genre.subGenres
            .map(subGenre => subGenre.trim())
            .filter(Boolean)
            .forEach(subGenre => {
                canonicalMap.set(subGenre.toLowerCase(), subGenre);
            });

        if (canonicalMap.size === 0) {
            return [];
        }

        const candidates = Array.isArray(value)
            ? value
            : typeof value === 'string'
            ? value.split(',')
            : [];

        const normalized = candidates
            .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
            .filter(Boolean)
            .map(entry => canonicalMap.get(entry.toLowerCase()))
            .filter((entry): entry is string => Boolean(entry));

        return Array.from(new Set(normalized));
    };

    const parseBoolean = (value: unknown, defaultValue: boolean): boolean => {
        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'string') {
            const normalised = value.trim().toLowerCase();
            if (normalised === 'true') return true;
            if (normalised === 'false') return false;
        }

        if (typeof value === 'number') {
            if (value === 1) return true;
            if (value === 0) return false;
        }

        return defaultValue;
    };

    const resolveGenreId = (rawGenre: unknown, rawGenreId: unknown): string => {
        if (typeof rawGenreId === 'string' && rawGenreId.trim().length > 0) {
            const candidate = genres.find(g => g.id === rawGenreId.trim());
            if (candidate) return candidate.id;
        }

        if (typeof rawGenre === 'string' && rawGenre.trim().length > 0) {
            const match = genres.find(g => g.name.toLowerCase() === rawGenre.trim().toLowerCase());
            if (match) {
                return match.id;
            }
        }

        return '';
    };

    const buildStationFromEntry = (entry: unknown, index: number): RadioStation => {
        if (!entry || typeof entry !== 'object') {
            throw new Error('Station entry must be an object.');
        }

        const raw = entry as Record<string, unknown>;
        const name = typeof raw.name === 'string' ? raw.name.trim() : '';
        if (!name) {
            throw new Error('Station name is required.');
        }

        const streamUrlCandidate =
            typeof raw.streamUrl === 'string' && raw.streamUrl.trim()
                ? raw.streamUrl.trim()
                : typeof raw.url === 'string' && raw.url.trim()
                ? raw.url.trim()
                : '';

        if (!streamUrlCandidate) {
            throw new Error('Stream URL is required.');
        }

        const genreId = resolveGenreId(raw.genre, raw.genreId);
        if (!genreId) {
            throw new Error('Genre not found in your catalogue.');
        }

        const idValue = raw.id ?? `import-${Date.now()}-${index}`;
        const description = typeof raw.description === 'string' ? raw.description : '';
        const logoUrl =
            typeof raw.logoUrl === 'string' && raw.logoUrl.trim()
                ? raw.logoUrl.trim()
                : typeof raw.logo === 'string' && raw.logo.trim()
                ? raw.logo.trim()
                : `https://picsum.photos/seed/${Date.now() + index}/100`;
        const subGenres = parseSubGenres(genreId, raw.subGenres ?? raw.subgenres ?? []);
        const bitrate = Number(raw.bitrate);
        const language = typeof raw.language === 'string' && raw.language.trim() ? raw.language.trim() : 'en';
        const region = typeof raw.region === 'string' && raw.region.trim() ? raw.region.trim() : 'Global';
        const isFavorite = parseBoolean(raw.isFavorite, false);
        const isActive = parseBoolean(raw.isActive, true);
        const imaAdType = normaliseImaAdType(raw.imaAdType);

        const builtStation: RadioStation = {
            id: typeof idValue === 'string' ? idValue : String(idValue),
            name,
            streamUrl: streamUrlCandidate,
            description,
            genreId,
            subGenres,
            logoUrl,
            bitrate: Number.isFinite(bitrate) ? bitrate : 128,
            language,
            region,
            tags: parseTags(raw.tags),
            imaAdType,
            isActive,
            isFavorite,
        };

        return normalizeStationLogo(builtStation);
    };

    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        setIsImporting(true);

        try {
            const text = await file.text();
            let parsed: unknown;

            try {
                parsed = JSON.parse(text);
            } catch (error) {
                throw new Error('The selected file does not contain valid JSON.');
            }

            const entries = Array.isArray(parsed)
                ? parsed
                : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as Record<string, unknown>).stations)
                ? (parsed as Record<string, unknown>).stations as unknown[]
                : null;

            if (!entries) {
                throw new Error('JSON must be an array of stations or an object with a "stations" array.');
            }

            const importedStations: RadioStation[] = [];
            const errors: string[] = [];

            entries.forEach((entry, index) => {
                try {
                    const station = buildStationFromEntry(entry, index);
                    importedStations.push(station);
                } catch (error) {
                    errors.push(error instanceof Error ? error.message : 'Unknown error while parsing station.');
                }
            });

            if (importedStations.length === 0) {
                const message = errors.length > 0 ? errors.join('\n') : 'No stations were found in the file.';
                throw new Error(message);
            }

            await onImportStations(importedStations);

            let successMessage = `Successfully imported ${importedStations.length} station${importedStations.length === 1 ? '' : 's'}.`;
            if (errors.length > 0) {
                const truncated = errors.slice(0, 5).join('\n• ');
                successMessage += `\n\n${errors.length} entr${errors.length === 1 ? 'y was' : 'ies were'} skipped:\n• ${truncated}`;
            }

            alert(successMessage);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to import stations.';
            alert(message);
        } finally {
            setIsImporting(false);
            event.target.value = '';
        }
    };

    return (
        <div className="dark:text-dark-text">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between md:space-y-0 space-y-4 mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-brand-dark dark:text-dark-text">Radio Stations</h1>
                    <p className="text-brand-text-light dark:text-dark-text-light mt-1">Browse, add, import, and manage your radio stations.</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 space-y-3 sm:space-y-0">
                    <button
                        type="button"
                        onClick={handleImportClick}
                        disabled={isImporting}
                        className="flex items-center justify-center border border-brand-border dark:border-dark-border text-brand-dark dark:text-dark-text px-5 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                        <UploadIcon />
                        <span className="ml-2">Import Stations</span>
                    </button>
                    <button
                        onClick={handleAddNew}
                        className="flex items-center bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <PlusIcon />
                        <span className="ml-2">Add New Station</span>
                    </button>
                </div>
            </header>

            <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleFileImport}
            />
            
            <div className="bg-brand-surface dark:bg-dark-surface p-6 rounded-2xl shadow-sm border border-brand-border dark:border-dark-border">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        <input 
                            type="text"
                            placeholder="Search stations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-72 px-4 py-2 border border-brand-border dark:border-dark-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none bg-transparent"
                        />
                         <select 
                            value={filterGenre} 
                            onChange={(e) => setFilterGenre(e.target.value)}
                            className="px-4 py-2 border border-brand-border dark:border-dark-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none bg-brand-surface dark:bg-dark-surface"
                        >
                            <option value="all">All Genres</option>
                            {genres.map(genre => (
                                <option key={genre.id} value={genre.id}>{genre.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-brand-border dark:border-dark-border">
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light">Station</th>
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light">Status</th>
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light">Genre</th>
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light">Bitrate</th>
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light">Language</th>
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light">Region</th>
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light">IMA Ads</th>
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light">Tags</th>
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light">Recent Uptime</th>
                                <th className="p-3 font-semibold text-brand-text-light dark:text-dark-text-light text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStations.map(station => (
                                <tr
                                    key={station.id}
                                    onClick={() => handleEdit(station)}
                                    className="border-b border-brand-border dark:border-dark-border last:border-b-0 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                                >
                                    <td className="p-3 align-middle">
                                        <div className="flex items-center space-x-3">
                                            <img
                                                src={getStationLogoUrl(station.logoUrl)}
                                                alt={station.name}
                                                className="w-10 h-10 rounded-md object-cover"
                                            />
                                            <span className="font-medium text-brand-dark dark:text-dark-text flex items-center gap-2">
                                                {station.name}
                                                {station.isFavorite && (
                                                    <span className="text-yellow-500 text-xs font-semibold uppercase tracking-wide">Fav</span>
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3 align-middle">
                                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${station.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'}`}>
                                            {station.isActive ? 'Active' : 'Deactivated'}
                                        </span>
                                    </td>
                                    <td className="p-3 align-middle text-brand-text-light dark:text-dark-text-light">
                                        <div>{genres.find(g => g.id === station.genreId)?.name || 'N/A'}</div>
                                        {station.subGenres.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {station.subGenres.map(subGenre => (
                                                    <span
                                                        key={subGenre}
                                                        className="px-2 py-0.5 text-[11px] rounded-full bg-brand-primary/10 text-brand-dark"
                                                    >
                                                        {subGenre}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 align-middle text-brand-text-light dark:text-dark-text-light">{station.bitrate} kbps</td>
                                    <td className="p-3 align-middle text-brand-text-light dark:text-dark-text-light">{station.language.toUpperCase()}</td>
                                    <td className="p-3 align-middle text-brand-text-light dark:text-dark-text-light">{station.region}</td>
                                    <td className="p-3 align-middle text-brand-text-light dark:text-dark-text-light capitalize">{station.imaAdType}</td>
                                    <td className="p-3 align-middle">
                                        <div className="flex flex-wrap gap-1">
                                            {station.tags.map(tag => (
                                                <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-brand-primary/20 text-brand-dark">
                                                    {tag}
                                                </span>
                                            ))}
                                            {station.tags.length === 0 && <span className="text-xs text-brand-text-light">—</span>}
                                        </div>
                                    </td>
                                    <td className="p-3 align-middle">
                                        <UptimeBar history={monitoringStatus[station.id]?.history} />
                                    </td>
                                    <td className="p-3 align-middle text-right">
                                        <div className="inline-flex space-x-2">
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleEdit(station);
                                                }}
                                                className="p-2 text-brand-text-light dark:text-dark-text-light hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                <EditIcon />
                                            </button>
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleDelete(station.id);
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredStations.length === 0 && (
                    <div className="text-center py-16 text-brand-text-light dark:text-dark-text-light">
                        <p>No radio stations found matching your criteria.</p>
                    </div>
                )}
            </div>
            
            {isModalOpen && (
                <StationFormModal
                    station={editingStation}
                    genres={genres}
                    onSave={handleSave}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

export default StationManager;