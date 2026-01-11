/**
 * Baseline Builder
 * 
 * Computes and manages account baselines for conversion efficiency scoring.
 * Baselines are segmented by conversion type, placement, and objective.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { GATE_CONFIG } from '../config/gates';

// ==================== TYPES ====================

export type ConversionType = 'purchase' | 'lead' | 'registration' | 'add_to_cart' | 'view_content' | 'other';
export type BaselineQuality = 'high' | 'medium' | 'low' | 'none';

export interface AccountBaseline {
    id?: string;
    userId: string;
    conversionType: ConversionType;
    placement?: string;
    objective?: string;
    avgCpa: number;
    avgRoas: number;
    avgCtr: number;
    avgCvr: number;
    avgCpm: number;
    sampleSize: number;
    totalSpend: number;
    totalConversions: number;
    quality: BaselineQuality;
    promoDaysExcluded: number;
    computedAt: Date;
    periodStart?: Date;
    periodEnd?: Date;
}

export interface BaselineInput {
    spend: number;
    conversions: number;
    revenue: number;
    impressions: number;
    clicks: number;
    date: Date;
    conversionType: ConversionType;
    placement?: string;
    objective?: string;
    isPromoDay?: boolean;
}

// ==================== BASELINE QUALITY ====================

/**
 * Determine baseline quality based on conversion volume.
 */
export function getBaselineQuality(totalConversions: number): BaselineQuality {
    if (totalConversions >= 200) return 'high';
    if (totalConversions >= 50) return 'medium';
    if (totalConversions >= 10) return 'low';
    return 'none';
}

/**
 * Check if efficiency scoring is allowed based on baseline quality.
 */
export function canComputeEfficiency(baseline: AccountBaseline): boolean {
    return baseline.quality !== 'none';
}

/**
 * Check if account is in "new account" mode (no baseline yet).
 */
export function isNewAccountMode(baseline: AccountBaseline | null): boolean {
    if (!baseline) return true;
    return baseline.quality === 'none';
}

// ==================== PROMO DETECTION ====================

/**
 * Detect if a day is a promo day based on spend anomaly.
 * Promo days should be excluded from baseline calculation.
 */
export function isPromoDay(
    dailySpend: number,
    avgDailySpend: number,
    threshold: number = 2.0
): boolean {
    if (avgDailySpend === 0) return false;
    return dailySpend > avgDailySpend * threshold;
}

// ==================== BASELINE COMPUTATION ====================

/**
 * Compute baseline from daily inputs, excluding promo days.
 */
export function computeBaseline(
    inputs: BaselineInput[],
    conversionType: ConversionType,
    placement?: string,
    objective?: string
): Omit<AccountBaseline, 'id' | 'userId'> {
    // Filter by segment
    let filtered = inputs.filter(i => i.conversionType === conversionType);
    if (placement) {
        filtered = filtered.filter(i => i.placement === placement);
    }
    if (objective) {
        filtered = filtered.filter(i => i.objective === objective);
    }

    // Calculate average daily spend for promo detection
    const totalSpend = filtered.reduce((sum, i) => sum + i.spend, 0);
    const avgDailySpend = filtered.length > 0 ? totalSpend / filtered.length : 0;

    // Exclude promo days
    const nonPromo = filtered.filter(i =>
        !i.isPromoDay && !isPromoDay(i.spend, avgDailySpend)
    );
    const promoDaysExcluded = filtered.length - nonPromo.length;

    // Aggregate metrics
    const aggregated = nonPromo.reduce((acc, i) => ({
        spend: acc.spend + i.spend,
        conversions: acc.conversions + i.conversions,
        revenue: acc.revenue + i.revenue,
        impressions: acc.impressions + i.impressions,
        clicks: acc.clicks + i.clicks,
    }), { spend: 0, conversions: 0, revenue: 0, impressions: 0, clicks: 0 });

    // Compute averages
    const avgCpa = aggregated.conversions > 0
        ? aggregated.spend / aggregated.conversions
        : 0;
    const avgRoas = aggregated.spend > 0
        ? aggregated.revenue / aggregated.spend
        : 0;
    const avgCtr = aggregated.impressions > 0
        ? (aggregated.clicks / aggregated.impressions) * 100
        : 0;
    const avgCvr = aggregated.clicks > 0
        ? (aggregated.conversions / aggregated.clicks) * 100
        : 0;
    const avgCpm = aggregated.impressions > 0
        ? (aggregated.spend / aggregated.impressions) * 1000
        : 0;

    // Determine date range
    const dates = nonPromo.map(i => i.date.getTime());
    const periodStart = dates.length > 0 ? new Date(Math.min(...dates)) : undefined;
    const periodEnd = dates.length > 0 ? new Date(Math.max(...dates)) : undefined;

    return {
        conversionType,
        placement,
        objective,
        avgCpa,
        avgRoas,
        avgCtr,
        avgCvr,
        avgCpm,
        sampleSize: nonPromo.length,
        totalSpend: aggregated.spend,
        totalConversions: aggregated.conversions,
        quality: getBaselineQuality(aggregated.conversions),
        promoDaysExcluded,
        computedAt: new Date(),
        periodStart,
        periodEnd,
    };
}

// ==================== DATABASE OPERATIONS ====================

/**
 * Fetch baseline for a specific segment.
 */
