/**
 * Analytics API Routes
 * Provides endpoints for analytics dashboard, station stats, trends, and reports
 */

const express = require('express');
const router = express.Router();
const { broadcastListeningEvent, broadcastDashboardUpdate } = require('../websocket-analytics');

/**
 * GET /analytics/dashboard
 * Get overall analytics dashboard metrics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { pool } = require('../db');

    // Get overall statistics
    const stats = await pool.query(`
      SELECT
        COUNT(DISTINCT s.id) as total_stations,
        COALESCE(SUM(sa.total_plays), 0) as total_plays,
        COALESCE(SUM(sa.total_favorites), 0) as total_favorites,
        COALESCE(SUM(sa.total_listening_minutes), 0) as total_listening_minutes,
        COALESCE(SUM(sa.unique_listeners), 0) as total_unique_listeners,
        COALESCE(AVG(sa.uptime_percentage), 100) as avg_uptime_percentage,
        COALESCE(AVG(sa.stream_quality_score), 0) as avg_quality_score
      FROM stations s
      LEFT JOIN station_analytics sa ON s.id = sa.station_id AND sa.period_type = 'all_time'
      WHERE s.active = true
    `);

    // Get top stations by plays
    const topStations = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.logo_url,
        COALESCE(sa.total_plays, 0) as plays,
        COALESCE(sa.total_favorites, 0) as favorites,
        COALESCE(sa.uptime_percentage, 100) as uptime_percentage
      FROM stations s
      LEFT JOIN station_analytics sa ON s.id = sa.station_id AND sa.period_type = 'all_time'
      WHERE s.active = true
      ORDER BY sa.total_plays DESC NULLS LAST
      LIMIT 10
    `);

    // Get recent listening activity
    const recentActivity = await pool.query(`
      SELECT
        le.id,
        le.station_id,
        s.name as station_name,
        le.event_type,
        le.country_code,
        le.device_type,
        le.created_at
      FROM listening_events le
      JOIN stations s ON le.station_id = s.id
      ORDER BY le.created_at DESC
      LIMIT 20
    `);

    // Get geographic distribution summary
    const geoDistribution = await pool.query(`
      SELECT
        country_code,
        country_name,
        SUM(play_count) as play_count,
        SUM(unique_listeners) as unique_listeners
      FROM geographic_stats
      WHERE period_type = 'all_time'
      GROUP BY country_code, country_name
      ORDER BY play_count DESC
      LIMIT 20
    `);

    res.json({
      stats: stats.rows[0],
      topStations: topStations.rows,
      recentActivity: recentActivity.rows,
      geoDistribution: geoDistribution.rows
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

/**
 * GET /analytics/stations/:id/stats
 * Get detailed analytics for a specific station
 */
router.get('/stations/:id/stats', async (req, res) => {
  try {
    const { pool } = require('../db');
    const { id } = req.params;
    const { period = 'all_time', startDate, endDate } = req.query;

    // Get station analytics
    const analytics = await pool.query(`
      SELECT
        sa.*,
        s.name,
        s.logo_url,
        s.stream_url,
        s.active
      FROM station_analytics sa
      JOIN stations s ON sa.station_id = s.id
      WHERE sa.station_id = $1 AND sa.period_type = $2
    `, [id, period]);

    if (analytics.rows.length === 0) {
      return res.status(404).json({ error: 'Station analytics not found' });
    }

    // Get listening trends (hourly data for last 7 days)
    const trends = await pool.query(`
      SELECT
        trend_type,
        time_bucket,
        play_count,
        unique_listeners,
        avg_stream_quality,
        uptime_percentage
      FROM trending_stats
      WHERE station_id = $1
        AND trend_type = 'hourly'
        AND time_bucket >= NOW() - INTERVAL '7 days'
      ORDER BY time_bucket ASC
    `, [id]);

    // Get geographic distribution
    const geoStats = await pool.query(`
      SELECT
        country_code,
        country_name,
        region,
        play_count,
        unique_listeners,
        total_listening_minutes
      FROM geographic_stats
      WHERE station_id = $1 AND period_type = 'all_time'
      ORDER BY play_count DESC
      LIMIT 20
    `, [id]);

    // Get recent events
    const events = await pool.query(`
      SELECT
        event_type,
        duration_minutes,
        country_code,
        device_type,
        platform,
        created_at
      FROM listening_events
      WHERE station_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [id]);

    res.json({
      analytics: analytics.rows[0],
      trends: trends.rows,
      geoStats: geoStats.rows,
      recentEvents: events.rows
    });
  } catch (error) {
    console.error('Error fetching station analytics:', error);
    res.status(500).json({ error: 'Failed to fetch station analytics' });
  }
});

/**
 * GET /analytics/listening-trends
 * Get listening trends across all stations
 */
router.get('/listening-trends', async (req, res) => {
  try {
    const { pool } = require('../db');
    const { period = 'daily', days = 30 } = req.query;

    // Determine trend type based on period
    let trendType = 'daily';
    if (period === 'hourly') trendType = 'hourly';
    else if (period === 'weekly') trendType = 'weekly';

    // Get aggregated trends
    const trends = await pool.query(`
      SELECT
        time_bucket,
        SUM(play_count) as total_plays,
        SUM(unique_listeners) as total_listeners,
        AVG(avg_stream_quality) as avg_quality,
        AVG(uptime_percentage) as avg_uptime
      FROM trending_stats
      WHERE trend_type = $1
        AND time_bucket >= NOW() - INTERVAL '1 day' * $2
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `, [trendType, parseInt(days)]);

    // Get top performing stations for the period
    const topStations = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.logo_url,
        SUM(ts.play_count) as plays,
        SUM(ts.unique_listeners) as listeners
      FROM trending_stats ts
      JOIN stations s ON ts.station_id = s.id
      WHERE ts.trend_type = $1
        AND ts.time_bucket >= NOW() - INTERVAL '1 day' * $2
      GROUP BY s.id, s.name, s.logo_url
      ORDER BY SUM(ts.play_count) DESC
      LIMIT 10
    `, [trendType, parseInt(days)]);

    // Get event breakdown
    const eventBreakdown = await pool.query(`
      SELECT
        event_type,
        COUNT(*) as count
      FROM listening_events
      WHERE created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY event_type
      ORDER BY count DESC
    `, [parseInt(days)]);

    res.json({
      trends: trends.rows,
      topStations: topStations.rows,
      eventBreakdown: eventBreakdown.rows,
      period: trendType,
      days: parseInt(days)
    });
  } catch (error) {
    console.error('Error fetching listening trends:', error);
    res.status(500).json({ error: 'Failed to fetch listening trends' });
  }
});

