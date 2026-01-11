'use client';

import React, { useState } from 'react';

/**
 * Cross-Account Warning Component
 * 
 * GAP 2: Prevent mental comparison of scores across accounts.
 * Shows warning icon with tooltip on all relative/efficiency scores.
 */

interface RelativeScoreWarningProps {
    compact?: boolean;  // Icon only for inline use
}

const WARNING_COPY = {
    short: "Account-specific score",
    tooltip: "This score is relative to YOUR account's baseline only. It cannot be compared to other accounts, industries, or benchmarks. A '75' in your account means something completely different than a '75' in another account.",
    inline: "⚠️ Relative to your baseline only"
};

export function RelativeScoreWarning({ compact = false }: RelativeScoreWarningProps) {
    const [showTooltip, setShowTooltip] = useState(false);

    if (compact) {
        return (
            <span
                className="relative cursor-help"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <span className="text-amber-500">⚠️</span>
                {showTooltip && (
                    <div className="absolute z-50 w-72 p-3 -left-32 top-6 
                                    bg-[var(--glass-bg)] border border-[var(--border-subtle)]
                                    rounded-lg shadow-xl text-sm text-[var(--text-secondary)]">
                        {WARNING_COPY.tooltip}
                    </div>
                )}
            </span>
        );
    }

    return (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <span>⚠️</span>
            <span>{WARNING_COPY.inline}</span>
            <span
                className="relative cursor-help"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
            >
                <span className="text-[var(--text-muted)]">[?]</span>
                {showTooltip && (
                    <div className="absolute z-50 w-72 p-3 left-0 top-6 
                                    bg-[var(--glass-bg)] border border-[var(--border-subtle)]
                                    rounded-lg shadow-xl">
                        {WARNING_COPY.tooltip}
                    </div>
                )}
            </span>
        </div>
    );
}

/**
 * Efficiency Score Display with mandatory warning.
 */
interface EfficiencyScoreProps {
    score: number;
    label?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function EfficiencyScore({ score, label = 'Efficiency', size = 'md' }: EfficiencyScoreProps) {
    const sizeClasses = {
        sm: 'text-xl',
        md: 'text-3xl',
        lg: 'text-5xl'
    };

    const getScoreColor = (s: number) => {
        if (s >= 70) return 'text-green-400';
        if (s >= 40) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                <RelativeScoreWarning compact />
            </div>
            <div className={`font-bold ${sizeClasses[size]} ${getScoreColor(score)}`}>
                {score} <span className="text-lg text-[var(--text-muted)]">/ 100</span>
            </div>
            <div className="mt-2">
                <RelativeScoreWarning />
            </div>
        </div>
    );
}

/**
 * Baseline Comparison Display with mandatory warning.
 */
interface BaselineComparisonProps {
    current: number;
    label: string;
    vsBaseline: number;  // Percentage difference
    unit?: string;
}

export function BaselineComparison({ current, label, vsBaseline, unit = '' }: BaselineComparisonProps) {
    const isPositive = vsBaseline >= 0;
    const arrow = isPositive ? '↑' : '↓';
    const color = isPositive ? 'text-green-400' : 'text-red-400';

    return (
        <div className="flex items-center gap-3">
            <div>
                <div className="text-sm text-[var(--text-secondary)]">{label}</div>
                <div className="text-xl font-semibold">
                    {unit}{current.toFixed(2)}
                </div>
            </div>
            <div className={`${color} text-sm`}>
                {arrow} {Math.abs(vsBaseline).toFixed(1)}%
            </div>
            <RelativeScoreWarning compact />
        </div>
    );
}

export { WARNING_COPY };
