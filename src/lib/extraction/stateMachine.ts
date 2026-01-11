/**
 * Extraction State Machine
 * 
 * GAP 5: Track extraction status explicitly and block scoring on incomplete extraction.
 * GAP 6: Define minimum viable signals and confidence degradation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ==================== TYPES ====================

// Confidence level compatible with scoring gates
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

export type ExtractionStatus = 'pending' | 'complete' | 'partial' | 'failed';

export interface ExtractionState {
    id?: string;
    userId: string;
    creativeId: string;
    status: ExtractionStatus;
    extractedSignals: string[];
    missingSignals: string[];
    errorMessage?: string;
    retryCount: number;
    maxRetries: number;
    startedAt: Date;
    completedAt?: Date;
}

export interface SignalRequirement {
    name: string;
    required: boolean;
    confidenceImpact: number;  // Reduction if missing (0-30)
    category: 'timing' | 'audio' | 'visual' | 'metadata';
}

// ==================== SIGNAL REQUIREMENTS ====================

export const SIGNAL_REQUIREMENTS: SignalRequirement[] = [
    // REQUIRED - cannot score without these
    { name: 'duration', required: true, confidenceImpact: 0, category: 'metadata' },
    { name: 'hasAudio', required: true, confidenceImpact: 0, category: 'audio' },
    { name: 'aspectRatio', required: true, confidenceImpact: 0, category: 'visual' },

    // IMPORTANT - impacts scoring significantly
    { name: 'motionStartMs', required: false, confidenceImpact: 20, category: 'timing' },
    { name: 'cutCount', required: false, confidenceImpact: 15, category: 'visual' },

    // OPTIONAL - nice to have
    { name: 'textAppearanceMs', required: false, confidenceImpact: 10, category: 'timing' },
    { name: 'audioLevelLufs', required: false, confidenceImpact: 5, category: 'audio' },
    { name: 'frameRate', required: false, confidenceImpact: 5, category: 'metadata' }
];

export const REQUIRED_SIGNALS = SIGNAL_REQUIREMENTS
    .filter(s => s.required)
    .map(s => s.name);

export const OPTIONAL_SIGNALS = SIGNAL_REQUIREMENTS
    .filter(s => !s.required)
    .map(s => s.name);

// ==================== STATUS DETERMINATION ====================

/**
 * Determine extraction status based on what was extracted and what failed.
 */
export function determineExtractionStatus(
    extracted: string[],
    failed: string[]
): ExtractionStatus {
    const missingRequired = REQUIRED_SIGNALS.filter(
        s => !extracted.includes(s)
    );

    if (missingRequired.length > 0) {
        // Cannot proceed without required signals
        return failed.length > 0 ? 'failed' : 'pending';
    }

    const missingOptional = OPTIONAL_SIGNALS.filter(
        s => !extracted.includes(s)
    );

    if (missingOptional.length > 0) {
        return 'partial';
    }

    return 'complete';
}

// ==================== SCORING GUARDS ====================

export interface ExtractionScoringResult {
    allowed: boolean;
    maxConfidence: ConfidenceLevel;
    message: string;
}

/**
 * Check if scoring is allowed based on extraction state.
 */
export function canScoreWithExtraction(state: ExtractionState): ExtractionScoringResult {
    switch (state.status) {
        case 'complete':
            return {
                allowed: true,
                maxConfidence: 'high',
                message: ''
            };

        case 'partial':
            return {
                allowed: true,
                maxConfidence: 'low',  // Cap confidence
                message: 'Some structure signals could not be extracted. Confidence reduced.'
            };

        case 'pending':
            return {
                allowed: false,
                maxConfidence: 'insufficient',
                message: 'Extraction in progress. Please wait.'
            };

        case 'failed':
            return {
                allowed: false,
                maxConfidence: 'insufficient',
                message: 'Extraction failed. Click to retry.'
            };
    }
}

// ==================== CONFIDENCE CALCULATION ====================

export interface ConfidenceResult {
    confidence: ConfidenceLevel;
    reasons: string[];
}

/**
 * Calculate confidence with missing signal penalties.
 */