export async function getBaseline(
    supabase: SupabaseClient,
    userId: string,
    conversionType: ConversionType,
    placement?: string,
    objective?: string
): Promise<AccountBaseline | null> {
    let query = supabase
        .from('account_baselines')
        .select('*')
        .eq('user_id', userId)
        .eq('conversion_type', conversionType);

    if (placement) {
        query = query.eq('placement', placement);
    } else {
        query = query.is('placement', null);
    }

    if (objective) {
        query = query.eq('objective', objective);
    } else {
        query = query.is('objective', null);
    }

    const { data, error } = await query.single();

    if (error || !data) return null;

    return mapDbToBaseline(data);
}

/**
 * Save or update baseline.
 */
export async function saveBaseline(
    supabase: SupabaseClient,
    userId: string,
    baseline: Omit<AccountBaseline, 'id' | 'userId'>
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('account_baselines')
        .upsert({
            user_id: userId,
            conversion_type: baseline.conversionType,
            placement: baseline.placement || null,
            objective: baseline.objective || null,
            avg_cpa: baseline.avgCpa,
            avg_roas: baseline.avgRoas,
            avg_ctr: baseline.avgCtr,
            avg_cvr: baseline.avgCvr,
            avg_cpm: baseline.avgCpm,
            sample_size: baseline.sampleSize,
            total_spend: baseline.totalSpend,
            total_conversions: baseline.totalConversions,
            promo_days_excluded: baseline.promoDaysExcluded,
            computed_at: baseline.computedAt.toISOString(),
            period_start: baseline.periodStart?.toISOString(),
            period_end: baseline.periodEnd?.toISOString(),
        }, {
            onConflict: 'user_id,conversion_type,placement,objective',
        });

    return { success: !error, error: error?.message };
}

// ==================== HELPERS ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbToBaseline(row: any): AccountBaseline {
    return {
        id: row.id,
        userId: row.user_id,
        conversionType: row.conversion_type,
        placement: row.placement,
        objective: row.objective,
        avgCpa: parseFloat(row.avg_cpa) || 0,
        avgRoas: parseFloat(row.avg_roas) || 0,
        avgCtr: parseFloat(row.avg_ctr) || 0,
        avgCvr: parseFloat(row.avg_cvr) || 0,
        avgCpm: parseFloat(row.avg_cpm) || 0,
        sampleSize: row.sample_size,
        totalSpend: parseFloat(row.total_spend) || 0,
        totalConversions: row.total_conversions,
        quality: row.quality,
        promoDaysExcluded: row.promo_days_excluded,
        computedAt: new Date(row.computed_at),
        periodStart: row.period_start ? new Date(row.period_start) : undefined,
        periodEnd: row.period_end ? new Date(row.period_end) : undefined,
    };
}

// ==================== EFFICIENCY SCORING ====================

export interface EfficiencyResult {
    canScore: boolean;
    reason?: string;
    efficiencyScore?: number;
    cpaVsBaseline?: number;  // Percentage: positive = better than baseline
    roasVsBaseline?: number;
    confidence: 'high' | 'medium' | 'low' | 'insufficient';
    baselineQuality: BaselineQuality;
}

/**
 * Compute efficiency score against baseline.
 * Respects conversion type segmentation.
 */
export function computeEfficiencyScore(
    currentCpa: number,
    currentRoas: number,
    currentConversions: number,
    baseline: AccountBaseline | null
): EfficiencyResult {
    // Check for new account mode
    if (!baseline || isNewAccountMode(baseline)) {
        return {
            canScore: false,
            reason: 'Building baseline. Need more conversion data.',
            confidence: 'insufficient',
            baselineQuality: baseline?.quality || 'none',
        };
    }

    // Check baseline quality
    if (baseline.quality === 'low') {
        return {
            canScore: true,
            reason: 'Baseline quality is low. Results may be unreliable.',
            efficiencyScore: calculateEfficiencyScore(currentCpa, baseline.avgCpa),
            cpaVsBaseline: calculatePercentChange(baseline.avgCpa, currentCpa),
            roasVsBaseline: calculatePercentChange(currentRoas, baseline.avgRoas),
            confidence: 'low',
            baselineQuality: 'low',
        };
    }

    // Calculate efficiency
    const efficiencyScore = calculateEfficiencyScore(currentCpa, baseline.avgCpa);
    const cpaVsBaseline = calculatePercentChange(baseline.avgCpa, currentCpa);
    const roasVsBaseline = calculatePercentChange(currentRoas, baseline.avgRoas);

    // Determine confidence based on current conversion volume
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (currentConversions >= GATE_CONFIG.CONVERSIONS_MEDIUM) {
        confidence = 'high';
    } else if (currentConversions >= GATE_CONFIG.CONVERSIONS_LOW) {
        confidence = 'medium';
    }

    return {
        canScore: true,
        efficiencyScore,
        cpaVsBaseline,
        roasVsBaseline,
        confidence,
        baselineQuality: baseline.quality,
    };
}

function calculateEfficiencyScore(currentCpa: number, baselineCpa: number): number {
    if (baselineCpa === 0) return 50;
    const ratio = baselineCpa / currentCpa;
    // Score: 50 = at baseline, 100 = 2x better, 0 = 2x worse
    return Math.min(100, Math.max(0, 50 * ratio));
}

function calculatePercentChange(baseline: number, current: number): number {
    if (baseline === 0) return 0;
    return ((baseline - current) / baseline) * 100;
}
