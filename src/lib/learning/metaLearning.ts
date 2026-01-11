/**
 * Meta-Learning Service
 * 
 * Analyzes recommendation outcomes to identify:
 * - Which recommendation types work best for this account
 * - Cross-account patterns by vertical
 * - Confidence improvements from historical data
 */

import type {
    Recommendation,
    AccountPattern,
    RecommendationType,
    OutcomeVerdict
} from '../types/recommendations';
import { GATE_CONFIG } from '../config/gates';

// ==================== ACCOUNT PATTERN ANALYSIS ====================

export interface AccountLearnings {
    patterns: AccountPattern[];
    totalRecommendations: number;
    totalTested: number;
    lastUpdated: Date;
}

/**
 * Compute account-specific learnings from recommendation history
 */
export function computeAccountLearnings(
    recommendations: Recommendation[]
): AccountLearnings {
    const tested = recommendations.filter(r => r.status === 'followed' && r.outcomeVerdict);

    // Group by recommendation type
    const byType = new Map<RecommendationType, Recommendation[]>();
    tested.forEach(r => {
        const list = byType.get(r.recommendationType) || [];
        list.push(r);
        byType.set(r.recommendationType, list);
    });

    // Compute patterns per type
    const patterns: AccountPattern[] = [];
    byType.forEach((recs, type) => {
        if (recs.length >= GATE_CONFIG.ACCOUNT_PATTERN_MIN_SAMPLES) {
            const improved = recs.filter(r => r.outcomeVerdict === 'improved');
            const cpaImprovements = recs
                .filter(r => r.outcomeCpaChange !== undefined)
                .map(r => r.outcomeCpaChange!);

            // Most recent recommendation date
            const mostRecent = new Date(Math.max(...recs.map(r => new Date(r.createdAt).getTime())));
            const recencyDays = Math.floor((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));

            patterns.push({
                recommendationType: type,
                successRate: (improved.length / recs.length) * 100,
                avgCpaImprovement: cpaImprovements.length > 0
                    ? cpaImprovements.reduce((a, b) => a + b, 0) / cpaImprovements.length
                    : 0,
                avgRoasImprovement: 0,
                sampleSize: recs.length,
                recencyDays,
                lastUpdated: mostRecent,
            });
        }
    });

    // Sort by success rate
    patterns.sort((a, b) => b.successRate - a.successRate);

    return {
        patterns,
        totalRecommendations: recommendations.length,
        totalTested: tested.length,
        lastUpdated: new Date(),
    };
}

// ==================== RECOMMENDATION RANKING ====================

export interface RankedRecommendation {
    recommendation: Recommendation;
    adjustedConfidence: 'high' | 'medium' | 'low';
    accountSuccessRate?: number;
    boostReason?: string;
    demoteReason?: string;
}

/**
 * Rank recommendations using account-specific learnings
 */
export function rankRecommendations(
    recommendations: Recommendation[],
    accountLearnings: AccountLearnings
): RankedRecommendation[] {
    const patternMap = new Map(
        accountLearnings.patterns.map(p => [p.recommendationType, p])
    );

    return recommendations.map(rec => {
        const pattern = patternMap.get(rec.recommendationType);
        let adjustedConfidence = rec.confidence;
        let boostReason: string | undefined;
        let demoteReason: string | undefined;

        if (pattern && pattern.sampleSize >= GATE_CONFIG.ACCOUNT_PATTERN_MIN_SAMPLES) {
            // Boost if this type has high success in this account
            if (pattern.successRate >= 60) {
                if (adjustedConfidence === 'low') adjustedConfidence = 'medium';
                if (adjustedConfidence === 'medium') adjustedConfidence = 'high';
                boostReason = `This type has ${pattern.successRate.toFixed(0)}% success rate in your account`;
            }
            // Demote if this type has low success in this account
            else if (pattern.successRate < 30) {
                if (adjustedConfidence === 'high') adjustedConfidence = 'medium';
                if (adjustedConfidence === 'medium') adjustedConfidence = 'low';
                demoteReason = `This type has only ${pattern.successRate.toFixed(0)}% success rate in your account`;
            }
        }

        return {
            recommendation: rec,
            adjustedConfidence,
            accountSuccessRate: pattern?.successRate,
            boostReason,
            demoteReason,
        };
    }).sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        const confDiff = confidenceOrder[b.adjustedConfidence] - confidenceOrder[a.adjustedConfidence];
        if (confDiff !== 0) return confDiff;
        return (b.accountSuccessRate || 0) - (a.accountSuccessRate || 0);
    });
}

// ==================== OUTCOME MEASUREMENT ====================

export interface OutcomeMeasurement {
    recommendationId: string;
    verdict: OutcomeVerdict;
    cpaChange?: number;
    roasChange?: number;
    conversions: number;
    confidence: 'high' | 'medium' | 'low' | 'insufficient';
    comparisonPeriod: { before: DateRange; after: DateRange };
}

interface DateRange {
    start: Date;
    end: Date;
}

export interface MetricsSnapshot {
    spend: number;
    conversions: number;
    revenue: number;
    impressions: number;
}

/**
 * Measure outcome of a followed recommendation
 */
