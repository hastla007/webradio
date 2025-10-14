const DEFAULT_TIMEOUT_MS = 5000;
const FALLBACK_METHODS = new Set([405, 501, 403]);

const toNumber = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

async function attemptRequest(streamUrl, method, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
        const response = await fetch(streamUrl, {
            method,
            signal: controller.signal,
            headers: method === 'GET' ? { Range: 'bytes=0-0' } : undefined,
        });
        clearTimeout(timeoutId);
        return {
            isOnline: response.ok,
            statusCode: response.status,
            contentType: response.headers.get('content-type'),
            responseTime: Date.now() - start,
        };
    } catch (error) {
        clearTimeout(timeoutId);
        return {
            isOnline: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            responseTime: Date.now() - start,
        };
    }
}

async function checkStreamHealth(streamUrl, options = {}) {
    if (typeof streamUrl !== 'string' || !streamUrl.trim()) {
        throw new Error('streamUrl is required');
    }

    const timeoutCandidate = toNumber(options.timeoutMs);
    const timeoutMs = timeoutCandidate ? Math.min(Math.max(timeoutCandidate, 1000), 30000) : DEFAULT_TIMEOUT_MS;
    const normalizedUrl = streamUrl.trim();

    let result = await attemptRequest(normalizedUrl, 'HEAD', timeoutMs);

    if (
        !result.isOnline &&
        (result.statusCode === undefined || FALLBACK_METHODS.has(result.statusCode))
    ) {
        const fallback = await attemptRequest(normalizedUrl, 'GET', timeoutMs);
        result = {
            ...fallback,
            contentType: fallback.contentType || result.contentType,
            error: fallback.error || result.error,
        };
    }

    return {
        isOnline: result.isOnline,
        statusCode: result.statusCode,
        contentType: result.contentType ?? null,
        responseTime: result.responseTime,
        error: result.isOnline ? undefined : result.error,
    };
}

module.exports = {
    checkStreamHealth,
};
