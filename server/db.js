const { Pool } = require('pg');

// Configuration
const dbPassword = process.env.DB_PASSWORD || 'changeme123';

// Fail if using default password in production
if (process.env.NODE_ENV === 'production' && dbPassword === 'changeme123') {
    throw new Error('❌ FATAL: Cannot use default database password in production! Set DB_PASSWORD environment variable.');
}

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'webradio',
    user: process.env.DB_USER || 'webradio',
    password: dbPassword,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Handle pool errors to prevent crashes
pool.on('error', (err, client) => {
    console.error('Unexpected database pool error:', err);
    // Don't exit the process, just log the error
});

module.exports = { pool };
