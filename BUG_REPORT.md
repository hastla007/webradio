# Bug Report - WebRadio Admin Panel

## Critical Bugs

### 1. SQL Parameter Mismatch in createPlayerApp Function
**Severity**: CRITICAL
**File**: `server/db_operations.js:219-244`
**Impact**: This bug will cause database insertion failures when creating player apps

**Description**:
The INSERT statement for creating a player app has a parameter count mismatch:
- The query declares 17 columns to insert
- The VALUES clause only has 16 placeholders ($1 through $16)
- The array provides 17 values

**Location**:
```javascript
const result = await pool.query(
    `INSERT INTO player_apps (
        id, name, platforms, platform, description, contact_email, notes,
        ftp_enabled, ftp_server, ftp_username, ftp_password, ftp_protocol, ftp_timeout_ms, network_code,
        ima_enabled, video_preroll_default_size, placements
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    // Missing $17 for 'placements' column!
```

**Fix**: Add `$17` to the VALUES clause:
```javascript
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
```

---

## Security Issues

### 2. Hardcoded Database Passwords
**Severity**: HIGH
**Files**:
- `docker-compose.yml:10,37`
- `server/.env:11`
- `server/db.js:8`

**Impact**: Exposes database credentials in version control and default configurations

**Description**:
The database password `changeme123` is hardcoded in multiple locations:

1. **docker-compose.yml** (lines 10 and 37):
```yaml
POSTGRES_PASSWORD: changeme123
DB_PASSWORD: changeme123
```

2. **server/.env** (line 11):
```
DB_PASSWORD=changeme123
```

3. **server/db.js** (line 8):
```javascript
password: process.env.DB_PASSWORD || 'changeme123',
```

**Recommendation**:
- Remove hardcoded passwords from all committed files
- Use strong, randomly generated passwords
- Add `.env` to `.gitignore` if not already present
- Provide `.env.example` with placeholder values
- Document password requirements in deployment documentation

---

### 3. Weak Default Encryption Key
**Severity**: MEDIUM
**File**: `server/secrets.js:14-38`
**Impact**: FTP passwords encrypted with a predictable key when environment variable is not set

**Description**:
When no encryption secret is provided via environment variables, the system falls back to a hardcoded development secret:

```javascript
if (!rawSecret) {
    if (!loggedMissingKey) {
        logger.warn(..., 'FTP password secret not configured. Falling back to development default.');
        loggedMissingKey = true;
    }
    cachedKey = crypto.createHash('sha256').update('webradio-development-secret').digest();
    return cachedKey;
}
```

**Recommendation**:
- Require `FTP_PASSWORD_SECRET` or similar environment variable in production
- Add validation to fail startup if encryption secret is not set in production mode
- Update deployment documentation to emphasize the importance of this secret

---

### 4. FTP Password Visible in Process Listings
**Severity**: LOW
**File**: `server/ftp.js:131`
**Impact**: FTP passwords may be visible in system process listings

**Description**:
The FTP password is passed directly to curl via the command line:

```javascript
const args = ['--silent', '--show-error', '--fail', '--connect-timeout', String(timeoutSeconds), '--user', buildUserPassword(config.username, config.password)];
```

Where `buildUserPassword` returns `username:password` as a single string argument.

**Note**: This is a limitation of using curl for FTP operations. The password may be visible in process listings (ps, top, etc.) while the curl command is running.

**Recommendation**:
- Consider using a library like `basic-ftp` instead of spawning curl
- If curl must be used, document this security consideration
- Alternatively, use curl's `--netrc-file` option with a temporary file

---

## Logic Bugs

### 5. Monitoring Interval Restart on Station Changes
**Severity**: MEDIUM
**File**: `App.tsx:536`
**Impact**: Monitoring intervals restart whenever stations array changes, causing unnecessary API calls

**Description**:
The monitoring useEffect has `stations` in its dependency array:

```typescript
}, [monitoringSettings.enabled, monitoringSettings.interval, runMonitoringCheck, stations]);
```

This causes the interval to be cleared and restarted every time the stations array changes (add, update, or delete operations). This can lead to:
- Excessive monitoring API calls
- Monitoring checks happening more frequently than configured
- Potential race conditions during rapid station updates

**Recommendation**:
- Remove `stations` from the dependency array
- Add `stations` as a dependency of `runMonitoringCheck` useCallback instead
- This ensures the monitoring function sees the latest stations without restarting the interval

---

### 6. Potential Timeout Error Handling Issue
**Severity**: LOW
**File**: `server/monitor.js:9-35`
**Impact**: Timeout errors may not be properly distinguished from network errors

**Description**:
When the AbortController aborts due to timeout, the error caught may not provide clear information that it was a timeout vs. a network error:

```javascript
try {
    const response = await fetch(streamUrl, {
        method,
        signal: controller.signal,
        headers: method === 'GET' ? { Range: 'bytes=0-0' } : undefined,
    });
    clearTimeout(timeoutId);
    // ...
} catch (error) {
    clearTimeout(timeoutId);
    return {
        isOnline: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - start,
    };
}
```

**Recommendation**:
- Check if the error is an AbortError and provide a more specific timeout message
- Example: `error.name === 'AbortError' ? 'Request timed out' : error.message`

---

## Configuration Issues

### 7. Environment Variables Not Validated
**Severity**: LOW
**Files**: Multiple server files
**Impact**: Missing environment variables may cause unexpected behavior with silent fallbacks

**Description**:
Many configuration values have fallbacks but don't warn or validate when using defaults:
- `PORT` defaults to 4000
- `API_PREFIX` defaults to '/api'
- `EXPORT_OUTPUT_DIR` has a relative path default
- Database credentials all have defaults

**Recommendation**:
- Add startup validation for critical environment variables
- Log warnings when using default values in production
- Consider using a library like `dotenv-safe` to validate required environment variables

---

## Code Quality Issues

### 8. Missing Error Handling for localStorage
**Severity**: LOW
**File**: `localDataStore.ts:186-196`
**Impact**: Silent failures when localStorage operations fail

**Description**:
localStorage operations are wrapped in try-catch blocks that silently ignore errors:

```typescript
function persist(data: DataShape) {
    inMemoryData = data;
    const storage = getStorage();
    if (storage) {
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
            // ignore persistence errors
        }
    }
}
```

**Recommendation**:
- At minimum, log the error to console
- Consider notifying the user when persistence fails
- This is especially important if users rely on offline mode

---

## Summary

**Critical**: 1 bug
**High Security**: 1 issue
**Medium**: 3 issues
**Low**: 3 issues

### Immediate Action Required:
1. Fix the SQL parameter mismatch in `server/db_operations.js:223` - this will cause runtime failures
2. Change all hardcoded passwords (`changeme123`) in configuration files
3. Set up proper encryption secrets for production deployments

### Recommended Improvements:
1. Fix the monitoring interval restart issue in `App.tsx:536`
2. Improve error messages for timeout scenarios
3. Add environment variable validation at startup
4. Consider replacing curl with a proper FTP library for better security
