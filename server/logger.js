const pino = require('pino');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { Writable } = require('node:stream');
const { randomUUID } = require('node:crypto');

const LOG_DIRECTORY = path.resolve(process.env.LOG_DIRECTORY || path.join(__dirname, 'logs'));
const LOG_RETENTION_DAYS = Math.max(1, Number(process.env.LOG_RETENTION_DAYS || 7));
const LOG_BUFFER_SIZE = Math.max(50, Number(process.env.LOG_BUFFER_SIZE || 500));
const MAX_INITIAL_LOAD_FILES = 3;

const LEVEL_LABELS = {
    10: 'trace',
    20: 'debug',
    30: 'info',
    40: 'warn',
    50: 'error',
    60: 'fatal',
};

const recentEntries = [];
const subscribers = new Set();
let lineBuffer = '';
let currentDateStamp = '';
let fileStream = null;
let sequenceCounter = 0;

function ensureLogDirectory() {
    if (!fs.existsSync(LOG_DIRECTORY)) {
        fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
    }
}

function logFileNameForDate(dateStamp) {
    return `webradio-${dateStamp}.log`;
}

function currentDate() {
    return new Date().toISOString().slice(0, 10);
}

function openFileStream(dateStamp) {
    ensureLogDirectory();
    if (fileStream) {
        fileStream.end();
    }
    const filePath = path.join(LOG_DIRECTORY, logFileNameForDate(dateStamp));
    fileStream = fs.createWriteStream(filePath, { flags: 'a' });
    currentDateStamp = dateStamp;
    pruneOldLogFiles().catch(error => {
        // eslint-disable-next-line no-console
        console.error('Failed to prune log files', error);
    });
}

function ensureFileStream() {
    const today = currentDate();
    if (!fileStream || currentDateStamp !== today) {
        openFileStream(today);
    }
    return fileStream;
}

