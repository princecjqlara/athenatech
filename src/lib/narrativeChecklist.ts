/**
 * Narrative System (System 2) - Structured Checklist Model
 * 
 * CORE RULE: Users describe what exists and where.
 *            The system decides what to test next.
 * 
 * This system ONLY activates when:
 *   - Structure System (Delivery) = Healthy
 *   - Conversion Owner = Bad/Weak
 * 
 * NEVER ask:
 *   - "What emotion does this ad use?"
 *   - "Is this hook strong?"
 *   - "Why do you think this works?"
 *   - "What audience pain is targeted?"
 */

// ==================== TYPE DEFINITIONS ====================

/**
 * Layer 1: Structured Checklist (Primary Input)
 * Binary and positional inputs ONLY - no subjective fields
 * 
 * PHASE 1 UPDATE: Replaced semi-subjective fields with atomic alternatives:
 * - ctaExplicit → ctaHasActionVerb + ctaHasOutcome
 * - valuePropositionPresent → benefitStated + benefitQuantified + timeToBenefitStated
 */
export interface NarrativeChecklist {
    // === CTA Atomic Fields (replaces ctaExplicit) ===
    ctaPresent: boolean;               // Is there a call-to-action?
    ctaHasActionVerb: boolean;         // CTA contains action verb (Buy, Get, Start, etc.)
    ctaHasOutcome: boolean;            // CTA states what user gets after clicking
    ctaHasUrgency?: boolean;           // Optional: "Today", "Now", "Limited" (textual only)

    // === Value Proposition Atomic Fields (replaces valuePropositionPresent) ===
    benefitStated: boolean;            // Any specific benefit mentioned
    benefitQuantified: boolean;        // Benefit has numbers ("Save $50", "2x faster")
    timeToBenefitStated: boolean;      // Time to achieve benefit stated ("In 30 days", "Instant")
    valueTiming: 'opening' | 'middle' | 'end' | 'not_present';  // When does value appear?

    // === Offer Fields ===
    offerPresent: boolean;             // Is there a specific offer?
    offerTiming: 'early' | 'mid' | 'late' | 'not_shown';        // When does offer appear?

    // === Other Observable Fields ===
    proofPresent: boolean;             // Is there social proof / testimonial?
    pricingVisible: boolean;           // Is pricing shown?
    guaranteeMentioned: boolean;       // Is a guarantee/risk-reversal mentioned?

    // === Alignment (hard-walled: NEVER used for delivery scoring) ===
    adLpMatch: 'yes' | 'unsure' | 'no';  // Ad promise matches LP headline?
    // NOTE: This field is ONLY used when deliveryHealth === 'healthy' && conversionHealth === 'bad'

    // === Metadata ===
    userConfirmed: boolean;            // User reviewed and confirmed
    llmAssisted: boolean;              // Was LLM used to prefill?
    lastUpdated?: Date;
}

/**
 * Layer 3: Free-Text Notes (NOT USED FOR SCORING)
 */
export interface NarrativeNotes {
    content: string;
    // Explicit flag to remind system to ignore
    usedForScoring: false;
}

/**
 * Complete Narrative Input
 */
export interface NarrativeInput {
    checklist: NarrativeChecklist;
    notes?: NarrativeNotes;
}

/**
 * Eligibility state for System 2
 */
export type NarrativeEligibility =
    | { eligible: true; reason: 'delivery_healthy_conversion_bad' }
    | { eligible: false; reason: 'delivery_unhealthy' | 'conversion_healthy' | 'insufficient_data' | 'insufficient_conversions' };

/**
 * Diagnostic output from System 2
 */
export interface NarrativeDiagnostic {
    findings: string[];           // Factual observations
    suggestions: string[];        // What to test next
    primaryGap?: NarrativeGap;    // Main issue identified
    confidence: 'high' | 'medium' | 'low';
}

export type NarrativeGap =
    | 'value_timing'          // Value appears too late
    | 'offer_timing'          // Offer appears too late or missing
    | 'missing_proof'         // No social proof
    | 'unclear_cta'           // CTA not explicit
    | 'no_pricing'            // Pricing hidden
    | 'ad_lp_mismatch'        // Ad/LP misalignment
    | 'missing_guarantee'     // No risk reversal
    | 'none';                 // No obvious gap

// ==================== DEFAULT VALUES ====================

export const defaultChecklist: NarrativeChecklist = {
    // CTA atomic fields
    ctaPresent: false,
    ctaHasActionVerb: false,
    ctaHasOutcome: false,
    ctaHasUrgency: false,

    // Value proposition atomic fields
    benefitStated: false,
    benefitQuantified: false,
    timeToBenefitStated: false,
    valueTiming: 'not_present',

    // Offer fields
    offerPresent: false,
    offerTiming: 'not_shown',

    // Other observable fields
    proofPresent: false,
    pricingVisible: false,
    guaranteeMentioned: false,

    // Alignment (hard-walled)
    adLpMatch: 'unsure',

    // Metadata
    userConfirmed: false,
    llmAssisted: false,
};

