import React, { useState, useEffect } from 'react';
import { fetchAnalyticsDashboard, fetchListeningTrends, fetchGeographicDistribution, fetchExportReports } from '../api';
import StationAnalytics from './StationAnalytics';
import ListeningTrends from './ListeningTrends';
import ExportReports from './ExportReports';
import { useToast } from './ToastProvider';
import {
    ChartBarIcon,
    GlobeAltIcon,
    DocumentChartBarIcon,
    ArrowTrendingUpIcon,
    UsersIcon,
    ClockIcon,
    SignalIcon,
    HeartIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
    total_stations: number;
    total_plays: number;
    total_favorites: number;
    total_listening_minutes: number;
    total_unique_listeners: number;
    avg_uptime_percentage: number;
    avg_quality_score: number;
}

interface TopStation {
    id: number;
    name: string;
    logo_url: string;
    plays: number;
    favorites: number;
    uptime_percentage: number;
}

interface RecentActivity {
    id: number;
    station_id: number;
    station_name: string;
    event_type: string;
    country_code: string;
    device_type: string;
    created_at: string;
}

interface GeoDistribution {
    country_code: string;
    country_name: string;
    play_count: number;
    unique_listeners: number;
}

interface DashboardData {
    stats: DashboardStats;
    topStations: TopStation[];
    recentActivity: RecentActivity[];
    geoDistribution: GeoDistribution[];
}

type TabView = 'overview' | 'trends' | 'geographic' | 'exports' | 'station';

const AnalyticsDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabView>('overview');
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setIsLoading(true);
            const data = await fetchAnalyticsDashboard();
            setDashboardData(data);
        } catch (error) {
            addToast('Failed to load analytics dashboard', 'error');
            console.error('Error loading dashboard:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    };

    const formatDuration = (minutes: number): string => {
        if (minutes < 60) {
            return `${Math.round(minutes)}m`;
        }
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return `${hours}h`;
        }
        const days = Math.floor(hours / 24);
        return `${days}d`;
    };

    const renderStatCard = (
        title: string,
        value: string | number,
        icon: React.ReactNode,
        subtitle?: string,
        trend?: string
    ) => (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
                    {subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
                    )}
                    {trend && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {trend}
                        </p>
                    )}
                </div>
                <div className="flex-shrink-0 ml-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        {icon}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderOverview = () => {
        if (!dashboardData) return null;

        const { stats, topStations, recentActivity, geoDistribution } = dashboardData;

        return (
            <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {renderStatCard(
                        'Total Plays',
                        formatNumber(parseInt(stats.total_plays)),
                        <ChartBarIcon className="w-6 h-6 text-blue-600" />,
                        'All time'
                    )}
                    {renderStatCard(
                        'Unique Listeners',
                        formatNumber(parseInt(stats.total_unique_listeners)),
                        <UsersIcon className="w-6 h-6 text-purple-600" />,
                        'Across all stations'
                    )}
                    {renderStatCard(
                        'Total Listening Time',
                        formatDuration(parseInt(stats.total_listening_minutes)),
                        <ClockIcon className="w-6 h-6 text-green-600" />,
                        `${formatNumber(parseInt(stats.total_listening_minutes))} minutes`
                    )}
                    {renderStatCard(
                        'Favorites',
                        formatNumber(parseInt(stats.total_favorites)),
                        <HeartIcon className="w-6 h-6 text-red-600" />,
                        'Total favorites'
                    )}
                </div>

                {/* Performance Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderStatCard(
                        'Average Uptime',
                        `${parseFloat(stats.avg_uptime_percentage).toFixed(1)}%`,
                        <SignalIcon className="w-6 h-6 text-green-600" />,
                        'Across all stations'
                    )}
                    {renderStatCard(
                        'Average Quality Score',
                        parseFloat(stats.avg_quality_score).toFixed(1),
                        <ArrowTrendingUpIcon className="w-6 h-6 text-blue-600" />,
                        'Out of 100'
                    )}
                </div>

                {/* Top Stations */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Top Performing Stations
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Station
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Plays
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Favorites
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Uptime
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {topStations.map((station) => (
                                    <tr key={station.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                {station.logo_url && (
                                                    <img
                                                        src={station.logo_url}
                                                        alt={station.name}
                                                        className="w-10 h-10 rounded-full mr-3"
                                                    />
                                                )}
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {station.name}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatNumber(parseInt(station.plays))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatNumber(parseInt(station.favorites))}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                parseFloat(station.uptime_percentage) >= 99
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    : parseFloat(station.uptime_percentage) >= 95
                                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            }`}>
                                                {parseFloat(station.uptime_percentage).toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <button
                                                onClick={() => {
                                                    setSelectedStationId(station.id);
                                                    setActiveTab('station');
                                                }}
                                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Activity and Geographic Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Activity */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Recent Activity
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                {recentActivity.slice(0, 10).map((event) => (
                                    <div key={event.id} className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {event.station_name}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {event.event_type} • {event.device_type || 'Unknown device'} • {event.country_code || 'Unknown'}
                                            </p>
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {new Date(event.created_at).toLocaleTimeString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Geographic Distribution */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Top Countries
                            </h2>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4">
                                {geoDistribution.slice(0, 10).map((geo) => (
                                    <div key={geo.country_code} className="flex items-center justify-between">
                                        <div className="flex items-center flex-1">
                                            <span className="text-2xl mr-3">{geo.country_code}</span>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {geo.country_name || geo.country_code}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    {formatNumber(parseInt(geo.unique_listeners))} listeners
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {formatNumber(parseInt(geo.play_count))} plays
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 dark:text-gray-400">Loading analytics...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
                <button
                    onClick={loadDashboardData}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Refresh
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'overview' as TabView, label: 'Overview', icon: ChartBarIcon },
                        { id: 'trends' as TabView, label: 'Listening Trends', icon: ArrowTrendingUpIcon },
                        { id: 'geographic' as TabView, label: 'Geographic', icon: GlobeAltIcon },
                        { id: 'exports' as TabView, label: 'Export Reports', icon: DocumentChartBarIcon },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center py-4 px-1 border-b-2 font-medium text-sm
                                ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }
                            `}
                        >
                            <tab.icon className="w-5 h-5 mr-2" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'trends' && <ListeningTrends />}
                {activeTab === 'geographic' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Geographic Distribution
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400">
                            Detailed geographic analysis will be displayed here.
                        </p>
                    </div>
                )}
                {activeTab === 'exports' && <ExportReports />}
                {activeTab === 'station' && selectedStationId && (
                    <StationAnalytics
                        stationId={selectedStationId}
                        onBack={() => setActiveTab('overview')}
                    />
                )}
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
