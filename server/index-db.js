const express = require('express');
const cors = require('cors');
require('dotenv').config();

const {
    getAllGenres, getGenreById, createGenre, updateGenre, deleteGenre,
    getAllStations, getStationById, createStation, updateStation, deleteStation,
    getAllPlayerApps, getPlayerAppById, createPlayerApp, updatePlayerApp, deletePlayerApp,
    getAllExportProfiles, getExportProfileById, createExportProfile, updateExportProfile, deleteExportProfile,
    clearPlayerFromOtherProfiles
} = require('./db_operations');

const PORT = Number(process.env.PORT || 4000);
const API_PREFIX = process.env.API_PREFIX || '/api';

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get(`${API_PREFIX}/health`, (req, res) => {
    res.json({ status: 'ok', storage: 'postgresql' });
});

// Genres
app.get(`${API_PREFIX}/genres`, async (req, res) => {
    try {
        const genres = await getAllGenres();
        res.json(genres);
    } catch (error) {
        console.error('Failed to fetch genres', error);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});

app.post(`${API_PREFIX}/genres`, async (req, res) => {
    try {
        const genre = await createGenre(req.body);
        res.json(genre);
    } catch (error) {
        console.error('Failed to create genre', error);
        res.status(500).json({ error: 'Failed to create genre' });
    }
});

app.put(`${API_PREFIX}/genres/:id`, async (req, res) => {
    try {
        const genre = await updateGenre(req.params.id, req.body);
        if (!genre) {
            return res.status(404).json({ error: 'Genre not found' });
        }
        res.json(genre);
    } catch (error) {
        console.error('Failed to update genre', error);
        res.status(500).json({ error: 'Failed to update genre' });
    }
});

app.delete(`${API_PREFIX}/genres/:id`, async (req, res) => {
    try {
        await deleteGenre(req.params.id);
        res.status(204).end();
    } catch (error) {
        console.error('Failed to delete genre', error);
        res.status(500).json({ error: 'Failed to delete genre' });
    }
});

// Stations
app.get(`${API_PREFIX}/stations`, async (req, res) => {
    try {
        const stations = await getAllStations();
        res.json(stations);
    } catch (error) {
        console.error('Failed to fetch stations', error);
        res.status(500).json({ error: 'Failed to fetch stations' });
    }
});

app.post(`${API_PREFIX}/stations`, async (req, res) => {
    try {
        const station = await createStation(req.body);
        res.json(station);
    } catch (error) {
        console.error('Failed to create station', error);
        res.status(500).json({ error: 'Failed to create station' });
    }
});

app.put(`${API_PREFIX}/stations/:id`, async (req, res) => {
    try {
        const station = await updateStation(req.params.id, req.body);
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        res.json(station);
    } catch (error) {
        console.error('Failed to update station', error);
        res.status(500).json({ error: 'Failed to update station' });
    }
});

app.delete(`${API_PREFIX}/stations/:id`, async (req, res) => {
    try {
        await deleteStation(req.params.id);
        res.status(204).end();
    } catch (error) {
        console.error('Failed to delete station', error);
        res.status(500).json({ error: 'Failed to delete station' });
    }
});

// Player Apps
app.get(`${API_PREFIX}/player-apps`, async (req, res) => {
    try {
        const apps = await getAllPlayerApps();
        res.json(apps);
    } catch (error) {
        console.error('Failed to fetch player apps', error);
        res.status(500).json({ error: 'Failed to fetch player apps' });
    }
});

app.post(`${API_PREFIX}/player-apps`, async (req, res) => {
    try {
        const app = await createPlayerApp(req.body);
        res.json(app);
    } catch (error) {
        console.error('Failed to create player app', error);
        res.status(500).json({ error: 'Failed to create player app' });
    }
});

app.put(`${API_PREFIX}/player-apps/:id`, async (req, res) => {
    try {
        const app = await updatePlayerApp(req.params.id, req.body);
        if (!app) {
            return res.status(404).json({ error: 'Player app not found' });
        }
        res.json(app);
    } catch (error) {
        console.error('Failed to update player app', error);
        res.status(500).json({ error: 'Failed to update player app' });
    }
});

app.delete(`${API_PREFIX}/player-apps/:id`, async (req, res) => {
    try {
        await deletePlayerApp(req.params.id);
        res.status(204).end();
    } catch (error) {
        console.error('Failed to delete player app', error);
        res.status(500).json({ error: 'Failed to delete player app' });
    }
});

// Export Profiles
app.get(`${API_PREFIX}/export-profiles`, async (req, res) => {
    try {
        const profiles = await getAllExportProfiles();
        res.json(profiles);
    } catch (error) {
        console.error('Failed to fetch export profiles', error);
        res.status(500).json({ error: 'Failed to fetch export profiles' });
    }
});

app.post(`${API_PREFIX}/export-profiles`, async (req, res) => {
    try {
        if (req.body.playerId) {
            await clearPlayerFromOtherProfiles(req.body.playerId, req.body.id);
        }
        const profile = await createExportProfile(req.body);
        res.json(profile);
    } catch (error) {
        console.error('Failed to create export profile', error);
        res.status(500).json({ error: 'Failed to create export profile' });
    }
});

app.put(`${API_PREFIX}/export-profiles/:id`, async (req, res) => {
    try {
        if (req.body.playerId) {
            await clearPlayerFromOtherProfiles(req.body.playerId, req.params.id);
        }
        const profile = await updateExportProfile(req.params.id, req.body);
        if (!profile) {
            return res.status(404).json({ error: 'Export profile not found' });
        }
        res.json(profile);
    } catch (error) {
        console.error('Failed to update export profile', error);
        res.status(500).json({ error: 'Failed to update export profile' });
    }
});

app.delete(`${API_PREFIX}/export-profiles/:id`, async (req, res) => {
    try {
        await deleteExportProfile(req.params.id);
        res.status(204).end();
    } catch (error) {
        console.error('Failed to delete export profile', error);
        res.status(500).json({ error: 'Failed to delete export profile' });
    }
});

// Export functionality (reuse from index.js)
const serverModule = require('./index.js');
app.post(`${API_PREFIX}/export-profiles/:id/export`, async (req, res) => {
    try {
        const profile = await getExportProfileById(req.params.id);
        if (!profile) {
            return res.status(404).json({ error: 'Export profile not found' });
        }

        const data = {
            genres: await getAllGenres(),
            stations: await getAllStations(),
            playerApps: await getAllPlayerApps(),
            exportProfiles: [profile]
        };

        const exportContext = serverModule.buildExportPayload(profile, data);
        if (exportContext.stationCount === 0) {
            return res.status(400).json({ error: 'No active stations to export' });
        }

        const files = await serverModule.writeExportFiles(profile, exportContext);
        res.json({
            profileId: profile.id,
            profileName: profile.name,
            stationCount: exportContext.stationCount,
            outputDirectory: process.env.EXPORT_OUTPUT_DIR,
            files
        });
    } catch (error) {
        console.error('Failed to export', error);
        res.status(500).json({ error: 'Failed to export' });
    }
});

app.listen(PORT, () => {
    console.log(`WebRadio Admin API (PostgreSQL) listening on port ${PORT}`);
});
