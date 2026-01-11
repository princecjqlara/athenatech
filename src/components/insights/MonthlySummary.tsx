'use client';

/**
 * MonthlySummary Component
 * 
 * Displays monthly meta-learning summary including:
 * - Recommendation follow/success rates
 * - Top performing recommendation types
 * - Account-specific insights
 */

import React from 'react';
import type { MonthlySummary } from '@/lib/learning/metaLearning';

interface MonthlySummaryCardProps {
    summary: MonthlySummary;
    className?: string;
}

export function MonthlySummaryCard({ summary, className = '' }: MonthlySummaryCardProps) {
    const monthName = formatMonthName(summary.month);

    return (
        <div className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 border border-gray-700 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{monthName} Summary</h3>
                <span className="text-xs text-gray-500">Meta-Learning</span>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <StatBox
                    label="Generated"
                    value={summary.recommendationsGenerated}
                    color="text-gray-300"
                />
                <StatBox
                    label="Followed"
                    value={summary.recommendationsFollowed}
                    color="text-blue-400"
                    subtext={`${((summary.recommendationsFollowed / Math.max(summary.recommendationsGenerated, 1)) * 100).toFixed(0)}%`}
                />
                <StatBox
                    label="Success Rate"
                    value={`${summary.successRate.toFixed(0)}%`}
                    color={summary.successRate >= 50 ? 'text-green-400' : 'text-yellow-400'}
                />
            </div>

            {/* CPA Impact */}
            {summary.avgCpaImprovement !== 0 && (
                <div className={`rounded-lg p-3 mb-4 ${summary.avgCpaImprovement > 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                    }`}>
                    <span className={`text-2xl font-bold ${summary.avgCpaImprovement > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                        {summary.avgCpaImprovement > 0 ? '↓' : '↑'}{' '}
                        {Math.abs(summary.avgCpaImprovement).toFixed(1)}%
                    </span>
                    <span className="text-gray-400 text-sm ml-2">Average CPA Change</span>
                </div>
            )}

            {/* Top Performing Types */}
            {summary.topPerformingTypes.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-sm text-gray-400 mb-2">Top Performers</h4>
                    <div className="space-y-1.5">
                        {summary.topPerformingTypes.map((t, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <span className="text-gray-300">
                                    {formatTypeName(t.type)}
                                </span>
                                <span className="text-green-400">{t.successRate.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Insights */}
            {summary.insights.length > 0 && (
                <div className="border-t border-gray-700 pt-3">
                    <h4 className="text-sm text-gray-400 mb-2">💡 Insights</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                        {summary.insights.map((insight, i) => (
                            <li key={i}>• {insight}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// ==================== STAT BOX ====================

interface StatBoxProps {
    label: string;
    value: string | number;
    color: string;
    subtext?: string;
}

function StatBox({ label, value, color, subtext }: StatBoxProps) {
    return (
        <div className="bg-gray-800/50 rounded p-2.5 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
            {subtext && <div className="text-xs text-gray-600 mt-0.5">{subtext}</div>}
        </div>
    );
}

// ==================== HELPERS ====================

function formatMonthName(yyyyMm: string): string {
    const [year, month] = yyyyMm.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatTypeName(type: string): string {
    return type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
