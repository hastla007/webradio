/**
 * Audit Log API Routes
 * Routes for viewing audit logs and statistics (Admin only)
 */

const express = require('express');
const router = express.Router();

const {
  getAuditLogs,
  getAuditLogStats,
} = require('../auth/auth-db');

const {
  authenticate,
  requireAdmin,
} = require('../auth/auth-middleware');

// All routes require admin authentication
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/audit-logs
 * Get audit logs with filtering
 * Query params: limit, offset, userId, entityType, action, startDate, endDate
 */
router.get('/', async (req, res) => {
  try {
    const {
      limit,
      offset,
      userId,
      entityType,
      action,
      startDate,
      endDate,
    } = req.query;

    const logs = await getAuditLogs({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      userId: userId ? parseInt(userId, 10) : undefined,
      entityType,
      action,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      error: 'Failed to get audit logs',
      message: error.message,
    });
  }
});

/**
 * GET /api/audit-logs/stats
 * Get audit log statistics
 * Query params: userId, startDate, endDate
 */
router.get('/stats', async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;

    const stats = await getAuditLogStats({
      userId: userId ? parseInt(userId, 10) : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.json(stats);
  } catch (error) {
    console.error('Get audit log stats error:', error);
    res.status(500).json({
      error: 'Failed to get audit log statistics',
      message: error.message,
    });
  }
});

/**
 * GET /api/audit-logs/entity/:entityType/:entityId
 * Get audit logs for a specific entity
 */
router.get('/entity/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit, offset } = req.query;

    // Parse and validate pagination params
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: 'Limit and offset must be valid numbers',
      });
    }

    // Query with entityType first, then filter by entityId in SQL
    const { pool } = require('../db');
    const result = await pool.query(
      `SELECT al.*, u.username, u.email
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.entity_type = $1 AND al.entity_id = $2
       ORDER BY al.created_at DESC
       LIMIT $3 OFFSET $4`,
      [entityType, entityId, parsedLimit, parsedOffset]
    );

    res.json({
      logs: result.rows,
      count: result.rows.length,
      entityType,
      entityId,
    });
  } catch (error) {
    console.error('Get entity audit logs error:', error);
    res.status(500).json({
      error: 'Failed to get entity audit logs',
      message: error.message,
    });
  }
});

/**
 * GET /api/audit-logs/user/:userId
 * Get audit logs for a specific user
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { limit, offset, startDate, endDate } = req.query;

    if (isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'User ID must be a valid number',
      });
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return res.status(400).json({
        error: 'Invalid parameters',
        message: 'Limit and offset must be valid numbers',
      });
    }

    const logs = await getAuditLogs({
      userId,
      limit: parsedLimit,
      offset: parsedOffset,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.json({
      logs,
      count: logs.length,
      userId,
    });
  } catch (error) {
    console.error('Get user audit logs error:', error);
    res.status(500).json({
      error: 'Failed to get user audit logs',
      message: error.message,
    });
  }
});

module.exports = router;
