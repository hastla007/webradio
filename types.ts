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

// ============================================================================
// Authentication Types
// ============================================================================

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface ApiKey {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  last_used: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  username?: string;
  email?: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogStats {
  total_actions: number;
  unique_users: number;
  unique_entity_types: number;
  actions_by_type: Record<string, number>;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

export interface LoginResponse {
  message: string;
  user: User;
  accessToken: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}
