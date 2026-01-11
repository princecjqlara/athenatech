'use client';

import React from 'react';
import type { ExtractionStatus } from '@/lib/extraction';

/**
 * Extraction Status Display
 * 
 * GAP 5: Show extraction state to user with appropriate messaging.
 */

interface ExtractionStatusDisplayProps {
    status: ExtractionStatus;
    missingSignals?: string[];
    onRetry?: () => void;
    retryCount?: number;
    maxRetries?: number;
}

const STATUS_CONFIG: Record<ExtractionStatus, {
    icon: string;
    color: string;
    message: string;
}> = {
    pending: {
        icon: '⏳',
        color: 'text-blue-400',
        message: 'Analyzing creative structure...'
    },
    complete: {
        icon: '✅',
        color: 'text-green-400',
        message: 'Analysis complete'
    },
    partial: {
        icon: '⚠️',
        color: 'text-amber-400',
        message: 'Some signals unavailable. Results may be limited.'
    },
    failed: {
        icon: '❌',
        color: 'text-red-400',
        message: 'Analysis failed. Some features may not be available.'
    }
};

export function ExtractionStatusDisplay({
    status,
    missingSignals = [],
    onRetry,
    retryCount = 0,
    maxRetries = 3
}: ExtractionStatusDisplayProps) {
    const config = STATUS_CONFIG[status];
    const canRetry = status === 'failed' && retryCount < maxRetries;

    return (
        <div className={`p-4 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-subtle)]`}>
            <div className="flex items-center gap-3">
                <span className="text-2xl">{config.icon}</span>
                <div className="flex-1">
                    <p className={`font-medium ${config.color}`}>
                        {config.message}
                    </p>

                    {status === 'pending' && (
                        <div className="mt-2 h-1 bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500 animate-pulse w-2/3" />
                        </div>
                    )}
                </div>
            </div>

            {/* Missing signals for partial status */}
            {status === 'partial' && missingSignals.length > 0 && (
                <div className="mt-4 p-3 rounded bg-[var(--surface-secondary)]">
                    <p className="text-sm text-[var(--text-secondary)] mb-2">
                        Signals that could not be extracted:
                    </p>
                    <ul className="text-sm text-[var(--text-muted)] space-y-1">
                        {missingSignals.map(signal => (
                            <li key={signal}>• {formatSignalName(signal)}</li>
                        ))}
                    </ul>
                    <p className="text-sm text-[var(--text-muted)] mt-3">
                        Confidence has been reduced accordingly.
                    </p>
                </div>
            )}

            {/* Retry button for failed status */}
            {canRetry && onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-4 px-4 py-2 bg-primary-600 hover:bg-primary-700 
                               text-white rounded-lg transition-colors text-sm"
                >
                    Retry Analysis
                </button>
            )}

            {/* Max retries exceeded */}
            {status === 'failed' && retryCount >= maxRetries && (
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                    Maximum retries exceeded. Please contact support or try re-uploading the creative.
                </p>
            )}
        </div>
    );
}

function formatSignalName(signal: string): string {
    const names: Record<string, string> = {
        motionStartMs: 'Motion timing',
        textAppearanceMs: 'Text appearance timing',
        cutCount: 'Scene cut detection',
        audioLevelLufs: 'Audio levels',
        frameRate: 'Frame rate',
        duration: 'Duration',
        hasAudio: 'Audio detection',
        aspectRatio: 'Aspect ratio'
    };
    return names[signal] || signal;
}

/**
 * Confidence badge with extraction penalty explanation.
 */
interface ConfidenceBadgeProps {
    confidence: 'high' | 'medium' | 'low' | 'insufficient';
    reasons?: string[];
}

export function ConfidenceBadge({ confidence, reasons = [] }: ConfidenceBadgeProps) {
    const colors = {
        high: 'bg-green-500/20 text-green-300 border-green-500/40',
        medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
        low: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
        insufficient: 'bg-gray-500/20 text-gray-400 border-gray-500/40'
    };

    const labels = {
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        insufficient: 'Insufficient Data'
    };

    return (
        <div className="inline-flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded border ${colors[confidence]}`}>
                {labels[confidence]}
            </span>

            {reasons.length > 0 && (
                <span
                    className="text-[var(--text-muted)] cursor-help"
                    title={reasons.join('\n')}
                >
                    ⓘ
                </span>
            )}
        </div>
    );
}
