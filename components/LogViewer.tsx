import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchLogs, subscribeToLogStream, LogQueryOptions, LogStreamHandle } from '../api';
import { LogCategory, LogEntry } from '../types';

interface LogViewerProps {
    isOffline: boolean;
}

type CategoryFilter = 'all' | LogCategory;

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All activity' },
    { value: 'errors', label: 'Errors' },
    { value: 'stations', label: 'Stations' },
    { value: 'exports', label: 'Exports' },
    { value: 'monitoring', label: 'Monitoring' },
];

const LEVEL_STYLES: Record<string, string> = {
    fatal: 'bg-red-600 text-white',
    error: 'bg-red-500 text-white',
    warn: 'bg-yellow-400 text-brand-dark',
    info: 'bg-brand-primary text-brand-dark',
    debug: 'bg-gray-200 text-brand-dark',
    trace: 'bg-gray-100 text-brand-dark',
};

const MAX_LOG_ENTRIES = 500;
const STREAM_BATCH_LIMIT = 100;

const formatTimestamp = (timestamp: number) => {
    try {
        return new Date(timestamp).toLocaleString();
    } catch (error) {
        return String(timestamp);
    }
};

const serializeDetails = (details: Record<string, unknown>) => {
    const keys = Object.keys(details || {});
    if (keys.length === 0) {
        return '-';
    }
    return JSON.stringify(details, null, 2);
};

