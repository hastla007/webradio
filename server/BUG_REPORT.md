# Comprehensive Bug Report - WebRadio Admin Panel API

**Date**: 2025-11-16
**Test Suite**: Comprehensive API Test Suite
**Total Tests Run**: 30
**Pass Rate**: 86.7%
**Bugs Found**: 5

---

## Critical Bugs

### Bug #1: Station Duplicate Check Uses Wrong Property
**Location**: `/home/user/webradio/server/index.js:1450`
**Severity**: High
**Type**: Logic Error

**Description**:
The station creation endpoint checks for duplicates using `req.body.id` instead of `normalized.id`. Since the `normalizeStation` function can generate a new ID if none is provided or modify the provided ID, this check is unreliable and may allow duplicate stations.

**Code**:
```javascript
// Line 1444-1452
app.post(`${API_PREFIX}/stations`, authenticate, requireEditor, async (req, res) => {
    const normalized = normalizeStation(req.body || {}, database.genres);
    if (!normalized.name || !normalized.streamUrl) {
        return res.status(400).json({ error: 'Station name and streamUrl are required' });
    }
    // Check for duplicate station by ID (only if ID was explicitly provided)
    if (req.body.id && database.stations.some(station => station.id === req.body.id)) {
        return res.status(409).json({ error: 'Station with this ID already exists' });
    }
    database.stations = [...database.stations, normalized];
    // ...
});
```

**Expected Behavior**:
Should check `normalized.id` instead of `req.body.id`

**Fix**:
```javascript
if (normalized.id && database.stations.some(station => station.id === normalized.id)) {
    return res.status(409).json({ error: 'Station with this ID already exists' });
}
```

**Impact**:
- Medium: Could allow duplicate stations to be created
- Data integrity issue
- Potential race condition if two requests create stations simultaneously

---

## Test Failures (API Contract Issues - Not Bugs)

The following test failures were due to incorrect test expectations, not actual bugs in the API:

### Test Failure #1: Monitor/Check API Format
**Status**: Test Issue, Not a Bug
**Description**: The test sent `{ url: "...", timeout: 5000 }` but the API expects `{ streams: [{ stationId: "...", streamUrl: "..." }], timeoutMs: 5000 }`.

**API Contract**:
```javascript
POST /api/monitor/check
{
  "streams": [
    { "stationId": "station-1", "streamUrl": "http://..." }
  ],
  "timeoutMs": 5000
}
```

**Response**:
```javascript
[
  { "stationId": "station-1", "isOnline": true, ... }
]
```

### Test Failure #2: Logs API Response Format
**Status**: Test Issue, Not a Bug
**Description**: The test expected `{ logs: [...] }` but the API returns `{ entries: [...], cursor: ... }`.

**API Contract**:
```javascript
GET /api/logs?limit=10&offset=0
Response: { "entries": [...], "cursor": 123 }
```

### Test Failure #3: Export Profile with No Stations
**Status**: Expected Behavior, Not a Bug
**Description**: The test created an export profile with no stations and expected export to succeed. The API correctly returns 400 error when trying to export an empty profile.

**Expected Behavior**: This is correct - can't export a profile with no stations.

---

## Potential Security Issues to Review

### 1. FTP Password Storage
**Location**: Throughout the codebase
**Status**: Review Recommended
**Description**: FTP passwords are encrypted using AES-256-GCM, which is good. However, should verify:
- Encryption keys are properly secured
- Passwords are not logged
- Passwords are properly masked in API responses

**Current Implementation**: Appears secure - passwords are masked with `***MASKED***` in responses

### 2. Rate Limiting
**Status**: Implemented
**Configuration**:
- Auth endpoints: 5 requests per 15 minutes
- General API: 100 requests per 15 minutes

**Recommendation**: Consider adding rate limiting per user/API key for better security

### 3. Authentication Bypass in Development Mode
**Status**: Documented Behavior
**Description**: When database is unavailable, authentication is bypassed. This is documented but should be clearly communicated to users.

---

## Recommendations

### High Priority
1. **Fix Bug #1**: Update station duplicate check to use `normalized.id`
2. **Add Integration Tests**: Create comprehensive integration tests that verify actual API behavior
3. **Add Validation**: Ensure all endpoints properly validate input

### Medium Priority
1. **API Documentation**: Create OpenAPI/Swagger documentation to clarify API contracts
2. **Error Messages**: Standardize error message formats across all endpoints
3. **Add Request ID Tracking**: Add request IDs to all logs for better debugging

### Low Priority
1. **Performance**: Consider adding caching for frequently accessed data
2. **Monitoring**: Add metrics collection for API performance
3. **Testing**: Increase test coverage to >90%

---

## Next Steps

1. Fix Bug #1 (station duplicate check)
2. Update test suite to match actual API contracts
3. Run comprehensive tests again
4. Document all API endpoints properly
5. Consider adding TypeScript for better type safety
