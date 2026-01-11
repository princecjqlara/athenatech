'use client';

/**
 * RecommendationCard Component
 * 
 * Displays a single recommendation with:
 * - Source system badge
 * - What to change + target range
 * - Observable gap (why)
 * - Metrics to watch + run duration
 * - Follow/Ignore actions
 * - Outcome display when measured
 */

import React, { useState } from 'react';
import type { Recommendation } from '@/lib/types/recommendations';

interface RecommendationCardProps {
    recommendation: Recommendation;
    onMarkFollowed: (id: string, linkedCreativeId?: string) => void;
    onMarkIgnored: (id: string) => void;
}

export function RecommendationCard({
    recommendation,
    onMarkFollowed,
    onMarkIgnored,
}: RecommendationCardProps) {
    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const [linkedCreativeId, setLinkedCreativeId] = useState('');

    const handleFollowed = () => {
        if (linkedCreativeId) {
            onMarkFollowed(recommendation.id, linkedCreativeId);
            setShowLinkDialog(false);
        } else {
            setShowLinkDialog(true);
        }
    };

    const handleConfirmFollowed = () => {
        onMarkFollowed(recommendation.id, linkedCreativeId || undefined);
        setShowLinkDialog(false);
    };

    return (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
            {/* Header with source badge */}
            <div className="flex items-center justify-between mb-3">
                <SourceBadge source={recommendation.sourceSystem} />
                <div className="flex items-center gap-2">
                    <ConfidenceIndicator level={recommendation.confidence} />
                    <span className="text-xs text-gray-500">
                        {formatRelativeTime(recommendation.createdAt)}
                    </span>
                </div>
            </div>

            {/* Main recommendation */}
            <p className="text-white font-medium mb-2">{recommendation.whatToChange}</p>
            <p className="text-gray-400 text-sm mb-3">{recommendation.targetRange}</p>

            {/* Observable gap (why) */}
            <div className="bg-gray-900 rounded p-2.5 mb-3">
                <span className="text-gray-500 text-xs">Why: </span>
                <span className="text-gray-300 text-sm">{recommendation.observableGap}</span>
            </div>

            {/* Metrics and duration */}
            <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                    <ChartIcon className="w-3.5 h-3.5" />
                    Watch: {recommendation.metricToWatch}
                </span>
                <span className="flex items-center gap-1">
                    <ClockIcon className="w-3.5 h-3.5" />
                    Run for: {recommendation.runDurationDays} days
                </span>
            </div>

            {/* Action buttons or status */}
            {recommendation.status === 'pending' && (
                <div className="flex gap-2">
                    <button
                        onClick={handleFollowed}
                        className="flex-1 bg-green-500/20 text-green-400 py-2 rounded font-medium hover:bg-green-500/30 transition-colors"
                    >
                        ✓ I made this change
                    </button>
                    <button
                        onClick={() => onMarkIgnored(recommendation.id)}
                        className="flex-1 bg-gray-700 text-gray-400 py-2 rounded font-medium hover:bg-gray-600 transition-colors"
                    >
                        Skip
                    </button>
                </div>
            )}

            {recommendation.status === 'followed' && !recommendation.outcomeVerdict && (
                <div className="bg-blue-500/10 text-blue-400 py-2 px-3 rounded text-sm text-center">
                    ⏳ Measuring outcome... Check back in {recommendation.runDurationDays} days
                </div>
            )}

            {recommendation.status === 'ignored' && (
                <div className="bg-gray-700/50 text-gray-500 py-2 px-3 rounded text-sm text-center">
                    Skipped
                </div>
            )}

            {/* Outcome display */}
            {recommendation.outcomeVerdict && (
                <OutcomeDisplay
                    verdict={recommendation.outcomeVerdict}
                    cpaChange={recommendation.outcomeCpaChange}
                    roasChange={recommendation.outcomeRoasChange}
                    conversions={recommendation.outcomeConversions}
                />
            )}

            {/* Link dialog */}
            {showLinkDialog && (
                <div className="mt-3 p-3 bg-gray-900 rounded border border-gray-700">
                    <p className="text-sm text-gray-300 mb-2">
                        Link to new creative (optional):
                    </p>
                    <input
                        type="text"
                        value={linkedCreativeId}
                        onChange={(e) => setLinkedCreativeId(e.target.value)}
                        placeholder="Creative ID or leave empty"
                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
                    />
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={handleConfirmFollowed}
                            className="flex-1 bg-green-500 text-white py-1.5 rounded text-sm"
                        >
                            Confirm
                        </button>
                        <button
                            onClick={() => setShowLinkDialog(false)}
                            className="px-3 py-1.5 text-gray-400 text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== SUB-COMPONENTS ====================

function SourceBadge({ source }: { source: Recommendation['sourceSystem'] }) {
    const config = {
        structure: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'STRUCTURE' },
        narrative: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'NARRATIVE' },
        conversion: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'CONVERSION' },
    };

    const { bg, text, label } = config[source];

    return (
        <span className={`px-2 py-1 rounded text-xs font-medium ${bg} ${text}`}>
            {label}
        </span>
    );
}

function ConfidenceIndicator({ level }: { level: Recommendation['confidence'] }) {
    const config = {
        high: { color: 'bg-green-400', label: 'High' },
        medium: { color: 'bg-amber-400', label: 'Med' },
        low: { color: 'bg-red-400', label: 'Low' },
    };

    const { color, label } = config[level];

    return (
        <span className="flex items-center gap-1 text-xs text-gray-400">
            <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
            {label}
        </span>
    );
}

interface OutcomeDisplayProps {
    verdict: Recommendation['outcomeVerdict'];
    cpaChange?: number;
    roasChange?: number;
    conversions?: number;
}

function OutcomeDisplay({ verdict, cpaChange, roasChange, conversions }: OutcomeDisplayProps) {
    const config = {
        improved: { bg: 'bg-green-500/10', text: 'text-green-400', icon: '✅' },
        neutral: { bg: 'bg-gray-700', text: 'text-gray-300', icon: '➖' },
        declined: { bg: 'bg-red-500/10', text: 'text-red-400', icon: '❌' },
        insufficient_data: { bg: 'bg-gray-700/50', text: 'text-gray-500', icon: '📊' },
    };

    const { bg, text, icon } = config[verdict || 'insufficient_data'];

    return (
        <div className={`p-3 rounded text-sm ${bg} ${text}`}>
            {verdict === 'improved' && (
                <>
                    {icon} CPA improved {Math.abs(cpaChange || 0).toFixed(0)}%
                    {conversions && <span className="text-gray-500"> (n={conversions})</span>}
                </>
            )}
            {verdict === 'declined' && (
                <>
                    {icon} CPA increased {Math.abs(cpaChange || 0).toFixed(0)}%
                    {conversions && <span className="text-gray-500"> (n={conversions})</span>}
                </>
            )}
            {verdict === 'neutral' && (
                <>{icon} No significant change detected</>
            )}
            {verdict === 'insufficient_data' && (
                <>{icon} Not enough conversions to measure outcome</>
            )}
        </div>
    );
}

// ==================== ICONS ====================

function ChartIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
    );
}

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

// ==================== HELPERS ====================

function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
}
