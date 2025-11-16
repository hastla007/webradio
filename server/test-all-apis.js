#!/usr/bin/env node

/**
 * Comprehensive API Test Script
 * Tests all 40+ API endpoints and reports bugs
 */

const http = require('http');

const BASE_URL = 'http://localhost:4000';
const API_PREFIX = '/api';

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Bug tracker
const bugs = [];
let testCount = 0;
let passCount = 0;
let failCount = 0;

// Helper function to make HTTP requests
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            rawBody: data,
          };
          resolve(result);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: data,
            parseError: e.message,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Test helper
async function test(description, testFn) {
  testCount++;
  process.stdout.write(`${colors.cyan}[${testCount}]${colors.reset} Testing: ${description}... `);

  try {
    const result = await testFn();

    if (result.pass) {
      passCount++;
      console.log(`${colors.green}✓ PASS${colors.reset}`);
      if (result.message) {
        console.log(`    ${colors.blue}→${colors.reset} ${result.message}`);
      }
    } else {
      failCount++;
      console.log(`${colors.red}✗ FAIL${colors.reset}`);
      console.log(`    ${colors.red}→${colors.reset} ${result.message}`);

      bugs.push({
        test: description,
        issue: result.message,
        details: result.details,
        severity: result.severity || 'medium',
      });
    }

    return result;
  } catch (error) {
    failCount++;
    console.log(`${colors.red}✗ ERROR${colors.reset}`);
    console.log(`    ${colors.red}→${colors.reset} ${error.message}`);

    bugs.push({
      test: description,
      issue: error.message,
      details: error.stack,
      severity: 'high',
    });

    return { pass: false, message: error.message };
  }
}