const LogViewer: React.FC<LogViewerProps> = ({ isOffline }) => {
    const [entries, setEntries] = useState<LogEntry[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
    const [cursor, setCursor] = useState<number | null>(null);
    const [hasLoaded, setHasLoaded] = useState<boolean>(false);

    const cursorRef = useRef<number | null>(null);
    cursorRef.current = cursor;

    const activeCategories = useMemo(() => {
        if (selectedCategory === 'all') {
            return undefined;
        }
        return [selectedCategory];
    }, [selectedCategory]);

    const loadLogs = useCallback(
        async (options: Partial<LogQueryOptions> = {}) => {
            setIsLoading(true);
            setHasLoaded(false);
            try {
                const response = await fetchLogs({
                    categories: activeCategories,
                    limit: MAX_LOG_ENTRIES,
                    ...options,
                });
                setEntries(response.entries);
                const nextCursor = response.cursor ?? (response.entries.length > 0 ? response.entries[response.entries.length - 1].sequence : null);
                setCursor(nextCursor);
                setError(null);
                setHasLoaded(true);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to load logs.';
                setError(message);
            } finally {
                setIsLoading(false);
            }
        },
        [activeCategories]
    );

    useEffect(() => {
        void loadLogs({ cursor: null });
    }, [loadLogs, selectedCategory]);

    useEffect(() => {
        if (!isOffline) {
            return;
        }
        setAutoRefresh(false);
    }, [isOffline]);

    useEffect(() => {
        if (!autoRefresh || isOffline || !hasLoaded) {
            return;
        }

        let isClosed = false;
        let handle: LogStreamHandle | null = null;

        const streamHandle = subscribeToLogStream(
            {
                categories: activeCategories,
                cursor: cursorRef.current ?? undefined,
                limit: STREAM_BATCH_LIMIT,
            },
            {
                onEntry: entry => {
                    setEntries(previous => {
                        if (previous.some(existing => existing.sequence === entry.sequence)) {
                            return previous;
                        }
                        const next = [...previous, entry];
                        if (next.length > MAX_LOG_ENTRIES) {
                            return next.slice(next.length - MAX_LOG_ENTRIES);
                        }
                        return next;
                    });
                    setCursor(entry.sequence);
                },
                onError: () => {
                    if (isClosed) {
                        return;
                    }
                    setError('Live log stream disconnected. Auto-refresh has been disabled.');
                    setAutoRefresh(false);
                },
            }
        );

        handle = streamHandle;

        return () => {
            isClosed = true;
            handle?.close();
        };
    }, [activeCategories, autoRefresh, hasLoaded, isOffline]);

    const handleExport = (format: 'json' | 'csv') => {
        if (entries.length === 0) {
            return;
        }
        const fileName = `logs-${format}-${new Date().toISOString()}.${format}`;
        let content = '';
        let mimeType = '';

        if (format === 'json') {
            content = JSON.stringify(entries, null, 2);
            mimeType = 'application/json';
        } else {
            const header = ['timestamp', 'level', 'category', 'message', 'details'];
            const rows = entries.map(entry => {
                const detailString = JSON.stringify(entry.details ?? {});
                return [
                    new Date(entry.timestamp).toISOString(),
                    entry.level,
                    entry.category,
                    entry.message.replace(/\s+/g, ' ').trim(),
                    detailString,
                ];
            });
            const serialize = (value: string) => `"${value.replace(/"/g, '""')}"`;
            content = [header.map(serialize).join(','), ...rows.map(row => row.map(serialize).join(','))].join('\n');
            mimeType = 'text/csv';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex-1 overflow-hidden px-8 py-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-brand-dark">Activity Logs</h1>
                    <p className="text-sm text-brand-text-light">
                        Review recent events across the platform. Filter by log type, enable live updates, or export the feed.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void loadLogs({ cursor: null })}
                        className="px-3 py-2 bg-white border border-brand-border rounded-lg text-sm font-semibold hover:bg-gray-100"
                    >
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => handleExport('json')}
                        className="px-3 py-2 bg-brand-primary text-brand-dark rounded-lg text-sm font-semibold hover:bg-brand-primary/90"
                    >
                        Export JSON
                    </button>
                    <button
                        type="button"
                        onClick={() => handleExport('csv')}
                        className="px-3 py-2 bg-brand-dark text-white rounded-lg text-sm font-semibold hover:bg-brand-dark/90"
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="bg-white border border-brand-border rounded-xl shadow-sm p-4 mb-6">
                <div className="flex flex-wrap gap-4 items-center">
                    <label className="text-sm font-semibold text-brand-text-light">
                        Type
                        <select
                            className="ml-2 border border-brand-border rounded-md px-2 py-1 text-sm"
                            value={selectedCategory}
                            onChange={event => setSelectedCategory(event.target.value as CategoryFilter)}
                        >
                            {CATEGORY_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-brand-text-light">
                        <input
                            type="checkbox"
                            className="rounded"
                            checked={autoRefresh}
                            onChange={event => setAutoRefresh(event.target.checked)}
                            disabled={isOffline}
                        />
                        Auto-refresh
                        {isOffline && <span className="text-xs text-red-500">Unavailable while offline</span>}
                    </label>
                    {isLoading && <span className="text-sm text-brand-text-light">Loading logs…</span>}
                    {error && <span className="text-sm text-red-500">{error}</span>}
                </div>
            </div>

            <div className="bg-white border border-brand-border rounded-xl shadow overflow-hidden">
                {entries.length === 0 ? (
                    <div className="p-6 text-center text-brand-text-light">No log entries available.</div>
                ) : (
                    <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
                        <table className="min-w-full text-sm">
                            <thead className="bg-brand-surface text-left text-xs font-semibold uppercase text-brand-text-light tracking-wide">
                                <tr>
                                    <th className="px-4 py-3">Timestamp</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Level</th>
                                    <th className="px-4 py-3">Message</th>
                                    <th className="px-4 py-3">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border text-brand-text">
                                {entries.map(entry => (
                                    <tr key={entry.sequence} className="hover:bg-brand-surface/60">
                                        <td className="px-4 py-3 align-top whitespace-nowrap text-xs text-brand-text-light">
                                            {formatTimestamp(entry.timestamp)}
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-brand-primary/10 text-brand-dark rounded-full uppercase tracking-wide">
                                                {entry.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${LEVEL_STYLES[entry.level] || 'bg-gray-100 text-brand-dark'}`}>
                                                {entry.level.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 align-top text-sm text-brand-dark max-w-xs break-words">
                                            {entry.message || '(no message)'}
                                        </td>
                                        <td className="px-4 py-3 align-top text-xs text-brand-text-light">
                                            <pre className="whitespace-pre-wrap break-words">{serializeDetails(entry.details)}</pre>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LogViewer;
