/**
 * Recommendations Service
 * 
 * Provides API methods for managing recommendations.
 * Note: Supabase typing is relaxed to avoid database schema type conflicts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    Recommendation,
    CreateRecommendationInput,
    AccountPattern
} from '../types/recommendations';
import { validateRecommendation } from './specificityValidator';
import { computeAccountLearnings, measureOutcome, type MetricsSnapshot } from '../learning/metaLearning';

// ==================== CREATE RECOMMENDATION ====================

export interface CreateRecommendationResult {
    success: boolean;
    recommendation?: Recommendation;
    validationErrors?: string[];
    error?: string;
}

/**
 * Create a new recommendation (with validation)
 */
export async function createRecommendation(
    supabase: SupabaseClient,
    userId: string,
    metaCreativeId: string,
    input: CreateRecommendationInput
): Promise<CreateRecommendationResult> {
    const validation = validateRecommendation(input);
    if (!validation.valid) {
        return { success: false, validationErrors: validation.errors };
    }

    const { data, error } = await supabase
        .from('recommendations')
        .insert({
            user_id: userId,
            meta_creative_id: metaCreativeId,
            source_system: input.sourceSystem,
            recommendation_type: input.recommendationType,
            recommendation_text: input.recommendationText,
            what_to_change: input.whatToChange,
            target_range: input.targetRange,
            observable_gap: input.observableGap,
            metric_to_watch: input.metricToWatch,
            run_duration_days: input.runDurationDays,
            confidence: input.confidence,
        })
        .select()
        .single();

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true, recommendation: mapDbToRecommendation(data) };
}

// ==================== UPDATE RECOMMENDATION STATUS ====================

export async function markRecommendationFollowed(
    supabase: SupabaseClient,
    recommendationId: string,
    linkedCreativeId?: string
): Promise<{ success: boolean; error?: string }> {
    const update: Record<string, unknown> = {
        status: 'followed',
        followed_at: new Date().toISOString(),
    };
    if (linkedCreativeId) {
        update.linked_creative_id = linkedCreativeId;
    }

    const { error } = await supabase
        .from('recommendations')
        .update(update)
        .eq('id', recommendationId);

    return { success: !error, error: error?.message };
}

export async function markRecommendationIgnored(
    supabase: SupabaseClient,
    recommendationId: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('recommendations')
        .update({ status: 'ignored', ignored_at: new Date().toISOString() })
        .eq('id', recommendationId);

    return { success: !error, error: error?.message };
}

// ==================== MEASURE OUTCOME ====================

export async function recordRecommendationOutcome(
    supabase: SupabaseClient,
    recommendationId: string,
    beforeMetrics: MetricsSnapshot,
    afterMetrics: MetricsSnapshot,
    runDurationDays: number
): Promise<{ success: boolean; error?: string }> {
    const outcome = measureOutcome(beforeMetrics, afterMetrics, runDurationDays);

    if (!outcome) {
        return { success: false, error: 'Could not measure outcome' };
    }

    const { error } = await supabase
        .from('recommendations')
        .update({
            outcome_verdict: outcome.verdict,
            outcome_cpa_change: outcome.cpaChange,
            outcome_roas_change: outcome.roasChange,
            outcome_conversions: outcome.conversions,
            outcome_measured_at: new Date().toISOString(),
        })
        .eq('id', recommendationId);

    return { success: !error, error: error?.message };
}

// ==================== FETCH RECOMMENDATIONS ====================

export async function getRecommendationsForCreative(
    supabase: SupabaseClient,
    metaCreativeId: string
): Promise<{ recommendations: Recommendation[]; error?: string }> {
    const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('meta_creative_id', metaCreativeId)
        .order('created_at', { ascending: false });

    if (error) {
        return { recommendations: [], error: error.message };
    }

    return { recommendations: (data || []).map(mapDbToRecommendation) };
}

export async function getPendingRecommendations(
    supabase: SupabaseClient,
    userId: string
): Promise<{ recommendations: Recommendation[]; error?: string }> {
    const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        return { recommendations: [], error: error.message };
    }

    return { recommendations: (data || []).map(mapDbToRecommendation) };
}

// ==================== ACCOUNT LEARNINGS ====================

export async function getAccountLearnings(
    supabase: SupabaseClient,
    userId: string
): Promise<{ patterns: AccountPattern[]; error?: string }> {
    const { data, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'followed')
        .not('outcome_verdict', 'is', null);

    if (error) {
        return { patterns: [], error: error.message };
    }

    const recommendations = (data || []).map(mapDbToRecommendation);
    const learnings = computeAccountLearnings(recommendations);

    return { patterns: learnings.patterns };
}

// ==================== HELPERS ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbToRecommendation(row: any): Recommendation {
    return {
        id: row.id,
        userId: row.user_id,
        sourceSystem: row.source_system,
        sourceCreativeId: row.meta_creative_id,
        recommendationType: row.recommendation_type,
        recommendationText: row.recommendation_text,
        whatToChange: row.what_to_change,
        targetRange: row.target_range,
        observableGap: row.observable_gap,
        metricToWatch: row.metric_to_watch,
        runDurationDays: row.run_duration_days,
        confidence: row.confidence,
        status: row.status,
        linkedCreativeId: row.linked_creative_id,
        outcomeCpaChange: row.outcome_cpa_change,
        outcomeRoasChange: row.outcome_roas_change,
        outcomeConversions: row.outcome_conversions,
        outcomeVerdict: row.outcome_verdict,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at || row.created_at),
        followedAt: row.followed_at ? new Date(row.followed_at) : undefined,
        outcomeMeasuredAt: row.outcome_measured_at ? new Date(row.outcome_measured_at) : undefined,
    };
}
