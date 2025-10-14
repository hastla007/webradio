-- WebRadio Admin Panel Database Schema

CREATE TABLE IF NOT EXISTS genres (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sub_genres JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stations (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    stream_url TEXT NOT NULL,
    description TEXT DEFAULT '',
    genre_id VARCHAR(255) REFERENCES genres(id) ON DELETE SET NULL,
    sub_genres JSONB DEFAULT '[]'::jsonb,
    logo_url TEXT DEFAULT '',
    bitrate INTEGER DEFAULT 128,
    language VARCHAR(10) DEFAULT 'en',
    region VARCHAR(255) DEFAULT 'Global',
    tags JSONB DEFAULT '[]'::jsonb,
    ima_ad_type VARCHAR(10) DEFAULT 'no' CHECK (ima_ad_type IN ('audio', 'video', 'no')),
    is_active BOOLEAN DEFAULT true,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_apps (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    platforms JSONB DEFAULT '[]'::jsonb,
    platform VARCHAR(50) DEFAULT '',
    description TEXT DEFAULT '',
    contact_email VARCHAR(255) DEFAULT '',
    notes TEXT DEFAULT '',
    ftp_enabled BOOLEAN DEFAULT false,
    ftp_server VARCHAR(255) DEFAULT '',
    ftp_username VARCHAR(255) DEFAULT '',
    ftp_password VARCHAR(255) DEFAULT '',
    network_code VARCHAR(50) DEFAULT '',
    ima_enabled BOOLEAN DEFAULT true,
    video_preroll_default_size VARCHAR(20) DEFAULT '640x480',
    placements JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS export_profiles (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    genre_ids JSONB DEFAULT '[]'::jsonb,
    station_ids JSONB DEFAULT '[]'::jsonb,
    sub_genres JSONB DEFAULT '[]'::jsonb,
    player_id VARCHAR(255) REFERENCES player_apps(id) ON DELETE SET NULL,
    auto_export JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stations_genre_id ON stations(genre_id);
CREATE INDEX IF NOT EXISTS idx_stations_is_active ON stations(is_active);
CREATE INDEX IF NOT EXISTS idx_export_profiles_player_id ON export_profiles(player_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_genres_updated_at BEFORE UPDATE ON genres
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_apps_updated_at BEFORE UPDATE ON player_apps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_export_profiles_updated_at BEFORE UPDATE ON export_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
