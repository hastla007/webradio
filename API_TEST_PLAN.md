# API Test Plan

## Overview
This document outlines comprehensive tests for all API endpoints in the WebRadio Admin Panel.

## Base URL
```
http://localhost:4000/api
```

## Test Prerequisites
1. PostgreSQL database running with migrations applied
2. Server running (`npm run api` from root directory)
3. Default admin user created (username: admin, password: admin123)

---

## Authentication Endpoints

### 1. POST /api/auth/register
**Purpose:** Register a new user

**Test Cases:**

#### TC-AUTH-001: Successful registration
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!@#",
    "role": "viewer"
  }'
```
**Expected:** 201 Created, user object returned

#### TC-AUTH-002: Weak password
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser2",
    "email": "test2@example.com",
    "password": "weak"
  }'
```
**Expected:** 400 Bad Request, password validation errors

#### TC-AUTH-003: Duplicate username
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "different@example.com",
    "password": "Test123!@#"
  }'
```
**Expected:** 409 Conflict, username exists error

#### TC-AUTH-004: Missing required fields
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser3"
  }'
```
**Expected:** 400 Bad Request, missing fields error

---

### 2. POST /api/auth/login
**Purpose:** Authenticate user and receive tokens

#### TC-AUTH-005: Successful login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }' \
  -c cookies.txt
```
**Expected:** 200 OK, access token and user object, refresh token in cookie

#### TC-AUTH-006: Invalid credentials
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "wrongpassword"
  }'
```
**Expected:** 401 Unauthorized, invalid credentials error

#### TC-AUTH-007: Inactive user
(First deactivate a user, then try to login)
**Expected:** 401 Unauthorized, account inactive error

---

### 3. POST /api/auth/refresh
**Purpose:** Refresh access token using refresh token

#### TC-AUTH-008: Successful token refresh
```bash
curl -X POST http://localhost:4000/api/auth/refresh \
  -b cookies.txt
```
**Expected:** 200 OK, new access token

#### TC-AUTH-009: Invalid refresh token
```bash
curl -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "invalid_token_here"
  }'
```
**Expected:** 401 Unauthorized, invalid token error

---

### 4. POST /api/auth/logout
**Purpose:** Logout user and revoke refresh token

#### TC-AUTH-010: Successful logout
```bash
TOKEN="<access_token_from_login>"
curl -X POST http://localhost:4000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" \
  -b cookies.txt
```
**Expected:** 200 OK, logout successful message

---

### 5. POST /api/auth/logout-all
**Purpose:** Logout from all devices

#### TC-AUTH-011: Logout from all devices
```bash
TOKEN="<access_token_from_login>"
curl -X POST http://localhost:4000/api/auth/logout-all \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, number of revoked tokens

---

### 6. POST /api/auth/forgot-password
**Purpose:** Request password reset token

#### TC-AUTH-012: Password reset request
```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@webradio.local"
  }'
```
**Expected:** 200 OK, reset token (in dev mode)

---

### 7. POST /api/auth/reset-password
**Purpose:** Reset password using token

#### TC-AUTH-013: Successful password reset
```bash
RESET_TOKEN="<token_from_forgot_password>"
curl -X POST http://localhost:4000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "'"$RESET_TOKEN"'",
    "newPassword": "NewPass123!@#"
  }'
```
**Expected:** 200 OK, password reset successful

---

### 8. POST /api/auth/change-password
**Purpose:** Change password (authenticated)

#### TC-AUTH-014: Successful password change
```bash
TOKEN="<access_token>"
curl -X POST http://localhost:4000/api/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "admin123",
    "newPassword": "NewPass123!@#"
  }'
```
**Expected:** 200 OK, password changed successfully

---

### 9. GET /api/auth/me
**Purpose:** Get current authenticated user

#### TC-AUTH-015: Get current user
```bash
TOKEN="<access_token>"
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, user object

---

## User Management Endpoints (Admin Only)

### 10. GET /api/users
**Purpose:** Get all users (admin only)

#### TC-USER-001: Get all users
```bash
TOKEN="<admin_access_token>"
curl -X GET http://localhost:4000/api/users \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, array of users

#### TC-USER-002: Get users with filters
```bash
TOKEN="<admin_access_token>"
curl -X GET "http://localhost:4000/api/users?role=admin&is_active=true&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, filtered users

---

