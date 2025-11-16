/**
 * Authentication Database Operations
 * Handles CRUD operations for users, API keys, tokens, and audit logs
 */

const pool = require('../db');
const { hashPassword, hashToken, sanitizeUser } = require('./auth');

// ============================================================================
// User Operations
// ============================================================================

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user (without password hash)
 */
async function createUser(userData) {
  const { username, email, password, role = 'viewer' } = userData;

  const passwordHash = await hashPassword(password);

  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id, username, email, role, is_active, created_at, updated_at`,
    [username, email, passwordHash, role]
  );

  return result.rows[0];
}

/**
 * Get user by ID
 * @param {number} id - User ID
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserById(id) {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Get user by username
 * @param {string} username - Username
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserByUsername(username) {
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );

  return result.rows[0] || null;
}

/**
 * Get user by email
 * @param {string} email - Email address
 * @returns {Promise<Object|null>} User object or null
 */
async function getUserByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  return result.rows[0] || null;
}

/**
 * Get all users
 * @param {Object} options - Query options (limit, offset, role, is_active)
 * @returns {Promise<Array>} Array of users (without password hashes)
 */
async function getAllUsers(options = {}) {
  const { limit = 100, offset = 0, role, is_active } = options;

  let query = 'SELECT id, username, email, role, is_active, created_at, updated_at, last_login FROM users WHERE 1=1';
  const params = [];
  let paramCount = 0;

  if (role !== undefined) {
    paramCount++;
    query += ` AND role = $${paramCount}`;
    params.push(role);
  }

  if (is_active !== undefined) {
    paramCount++;
    query += ` AND is_active = $${paramCount}`;
    params.push(is_active);
  }

  paramCount++;
  query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
  params.push(limit);

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(offset);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Update user
 * @param {number} id - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user (without password hash)
 */
async function updateUser(id, updates) {
  const allowedFields = ['username', 'email', 'role', 'is_active'];
  const fields = [];
  const values = [];
  let paramCount = 0;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      paramCount++;
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }

  paramCount++;
  values.push(id);

  const query = `
    UPDATE users
    SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramCount}
    RETURNING id, username, email, role, is_active, created_at, updated_at, last_login
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Update user password
 * @param {number} id - User ID
 * @param {string} newPassword - New password (plain text)
 * @returns {Promise<boolean>} Success
 */
async function updateUserPassword(id, newPassword) {
  const passwordHash = await hashPassword(newPassword);

  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [passwordHash, id]
  );

  return true;
}

/**
 * Update user last login timestamp
 * @param {number} id - User ID
 * @returns {Promise<boolean>} Success
 */
async function updateUserLastLogin(id) {
  await pool.query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [id]
  );

  return true;
}

/**
 * Delete user
 * @param {number} id - User ID
 * @returns {Promise<boolean>} Success
 */
async function deleteUser(id) {
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  return true;
}

// ============================================================================
// API Key Operations
// ============================================================================

/**
 * Create API key for user
 * @param {number} userId - User ID
 * @param {string} name - Key name/description
 * @param {string} key - Generated API key (plain text)
 * @param {Date|null} expiresAt - Expiration date
 * @returns {Promise<Object>} Created API key record (without key hash)
 */
async function createApiKey(userId, name, key, expiresAt = null) {
  const keyHash = hashToken(key);

  const result = await pool.query(
    `INSERT INTO api_keys (user_id, key_hash, name, expires_at, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id, user_id, name, created_at, expires_at, is_active`,
    [userId, keyHash, name, expiresAt]
  );

  return result.rows[0];
}

/**
 * Get API key by hash
 * @param {string} keyHash - SHA-256 hash of API key
 * @returns {Promise<Object|null>} API key object or null
 */
async function getApiKeyByHash(keyHash) {
  const result = await pool.query(
    'SELECT * FROM api_keys WHERE key_hash = $1',
    [keyHash]
  );

  return result.rows[0] || null;
}

/**
 * Get all API keys for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of API keys
 */
async function getUserApiKeys(userId) {
  const result = await pool.query(
    `SELECT id, user_id, name, created_at, last_used, expires_at, is_active
     FROM api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Update API key last used timestamp
 * @param {number} id - API key ID
 * @returns {Promise<boolean>} Success
 */
async function updateApiKeyLastUsed(id) {
  await pool.query(
    'UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = $1',
    [id]
  );

  return true;
}

/**
 * Revoke (deactivate) API key
 * @param {number} id - API key ID
 * @returns {Promise<boolean>} Success
 */
async function revokeApiKey(id) {
  await pool.query(
    'UPDATE api_keys SET is_active = false WHERE id = $1',
    [id]
  );

  return true;
}

/**
 * Delete API key
 * @param {number} id - API key ID
 * @returns {Promise<boolean>} Success
 */
async function deleteApiKey(id) {
  await pool.query('DELETE FROM api_keys WHERE id = $1', [id]);
  return true;
}

// ============================================================================
// Password Reset Token Operations
// ============================================================================

/**
 * Create password reset token
 * @param {number} userId - User ID
 * @param {string} token - Generated token (plain text)
 * @param {number} expiryMinutes - Token expiry in minutes (default 60)
 * @returns {Promise<Object>} Created token record
 */
async function createPasswordResetToken(userId, token, expiryMinutes = 60) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const result = await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, created_at, expires_at`,
    [userId, tokenHash, expiresAt]
  );

  return result.rows[0];
}

/**
 * Get password reset token by hash
 * @param {string} tokenHash - SHA-256 hash of token
 * @returns {Promise<Object|null>} Token object or null
 */
