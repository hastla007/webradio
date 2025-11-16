import React, { useState, useEffect } from 'react';
import { fetchGeographicDistribution } from '../api';
import { useToast } from './ToastProvider';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

const GeographicDistribution: React.FC = () => {
    const [geoData, setGeoData] = useState<any>(null);
    const [period, setPeriod] = useState('all_time');
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        loadGeoData();
    }, [period]);

    const loadGeoData = async () => {
        try {
            setIsLoading(true);
            const data = await fetchGeographicDistribution(undefined, period);
            setGeoData(data);
        } catch (error) {
            addToast('Failed to load geographic distribution', 'error');
            console.error('Error loading geographic data:', error);
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

    const COLORS = [
        '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
        '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 dark:text-gray-400">Loading geographic data...</div>
            </div>
        );
    }

    if (!geoData || !geoData.distribution || geoData.distribution.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No geographic data available.</p>
            </div>
        );
    }

    const { distribution, summary } = geoData;
    const topCountries = distribution.slice(0, 10);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                    <GlobeAltIcon className="w-6 h-6 mr-2" />
                    Geographic Distribution
                </h2>
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

            {/* Summary Statistics */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
                        <p className="text-sm opacity-90">Total Countries</p>
                        <p className="text-3xl font-bold mt-2">
                            {summary.total_countries || distribution.length}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
                        <p className="text-sm opacity-90">Total Plays</p>
                        <p className="text-3xl font-bold mt-2">
                            {formatNumber(summary.total_plays || 0)}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow p-6 text-white">
                        <p className="text-sm opacity-90">Total Listeners</p>
                        <p className="text-3xl font-bold mt-2">
                            {formatNumber(summary.total_listeners || 0)}
                        </p>
                    </div>
                </div>
            )}

            {/* Bar Chart - Top Countries by Plays */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Top Countries by Plays
                </h3>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={topCountries.map((geo: any) => ({
                            country: geo.country_name || geo.country_code,
                            plays: parseInt(geo.play_count) || 0,
                            listeners: parseInt(geo.unique_listeners) || 0,
                        }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis
                            dataKey="country"
                            angle={-45}
                            textAnchor="end"
                            height={80}
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
                        <Bar dataKey="plays" fill="#3b82f6" name="Plays" />
                        <Bar dataKey="listeners" fill="#8b5cf6" name="Listeners" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Pie Chart - Distribution Percentage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Play Distribution by Country
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={topCountries.map((geo: any) => ({
                                    name: geo.country_name || geo.country_code,
                                    value: parseInt(geo.play_count) || 0,
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(entry) => `${entry.name}: ${formatNumber(entry.value)}`}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {topCountries.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    color: '#fff'
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Detailed Table */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Top Regions
                        </h3>
                    </div>
                    <div className="overflow-y-auto max-h-[300px]">
                        <div className="p-6 space-y-3">
                            {topCountries.map((geo: any, index: number) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
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
                                            {formatNumber(geo.play_count)}
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
            </div>

            {/* Full Country List */}
            {distribution.length > 10 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            All Countries ({distribution.length})
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Country
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Region
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Plays
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Listeners
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Listening Time
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {distribution.map((geo: any, index: number) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {geo.country_name || geo.country_code}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {geo.region || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatNumber(geo.play_count)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatNumber(geo.unique_listeners)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatNumber(geo.total_listening_minutes || 0)} min
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GeographicDistribution;
