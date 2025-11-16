/**
 * Authentication Middleware
 * Express middleware for JWT authentication and role-based authorization
 */

const { verifyAccessToken, hashToken } = require('./auth');
const { getUserById, getApiKeyByHash, updateApiKeyLastUsed } = require('./auth-db');

// Cache database availability status to avoid checking on every request
let dbAvailableCache = null;
let dbAvailableCacheTime = 0;
const DB_CACHE_TTL = 60000; // Cache for 60 seconds

/**
 * Check if database is available with caching
 * @returns {Promise<boolean>}
 */
async function isDatabaseAvailable() {
  const now = Date.now();
  if (dbAvailableCache !== null && (now - dbAvailableCacheTime) < DB_CACHE_TTL) {
    return dbAvailableCache;
  }

  const { testConnection } = require('../db');
  try {
    const available = await testConnection();
    dbAvailableCache = available;
    dbAvailableCacheTime = now;
    return available;
  } catch (error) {
    dbAvailableCache = false;
    dbAvailableCacheTime = now;
    return false;
  }
}

/**
 * Extract token from Authorization header or cookie
 * @param {Object} req - Express request
 * @returns {string|null} JWT token or null
 */
function extractToken(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }

  // Check API key header
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    return apiKey;
  }

  return null;
}

/**
 * Authenticate user via JWT token or API key
 * Attaches user object to req.user if authenticated
 * Falls back to allowing all requests if database is unavailable (JSON file mode)
 */
async function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    // Check if database is available (with caching to avoid performance issues)
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // Database unavailable - allow request without authentication (development/JSON file mode)
      console.log('[Auth] Database unavailable - bypassing authentication');
      return next();
    }

    return res.status(401).json({
      error: 'Authentication required',
      message: 'No authentication token provided',
    });
  }

  // Check if it's an API key (starts with wra_)
  if (token.startsWith('wra_')) {
    try {
      const keyHash = hashToken(token);
      const apiKey = await getApiKeyByHash(keyHash);

      if (!apiKey) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'API key not found or expired',
        });
      }

      if (!apiKey.is_active) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'API key has been deactivated',
        });
      }

      if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'API key has expired',
        });
      }

      // Get user associated with API key
      const user = await getUserById(apiKey.user_id);

      if (!user || !user.is_active) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'User account is inactive',
        });
      }

      // Attach user to request
      req.user = user;
      req.authMethod = 'api-key';
      req.apiKeyId = apiKey.id;

      // Update last_used timestamp (non-blocking)
      updateApiKeyLastUsed(apiKey.id).catch(err => {
        console.error('Failed to update API key last_used:', err);
      });

      return next();
    } catch (error) {
      console.error('API key authentication error:', error);
      return res.status(500).json({
        error: 'Authentication error',
        message: 'Failed to authenticate API key',
      });
    }
  }

  // Verify JWT token
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Token is invalid or expired',
    });
  }

  try {
    // Get user from database
    const user = await getUserById(payload.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found',
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated',
      });
    }

    // Attach user to request
    req.user = user;
    req.authMethod = 'jwt';

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to authenticate user',
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for endpoints that work differently for authenticated users
 */
async function optionalAuthenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  // Check if it's an API key (starts with wra_)
  if (token.startsWith('wra_')) {
    try {
      const keyHash = hashToken(token);
      const apiKey = await getApiKeyByHash(keyHash);

      if (apiKey && apiKey.is_active && (!apiKey.expires_at || new Date(apiKey.expires_at) >= new Date())) {
        const user = await getUserById(apiKey.user_id);
        if (user && user.is_active) {
          req.user = user;
          req.authMethod = 'api-key';
          req.apiKeyId = apiKey.id;

          // Update last_used timestamp (non-blocking)
          updateApiKeyLastUsed(apiKey.id).catch(err => {
            console.error('Failed to update API key last_used:', err);
          });
        }
      }
    } catch (error) {
      // Continue without authentication
    }
    return next();
  }

  // Try to verify JWT token
  const payload = verifyAccessToken(token);
  if (payload) {
    try {
      const user = await getUserById(payload.userId);
      if (user && user.is_active) {
        req.user = user;
        req.authMethod = 'jwt';
      }
    } catch (error) {
      // Continue without authentication
    }
  }

  next();
}

/**
 * Require specific role(s) to access endpoint
 * Must be used after authenticate middleware
 * @param {string|string[]} roles - Required role(s)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to access this resource',
      });
    }

    const userRole = req.user.role;
    const allowedRoles = roles.flat();

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Require admin role
 * Allows all requests if database is unavailable (JSON file mode)
 */
async function requireAdmin(req, res, next) {
  // If no user is attached, check if database is available
  if (!req.user) {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // Database unavailable - allow request without role check
      return next();
    }
  }
  return requireRole('admin')(req, res, next);
}

/**
 * Require admin or editor role
 * Allows all requests if database is unavailable (JSON file mode)
 */
async function requireEditor(req, res, next) {
  // If no user is attached, check if database is available
  if (!req.user) {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      // Database unavailable - allow request without role check
      return next();
    }
  }
  return requireRole('admin', 'editor')(req, res, next);
}

/**
 * Check if user can modify a resource
 * Admins can modify anything
 * Editors can modify their own resources
 * Viewers cannot modify anything
 */
function canModify(resourceUserId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to modify this resource',
      });
    }

    const userRole = req.user.role;

    // Admins can modify anything
    if (userRole === 'admin') {
      return next();
    }

    // Viewers cannot modify anything
    if (userRole === 'viewer') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Viewers cannot modify resources',
      });
    }

    // Editors can modify their own resources
    if (userRole === 'editor' && req.user.id === resourceUserId) {
      return next();
    }

    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to modify this resource',
    });
  };
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireAdmin,
  requireEditor,
  canModify,
};
