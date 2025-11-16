import React, { useState, useEffect } from 'react';
import { fetchStationAnalytics } from '../api';
import { useToast } from './ToastProvider';
import {
    ArrowLeftIcon,
    ChartBarIcon,
    ClockIcon,
    UsersIcon,
    HeartIcon,
    SignalIcon,
    GlobeAltIcon
} from '@heroicons/react/24/outline';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

interface StationAnalyticsProps {
    stationId: number;
    onBack: () => void;
}

const StationAnalytics: React.FC<StationAnalyticsProps> = ({ stationId, onBack }) => {
    const [analytics, setAnalytics] = useState<any>(null);
    const [period, setPeriod] = useState('all_time');
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        loadAnalytics();
    }, [stationId, period]);

    const loadAnalytics = async () => {
        try {
            setIsLoading(true);
            const data = await fetchStationAnalytics(stationId, period);
            setAnalytics(data);
        } catch (error) {
            addToast('Failed to load station analytics', 'error');
            console.error('Error loading station analytics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatNumber = (num: number | string): string => {
        const n = typeof num === 'string' ? parseInt(num) : num;
        if (n >= 1000000) {
            return (n / 1000000).toFixed(1) + 'M';
        } else if (n >= 1000) {
            return (n / 1000).toFixed(1) + 'K';
        }
        return n.toString();
    };

    const formatDuration = (minutes: number | string): string => {
        const m = typeof minutes === 'string' ? parseInt(minutes) : minutes;
        if (m < 60) {
            return `${Math.round(m)}m`;
        }
        const hours = Math.floor(m / 60);
        if (hours < 24) {
            return `${hours}h ${m % 60}m`;
        }
        const days = Math.floor(hours / 24);
        return `${days}d ${hours % 24}h`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 dark:text-gray-400">Loading station analytics...</div>
            </div>
        );
    }

    if (!analytics || !analytics.analytics) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No analytics data available for this station.</p>
                <button
                    onClick={onBack}
                    className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const { analytics: stats, trends, geoStats, recentEvents } = analytics;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                        <ArrowLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <div className="flex items-center space-x-3">
                        {stats.logo_url && (
                            <img src={stats.logo_url} alt={stats.name} className="w-12 h-12 rounded-full" />
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.name}</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Station Analytics</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                        <option value="all_time">All Time</option>
                        <option value="daily">Today</option>
                        <option value="weekly">This Week</option>
                        <option value="monthly">This Month</option>
                    </select>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Plays</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                {formatNumber(stats.total_plays || 0)}
                            </p>
                        </div>
                        <ChartBarIcon className="w-10 h-10 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unique Listeners</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                {formatNumber(stats.unique_listeners || 0)}
                            </p>
                        </div>
                        <UsersIcon className="w-10 h-10 text-purple-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Favorites</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                {formatNumber(stats.total_favorites || 0)}
                            </p>
                        </div>
                        <HeartIcon className="w-10 h-10 text-red-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Listening Time</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                {formatDuration(stats.total_listening_minutes || 0)}
                            </p>
                        </div>
                        <ClockIcon className="w-10 h-10 text-green-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Uptime</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                {parseFloat(stats.uptime_percentage || 100).toFixed(1)}%
                            </p>
                        </div>
                        <SignalIcon className="w-10 h-10 text-green-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Session</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                {formatDuration(stats.avg_session_duration_minutes || 0)}
                            </p>
                        </div>
                        <ClockIcon className="w-10 h-10 text-orange-500" />
                    </div>
                </div>
            </div>

            {/* Geographic Distribution */}
            {geoStats && geoStats.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                            <GlobeAltIcon className="w-5 h-5 mr-2" />
                            Geographic Distribution
                        </h2>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            {geoStats.slice(0, 10).map((geo: any, index: number) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center flex-1">
                                        <span className="text-2xl mr-3">{geo.country_code}</span>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {geo.country_name || geo.country_code}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {geo.region || 'All regions'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {formatNumber(geo.play_count)} plays
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {formatNumber(geo.unique_listeners)} listeners
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Events */}
            {recentEvents && recentEvents.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Recent Activity
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Event Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Duration
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Location
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Device
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Time
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {recentEvents.map((event: any, index: number) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                event.event_type === 'play_start' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                event.event_type === 'favorite' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                            }`}>
                                                {event.event_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {event.duration_minutes ? formatDuration(event.duration_minutes) : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {event.country_code || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {event.device_type || 'Unknown'} / {event.platform || 'Unknown'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(event.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Trends Chart */}
            {trends && trends.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Listening Trends (Last 7 Days)
                    </h2>
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart
                            data={trends.map((trend: any) => ({
                                date: new Date(trend.time_bucket).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric'
                                }),
                                plays: parseInt(trend.play_count) || 0,
                                listeners: parseInt(trend.unique_listeners) || 0,
                                quality: parseFloat(trend.avg_quality) || 0,
                            }))}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                            <XAxis
                                dataKey="date"
                                className="text-xs text-gray-500 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                            />
                            <YAxis
                                className="text-xs text-gray-500 dark:text-gray-400"
                                tick={{ fill: 'currentColor' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    color: '#fff'
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="plays"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                name="Plays"
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="listeners"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                name="Listeners"
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default StationAnalytics;
