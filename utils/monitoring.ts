import { StreamHealthResult } from '../types';

export const describeOnlineResult = (result?: StreamHealthResult) => {
    if (!result) {
        return 'online';
    }

    const parts: string[] = [];
    if (typeof result.statusCode === 'number') {
        parts.push(`status ${result.statusCode}`);
    }
    if (typeof result.responseTime === 'number') {
        parts.push(`${result.responseTime}ms`);
    }
    return parts.length > 0 ? parts.join(', ') : 'online';
};

export const describeOfflineResult = (result?: StreamHealthResult) => {
    if (!result) {
        return 'Stream unreachable';
    }
    if (result.error) {
        return `Stream offline: ${result.error}`;
    }
    if (typeof result.statusCode === 'number') {
        return `Stream offline (status ${result.statusCode})`;
    }
    return 'Stream offline';
};
