'use client';

/**
 * GatedContent Component
 * 
 * Shows "insufficient evidence" states when data gates are not met.
 * Wraps content that should only be shown when gates pass.
 */

import React from 'react';
import { type GateStatus, getConfidenceLabel, getConfidenceColor } from '@/lib/gates/scoringGates';

interface GatedContentProps {
    gateStatus: GateStatus;
    children: React.ReactNode;
    type: 'delivery' | 'conversion' | 'recommendations';
    title?: string;
    className?: string;
}

export function GatedContent({
    gateStatus,
    children,
    type,
    title,
    className = '',
}: GatedContentProps) {
    const isBlocked =
        (type === 'delivery' && !gateStatus.canScoreDelivery) ||
        (type === 'conversion' && !gateStatus.canScoreConversion) ||
        (type === 'recommendations' && !gateStatus.canShowRecommendations);

    if (isBlocked) {
        return (
            <div className={`bg-gray-800/50 border border-gray-700 rounded-lg p-6 ${className}`}>
                <div className="text-center">
                    {/* Icon */}
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-700/50 flex items-center justify-center">
                        <ClockIcon className="w-6 h-6 text-gray-400" />
                    </div>

                    {/* Title */}
                    <p className="font-medium text-gray-300 mb-2">
                        {title || getDefaultTitle(type)}
                    </p>

                    {/* Messages */}
                    <ul className="text-sm text-gray-500 space-y-1.5">
                        {gateStatus.gateMessages.map((msg, i) => (
                            <li key={i} className="flex items-start gap-2 justify-center">
                                <span className="text-gray-600">•</span>
                                <span>{msg}</span>
                            </li>
                        ))}
                    </ul>

                    {/* Progress indicators */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <GateProgressIndicators gateStatus={gateStatus} type={type} />
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

// ==================== PROGRESS INDICATORS ====================

interface GateProgressIndicatorsProps {
    gateStatus: GateStatus;
    type: 'delivery' | 'conversion' | 'recommendations';
}

function GateProgressIndicators({ gateStatus, type }: GateProgressIndicatorsProps) {
    const { gates } = gateStatus;

    if (type === 'delivery') {
        return (
            <div className="flex items-center justify-center gap-4 text-xs">
                <GateIndicator
                    label="Age"
                    passed={gates.age.passed}
                    detail={gates.age.hoursRemaining ? `${gates.age.hoursRemaining}h left` : 'Ready'}
                />
                <GateIndicator
                    label="Impressions"
                    passed={gates.impressions.level !== 'low'}
                    detail={`${gates.impressions.current.toLocaleString()}`}
                />
            </div>
        );
    }

    if (type === 'conversion') {
        return (
            <div className="flex items-center justify-center gap-4 text-xs">
                <GateIndicator
                    label="Conversions"
                    passed={gates.conversions.level !== 'insufficient'}
                    detail={`${gates.conversions.current} / ${gates.conversions.nextThreshold || 10}`}
                />
                {gates.iosTraffic.penalized && (
                    <GateIndicator
                        label="iOS Traffic"
                        passed={false}
                        detail={`${((gates.iosTraffic.percent || 0) * 100).toFixed(0)}%`}
                    />
                )}
                {gates.attributionMismatch.blocked && (
                    <GateIndicator
                        label="Attribution"
                        passed={false}
                        detail="Mismatch"
                    />
                )}
            </div>
        );
    }

    // Recommendations
    return (
        <div className="flex items-center justify-center gap-4 text-xs">
            <GateIndicator
                label="Age"
                passed={gates.age.passed}
                detail={gates.age.hoursRemaining ? `${gates.age.hoursRemaining}h` : '✓'}
            />
            <GateIndicator
                label="Spend"
                passed={gates.spend.passed}
                detail={gates.spend.passed ? '✓' : `₱${gates.spend.amountRemaining?.toFixed(0)}`}
            />
        </div>
    );
}

interface GateIndicatorProps {
    label: string;
    passed: boolean;
    detail: string;
}

function GateIndicator({ label, passed, detail }: GateIndicatorProps) {
    return (
        <div className={`px-3 py-1.5 rounded ${passed ? 'bg-green-500/10' : 'bg-gray-700/50'}`}>
            <div className={`font-medium ${passed ? 'text-green-400' : 'text-gray-400'}`}>
                {label}
            </div>
            <div className="text-gray-500">{detail}</div>
        </div>
    );
}

// ==================== HELPERS ====================

function getDefaultTitle(type: 'delivery' | 'conversion' | 'recommendations'): string {
    switch (type) {
        case 'delivery':
            return 'Gathering Delivery Data';
        case 'conversion':
            return 'Waiting for Conversions';
        case 'recommendations':
            return 'Building Recommendations';
    }
}

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
    );
}

// ==================== CONFIDENCE BADGE ====================

interface ConfidenceBadgeProps {
    level: 'high' | 'medium' | 'low' | 'insufficient' | 'none';
    showLabel?: boolean;
}

export function ConfidenceBadge({ level, showLabel = true }: ConfidenceBadgeProps) {
    const color = getConfidenceColor(level);
    const label = getConfidenceLabel(level);

    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
            style={{
                backgroundColor: `${color}20`,
                color: color,
            }}
        >
            <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
            />
            {showLabel && <span>{label}</span>}
        </span>
    );
}
