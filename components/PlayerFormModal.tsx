import React, { useEffect, useState } from 'react';
import { PlayerApp } from '../types';
import { CloseIcon } from './Icons';
import {
  AUDIO_PREROLL_SUFFIX,
  DEFAULT_PLACEMENT_SLUG,
  VIDEO_PREROLL_SUFFIX,
  buildPlacement,
  extractNetworkFromPlacement,
  extractSlugFromPlacement,
  stripSlashes,
} from './playerPlacementUtils';
import { useToast, wasToastHandled } from './ToastProvider';

interface PlayerFormModalProps {
  app: PlayerApp | null;
  onSave: (app: PlayerApp) => Promise<void> | void;
  onClose: () => void;
}

const platformOptions = ['iOS', 'Android', 'Home Assistant', 'Web', 'Desktop', 'TV', 'Other'];

const PlayerFormModal: React.FC<PlayerFormModalProps> = ({ app, onSave, onClose }) => {
  const [name, setName] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [ftpEnabled, setFtpEnabled] = useState(false);
  const [ftpServer, setFtpServer] = useState('');
  const [ftpUsername, setFtpUsername] = useState('');
  const [ftpPassword, setFtpPassword] = useState('');
  const [networkCode, setNetworkCode] = useState('');
  const [imaEnabled, setImaEnabled] = useState(true);
  const [audioPrerollSlug, setAudioPrerollSlug] = useState(DEFAULT_PLACEMENT_SLUG);
  const [videoPrerollSlug, setVideoPrerollSlug] = useState(DEFAULT_PLACEMENT_SLUG);
  const [videoPrerollDefaultSize, setVideoPrerollDefaultSize] = useState('640x480');
  const { addToast } = useToast();

  const togglePlatform = (option: string) => {
    setPlatforms(prev => {
      const exists = prev.includes(option);
      if (exists) {
        return [];
      }
      return [option];
    });
  };

  useEffect(() => {
    if (app) {
      setName(app.name);
      setPlatforms(
        Array.isArray(app.platforms) && app.platforms.length > 0
          ? [app.platforms[0]]
          : app.platform
            ? [app.platform]
            : []
      );
      setDescription(app.description);
      setContactEmail(app.contactEmail);
      setNotes(app.notes);
      setFtpEnabled(Boolean(app.ftpEnabled));
      setFtpServer(app.ftpServer || '');
      setFtpUsername(app.ftpUsername || '');
      setFtpPassword(app.ftpPassword || '');
      const inferredNetworkCode =
        app.networkCode ||
        extractNetworkFromPlacement(app.placements?.preroll, [AUDIO_PREROLL_SUFFIX, 'preroll']) ||
        extractNetworkFromPlacement(app.placements?.midroll, [VIDEO_PREROLL_SUFFIX, 'midroll']) ||
        '';
      setNetworkCode(inferredNetworkCode);
      setImaEnabled(app.imaEnabled !== false);
      const inferredAudioSlug = stripSlashes(
        extractSlugFromPlacement(app.placements?.preroll, [AUDIO_PREROLL_SUFFIX, 'preroll'])
      );
      const inferredVideoSlug = stripSlashes(
        extractSlugFromPlacement(app.placements?.midroll, [VIDEO_PREROLL_SUFFIX, 'midroll'])
      );
      setAudioPrerollSlug(inferredAudioSlug || DEFAULT_PLACEMENT_SLUG);
      setVideoPrerollSlug(inferredVideoSlug || DEFAULT_PLACEMENT_SLUG);
      setVideoPrerollDefaultSize((app.videoPrerollDefaultSize || '640x480').trim() || '640x480');
    } else {
      setName('');
      setPlatforms([]);
      setDescription('');
      setContactEmail('');
      setNotes('');
      setFtpEnabled(false);
      setFtpServer('');
      setFtpUsername('');
      setFtpPassword('');
      setNetworkCode('');
      setImaEnabled(true);
      setAudioPrerollSlug(DEFAULT_PLACEMENT_SLUG);
      setVideoPrerollSlug(DEFAULT_PLACEMENT_SLUG);
      setVideoPrerollDefaultSize('640x480');
    }
  }, [app]);

  const sanitizedNetworkCode = stripSlashes(networkCode);
  const sanitizedAudioSlug = stripSlashes(audioPrerollSlug);
  const sanitizedVideoSlug = stripSlashes(videoPrerollSlug);
  const audioPrerollPlacement = buildPlacement(networkCode, sanitizedAudioSlug, AUDIO_PREROLL_SUFFIX);
  const videoPrerollPlacement = buildPlacement(networkCode, sanitizedVideoSlug, VIDEO_PREROLL_SUFFIX);
  const sanitizedVideoDefaultSize = videoPrerollDefaultSize.trim() || '640x480';
  const audioPlacementPlaceholder = `/${sanitizedNetworkCode || 'network-code'}/${sanitizedAudioSlug || DEFAULT_PLACEMENT_SLUG}/${AUDIO_PREROLL_SUFFIX}`;
  const videoPlacementPlaceholder = `/${sanitizedNetworkCode || 'network-code'}/${sanitizedVideoSlug || DEFAULT_PLACEMENT_SLUG}/${VIDEO_PREROLL_SUFFIX}`;
  const adConfigurationDisabled = !imaEnabled;
  const isVideoSlugProvided = Boolean(sanitizedVideoSlug);
  const isVideoAdFormatDisabled = adConfigurationDisabled || !isVideoSlugProvided;

  const hasPlatformSelection = platforms.length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      addToast('Please provide a name for the app.', { type: 'error' });
      return;
    }

    const sanitizedPlatforms = Array.from(
      new Set(
        platforms
          .map(platform => platform.trim())
          .filter(Boolean)
      )
    );

    if (sanitizedPlatforms.length === 0) {
      addToast('Select a platform for this app.', { type: 'error' });
      return;
    }

    if (ftpEnabled) {
      if (!ftpServer.trim() || !ftpUsername.trim() || !ftpPassword.trim()) {
        addToast('Please provide FTP server, username, and password to enable FTP exports.', { type: 'error' });
        return;
      }
    }

    const primaryPlatform = sanitizedPlatforms[0];

    const payload: PlayerApp = {
      id: app?.id || `app-${Date.now()}`,
      name,
      platforms: sanitizedPlatforms,
      platform: primaryPlatform,
      description,
      contactEmail,
      notes,
      ftpEnabled,
      ftpServer: ftpServer.trim(),
      ftpUsername: ftpUsername.trim(),
      ftpPassword: ftpPassword.trim(),
      networkCode: sanitizedNetworkCode,
      imaEnabled,
      videoPrerollDefaultSize: sanitizedVideoDefaultSize,
      placements: {
        preroll: audioPrerollPlacement.trim(),
        midroll: videoPrerollPlacement.trim(),
        rewarded: app?.placements?.rewarded?.trim?.() || '',
      },
    };

    try {
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Failed to save app', error);
      if (!wasToastHandled(error)) {
        addToast('Failed to save app.', { type: 'error' });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-surface rounded-2xl w-full max-w-xl shadow-xl relative animate-fade-in-up max-h-[85vh] flex flex-col overflow-hidden px-8 pt-8 pb-6">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-brand-text-light hover:bg-gray-100 rounded-full">
          <CloseIcon />
        </button>
        <h2 className="text-2xl font-bold mb-6 pr-12">{app ? 'Edit App / Player' : 'Create App / Player'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-5 pr-2">
              <div>
                <label htmlFor="player-name" className="block text-sm font-medium text-brand-text-light mb-1">Name</label>
                <input
                  id="player-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="block text-sm font-medium text-brand-text-light">Platform</span>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    {platformOptions.map(option => {
                      const checked = platforms.includes(option);
                      const disabled = hasPlatformSelection && !checked;
                      return (
                        <label
                          key={option}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${checked ? 'border-brand-primary bg-brand-primary/10 text-brand-dark' : 'border-brand-border bg-white/70 text-brand-text-light'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePlatform(option)}
                            disabled={disabled}
                            className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                          />
                          <span className="font-medium">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-brand-text-light">Select the platform that ships this player build.</p>
                </div>
                <div>
                  <label htmlFor="player-contact" className="block text-sm font-medium text-brand-text-light mb-1">Contact email</label>
                  <input
                    id="player-contact"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="team@example.com"
                    className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="player-description" className="block text-sm font-medium text-brand-text-light mb-1">Description</label>
                <textarea
                  id="player-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="player-notes" className="block text-sm font-medium text-brand-text-light mb-1">Notes</label>
                <textarea
                  id="player-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                />
              </div>

              <fieldset className="border border-dashed border-brand-border rounded-xl p-4">
                <legend className="px-2 text-sm font-semibold text-brand-dark">FTP delivery</legend>
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={ftpEnabled}
                    onChange={(event) => setFtpEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                  />
                  Export JSON via FTP
                </label>

                {ftpEnabled && (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="ftp-server" className="block text-sm font-medium text-brand-text-light mb-1">FTP server</label>
                      <input
                        id="ftp-server"
                        type="text"
                        value={ftpServer}
                        onChange={(e) => setFtpServer(e.target.value)}
                        placeholder="ftp.example.com"
                        className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="ftp-username" className="block text-sm font-medium text-brand-text-light mb-1">FTP username</label>
                      <input
                        id="ftp-username"
                        type="text"
                        value={ftpUsername}
                        onChange={(e) => setFtpUsername(e.target.value)}
                        placeholder="deploy"
                        className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label htmlFor="ftp-password" className="block text-sm font-medium text-brand-text-light mb-1">FTP password</label>
                      <input
                        id="ftp-password"
                        type="password"
                        value={ftpPassword}
                        onChange={(e) => setFtpPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none"
                      />
                    </div>
                    <p className="sm:col-span-2 text-xs text-brand-text-light">
                      When enabled, auto-exports linked to this app will also push the generated JSON to the configured FTP endpoint.
                    </p>
                  </div>
                )}
              </fieldset>

              <fieldset className="border border-dashed border-brand-border rounded-xl p-4">
                <legend className="px-2 text-sm font-semibold text-brand-dark">Ad Manager Configuration</legend>
                <div className="flex items-center justify-between gap-4">
                  <label className="flex items-center gap-3 text-sm font-medium text-brand-dark">
                    <input
                      type="checkbox"
                      checked={imaEnabled}
                      onChange={(event) => setImaEnabled(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                    />
                    Enable Interactive Media Ads (IMA)
                  </label>
                </div>

                <div className={`mt-4 space-y-4 ${adConfigurationDisabled ? 'opacity-60' : ''}`} aria-disabled={adConfigurationDisabled}>
                  <div>
                    <label htmlFor="network-code" className="block text-sm font-medium text-brand-text-light mb-1">Google Publisher ID</label>
                    <input
                      id="network-code"
                      type="text"
                      value={networkCode}
                      onChange={(event) => setNetworkCode(event.target.value)}
                      placeholder="1234567"
                      disabled={adConfigurationDisabled}
                      className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:bg-gray-100 disabled:text-brand-text-light disabled:cursor-not-allowed"
                    />
                    <p className="mt-1 text-xs text-brand-text-light">{videoPrerollPlacement ? 'This path is generated automatically from the network code and placement slug.' : 'Add a network code and slug to generate the final placement path.'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="placement-audio-slug" className="block text-sm font-medium text-brand-text-light mb-1">Audio Preroll Placement</label>
                      <input
                        id="placement-audio-slug"
                        type="text"
                        value={audioPrerollSlug}
                        onChange={(event) => setAudioPrerollSlug(stripSlashes(event.target.value))}
                        placeholder="webradio"
                        disabled={adConfigurationDisabled}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:bg-gray-100 disabled:text-brand-text-light disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        readOnly
                        value={audioPrerollPlacement}
                        placeholder={audioPlacementPlaceholder}
                        aria-label="Audio preroll placement preview"
                        onFocus={(event) => event.currentTarget.select()}
                        disabled={adConfigurationDisabled}
                        className="mt-2 w-full px-3 py-2 border border-dashed border-brand-border rounded-lg bg-white/60 text-sm text-brand-text-light cursor-text disabled:bg-gray-100 disabled:text-brand-text-light disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="placement-video-slug" className="block text-sm font-medium text-brand-text-light mb-1">Video Preroll Placement</label>
                      <input
                        id="placement-video-slug"
                        type="text"
                        value={videoPrerollSlug}
                        onChange={(event) => setVideoPrerollSlug(stripSlashes(event.target.value))}
                        placeholder="webradio"
                        disabled={adConfigurationDisabled}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:bg-gray-100 disabled:text-brand-text-light disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        readOnly
                        value={videoPrerollPlacement}
                        placeholder={videoPlacementPlaceholder}
                        aria-label="Video preroll placement preview"
                        onFocus={(event) => event.currentTarget.select()}
                        disabled={adConfigurationDisabled}
                        className="mt-2 w-full px-3 py-2 border border-dashed border-brand-border rounded-lg bg-white/60 text-sm text-brand-text-light cursor-text disabled:bg-gray-100 disabled:text-brand-text-light disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="video-ad-format" className="block text-sm font-medium text-brand-text-light mb-1">Video Ad Format</label>
                      <input
                        id="video-ad-format"
                        type="text"
                        value={videoPrerollDefaultSize}
                        onChange={(event) => setVideoPrerollDefaultSize(event.target.value.replace(/\s+/g, ''))}
                        placeholder="640x480"
                        disabled={isVideoAdFormatDisabled}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none disabled:bg-gray-100 disabled:text-brand-text-light disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-brand-text-light">
                    These placements are used when building ad requests for the connected player application. The paths are generated automatically from the Google Publisher ID (network code), placement slugs, and Prefix for Audio &amp; Video.
                  </p>
                </div>
              </fieldset>
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-brand-border bg-brand-surface">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-brand-border text-brand-dark font-semibold rounded-lg hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2.5 bg-brand-dark text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors">
              Save App
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlayerFormModal;