// ==================== ELIGIBILITY CHECK ====================

import { GATE_CONFIG } from './config/gates';

/**
 * Check if System 2 should be active
 * 
 * Requirements:
 * - Delivery must be healthy
 * - Conversion must be bad (not good, not insufficient)
 * - Must have ≥30 conversions for sufficient signal
 */
export function checkNarrativeEligibility(
    deliveryHealth: 'healthy' | 'risky' | 'poor',
    conversionHealth: 'good' | 'bad' | 'insufficient',
    totalConversions: number = 0  // REQUIRED: Must pass conversion count
): NarrativeEligibility {
    // Only activate when delivery is healthy but conversion is weak
    if (deliveryHealth !== 'healthy') {
        return { eligible: false, reason: 'delivery_unhealthy' };
    }

    if (conversionHealth === 'good') {
        return { eligible: false, reason: 'conversion_healthy' };
    }

    if (conversionHealth === 'insufficient') {
        return { eligible: false, reason: 'insufficient_data' };
    }

    // NEW: Check minimum conversions threshold
    if (totalConversions < GATE_CONFIG.NARRATIVE_MIN_CONVERSIONS) {
        return { eligible: false, reason: 'insufficient_conversions' };
    }

    // Delivery healthy + Conversion bad + ≥30 conversions = System 2 active
    return { eligible: true, reason: 'delivery_healthy_conversion_bad' };
}

/**
 * Get user-friendly eligibility message
 */
export function getEligibilityMessage(eligibility: NarrativeEligibility): string {
    if (eligibility.eligible) {
        return 'Delivery is healthy but conversion is underperforming. Help us understand the message structure.';
    }

    switch (eligibility.reason) {
        case 'delivery_unhealthy':
            return '⚙️ Fix structure first. Message analysis is only useful when delivery is healthy.';
        case 'conversion_healthy':
            return '✅ No message issues detected. Conversion is performing well.';
        case 'insufficient_data':
            return '📊 Insufficient data. Gather more conversions before analyzing message structure.';
        case 'insufficient_conversions':
            return '📊 Need ≥30 conversions for reliable message analysis. Keep running.';
        default:
            return 'System 2 is not available.';
    }
}

// ==================== DIAGNOSTIC LOGIC ====================

/**
 * Analyze checklist and generate diagnostic
 * 
 * This produces FACTUAL observations, not interpretations.
 * Example: "Offer is present but introduced late."
 * NOT: "This offer isn't compelling."
 */
