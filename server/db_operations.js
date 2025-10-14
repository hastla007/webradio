const { pool } = require('./db');
const { encryptSecret, decryptSecret, isEncryptedSecret } = require('./secrets');
const { sanitizeTimeout, normalizeProtocol } = require('./ftp');

// ==================== GENRES ====================

async function getAllGenres() {
    const result = await pool.query('SELECT * FROM genres ORDER BY name');
    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        subGenres: row.sub_genres || [],
    }));
}

async function getGenreById(id) {
    const result = await pool.query('SELECT * FROM genres WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        id: row.id,
        name: row.name,
        subGenres: row.sub_genres || [],
    };
}

async function createGenre(genre) {
    const result = await pool.query(
        'INSERT INTO genres (id, name, sub_genres) VALUES ($1, $2, $3) RETURNING *',
        [genre.id, genre.name, JSON.stringify(genre.subGenres || [])]
    );
    const row = result.rows[0];
    return {
        id: row.id,
        name: row.name,
        subGenres: row.sub_genres || [],
    };
}

async function updateGenre(id, genre) {
    const result = await pool.query(
        'UPDATE genres SET name = $1, sub_genres = $2 WHERE id = $3 RETURNING *',
        [genre.name, JSON.stringify(genre.subGenres || []), id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        id: row.id,
        name: row.name,
        subGenres: row.sub_genres || [],
    };
}

async function deleteGenre(id) {
    await pool.query('DELETE FROM genres WHERE id = $1', [id]);
}

// ==================== STATIONS ====================

async function getAllStations() {
    const result = await pool.query('SELECT * FROM stations ORDER BY name');
    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        streamUrl: row.stream_url,
        description: row.description,
        genreId: row.genre_id || '',
        subGenres: row.sub_genres || [],
        logoUrl: row.logo_url,
        bitrate: row.bitrate,
        language: row.language,
        region: row.region,
        tags: row.tags || [],
        imaAdType: row.ima_ad_type,
        isActive: row.is_active,
        isFavorite: row.is_favorite,
    }));
}

async function getStationById(id) {
    const result = await pool.query('SELECT * FROM stations WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        id: row.id,
        name: row.name,
        streamUrl: row.stream_url,
        description: row.description,
        genreId: row.genre_id || '',
        subGenres: row.sub_genres || [],
        logoUrl: row.logo_url,
        bitrate: row.bitrate,
        language: row.language,
        region: row.region,
        tags: row.tags || [],
        imaAdType: row.ima_ad_type,
        isActive: row.is_active,
        isFavorite: row.is_favorite,
    };
}