// Main test suite
async function runTests() {
  console.log(`\n${colors.magenta}═════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.magenta}   COMPREHENSIVE API TEST SUITE - WebRadio Admin Panel${colors.reset}`);
  console.log(`${colors.magenta}═════════════════════════════════════════════════════════════${colors.reset}\n`);

  // Test 1: Health Check
  console.log(`\n${colors.yellow}━━━ Health & Basic Endpoints ━━━${colors.reset}`);

  await test('GET /api/health - Health check endpoint', async () => {
    const res = await makeRequest('GET', `${API_PREFIX}/health`);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}`, severity: 'critical' };
    }

    if (!res.body || res.body.status !== 'healthy') {
      return { pass: false, message: 'Health check did not return healthy status', severity: 'high' };
    }

    return { pass: true, message: `Server healthy, uptime: ${res.body.uptime}s` };
  });

  // Test 2: Genres - GET
  console.log(`\n${colors.yellow}━━━ Genre Management APIs ━━━${colors.reset}`);

  let genreId = null;

  await test('GET /api/genres - List all genres', async () => {
    const res = await makeRequest('GET', `${API_PREFIX}/genres`);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}`, severity: 'high' };
    }

    if (!Array.isArray(res.body)) {
      return { pass: false, message: 'Response is not an array', severity: 'high' };
    }

    if (res.body.length > 0) {
      genreId = res.body[0].id;
    }

    return { pass: true, message: `Found ${res.body.length} genres` };
  });

  await test('POST /api/genres - Create new genre', async () => {
    const testGenre = {
      id: `test-genre-${Date.now()}`,
      name: 'Test Genre',
      subGenres: ['Sub1', 'Sub2'],
    };

    const res = await makeRequest('POST', `${API_PREFIX}/genres`, testGenre);

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      return { pass: false, message: `Expected 200/201, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!res.body || !res.body.id) {
      return { pass: false, message: 'Response does not contain created genre with id', severity: 'medium' };
    }

    genreId = res.body.id;
    return { pass: true, message: `Created genre: ${res.body.id}` };
  });

  await test('PUT /api/genres/:id - Update genre', async () => {
    if (!genreId) {
      return { pass: false, message: 'No genre ID available for update test', severity: 'medium' };
    }

    const updatedGenre = {
      id: genreId,
      name: 'Updated Test Genre',
      subGenres: ['SubA', 'SubB', 'SubC'],
    };

    const res = await makeRequest('PUT', `${API_PREFIX}/genres/${genreId}`, updatedGenre);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!res.body || res.body.name !== 'Updated Test Genre') {
      return { pass: false, message: 'Genre was not updated correctly', severity: 'medium' };
    }

    return { pass: true, message: 'Genre updated successfully' };
  });

  await test('DELETE /api/genres/:id - Delete genre', async () => {
    if (!genreId) {
      return { pass: false, message: 'No genre ID available for delete test', severity: 'medium' };
    }

    const res = await makeRequest('DELETE', `${API_PREFIX}/genres/${genreId}`);

    if (res.statusCode !== 200 && res.statusCode !== 204) {
      return { pass: false, message: `Expected 200/204, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    return { pass: true, message: 'Genre deleted successfully' };
  });

  // Test 3: Stations
  console.log(`\n${colors.yellow}━━━ Station Management APIs ━━━${colors.reset}`);

  let stationId = null;

  await test('GET /api/stations - List all stations', async () => {
    const res = await makeRequest('GET', `${API_PREFIX}/stations`);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}`, severity: 'high' };
    }

    if (!Array.isArray(res.body)) {
      return { pass: false, message: 'Response is not an array', severity: 'high' };
    }

    if (res.body.length > 0) {
      stationId = res.body[0].id;
    }

    return { pass: true, message: `Found ${res.body.length} stations` };
  });

  await test('POST /api/stations - Create new station', async () => {
    const testStation = {
      id: `test-station-${Date.now()}`,
      name: 'Test Station',
      streamUrl: 'http://example.com/stream',
      genreId: genreId || 'pop',
      description: 'Test station description',
      bitrate: 128,
      language: 'en',
      region: 'Global',
      isActive: true,
      isFavorite: false,
      imaAdType: 'no',
    };

    const res = await makeRequest('POST', `${API_PREFIX}/stations`, testStation);

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      return { pass: false, message: `Expected 200/201, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!res.body || !res.body.id) {
      return { pass: false, message: 'Response does not contain created station with id', severity: 'medium' };
    }

    stationId = res.body.id;
    return { pass: true, message: `Created station: ${res.body.id}` };
  });

  await test('PUT /api/stations/:id - Update station', async () => {
    if (!stationId) {
      return { pass: false, message: 'No station ID available for update test', severity: 'medium' };
    }

    const updatedStation = {
      id: stationId,
      name: 'Updated Test Station',
      streamUrl: 'http://example.com/stream-updated',
      genreId: genreId || 'pop',
      bitrate: 256,
      isActive: true,
    };

    const res = await makeRequest('PUT', `${API_PREFIX}/stations/${stationId}`, updatedStation);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!res.body || res.body.name !== 'Updated Test Station') {
      return { pass: false, message: 'Station was not updated correctly', severity: 'medium' };
    }

    return { pass: true, message: 'Station updated successfully' };
  });

  await test('DELETE /api/stations/:id - Delete station', async () => {
    if (!stationId) {
      return { pass: false, message: 'No station ID available for delete test', severity: 'medium' };
    }

    const res = await makeRequest('DELETE', `${API_PREFIX}/stations/${stationId}`);

    if (res.statusCode !== 200 && res.statusCode !== 204) {
      return { pass: false, message: `Expected 200/204, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    return { pass: true, message: 'Station deleted successfully' };
  });

  // Test 4: Player Apps
  console.log(`\n${colors.yellow}━━━ Player App Management APIs ━━━${colors.reset}`);

  let playerAppId = null;

  await test('GET /api/player-apps - List all player apps', async () => {
    const res = await makeRequest('GET', `${API_PREFIX}/player-apps`);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}`, severity: 'high' };
    }

    if (!Array.isArray(res.body)) {
      return { pass: false, message: 'Response is not an array', severity: 'high' };
    }

    if (res.body.length > 0) {
      playerAppId = res.body[0].id;
    }

    return { pass: true, message: `Found ${res.body.length} player apps` };
  });

  await test('POST /api/player-apps - Create new player app', async () => {
    const testPlayerApp = {
      id: `test-player-${Date.now()}`,
      name: 'Test Player App',
      platform: 'ios',
      platforms: ['ios'],
      description: 'Test player app',
      contactEmail: 'test@example.com',
      ftpEnabled: false,
      imaEnabled: false,
    };

    const res = await makeRequest('POST', `${API_PREFIX}/player-apps`, testPlayerApp);

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      return { pass: false, message: `Expected 200/201, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!res.body || !res.body.id) {
      return { pass: false, message: 'Response does not contain created player app with id', severity: 'medium' };
    }

    playerAppId = res.body.id;
    return { pass: true, message: `Created player app: ${res.body.id}` };
  });

  await test('PUT /api/player-apps/:id - Update player app', async () => {
    if (!playerAppId) {
      return { pass: false, message: 'No player app ID available for update test', severity: 'medium' };
    }

    const updatedPlayerApp = {
      id: playerAppId,
      name: 'Updated Test Player App',
      platform: 'android',
      platforms: ['android'],
      description: 'Updated test player app',
      contactEmail: 'updated@example.com',
      ftpEnabled: false,
      imaEnabled: true,
    };

    const res = await makeRequest('PUT', `${API_PREFIX}/player-apps/${playerAppId}`, updatedPlayerApp);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!res.body || res.body.name !== 'Updated Test Player App') {
      return { pass: false, message: 'Player app was not updated correctly', severity: 'medium' };
    }

    return { pass: true, message: 'Player app updated successfully' };
  });

  await test('POST /api/player-apps/test-ftp - Test FTP connection (should fail without credentials)', async () => {
    const ftpConfig = {
      ftpServer: 'ftp.example.com',
      ftpUsername: 'test',
      ftpPassword: 'test',
      ftpProtocol: 'ftp',
    };

    const res = await makeRequest('POST', `${API_PREFIX}/player-apps/test-ftp`, ftpConfig);

    // This should fail (can't connect to example.com), but should not crash
    if (res.statusCode === 500 && res.body && res.body.message && res.body.message.includes('Internal server error')) {
      return { pass: false, message: 'FTP test endpoint returns 500 internal error instead of proper error message', severity: 'medium', details: res.body };
    }

    // We expect either a 400 (validation error) or 200 with error in response
    if (res.statusCode === 400 || (res.statusCode === 200 && res.body && res.body.success === false)) {
      return { pass: true, message: 'FTP test endpoint handles errors properly' };
    }

    return { pass: true, message: `FTP test returned ${res.statusCode}` };
  });

  await test('DELETE /api/player-apps/:id - Delete player app', async () => {
    if (!playerAppId) {
      return { pass: false, message: 'No player app ID available for delete test', severity: 'medium' };
    }

    const res = await makeRequest('DELETE', `${API_PREFIX}/player-apps/${playerAppId}`);

    if (res.statusCode !== 200 && res.statusCode !== 204) {
      return { pass: false, message: `Expected 200/204, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    return { pass: true, message: 'Player app deleted successfully' };
  });

  // Test 5: Export Profiles
  console.log(`\n${colors.yellow}━━━ Export Profile Management APIs ━━━${colors.reset}`);

  let exportProfileId = null;

  await test('GET /api/export-profiles - List all export profiles', async () => {
    const res = await makeRequest('GET', `${API_PREFIX}/export-profiles`);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}`, severity: 'high' };
    }

    if (!Array.isArray(res.body)) {
      return { pass: false, message: 'Response is not an array', severity: 'high' };
    }

    if (res.body.length > 0) {
      exportProfileId = res.body[0].id;
    }

    return { pass: true, message: `Found ${res.body.length} export profiles` };
  });

  await test('POST /api/export-profiles - Create new export profile', async () => {
    const testProfile = {
      id: `test-profile-${Date.now()}`,
      name: 'Test Export Profile',
      genreIds: [],
      stationIds: [],
      playerId: playerAppId,
    };

    const res = await makeRequest('POST', `${API_PREFIX}/export-profiles`, testProfile);

    if (res.statusCode !== 200 && res.statusCode !== 201) {
      return { pass: false, message: `Expected 200/201, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!res.body || !res.body.id) {
      return { pass: false, message: 'Response does not contain created export profile with id', severity: 'medium' };
    }

    exportProfileId = res.body.id;
    return { pass: true, message: `Created export profile: ${res.body.id}` };
  });

  await test('PUT /api/export-profiles/:id - Update export profile', async () => {
    if (!exportProfileId) {
      return { pass: false, message: 'No export profile ID available for update test', severity: 'medium' };
    }

    const updatedProfile = {
      id: exportProfileId,
      name: 'Updated Test Export Profile',
      genreIds: [],
      stationIds: [],
    };

    const res = await makeRequest('PUT', `${API_PREFIX}/export-profiles/${exportProfileId}`, updatedProfile);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!res.body || res.body.name !== 'Updated Test Export Profile') {
      return { pass: false, message: 'Export profile was not updated correctly', severity: 'medium' };
    }

    return { pass: true, message: 'Export profile updated successfully' };
  });

  await test('POST /api/export-profiles/:id/export - Run export', async () => {
    if (!exportProfileId) {
      return { pass: false, message: 'No export profile ID available for export test', severity: 'medium' };
    }

    const res = await makeRequest('POST', `${API_PREFIX}/export-profiles/${exportProfileId}/export`);

    // Export profile has no stations, so it should return 400
    if (res.statusCode === 400) {
      if (res.body && res.body.error && res.body.error.toLowerCase().includes('active stations')) {
        return { pass: true, message: 'Export correctly rejected empty profile' };
      }
      return { pass: false, message: `Got 400 but with unexpected error: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200 or 400, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!res.body || !res.body.success) {
      return { pass: false, message: 'Export did not succeed', severity: 'medium', details: res.body };
    }

    return { pass: true, message: `Export completed: ${res.body.filesCreated || 0} files created` };
  });

  await test('GET /api/export-profiles/:id/download - Download export ZIP', async () => {
    if (!exportProfileId) {
      return { pass: false, message: 'No export profile ID available for download test', severity: 'medium' };
    }

    const res = await makeRequest('GET', `${API_PREFIX}/export-profiles/${exportProfileId}/download`);

    // Should return 200 with zip file or 404 if export not run yet
    if (res.statusCode !== 200 && res.statusCode !== 404) {
      return { pass: false, message: `Expected 200 or 404, got ${res.statusCode}`, severity: 'medium' };
    }

    if (res.statusCode === 200) {
      const contentType = res.headers['content-type'];
      if (!contentType || !contentType.includes('zip')) {
        return { pass: false, message: `Expected zip file, got content-type: ${contentType}`, severity: 'medium' };
      }
      return { pass: true, message: 'Export ZIP downloaded successfully' };
    }

    return { pass: true, message: 'Export not found (expected if not run yet)' };
  });

  await test('DELETE /api/export-profiles/:id - Delete export profile', async () => {
    if (!exportProfileId) {
      return { pass: false, message: 'No export profile ID available for delete test', severity: 'medium' };
    }

    const res = await makeRequest('DELETE', `${API_PREFIX}/export-profiles/${exportProfileId}`);

    if (res.statusCode !== 200 && res.statusCode !== 204) {
      return { pass: false, message: `Expected 200/204, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    return { pass: true, message: 'Export profile deleted successfully' };
  });

  // Test 6: Monitoring
  console.log(`\n${colors.yellow}━━━ Monitoring & Logging APIs ━━━${colors.reset}`);

  await test('POST /api/monitor/check - Check stream health', async () => {
    const checkRequest = {
      streams: [
        { stationId: 'test-station-1', streamUrl: 'http://example.com/stream.mp3' }
      ],
      timeoutMs: 5000,
    };

    const res = await makeRequest('POST', `${API_PREFIX}/monitor/check`, checkRequest);

    // Should return 200 regardless of stream status
    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`, severity: 'medium' };
    }

    if (!Array.isArray(res.body) || res.body.length === 0) {
      return { pass: false, message: 'Response should be an array with results', severity: 'medium' };
    }

    if (typeof res.body[0].isOnline === 'undefined') {
      return { pass: false, message: 'Response does not contain isOnline status', severity: 'medium' };
    }

    return { pass: true, message: `Stream check completed: ${res.body[0].isOnline ? 'online' : 'offline'}` };
  });

  await test('GET /api/logs - Fetch logs with pagination', async () => {
    const res = await makeRequest('GET', `${API_PREFIX}/logs?limit=10`);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}`, severity: 'medium' };
    }

    if (!res.body || !Array.isArray(res.body.entries)) {
      return { pass: false, message: 'Response does not contain entries array', severity: 'medium' };
    }

    return { pass: true, message: `Fetched ${res.body.entries.length} log entries, cursor: ${res.body.cursor}` };
  });

  await test('GET /api/logs with filtering - Filter logs by level and category', async () => {
    const res = await makeRequest('GET', `${API_PREFIX}/logs?category=system&limit=5`);

    if (res.statusCode !== 200) {
      return { pass: false, message: `Expected 200, got ${res.statusCode}`, severity: 'medium' };
    }

    if (!res.body || !Array.isArray(res.body.entries)) {
      return { pass: false, message: 'Response does not contain entries array', severity: 'medium' };
    }

    return { pass: true, message: `Fetched ${res.body.entries.length} filtered log entries` };
  });

  // Test 7: Edge Cases and Error Handling
  console.log(`\n${colors.yellow}━━━ Edge Cases & Error Handling ━━━${colors.reset}`);

  await test('POST /api/genres with invalid data - Should return 400', async () => {
    const invalidGenre = {
      // Missing required 'id' and 'name' fields
      subGenres: ['Test'],
    };

    const res = await makeRequest('POST', `${API_PREFIX}/genres`, invalidGenre);

    if (res.statusCode === 200 || res.statusCode === 201) {
      return { pass: false, message: 'Endpoint accepted invalid data (missing required fields)', severity: 'high' };
    }

    if (res.statusCode !== 400) {
      return { pass: false, message: `Expected 400, got ${res.statusCode}`, severity: 'medium' };
    }

    return { pass: true, message: 'Properly rejected invalid data' };
  });

  await test('POST /api/stations with invalid data - Should return 400', async () => {
    const invalidStation = {
      // Missing required fields
      name: 'Test',
    };

    const res = await makeRequest('POST', `${API_PREFIX}/stations`, invalidStation);

    if (res.statusCode === 200 || res.statusCode === 201) {
      return { pass: false, message: 'Endpoint accepted invalid data (missing required fields)', severity: 'high' };
    }

    if (res.statusCode !== 400) {
      return { pass: false, message: `Expected 400, got ${res.statusCode}`, severity: 'medium' };
    }

    return { pass: true, message: 'Properly rejected invalid data' };
  });

  await test('GET /api/genres/non-existent-id - Should return 404', async () => {
    const res = await makeRequest('GET', `${API_PREFIX}/genres/non-existent-id-12345`);

    if (res.statusCode === 200) {
      return { pass: false, message: 'Endpoint returned 200 for non-existent resource', severity: 'medium' };
    }

    if (res.statusCode !== 404) {
      return { pass: false, message: `Expected 404, got ${res.statusCode}`, severity: 'low' };
    }

    return { pass: true, message: 'Properly returned 404 for non-existent resource' };
  });

  await test('PUT /api/stations/non-existent-id - Should return 404', async () => {
    const res = await makeRequest('PUT', `${API_PREFIX}/stations/non-existent-id-12345`, {
      id: 'non-existent-id-12345',
      name: 'Test',
      streamUrl: 'http://test.com',
    });

    if (res.statusCode === 200 || res.statusCode === 201) {
      return { pass: false, message: 'Endpoint accepted update for non-existent resource', severity: 'medium' };
    }

    if (res.statusCode !== 404) {
      return { pass: false, message: `Expected 404, got ${res.statusCode}`, severity: 'low' };
    }

    return { pass: true, message: 'Properly returned 404 for non-existent resource' };
  });

  await test('DELETE /api/genres/non-existent-id - Should return 404', async () => {
    const res = await makeRequest('DELETE', `${API_PREFIX}/genres/non-existent-id-12345`);

    if (res.statusCode === 200 || res.statusCode === 204) {
      return { pass: false, message: 'Endpoint accepted delete for non-existent resource', severity: 'medium' };
    }

    if (res.statusCode !== 404) {
      return { pass: false, message: `Expected 404, got ${res.statusCode}`, severity: 'low' };
    }

    return { pass: true, message: 'Properly returned 404 for non-existent resource' };
  });

  await test('POST /api/monitor/check with invalid URL - Should handle gracefully', async () => {
    const checkRequest = {
      streams: [
        { stationId: 'invalid-test', streamUrl: 'not-a-valid-url' }
      ],
      timeoutMs: 1000,
    };

    const res = await makeRequest('POST', `${API_PREFIX}/monitor/check`, checkRequest);

    if (res.statusCode === 500) {
      return { pass: false, message: 'Endpoint returns 500 for invalid URL instead of handling gracefully', severity: 'medium' };
    }

    if (res.statusCode === 200 && Array.isArray(res.body) && res.body[0] && res.body[0].isOnline === false) {
      return { pass: true, message: 'Gracefully handled invalid URL' };
    }

    return { pass: true, message: `Returned ${res.statusCode}` };
  });

  // Test 8: Content-Type validation
  console.log(`\n${colors.yellow}━━━ Content-Type & Request Validation ━━━${colors.reset}`);

  await test('POST /api/genres without Content-Type header - Should handle gracefully', async () => {
    const testGenre = {
      id: `test-genre-no-ct-${Date.now()}`,
      name: 'Test Genre',
    };

    const res = await makeRequest('POST', `${API_PREFIX}/genres`, testGenre, { 'Content-Type': '' });

    // Should either accept it (Express default) or return 415
    if (res.statusCode === 500) {
      return { pass: false, message: 'Endpoint crashes (500) without Content-Type header', severity: 'medium' };
    }

    return { pass: true, message: `Handled missing Content-Type (status: ${res.statusCode})` };
  });

  // Print summary
  console.log(`\n${colors.magenta}═════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.magenta}   TEST SUMMARY${colors.reset}`);
  console.log(`${colors.magenta}═════════════════════════════════════════════════════════════${colors.reset}\n`);

  console.log(`Total Tests: ${testCount}`);
  console.log(`${colors.green}Passed: ${passCount}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failCount}${colors.reset}`);
  console.log(`Pass Rate: ${((passCount / testCount) * 100).toFixed(1)}%\n`);

  if (bugs.length > 0) {
    console.log(`${colors.red}━━━ BUGS FOUND: ${bugs.length} ━━━${colors.reset}\n`);

    bugs.forEach((bug, index) => {
      const severityColor = {
        critical: colors.red,
        high: colors.red,
        medium: colors.yellow,
        low: colors.cyan,
      }[bug.severity] || colors.yellow;

      console.log(`${severityColor}[${index + 1}] ${bug.severity.toUpperCase()}${colors.reset}: ${bug.test}`);
      console.log(`    Issue: ${bug.issue}`);
      if (bug.details) {
        console.log(`    Details: ${typeof bug.details === 'object' ? JSON.stringify(bug.details, null, 2).split('\n').join('\n    ') : bug.details}`);
      }
      console.log('');
    });
  } else {
    console.log(`${colors.green}✓ No bugs found! All tests passed.${colors.reset}\n`);
  }

  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error(`${colors.red}Fatal error running tests:${colors.reset}`, error);
  process.exit(1);
});
