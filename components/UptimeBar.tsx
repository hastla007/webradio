import React from 'react';

export interface UptimeBarProps {
    history?: number[];
    barCount?: number;
    className?: string;
}

const baseClasses = 'flex items-end gap-px';

const combineClasses = (...classes: Array<string | undefined>) =>
    classes.filter(Boolean).join(' ').trim();

const resolveColor = (value: number) => {
    if (value === 1) {
        return 'bg-green-500';
    }
    if (value === 0) {
        return 'bg-red-500';
    }
    return 'bg-gray-200 dark:bg-gray-600';
};

const UptimeBar: React.FC<UptimeBarProps> = ({ history = [], barCount = 60, className }) => {
    const values = [...history].reverse().slice(0, barCount);

    while (values.length < barCount) {
        values.push(-1);
    }

    const width = `${100 / barCount}%`;

    return (
        <div className={combineClasses(baseClasses, className)} aria-hidden>
            {values.map((value, index) => (
                <span
                    key={index}
                    className={combineClasses('block rounded-sm transition-colors duration-200 ease-out', resolveColor(value))}
                    style={{ width, height: '100%' }}
                />
            ))}
        </div>
    );
};

export default UptimeBar;