async function createStation(station) {
    const result = await pool.query(
        `INSERT INTO stations (
            id, name, stream_url, description, genre_id, sub_genres,
            logo_url, bitrate, language, region, tags, ima_ad_type,
            is_active, is_favorite
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
            station.id,
            station.name,
            station.streamUrl,
            station.description,
            station.genreId || null,
            JSON.stringify(station.subGenres || []),
            station.logoUrl,
            station.bitrate,
            station.language,
            station.region,
            JSON.stringify(station.tags || []),
            station.imaAdType,
            station.isActive,
            station.isFavorite,
        ]
    );
    return getStationById(result.rows[0].id);
}

async function updateStation(id, station) {
    const result = await pool.query(
        `UPDATE stations SET
            name = $1, stream_url = $2, description = $3, genre_id = $4,
            sub_genres = $5, logo_url = $6, bitrate = $7, language = $8,
            region = $9, tags = $10, ima_ad_type = $11, is_active = $12,
            is_favorite = $13
        WHERE id = $14 RETURNING *`,
        [
            station.name,
            station.streamUrl,
            station.description,
            station.genreId || null,
            JSON.stringify(station.subGenres || []),
            station.logoUrl,
            station.bitrate,
            station.language,
            station.region,
            JSON.stringify(station.tags || []),
            station.imaAdType,
            station.isActive,
            station.isFavorite,
            id,
        ]
    );
    if (result.rows.length === 0) return null;
    return getStationById(id);
}

async function deleteStation(id) {
    await pool.query('DELETE FROM stations WHERE id = $1', [id]);
}

// ==================== PLAYER APPS ====================

async function getAllPlayerApps() {
    const result = await pool.query('SELECT * FROM player_apps ORDER BY name');
    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        platforms: row.platforms || [],
        platform: row.platform || '',
        description: row.description,
        contactEmail: row.contact_email,
        notes: row.notes,
        ftpEnabled: row.ftp_enabled,
        ftpServer: row.ftp_server,
        ftpUsername: row.ftp_username,
        ftpPassword: decryptSecret(row.ftp_password || ''),
        ftpProtocol: normalizeProtocol(row.ftp_protocol, row.ftp_server),
        ftpTimeout: sanitizeTimeout(row.ftp_timeout_ms),
        networkCode: row.network_code,
        imaEnabled: row.ima_enabled,
        videoPrerollDefaultSize: row.video_preroll_default_size,
        placements: row.placements || {},
    }));
}

async function getPlayerAppById(id) {
    const result = await pool.query('SELECT * FROM player_apps WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        id: row.id,
        name: row.name,
        platforms: row.platforms || [],
        platform: row.platform || '',
        description: row.description,
        contactEmail: row.contact_email,
        notes: row.notes,
        ftpEnabled: row.ftp_enabled,
        ftpServer: row.ftp_server,
        ftpUsername: row.ftp_username,
        ftpPassword: decryptSecret(row.ftp_password || ''),
        ftpProtocol: normalizeProtocol(row.ftp_protocol, row.ftp_server),
        ftpTimeout: sanitizeTimeout(row.ftp_timeout_ms),
        networkCode: row.network_code,
        imaEnabled: row.ima_enabled,
        videoPrerollDefaultSize: row.video_preroll_default_size,
        placements: row.placements || {},
    };
}

async function createPlayerApp(app) {
    const ftpProtocol = normalizeProtocol(app.ftpProtocol, app.ftpServer);
    const ftpTimeout = sanitizeTimeout(app.ftpTimeout);
    const password = typeof app.ftpPassword === 'string' ? app.ftpPassword : '';
    const storedPassword = password && !isEncryptedSecret(password) ? encryptSecret(password) : password;
    const result = await pool.query(
        `INSERT INTO player_apps (
            id, name, platforms, platform, description, contact_email, notes,
            ftp_enabled, ftp_server, ftp_username, ftp_password, ftp_protocol, ftp_timeout_ms, network_code,
            ima_enabled, video_preroll_default_size, placements
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
            app.id,
            app.name,
            JSON.stringify(app.platforms || []),
            app.platform || '',
            app.description,
            app.contactEmail,
            app.notes,
            app.ftpEnabled,
            app.ftpServer,
            app.ftpUsername,
            storedPassword,
            ftpProtocol,
            ftpTimeout,
            app.networkCode,
            app.imaEnabled,
            app.videoPrerollDefaultSize,
            JSON.stringify(app.placements || {}),
        ]
    );
    return getPlayerAppById(result.rows[0].id);
}

