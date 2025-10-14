# WebRadio Admin Panel

A full-featured administration console for programming and exporting curated web radio stations. The app couples a React front end with a lightweight Express API that persists data to JSON, supports rich offline behaviour, and produces export payloads tailored to downstream player apps.

## Table of contents

- [Features](#features)
- [Architecture overview](#architecture-overview)
  - [Frontend](#frontend)
  - [Backend API](#backend-api)
  - [Offline data store](#offline-data-store)
  - [Exports and file layout](#exports-and-file-layout)
- [Repository structure](#repository-structure)
- [Domain model](#domain-model)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Install dependencies](#install-dependencies)
  - [Run the full stack](#run-the-full-stack)
  - [Available npm scripts](#available-npm-scripts)
  - [Environment variables](#environment-variables)
- [Running with Docker Compose](#running-with-docker-compose)
- [Working with data](#working-with-data)
  - [Default catalogue](#default-catalogue)
  - [Genres and sub-genres](#genres-and-sub-genres)
  - [Station artwork](#station-artwork)
  - [Player apps](#player-apps)
- [Export workflows](#export-workflows)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Deployment tips](#deployment-tips)

## Features

- Manage radio stations, genres with nested sub-genres, player applications, and export profiles from a single dashboard.
- Offline-first data handling. The UI seamlessly falls back to an in-browser cache when the API is unavailable and re-synchronises once the connection returns.
- Automatic artwork sanitation: legacy and placeholder URLs are normalised and rendered with the bundled `/static/webradio_placeholder.png` asset when no bespoke image is available.
- Flexible export engine that bundles stations by genre, explicit selection, or sub-genre inclusion and writes JSON payloads for each player platform.
- Built-in monitoring and listening tools so editors can audition streams and track uptime without leaving the admin panel.
- Lightweight Express backend with zero external dependencies—data is persisted to JSON on disk and ready-to-ship export files are materialised locally.

## Architecture overview

### Frontend

- **Framework**: React 19 with Vite for rapid development and hot module replacement.
- **State management**: Local component state paired with helper modules (`api.ts`, `localDataStore.ts`) that abstract API calls and offline persistence.
- **Styling**: The UI ships with ready-made components tailored to the WebRadio brand, including sidebar navigation, data tables, modals, and player views.
- **Offline banner**: A global banner warns when the backend cannot be reached and offers a manual retry once the API is restored.

### Backend API

- **Platform**: Express 4 with CORS enabled for the Vite dev server.
- **Persistence**: All entities (stations, genres, player apps, export profiles) are stored in `server/runtime-data.json` by default. The file is created on first run and upgraded transparently if the schema evolves.
- **Exports**: `POST /api/export-profiles/:id/export` compiles the selected stations, attaches optional ad payloads derived from linked player apps, and writes JSON files to `exports/` (configurable via `EXPORT_OUTPUT_DIR`).
- **Data hygiene**: Incoming payloads are normalised (IDs, casing, duplicates, placeholders) to keep both the server store and client cache consistent.

### Offline data store

`localDataStore.ts` mirrors the backend logic for environments where the API cannot be reached. It stores a clone of the default data set (or last known server state) in memory or `localStorage`, enforces the same normalisation rules as the server, and drives the offline UX.

### Exports and file layout

Export payloads contain:

- `stations`: Array of curated stations, each with metadata, sub-genre tags, artwork URL, and optional ad routing data.
- `app`: Optional metadata describing the player app (ID, platform, version) when the export profile is linked to a player.
- `ads`: Optional IMA/DFP settings derived from the player’s configured placements.

The API writes one JSON file per platform detected on the linked player (e.g. `my-app-ios.json`, `my-app-android.json`). When no player is linked, a `generic` export file is produced.

## Repository structure

```
├── App.tsx                 # Entry point that wires the layout, routing, and API provider
├── components/             # React UI components (dashboard, managers, modals, listen page)
├── data/
│   ├── defaultData.json    # Seed data shared by the API and offline store
│   └── stationLogos.json   # Lookup table for legacy artwork references
├── localDataStore.ts       # Offline persistence layer and export helpers
├── api.ts                  # API client with offline fallbacks
├── server/
│   ├── index.js            # Express API with JSON persistence
│   └── package.json        # Backend runtime metadata
├── scripts/
│   ├── dev-with-api.mjs    # Starts API and Vite dev server together
│   └── run-tests.mjs       # Bundles and runs the TypeScript test suite with esbuild
├── static/                 # Public assets served by Vite
├── tests/                  # Lightweight test harness and unit tests
├── types.ts                # Shared TypeScript types for stations, genres, profiles, etc.
└── README.md               # You are here
```

## Domain model

| Entity | Key fields | Notes |
| --- | --- | --- |
| **RadioStation** | `id`, `name`, `streamUrl`, `genreId`, `subGenres[]`, `logoUrl`, `tags[]`, `imaAdType`, flags | Artwork is normalised to drop known placeholders and legacy GitHub URLs. Sub-genres must belong to the assigned genre. |
| **Genre** | `id`, `name`, `subGenres[]` | Sub-genres are deduplicated case-insensitively. Removing a genre clears it from stations and export profiles. |
| **PlayerApp** | `id`, `name`, `platforms[]`, `networkCode`, `placements` | Used to enrich exports with ad settings and produce platform-specific files. |
| **ExportProfile** | `id`, `name`, `genreIds[]`, `stationIds[]`, `subGenres[]`, `playerId`, `autoExport` | Combines stations by genre, explicit selection, and sub-genre inclusion. One profile can own a player at a time. |

## Getting started

### Prerequisites

- Node.js **18 or newer** (uses global `fetch`, `Response`, and other modern APIs).
- npm **9+** is recommended to match the lockfile expectations.

### Install dependencies

```bash
npm install
```

The root package runs a post-install step that installs the API dependencies inside `server/` so `npm run api` works without any manual bootstrapping.

### Run the full stack

```bash
npm run dev -- --host
```

The helper script launches the Express API on port `4000` and the Vite dev server on port `5173` (configurable). Additional flags are forwarded to Vite, so you can continue to use `--host`, `--port`, etc. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop both processes together.

Once running:

- Frontend: http://localhost:5173 (or the port you selected)
- API: http://localhost:4000/api
- Export files: `exports/` in the repository root

### Available npm scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Launch Express and Vite together (default development workflow). |
| `npm run dev:ui` | Start only the Vite development server. Use this when pointing the UI at a remote API. |
| `npm run api` | Start only the Express API. Useful for integration tests or when serving the UI separately. |
| `npm run build` | Build the production Vite bundle. |
| `npm run preview` | Serve the built assets locally for smoke testing. |
| `npm run test` | Bundle and run the TypeScript unit tests via esbuild. |

### Environment variables

| Variable | Target | Default | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Frontend (`.env.local`) | `http://localhost:4000/api` | API root URL used by the React app. |
| `PORT` | Backend (`server/.env`) | `4000` | Listening port for the Express API. |
| `API_PREFIX` | Backend | `/api` | Prefix added to all API routes. |
| `API_DATA_PATH` | Backend | `server/runtime-data.json` | Where the API persists its JSON database. |
| `EXPORT_OUTPUT_DIR` | Backend | `<repo>/exports` | Directory for generated export payloads. |

## Running with Docker Compose

```bash
docker compose up --build
```

- Frontend is exposed on [http://localhost:3004](http://localhost:3004).
- API is available at [http://localhost:4000/api](http://localhost:4000/api).
- Data and export files persist in Docker volumes mounted under `./docker-data` by default.

## Working with data

### Default catalogue

`data/defaultData.json` seeds the application with the SomaFM and Ibiza stations referenced in earlier iterations of the project. The file includes genres, stations, export profiles, and player apps so the app is usable immediately after cloning.

### Genres and sub-genres

- Sub-genres are case-insensitive and deduplicated automatically.
- Stations can belong to multiple sub-genres, but only ones defined on their parent genre.
- Removing a sub-genre from a genre prunes it from all stations and export profiles.

### Station artwork

- `stationLogos.ts` sanitises URLs, strips legacy GitHub references, and treats common placeholder providers (Unsplash, Picsum, etc.) as empty.
- When no specific artwork is available, `/static/webradio_placeholder.png` is used in the UI and export payloads.
- The server mirrors the same sanitation logic to prevent stale data from reappearing.

### Player apps

Player apps capture deployment metadata and advertising placements. An export profile can optionally lock to a player; when multiple profiles target the same app, the most recently edited profile wins and the previous association is cleared automatically.

## Export workflows

1. Create or select an export profile.
2. Choose genres, explicit stations, and optional sub-genres to include.
3. (Optional) Link a player app to enrich the export with ad settings and platform metadata.
4. Click **Export Now** in the UI or call the API directly:
   ```bash
   curl -X POST http://localhost:4000/api/export-profiles/<profile-id>/export
   ```
5. Check the `exports/` directory for the generated JSON. Each file lists the station lineup, player metadata, and ad configuration ready to ship to downstream clients.

Exports exclude inactive stations unless they are explicitly selected in the profile.

## Testing

Unit tests cover the API client fallbacks, station logo normalisation, and the offline data store—including sub-genre handling and export generation. Run the suite with:

```bash
npm run test
```

The script bundles the TypeScript sources with esbuild before executing them under Node.js. Tests run quickly and require no browser environment.

## Troubleshooting

- **Offline banner persists** – Ensure the API is running on the configured host and port. When using Docker, confirm the frontend environment variable points to `http://backend:4000/api` inside the Compose network.
- **Exports fail with “no active stations”** – Check that your selected genres/sub-genres include active stations or add explicit station overrides in the profile.
- **Permission errors when writing exports** – Update `EXPORT_OUTPUT_DIR` to a writable directory or adjust filesystem permissions for the Node process.

## Deployment tips

- Serve the built frontend (`npm run build`) from any static host (Netlify, Vercel, S3). Set `VITE_API_BASE_URL` at build time or via runtime configuration.
- Host the Express API anywhere Node.js runs. Mount a persistent volume for `API_DATA_PATH` and `EXPORT_OUTPUT_DIR` so edits and exports survive restarts.
- Consider scheduling automated exports by hitting the API endpoint from cron or a CI job; the exported files are deterministic and easy to archive.

---

Happy broadcasting! Tailor the catalogue, tune the exports, and keep your listeners engaged.
