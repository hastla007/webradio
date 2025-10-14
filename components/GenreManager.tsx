import React, { useMemo, useState } from 'react';
import { Genre } from '../types';
import { PlusIcon, EditIcon, TrashIcon, CloseIcon } from './Icons';
import { useToast, wasToastHandled } from './ToastProvider';

interface GenreManagerProps {
    genres: Genre[];
    onSaveGenre: (genre: Genre) => Promise<void> | void;
    onDeleteGenre: (genreId: string) => Promise<void> | void;
}

const GenreManager: React.FC<GenreManagerProps> = ({ genres, onSaveGenre, onDeleteGenre }) => {
    const [editingGenre, setEditingGenre] = useState<Genre | null>(null);
    const [newGenreName, setNewGenreName] = useState('');
    const [selectedSubGenres, setSelectedSubGenres] = useState<string[]>([]);
    const [newSubGenreInput, setNewSubGenreInput] = useState('');
    const [customSubGenres, setCustomSubGenres] = useState<string[]>([]);
    const { addToast } = useToast();
    const availableSubGenres = useMemo(() => {
        const set = new Set<string>();
        genres.forEach(genre => {
            genre.subGenres.forEach(sub => set.add(sub));
        });
        selectedSubGenres.forEach(sub => set.add(sub));
        customSubGenres.forEach(sub => set.add(sub));
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [genres, selectedSubGenres, customSubGenres]);

    const toggleSubGenre = (subGenre: string) => {
        setSelectedSubGenres(prev => {
            const exists = prev.some(entry => entry.toLowerCase() === subGenre.toLowerCase());
            if (exists) {
                return prev.filter(entry => entry.toLowerCase() !== subGenre.toLowerCase());
            }
            return [...prev, subGenre];
        });
    };

    const handleAddSubGenre = () => {
        const trimmed = newSubGenreInput.trim();
        if (!trimmed) {
            return;
        }
        setCustomSubGenres(prev => {
            if (prev.some(entry => entry.toLowerCase() === trimmed.toLowerCase())) {
                return prev;
            }
            return [...prev, trimmed];
        });
        setSelectedSubGenres(prev => {
            if (prev.some(entry => entry.toLowerCase() === trimmed.toLowerCase())) {
                return prev;
            }
            return [...prev, trimmed];
        });
        setNewSubGenreInput('');
    };

    const handleSave = async () => {
        const trimmedName = newGenreName.trim();
        if (!trimmedName) {
            addToast('Genre name cannot be empty.', { type: 'error' });
            return;
        }
        const genreToSave: Genre = {
            id: editingGenre ? editingGenre.id : `g${Date.now()}`,
            name: trimmedName,
            subGenres: selectedSubGenres,
        };
        try {
            await onSaveGenre(genreToSave);
            setEditingGenre(null);
            setNewGenreName('');
            setSelectedSubGenres([]);
            setCustomSubGenres([]);
            setNewSubGenreInput('');
        } catch (error) {
            console.error('Failed to save genre', error);
            if (!wasToastHandled(error)) {
                addToast('Failed to save genre.', { type: 'error' });
            }
        }
    };

    const handleEdit = (genre: Genre) => {
        setEditingGenre(genre);
        setNewGenreName(genre.name);
        setSelectedSubGenres(genre.subGenres);
        setCustomSubGenres([]);
        setNewSubGenreInput('');
    };

    const handleCancel = () => {
        setEditingGenre(null);
        setNewGenreName('');
        setSelectedSubGenres([]);
        setCustomSubGenres([]);
        setNewSubGenreInput('');
    };

    return (
        <div>
            <header className="flex items-center justify-between mb-8">
                <div>
                <h1 className="text-4xl font-bold text-brand-dark">Manage Genres</h1>
                <p className="text-brand-text-light mt-1">Add, edit, or delete music genres.</p>
                </div>
            </header>
            
            <div className="bg-brand-surface p-6 rounded-2xl shadow-sm border border-brand-border">
                <h2 className="text-xl font-bold mb-4">{editingGenre ? 'Edit Genre' : 'Add New Genre'}</h2>
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                            <label className="text-sm font-semibold text-brand-dark" htmlFor="genre-name">
                                Genre name
                            </label>
                            <input
                                id="genre-name"
                                type="text"
                                placeholder="Enter genre name"
                                value={newGenreName}
                                onChange={e => setNewGenreName(e.target.value)}
                                className="w-full px-4 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-brand-dark" htmlFor="genre-subgenres">
                                Sub-genres
                            </label>
                            <div className="flex gap-2">
                                <input
                                    id="genre-subgenres"
                                    type="text"
                                    placeholder="Add a new sub-genre"
                                    value={newSubGenreInput}
                                    onChange={e => setNewSubGenreInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddSubGenre();
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddSubGenre}
                                    className="px-4 py-2 bg-brand-dark text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                            {availableSubGenres.length > 0 ? (
                                <div className="max-h-40 overflow-y-auto border border-brand-border rounded-lg p-3 flex flex-wrap gap-3 bg-white">
                                    {availableSubGenres.map(subGenre => {
                                        const checked = selectedSubGenres.some(entry => entry.toLowerCase() === subGenre.toLowerCase());
                                        return (
                                            <label
                                                key={subGenre}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 border border-brand-border rounded-lg text-sm text-brand-dark bg-white hover:border-brand-primary transition-colors"
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
                            ) : (
                                <p className="text-xs text-brand-text-light">Start by adding a sub-genre above.</p>
                            )}
                            <p className="text-xs text-brand-text-light">
                                Tip: add a new sub-genre, then use the checkboxes to include it in this genre.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start md:self-auto">
                        {editingGenre && (
                            <button
                                onClick={handleCancel}
                                className="p-2.5 text-brand-text-light hover:bg-gray-100 rounded-lg transition-colors"
                                aria-label="Cancel editing genre"
                            >
                                <CloseIcon />
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            className="flex items-center bg-brand-dark text-white font-semibold px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                           {editingGenre ? 'Save Changes' : <> <PlusIcon /><span className="ml-2">Add Genre</span></>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-brand-surface p-6 rounded-2xl shadow-sm border border-brand-border">
                <h2 className="text-xl font-bold mb-4">Existing Genres</h2>
                <ul className="space-y-2">
                    {genres.map(genre => (
                        <li key={genre.id} className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-gray-50">
                            <div>
                                <span className="font-medium text-brand-dark">{genre.name}</span>
                                {genre.subGenres.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {genre.subGenres.map(subGenre => (
                                            <span
                                                key={subGenre}
                                                className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-dark"
                                            >
                                                {subGenre}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="space-x-2">
                                <button onClick={() => handleEdit(genre)} className="p-2 text-brand-text-light hover:bg-gray-100 rounded-lg transition-colors">
                                    <EditIcon />
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await onDeleteGenre(genre.id);
                                        } catch (error) {
                                            console.error('Failed to delete genre', error);
                                        }
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <TrashIcon />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                {genres.length === 0 && (
                    <p className="text-center py-8 text-brand-text-light">No genres have been added yet.</p>
                )}
            </div>
        </div>
    );
}

export default GenreManager;
