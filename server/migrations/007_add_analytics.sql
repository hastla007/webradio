-- Migration: Add Analytics Tables and Functions
-- Description: Creates comprehensive analytics tracking for stations, listening events, exports, and geographic distribution
-- Date: 2025-11-16

-- ============================================================================
-- 1. STATION ANALYTICS TABLE
-- ============================================================================
-- Tracks aggregate analytics per station
CREATE TABLE IF NOT EXISTS station_analytics (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,

    -- Engagement Metrics
    total_plays INTEGER DEFAULT 0,
    total_favorites INTEGER DEFAULT 0,
    total_listening_minutes INTEGER DEFAULT 0,
    unique_listeners INTEGER DEFAULT 0,

    -- Performance Metrics
    avg_session_duration_minutes DECIMAL(10, 2) DEFAULT 0,
    uptime_percentage DECIMAL(5, 2) DEFAULT 100.0,
    avg_response_time_ms INTEGER DEFAULT 0,

    -- Quality Metrics
    stream_quality_score DECIMAL(5, 2) DEFAULT 0, -- 0-100
    buffer_health_score DECIMAL(5, 2) DEFAULT 0, -- 0-100

    -- Time Tracking
    last_played_at TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Period Tracking (for daily/weekly/monthly aggregations)
    period_type VARCHAR(20) DEFAULT 'all_time', -- 'all_time', 'daily', 'weekly', 'monthly'
    period_start DATE,
    period_end DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one record per station per period
    UNIQUE(station_id, period_type, period_start, period_end)
);

CREATE INDEX idx_station_analytics_station_id ON station_analytics(station_id);
CREATE INDEX idx_station_analytics_period ON station_analytics(period_type, period_start, period_end);
CREATE INDEX idx_station_analytics_last_played ON station_analytics(last_played_at);

-- ============================================================================
-- 2. LISTENING EVENTS TABLE
-- ============================================================================
-- Tracks individual listening sessions and events
CREATE TABLE IF NOT EXISTS listening_events (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,

    -- Session Information
    session_id UUID,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Event Details
    event_type VARCHAR(50) NOT NULL, -- 'play_start', 'play_stop', 'favorite', 'unfavorite', 'share'
    duration_minutes INTEGER, -- For play_stop events

    -- Geographic Data
    country_code VARCHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),

    -- Device/Platform Data
    device_type VARCHAR(50), -- 'mobile', 'desktop', 'tablet', 'smart_speaker'
    platform VARCHAR(50), -- 'ios', 'android', 'web', 'windows', 'macos'
    player_app_id INTEGER REFERENCES player_apps(id) ON DELETE SET NULL,

    -- Quality Metrics (captured at time of event)
    stream_quality_score DECIMAL(5, 2),
    buffer_events INTEGER DEFAULT 0,

    -- Request Metadata
    ip_address INET,
    user_agent TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listening_events_station_id ON listening_events(station_id);
CREATE INDEX idx_listening_events_created_at ON listening_events(created_at);
CREATE INDEX idx_listening_events_session_id ON listening_events(session_id);
CREATE INDEX idx_listening_events_event_type ON listening_events(event_type);
CREATE INDEX idx_listening_events_country ON listening_events(country_code);
CREATE INDEX idx_listening_events_user_id ON listening_events(user_id);

-- ============================================================================
-- 3. EXPORT ANALYTICS TABLE
-- ============================================================================
-- Tracks export profile performance and statistics
CREATE TABLE IF NOT EXISTS export_analytics (
    id SERIAL PRIMARY KEY,
    export_profile_id INTEGER NOT NULL REFERENCES export_profiles(id) ON DELETE CASCADE,

    -- Export Metrics
    total_exports INTEGER DEFAULT 0,
    successful_exports INTEGER DEFAULT 0,
    failed_exports INTEGER DEFAULT 0,

    -- Performance Metrics
    avg_export_duration_seconds DECIMAL(10, 2) DEFAULT 0,
    total_stations_exported INTEGER DEFAULT 0,
    total_data_size_mb DECIMAL(10, 2) DEFAULT 0,

    -- Last Export Details
    last_export_at TIMESTAMP,
    last_export_status VARCHAR(20), -- 'success', 'failed', 'partial'
    last_export_error TEXT,

    -- Time Period
    period_type VARCHAR(20) DEFAULT 'all_time',
    period_start DATE,
    period_end DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(export_profile_id, period_type, period_start, period_end)
);

