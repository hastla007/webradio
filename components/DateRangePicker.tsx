import React, { useState } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DateRange {
    startDate: Date;
    endDate: Date;
}

interface DateRangePickerProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
    presets?: boolean;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
    value,
    onChange,
    presets = true
}) => {
    const [showCustom, setShowCustom] = useState(false);
    const [customStart, setCustomStart] = useState(
        format(value.startDate, 'yyyy-MM-dd')
    );
    const [customEnd, setCustomEnd] = useState(
        format(value.endDate, 'yyyy-MM-dd')
    );

    const presetRanges = [
        {
            label: 'Last 7 Days',
            getValue: () => ({
                startDate: startOfDay(subDays(new Date(), 7)),
                endDate: endOfDay(new Date())
            })
        },
        {
            label: 'Last 30 Days',
            getValue: () => ({
                startDate: startOfDay(subDays(new Date(), 30)),
                endDate: endOfDay(new Date())
            })
        },
        {
            label: 'Last 90 Days',
            getValue: () => ({
                startDate: startOfDay(subDays(new Date(), 90)),
                endDate: endOfDay(new Date())
            })
        },
        {
            label: 'This Month',
            getValue: () => {
                const now = new Date();
                return {
                    startDate: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
                    endDate: endOfDay(new Date())
                };
            }
        },
        {
            label: 'Last Month',
            getValue: () => {
                const now = new Date();
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                return {
                    startDate: startOfDay(lastMonth),
                    endDate: endOfDay(lastMonthEnd)
                };
            }
        }
    ];

    const handlePresetClick = (preset: typeof presetRanges[0]) => {
        onChange(preset.getValue());
        setShowCustom(false);
    };

    const handleCustomApply = () => {
        const start = new Date(customStart);
        const end = new Date(customEnd);

        if (start <= end) {
            onChange({
                startDate: startOfDay(start),
                endDate: endOfDay(end)
            });
            setShowCustom(false);
        }
    };

    const isPresetActive = (preset: typeof presetRanges[0]) => {
        const range = preset.getValue();
        return (
            format(value.startDate, 'yyyy-MM-dd') === format(range.startDate, 'yyyy-MM-dd') &&
            format(value.endDate, 'yyyy-MM-dd') === format(range.endDate, 'yyyy-MM-dd')
        );
    };

    return (
        <div className="relative inline-block">
            <div className="flex items-center space-x-2">
                {presets && (
                    <div className="flex flex-wrap gap-2">
                        {presetRanges.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handlePresetClick(preset)}
                                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                                    isPresetActive(preset)
                                        ? 'bg-blue-500 text-white border-blue-500'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowCustom(!showCustom)}
                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors flex items-center ${
                                showCustom
                                    ? 'bg-blue-500 text-white border-blue-500'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                        >
                            <CalendarIcon className="w-4 h-4 mr-1" />
                            Custom Range
                        </button>
                    </div>
                )}
            </div>

            {showCustom && (
                <div className="absolute top-full mt-2 right-0 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-4 min-w-[300px]">
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                max={format(new Date(), 'yyyy-MM-dd')}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                            <button
                                onClick={() => setShowCustom(false)}
                                className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCustomApply}
                                className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
