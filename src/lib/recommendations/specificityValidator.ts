/**
 * Recommendation Specificity Validator
 * 
 * Enforces that all recommendations meet specificity requirements:
 * - What to change (specific, not vague)
 * - Target range (includes numbers)
 * - Observable gap (cites measurement)
 * - Metric to watch (valid metric name)
 * - Run duration (3-30 days)
 * 
 * This prevents vague advice like "test stronger offer".
 */

import type {
    CreateRecommendationInput,
    RecommendationType,
    RecommendationValidation
} from '../types/recommendations';

// ==================== VALIDATION ====================

/**
 * Validate a recommendation meets specificity requirements.
 * Returns validation result with errors if any.
 */
export function validateRecommendation(
    rec: Partial<CreateRecommendationInput>
): RecommendationValidation {
    const errors: string[] = [];

    // whatToChange: Required, 10+ chars, no vague phrases
    if (!rec.whatToChange || rec.whatToChange.length < 10) {
        errors.push('whatToChange must be specific (10+ characters)');
    } else {
        const vagueCheck = checkVaguePhrases(rec.whatToChange);
        if (vagueCheck) {
            errors.push(vagueCheck);
        }
    }

    // targetRange: Required, must include a number or range
    if (!rec.targetRange || !/\d/.test(rec.targetRange)) {
        errors.push('targetRange must include a number or range (e.g., "0-3s", "20%")');
    }

    // observableGap: Required, 10+ chars
    if (!rec.observableGap || rec.observableGap.length < 10) {
        errors.push('observableGap must cite a specific measurement');
    }

    // metricToWatch: Required, must include valid metric
    const validMetrics = ['CTR', 'CPA', 'ROAS', 'CVR', 'CPM', 'thumbstop', 'hook_rate', 'view_rate'];
    if (!rec.metricToWatch || !validMetrics.some(m => rec.metricToWatch?.toUpperCase().includes(m.toUpperCase()))) {
        errors.push(`metricToWatch must include one of: ${validMetrics.join(', ')}`);
    }

    // runDurationDays: Required, 3-30 range
    if (!rec.runDurationDays || rec.runDurationDays < 3 || rec.runDurationDays > 30) {
        errors.push('runDurationDays must be between 3 and 30');
    }

    // confidence: Required, valid value
    if (!rec.confidence || !['high', 'medium', 'low'].includes(rec.confidence)) {
        errors.push('confidence must be high, medium, or low');
    }

    // sourceSystem: Required
    if (!rec.sourceSystem) {
        errors.push('sourceSystem is required');
    }

    // recommendationType: Required
    if (!rec.recommendationType) {
        errors.push('recommendationType is required');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Check for vague phrases that should not appear in recommendations.
 */
function checkVaguePhrases(text: string): string | null {
    const vaguePhrases = [
        { phrase: 'stronger', replacement: 'specify what change makes it stronger' },
        { phrase: 'better', replacement: 'specify what aspect to improve' },
        { phrase: 'improve', replacement: 'specify what metric and by how much' },
        { phrase: 'optimize', replacement: 'specify what to optimize and target' },
        { phrase: 'enhance', replacement: 'specify what enhancement' },
        { phrase: 'more engaging', replacement: 'specify what engagement metric' },
        { phrase: 'more compelling', replacement: 'specify what makes it compelling' },
    ];

    const lowerText = text.toLowerCase();
    for (const { phrase, replacement } of vaguePhrases) {
        if (lowerText.includes(phrase)) {
            return `"${phrase}" is too vague - ${replacement}`;
        }
    }

    return null;
}

// ==================== TEMPLATES ====================

/**
 * Recommendation templates with required specificity fields.
 * Use these to generate well-formed recommendations.
 */
export const RECOMMENDATION_TEMPLATES: Record<RecommendationType, {
    targetRangeTemplate: string;
    metricToWatch: string;
    runDurationDays: number;
    whatToChangeExample: string;
    observableGapExample: string;
}> = {
    // Structure system
    motion_timing: {
        targetRangeTemplate: '0-0.5s (currently {current}s)',
        metricToWatch: 'thumbstop, hook_rate',
        runDurationDays: 7,
        whatToChangeExample: 'Add motion in the first 0.5 seconds',
        observableGapExample: 'Motion currently starts at {current}s',
    },
    cut_density: {
        targetRangeTemplate: '{target} cuts in first 3s (currently {current})',
        metricToWatch: 'thumbstop, view_rate',
        runDurationDays: 7,
        whatToChangeExample: 'Add 2-3 scene cuts in the first 3 seconds',
        observableGapExample: 'First 3 seconds have {current} cuts',
    },
    text_appearance: {
        targetRangeTemplate: '0-1s (currently {current}s)',
        metricToWatch: 'CTR, thumbstop',
        runDurationDays: 7,
        whatToChangeExample: 'Show key text within first 1 second',
        observableGapExample: 'Text first appears at {current}s',
    },
    aspect_ratio: {
        targetRangeTemplate: '{target} aspect ratio for {placement}',
        metricToWatch: 'CTR, CPM',
        runDurationDays: 7,
        whatToChangeExample: 'Create 9:16 version for Reels placement',
        observableGapExample: 'Using {current} aspect ratio in {placement}',
    },
    opening_hook: {
        targetRangeTemplate: 'First frame motion + text within 0.5s',
        metricToWatch: 'thumbstop, hook_rate',
        runDurationDays: 7,
        whatToChangeExample: 'Redesign opening to start with motion and text',
        observableGapExample: 'Opening has {current} static frame',
    },
    audio_levels: {
        targetRangeTemplate: '-14 to -10 LUFS (currently {current})',
        metricToWatch: 'view_rate, thumbstop',
        runDurationDays: 7,
        whatToChangeExample: 'Normalize audio to broadcast standard levels',
        observableGapExample: 'Audio levels are {current} LUFS',
    },

    // Narrative system
    value_timing: {
        targetRangeTemplate: '0-3s (currently in {current} segment)',
        metricToWatch: 'CTR, CVR',
        runDurationDays: 7,
        whatToChangeExample: 'Move value proposition to opening 0-3s',
        observableGapExample: 'Value proposition appears in {current} segment',
    },
    offer_timing: {
        targetRangeTemplate: 'Before 5s (currently at {current}s)',
        metricToWatch: 'CVR, CPA',
        runDurationDays: 7,
        whatToChangeExample: 'Introduce offer within first 5 seconds',
        observableGapExample: 'Offer appears at {current}s',
    },
    cta_clarity: {
        targetRangeTemplate: 'Action verb + specific outcome',
        metricToWatch: 'CTR, CVR',
        runDurationDays: 7,
        whatToChangeExample: 'Change CTA to "Get your free guide now"',
        observableGapExample: 'Current CTA "{current}" lacks specific outcome',
    },
    proof_addition: {
        targetRangeTemplate: 'Add {type} social proof',
        metricToWatch: 'CVR, CPA',
        runDurationDays: 10,
        whatToChangeExample: 'Add customer testimonial or review',
        observableGapExample: 'No social proof present in creative',
    },
    pricing_visibility: {
        targetRangeTemplate: 'Show price before 10s',
        metricToWatch: 'CVR, lead quality',
        runDurationDays: 10,
        whatToChangeExample: 'Display pricing to qualify leads earlier',
        observableGapExample: 'Price not visible in creative',
    },
    guarantee_addition: {
        targetRangeTemplate: 'Add {type} guarantee (e.g., 30-day)',
        metricToWatch: 'CVR, CPA',
        runDurationDays: 10,
        whatToChangeExample: 'Add money-back guarantee to reduce purchase friction',
        observableGapExample: 'No risk-reversal or guarantee mentioned',
    },
    ad_lp_alignment: {
        targetRangeTemplate: 'Match ad headline to LP headline exactly',
        metricToWatch: 'CVR, bounce rate',
        runDurationDays: 14,
        whatToChangeExample: 'Update LP headline to match ad promise',
        observableGapExample: 'Ad says "{ad}" but LP says "{lp}"',
    },

    // Conversion system
    landing_page: {
        targetRangeTemplate: 'Load time <3s, headline matches ad',
        metricToWatch: 'page_view → conversion rate',
        runDurationDays: 14,
        whatToChangeExample: 'Reduce landing page load time to under 3 seconds',
        observableGapExample: 'Current load time is {current}s',
    },
    checkout_flow: {
        targetRangeTemplate: 'Reduce to {target} steps (currently {current})',
        metricToWatch: 'checkout → purchase rate',
        runDurationDays: 14,
        whatToChangeExample: 'Simplify checkout to 2 steps',
        observableGapExample: 'Current checkout has {current} steps',
    },
    offer_strength: {
        targetRangeTemplate: 'Add {type} incentive (e.g., 15-20% discount)',
        metricToWatch: 'CVR, CPA, ROAS',
        runDurationDays: 14,
        whatToChangeExample: 'Test adding 20% discount for first purchase',
        observableGapExample: 'No discount or limited-time offer present',
    },
    tracking_fix: {
        targetRangeTemplate: 'Verify {event} fires correctly',
        metricToWatch: 'conversion count, event match rate',
        runDurationDays: 7,
        whatToChangeExample: 'Check that Purchase event fires on thank you page',
        observableGapExample: 'Conversion drop detected ({percent}% decline)',
    },
    audience_refresh: {
        targetRangeTemplate: 'Expand to {target} audience or refresh lookalike',
        metricToWatch: 'CTR, frequency, CPM',
        runDurationDays: 10,
        whatToChangeExample: 'Refresh 1% lookalike audience based on recent purchasers',
        observableGapExample: 'Frequency at {current}, CTR declining',
    },
    budget_adjustment: {
        targetRangeTemplate: '{action} budget by {percent}%',
        metricToWatch: 'CPA, ROAS',
        runDurationDays: 7,
        whatToChangeExample: 'Reduce budget by 30% to stabilize CPA',
        observableGapExample: 'CPA spiked {percent}% above baseline',
    },
};

// ==================== BUILDER ====================

/**
 * Build a recommendation using a template.
 * Fills in placeholders with actual values.
 */
export function buildRecommendation(
    type: RecommendationType,
    values: Record<string, string | number>,
    sourceSystem: 'structure' | 'narrative' | 'conversion',
    confidence: 'high' | 'medium' | 'low'
): CreateRecommendationInput {
    const template = RECOMMENDATION_TEMPLATES[type];

    const fillPlaceholders = (text: string): string => {
        let result = text;
        for (const [key, value] of Object.entries(values)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
        return result;
    };

    return {
        sourceSystem,
        recommendationType: type,
        recommendationText: fillPlaceholders(template.whatToChangeExample),
        whatToChange: fillPlaceholders(template.whatToChangeExample),
        targetRange: fillPlaceholders(template.targetRangeTemplate),
        observableGap: fillPlaceholders(template.observableGapExample),
        metricToWatch: template.metricToWatch,
        runDurationDays: template.runDurationDays,
        confidence,
    };
}