CREATE INDEX idx_export_analytics_profile_id ON export_analytics(export_profile_id);
CREATE INDEX idx_export_analytics_period ON export_analytics(period_type, period_start, period_end);

-- ============================================================================
-- 4. GEOGRAPHIC DISTRIBUTION TABLE
-- ============================================================================
-- Aggregated geographic statistics for stations
CREATE TABLE IF NOT EXISTS geographic_stats (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,

    -- Location
    country_code VARCHAR(2) NOT NULL,
    country_name VARCHAR(100),
    region VARCHAR(100),

    -- Metrics
    play_count INTEGER DEFAULT 0,
    unique_listeners INTEGER DEFAULT 0,
    total_listening_minutes INTEGER DEFAULT 0,

    -- Time Period
    period_type VARCHAR(20) DEFAULT 'all_time',
    period_start DATE,
    period_end DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(station_id, country_code, region, period_type, period_start, period_end)
);

CREATE INDEX idx_geographic_stats_station_id ON geographic_stats(station_id);
CREATE INDEX idx_geographic_stats_country ON geographic_stats(country_code);
CREATE INDEX idx_geographic_stats_period ON geographic_stats(period_type, period_start, period_end);

-- ============================================================================
-- 5. TRENDING STATS TABLE
-- ============================================================================
-- Pre-calculated trending data for performance
CREATE TABLE IF NOT EXISTS trending_stats (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,

    -- Trend Metrics
    trend_type VARCHAR(50) NOT NULL, -- 'hourly', 'daily', 'weekly'
    time_bucket TIMESTAMP NOT NULL,

    -- Counts
    play_count INTEGER DEFAULT 0,
    unique_listeners INTEGER DEFAULT 0,
    avg_concurrent_listeners INTEGER DEFAULT 0,

    -- Engagement
    favorite_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,

    -- Performance
    avg_stream_quality DECIMAL(5, 2) DEFAULT 0,
    uptime_percentage DECIMAL(5, 2) DEFAULT 100.0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(station_id, trend_type, time_bucket)
);

CREATE INDEX idx_trending_stats_station_id ON trending_stats(station_id);
CREATE INDEX idx_trending_stats_time_bucket ON trending_stats(trend_type, time_bucket);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to update station analytics from listening events
CREATE OR REPLACE FUNCTION update_station_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update all_time analytics
    INSERT INTO station_analytics (
        station_id,
        total_plays,
        last_played_at,
        last_updated_at,
        period_type
    )
    VALUES (
        NEW.station_id,
        CASE WHEN NEW.event_type = 'play_start' THEN 1 ELSE 0 END,
        CASE WHEN NEW.event_type = 'play_start' THEN NEW.created_at ELSE NULL END,
        CURRENT_TIMESTAMP,
        'all_time'
    )
    ON CONFLICT (station_id, period_type, period_start, period_end)
    DO UPDATE SET
        total_plays = station_analytics.total_plays + CASE WHEN NEW.event_type = 'play_start' THEN 1 ELSE 0 END,
        total_favorites = station_analytics.total_favorites + CASE WHEN NEW.event_type = 'favorite' THEN 1 WHEN NEW.event_type = 'unfavorite' THEN -1 ELSE 0 END,
        total_listening_minutes = station_analytics.total_listening_minutes + COALESCE(NEW.duration_minutes, 0),
        last_played_at = CASE WHEN NEW.event_type = 'play_start' THEN NEW.created_at ELSE station_analytics.last_played_at END,
        last_updated_at = CURRENT_TIMESTAMP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update analytics on new listening events
