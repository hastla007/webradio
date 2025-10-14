import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Genre, RadioStation } from '../types';
import { getStationLogoUrl } from '../stationLogos';

interface ListenPageProps {
    stations: RadioStation[];
    genres: Genre[];
}

const UNASSIGNED_FILTER = '__unassigned__';

const stationMatchesGenre = (station: RadioStation, filterId: string, map: Record<string, string>) => {
    if (filterId === 'all') {
        return true;
    }

    if (filterId === UNASSIGNED_FILTER) {
        return !station.genreId || !map[station.genreId];
    }

    return station.genreId === filterId;
};

const ListenPage: React.FC<ListenPageProps> = ({ stations, genres }) => {
    const [selectedGenreId, setSelectedGenreId] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentStationId, setCurrentStationId] = useState<string | null>(stations[0]?.id ?? null);
    const [shouldAutoplay, setShouldAutoplay] = useState(false);
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        setCurrentStationId(prev => {
            if (stations.length === 0) {
                return null;
            }

            if (prev && stations.some(station => station.id === prev)) {
                return prev;
            }

            return stations[0].id;
        });
    }, [stations]);

    const genreMap = useMemo(() => {
        const lookup: Record<string, string> = {};
        genres.forEach(genre => {
            lookup[genre.id] = genre.name;
        });
        return lookup;
    }, [genres]);

    const subGenreMap = useMemo(() => {
        const lookup: Record<string, string[]> = {};
        genres.forEach(genre => {
            lookup[genre.id] = genre.subGenres ?? [];
        });
        return lookup;
    }, [genres]);

    const currentStation = useMemo(
        () => stations.find(station => station.id === currentStationId) ?? null,
        [stations, currentStationId]
    );

    const stationsByGenre = useMemo(() => {
        const counts = new Map<string, number>();
        stations.forEach(station => {
            counts.set(station.genreId, (counts.get(station.genreId) ?? 0) + 1);
        });
        return counts;
    }, [stations]);

    const unassignedCount = useMemo(
        () => stations.filter(station => stationMatchesGenre(station, UNASSIGNED_FILTER, genreMap)).length,
        [stations, genreMap]
    );

    const genreFilters = useMemo(
        () =>
            genres
                .map(genre => ({
                    id: genre.id,
                    name: genre.name,
                    count: stationsByGenre.get(genre.id) ?? 0,
                }))
                .sort((a, b) => a.name.localeCompare(b.name)),
        [genres, stationsByGenre]
    );

    const filteredStations = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();

        return stations
            .filter(station => stationMatchesGenre(station, selectedGenreId, genreMap))
            .filter(station => {
                if (!needle) {
                    return true;
                }

                const genreName = genreMap[station.genreId] ?? '';

                const genreSubGenres = subGenreMap[station.genreId] ?? [];
                const stationSubGenres = station.subGenres ?? [];

                return (
                    station.name.toLowerCase().includes(needle) ||
                    genreName.toLowerCase().includes(needle) ||
                    genreSubGenres.some(subGenre => subGenre.toLowerCase().includes(needle)) ||
                    stationSubGenres.some(subGenre => subGenre.toLowerCase().includes(needle)) ||
                    station.tags.some(tag => tag.toLowerCase().includes(needle)) ||
                    station.region.toLowerCase().includes(needle)
                );
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [stations, selectedGenreId, searchTerm, genreMap, subGenreMap]);

    const activeCount = useMemo(() => stations.filter(station => station.isActive).length, [stations]);
    const favoriteCount = useMemo(() => stations.filter(station => station.isFavorite).length, [stations]);
    const genreCoverage = useMemo(() => {
        const coverage = new Set<string>();
        stations.forEach(station => {
            if (genreMap[station.genreId]) {
                coverage.add(station.genreId);
            }
        });
        return coverage.size;
    }, [stations, genreMap]);
    const topGenre = useMemo(() => {
        const sorted = [...genreFilters].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
        return sorted[0];
    }, [genreFilters]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        if (!currentStation) {
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
            return;
        }

        if (audio.src !== currentStation.streamUrl) {
            audio.pause();
            audio.src = currentStation.streamUrl;
            audio.load();
        }

        if (shouldAutoplay) {
            const playPromise = audio.play();
            if (playPromise) {
                playPromise
                    .then(() => {
                        setPlaybackError(null);
                        setShouldAutoplay(false);
                    })
                    .catch(() => {
                        setPlaybackError('Playback was blocked by the browser. Press play to start listening.');
                        setShouldAutoplay(false);
                    });
            } else {
                setShouldAutoplay(false);
            }
        }
    }, [currentStation, shouldAutoplay]);

    const handleStationSelect = (stationId: string) => {
        if (stationId === currentStationId) {
            return;
        }
        setCurrentStationId(stationId);
        setShouldAutoplay(true);
        setPlaybackError(null);
    };

    const handleGenreSelect = (genreId: string) => {
        setSelectedGenreId(genreId);

        if (!currentStation || !stationMatchesGenre(currentStation, genreId, genreMap)) {
            const fallback = stations.find(station => stationMatchesGenre(station, genreId, genreMap)) ?? null;
            setCurrentStationId(fallback ? fallback.id : null);
            setShouldAutoplay(Boolean(fallback));
            setPlaybackError(null);
        }
    };

    const filterButtonClass = (id: string) =>
        `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            selectedGenreId === id
                ? 'border-brand-primary bg-brand-primary/10 text-brand-dark'
                : 'border-brand-border text-brand-text-light hover:border-brand-primary hover:text-brand-dark'
        }`;

    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-brand-dark">Listen</h1>
                <p className="text-brand-text-light">
                    Explore your curated catalogue, discover genres, and listen to live streams directly from the admin panel.
                </p>
            </div>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                <div className="rounded-2xl border border-brand-border bg-white p-6 shadow-sm">
                    {currentStation ? (
                        <div className="flex flex-col gap-6">
                            <div className="flex items-start gap-4">
                                <img
                                    src={getStationLogoUrl(currentStation.logoUrl)}
                                    alt={currentStation.name}
                                    className="h-20 w-20 rounded-2xl object-cover shadow-md"
                                />
                                <div className="space-y-2">
                                    <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-dark">
                                        Now playing
                                    </span>
                                    <h2 className="text-2xl font-semibold text-brand-dark">{currentStation.name}</h2>
                                    <p className="text-sm text-brand-text-light">{currentStation.description}</p>
                                </div>
                            </div>

                            <div className="grid gap-3 text-sm text-brand-text-light sm:grid-cols-2">
                                <div className="rounded-xl border border-brand-border bg-brand-background px-4 py-3">
                                    <p className="text-xs uppercase tracking-wide text-brand-text-light/80">Genre</p>
                                    <p className="mt-1 text-base font-medium text-brand-dark">
                                        {genreMap[currentStation.genreId] ?? 'Unassigned'}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-brand-border bg-brand-background px-4 py-3">
                                    <p className="text-xs uppercase tracking-wide text-brand-text-light/80">Bitrate</p>
                                    <p className="mt-1 text-base font-medium text-brand-dark">{currentStation.bitrate} kbps</p>
                                </div>
                                <div className="rounded-xl border border-brand-border bg-brand-background px-4 py-3">
                                    <p className="text-xs uppercase tracking-wide text-brand-text-light/80">Language</p>
                                    <p className="mt-1 text-base font-medium text-brand-dark">{currentStation.language.toUpperCase()}</p>
                                </div>
                                <div className="rounded-xl border border-brand-border bg-brand-background px-4 py-3">
                                    <p className="text-xs uppercase tracking-wide text-brand-text-light/80">Region</p>
                                    <p className="mt-1 text-base font-medium text-brand-dark">{currentStation.region}</p>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-brand-border bg-brand-background/60 p-4">
                                <audio
                                    ref={audioRef}
                                    controls
                                    className="w-full"
                                    onPlay={() => {
                                        setPlaybackError(null);
                                        setShouldAutoplay(false);
                                    }}
                                    onPause={() => setShouldAutoplay(false)}
                                    onError={() => setPlaybackError('Unable to start playback. Please verify the stream URL.')}
                                />
                                {playbackError && (
                                    <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">
                                        {playbackError}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-brand-text-light">
                            <p className="text-lg font-medium">Add a station to start listening</p>
                            <p className="text-sm">Once stations are available, select one from the list to preview the stream.</p>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-brand-border bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-brand-dark">Station insights</h3>
                    {currentStation ? (
                        <div className="mt-4 space-y-4 text-sm text-brand-text-light">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-brand-text-light/70">Stream URL</p>
                                <a
                                    href={currentStation.streamUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-2 break-all text-brand-primary hover:underline"
                                >
                                    {currentStation.streamUrl}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M12.293 2.293a1 1 0 011.414 0l4 4a1 1 0 01-.707 1.707H15v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h7V3a1 1 0 01.293-.707z" />
                                    </svg>
                                </a>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-brand-text-light/70">Advertising</p>
                                <p className="mt-1 text-brand-dark">{currentStation.imaAdType.toUpperCase()}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-brand-text-light/70">Tags</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {currentStation.tags.length > 0 ? (
                                        currentStation.tags.map(tag => (
                                            <span key={tag} className="rounded-full bg-brand-background px-3 py-1 text-xs uppercase tracking-wide">
                                                #{tag}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs italic">No tags provided</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-brand-text-light/70">Favorite</p>
                                <p className="mt-1 text-brand-dark">{currentStation.isFavorite ? 'Yes' : 'No'}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-sm text-brand-text-light">Select a station to review its metadata and stream settings.</p>
                    )}
                </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm">
                    <p className="text-sm text-brand-text-light">Total stations</p>
                    <p className="mt-2 text-3xl font-semibold text-brand-dark">{stations.length}</p>
                    <p className="mt-1 text-xs text-brand-text-light">{favoriteCount} marked as favorites</p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm">
                    <p className="text-sm text-brand-text-light">Active streams</p>
                    <p className="mt-2 text-3xl font-semibold text-brand-dark">{activeCount}</p>
                    <p className="mt-1 text-xs text-brand-text-light">{stations.length - activeCount} currently disabled</p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm">
                    <p className="text-sm text-brand-text-light">Genres covered</p>
                    <p className="mt-2 text-3xl font-semibold text-brand-dark">{genreCoverage}</p>
                    <p className="mt-1 text-xs text-brand-text-light">{genres.length} total genres configured</p>
                </div>
                <div className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm">
                    <p className="text-sm text-brand-text-light">Most populated genre</p>
                    <p className="mt-2 text-2xl font-semibold text-brand-dark">
                        {topGenre && topGenre.count > 0 ? `${topGenre.name} (${topGenre.count})` : 'No stations yet'}
                    </p>
                    {unassignedCount > 0 ? (
                        <p className="mt-1 text-xs text-amber-600">{unassignedCount} station(s) missing a genre</p>
                    ) : (
                        <p className="mt-1 text-xs text-brand-text-light">All stations are categorised</p>
                    )}
                </div>
            </section>

            <section className="rounded-2xl border border-brand-border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleGenreSelect('all')} className={filterButtonClass('all')}>
                            All stations ({stations.length})
                        </button>
                        {genreFilters.map(genre => (
                            <button
                                key={genre.id}
                                type="button"
                                onClick={() => handleGenreSelect(genre.id)}
                                className={filterButtonClass(genre.id)}
                            >
                                {genre.name}
                                <span className="ml-2 rounded-full bg-brand-background px-2 py-0.5 text-xs text-brand-text-light">
                                    {genre.count}
                                </span>
                            </button>
                        ))}
                        {unassignedCount > 0 && (
                            <button
                                type="button"
                                onClick={() => handleGenreSelect(UNASSIGNED_FILTER)}
                                className={filterButtonClass(UNASSIGNED_FILTER)}
                            >
                                Unassigned
                                <span className="ml-2 rounded-full bg-brand-background px-2 py-0.5 text-xs text-brand-text-light">
                                    {unassignedCount}
                                </span>
                            </button>
                        )}
                    </div>
                    <div className="relative w-full max-w-xs">
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={event => setSearchTerm(event.target.value)}
                            placeholder="Search station, genre, sub-genre, region, or tag"
                            className="w-full rounded-full border border-brand-border bg-brand-background px-4 py-2 text-sm focus:border-brand-primary focus:outline-none"
                        />
                        <svg
                            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-light"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18.5a7.5 7.5 0 006.15-3.85z" />
                        </svg>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredStations.map(station => {
                        const isSelected = station.id === currentStationId;
                        const genreName = genreMap[station.genreId] ?? 'Unassigned';
                        return (
                            <button
                                key={station.id}
                                type="button"
                                onClick={() => handleStationSelect(station.id)}
                                className={`group flex flex-col rounded-2xl border px-5 py-4 text-left shadow-sm transition-all ${
                                    isSelected
                                        ? 'border-brand-primary bg-brand-primary/10 shadow-md'
                                        : 'border-transparent bg-brand-background hover:-translate-y-0.5 hover:border-brand-primary/40 hover:bg-white'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <img
                                        src={getStationLogoUrl(station.logoUrl)}
                                        alt={station.name}
                                        className="h-12 w-12 flex-shrink-0 rounded-xl object-cover shadow-sm"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-brand-dark">{station.name}</p>
                                        <p className="text-xs text-brand-text-light">{genreName}</p>
                                        {station.subGenres.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-brand-text-light">
                                                {station.subGenres.map(subGenre => (
                                                    <span key={subGenre} className="rounded-full bg-white/60 px-2 py-0.5">
                                                        {subGenre}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-brand-text-light">
                                    <span className="rounded-full bg-white/70 px-3 py-1 shadow-sm">{station.bitrate} kbps</span>
                                    <span className="rounded-full bg-white/70 px-3 py-1 shadow-sm">{station.language.toUpperCase()}</span>
                                    <span className="rounded-full bg-white/70 px-3 py-1 shadow-sm">{station.region}</span>
                                </div>
                                {station.tags.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1 text-[11px] text-brand-text-light">
                                        {station.tags.slice(0, 4).map(tag => (
                                            <span key={tag} className="rounded-full bg-white/60 px-2 py-0.5 uppercase tracking-wide">
                                                #{tag}
                                            </span>
                                        ))}
                                        {station.tags.length > 4 && <span className="text-xs">+{station.tags.length - 4} more</span>}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                    {filteredStations.length === 0 && (
                        <div className="col-span-full rounded-2xl border border-dashed border-brand-border p-8 text-center text-brand-text-light">
                            No stations match your filters yet.
                        </div>
                    )}
                </div>
            </section>

        </div>
    );
};

export default ListenPage;
