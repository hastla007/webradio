# API Bugs Found

## Critical Bugs

### Bug #1: Incorrect Database Pool Import ❌ CRITICAL
**File:** `server/auth/auth-db.js:6`
**Issue:** Pool is imported incorrectly
```javascript
// Current (WRONG):
const pool = require('../db');

// Should be:
const { pool } = require('../db');
```
**Impact:** All authentication database operations will fail with "pool.query is not a function"

### Bug #2: Refresh Token Verification Logic Error ❌ CRITICAL
**File:** `server/routes/auth-routes.js:178-180, 230`
**Issue:** The code generates both a random hex token AND a JWT, but mixes them up
```javascript
// Line 178-179: Creates BOTH a random token and JWT
const refreshTokenValue = generateSecureToken(32); // Random hex string
const refreshToken = generateRefreshToken({ userId: user.id }); // JWT (UNUSED!)

// Line 182: Stores the random hex string
await createRefreshToken(user.id, refreshTokenValue, 7, {...});

// Line 193: Sends random hex string as cookie
res.cookie('refresh_token', refreshTokenValue, {...});

// Line 230 in /refresh endpoint: Tries to verify hex string as JWT (FAILS!)
const payload = verifyRefreshToken(refreshToken);
```
**Impact:** Refresh token endpoint will always fail because it tries to verify a random hex string as a JWT

### Bug #3: optionalAuthenticate Middleware Logic Error ❌
**File:** `server/auth/auth-middleware.js:147-161`
**Issue:** The function calls `next()` multiple times and doesn't handle response sending correctly
```javascript
async function optionalAuthenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(); // Called here
  }
  try {
    await authenticate(req, res, next); // authenticate() also calls next() on success
  } catch (error) {
    next(); // Called again here - DOUBLE CALL!
  }
}
```
**Impact:** Can cause "headers already sent" errors and double execution of route handlers

## Issues to Review

### Issue #1: Missing Authentication on Main API Endpoints
**File:** `server/index.js`
**Details:** Main endpoints (genres, stations, player-apps, export-profiles) don't require authentication, even though auth system exists. Comment on line 1275 says "now with optional authentication" but `optionalAuthenticate` middleware is imported but never used.
**Question:** Should these endpoints require authentication?

### Issue #2: Incomplete Data Validation
**File:** Multiple route files
**Details:** Some endpoints lack comprehensive input validation (e.g., email format, URL validation, etc.)

## Testing Needed
1. Database connectivity
2. Authentication flow (register, login, refresh, logout)
3. All CRUD operations for genres, stations, player-apps, export-profiles
4. FTP functionality
5. Monitoring endpoints
6. Export/download functionality
