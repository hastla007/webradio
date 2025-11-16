import React, { useState, useEffect } from 'react';
import { fetchListeningTrends } from '../api';
import { useToast } from './ToastProvider';
import { ArrowTrendingUpIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const ListeningTrends: React.FC = () => {
    const [trendsData, setTrendsData] = useState<any>(null);
    const [period, setPeriod] = useState('daily');
    const [days, setDays] = useState(30);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        loadTrends();
    }, [period, days]);

    const loadTrends = async () => {
        try {
            setIsLoading(true);
            const data = await fetchListeningTrends(period, days);
            setTrendsData(data);
        } catch (error) {
            addToast('Failed to load listening trends', 'error');
            console.error('Error loading trends:', error);
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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 dark:text-gray-400">Loading trends...</div>
            </div>
        );
    }

    if (!trendsData) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No trends data available.</p>
            </div>
        );
    }

    const { trends, topStations, eventBreakdown } = trendsData;

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                    <ArrowTrendingUpIcon className="w-6 h-6 mr-2" />
                    Listening Trends
                </h2>
                <div className="flex items-center space-x-4">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                        <option value="hourly">Hourly</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                    </select>
                    <select
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                        <option value={7}>Last 7 Days</option>
                        <option value={30}>Last 30 Days</option>
                        <option value={90}>Last 90 Days</option>
                    </select>
                </div>
            </div>

            {/* Trend Chart Placeholder */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Listening Activity Over Time
                </h3>
                {trends && trends.length > 0 ? (
                    <div className="space-y-4">
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <p>Trend chart visualization will be displayed here</p>
                            <p className="text-xs mt-2">{trends.length} data points available</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            {trends.slice(0, 5).map((trend: any, index: number) => (
                                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(trend.time_bucket).toLocaleDateString()}
                                    </p>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                                        {formatNumber(trend.total_plays || 0)} plays
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {formatNumber(trend.total_listeners || 0)} listeners
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        No trend data available for the selected period
                    </div>
                )}
            </div>

            {/* Top Performing Stations */}
            {topStations && topStations.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                            <ChartBarIcon className="w-5 h-5 mr-2" />
                            Top Stations (Last {days} Days)
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Rank
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Station
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Plays
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Listeners
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {topStations.map((station: any, index: number) => (
                                    <tr key={station.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                                index === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                index === 1 ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                                                index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                                'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>
                                                {index + 1}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {station.logo_url && (
                                                    <img
                                                        src={station.logo_url}
                                                        alt={station.name}
                                                        className="w-10 h-10 rounded-full mr-3"
                                                    />
                                                )}
                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {station.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatNumber(station.plays || 0)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatNumber(station.listeners || 0)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Event Breakdown */}
            {eventBreakdown && eventBreakdown.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Event Breakdown
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {eventBreakdown.map((event: any, index: number) => (
                            <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                                    {event.event_type.replace('_', ' ')}
                                </p>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                                    {formatNumber(event.count || 0)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
                    <p className="text-sm opacity-90">Total Plays</p>
                    <p className="text-3xl font-bold mt-2">
                        {trends ? formatNumber(trends.reduce((sum: number, t: any) => sum + (parseInt(t.total_plays) || 0), 0)) : 0}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
                    <p className="text-sm opacity-90">Total Listeners</p>
                    <p className="text-3xl font-bold mt-2">
                        {trends ? formatNumber(trends.reduce((sum: number, t: any) => sum + (parseInt(t.total_listeners) || 0), 0)) : 0}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
                    <p className="text-sm opacity-90">Avg Quality Score</p>
                    <p className="text-3xl font-bold mt-2">
                        {trends && trends.length > 0
                            ? (trends.reduce((sum: number, t: any) => sum + (parseFloat(t.avg_quality) || 0), 0) / trends.length).toFixed(1)
                            : '0'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ListeningTrends;