export function measureOutcome(
    beforeMetrics: MetricsSnapshot,
    afterMetrics: MetricsSnapshot,
    runDurationDays: number
): OutcomeMeasurement | null {
    // Need minimum conversions to measure
    if (afterMetrics.conversions < GATE_CONFIG.CONVERSIONS_INSUFFICIENT) {
        return {
            recommendationId: '',
            verdict: 'insufficient_data',
            conversions: afterMetrics.conversions,
            confidence: 'insufficient',
            comparisonPeriod: {
                before: { start: new Date(), end: new Date() },
                after: { start: new Date(), end: new Date() },
            },
        };
    }

    // Calculate CPA change
    const beforeCpa = beforeMetrics.conversions > 0
        ? beforeMetrics.spend / beforeMetrics.conversions
        : null;
    const afterCpa = afterMetrics.spend / afterMetrics.conversions;

    const cpaChange = beforeCpa
        ? ((beforeCpa - afterCpa) / beforeCpa) * 100
        : null;

    // Calculate ROAS change
    const beforeRoas = beforeMetrics.spend > 0
        ? beforeMetrics.revenue / beforeMetrics.spend
        : null;
    const afterRoas = afterMetrics.spend > 0
        ? afterMetrics.revenue / afterMetrics.spend
        : null;

    const roasChange = beforeRoas && afterRoas
        ? ((afterRoas - beforeRoas) / beforeRoas) * 100
        : null;

    // Determine verdict (10% significance threshold)
    let verdict: OutcomeVerdict = 'neutral';
    if (cpaChange !== null && cpaChange > 10) {
        verdict = 'improved';
    } else if (cpaChange !== null && cpaChange < -10) {
        verdict = 'declined';
    }

    // Determine confidence
    let confidence: OutcomeMeasurement['confidence'] = 'low';
    if (afterMetrics.conversions >= GATE_CONFIG.CONVERSIONS_MEDIUM) {
        confidence = 'high';
    } else if (afterMetrics.conversions >= GATE_CONFIG.CONVERSIONS_LOW) {
        confidence = 'medium';
    }

    return {
        recommendationId: '',
        verdict,
        cpaChange: cpaChange ?? undefined,
        roasChange: roasChange ?? undefined,
        conversions: afterMetrics.conversions,
        confidence,
        comparisonPeriod: {
            before: {
                start: new Date(Date.now() - (runDurationDays * 2 + runDurationDays) * 24 * 60 * 60 * 1000),
                end: new Date(Date.now() - runDurationDays * 24 * 60 * 60 * 1000),
            },
            after: {
                start: new Date(Date.now() - runDurationDays * 24 * 60 * 60 * 1000),
                end: new Date(),
            },
        },
    };
}

// ==================== MONTHLY SUMMARY ====================

export interface MonthlySummary {
    month: string;
    recommendationsGenerated: number;
    recommendationsFollowed: number;
    recommendationsIgnored: number;
    outcomesMeasured: number;
    successRate: number;
    avgCpaImprovement: number;
    topPerformingTypes: { type: RecommendationType; successRate: number }[];
    insights: string[];
}

/**
 * Generate monthly meta-learning summary
 */
export function generateMonthlySummary(
    recommendations: Recommendation[],
    month: string
): MonthlySummary {
    const monthRecs = recommendations.filter(r => {
        const created = new Date(r.createdAt);
        return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}` === month;
    });

    const followed = monthRecs.filter(r => r.status === 'followed');
    const ignored = monthRecs.filter(r => r.status === 'ignored');
    const measured = followed.filter(r => r.outcomeVerdict);
    const improved = measured.filter(r => r.outcomeVerdict === 'improved');

    const cpaImprovements = measured
        .filter(r => r.outcomeCpaChange !== undefined)
        .map(r => r.outcomeCpaChange!);

    const typeResults = new Map<RecommendationType, { improved: number; total: number }>();
    measured.forEach(r => {
        const current = typeResults.get(r.recommendationType) || { improved: 0, total: 0 };
        current.total++;
        if (r.outcomeVerdict === 'improved') current.improved++;
        typeResults.set(r.recommendationType, current);
    });

    const topPerformingTypes = Array.from(typeResults.entries())
        .map(([type, { improved: imp, total }]) => ({ type, successRate: (imp / total) * 100 }))
        .filter(t => t.successRate >= 50)
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 3);

    const insights: string[] = [];
    const followRate = monthRecs.length > 0 ? (followed.length / monthRecs.length) * 100 : 0;

    if (followRate < 30) {
        insights.push('Low follow rate. Consider testing more recommendations.');
    }
    if (topPerformingTypes.length > 0) {
        insights.push(`"${topPerformingTypes[0].type.replace(/_/g, ' ')}" recommendations work best.`);
    }
    if (improved.length >= 5) {
        insights.push(`${improved.length} recommendations improved performance this month.`);
    }

    return {
        month,
        recommendationsGenerated: monthRecs.length,
        recommendationsFollowed: followed.length,
        recommendationsIgnored: ignored.length,
        outcomesMeasured: measured.length,
        successRate: measured.length > 0 ? (improved.length / measured.length) * 100 : 0,
        avgCpaImprovement: cpaImprovements.length > 0
            ? cpaImprovements.reduce((a, b) => a + b, 0) / cpaImprovements.length
            : 0,
        topPerformingTypes,
        insights,
    };
}