### 11. GET /api/users/:id
**Purpose:** Get user by ID

#### TC-USER-003: Get user by ID (own profile)
```bash
TOKEN="<access_token>"
USER_ID="<user_id>"
curl -X GET http://localhost:4000/api/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, user object

---

### 12. POST /api/users
**Purpose:** Create new user (admin only)

#### TC-USER-004: Create new user
```bash
TOKEN="<admin_access_token>"
curl -X POST http://localhost:4000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "Test123!@#",
    "role": "editor"
  }'
```
**Expected:** 201 Created, user object

---

### 13. PATCH /api/users/:id
**Purpose:** Update user

#### TC-USER-005: Update user (admin)
```bash
TOKEN="<admin_access_token>"
USER_ID="<user_id>"
curl -X PATCH http://localhost:4000/api/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin",
    "is_active": true
  }'
```
**Expected:** 200 OK, updated user object

---

### 14. DELETE /api/users/:id
**Purpose:** Delete user (admin only)

#### TC-USER-006: Delete user
```bash
TOKEN="<admin_access_token>"
USER_ID="<user_id>"
curl -X DELETE http://localhost:4000/api/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, deletion confirmed

---

## API Key Management

### 15. GET /api/users/:id/api-keys
**Purpose:** Get all API keys for a user

#### TC-KEY-001: Get API keys
```bash
TOKEN="<access_token>"
USER_ID="<user_id>"
curl -X GET http://localhost:4000/api/users/$USER_ID/api-keys \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, array of API keys

---

### 16. POST /api/users/:id/api-keys
**Purpose:** Create API key

#### TC-KEY-002: Create API key
```bash
TOKEN="<access_token>"
USER_ID="<user_id>"
curl -X POST http://localhost:4000/api/users/$USER_ID/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key",
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
```
**Expected:** 201 Created, API key (shown once!)

---

### 17. DELETE /api/users/:userId/api-keys/:keyId
**Purpose:** Delete/revoke API key

#### TC-KEY-003: Delete API key
```bash
TOKEN="<access_token>"
USER_ID="<user_id>"
KEY_ID="<key_id>"
curl -X DELETE http://localhost:4000/api/users/$USER_ID/api-keys/$KEY_ID \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, key revoked

---

## Audit Log Endpoints (Admin Only)

### 18. GET /api/audit-logs
**Purpose:** Get audit logs with filtering

#### TC-AUDIT-001: Get all audit logs
```bash
TOKEN="<admin_access_token>"
curl -X GET http://localhost:4000/api/audit-logs \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, array of audit logs

#### TC-AUDIT-002: Get filtered audit logs
```bash
TOKEN="<admin_access_token>"
curl -X GET "http://localhost:4000/api/audit-logs?action=LOGIN&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, filtered audit logs

---

### 19. GET /api/audit-logs/stats
**Purpose:** Get audit log statistics

#### TC-AUDIT-003: Get audit stats
```bash
TOKEN="<admin_access_token>"
curl -X GET http://localhost:4000/api/audit-logs/stats \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200 OK, statistics object

---

## Main API Endpoints (Genres, Stations, etc.)

### 20. GET /api/health
**Purpose:** Health check

#### TC-SYS-001: Health check
```bash
curl -X GET http://localhost:4000/api/health
```
**Expected:** 200 OK, status: healthy

---

### 21. GET /api/genres
**Purpose:** Get all genres

#### TC-GENRE-001: Get all genres
```bash
curl -X GET http://localhost:4000/api/genres
```
**Expected:** 200 OK, array of genres

---

### 22. POST /api/genres
**Purpose:** Create genre

#### TC-GENRE-002: Create genre
```bash
curl -X POST http://localhost:4000/api/genres \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rock",
    "subGenres": ["Classic Rock", "Hard Rock", "Punk Rock"]
  }'
```
**Expected:** 200 OK, created genre

---

### 23. PUT /api/genres/:id
**Purpose:** Update genre

#### TC-GENRE-003: Update genre
```bash
GENRE_ID="<genre_id>"
curl -X PUT http://localhost:4000/api/genres/$GENRE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rock Music",
    "subGenres": ["Classic Rock", "Hard Rock", "Punk Rock", "Alternative Rock"]
  }'
