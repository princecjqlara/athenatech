/**
 * Recommendation Types and Interfaces
 * 
 * Type definitions for the recommendation tracking system.
 * Supports outcome measurement and meta-learning.
 */

// ==================== RECOMMENDATION TYPES ====================

export type RecommendationType =
    // Structure system types
    | 'motion_timing'
    | 'cut_density'
    | 'text_appearance'
    | 'aspect_ratio'
    | 'opening_hook'
    | 'audio_levels'
    // Narrative system types
    | 'value_timing'
    | 'offer_timing'
    | 'cta_clarity'
    | 'proof_addition'
    | 'pricing_visibility'
    | 'guarantee_addition'
    | 'ad_lp_alignment'
    // Conversion system types
    | 'landing_page'
    | 'checkout_flow'
    | 'offer_strength'
    | 'tracking_fix'
    | 'audience_refresh'
    | 'budget_adjustment';

export type RecommendationSource = 'structure' | 'narrative' | 'conversion';

export type RecommendationStatus = 'pending' | 'followed' | 'ignored' | 'partial';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type OutcomeVerdict = 'improved' | 'neutral' | 'declined' | 'insufficient_data';

// ==================== RECOMMENDATION INTERFACE ====================

export interface Recommendation {
    id: string;
    userId: string;

    // Source tracking
    sourceSystem: RecommendationSource;
    sourceCreativeId?: string;
    sourceAdId?: string;

    // Content
    recommendationType: RecommendationType;
    recommendationText: string;

    // Specificity (all required per policy)
    whatToChange: string;       // "Move CTA to first 3 seconds"
    targetRange: string;        // "0-3s instead of 8s"
    observableGap: string;      // "CTA currently appears at 8s"
    metricToWatch: string;      // "CTR, CVR"
    runDurationDays: number;    // 7
    confidence: ConfidenceLevel;

    // Outcome tracking
    status: RecommendationStatus;
    followedAt?: Date;
    linkedCreativeId?: string;
    outcomeCpaChange?: number;
    outcomeRoasChange?: number;
    outcomeConversions?: number;
    outcomeMeasuredAt?: Date;
    outcomeVerdict?: OutcomeVerdict;

    createdAt: Date;
    updatedAt: Date;
}

// ==================== RECOMMENDATION CREATION ====================

export interface CreateRecommendationInput {
    sourceSystem: RecommendationSource;
    sourceCreativeId?: string;
    sourceAdId?: string;
    recommendationType: RecommendationType;
    recommendationText: string;
    whatToChange: string;
    targetRange: string;
    observableGap: string;
    metricToWatch: string;
    runDurationDays: number;
    confidence: ConfidenceLevel;
}

// ==================== OUTCOME TRACKING ====================

export interface RecommendationOutcome {
    recommendationId: string;
    linkedCreativeId: string;
    linkedCpa: number;
    linkedRoas: number;
    linkedConversions: number;
    originalCpa: number;
    originalRoas: number;
}

// ==================== ACCOUNT PATTERNS ====================

export interface AccountPattern {
    recommendationType: RecommendationType;
    sampleSize: number;
    successRate: number;          // % that improved
    avgCpaImprovement: number;
    avgRoasImprovement: number;
    lastUpdated: Date;
    recencyDays: number;          // Days since most recent
}

// ==================== VALIDATION RESULT ====================

export interface RecommendationValidation {
    valid: boolean;
    errors: string[];
}
