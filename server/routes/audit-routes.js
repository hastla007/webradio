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

    const logs = await getAuditLogs({
      entityType,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    // Filter by entity ID (client-side for now since entityId is VARCHAR)
    const filteredLogs = logs.filter(log => log.entity_id === entityId);

    res.json({
      logs: filteredLogs,
      count: filteredLogs.length,
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

    const logs = await getAuditLogs({
      userId,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
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
