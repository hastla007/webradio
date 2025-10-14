import React, { useState, useEffect, useMemo } from 'react';
import { ExportProfile, Genre, RadioStation, AutoExportConfig, PlayerApp } from '../types';
import { CloseIcon } from './Icons';

interface ExportProfileFormModalProps {
  profile: ExportProfile | null;
  genres: Genre[];
  stations: RadioStation[];
  playerApps: PlayerApp[];
  playerAssignments: Record<string, { profileId: string; profileName: string }>;
  onSave: (profile: ExportProfile) => Promise<void> | void;
  onClose: () => void;
}

const ExportProfileFormModal: React.FC<ExportProfileFormModalProps> = ({
  profile,
  genres,
  stations,
  playerApps,
  playerAssignments,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [selectedStationIds, setSelectedStationIds] = useState<string[]>([]);
  const [selectedSubGenres, setSelectedSubGenres] = useState<string[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [autoExportConfig, setAutoExportConfig] = useState<AutoExportConfig>({
    enabled: false,
    interval: 'daily',
    time: '09:00',
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setSelectedGenreIds(profile.genreIds);
      setSelectedStationIds(profile.stationIds);
      setSelectedSubGenres(profile.subGenres ?? []);
      setSelectedPlayerId(profile.playerId || '');
      if (profile.autoExport) {
        setAutoExportConfig(profile.autoExport);
      }
    } else {
      setName('');
      setSelectedGenreIds([]);
      setSelectedStationIds([]);
      setSelectedSubGenres([]);
      setSelectedPlayerId('');
      setAutoExportConfig({ enabled: false, interval: 'daily', time: '09:00' });
    }
  }, [profile]);

  const handleGenreChange = (genreId: string) => {
    setSelectedGenreIds(prev => {
      const next = prev.includes(genreId)
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId];
      const relevantGenres = next.length > 0 ? genres.filter(g => next.includes(g.id)) : genres;
      const allowed = new Set<string>();
      relevantGenres.forEach(genre => {
        genre.subGenres.forEach(sub => allowed.add(sub.toLowerCase()));
      });
      setSelectedSubGenres(prevSubs => {
        if (allowed.size === 0) {
          return prevSubs;
        }
        return prevSubs.filter(sub => allowed.has(sub.toLowerCase()));
      });
      return next;
    });
  };

  const handleStationChange = (stationId: string) => {
    setSelectedStationIds(prev =>
      prev.includes(stationId)
        ? prev.filter(id => id !== stationId)
        : [...prev, stationId]
    );
  };

  const availableSubGenres = useMemo(() => {
    const relevantGenres = selectedGenreIds.length > 0
      ? genres.filter(genre => selectedGenreIds.includes(genre.id))
      : genres;
    const set = new Set<string>();
    relevantGenres.forEach(genre => {
      genre.subGenres.forEach(sub => set.add(sub));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [genres, selectedGenreIds]);

  const handleSubGenreChange = (subGenre: string) => {
    setSelectedSubGenres(prev => {
      const exists = prev.some(entry => entry.toLowerCase() === subGenre.toLowerCase());
      if (exists) {
        return prev.filter(entry => entry.toLowerCase() !== subGenre.toLowerCase());
      }
      return [...prev, subGenre];
    });
  };

  const handleAutoExportChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isChecked = (e.target as HTMLInputElement).checked;

    setAutoExportConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? isChecked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please provide a name for the export profile.');
      return;
    }

    const newProfile: ExportProfile = {
      id: profile?.id || `ep${Date.now()}`,
      name,
      genreIds: selectedGenreIds,
      stationIds: selectedStationIds,
      subGenres: selectedSubGenres,
      playerId: selectedPlayerId || null,
      autoExport: autoExportConfig,
    };

    try {
      await onSave(newProfile);
    } catch (error) {
      console.error('Failed to save export profile', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-surface rounded-2xl w-full max-w-3xl shadow-xl relative animate-fade-in-up max-h-[90vh] p-8 flex flex-col">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-brand-text-light hover:bg-gray-100 rounded-full">
          <CloseIcon />
        </button>
        <h2 className="text-2xl font-bold mb-6 pr-12">{profile ? 'Edit Export Profile' : 'Create Export Profile'}</h2>
        <form onSubmit={handleSubmit} className="flex-grow flex flex-col min-h-0">
          <div className="flex-grow overflow-y-auto pr-2 space-y-6 pb-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-brand-text-light mb-1">Profile Name</label>
              <input
                type="text"
                name="name"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="player" className="block text-sm font-medium text-brand-text-light mb-1">Connected App/Player</label>
              <select
                id="player"
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none bg-white"
              >
                <option value="">No app linked</option>
                {playerApps.map(app => {
                  const assignment = playerAssignments[app.id];
                  const isAssignedToOther = assignment && assignment.profileId !== (profile?.id ?? '');
                  return (
                    <option key={app.id} value={app.id} disabled={isAssignedToOther}>
                      {app.name}
                      {isAssignedToOther ? ` — assigned to ${assignment.profileName}` : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-brand-text-light mt-2">
                Link this profile to a player app so exports can be tied to a specific deployment target.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="min-h-0">
                <h3 className="font-semibold mb-2">Select Genres</h3>
                <div className="border border-brand-border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                  {genres.map(genre => (
                    <label key={genre.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedGenreIds.includes(genre.id)}
                        onChange={() => handleGenreChange(genre.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <span>{genre.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="min-h-0">
                <h3 className="font-semibold mb-2">Select Sub-genres</h3>
                <div className="border border-brand-border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2 bg-white">
                  {availableSubGenres.length > 0 ? (
                    availableSubGenres.map(subGenre => {
                      const checked = selectedSubGenres.some(entry => entry.toLowerCase() === subGenre.toLowerCase());
                      return (
                        <label key={subGenre} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleSubGenreChange(subGenre)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                          />
                          <span>{subGenre}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-brand-text-light">Select a genre to see its sub-genres.</p>
                  )}
                </div>
              </div>
              <div className="min-h-0">
                <h3 className="font-semibold mb-2">Select Individual Stations</h3>
                <div className="border border-brand-border rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                  {stations.map(station => (
                    <label key={station.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStationIds.includes(station.id)}
                        onChange={() => handleStationChange(station.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <span>{station.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <fieldset className="border-t border-brand-border pt-4">
              <legend className="text-lg font-semibold mb-2 text-brand-dark">Auto-Export</legend>
              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={autoExportConfig.enabled}
                    onChange={handleAutoExportChange}
                    className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="font-medium">Enable Auto-Export</span>
                </label>

                {autoExportConfig.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-7 animate-fade-in-up">
                    <div>
                      <label htmlFor="interval" className="block text-sm font-medium text-brand-text-light mb-1">Frequency</label>
                      <select
                        name="interval"
                        id="interval"
                        value={autoExportConfig.interval}
                        onChange={handleAutoExportChange}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none bg-white"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="time" className="block text-sm font-medium text-brand-text-light mb-1">Time</label>
                      <input
                        type="time"
                        name="time"
                        id="time"
                        value={autoExportConfig.time}
                        onChange={handleAutoExportChange}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </fieldset>
          </div>
          <div className="mt-8 flex justify-end space-x-3 pt-4 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-brand-border text-brand-dark font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-brand-dark text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExportProfileFormModal;