/**
 * GET /analytics/geographic-distribution
 * Get geographic distribution of listeners
 */
router.get('/geographic-distribution', async (req, res) => {
  try {
    const { pool } = require('../db');
    const { stationId, period = 'all_time' } = req.query;

    let query;
    let params;

    if (stationId) {
      // Get distribution for specific station
      query = `
        SELECT
          country_code,
          country_name,
          region,
          play_count,
          unique_listeners,
          total_listening_minutes
        FROM geographic_stats
        WHERE station_id = $1 AND period_type = $2
        ORDER BY play_count DESC
      `;
      params = [stationId, period];
    } else {
      // Get overall distribution
      query = `
        SELECT
          country_code,
          country_name,
          SUM(play_count) as play_count,
          SUM(unique_listeners) as unique_listeners,
          SUM(total_listening_minutes) as total_listening_minutes,
          COUNT(DISTINCT station_id) as stations_count
        FROM geographic_stats
        WHERE period_type = $1
        GROUP BY country_code, country_name
        ORDER BY play_count DESC
      `;
      params = [period];
    }

    const result = await pool.query(query, params);

    // Calculate percentages
    const total = result.rows.reduce((sum, row) => sum + parseInt(row.play_count), 0);
    const distribution = result.rows.map(row => ({
      ...row,
      play_count: parseInt(row.play_count),
      percentage: total > 0 ? ((parseInt(row.play_count) / total) * 100).toFixed(2) : 0
    }));

    res.json({
      distribution,
      total,
      stationId: stationId || null
    });
  } catch (error) {
    console.error('Error fetching geographic distribution:', error);
    res.status(500).json({ error: 'Failed to fetch geographic distribution' });
  }
});

/**
 * GET /analytics/export-reports
 * Get analytics for export profiles
 */
