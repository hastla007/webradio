# WebRadio Admin Panel - Authentication & Security Documentation

## 🔐 Overview

The WebRadio Admin Panel now includes a comprehensive authentication and authorization system with:

- **Multi-user support** with role-based access control (RBAC)
- **JWT-based authentication** with access and refresh tokens
- **Password security** with bcrypt hashing
- **API key management** for programmatic access
- **Audit logging** for compliance and security monitoring
- **Session management** with automatic token refresh
- **Security hardening** with rate limiting and security headers

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [User Roles](#user-roles)
3. [Authentication Flow](#authentication-flow)
4. [API Endpoints](#api-endpoints)
5. [Frontend Integration](#frontend-integration)
6. [Security Features](#security-features)
7. [Configuration](#configuration)
8. [Database Schema](#database-schema)
9. [Audit Logging](#audit-logging)
10. [API Keys](#api-keys)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### 1. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

**IMPORTANT:** Update these critical security settings:

```env
# Generate with: openssl rand -hex 64
JWT_SECRET=your-unique-secret-key-here
JWT_REFRESH_SECRET=your-unique-refresh-secret-here

# Generate with: openssl rand -hex 32
ENCRYPTION_SECRET=your-encryption-secret-here

# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=webradio
DB_USER=postgres
DB_PASSWORD=your-secure-password
```

### 2. Run Database Migrations

```bash
cd server
npm run migrate:auth
```

This creates the necessary tables:
- `users` - User accounts
- `api_keys` - API keys for programmatic access
- `password_reset_tokens` - Password reset tokens
- `refresh_tokens` - Refresh tokens for session management
- `audit_log` - Audit trail of all changes

### 3. Default Admin Account

A default admin account is created automatically:

- **Username:** `admin`
- **Password:** `admin123`

**⚠️ CRITICAL: Change this password immediately after first login!**

### 4. Start the Server

```bash
npm run dev
```

The authentication system is now active on all API endpoints.

---

## 👥 User Roles

The system supports three role levels with different permissions:

### Admin
- **Full system access**
- Can create, edit, and delete users
- Can manage roles and permissions
- Access to audit logs
- Can create and manage API keys
- Can perform all CRUD operations

### Editor
- Can create, edit, and delete content (stations, genres, players, profiles)
- Cannot manage users or access audit logs
- Can create personal API keys
- Cannot modify other users' content

### Viewer
- **Read-only access**
- Can view all content
- Cannot create, edit, or delete anything
- Can create personal API keys
- Ideal for monitoring and reporting

---

## 🔄 Authentication Flow

### Login Process

```
User → Login Request → Server
                        ↓
              Verify Credentials
                        ↓
           Generate Access Token (15min)
           Generate Refresh Token (7 days)
                        ↓
    Access Token → Response (JSON)
    Refresh Token → HTTP-only Cookie
```

### Token Refresh

Access tokens expire after 15 minutes. The frontend automatically refreshes them using the refresh token:

```
Frontend → Check Token Expiry
            ↓
    Token Expired? → Refresh Request
            ↓
    New Access Token → Continue
```

### Logout

```
User → Logout Request → Revoke Refresh Token → Clear Cookies
```

---

## 📡 API Endpoints

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user (admin only in production).

**Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecureP@ssw0rd",
  "role": "editor"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 2,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "editor",
    "is_active": true
  }
}
```

#### POST `/api/auth/login`
Authenticate and receive tokens.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@webradio.local",
    "role": "admin",
    "is_active": true
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/api/auth/refresh`
Refresh access token using refresh token cookie.

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

#### POST `/api/auth/logout`
Logout and revoke refresh token.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Logout successful"
}
```

#### POST `/api/auth/change-password`
Change current user's password.

**Request:**
```json
{
  "currentPassword": "OldP@ssw0rd",
  "newPassword": "NewSecureP@ssw0rd"
}
```

#### POST `/api/auth/forgot-password`
Request password reset token.

**Request:**
```json
{
  "email": "john@example.com"
}
```

#### POST `/api/auth/reset-password`
Reset password using token.

**Request:**
```json
{
  "token": "reset_token_here",
  "newPassword": "NewSecureP@ssw0rd"
}
```

### User Management Endpoints (Admin Only)

#### GET `/api/users`
Get all users.

**Query Parameters:**
- `limit` - Number of users to return (default: 100)
- `offset` - Pagination offset
- `role` - Filter by role (admin, editor, viewer)
- `is_active` - Filter by active status

#### GET `/api/users/:id`
Get user by ID.

#### POST `/api/users`
Create new user (admin only).

#### PATCH `/api/users/:id`
Update user (admin or own profile).

#### DELETE `/api/users/:id`
Delete user (admin only, cannot delete self).

### API Key Management

#### GET `/api/users/:id/api-keys`
Get all API keys for user.

#### POST `/api/users/:id/api-keys`
Create new API key.

**Request:**
```json
{
  "name": "Production API Key",
  "expiresAt": "2025-12-31T23:59:59Z" // Optional
}
```

**Response:**
```json
{
  "message": "API key created successfully",
  "apiKey": "wra_abc123def456...",
  "record": {
    "id": 1,
    "name": "Production API Key",
    "created_at": "2025-11-16T10:00:00Z",
    "expires_at": "2025-12-31T23:59:59Z"
  },
  "warning": "Save this API key securely. It will not be shown again."
}
```

#### DELETE `/api/users/:userId/api-keys/:keyId`
Revoke API key.

### Audit Log Endpoints (Admin Only)

#### GET `/api/audit-logs`
Get audit logs with filtering.

**Query Parameters:**
- `limit` - Number of logs to return
- `offset` - Pagination offset
- `userId` - Filter by user ID
- `entityType` - Filter by entity type (user, stations, genres, etc.)
- `action` - Filter by action (CREATE, UPDATE, DELETE, LOGIN, etc.)
- `startDate` - Filter by start date
- `endDate` - Filter by end date

#### GET `/api/audit-logs/stats`
Get audit log statistics.

#### GET `/api/audit-logs/user/:userId`
Get audit logs for specific user.

---

## 🎨 Frontend Integration

### AuthContext Usage

```tsx
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div>
      <p>Welcome, {user.username}!</p>
      <p>Role: {user.role}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Protected Routes

```tsx
import { useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children, requiredRole }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;

  if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  return children;
}
```

### API Requests with Authentication

```tsx
import { getAuthHeader } from './contexts/AuthContext';

async function fetchStations() {
  const response = await fetch('/api/stations', {
    headers: getAuthHeader(),
  });

  return response.json();
}
```

---

## 🛡️ Security Features

### 1. Password Security
- **bcrypt hashing** with 12 salt rounds
- **Password strength requirements:**
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character

### 2. JWT Tokens
- **Access tokens**: 15 minutes expiry (stateless)
- **Refresh tokens**: 7 days expiry (stored in database)
- **Automatic token rotation**
- **Secure HTTP-only cookies** for refresh tokens

### 3. Rate Limiting
- **Authentication endpoints**: 5 requests per 15 minutes
- **General API**: 100 requests per 15 minutes
- Prevents brute force attacks

### 4. Security Headers (Helmet.js)
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

### 5. Encryption
- **FTP passwords**: AES-256-GCM encryption
- **API keys**: SHA-256 hashing
- **Password reset tokens**: SHA-256 hashing

### 6. Audit Logging
- All CRUD operations tracked
- User actions recorded with timestamps
- IP address and user agent logging
- Automatic trigger-based logging

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | Secret key for access tokens | ⚠️ Change! | Yes |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | ⚠️ Change! | Yes |
| `ENCRYPTION_SECRET` | Secret for FTP password encryption | ⚠️ Change! | Yes |
| `ACCESS_TOKEN_EXPIRY` | Access token expiration | `15m` | No |
| `REFRESH_TOKEN_EXPIRY` | Refresh token expiration | `7d` | No |
| `BCRYPT_ROUNDS` | bcrypt salt rounds | `12` | No |
| `AUTH_RATE_LIMIT` | Auth endpoint rate limit | `5` | No |
| `API_RATE_LIMIT` | General API rate limit | `100` | No |
| `CORS_ORIGIN` | Allowed CORS origins | `*` | No |

---

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);
```

### API Keys Table
```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

### Audit Log Table
```sql
CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📊 Audit Logging

### Tracked Actions
- `CREATE` - Entity creation
- `UPDATE` - Entity modification
- `DELETE` - Entity deletion
- `LOGIN` - User login
- `LOGOUT` - User logout
- `PASSWORD_CHANGE` - Password changes
- `PASSWORD_RESET` - Password resets

### Tracked Entities
- `user` - User accounts
- `stations` - Radio stations
- `genres` - Genres
- `player_apps` - Player applications
- `export_profiles` - Export profiles
- `api_key` - API keys

### Viewing Audit Logs

Admins can view audit logs through:
1. **Web Interface**: Navigate to "Audit Log" page
2. **API**: `GET /api/audit-logs` with filters

---

## 🔑 API Keys

### Creating API Keys

1. **Via Web Interface:**
   - Navigate to User Management
   - Click on your user profile
   - Go to "API Keys" tab
   - Click "Create New API Key"

2. **Via API:**
```bash
curl -X POST http://localhost:4000/api/users/1/api-keys \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My API Key"}'
```

### Using API Keys

Include the API key in the `X-API-Key` header:

```bash
curl http://localhost:4000/api/stations \
  -H "X-API-Key: wra_abc123def456..."
```

### API Key Best Practices

- Store API keys securely (environment variables, secrets manager)
- Never commit API keys to version control
- Rotate API keys regularly
- Set expiration dates for API keys
- Revoke unused API keys
- Use different keys for different environments

---

## ✅ Best Practices

### Security

1. **Always use HTTPS in production**
2. **Change default admin password immediately**
3. **Generate strong, unique secrets for JWT and encryption**
4. **Enable database backups**
5. **Monitor audit logs regularly**
6. **Keep dependencies updated**
7. **Use environment variables for all secrets**

### User Management

1. **Follow principle of least privilege** - Assign minimum required role
2. **Regularly review user accounts** - Deactivate unused accounts
3. **Enforce strong passwords** - System enforces requirements automatically
4. **Use API keys for automation** - Don't share user credentials

### Development

1. **Never commit `.env` files**
2. **Use `.env.example` as a template**
3. **Test authentication flows thoroughly**
4. **Review audit logs during testing**

---

## 🔧 Troubleshooting

### "Invalid token" Error

**Cause:** Access token expired or invalid.

**Solution:**
1. Frontend should automatically refresh token
2. If refresh fails, user needs to login again
3. Check that JWT_SECRET matches between sessions

### "Too many authentication attempts"

**Cause:** Rate limiting triggered.

**Solution:**
1. Wait 15 minutes before trying again
2. Verify correct credentials
3. Check for bot/automated attacks

### Cannot Login as Admin

**Cause:** Default password might have been changed or migration not run.

**Solution:**
```bash
# Re-run migration
cd server
npm run migrate:auth

# Or manually reset password in database
psql webradio -c "UPDATE users SET password_hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqXXqXbQUu' WHERE username = 'admin';"
```

### CORS Errors

**Cause:** Frontend origin not allowed.

**Solution:**
Update `CORS_ORIGIN` in `.env`:
```env
CORS_ORIGIN=http://localhost:5173,http://localhost:3000
```

### Database Connection Failed

**Cause:** PostgreSQL not running or wrong credentials.

**Solution:**
1. Start PostgreSQL: `sudo systemctl start postgresql`
2. Verify credentials in `.env`
3. Check database exists: `psql -l`

---

## 📚 Additional Resources

- [JWT.io](https://jwt.io/) - Learn about JWT tokens
- [OWASP Top 10](https://owasp.org/www-project-top-ten/) - Security best practices
- [bcrypt](https://www.npmjs.com/package/bcrypt) - Password hashing
- [Helmet.js](https://helmetjs.github.io/) - Security headers

---

## 🎯 Summary

The authentication system provides:

✅ Multi-user support with RBAC
✅ Secure JWT-based authentication
✅ Password security with bcrypt
✅ API key management
✅ Comprehensive audit logging
✅ Rate limiting and security headers
✅ Session management with auto-refresh
✅ Password reset functionality

**Remember:** Security is an ongoing process. Regularly review and update your security measures!
