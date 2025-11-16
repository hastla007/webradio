/**
 * User Management API Routes
 * Admin-only routes for managing users
 */

const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserApiKeys,
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  createAuditLog,
} = require('../auth/auth-db');

const {
  generateApiKey,
  validatePasswordStrength,
  sanitizeUser,
} = require('../auth/auth');

const {
  authenticate,
  requireAdmin,
  requireRole,
} = require('../auth/auth-middleware');

// Helper to get client IP
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.ip || req.connection.remoteAddress;
}

// Helper to log audit event
async function logAudit(userId, action, entityType, entityId, req, changes = null) {
  try {
    await createAuditLog({
      userId,
      action,
      entityType,
      entityId,
      changes,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

// All routes require authentication
router.use(authenticate);

// ============================================================================
// User Management Routes
// ============================================================================

/**
 * GET /api/users
 * Get all users (Admin only)
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { limit, offset, role, is_active } = req.query;

    const users = await getAllUsers({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      role,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
    });

    res.json({
      users: users.map(sanitizeUser),
      count: users.length,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Failed to get users',
      message: error.message,
    });
  }
});

/**
 * GET /api/users/:id
 * Get user by ID (Admin only or own profile)
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // Check if user is accessing their own profile or is admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own profile',
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with ID ${userId} does not exist`,
      });
    }

    res.json({
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: error.message,
    });
  }
});

/**
 * POST /api/users
 * Create a new user (Admin only)
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, role = 'viewer' } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Username, email, and password are required',
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'Password does not meet security requirements',
        details: passwordValidation.errors,
      });
    }

    // Validate role
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role',
        message: 'Role must be admin, editor, or viewer',
      });
    }

    const user = await createUser({ username, email, password, role });

    await logAudit(req.user.id, 'CREATE', 'user', user.id, req, {
      created_user: sanitizeUser(user),
    });

    res.status(201).json({
      message: 'User created successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Create user error:', error);

    if (error.code === '23505') { // PostgreSQL unique constraint violation
      return res.status(409).json({
        error: 'User already exists',
        message: 'Username or email already exists',
      });
    }

    res.status(500).json({
      error: 'Failed to create user',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/users/:id
 * Update user (Admin only or own profile)
 */
router.patch('/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const updates = req.body;

    // Check if user is updating their own profile or is admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own profile',
      });
    }

    // Non-admins cannot change role or is_active
    if (req.user.role !== 'admin') {
      delete updates.role;
      delete updates.is_active;
    }

    // Prevent users from deactivating themselves
    if (req.user.id === userId && updates.is_active === false) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'You cannot deactivate your own account',
      });
    }

    const oldUser = await getUserById(userId);

    const user = await updateUser(userId, updates);

    await logAudit(req.user.id, 'UPDATE', 'user', userId, req, {
      old: sanitizeUser(oldUser),
      new: sanitizeUser(user),
    });

    res.json({
      message: 'User updated successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Update user error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username or email already exists',
      });
    }

    res.status(500).json({
      error: 'Failed to update user',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user (Admin only, cannot delete self)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // Prevent admin from deleting themselves
    if (req.user.id === userId) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'You cannot delete your own account',
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: `User with ID ${userId} does not exist`,
      });
    }

    await deleteUser(userId);

    await logAudit(req.user.id, 'DELETE', 'user', userId, req, {
      deleted_user: sanitizeUser(user),
    });

    res.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      error: 'Failed to delete user',
      message: error.message,
    });
  }
});

// ============================================================================
// API Key Management Routes
// ============================================================================

/**
 * GET /api/users/:id/api-keys
 * Get all API keys for a user (Admin or own keys)
 */
router.get('/:id/api-keys', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    // Check if user is accessing their own keys or is admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own API keys',
      });
    }

    const apiKeys = await getUserApiKeys(userId);

    res.json({
      apiKeys,
      count: apiKeys.length,
    });
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({
      error: 'Failed to get API keys',
      message: error.message,
    });
  }
});

/**
 * POST /api/users/:id/api-keys
 * Create API key for user (Admin or own keys)
 */
router.post('/:id/api-keys', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { name, expiresAt } = req.body;

    // Check if user is creating their own key or is admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only create API keys for yourself',
      });
    }

    if (!name) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'API key name is required',
      });
    }

    // Generate API key
    const apiKey = generateApiKey();

    // Create API key record
    const apiKeyRecord = await createApiKey(
      userId,
      name,
      apiKey,
      expiresAt ? new Date(expiresAt) : null
    );

    await logAudit(req.user.id, 'CREATE', 'api_key', apiKeyRecord.id, req, {
      user_id: userId,
      name,
    });

    res.status(201).json({
      message: 'API key created successfully',
      apiKey, // Only shown once!
      record: apiKeyRecord,
      warning: 'Save this API key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({
      error: 'Failed to create API key',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/users/:userId/api-keys/:keyId
 * Delete/revoke API key (Admin or own keys)
 */
router.delete('/:userId/api-keys/:keyId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const keyId = parseInt(req.params.keyId, 10);

    // Check if user is deleting their own key or is admin
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own API keys',
      });
    }

    await revokeApiKey(keyId);

    await logAudit(req.user.id, 'DELETE', 'api_key', keyId, req);

    res.json({
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({
      error: 'Failed to revoke API key',
      message: error.message,
    });
  }
});

module.exports = router;
