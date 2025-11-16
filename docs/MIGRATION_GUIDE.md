# Authentication Migration Guide

## Overview

This guide explains how to add authentication to the existing API endpoints in the WebRadio Admin Panel.

## Current State

The authentication system is fully implemented with:
- ✅ Database schema and migrations
- ✅ Authentication middleware
- ✅ User management endpoints
- ✅ Audit logging infrastructure
- ✅ Frontend components
- ✅ Security headers and rate limiting

**However:** The existing data endpoints (stations, genres, players, exports) do not yet require authentication.

## Migration Steps

### Option 1: Gradual Migration (Recommended)

Enable authentication gradually to avoid breaking existing integrations:

#### Step 1: Add Optional Authentication

Modify existing routes to track authenticated users without blocking unauthenticated access:

```javascript
// In server/index.js
const { optionalAuthenticate } = require('./auth/auth-middleware');

// Apply to all routes
app.use(optionalAuthenticate);
```

This allows:
- Authenticated requests: User tracked in audit logs
- Unauthenticated requests: Still work, but not tracked

#### Step 2: Add Authentication Warnings

Add deprecation warnings for unauthenticated requests:

```javascript
// Middleware to warn about unauthenticated access
function warnUnauthenticated(req, res, next) {
  if (!req.user) {
    res.set('X-Auth-Warning', 'Authentication will be required in future versions');
  }
  next();
}

app.use(warnUnauthenticated);
```

#### Step 3: Enable Required Authentication

After a transition period, require authentication:

```javascript
const { authenticate, requireEditor } = require('./auth/auth-middleware');

// Protect write operations
app.post('${API_PREFIX}/stations', authenticate, requireEditor, async (req, res) => {
  // Existing code...
});

// Protect read operations
app.get('${API_PREFIX}/stations', authenticate, async (req, res) => {
  // Existing code...
});
```

### Option 2: Immediate Migration

Require authentication immediately for all endpoints:

```javascript
// In server/index.js, after mounting auth routes

const { authenticate, requireEditor, requireAdmin } = require('./auth/auth-middleware');

// Public endpoints (no auth required)
const publicEndpoints = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

// Apply authentication to all non-public routes
app.use((req, res, next) => {
  const isPublic = publicEndpoints.some(endpoint => req.path.startsWith(endpoint));
  if (isPublic) {
    return next();
  }
  return authenticate(req, res, next);
});
```

### Endpoint-Specific Protection

Apply different permission levels to different endpoints:

```javascript
// READ operations - All authenticated users
app.get('${API_PREFIX}/stations', authenticate, async (req, res) => { ... });
app.get('${API_PREFIX}/genres', authenticate, async (req, res) => { ... });

// WRITE operations - Editors and Admins only
app.post('${API_PREFIX}/stations', authenticate, requireEditor, async (req, res) => { ... });
app.patch('${API_PREFIX}/stations/:id', authenticate, requireEditor, async (req, res) => { ... });
app.delete('${API_PREFIX}/stations/:id', authenticate, requireEditor, async (req, res) => { ... });

// ADMIN operations - Admins only
app.post('${API_PREFIX}/users', authenticate, requireAdmin, async (req, res) => { ... });
```

## Permission Matrix

| Endpoint | Viewer | Editor | Admin |
|----------|--------|--------|-------|
| GET /stations | ✅ | ✅ | ✅ |
| POST /stations | ❌ | ✅ | ✅ |
| PATCH /stations/:id | ❌ | ✅* | ✅ |
| DELETE /stations/:id | ❌ | ✅* | ✅ |
| GET /users | ❌ | ❌ | ✅ |
| POST /users | ❌ | ❌ | ✅ |
| GET /audit-logs | ❌ | ❌ | ✅ |

*Editors can only modify their own created content

## Audit Log Integration

Automatically track all changes by setting the user context:

```javascript
// Add this before processing the request
if (req.user) {
  // Set user context for audit triggers
  await pool.query("SELECT set_config('app.current_user_id', $1, true)", [req.user.id]);
}
```

This enables automatic audit logging via database triggers.

## Frontend Updates

Update the frontend API client to include authentication:

```typescript
// In api.ts
import { getAuthHeader } from './contexts/AuthContext';

async function apiCall(endpoint: string, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
    credentials: 'include', // Include cookies for refresh token
  });

  if (response.status === 401) {
    // Token expired, redirect to login
    window.location.href = '/login';
  }

  return response;
}
```

## Testing Authentication

### Test Cases

1. **Unauthenticated Access**
```bash
curl http://localhost:4000/api/stations
# Should return 401 after migration
```

2. **Authenticated Access**
```bash
curl http://localhost:4000/api/stations \
  -H "Authorization: Bearer <access_token>"
# Should return 200
```

3. **API Key Access**
```bash
curl http://localhost:4000/api/stations \
  -H "X-API-Key: wra_<api_key>"
# Should return 200
```

4. **Role-Based Access**
```bash
# As viewer (should fail)
curl -X POST http://localhost:4000/api/stations \
  -H "Authorization: Bearer <viewer_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
# Should return 403

# As editor (should succeed)
curl -X POST http://localhost:4000/api/stations \
  -H "Authorization: Bearer <editor_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
# Should return 201
```

## Rollback Plan

If issues arise, temporarily disable authentication:

```javascript
// Comment out authentication middleware
// app.use(authenticate);

// Or use optional authentication
app.use(optionalAuthenticate);
```

## Monitoring

After migration, monitor:

1. **Authentication failures** - Check logs for 401 errors
2. **Authorization failures** - Check logs for 403 errors
3. **Audit logs** - Verify all actions are being tracked
4. **Rate limiting** - Ensure legitimate traffic isn't blocked

## Communication

Before enforcing authentication:

1. **Notify all API consumers** - Give 2-4 weeks notice
2. **Update API documentation** - Include authentication instructions
3. **Provide migration examples** - Show how to update client code
4. **Set up support channel** - Help users with migration issues

## Timeline Recommendation

- **Week 1-2:** Deploy optional authentication, add warnings
- **Week 3-4:** Notify users, update documentation
- **Week 5:** Require authentication for write operations
- **Week 6+:** Require authentication for all operations

## Support

For questions or issues during migration:
1. Check the [AUTHENTICATION.md](./AUTHENTICATION.md) documentation
2. Review the [TROUBLESHOOTING](#troubleshooting) section
3. Check audit logs for authentication patterns
4. Test in development environment first

---

**Note:** This is a breaking change. Plan carefully and communicate with all stakeholders before implementing.