async function updatePlayerApp(id, app) {
    const ftpProtocol = normalizeProtocol(app.ftpProtocol, app.ftpServer);
    const ftpTimeout = sanitizeTimeout(app.ftpTimeout);
    const password = typeof app.ftpPassword === 'string' ? app.ftpPassword : '';
    const storedPassword = password && !isEncryptedSecret(password) ? encryptSecret(password) : password;
    const result = await pool.query(
        `UPDATE player_apps SET
            name = $1, platforms = $2, platform = $3, description = $4,
            contact_email = $5, notes = $6, ftp_enabled = $7, ftp_server = $8,
            ftp_username = $9, ftp_password = $10, ftp_protocol = $11, ftp_timeout_ms = $12, network_code = $13,
            ima_enabled = $14, video_preroll_default_size = $15, placements = $16
        WHERE id = $17 RETURNING *`,
        [
            app.name,
            JSON.stringify(app.platforms || []),
            app.platform || '',
            app.description,
            app.contactEmail,
            app.notes,
            app.ftpEnabled,
            app.ftpServer,
            app.ftpUsername,
            storedPassword,
            ftpProtocol,
            ftpTimeout,
            app.networkCode,
            app.imaEnabled,
            app.videoPrerollDefaultSize,
            JSON.stringify(app.placements || {}),
            id,
        ]
    );
    if (result.rows.length === 0) return null;
    return getPlayerAppById(id);
}

async function deletePlayerApp(id) {
    await pool.query('DELETE FROM player_apps WHERE id = $1', [id]);
}

// ==================== EXPORT PROFILES ====================

async function getAllExportProfiles() {
    const result = await pool.query('SELECT * FROM export_profiles ORDER BY name');
    return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        genreIds: row.genre_ids || [],
        stationIds: row.station_ids || [],
        subGenres: row.sub_genres || [],
        playerId: row.player_id,
        autoExport: row.auto_export || {},
    }));
}

async function getExportProfileById(id) {
    const result = await pool.query('SELECT * FROM export_profiles WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        id: row.id,
        name: row.name,
        genreIds: row.genre_ids || [],
        stationIds: row.station_ids || [],
        subGenres: row.sub_genres || [],
        playerId: row.player_id,
        autoExport: row.auto_export || {},
    };
}

async function createExportProfile(profile) {
    const result = await pool.query(
        `INSERT INTO export_profiles (
            id, name, genre_ids, station_ids, sub_genres, player_id, auto_export
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
            profile.id,
            profile.name,
            JSON.stringify(profile.genreIds || []),
            JSON.stringify(profile.stationIds || []),
            JSON.stringify(profile.subGenres || []),
            profile.playerId || null,
            JSON.stringify(profile.autoExport || {}),
        ]
    );
    return getExportProfileById(result.rows[0].id);
}

async function updateExportProfile(id, profile) {
    const result = await pool.query(
        `UPDATE export_profiles SET
            name = $1, genre_ids = $2, station_ids = $3, sub_genres = $4,
            player_id = $5, auto_export = $6
        WHERE id = $7 RETURNING *`,
        [
            profile.name,
            JSON.stringify(profile.genreIds || []),
            JSON.stringify(profile.stationIds || []),
            JSON.stringify(profile.subGenres || []),
            profile.playerId || null,
            JSON.stringify(profile.autoExport || {}),
            id,
        ]
    );
    if (result.rows.length === 0) return null;
    return getExportProfileById(id);
}

async function deleteExportProfile(id) {
    await pool.query('DELETE FROM export_profiles WHERE id = $1', [id]);
}

// Clear player_id from profiles when that player is linked elsewhere
async function clearPlayerFromOtherProfiles(playerId, exceptProfileId) {
    await pool.query(
        'UPDATE export_profiles SET player_id = NULL WHERE player_id = $1 AND id != $2',
        [playerId, exceptProfileId]
    );
}

module.exports = {
    // Genres
    getAllGenres,
    getGenreById,
    createGenre,
    updateGenre,
    deleteGenre,
    
    // Stations
    getAllStations,
    getStationById,
    createStation,
    updateStation,
    deleteStation,
    
    // Player Apps
    getAllPlayerApps,
    getPlayerAppById,
    createPlayerApp,
    updatePlayerApp,
    deletePlayerApp,
    
    // Export Profiles
    getAllExportProfiles,
    getExportProfileById,
    createExportProfile,
    updateExportProfile,
    deleteExportProfile,
    clearPlayerFromOtherProfiles,
};
