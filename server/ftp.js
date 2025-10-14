const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const SUPPORTED_PROTOCOLS = new Set(['ftp', 'ftps', 'sftp']);
const DEFAULT_TIMEOUT_MS = 30000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 600000;

function sanitizeTimeout(timeoutMs) {
    const numeric = Number(timeoutMs);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return DEFAULT_TIMEOUT_MS;
    }
    const clamped = Math.min(Math.max(Math.round(numeric), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
    return clamped;
}

function normalizeProtocol(protocol, serverValue) {
    const explicit = typeof protocol === 'string' ? protocol.trim().toLowerCase() : '';
    if (SUPPORTED_PROTOCOLS.has(explicit)) {
        return explicit;
    }
    if (typeof serverValue === 'string') {
        const trimmed = serverValue.trim().toLowerCase();
        if (trimmed.startsWith('sftp://')) {
            return 'sftp';
        }
        if (trimmed.startsWith('ftps://')) {
            return 'ftps';
        }
    }
    return 'ftp';
}

function toSegments(value) {
    if (!value) {
        return [];
    }
    return value
        .split('/')
        .map(segment => segment.trim())
        .filter(segment => segment.length > 0);
}

function parseFtpServer(server, protocol) {
    const trimmed = typeof server === 'string' ? server.trim() : '';
    if (!trimmed) {
        throw new Error('FTP server is required.');
    }

    const effectiveProtocol = normalizeProtocol(protocol, trimmed);
    const scheme = /^[a-z]+:\/\//i.test(trimmed) ? '' : `${effectiveProtocol}://`;

    let url;
    try {
        url = new URL(`${scheme}${trimmed}`);
    } catch (error) {
        throw new Error('FTP server value is not a valid URL.');
    }

    if (url.username || url.password) {
        throw new Error('Remove embedded credentials from the FTP server value.');
    }

    const host = url.hostname.trim();
    if (!host) {
        throw new Error('FTP server host is required.');
    }

    const originalScheme = url.protocol.replace(':', '').toLowerCase();
    const resolvedProtocol = normalizeProtocol(protocol || originalScheme, trimmed);
    const port = url.port ? Number(url.port) : undefined;
    const pathname = url.pathname || '';
    const absolutePath = pathname.startsWith('/');
    const normalizedPath = path.posix.normalize(pathname || '/');
    const baseSegments = normalizedPath === '/' ? [] : toSegments(absolutePath ? normalizedPath.slice(1) : normalizedPath);

    const implicitFtps = resolvedProtocol === 'ftps' && (originalScheme === 'ftps' || port === 990);

    return {
        protocol: resolvedProtocol,
        host,
        port: Number.isFinite(port) ? Number(port) : undefined,
        baseSegments,
        absolutePath,
        implicitFtps,
    };
}

function encodePathSegments(segments) {
    return segments.map(segment => encodeURIComponent(segment));
}

function buildPathname(baseSegments, extraSegments, fileName, absolutePath) {
    const segments = [...baseSegments, ...extraSegments];
    if (fileName) {
        segments.push(fileName);
    }
    const encoded = encodePathSegments(segments);
    let pathname = encoded.join('/');
    if (absolutePath) {
        pathname = `/${pathname}`;
    } else if (pathname.length > 0) {
        pathname = `/${pathname}`;
    } else {
        pathname = '/';
    }
    if (!fileName && !pathname.endsWith('/')) {
        pathname = `${pathname}/`;
    }
    return pathname;
}

function buildRemoteUrl(config, extraSegments = [], fileName) {
    const scheme = config.protocol === 'ftps' && !config.implicitFtps ? 'ftp' : config.protocol;
    const url = new URL(`${scheme}://${config.host}`);
    if (config.port) {
        url.port = String(config.port);
    }
    url.pathname = buildPathname(config.baseSegments, extraSegments, fileName, config.absolutePath);
    return url.toString();
}

function buildUserPassword(username, password) {
    return `${username}:${password}`;
}

function createCurlArgs(config, targetUrl, { uploadFile }) {
    const timeoutSeconds = Math.max(1, Math.ceil(config.timeoutMs / 1000));
    const args = ['--silent', '--show-error', '--fail', '--connect-timeout', String(timeoutSeconds), '--user', buildUserPassword(config.username, config.password)];

    if (config.protocol === 'ftps' && !config.implicitFtps) {
        args.push('--ftp-ssl', '--ssl-reqd');
    }

    if (uploadFile) {
        args.push('--ftp-create-dirs', '-T', uploadFile, targetUrl);
    } else {
        args.push('--list-only', targetUrl);
    }

    return args;
}

async function runCurl(args) {
    return await new Promise((resolve, reject) => {
        const child = spawn('curl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', chunk => {
            stderr += chunk.toString();
        });
        child.on('error', error => {
            if (error && error.code === 'ENOENT') {
                reject(new Error('The "curl" binary is required to perform FTP transfers.'));
                return;
            }
            reject(error);
        });
        child.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                const message = stderr.trim() || `curl exited with code ${code}`;
                reject(new Error(message));
            }
        });
    });
}

function normalizeFtpSettings(settings) {
    const serverConfig = parseFtpServer(settings.server, settings.protocol);
    const username = typeof settings.username === 'string' ? settings.username.trim() : '';
    const password = typeof settings.password === 'string' ? settings.password : '';
    if (!username) {
        throw new Error('FTP username is required.');
    }
    if (!password) {
        throw new Error('FTP password is required.');
    }

    return {
        ...serverConfig,
        username,
        password,
        timeoutMs: sanitizeTimeout(settings.timeoutMs),
    };
}

async function testFtpConnection(settings) {
    const config = normalizeFtpSettings(settings);
    const targetUrl = buildRemoteUrl(config);
    await runCurl(createCurlArgs(config, targetUrl, {}));
    return true;
}

async function uploadFiles(configInput, files, options = {}) {
    const config = normalizeFtpSettings(configInput);
    const extraSegments = options.remoteSubdirectory ? toSegments(options.remoteSubdirectory) : [];

    const uploaded = [];
    for (const file of files) {
        await fs.access(file.outputPath);
        const targetUrl = buildRemoteUrl(config, extraSegments, file.fileName);
        const args = createCurlArgs(config, targetUrl, { uploadFile: file.outputPath });
        await runCurl(args);
        uploaded.push(file.fileName);
    }
    return uploaded;
}

module.exports = {
    sanitizeTimeout,
    normalizeProtocol,
    normalizeFtpSettings,
    testFtpConnection,
    uploadFiles,
};
