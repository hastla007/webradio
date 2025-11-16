import React, { useState } from 'react';
import { DocumentChartBarIcon, FunnelIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import DateRangePicker from './DateRangePicker';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

interface ReportField {
    id: string;
    label: string;
    category: 'station' | 'listening' | 'geographic' | 'device';
    type: 'metric' | 'dimension';
}

const AVAILABLE_FIELDS: ReportField[] = [
    // Station Metrics
    { id: 'station_name', label: 'Station Name', category: 'station', type: 'dimension' },
    { id: 'station_genre', label: 'Genre', category: 'station', type: 'dimension' },
    { id: 'total_plays', label: 'Total Plays', category: 'station', type: 'metric' },
    { id: 'unique_listeners', label: 'Unique Listeners', category: 'station', type: 'metric' },
    { id: 'total_favorites', label: 'Total Favorites', category: 'station', type: 'metric' },
    { id: 'listening_minutes', label: 'Listening Minutes', category: 'station', type: 'metric' },
    { id: 'avg_session_duration', label: 'Avg Session Duration', category: 'station', type: 'metric' },
    { id: 'uptime_percentage', label: 'Uptime %', category: 'station', type: 'metric' },

    // Listening Events
    { id: 'event_type', label: 'Event Type', category: 'listening', type: 'dimension' },
    { id: 'event_count', label: 'Event Count', category: 'listening', type: 'metric' },

    // Geographic
    { id: 'country', label: 'Country', category: 'geographic', type: 'dimension' },
    { id: 'region', label: 'Region', category: 'geographic', type: 'dimension' },
    { id: 'city', label: 'City', category: 'geographic', type: 'dimension' },

    // Device/Platform
    { id: 'device_type', label: 'Device Type', category: 'device', type: 'dimension' },
    { id: 'platform', label: 'Platform', category: 'device', type: 'dimension' },
];

const CustomReportBuilder: React.FC = () => {
    const [selectedFields, setSelectedFields] = useState<string[]>(['station_name', 'total_plays', 'unique_listeners']);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [dateRange, setDateRange] = useState({
        startDate: startOfDay(subDays(new Date(), 30)),
        endDate: endOfDay(new Date())
    });
    const [groupBy, setGroupBy] = useState<string>('station');
    const [reportFormat, setReportFormat] = useState<'table' | 'chart'>('table');

    const toggleField = (fieldId: string) => {
        setSelectedFields(prev =>
            prev.includes(fieldId)
                ? prev.filter(id => id !== fieldId)
                : [...prev, fieldId]
        );
    };

    const filteredFields = AVAILABLE_FIELDS.filter(field =>
        selectedCategory === 'all' || field.category === selectedCategory
    );

    const handleGenerateReport = () => {
        console.log('Generating report with:', {
            fields: selectedFields,
            dateRange,
            groupBy,
            format: reportFormat
        });
        // This would make an API call to generate the custom report
        alert(`Report generation would be triggered here with ${selectedFields.length} fields`);
    };

    const handleExport = (format: 'csv' | 'json' | 'pdf') => {
        console.log(`Exporting report as ${format}`);
        alert(`Export as ${format.toUpperCase()} would be triggered here`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                    <DocumentChartBarIcon className="w-6 h-6 mr-2" />
                    Custom Report Builder
                </h2>
            </div>

            {/* Date Range Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Date Range
                </h3>
                <DateRangePicker value={dateRange} onChange={setDateRange} />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Selected: {format(dateRange.startDate, 'MMM d, yyyy')} - {format(dateRange.endDate, 'MMM d, yyyy')}
                </p>
            </div>

            {/* Field Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                        <FunnelIcon className="w-5 h-5 mr-2" />
                        Select Fields ({selectedFields.length})
                    </h3>
                    <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400">Category:</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        >
                            <option value="all">All Categories</option>
                            <option value="station">Station Metrics</option>
                            <option value="listening">Listening Events</option>
                            <option value="geographic">Geographic</option>
                            <option value="device">Device/Platform</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredFields.map((field) => (
                        <button
                            key={field.id}
                            onClick={() => toggleField(field.id)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                                selectedFields.includes(field.id)
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-medium ${
                                    field.type === 'metric'
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-blue-600 dark:text-blue-400'
                                }`}>
                                    {field.type === 'metric' ? 'Metric' : 'Dimension'}
                                </span>
                                {selectedFields.includes(field.id) && (
                                    <span className="text-blue-500">✓</span>
                                )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {field.label}
                            </p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Report Options */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Report Options
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Group By
                        </label>
                        <select
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                            <option value="station">Station</option>
                            <option value="date">Date</option>
                            <option value="country">Country</option>
                            <option value="device">Device Type</option>
                            <option value="platform">Platform</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Display Format
                        </label>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setReportFormat('table')}
                                className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                                    reportFormat === 'table'
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                }`}
                            >
                                Table
                            </button>
                            <button
                                onClick={() => setReportFormat('chart')}
                                className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                                    reportFormat === 'chart'
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                                }`}
                            >
                                Chart
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex space-x-2">
                    <button
                        onClick={() => handleExport('csv')}
                        className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => handleExport('json')}
                        className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                        Export JSON
                    </button>
                    <button
                        onClick={() => handleExport('pdf')}
                        className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                        Export PDF
                    </button>
                </div>
                <button
                    onClick={handleGenerateReport}
                    disabled={selectedFields.length === 0}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Generate Report
                </button>
            </div>

            {/* Preview Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Report Preview
                </h3>
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p>Click "Generate Report" to see your custom report</p>
                    <p className="text-sm mt-2">
                        Selected {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''}
                        {selectedFields.length > 0 && ': ' + selectedFields.slice(0, 3).join(', ') + (selectedFields.length > 3 ? '...' : '')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CustomReportBuilder;
