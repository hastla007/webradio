/**
 * Authentication API Routes
 * Handles user registration, login, logout, password reset, and token refresh
 */

const express = require('express');
const router = express.Router();

const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  comparePassword,
  generateSecureToken,
  hashToken,
  validatePasswordStrength,
  sanitizeUser,
} = require('../auth/auth');

const {
  createUser,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  updateUser,
  updateUserPassword,
  updateUserLastLogin,
  createPasswordResetToken,
  getPasswordResetToken,
  markPasswordResetTokenUsed,
  createRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  createAuditLog,
} = require('../auth/auth-db');

const { authenticate, requireAdmin } = require('../auth/auth-middleware');

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

// ============================================================================
// Public Routes (No Authentication Required)
// ============================================================================

/**
 * POST /api/auth/register
 * Register a new user (admin only or if no users exist)
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

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

    // Check if username already exists
    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        error: 'Username already exists',
        message: 'Please choose a different username',
      });
    }

    // Check if email already exists
    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({
        error: 'Email already exists',
        message: 'An account with this email already exists',
      });
    }

    // Create user - always force 'viewer' role for public registration
    // Only admins can create users with elevated roles via the user management API
    const user = await createUser({ username, email, password, role: 'viewer' });

    await logAudit(user.id, 'CREATE', 'user', user.id, req);

    res.status(201).json({
      message: 'User registered successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return access + refresh tokens
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required',
      });
    }

    // Get user by username
    const user = await getUserByUsername(username);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect',
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated',
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const refreshTokenValue = generateSecureToken(32);

    // Store refresh token in database
    await createRefreshToken(user.id, refreshTokenValue, 7, {
      ip_address: getClientIp(req),
      user_agent: req.headers['user-agent'],
    });

    // Update last login
    await updateUserLastLogin(user.id);

    await logAudit(user.id, 'LOGIN', 'user', user.id, req);

    // Set refresh token as httpOnly cookie
    res.cookie('refresh_token', refreshTokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      message: 'Login successful',
      user: sanitizeUser(user),
      accessToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token || req.body.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({
        error: 'No refresh token',
        message: 'Refresh token is required',
      });
    }

    // Check if refresh token exists in database and is not revoked
    const tokenHash = hashToken(refreshToken);
    const storedToken = await getRefreshToken(tokenHash);

    if (!storedToken) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Refresh token has been revoked or does not exist',
      });
    }

    // Get user
    const user = await getUserById(storedToken.user_id);

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'Invalid user',
        message: 'User account is inactive or does not exist',
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({
      accessToken,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user and revoke refresh token
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token || req.body.refresh_token;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await revokeRefreshToken(tokenHash);
    }

    await logAudit(req.user.id, 'LOGOUT', 'user', req.user.id, req);

    // Clear refresh token cookie
    res.clearCookie('refresh_token');

    res.json({
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices (revoke all refresh tokens)
 */
router.post('/logout-all', authenticate, async (req, res) => {
  try {
    const revokedCount = await revokeAllUserRefreshTokens(req.user.id);

    await logAudit(req.user.id, 'LOGOUT_ALL', 'user', req.user.id, req);

    res.clearCookie('refresh_token');

    res.json({
      message: 'Logged out from all devices',
      revokedTokens: revokedCount,
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset token
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Missing email',
        message: 'Email address is required',
      });
    }

    const user = await getUserByEmail(email);

    // Don't reveal if user exists (security best practice)
    if (!user) {
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent',
      });
    }

    // Generate reset token
    const resetToken = generateSecureToken(32);
    await createPasswordResetToken(user.id, resetToken, 60); // 60 minutes

    await logAudit(user.id, 'PASSWORD_RESET_REQUEST', 'user', user.id, req);

    // TODO: Send email with reset link
    // For now, return token in response (NOT for production!)
    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        message: 'Password reset token generated',
        token: resetToken, // Remove this in production!
        resetUrl: `/reset-password?token=${resetToken}`,
      });
    }

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Password reset request failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Token and new password are required',
      });
    }

    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'Password does not meet security requirements',
        details: passwordValidation.errors,
      });
    }

    // Verify reset token
    const tokenHash = hashToken(token);
    const resetToken = await getPasswordResetToken(tokenHash);

    if (!resetToken) {
      return res.status(400).json({
        error: 'Invalid token',
        message: 'Password reset token is invalid or has expired',
      });
    }

    // Update password
    await updateUserPassword(resetToken.user_id, newPassword);

    // Mark token as used
    await markPasswordResetTokenUsed(resetToken.id);

    await logAudit(resetToken.user_id, 'PASSWORD_RESET', 'user', resetToken.user_id, req);

    // Revoke all refresh tokens (force logout from all devices)
    await revokeAllUserRefreshTokens(resetToken.user_id);

    res.json({
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change password (requires authentication)
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Current password and new password are required',
      });
    }

    // Get user with password hash
    const user = await getUserById(req.user.id);

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid password',
        message: 'Current password is incorrect',
      });
    }

    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'Password does not meet security requirements',
        details: passwordValidation.errors,
      });
    }

    // Update password
    await updateUserPassword(user.id, newPassword);

    await logAudit(user.id, 'PASSWORD_CHANGE', 'user', user.id, req);

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Password change failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      user: sanitizeUser(req.user),
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: 'Failed to get user',
      message: error.message,
    });
  }
});

module.exports = router;
