# Database Setup Instructions

## Prerequisites
- PostgreSQL 16 or later
- Access to create databases and users

## Quick Setup

### 1. Start PostgreSQL Service
```bash
sudo service postgresql start
# OR
sudo systemctl start postgresql
```

### 2. Create Database and User
```bash
sudo -u postgres psql << EOF
CREATE DATABASE webradio;
CREATE USER webradio WITH ENCRYPTED PASSWORD 'changeme123';
GRANT ALL PRIVILEGES ON DATABASE webradio TO webradio;
\c webradio
GRANT ALL ON SCHEMA public TO webradio;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO webradio;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO webradio;
EOF
```

### 3. Run Migrations
```bash
cd server
node run-migrations.js
```

This will:
- Create all necessary tables (users, api_keys, refresh_tokens, etc.)
- Set up indexes and triggers
- Create a default admin user:
  - **Username:** admin
  - **Password:** admin123 (⚠️ CHANGE THIS IMMEDIATELY!)
  - **Email:** admin@webradio.local

### 4. Verify Setup
```bash
psql -h localhost -U webradio -d webradio -c "\dt"
```

You should see tables: users, api_keys, password_reset_tokens, refresh_tokens, audit_log, and others.

## Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=webradio
DB_USER=webradio
DB_PASSWORD=changeme123

# JWT Secrets (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Security
BCRYPT_ROUNDS=12

# Server Configuration
PORT=4000
API_PREFIX=/api
CORS_ORIGIN=*
NODE_ENV=development
```

## Troubleshooting

### Connection Refused Error
```
psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed: Connection refused
```
**Solution:** PostgreSQL service is not running. Start it with:
```bash
sudo service postgresql start
```

### Authentication Failed
```
psql: error: FATAL:  password authentication failed for user "webradio"
```
**Solution:** The user/password combination is incorrect. Recreate the user or update the password.

### Permission Denied
```
ERROR:  permission denied for schema public
```
**Solution:** Grant proper permissions:
```bash
sudo -u postgres psql -d webradio << EOF
GRANT ALL ON SCHEMA public TO webradio;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO webradio;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO webradio;
EOF
```

## Testing Database Connection

```bash
cd server
node -e "const { pool } = require('./db'); pool.query('SELECT NOW()', (err, res) => { console.log(err ? 'Error: ' + err.message : 'Connected! Time: ' + res.rows[0].now); pool.end(); });"
```

## Default Admin Credentials

After running migrations, you can login with:
- **Username:** admin
- **Password:** admin123

⚠️ **IMPORTANT:** Change this password immediately after first login using the `/api/auth/change-password` endpoint!
