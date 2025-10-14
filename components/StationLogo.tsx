import React from 'react';
import { getStationLogoUrl } from '../stationLogos';

export interface StationLogoProps {
    name: string;
    logoUrl?: string | null;
    size?: number;
    className?: string;
    shape?: 'rounded' | 'circle';
}

const shapeClassMap = {
    rounded: 'rounded-md',
    circle: 'rounded-full',
} as const;

const StationLogo: React.FC<StationLogoProps> = ({
    name,
    logoUrl,
    size = 40,
    className,
    shape = 'rounded',
}) => {
    const dimension = { width: size, height: size };
    const hasCustomRound = className?.includes('rounded');
    const roundedClass = hasCustomRound ? '' : shapeClassMap[shape] ?? shapeClassMap.rounded;

    return (
        <img
            src={getStationLogoUrl(logoUrl)}
            alt={name}
            loading="lazy"
            className={`object-cover ${roundedClass} ${className ?? ''}`.trim()}
            style={dimension}
        />
    );
};

export default StationLogo;
