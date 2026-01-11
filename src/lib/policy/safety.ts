/**
 * Safety Policy Enforcement
 * 
 * Runtime checks for forbidden semantic patterns.
 * Used by CI and code review to prevent policy violations.
 */

// ==================== FORBIDDEN TERMS ====================

/**
 * Terms that indicate semantic/interpretive analysis.
 * These MUST NOT appear in System 1 (Structure) code.
 */
export const FORBIDDEN_TERMS = [
    // Emotion/Sentiment
    'emotion',
    'sentiment',
    'mood',
    'feeling',
    'tone',

    // Face/Person
    'face_detection',
    'facial_expression',
    'person_recognition',
    'face_recognition',

    // Object Semantics
    'object_meaning',
    'product_inference',
    'scene_understanding',
    'object_detection',

    // Text Meaning
    'ocr_content_analysis',
    'text_sentiment',
    'message_strength',
    'text_meaning',

    // Quality Judgments
    'hook_strength',
    'engagement_score',
    'persuasiveness',
    'effectiveness_score',
    'quality_score',
    'appeal_score',

    // Trait Inference
    'trait_inference',
    'personality_detection',
    'demographic_inference',
    'audience_inference',

    // Aesthetic Scoring
    'beauty_score',
    'visual_appeal',
    'design_quality',
    'aesthetic_rating',
] as const;

export type ForbiddenTerm = typeof FORBIDDEN_TERMS[number];

// ==================== ALLOWED MECHANICAL TERMS ====================

/**
 * Terms that are explicitly allowed in System 1.
 * These represent purely mechanical measurements.
 */
export const ALLOWED_MECHANICAL_TERMS = [
    'motionStartMs',
    'textAppearanceMs',
    'cutCount',
    'audioLevelLufs',
    'aspectRatio',
    'duration',
    'hasAudio',
    'frameRate',
    'firstFrameHash',
    'colorHistogram',
    'brightness',
    'contrast',
] as const;

// ==================== VALIDATION ====================

export interface SafetyViolation {
    term: string;
    context: string;
    line?: number;
}

/**
 * Check code/text for forbidden terms.
 * Returns list of violations found.
 */
export function checkForbiddenTerms(
    code: string,
    options?: { caseSensitive?: boolean }
): SafetyViolation[] {
    const violations: SafetyViolation[] = [];
    const searchCode = options?.caseSensitive ? code : code.toLowerCase();

    for (const term of FORBIDDEN_TERMS) {
        const searchTerm = options?.caseSensitive ? term : term.toLowerCase();
        let index = searchCode.indexOf(searchTerm);

        while (index !== -1) {
            // Get surrounding context
            const start = Math.max(0, index - 30);
            const end = Math.min(code.length, index + term.length + 30);
            const context = code.substring(start, end);

            // Calculate line number
            const lineNumber = code.substring(0, index).split('\n').length;

            violations.push({
                term,
                context: `...${context}...`,
                line: lineNumber,
            });

            // Find next occurrence
            index = searchCode.indexOf(searchTerm, index + 1);
        }
    }

    return violations;
}

/**
 * Quick check if any forbidden terms exist.
 */
export function hasForbiddenTerms(code: string): boolean {
    const lowerCode = code.toLowerCase();
    return FORBIDDEN_TERMS.some(term => lowerCode.includes(term.toLowerCase()));
}

/**
 * Validate that a feature name is allowed.
 */
export function isAllowedFeature(featureName: string): boolean {
    const lower = featureName.toLowerCase();

    // Check if it matches any forbidden pattern
    for (const term of FORBIDDEN_TERMS) {
        if (lower.includes(term.toLowerCase())) {
            return false;
        }
    }

    return true;
}

// ==================== SYSTEM BOUNDARIES ====================

/**
 * System 1 (Structure) allowed imports.
 * System 1 MUST NOT import from narrative or conversion scoring.
 */
export const SYSTEM_1_ALLOWED_IMPORTS = [
    '@/lib/structure',
    '@/lib/config',
    '@/lib/types',
    '@/lib/utils',
] as const;

/**
 * System 2 (Narrative) allowed imports.
 */
export const SYSTEM_2_ALLOWED_IMPORTS = [
    '@/lib/narrative',
    '@/lib/config',
    '@/lib/types',
    '@/lib/utils',
    // Can read structure OUTPUT but not internal scoring
] as const;

/**
 * Check if an import is allowed for a given system.
 */
export function isImportAllowed(
    importPath: string,
    system: 'structure' | 'narrative' | 'conversion'
): boolean {
    const forbidden: Record<string, string[]> = {
        structure: ['@/lib/narrative', '@/lib/conversion'],
        narrative: ['@/lib/structure/scoring'],  // Can use structure types but not scoring internals
        conversion: [],  // Conversion can import from anywhere
    };

    return !forbidden[system].some(path => importPath.startsWith(path));
}

// ==================== LLM OUTPUT VALIDATION ====================

/**
 * Allowed keys in LLM output for System 2 checklist.
 */
export const ALLOWED_LLM_OUTPUT_KEYS = [
    'ctaPresent',
    'ctaHasActionVerb',
    'ctaHasOutcome',
    'ctaHasUrgency',
    'benefitStated',
    'benefitQuantified',
    'timeToBenefitStated',
    'valueTiming',
    'offerPresent',
    'offerTiming',
    'proofPresent',
    'pricingVisible',
    'guaranteeMentioned',
    'adLpMatch',
] as const;

/**
 * Validate LLM output contains only allowed keys.
 * Throws on extra or forbidden keys.
 */
export function validateLlmOutput(output: Record<string, unknown>): void {
    const allowedSet = new Set(ALLOWED_LLM_OUTPUT_KEYS);
    const outputKeys = Object.keys(output);

    for (const key of outputKeys) {
        if (!allowedSet.has(key as typeof ALLOWED_LLM_OUTPUT_KEYS[number])) {
            throw new Error(`LLM output contains forbidden key: "${key}". Only allowed keys: ${ALLOWED_LLM_OUTPUT_KEYS.join(', ')}`);
        }
    }

    // Check for forbidden terms in string values
    for (const [key, value] of Object.entries(output)) {
        if (typeof value === 'string' && hasForbiddenTerms(value)) {
            throw new Error(`LLM output value for "${key}" contains forbidden semantic terms.`);
        }
    }
}