export function diagnoseNarrative(checklist: NarrativeChecklist): NarrativeDiagnostic {
    const findings: string[] = [];
    const suggestions: string[] = [];
    let primaryGap: NarrativeGap = 'none';

    // Check value proposition using atomic fields
    if (!checklist.benefitStated) {
        findings.push('No specific benefit is stated.');
        suggestions.push('Add a clear benefit statement early in the creative.');
        primaryGap = 'value_timing';
    } else {
        // Benefit is stated, check for improvements
        if (!checklist.benefitQuantified) {
            findings.push('Benefit is stated but not quantified.');
            suggestions.push('Test adding specific numbers to the benefit (e.g., "Save 50%", "2x faster").');
        }
        if (!checklist.timeToBenefitStated) {
            findings.push('Time to achieve benefit is not stated.');
            suggestions.push('Test adding timeframe (e.g., "Results in 30 days", "Instant access").');
        }
        if (checklist.valueTiming !== 'opening') {
            findings.push(`Value proposition appears in ${checklist.valueTiming} section.`);
            suggestions.push('Test moving value proposition to opening (0-3s).');
            if (primaryGap === 'none') primaryGap = 'value_timing';
        }
    }

    // Check offer
    if (!checklist.offerPresent) {
        findings.push('No specific offer is present.');
        suggestions.push('Add a clear offer with specific benefit.');
        if (primaryGap === 'none') primaryGap = 'offer_timing';
    } else if (checklist.offerTiming === 'late' || checklist.offerTiming === 'not_shown') {
        findings.push(`Offer appears ${checklist.offerTiming === 'not_shown' ? 'not shown' : 'late'} in the creative.`);
        suggestions.push('Test introducing offer earlier.');
        if (primaryGap === 'none') primaryGap = 'offer_timing';
    }

    // Check proof
    if (!checklist.proofPresent) {
        findings.push('No social proof or testimonial present.');
        suggestions.push('Add social proof (reviews, testimonials, results).');
        if (primaryGap === 'none') primaryGap = 'missing_proof';
    }

    // Check CTA clarity using atomic fields
    if (!checklist.ctaPresent) {
        findings.push('No call-to-action present.');
        suggestions.push('Add explicit CTA with action verb + expected outcome.');
        if (primaryGap === 'none') primaryGap = 'unclear_cta';
    } else {
        // CTA is present, check atomic components
        const ctaIssues: string[] = [];
        if (!checklist.ctaHasActionVerb) {
            ctaIssues.push('missing action verb');
        }
        if (!checklist.ctaHasOutcome) {
            ctaIssues.push('missing outcome');
        }
        if (ctaIssues.length > 0) {
            findings.push(`CTA is present but ${ctaIssues.join(' and ')}.`);
            if (!checklist.ctaHasActionVerb) {
                suggestions.push('Add action verb to CTA (Buy, Get, Start, Try, etc.).');
            }
            if (!checklist.ctaHasOutcome) {
                suggestions.push('Add outcome to CTA (what user gets after clicking).');
            }
            if (primaryGap === 'none') primaryGap = 'unclear_cta';
        }
    }

    // Check pricing visibility
    if (!checklist.pricingVisible) {
        findings.push('Pricing is not visible in the creative.');
        suggestions.push('Test showing pricing to qualify leads earlier.');
        if (primaryGap === 'none') primaryGap = 'no_pricing';
    }

    // Check guarantee
    if (!checklist.guaranteeMentioned) {
        findings.push('No guarantee or risk-reversal mentioned.');
        suggestions.push('Add guarantee to reduce purchase friction.');
        if (primaryGap === 'none') primaryGap = 'missing_guarantee';
    }

    // Check ad/LP alignment
    if (checklist.adLpMatch === 'no') {
        findings.push('Ad promise does NOT match landing page headline.');
        suggestions.push('Align ad copy with landing page headline.');
        if (primaryGap === 'none') primaryGap = 'ad_lp_mismatch';
    } else if (checklist.adLpMatch === 'unsure') {
        findings.push('Ad/landing page alignment is uncertain.');
        suggestions.push('Review landing page to ensure message continuity.');
    }

    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (checklist.userConfirmed) {
        confidence = findings.length > 3 ? 'high' : 'medium';
    }

    // CONFIDENCE PENALTY: LLM-assisted but not user confirmed
    // This ensures AI-prefilled data doesn't get high confidence without review
    if (checklist.llmAssisted && !checklist.userConfirmed) {
        confidence = 'low';  // Force low confidence
        findings.unshift('⚠️ AI-prefilled data not yet confirmed by user.');
    }

    return {
        findings,
        suggestions,
        primaryGap,
        confidence,
    };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get readable label for timing
 */
export function getTimingLabel(timing: string): string {
    const labels: Record<string, string> = {
        opening: '🎬 Opening (0-3s)',
        middle: '📍 Middle',
        end: '🎯 End',
        not_present: '❌ Not Present',
        early: '⏱️ Early',
        mid: '📍 Mid',
        late: '⏳ Late',
        not_shown: '❌ Not Shown',
    };
    return labels[timing] || timing;
}

/**
 * Get readable label for gap type
 */
export function getGapLabel(gap: NarrativeGap): string {
    const labels: Record<NarrativeGap, string> = {
        value_timing: '💡 Value Timing',
        offer_timing: '🎁 Offer Timing',
        missing_proof: '⭐ Missing Proof',
        unclear_cta: '👆 Unclear CTA',
        no_pricing: '💰 No Pricing',
        ad_lp_mismatch: '🔗 Ad/LP Mismatch',
        missing_guarantee: '🛡️ Missing Guarantee',
        none: '✅ No Issues',
    };
    return labels[gap];
}

/**
 * Calculate checklist completion percentage
 */
export function getChecklistCompletion(checklist: NarrativeChecklist): number {
    const fields = [
        // CTA atomic fields
        checklist.ctaPresent !== undefined,
        checklist.ctaHasActionVerb !== undefined,
        checklist.ctaHasOutcome !== undefined,
        // Value proposition atomic fields
        checklist.benefitStated !== undefined,
        checklist.benefitQuantified !== undefined,
        checklist.timeToBenefitStated !== undefined,
        checklist.valueTiming !== undefined,
        // Offer fields
        checklist.offerPresent !== undefined,
        checklist.offerTiming !== undefined,
        // Other observable fields
        checklist.proofPresent !== undefined,
        checklist.pricingVisible !== undefined,
        checklist.guaranteeMentioned !== undefined,
        // Alignment
        checklist.adLpMatch !== undefined,
    ];

    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

