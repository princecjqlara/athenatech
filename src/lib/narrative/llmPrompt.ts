/**
 * LLM Prompt for Narrative System (System 2)
 * 
 * CONSTRAINTS:
 * - ONLY extract presence/absence/position
 * - NO quality judgments
 * - NO interpretation of meaning
 * - Output MUST match exact JSON schema
 */

import { ALLOWED_LLM_OUTPUT_KEYS, validateLlmOutput } from '../policy/safety';

// ==================== CONSTRAINED PROMPT ====================

export const NARRATIVE_LLM_SYSTEM_PROMPT = `You are a factual extraction assistant for advertising creatives.

YOUR ONLY JOB: Extract OBSERVABLE FACTS about what exists and where it appears.

RULES:
1. Answer ONLY in JSON format matching the exact schema provided
2. Answer based on what you can OBSERVE, not what you infer
3. Do NOT judge quality, strength, or effectiveness
4. Do NOT interpret emotional appeal or persuasiveness
5. Return ONLY the fields in the schema - extra fields cause hard failure

FORBIDDEN TERMS (never use in output):
- "strong", "weak", "effective", "persuasive", "compelling"
- "hook_strength", "engagement_score", "emotion", "sentiment"
- Any quality judgment or prediction

IF UNCERTAIN: Use null or the default value, never guess.`;

export const NARRATIVE_LLM_USER_PROMPT = `Extract the following OBSERVABLE FACTS from this creative:

SCHEMA (JSON only, no extra fields):
{
  "ctaPresent": boolean,           // Is there a call-to-action?
  "ctaHasActionVerb": boolean,     // Does CTA contain Buy/Get/Start/Try/Learn/etc?
  "ctaHasOutcome": boolean,        // Does CTA state what user gets after clicking?
  "ctaHasUrgency": boolean,        // Does CTA contain "Now/Today/Limited/etc"?
  "benefitStated": boolean,        // Is any specific benefit mentioned?
  "benefitQuantified": boolean,    // Does benefit have numbers ("Save $50", "2x faster")?
  "timeToBenefitStated": boolean,  // Is time to achieve benefit stated ("In 30 days")?
  "valueTiming": "opening"|"middle"|"end"|"not_present",  // When does value appear?
  "offerPresent": boolean,         // Is there a specific offer?
  "offerTiming": "early"|"mid"|"late"|"not_shown",        // When does offer appear?
  "proofPresent": boolean,         // Is there social proof or testimonial?
  "pricingVisible": boolean,       // Is pricing shown?
  "guaranteeMentioned": boolean,   // Is a guarantee or risk-reversal mentioned?
  "adLpMatch": "yes"|"no"|"unsure" // Does ad headline match LP headline? (if LP visible)
}

CREATIVE CONTENT:
---
{creative_content}
---

Return ONLY the JSON object. No explanation, no extra text.`;

// ==================== SCHEMA VALIDATION ====================

export interface NarrativeLlmOutput {
    ctaPresent: boolean;
    ctaHasActionVerb: boolean;
    ctaHasOutcome: boolean;
    ctaHasUrgency: boolean;
    benefitStated: boolean;
    benefitQuantified: boolean;
    timeToBenefitStated: boolean;
    valueTiming: 'opening' | 'middle' | 'end' | 'not_present';
    offerPresent: boolean;
    offerTiming: 'early' | 'mid' | 'late' | 'not_shown';
    proofPresent: boolean;
    pricingVisible: boolean;
    guaranteeMentioned: boolean;
    adLpMatch: 'yes' | 'no' | 'unsure';
}

/**
 * Parse and validate LLM output.
 * Throws on invalid or extra fields.
 */
export function parseLlmOutput(rawOutput: string): NarrativeLlmOutput {
    // Extract JSON from response (handles markdown code blocks)
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('LLM output does not contain valid JSON');
    }

    let parsed: Record<string, unknown>;
    try {
        parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
        throw new Error(`Failed to parse LLM JSON: ${e}`);
    }

    // Validate using safety policy (throws on extra/forbidden keys)
    validateLlmOutput(parsed);

    // Type-check required fields
    const required: (keyof NarrativeLlmOutput)[] = [
        'ctaPresent', 'ctaHasActionVerb', 'ctaHasOutcome',
        'benefitStated', 'benefitQuantified', 'timeToBenefitStated',
        'valueTiming', 'offerPresent', 'offerTiming',
        'proofPresent', 'pricingVisible', 'guaranteeMentioned', 'adLpMatch'
    ];

    for (const key of required) {
        if (parsed[key] === undefined) {
            throw new Error(`LLM output missing required field: ${key}`);
        }
    }

    return parsed as NarrativeLlmOutput;
}

/**
 * Build prompt with creative content inserted.
 */
export function buildNarrativePrompt(creativeContent: string): {
    systemPrompt: string;
    userPrompt: string;
} {
    return {
        systemPrompt: NARRATIVE_LLM_SYSTEM_PROMPT,
        userPrompt: NARRATIVE_LLM_USER_PROMPT.replace('{creative_content}', creativeContent),
    };
}
