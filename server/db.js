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

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection() {
    try {
        const client = await pool.connect();
        try {
            await client.query('SELECT 1');
            return true;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Database connection test failed:', error.message);
        return false;
    }
}

/**
 * Wait for database to be ready with retry logic
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} retryDelay - Delay between retries in milliseconds
 * @returns {Promise<void>}
 */
async function waitForDatabase(maxRetries = 10, retryDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Attempting database connection (${attempt}/${maxRetries})...`);

        const connected = await testConnection();

        if (connected) {
            console.log('✅ Database connection successful');
            return;
        }

        if (attempt < maxRetries) {
            console.log(`Database not ready, retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error('❌ FATAL: Could not connect to database after multiple attempts');
}

module.exports = { pool, testConnection, waitForDatabase };
