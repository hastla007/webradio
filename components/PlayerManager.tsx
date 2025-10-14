import React, { useState } from 'react';
import { ExportProfile, PlayerApp } from '../types';
import PlayerFormModal from './PlayerFormModal';
import { PlusIcon, EditIcon, TrashIcon } from './Icons';

interface PlayerManagerProps {
  apps: PlayerApp[];
  profiles: ExportProfile[];
  onSaveApp: (app: PlayerApp) => Promise<void> | void;
  onDeleteApp: (appId: string) => Promise<void> | void;
}

const PlayerManager: React.FC<PlayerManagerProps> = ({ apps, profiles, onSaveApp, onDeleteApp }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<PlayerApp | null>(null);

  const handleAddNew = () => {
    setEditingApp(null);
    setIsModalOpen(true);
  };

  const handleEdit = (app: PlayerApp) => {
    setEditingApp(app);
    setIsModalOpen(true);
  };

  const handleSave = async (app: PlayerApp) => {
    try {
      await onSaveApp(app);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save player app', error);
    }
  };

  const handleDelete = async (appId: string) => {
    try {
      await onDeleteApp(appId);
    } catch (error) {
      console.error('Failed to delete player app', error);
    }
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-brand-dark">Apps / Players</h1>
          <p className="text-brand-text-light mt-1">Manage the player applications that consume exported station catalogs.</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center bg-brand-dark text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <PlusIcon />
          <span className="ml-2">Create App</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map(app => {
          const linkedProfile = profiles.find(profile => profile.playerId === app.id);

          return (
            <div key={app.id} className="bg-brand-surface p-6 rounded-2xl shadow-sm border border-brand-border flex flex-col">
              <div className="flex-grow space-y-3">
                <div>
                  <h3 className="text-xl font-bold text-brand-dark">{app.name}</h3>
                  <p className="text-sm text-brand-text-light">
                    Platforms: {(app.platforms?.length ? app.platforms : app.platform ? [app.platform] : [])
                      .join(', ') || 'Not specified'}
                  </p>
                </div>
                {app.description && <p className="text-sm text-brand-text-light leading-relaxed">{app.description}</p>}
                {app.contactEmail && (
                  <p className="text-sm text-brand-text-light">
                    <span className="font-semibold text-brand-dark">Contact:</span> {app.contactEmail}
                  </p>
                )}
                <div className="text-sm">
                  <p className="font-semibold text-brand-dark">Linked profile</p>
                  <p className="text-brand-text-light">{linkedProfile ? linkedProfile.name : 'No profile linked'}</p>
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-brand-dark">FTP export</p>
                  {app.ftpEnabled ? (
                    <p className="text-brand-text-light">{app.ftpServer || 'Configured'} as {app.ftpUsername}</p>
                  ) : (
                    <p className="text-brand-text-light">Disabled</p>
                  )}
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-brand-dark">Ad Manager</p>
                  {app.imaEnabled === false ? (
                    <div className="text-brand-text-light space-y-1">
                      <p>Interactive Media Ads disabled</p>
                      {app.networkCode && <p>Google Publisher ID: {app.networkCode}</p>}
                    </div>
                  ) : app.networkCode ? (
                    <div className="text-brand-text-light space-y-1">
                      <p>Google Publisher ID: {app.networkCode}</p>
                      <div className="bg-white/60 border border-brand-border/60 rounded-lg p-2 text-xs space-y-1">
                        <p><span className="font-semibold text-brand-dark">Audio preroll:</span> {app.placements?.preroll || '—'}</p>
                        <p><span className="font-semibold text-brand-dark">Video preroll:</span> {app.placements?.midroll || '—'}</p>
                        <p><span className="font-semibold text-brand-dark">Video ad format:</span> {app.videoPrerollDefaultSize || '—'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-brand-text-light">Not configured</p>
                  )}
                </div>
                {app.notes && (
                  <div className="border border-dashed border-brand-border rounded-lg p-3 text-sm text-brand-text-light bg-gray-50">
                    {app.notes}
                  </div>
                )}
              </div>
              <div className="mt-6 flex items-center justify-end space-x-2 border-t border-brand-border pt-4">
                <button onClick={() => handleEdit(app)} className="p-2 text-brand-text-light hover:bg-gray-100 rounded-lg transition-colors">
                  <EditIcon />
                </button>
                <button
                  onClick={() => handleDelete(app.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {apps.length === 0 && (
        <div className="text-center py-16 text-brand-text-light bg-brand-surface rounded-2xl border border-brand-border">
          <p>No apps have been configured yet.</p>
        </div>
      )}

      {isModalOpen && (
        <PlayerFormModal
          app={editingApp}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default PlayerManager;