async function pruneOldLogFiles() {
    try {
        const files = await fsp.readdir(LOG_DIRECTORY);
        const logFiles = files.filter(name => /^webradio-\d{4}-\d{2}-\d{2}\.log$/i.test(name)).sort();
        if (logFiles.length <= LOG_RETENTION_DAYS) {
            return;
        }
        const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
        for (const name of logFiles) {
            const match = name.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (!match) continue;
            const fileDate = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            if (fileDate < cutoff) {
                const target = path.join(LOG_DIRECTORY, name);
                await fsp.unlink(target).catch(() => {});
            }
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to prune log files', error);
    }
}

function sanitizeDetails(record) {
    const omitKeys = new Set(['pid', 'hostname', 'time', 'level', 'msg', 'logId', 'category', 'sequence', 'service', 'v']);
    const details = {};
    for (const [key, value] of Object.entries(record)) {
        if (omitKeys.has(key)) continue;
        if (value === undefined) continue;
        details[key] = value;
    }
    return details;
}

function determineCategory(record) {
    if (typeof record.category === 'string' && record.category.trim()) {
        return record.category.trim();
    }
    if (typeof record.eventType === 'string') {
        const [prefix] = record.eventType.split('.');
        if (prefix) {
            return prefix;
        }
    }
    return 'system';
}

function finalizeRecord(record) {
    const normalized = { ...record };

    if (!normalized.logId || typeof normalized.logId !== 'string') {
        normalized.logId = randomUUID();
    }

    if (typeof normalized.sequence === 'number') {
        sequenceCounter = Math.max(sequenceCounter, normalized.sequence);
    } else {
        sequenceCounter += 1;
        normalized.sequence = sequenceCounter;
    }

    if (typeof normalized.time === 'string') {
        const parsed = Date.parse(normalized.time);
        normalized.time = Number.isFinite(parsed) ? parsed : Date.now();
    } else if (!Number.isFinite(normalized.time)) {
        normalized.time = Date.now();
    }

    normalized.category = determineCategory(normalized);

    return normalized;
}

function normalizeEntry(record) {
    const normalized = finalizeRecord(record);
    const timestamp = Number(normalized.time);
    const levelLabel = LEVEL_LABELS[normalized.level] || normalized.level || 'info';
    const details = sanitizeDetails(normalized);

    return {
        id: normalized.logId,
        sequence: normalized.sequence,
        timestamp,
        level: levelLabel,
        category: normalized.category,
        message: normalized.msg || '',
        details,
    };
}

function appendEntry(entry) {
    recentEntries.push(entry);
    if (recentEntries.length > LOG_BUFFER_SIZE) {
        recentEntries.splice(0, recentEntries.length - LOG_BUFFER_SIZE);
    }
    for (const subscriber of subscribers) {
        try {
            subscriber(entry);
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Log subscriber failed', error);
        }
    }
}

function writeRecord(record) {
    const serialized = JSON.stringify(record) + '\n';
    try {
        ensureFileStream().write(serialized);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to write log file entry', error);
    }
    process.stdout.write(serialized);
}

function processLine(line) {
    if (!line.trim()) {
        return;
    }
    try {
        const parsed = JSON.parse(line);
        const normalizedRecord = finalizeRecord(parsed);
        writeRecord(normalizedRecord);
        appendEntry(normalizeEntry({ ...normalizedRecord }));
    } catch (error) {
        process.stdout.write(`${line}\n`);
        // eslint-disable-next-line no-console
        console.error('Failed to process log entry', error);
    }
}

const destination = new Writable({
    write(chunk, encoding, callback) {
        try {
            lineBuffer += chunk.toString('utf8');
            let newlineIndex = lineBuffer.indexOf('\n');
            while (newlineIndex !== -1) {
                const line = lineBuffer.slice(0, newlineIndex);
                lineBuffer = lineBuffer.slice(newlineIndex + 1);
                processLine(line);
                newlineIndex = lineBuffer.indexOf('\n');
            }
            callback();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to handle log chunk', error);
            callback(error);
        }
    },
});

const logger = pino(
    {
        level: process.env.LOG_LEVEL || 'info',
        base: { service: 'webradio-api' },
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination
);

function getRecentLogEntries({ categories, limit, after } = {}) {
    const allowed = Array.isArray(categories) && categories.length > 0 ? new Set(categories) : null;
    const afterValue = Number.isFinite(after) ? Number(after) : null;
    const filtered = recentEntries.filter(entry => {
        if (allowed && !allowed.has(entry.category)) {
            return false;
        }
        if (afterValue !== null && entry.sequence <= afterValue) {
            return false;
        }
        return true;
    });
    const sliceLimit = Number.isFinite(limit) && limit > 0 ? Number(limit) : 200;
    const start = Math.max(0, filtered.length - sliceLimit);
    return filtered.slice(start).map(entry => ({ ...entry }));
}

function subscribeToLogEntries(listener) {
    subscribers.add(listener);
    return () => {
        subscribers.delete(listener);
    };
}

function logEvent(level, message, context = {}) {
    const payload = { ...context };
    if (context && typeof context === 'object' && !('category' in context) && context.eventType) {
        payload.category = determineCategory({ ...context });
    }
    if (!payload.category) {
        payload.category = 'system';
    }
    if (typeof logger[level] === 'function') {
        logger[level](payload, message);
    } else {
        logger.info(payload, message);
    }
}

async function loadRecentLogsFromDisk() {
    try {
        ensureLogDirectory();
        const files = await fsp.readdir(LOG_DIRECTORY);
        const logFiles = files.filter(name => /^webradio-\d{4}-\d{2}-\d{2}\.log$/i.test(name)).sort();
        const recentFiles = logFiles.slice(-MAX_INITIAL_LOAD_FILES);
        for (const name of recentFiles) {
            const filePath = path.join(LOG_DIRECTORY, name);
            const content = await fsp.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    const normalized = normalizeEntry(parsed);
                    appendEntry(normalized);
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to hydrate log history', error);
                }
            }
        }
        if (recentEntries.length > LOG_BUFFER_SIZE) {
            recentEntries.splice(0, recentEntries.length - LOG_BUFFER_SIZE);
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load existing log history', error);
    }
}

loadRecentLogsFromDisk().catch(error => {
    // eslint-disable-next-line no-console
    console.error('Failed to bootstrap log history', error);
});

module.exports = {
    logger,
    logEvent,
    getRecentLogEntries,
    subscribeToLogEntries,
};
