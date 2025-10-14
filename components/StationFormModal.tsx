import React, { useState, useEffect, useMemo } from 'react';
import { RadioStation, Genre } from '../types';
import { CloseIcon } from './Icons';
import { getStationLogoUrl, isPlaceholderLogo, suggestLogoForStation } from '../stationLogos';
import { useToast, wasToastHandled } from './ToastProvider';

interface StationFormModalProps {
  station: RadioStation | null;
  genres: Genre[];
  onSave: (station: RadioStation) => Promise<void> | void;
  onClose: () => void;
}

const defaultFormState = (firstGenreId: string | undefined): Omit<RadioStation, 'id'> => ({
  name: '',
  streamUrl: '',
  description: '',
  genreId: firstGenreId || '',
  subGenres: [],
  logoUrl: '',
  bitrate: 128,
  language: 'en',
  region: 'Global',
  tags: [],
  imaAdType: 'no',
  isActive: true,
  isFavorite: false,
});

const StationFormModal: React.FC<StationFormModalProps> = ({ station, genres, onSave, onClose }) => {
  const [formData, setFormData] = useState<Omit<RadioStation, 'id'>>(defaultFormState(genres[0]?.id));
  const [tagsInput, setTagsInput] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    if (station) {
      const { id: _id, ...rest } = station;
      setFormData({ ...rest });
      setTagsInput(station.tags.join(', '));
    } else {
      const initialState = defaultFormState(genres[0]?.id);
      setFormData(initialState);
      setTagsInput('');
    }
  }, [station, genres]);

  const availableSubGenres = useMemo(() => {
    const genre = genres.find(g => g.id === formData.genreId);
    return genre?.subGenres ?? [];
  }, [genres, formData.genreId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;

    if (name === 'name') {
      const suggestion = suggestLogoForStation(value);
      setFormData(prev => {
        const next = { ...prev, name: value };
        if (suggestion && (isPlaceholderLogo(prev.logoUrl) || prev.logoUrl === '')) {
          next.logoUrl = suggestion;
        }
        return next;
      });
      return;
    }

    if (name === 'genreId') {
      const nextGenreId = value;
      const allowedSubGenres = new Set(
        (genres.find(g => g.id === nextGenreId)?.subGenres ?? []).map(sub => sub.toLowerCase())
      );
      setFormData(prev => ({
        ...prev,
        genreId: nextGenreId,
        subGenres: prev.subGenres.filter(sub => allowedSubGenres.has(sub.toLowerCase())),
      }));
      return;
    }

    if (type === 'number') {
      const parsed = Number(value);
      setFormData(prev => ({ ...prev, [name]: Number.isFinite(parsed) ? parsed : 0 }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSubGenre = (subGenre: string) => {
    setFormData(prev => {
      const canonical = subGenre;
      const exists = prev.subGenres.some(entry => entry.toLowerCase() === canonical.toLowerCase());
      const nextSubGenres = exists
        ? prev.subGenres.filter(entry => entry.toLowerCase() !== canonical.toLowerCase())
        : [...prev.subGenres, canonical];
      return { ...prev, subGenres: nextSubGenres };
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    const parsedTags = value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    setFormData(prev => ({ ...prev, tags: parsedTags }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.streamUrl || !formData.genreId) {
        addToast('Please fill in all required fields: Name, Stream URL, and Genre.', { type: 'error' });
        return;
    }
    const newStation: RadioStation = {
      id: station?.id || `s${Date.now()}`,
      ...formData,
    };
    try {
      await onSave(newStation);
    } catch (error) {
      console.error('Failed to save station', error);
      if (!wasToastHandled(error)) {
        addToast('Failed to save station.', { type: 'error' });
      }
    }
  };
  
  const handleGenerateLogo = () => {
    const suggestion = suggestLogoForStation(formData.name);
    const fallback = suggestion || `https://picsum.photos/seed/${Date.now()}/100`;
    setFormData(prev => ({ ...prev, logoUrl: fallback }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-surface rounded-2xl w-full max-w-lg shadow-xl relative animate-fade-in-up max-h-[85vh] flex flex-col overflow-hidden px-8 pt-8 pb-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-brand-text-light hover:bg-gray-100 rounded-full">
            <CloseIcon />
        </button>
        <h2 className="text-2xl font-bold mb-6 pr-8">{station ? 'Edit Station' : 'Add New Station'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <div className="space-y-4 pr-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-brand-text-light mb-1">Station Name</label>
              <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
            </div>
            <div>
              <label htmlFor="streamUrl" className="block text-sm font-medium text-brand-text-light mb-1">Stream URL</label>
              <input type="url" name="streamUrl" id="streamUrl" value={formData.streamUrl} onChange={handleChange} required className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-brand-text-light mb-1">Description</label>
              <textarea name="description" id="description" value={formData.description} onChange={handleChange} rows={3} className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bitrate" className="block text-sm font-medium text-brand-text-light mb-1">Bitrate (kbps)</label>
                <input type="number" min={32} step={32} name="bitrate" id="bitrate" value={formData.bitrate} onChange={handleChange} required className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
              </div>
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-brand-text-light mb-1">Language</label>
                <input type="text" name="language" id="language" value={formData.language} onChange={handleChange} required className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
              </div>
              <div>
                <label htmlFor="region" className="block text-sm font-medium text-brand-text-light mb-1">Region</label>
                <input type="text" name="region" id="region" value={formData.region} onChange={handleChange} required className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
              </div>
              <div>
                <label htmlFor="imaAdType" className="block text-sm font-medium text-brand-text-light mb-1">IMA Ad Type</label>
                <select name="imaAdType" id="imaAdType" value={formData.imaAdType} onChange={handleChange} className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none bg-white">
                  <option value="no">No Ads</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                </select>
              </div>
            </div>
            <div className="flex items-end space-x-4">
                <div className="flex-grow">
                    <label htmlFor="logoUrl" className="block text-sm font-medium text-brand-text-light mb-1">Logo URL</label>
                    <input type="url" name="logoUrl" id="logoUrl" value={formData.logoUrl} onChange={handleChange} className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"/>
                </div>
                <img src={getStationLogoUrl(formData.logoUrl)} alt="logo preview" className="w-12 h-12 rounded-md object-cover" />
                <button type="button" onClick={handleGenerateLogo} className="px-4 py-2 border border-brand-border rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors">Generate</button>
            </div>
            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-brand-text-light mb-1">Tags</label>
              <input
                type="text"
                name="tags"
                id="tags"
                value={tagsInput}
                onChange={(e) => handleTagsChange(e.target.value)}
                placeholder="ambient, chillout, downtempo"
                className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-brand-text-light">Separate tags with commas.</p>
            </div>
            <div>
              <label htmlFor="genreId" className="block text-sm font-medium text-brand-text-light mb-1">Genre</label>
              <select name="genreId" id="genreId" value={formData.genreId} onChange={handleChange} required className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none bg-white">
                {genres.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            {availableSubGenres.length > 0 && (
              <div>
                <span className="block text-sm font-medium text-brand-text-light mb-1">Sub-genres</span>
                <div className="flex flex-wrap gap-3">
                  {availableSubGenres.map(subGenre => {
                    const checked = formData.subGenres.some(entry => entry.toLowerCase() === subGenre.toLowerCase());
                    return (
                      <label
                        key={subGenre}
                        className="inline-flex items-center gap-2 px-3 py-2 border border-brand-border rounded-lg text-sm text-brand-dark bg-white hover:border-brand-primary transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                          checked={checked}
                          onChange={() => toggleSubGenre(subGenre)}
                        />
                        <span>{subGenre}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center space-x-3">
                <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                <span className="text-sm font-medium text-brand-text-light">Station is active</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="checkbox" name="isFavorite" checked={formData.isFavorite} onChange={handleCheckboxChange} className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary" />
                <span className="text-sm font-medium text-brand-text-light">Mark as favorite in exports</span>
              </label>
            </div>
          </div>
          </div>
          <div className="mt-8 flex justify-end space-x-3 pt-4 border-t border-brand-border bg-brand-surface">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-brand-border text-brand-dark font-semibold rounded-lg hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 bg-brand-dark text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">
              Save Station
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StationFormModal;
