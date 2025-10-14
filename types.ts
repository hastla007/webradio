// types.ts

export type ImaAdType = 'audio' | 'video' | 'no';

export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  description: string;
  genreId: string;
  subGenres: string[];
  logoUrl: string;
  bitrate: number;
  language: string;
  region: string;
  tags: string[];
  imaAdType: ImaAdType;
  isActive: boolean;
  isFavorite: boolean;
}

export interface Genre {
  id: string;
  name: string;
  subGenres: string[];
}

export interface AdPlacements {
  preroll: string;
  midroll: string;
  rewarded?: string;
}

export interface PlayerApp {
  id: string;
  name: string;
  platforms: string[];
  platform?: string;
  description: string;
  contactEmail: string;
  notes: string;
  ftpEnabled: boolean;
  ftpServer: string;
  ftpUsername: string;
  ftpPassword: string;
  ftpProtocol: 'ftp' | 'ftps' | 'sftp';
  ftpTimeout: number;
  networkCode: string;
  imaEnabled: boolean;
  videoPrerollDefaultSize: string;
  placements: AdPlacements;
}

export interface AutoExportConfig {
  enabled: boolean;
  interval: 'daily' | 'weekly' | 'monthly';
  time: string;
}

export interface ExportProfile {
  id: string;
  name: string;
  genreIds: string[];
  stationIds: string[];
  subGenres: string[];
  playerId: string | null;
  autoExport: AutoExportConfig;
}

export interface ExportedStation {
  id: string;
  name: string;
  genre: string | null;
  url: string;
  logo: string;
  description: string;
  bitrate: number;
  language: string;
  region: string;
  tags: string[];
  subGenres: string[];
  isPlaying: boolean;
  isFavorite: boolean;
  imaAdType: ImaAdType;
  adMeta?: {
    section: string | null;
  };
}

export interface ExportAppInfo {
  id: string;
  platform: string;
  version: number;
}

export interface ExportPayload {
  stations: ExportedStation[];
  app?: ExportAppInfo;
  ads?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface ProfileExportSummaryFile {
  platform: string;
  fileName: string;
  outputPath: string;
  stationCount: number;
  ftpUploaded: boolean;
}

export interface ProfileExportSummary {
  profileId: string;
  profileName: string;
  stationCount: number;
  outputDirectory: string;
  files: ProfileExportSummaryFile[];
}

export interface MonitoringStatus {
  status: 'online' | 'offline' | 'unknown';
  history: number[]; // 1 for success, 0 for failure
  fails: number;
  responseTime?: number;
  statusCode?: number;
  contentType?: string | null;
  lastCheckedAt?: number;
  error?: string;
}

export interface MonitoringSettings {
  enabled: boolean;
  interval: number; // in minutes
  threshold: number; // consecutive failures before alert
}

export interface MonitoringEvent {
  id: string;
  stationName: string;
  message: string;
  timestamp: number;
  type: 'success' | 'error' | 'info';
}

export interface StreamHealthResult {
  stationId: string;
  isOnline: boolean;
  statusCode?: number;
  contentType?: string | null;
  responseTime?: number;
  error?: string;
}

export type LogCategory =
  | 'system'
  | 'errors'
  | 'stations'
  | 'exports'
  | 'monitoring'
  | 'players'
  | 'genres';

export interface LogEntry {
  id: string;
  sequence: number;
  timestamp: number;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  category: LogCategory | string;
  message: string;
  details: Record<string, unknown>;
}