```
**Expected:** 200 OK, updated genre

---

### 24. DELETE /api/genres/:id
**Purpose:** Delete genre

#### TC-GENRE-004: Delete genre
```bash
GENRE_ID="<genre_id>"
curl -X DELETE http://localhost:4000/api/genres/$GENRE_ID
```
**Expected:** 204 No Content

---

### 25. GET /api/stations
**Purpose:** Get all stations

#### TC-STATION-001: Get all stations
```bash
curl -X GET http://localhost:4000/api/stations
```
**Expected:** 200 OK, array of stations

---

### 26. POST /api/stations
**Purpose:** Create station

#### TC-STATION-002: Create station
```bash
curl -X POST http://localhost:4000/api/stations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rock Radio",
    "streamUrl": "http://stream.example.com/rock",
    "genreId": "<genre_id>",
    "description": "The best rock music",
    "bitrate": 128,
    "language": "en",
    "region": "US",
    "tags": ["rock", "music"],
    "imaAdType": "audio",
    "isActive": true
  }'
```
**Expected:** 200 OK, created station

---

### 27. PUT /api/stations/:id
**Purpose:** Update station

#### TC-STATION-003: Update station
```bash
STATION_ID="<station_id>"
curl -X PUT http://localhost:4000/api/stations/$STATION_ID \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rock Radio HD",
    "bitrate": 320,
    "isActive": true
  }'
```
**Expected:** 200 OK, updated station

---

### 28. DELETE /api/stations/:id
**Purpose:** Delete station

#### TC-STATION-004: Delete station
```bash
STATION_ID="<station_id>"
curl -X DELETE http://localhost:4000/api/stations/$STATION_ID
```
**Expected:** 204 No Content

---

### 29. GET /api/player-apps
**Purpose:** Get all player apps

#### TC-PLAYER-001: Get all player apps
```bash
curl -X GET http://localhost:4000/api/player-apps
```
**Expected:** 200 OK, array of player apps

---

### 30. POST /api/player-apps
**Purpose:** Create player app

#### TC-PLAYER-002: Create player app
```bash
curl -X POST http://localhost:4000/api/player-apps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iOS App",
    "platforms": ["ios"],
    "description": "iPhone/iPad radio app",
    "contactEmail": "dev@example.com",
    "networkCode": "12345678",
    "imaEnabled": true,
    "placements": {
      "preroll": "/12345678/webradio/audio_preroll",
      "midroll": "/12345678/webradio/video_preroll"
    }
  }'
```
**Expected:** 200 OK, created player app

---

### 31. POST /api/player-apps/test-ftp
**Purpose:** Test FTP connection

#### TC-PLAYER-003: Test FTP connection
```bash
curl -X POST http://localhost:4000/api/player-apps/test-ftp \
  -H "Content-Type: application/json" \
  -d '{
    "ftpServer": "ftp.example.com",
    "ftpUsername": "user",
    "ftpPassword": "pass",
    "ftpProtocol": "ftp",
    "ftpTimeout": 10000
  }'
```
**Expected:** 200 OK if valid, 400 if invalid

---

### 32. PUT /api/player-apps/:id
**Purpose:** Update player app

#### TC-PLAYER-004: Update player app
```bash
PLAYER_ID="<player_id>"
curl -X PUT http://localhost:4000/api/player-apps/$PLAYER_ID \
  -H "Content-Type: application/json" \
  -d '{
    "imaEnabled": false
  }'
```
**Expected:** 200 OK, updated player app

---

### 33. DELETE /api/player-apps/:id
**Purpose:** Delete player app

#### TC-PLAYER-005: Delete player app
```bash
PLAYER_ID="<player_id>"
curl -X DELETE http://localhost:4000/api/player-apps/$PLAYER_ID
```
**Expected:** 204 No Content

---

### 34. GET /api/export-profiles
**Purpose:** Get all export profiles

#### TC-EXPORT-001: Get all export profiles
```bash
curl -X GET http://localhost:4000/api/export-profiles
```
**Expected:** 200 OK, array of export profiles

---

### 35. POST /api/export-profiles
**Purpose:** Create export profile

#### TC-EXPORT-002: Create export profile
```bash
curl -X POST http://localhost:4000/api/export-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "iOS Export",
    "genreIds": ["<genre_id>"],
    "stationIds": [],
    "playerId": "<player_id>",
    "autoExport": {
      "enabled": false
    }
  }'
