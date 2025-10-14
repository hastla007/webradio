
import React from 'react';
import { RadioStation, Genre } from '../types';
import { EditIcon, TrashIcon } from './Icons';
import { getStationLogoUrl } from '../stationLogos';

interface StationCardProps {
  station: RadioStation;
  genre: Genre | undefined;
  onEdit: (station: RadioStation) => void;
  onDelete: (stationId: string) => void;
}

const StationCard: React.FC<StationCardProps> = ({ station, genre, onEdit, onDelete }) => {
  return (
    <div className="bg-brand-surface p-4 rounded-2xl shadow-sm border border-brand-border flex items-center space-x-4 hover:shadow-md transition-shadow">
      <img src={getStationLogoUrl(station.logoUrl)} alt={station.name} className="w-20 h-20 rounded-lg object-cover" />
      <div className="flex-grow">
        <h3 className="font-bold text-lg text-brand-dark">{station.name}</h3>
        <p className="text-sm text-brand-text-light">{station.description}</p>
        <div className="mt-2">
            <span className="text-xs font-semibold bg-brand-primary-light text-brand-primary-dark py-1 px-2 rounded-full">{genre?.name || 'Uncategorized'}</span>
            {station.subGenres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
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
        </div>
      </div>
      <div className="flex flex-col space-y-2">
        <button onClick={() => onEdit(station)} className="p-2 text-brand-text-light hover:bg-gray-100 rounded-lg transition-colors">
            <EditIcon />
        </button>
        <button onClick={() => onDelete(station.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <TrashIcon />
        </button>
      </div>
    </div>
  );
};

export default StationCard;
