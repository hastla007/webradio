import React, { useState, useEffect } from 'react';
import { fetchExportReports, exportAnalytics } from '../api';
import { useToast } from './ToastProvider';
import {
    DocumentChartBarIcon,
    ArrowDownTrayIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

const ExportReports: React.FC = () => {
    const [reportsData, setReportsData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        try {
            setIsLoading(true);
            const data = await fetchExportReports();
            setReportsData(data);
        } catch (error) {
            addToast('Failed to load export reports', 'error');
            console.error('Error loading export reports:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async (format: 'csv' | 'json') => {
        try {
            setIsExporting(true);
            const data = await exportAnalytics(format);

            if (format === 'csv') {
                // CSV will be downloaded automatically via browser
                addToast('Analytics exported successfully', 'success');
            } else {
                // For JSON, create a download
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                addToast('Analytics exported successfully', 'success');
            }
        } catch (error) {
            addToast('Failed to export analytics', 'error');
            console.error('Error exporting analytics:', error);
        } finally {
            setIsExporting(false);
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
                <div className="text-gray-500 dark:text-gray-400">Loading export reports...</div>
            </div>
        );
    }

    if (!reportsData) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No export reports available.</p>
            </div>
        );
    }

    const { summary, profiles, recentExports } = reportsData;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                    <DocumentChartBarIcon className="w-6 h-6 mr-2" />
                    Export Analytics
                </h2>
                <div className="flex space-x-2">
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={isExporting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => handleExport('json')}
                        disabled={isExporting}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                        Export JSON
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Profiles</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {formatNumber(summary.total_profiles || 0)}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Exports</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {formatNumber(summary.total_exports || 0)}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Successful</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                        {formatNumber(summary.successful_exports || 0)}
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                        {formatNumber(summary.failed_exports || 0)}
                    </p>
                </div>
            </div>

            {/* Export Profile Performance */}
            {profiles && profiles.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Export Profile Performance
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Profile
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Format
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Total Exports
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Success Rate
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Avg Duration
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Last Export
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {profiles.map((profile: any) => (
                                    <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {profile.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                                {profile.format}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {formatNumber(profile.total_exports || 0)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                                                    <div
                                                        className="bg-green-500 h-2 rounded-full"
                                                        style={{ width: `${profile.success_rate || 0}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    {parseFloat(profile.success_rate || 0).toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {parseFloat(profile.avg_duration || 0).toFixed(1)}s
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {profile.last_export_at
                                                ? new Date(profile.last_export_at).toLocaleDateString()
                                                : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {profile.last_export_status === 'success' ? (
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                    <CheckCircleIcon className="w-4 h-4 mr-1" />
                                                    Success
                                                </span>
                                            ) : profile.last_export_status === 'failed' ? (
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                                    <XCircleIcon className="w-4 h-4 mr-1" />
                                                    Failed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                                    <ClockIcon className="w-4 h-4 mr-1" />
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Recent Export Activity */}
            {recentExports && recentExports.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Recent Export Activity
                        </h3>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            {recentExports.map((exp: any, index: number) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                                >
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {exp.profile_name}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            {exp.total_stations_exported || 0} stations exported
                                        </p>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {new Date(exp.last_export_at).toLocaleString()}
                                            </p>
                                        </div>
                                        {exp.last_export_status === 'success' ? (
                                            <CheckCircleIcon className="w-6 h-6 text-green-500" />
                                        ) : (
                                            <XCircleIcon className="w-6 h-6 text-red-500" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Export Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
                    <h4 className="text-sm font-medium opacity-90">Success Rate</h4>
                    <p className="text-3xl font-bold mt-2">
                        {summary.total_exports > 0
                            ? ((parseInt(summary.successful_exports) / parseInt(summary.total_exports)) * 100).toFixed(1)
                            : 0}%
                    </p>
                    <p className="text-sm opacity-75 mt-1">
                        {formatNumber(summary.successful_exports)} of {formatNumber(summary.total_exports)} exports
                    </p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow p-6 text-white">
                    <h4 className="text-sm font-medium opacity-90">Average Duration</h4>
                    <p className="text-3xl font-bold mt-2">
                        {parseFloat(summary.avg_duration || 0).toFixed(1)}s
                    </p>
                    <p className="text-sm opacity-75 mt-1">Per export operation</p>
                </div>
            </div>
        </div>
    );
};

export default ExportReports;