```
**Expected:** 200 OK, created export profile

---

### 36. PUT /api/export-profiles/:id
**Purpose:** Update export profile

#### TC-EXPORT-003: Update export profile
```bash
PROFILE_ID="<profile_id>"
curl -X PUT http://localhost:4000/api/export-profiles/$PROFILE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "autoExport": {
      "enabled": true,
      "interval": "daily",
      "time": "02:00"
    }
  }'
```
**Expected:** 200 OK, updated export profile

---

### 37. DELETE /api/export-profiles/:id
**Purpose:** Delete export profile

#### TC-EXPORT-004: Delete export profile
```bash
PROFILE_ID="<profile_id>"
curl -X DELETE http://localhost:4000/api/export-profiles/$PROFILE_ID
```
**Expected:** 204 No Content

---

### 38. POST /api/export-profiles/:id/export
**Purpose:** Generate export for profile

#### TC-EXPORT-005: Generate export
```bash
PROFILE_ID="<profile_id>"
curl -X POST http://localhost:4000/api/export-profiles/$PROFILE_ID/export
```
**Expected:** 200 OK, export summary with file paths

---

### 39. GET /api/export-profiles/:id/download
**Purpose:** Download export files as zip

#### TC-EXPORT-006: Download export
```bash
PROFILE_ID="<profile_id>"
curl -X GET http://localhost:4000/api/export-profiles/$PROFILE_ID/download \
  -o export.zip
```
**Expected:** 200 OK, zip file downloaded

---

### 40. POST /api/monitor/check
**Purpose:** Check stream health

#### TC-MONITOR-001: Check stream health
```bash
curl -X POST http://localhost:4000/api/monitor/check \
  -H "Content-Type: application/json" \
  -d '{
    "streams": [
      {
        "stationId": "station1",
        "streamUrl": "http://stream.example.com/station1"
      }
    ],
    "timeoutMs": 5000
  }'
```
**Expected:** 200 OK, health check results

---

### 41. GET /api/logs
**Purpose:** Get recent log entries

#### TC-LOG-001: Get logs
```bash
curl -X GET "http://localhost:4000/api/logs?type=errors&limit=100"
```
**Expected:** 200 OK, array of log entries

---

### 42. GET /api/logs/stream
**Purpose:** Stream logs via SSE

#### TC-LOG-002: Stream logs
```bash
curl -X GET "http://localhost:4000/api/logs/stream?type=monitoring" \
  --no-buffer
```
**Expected:** SSE stream of log entries

---

## Security Tests

### TC-SEC-001: Rate limiting on auth endpoints
- Make > 5 login attempts within 15 minutes
- **Expected:** 429 Too Many Requests

### TC-SEC-002: Rate limiting on API endpoints
- Make > 100 API requests within 15 minutes
- **Expected:** 429 Too Many Requests

### TC-SEC-003: API authentication with API key
```bash
API_KEY="wra_<your_api_key>"
curl -X GET http://localhost:4000/api/users \
  -H "X-API-Key: $API_KEY"
```
**Expected:** 200 OK (if user is admin)

### TC-SEC-004: Expired API key
- Create API key with past expiration date
- Try to use it
- **Expected:** 401 Unauthorized

### TC-SEC-005: Revoked API key
- Create and then revoke an API key
- Try to use it
- **Expected:** 401 Unauthorized

---

## Bug Regression Tests

### TC-REG-001: Database pool import
- Server should start without "pool.query is not a function" error
- All database operations should work

### TC-REG-002: Refresh token flow
- Login should create a refresh token
- Refresh endpoint should successfully refresh the access token
- No JWT verification errors on refresh token

### TC-REG-003: optionalAuthenticate middleware
- Endpoints using optionalAuthenticate should not cause "headers already sent" errors
- Should not call next() multiple times

---

## Summary

**Total Test Cases:** 100+

**Categories:**
- Authentication: 15 test cases
- User Management: 10 test cases
- API Keys: 5 test cases
- Audit Logs: 5 test cases
- Genres: 4 test cases
- Stations: 4 test cases
- Player Apps: 5 test cases
- Export Profiles: 6 test cases
- Monitoring: 1 test case
- Logs: 2 test cases
- Security: 5 test cases
- Regression: 3 test cases

## Automation

Consider creating automated tests using:
- Jest + Supertest for API testing
- Postman Collections
- Artillery for load testing
- k6 for performance testing