async function getPasswordResetToken(tokenHash) {
  const result = await pool.query(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = $1
     AND used_at IS NULL
     AND expires_at > CURRENT_TIMESTAMP`,
    [tokenHash]
  );

  return result.rows[0] || null;
}

/**
 * Mark password reset token as used
 * @param {number} id - Token ID
 * @returns {Promise<boolean>} Success
 */
async function markPasswordResetTokenUsed(id) {
  await pool.query(
    'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1',
    [id]
  );

  return true;
}

/**
 * Delete expired password reset tokens
 * @returns {Promise<number>} Number of deleted tokens
 */
async function cleanupExpiredPasswordResetTokens() {
  const result = await pool.query(
    'DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP'
  );

  return result.rowCount;
}

// ============================================================================
// Refresh Token Operations
// ============================================================================

/**
 * Create refresh token
 * @param {number} userId - User ID
 * @param {string} token - Generated refresh token (plain text)
 * @param {number} expiryDays - Token expiry in days (default 7)
 * @param {Object} deviceInfo - Device info (ip_address, user_agent)
 * @returns {Promise<Object>} Created refresh token record
 */
async function createRefreshToken(userId, token, expiryDays = 7, deviceInfo = {}) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const result = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, device_info)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, created_at, expires_at`,
    [userId, tokenHash, expiresAt, deviceInfo.ip_address || null, deviceInfo.user_agent || null]
  );

  return result.rows[0];
}

/**
 * Get refresh token by hash
 * @param {string} tokenHash - SHA-256 hash of token
 * @returns {Promise<Object|null>} Token object or null
 */
async function getRefreshToken(tokenHash) {
  const result = await pool.query(
    `SELECT * FROM refresh_tokens
     WHERE token_hash = $1
     AND revoked_at IS NULL
     AND expires_at > CURRENT_TIMESTAMP`,
    [tokenHash]
  );

  return result.rows[0] || null;
}

/**
 * Revoke refresh token
 * @param {string} tokenHash - SHA-256 hash of token
 * @returns {Promise<boolean>} Success
 */
async function revokeRefreshToken(tokenHash) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
    [tokenHash]
  );

  return true;
}

/**
 * Revoke all refresh tokens for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} Number of revoked tokens
 */
async function revokeAllUserRefreshTokens(userId) {
  const result = await pool.query(
    'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL',
    [userId]
  );

  return result.rowCount;
}

// ============================================================================
// Audit Log Operations
// ============================================================================

/**
 * Create audit log entry
 * @param {Object} logData - Audit log data
 * @returns {Promise<Object>} Created audit log entry
 */
async function createAuditLog(logData) {
  const { userId, action, entityType, entityId, changes, ipAddress, userAgent } = logData;

  const result = await pool.query(
    `INSERT INTO audit_log (user_id, action, entity_type, entity_id, changes, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, action, entityType, entityId, changes, ipAddress, userAgent]
  );

  return result.rows[0];
}

/**
 * Get audit logs with filtering
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of audit log entries
 */
async function getAuditLogs(options = {}) {
  const { limit = 100, offset = 0, userId, entityType, action, startDate, endDate } = options;

  let query = `
    SELECT al.*, u.username, u.email
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;

  if (userId) {
    paramCount++;
    query += ` AND al.user_id = $${paramCount}`;
    params.push(userId);
  }

  if (entityType) {
    paramCount++;
    query += ` AND al.entity_type = $${paramCount}`;
    params.push(entityType);
  }

  if (action) {
    paramCount++;
    query += ` AND al.action = $${paramCount}`;
    params.push(action);
  }

  if (startDate) {
    paramCount++;
    query += ` AND al.created_at >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    query += ` AND al.created_at <= $${paramCount}`;
    params.push(endDate);
  }

  paramCount++;
  query += ` ORDER BY al.created_at DESC LIMIT $${paramCount}`;
  params.push(limit);

  paramCount++;
  query += ` OFFSET $${paramCount}`;
  params.push(offset);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get audit log statistics
 * @param {Object} options - Query options (userId, startDate, endDate)
 * @returns {Promise<Object>} Statistics object
 */
async function getAuditLogStats(options = {}) {
  const { userId, startDate, endDate } = options;

  let query = `
    SELECT
      COUNT(*) as total_actions,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT entity_type) as unique_entity_types,
      jsonb_object_agg(action, action_count) as actions_by_type
    FROM (
      SELECT action, COUNT(*) as action_count
      FROM audit_log
      WHERE 1=1
  `;
  const params = [];
  let paramCount = 0;

  if (userId) {
    paramCount++;
    query += ` AND user_id = $${paramCount}`;
    params.push(userId);
  }

  if (startDate) {
    paramCount++;
    query += ` AND created_at >= $${paramCount}`;
    params.push(startDate);
  }

  if (endDate) {
    paramCount++;
    query += ` AND created_at <= $${paramCount}`;
    params.push(endDate);
  }

  query += ' GROUP BY action) as action_stats';

  const result = await pool.query(query, params);
  return result.rows[0];
}

module.exports = {
  // User operations
  createUser,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  getAllUsers,
  updateUser,
  updateUserPassword,
  updateUserLastLogin,
  deleteUser,

  // API key operations
  createApiKey,
  getApiKeyByHash,
  getUserApiKeys,
  updateApiKeyLastUsed,
  revokeApiKey,
  deleteApiKey,

  // Password reset operations
  createPasswordResetToken,
  getPasswordResetToken,
  markPasswordResetTokenUsed,
  cleanupExpiredPasswordResetTokens,

  // Refresh token operations
  createRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,

  // Audit log operations
  createAuditLog,
  getAuditLogs,
  getAuditLogStats,
};