router.get('/export-reports', async (req, res) => {
  try {
    const { pool } = require('../db');

    // Get export analytics summary
    const summary = await pool.query(`
      SELECT
        COUNT(DISTINCT ep.id) as total_profiles,
        COALESCE(SUM(ea.total_exports), 0) as total_exports,
        COALESCE(SUM(ea.successful_exports), 0) as successful_exports,
        COALESCE(SUM(ea.failed_exports), 0) as failed_exports,
        COALESCE(AVG(ea.avg_export_duration_seconds), 0) as avg_duration
      FROM export_profiles ep
      LEFT JOIN export_analytics ea ON ep.id = ea.export_profile_id AND ea.period_type = 'all_time'
    `);

    // Get per-profile analytics
    const profiles = await pool.query(`
      SELECT
        ep.id,
        ep.name,
        ep.format,
        COALESCE(ea.total_exports, 0) as total_exports,
        COALESCE(ea.successful_exports, 0) as successful_exports,
        COALESCE(ea.failed_exports, 0) as failed_exports,
        COALESCE(ea.avg_export_duration_seconds, 0) as avg_duration,
        COALESCE(ea.total_stations_exported, 0) as stations_exported,
        ea.last_export_at,
        ea.last_export_status,
        CASE
          WHEN ea.total_exports > 0
          THEN ROUND((ea.successful_exports::numeric / ea.total_exports::numeric) * 100, 2)
          ELSE 0
        END as success_rate
      FROM export_profiles ep
      LEFT JOIN export_analytics ea ON ep.id = ea.export_profile_id AND ea.period_type = 'all_time'
      ORDER BY ea.total_exports DESC NULLS LAST
    `);

    // Get recent export activity
    const recentExports = await pool.query(`
      SELECT
        ea.export_profile_id,
        ep.name as profile_name,
        ea.last_export_at,
        ea.last_export_status,
        ea.total_stations_exported
      FROM export_analytics ea
      JOIN export_profiles ep ON ea.export_profile_id = ep.id
      WHERE ea.last_export_at IS NOT NULL
      ORDER BY ea.last_export_at DESC
      LIMIT 20
    `);

    res.json({
      summary: summary.rows[0],
      profiles: profiles.rows,
      recentExports: recentExports.rows
    });
  } catch (error) {
    console.error('Error fetching export reports:', error);
    res.status(500).json({ error: 'Failed to fetch export reports' });
  }
});

/**
 * POST /analytics/events
 * Track a listening event (for future integration with player apps)
 */
router.post('/events', async (req, res) => {
  try {
    const { pool } = require('../db');
    const {
      stationId,
      sessionId,
      eventType,
      durationMinutes,
      countryCode,
      region,
      city,
      deviceType,
      platform,
      playerAppId,
      streamQualityScore
    } = req.body;

    // Validate required fields
    if (!stationId || !eventType) {
      return res.status(400).json({ error: 'stationId and eventType are required' });
    }

    // Get IP and user agent from request
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    // Insert event
    const result = await pool.query(`
      INSERT INTO listening_events (
        station_id,
        session_id,
        event_type,
        duration_minutes,
        country_code,
        region,
        city,
        device_type,
        platform,
        player_app_id,
        stream_quality_score,
        ip_address,
        user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, created_at
    `, [
      stationId,
      sessionId || null,
      eventType,
      durationMinutes || null,
      countryCode || null,
      region || null,
      city || null,
      deviceType || null,
      platform || null,
      playerAppId || null,
      streamQualityScore || null,
      ipAddress,
      userAgent
    ]);

    const event = {
      id: result.rows[0].id,
      station_id: stationId,
      session_id: sessionId,
      event_type: eventType,
      duration_minutes: durationMinutes,
      country_code: countryCode,
      region,
      city,
      device_type: deviceType,
      platform,
      player_app_id: playerAppId,
      stream_quality_score: streamQualityScore,
      created_at: result.rows[0].created_at
    };

    // Broadcast the event to connected WebSocket clients
    broadcastListeningEvent(event);

    res.status(201).json({
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
      message: 'Event tracked successfully'
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

/**
 * GET /analytics/export/:format
 * Export analytics data in various formats
 */
router.get('/export/:format', async (req, res) => {
  try {
    const { pool } = require('../db');
    const { format } = req.params;
    const { startDate, endDate, stationIds } = req.query;

    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Supported: csv, json' });
    }

    // Build query
    let query = `
      SELECT
        s.id as station_id,
        s.name as station_name,
        s.stream_url,
        sa.total_plays,
        sa.total_favorites,
        sa.total_listening_minutes,
        sa.unique_listeners,
        sa.avg_session_duration_minutes,
        sa.uptime_percentage,
        sa.stream_quality_score,
        sa.last_played_at,
        sa.last_updated_at
      FROM stations s
      LEFT JOIN station_analytics sa ON s.id = sa.station_id AND sa.period_type = 'all_time'
      WHERE s.active = true
    `;

    const params = [];
    if (stationIds) {
      const ids = stationIds.split(',').map(id => parseInt(id));
      query += ` AND s.id = ANY($${params.length + 1})`;
      params.push(ids);
    }

    query += ' ORDER BY sa.total_plays DESC NULLS LAST';

    const result = await pool.query(query, params);

    if (format === 'json') {
      res.json({
        exported_at: new Date().toISOString(),
        count: result.rows.length,
        data: result.rows
      });
    } else if (format === 'csv') {
      // Convert to CSV
      const headers = Object.keys(result.rows[0] || {});
      const csv = [
        headers.join(','),
        ...result.rows.map(row =>
          headers.map(header => {
            const value = row[header];
            return value !== null && value !== undefined ? `"${value}"` : '';
          }).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${Date.now()}.csv"`);
      res.send(csv);
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

module.exports = router;
