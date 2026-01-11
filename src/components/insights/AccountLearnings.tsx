'use client';

/**
 * AccountLearnings Component
 * 
 * Displays meta-learning patterns for the current account.
 * Shows which recommendation types have historically worked.
 */

import React from 'react';
import type { AccountPattern } from '@/lib/types/recommendations';
import { RECOMMENDATION_TEMPLATES } from '@/lib/recommendations/specificityValidator';

interface AccountLearningsProps {
    patterns: AccountPattern[];
    className?: string;
}

export function AccountLearnings({ patterns, className = '' }: AccountLearningsProps) {
    // Filter to significant patterns (enough samples, recent enough)
    const significantPatterns = patterns
        .filter((p) => p.sampleSize >= 3 && p.recencyDays < 60)
        .sort((a, b) => b.successRate - a.successRate);

    if (significantPatterns.length === 0) {
        return (
            <div className={`bg-gray-800/50 rounded-lg p-4 ${className}`}>
                <h3 className="text-gray-400 font-medium mb-2">Account Learnings</h3>
                <p className="text-sm text-gray-500">
                    Follow more recommendations to build account-specific learnings.
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-gray-600" />
                    Need 3+ tested recommendations per type
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-gray-800/50 rounded-lg p-4 ${className}`}>
            <h3 className="text-white font-medium mb-3">In Your Account</h3>

            <div className="space-y-2">
                {significantPatterns.map((pattern) => (
                    <PatternRow key={pattern.recommendationType} pattern={pattern} />
                ))}
            </div>

            <p className="text-xs text-gray-500 mt-3">
                Based on {significantPatterns.reduce((sum, p) => sum + p.sampleSize, 0)} tested recommendations
            </p>
        </div>
    );
}

function PatternRow({ pattern }: { pattern: AccountPattern }) {
    const label = getPatternLabel(pattern.recommendationType);
    const successColor = getSuccessColor(pattern.successRate);

    return (
        <div className="bg-gray-900/50 rounded p-3">
            <div className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{label}</span>
                <span className={`text-sm font-medium ${successColor}`}>
                    {pattern.successRate.toFixed(0)}% success
                </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
                Improved CPA by avg {pattern.avgCpaImprovement.toFixed(0)}%
                <span className="text-gray-600"> • </span>
                n={pattern.sampleSize}
                <span className="text-gray-600"> • </span>
                last {pattern.recencyDays}d ago
            </p>
        </div>
    );
}

// ==================== HELPERS ====================

function getPatternLabel(type: string): string {
    const labels: Record<string, string> = {
        motion_timing: '⚡ Earlier Motion Start',
        cut_density: '✂️ Opening Cut Density',
        text_appearance: '📝 Earlier Text',
        value_timing: '💡 Value in Opening',
        offer_timing: '🎁 Earlier Offer',
        cta_clarity: '👆 CTA Specificity',
        proof_addition: '⭐ Social Proof',
        pricing_visibility: '💰 Visible Pricing',
        landing_page: '🏠 Landing Page Speed',
        checkout_flow: '💳 Checkout Simplification',
        audience_refresh: '👥 Audience Refresh',
    };
    return labels[type] || type.replace(/_/g, ' ');
}

function getSuccessColor(rate: number): string {
    if (rate >= 60) return 'text-green-400';
    if (rate >= 40) return 'text-yellow-400';
    return 'text-gray-400';
}

// ==================== CROSS-ACCOUNT INSIGHTS ====================

interface CrossAccountPattern {
    recommendationType: string;
    accountCount: number;
    totalSampleSize: number;
    avgSuccessRate: number;
    vertical?: string;
}

interface CrossAccountInsightsProps {
    patterns: CrossAccountPattern[];
    className?: string;
}

export function CrossAccountInsights({ patterns, className = '' }: CrossAccountInsightsProps) {
    if (patterns.length === 0) {
        return null;
    }

    return (
        <div className={`border-t border-gray-700 pt-4 mt-4 ${className}`}>
            <h4 className="text-gray-400 text-sm mb-2">Similar Accounts</h4>
            <p className="text-xs text-gray-500 mb-3">
                These patterns are observed across accounts, not specific to yours.
            </p>

            <div className="space-y-1.5">
                {patterns.slice(0, 3).map((pattern) => (
                    <div key={pattern.recommendationType} className="text-sm text-gray-400">
                        "{getPatternLabel(pattern.recommendationType)}" has{' '}
                        <span className="text-gray-300">{pattern.avgSuccessRate.toFixed(0)}%</span> success
                        <span className="text-gray-500">
                            {' '}({pattern.accountCount} accounts, {pattern.totalSampleSize} tests)
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
