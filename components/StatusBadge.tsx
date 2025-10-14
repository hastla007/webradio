import React from 'react';

export type StatusVariant =
    | 'online'
    | 'offline'
    | 'unknown'
    | 'active'
    | 'inactive'
    | 'success'
    | 'error'
    | 'info'
    | 'warning';

type SizeVariant = 'sm' | 'md' | 'lg';

export interface StatusBadgeProps {
    status: StatusVariant;
    label?: string;
    size?: SizeVariant;
    className?: string;
}

const STATUS_STYLES: Record<StatusVariant, string> = {
    online: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    offline: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    unknown: 'bg-gray-200 text-gray-800 dark:bg-gray-700/60 dark:text-gray-200',
    active: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    inactive: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
};

const SIZE_STYLES: Record<SizeVariant, string> = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
};

const combineClasses = (...classes: Array<string | undefined>) =>
    classes.filter(Boolean).join(' ').trim();

const toLabel = (status: StatusVariant) => {
    switch (status) {
        case 'online':
            return 'Online';
        case 'offline':
            return 'Offline';
        case 'unknown':
            return 'Unknown';
        case 'active':
            return 'Active';
        case 'inactive':
            return 'Inactive';
        case 'success':
            return 'Success';
        case 'error':
            return 'Error';
        case 'info':
            return 'Info';
        case 'warning':
            return 'Warning';
        default:
            return status;
    }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm', className }) => {
    const normalized = STATUS_STYLES[status] ? status : 'unknown';
    const text = label ?? toLabel(normalized);

    return (
        <span
            className={combineClasses(
                'inline-flex items-center justify-center font-semibold rounded-full capitalize transition-colors duration-150',
                STATUS_STYLES[normalized],
                SIZE_STYLES[size],
                className,
            )}
        >
            {text}
        </span>
    );
};

export default StatusBadge;
