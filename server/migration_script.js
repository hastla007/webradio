#!/usr/bin/env node
/**
 * Migrate data from JSON file to PostgreSQL
 * Usage: node migrate-to-postgres.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const defaultDataPath = path.join(__dirname, '..', 'data', 'defaultData.json');

async function migrate() {
    console.log('🚀 Starting migration to PostgreSQL...\n');

    try {
        // Load data from JSON
        let data;
        try {
            const jsonData = fs.readFileSync(defaultDataPath, 'utf8');
            data = JSON.parse(jsonData);
            console.log('✅ Loaded data from defaultData.json');
        } catch (error) {
            console.error('❌ Failed to load defaultData.json:', error.message);
            process.exit(1);
        }

        // Test database connection
        await pool.query('SELECT 1');
        console.log('✅ Database connection successful\n');

        // Migrate Genres
        console.log('📁 Migrating genres...');
        for (const genre of data.genres || []) {
            await pool.query(
                `INSERT INTO genres (id, name, sub_genres) 
                 VALUES ($1, $2, $3) 
                 ON CONFLICT (id) DO UPDATE 
                 SET name = EXCLUDED.name, sub_genres = EXCLUDED.sub_genres`,
                [genre.id, genre.name, JSON.stringify(genre.subGenres || [])]
            );
        }
        console.log(`✅ Migrated ${(data.genres || []).length} genres\n`);

        // Migrate Stations
        console.log('📻 Migrating stations...');
        for (const station of data.stations || []) {
            await pool.query(
                `INSERT INTO stations (
                    id, name, stream_url, description, genre_id, sub_genres,
                    logo_url, bitrate, language, region, tags, ima_ad_type,
                    is_active, is_favorite
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    stream_url = EXCLUDED.stream_url,
                    description = EXCLUDED.description,
                    genre_id = EXCLUDED.genre_id,
                    sub_genres = EXCLUDED.sub_genres,
                    logo_url = EXCLUDED.logo_url,
                    bitrate = EXCLUDED.bitrate,
                    language = EXCLUDED.language,
                    region = EXCLUDED.region,
                    tags = EXCLUDED.tags,
                    ima_ad_type = EXCLUDED.ima_ad_type,
                    is_active = EXCLUDED.is_active,
                    is_favorite = EXCLUDED.is_favorite`,
                [
                    station.id,
                    station.name,
                    station.streamUrl || station.stream_url,
                    station.description || '',
                    station.genreId || null,
                    JSON.stringify(station.subGenres || []),
                    station.logoUrl || '',
                    station.bitrate || 128,
                    station.language || 'en',
                    station.region || 'Global',
                    JSON.stringify(station.tags || []),
                    station.imaAdType || 'no',
                    station.isActive !== false,
                    station.isFavorite === true,
                ]
            );
        }
        console.log(`✅ Migrated ${(data.stations || []).length} stations\n`);

        // Migrate Player Apps
        console.log('📱 Migrating player apps...');
        for (const app of data.playerApps || []) {
            await pool.query(
                `INSERT INTO player_apps (
                    id, name, platforms, platform, description, contact_email, notes,
                    ftp_enabled, ftp_server, ftp_username, ftp_password, network_code,
                    ima_enabled, video_preroll_default_size, placements
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    platforms = EXCLUDED.platforms,
                    platform = EXCLUDED.platform,
                    description = EXCLUDED.description,
                    contact_email = EXCLUDED.contact_email,
                    notes = EXCLUDED.notes,
                    ftp_enabled = EXCLUDED.ftp_enabled,
                    ftp_server = EXCLUDED.ftp_server,
                    ftp_username = EXCLUDED.ftp_username,
                    ftp_password = EXCLUDED.ftp_password,
                    network_code = EXCLUDED.network_code,
                    ima_enabled = EXCLUDED.ima_enabled,
                    video_preroll_default_size = EXCLUDED.video_preroll_default_size,
                    placements = EXCLUDED.placements`,
                [
                    app.id,
                    app.name,
                    JSON.stringify(app.platforms || []),
                    app.platform || '',
                    app.description || '',
                    app.contactEmail || '',
                    app.notes || '',
                    app.ftpEnabled || false,
                    app.ftpServer || '',
                    app.ftpUsername || '',
                    app.ftpPassword || '',
                    app.networkCode || '',
                    app.imaEnabled !== false,
                    app.videoPrerollDefaultSize || '640x480',
                    JSON.stringify(app.placements || {}),
                ]
            );
        }
        console.log(`✅ Migrated ${(data.playerApps || []).length} player apps\n`);

        // Migrate Export Profiles
        console.log('📤 Migrating export profiles...');
        for (const profile of data.exportProfiles || []) {
            await pool.query(
                `INSERT INTO export_profiles (
                    id, name, genre_ids, station_ids, sub_genres, player_id, auto_export
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    genre_ids = EXCLUDED.genre_ids,
                    station_ids = EXCLUDED.station_ids,
                    sub_genres = EXCLUDED.sub_genres,
                    player_id = EXCLUDED.player_id,
                    auto_export = EXCLUDED.auto_export`,
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
        }
        console.log(`✅ Migrated ${(data.exportProfiles || []).length} export profiles\n`);

        // Summary
        console.log('✅ Migration completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   - Genres: ${(data.genres || []).length}`);
        console.log(`   - Stations: ${(data.stations || []).length}`);
        console.log(`   - Player Apps: ${(data.playerApps || []).length}`);
        console.log(`   - Export Profiles: ${(data.exportProfiles || []).length}`);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run migration
migrate();