export function calculateConfidenceWithMissingSignals(
    baseConfidence: ConfidenceLevel,
    missingSignals: string[]
): ConfidenceResult {
    const reasons: string[] = [];
    let penaltyTotal = 0;

    for (const signal of missingSignals) {
        const req = SIGNAL_REQUIREMENTS.find(r => r.name === signal);
        if (req) {
            if (req.required) {
                // Should never happen - required signals block scoring
                return {
                    confidence: 'insufficient',
                    reasons: [`Required signal missing: ${signal}`]
                };
            }

            penaltyTotal += req.confidenceImpact;
            reasons.push(`${signal} unavailable (-${req.confidenceImpact}%)`);
        }
    }

    // Convert penalty to confidence level
    if (penaltyTotal >= 30) {
        return { confidence: 'low', reasons };
    }
    if (penaltyTotal >= 15 && baseConfidence === 'high') {
        return { confidence: 'medium', reasons };
    }

    return { confidence: baseConfidence, reasons };
}

// ==================== DATABASE OPERATIONS ====================

/**
 * Get extraction state for a creative.
 */
export async function getExtractionState(
    supabase: SupabaseClient,
    userId: string,
    creativeId: string
): Promise<ExtractionState | null> {
    const { data, error } = await supabase
        .from('extraction_jobs')
        .select('*')
        .eq('user_id', userId)
        .eq('creative_id', creativeId)
        .single();

    if (error || !data) return null;

    return {
        id: data.id,
        userId: data.user_id,
        creativeId: data.creative_id,
        status: data.status,
        extractedSignals: data.extracted_signals || [],
        missingSignals: data.missing_signals || [],
        errorMessage: data.error_message,
        retryCount: data.retry_count,
        maxRetries: data.max_retries,
        startedAt: new Date(data.started_at),
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    };
}

/**
 * Create or update extraction state.
 */
export async function upsertExtractionState(
    supabase: SupabaseClient,
    state: Omit<ExtractionState, 'id'>
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('extraction_jobs')
        .upsert({
            user_id: state.userId,
            creative_id: state.creativeId,
            status: state.status,
            extracted_signals: state.extractedSignals,
            missing_signals: state.missingSignals,
            error_message: state.errorMessage,
            retry_count: state.retryCount,
            max_retries: state.maxRetries,
            started_at: state.startedAt.toISOString(),
            completed_at: state.completedAt?.toISOString(),
        }, {
            onConflict: 'user_id,creative_id',
        });

    return { success: !error, error: error?.message };
}

/**
 * Mark extraction as complete with results.
 */
export async function completeExtraction(
    supabase: SupabaseClient,
    userId: string,
    creativeId: string,
    extractedSignals: string[],
    failedSignals: string[]
): Promise<{ success: boolean; status: ExtractionStatus }> {
    const status = determineExtractionStatus(extractedSignals, failedSignals);

    const { error } = await supabase
        .from('extraction_jobs')
        .update({
            status,
            extracted_signals: extractedSignals,
            missing_signals: failedSignals,
            completed_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('creative_id', creativeId);

    return { success: !error, status };
}

/**
 * Request retry for failed extraction.
 */
export async function retryExtraction(
    supabase: SupabaseClient,
    userId: string,
    creativeId: string
): Promise<{ success: boolean; error?: string }> {
    const state = await getExtractionState(supabase, userId, creativeId);

    if (!state) {
        return { success: false, error: 'Extraction job not found' };
    }

    if (state.status !== 'failed') {
        return { success: false, error: 'Can only retry failed extractions' };
    }

    if (state.retryCount >= state.maxRetries) {
        return { success: false, error: 'Maximum retries exceeded. Contact support.' };
    }

    const { error } = await supabase
        .from('extraction_jobs')
        .update({
            status: 'pending',
            retry_count: state.retryCount + 1,
            error_message: null,
            started_at: new Date().toISOString(),
            completed_at: null,
        })
        .eq('user_id', userId)
        .eq('creative_id', creativeId);

    return { success: !error, error: error?.message };
}