DROP TRIGGER IF EXISTS trigger_update_station_analytics ON listening_events;
CREATE TRIGGER trigger_update_station_analytics
    AFTER INSERT ON listening_events
    FOR EACH ROW
    EXECUTE FUNCTION update_station_analytics();

-- Function to update geographic stats from listening events
CREATE OR REPLACE FUNCTION update_geographic_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.country_code IS NOT NULL THEN
        INSERT INTO geographic_stats (
            station_id,
            country_code,
            region,
            play_count,
            period_type
        )
        VALUES (
            NEW.station_id,
            NEW.country_code,
            COALESCE(NEW.region, 'Unknown'),
            CASE WHEN NEW.event_type = 'play_start' THEN 1 ELSE 0 END,
            'all_time'
        )
        ON CONFLICT (station_id, country_code, region, period_type, period_start, period_end)
        DO UPDATE SET
            play_count = geographic_stats.play_count + CASE WHEN NEW.event_type = 'play_start' THEN 1 ELSE 0 END,
            total_listening_minutes = geographic_stats.total_listening_minutes + COALESCE(NEW.duration_minutes, 0),
            updated_at = CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update geographic stats
DROP TRIGGER IF EXISTS trigger_update_geographic_stats ON listening_events;
CREATE TRIGGER trigger_update_geographic_stats
    AFTER INSERT ON listening_events
    FOR EACH ROW
    EXECUTE FUNCTION update_geographic_stats();

-- ============================================================================
-- 7. INITIAL DATA SEEDING
-- ============================================================================
-- Create all_time analytics records for existing stations
INSERT INTO station_analytics (station_id, period_type)
SELECT id, 'all_time'
FROM stations
ON CONFLICT (station_id, period_type, period_start, period_end) DO NOTHING;

-- Create all_time export analytics for existing export profiles
INSERT INTO export_analytics (export_profile_id, period_type)
SELECT id, 'all_time'
FROM export_profiles
ON CONFLICT (export_profile_id, period_type, period_start, period_end) DO NOTHING;

-- ============================================================================
-- 8. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Top performing stations view
CREATE OR REPLACE VIEW v_top_stations AS
SELECT
    s.id,
    s.name,
    s.logo_url,
    sa.total_plays,
    sa.total_favorites,
    sa.total_listening_minutes,
    sa.unique_listeners,
    sa.avg_session_duration_minutes,
    sa.uptime_percentage,
    sa.stream_quality_score,
    sa.last_played_at
FROM stations s
LEFT JOIN station_analytics sa ON s.id = sa.station_id AND sa.period_type = 'all_time'
WHERE s.active = true
ORDER BY sa.total_plays DESC NULLS LAST;

-- Recent listening activity view
CREATE OR REPLACE VIEW v_recent_listening AS
SELECT
    le.id,
    le.station_id,
    s.name as station_name,
    le.event_type,
    le.duration_minutes,
    le.country_code,
    le.device_type,
    le.platform,
    le.created_at
FROM listening_events le
JOIN stations s ON le.station_id = s.id
ORDER BY le.created_at DESC
LIMIT 100;

-- Geographic distribution summary view
CREATE OR REPLACE VIEW v_geographic_summary AS
SELECT
    country_code,
    country_name,
    SUM(play_count) as total_plays,
    SUM(unique_listeners) as total_listeners,
    COUNT(DISTINCT station_id) as stations_count
FROM geographic_stats
WHERE period_type = 'all_time'
GROUP BY country_code, country_name
ORDER BY total_plays DESC;

COMMENT ON TABLE station_analytics IS 'Aggregate analytics and metrics per radio station';
COMMENT ON TABLE listening_events IS 'Individual listening events and sessions tracking';
COMMENT ON TABLE export_analytics IS 'Export profile performance and statistics';
COMMENT ON TABLE geographic_stats IS 'Geographic distribution of listeners by station';
COMMENT ON TABLE trending_stats IS 'Pre-calculated trending data for performance dashboards';
