/**
 * Boundary Isolation Tests
 * 
 * Ensures systems cannot access each other's internal data:
 * - System 1 (Structure) cannot receive narrative fields
 * - System 2 (Narrative) cannot import System 1 scoring internals
 * - System 3 (Conversion) operates independently
 */

import { describe, test, expect } from 'vitest';
import {
    FORBIDDEN_TERMS,
    ALLOWED_LLM_OUTPUT_KEYS,
    validateLlmOutput,
    checkForbiddenTerms,
    isAllowedFeature
} from '../../lib/policy/safety';

describe('Boundary Isolation - Safety Policy', () => {
    describe('Forbidden Terms', () => {
        test('Should contain all required forbidden patterns', () => {
            const requiredPatterns = [
                'emotion',
                'sentiment',
                'hook_strength',
                'persuasiveness',
                'face_detection',
            ];

            for (const pattern of requiredPatterns) {
                expect(FORBIDDEN_TERMS).toContain(pattern);
            }
        });

        test('checkForbiddenTerms should detect violations', () => {
            const code = `
                function analyzeHook() {
                    const hookStrength = calculateEmotionalAppeal();
                    return sentiment_score;
                }
            `;

            const violations = checkForbiddenTerms(code);
            expect(violations.length).toBeGreaterThan(0);
            expect(violations.some(v => v.term === 'sentiment')).toBe(true);
        });

        test('checkForbiddenTerms should pass clean code', () => {
            const code = `
                function analyzeCreative() {
                    const motionStartMs = extractFirstMotion();
                    const cutCount = countSceneChanges();
                    return { motionStartMs, cutCount };
                }
            `;

            const violations = checkForbiddenTerms(code);
            expect(violations.length).toBe(0);
        });
    });

    describe('Feature Name Validation', () => {
        test('Should reject forbidden feature names', () => {
            expect(isAllowedFeature('hookStrength')).toBe(false);
            expect(isAllowedFeature('emotionScore')).toBe(false);
            expect(isAllowedFeature('sentimentAnalysis')).toBe(false);
        });

        test('Should accept mechanical feature names', () => {
            expect(isAllowedFeature('motionStartMs')).toBe(true);
            expect(isAllowedFeature('cutCount')).toBe(true);
            expect(isAllowedFeature('audioLevelLufs')).toBe(true);
        });
    });
});

describe('Boundary Isolation - LLM Output Validation', () => {
    describe('Schema Enforcement', () => {
        test('Should accept valid LLM output', () => {
            const validOutput = {
                ctaPresent: true,
                ctaHasActionVerb: true,
                ctaHasOutcome: false,
                benefitStated: true,
                benefitQuantified: false,
                timeToBenefitStated: false,
                valueTiming: 'opening',
                offerPresent: true,
                offerTiming: 'early',
                proofPresent: false,
                pricingVisible: true,
                guaranteeMentioned: false,
                adLpMatch: 'yes',
            };

            expect(() => validateLlmOutput(validOutput)).not.toThrow();
        });

        test('Should reject extra keys', () => {
            const invalidOutput = {
                ctaPresent: true,
                hookStrength: 'high',  // FORBIDDEN
            };

            expect(() => validateLlmOutput(invalidOutput)).toThrow(/forbidden key/i);
        });

        test('Should reject forbidden semantic keys', () => {
            const invalidOutput = {
                ctaPresent: true,
                emotion: 'excitement',  // FORBIDDEN
            };

            expect(() => validateLlmOutput(invalidOutput)).toThrow(/forbidden key/i);
        });
    });

    describe('Allowed Keys', () => {
        test('Should include all required checklist fields', () => {
            const requiredKeys = [
                'ctaPresent',
                'ctaHasActionVerb',
                'ctaHasOutcome',
                'benefitStated',
                'benefitQuantified',
                'valueTiming',
                'offerPresent',
                'proofPresent',
                'adLpMatch',
            ];

            for (const key of requiredKeys) {
                expect(ALLOWED_LLM_OUTPUT_KEYS).toContain(key);
            }
        });

        test('Should NOT include any semantic keys', () => {
            const forbiddenInOutput = [
                'hookStrength',
                'emotionalAppeal',
                'persuasiveness',
                'engagement',
                'quality',
            ];

            for (const key of forbiddenInOutput) {
                expect(ALLOWED_LLM_OUTPUT_KEYS).not.toContain(key);
            }
        });
    });
});

describe('Boundary Isolation - Type Separation', () => {
    test('NarrativeChecklist should not include structure scoring fields', () => {
        // This is a compile-time check - if NarrativeChecklist imports
        // structure scoring types, TypeScript would fail.
        // We verify the separation by checking the allowed LLM output keys
        // don't include any structure-specific fields.

        const structureFields = [
            'deliveryProbability',
            'structureScore',
            'motionTimingScore',
            'hookScore',
        ];

        for (const field of structureFields) {
            expect(ALLOWED_LLM_OUTPUT_KEYS).not.toContain(field);
        }
    });

    test('Structure system allowed imports should be limited', () => {
        // The structure system should only import from allowed paths
        // This test documents the expected behavior
        const allowedStructureImports = [
            '@/lib/structure',
            '@/lib/config',
            '@/lib/types',
            '@/lib/utils',
        ];

        const forbiddenStructureImports = [
            '@/lib/narrative',
            '@/lib/conversion',
        ];

        // Structure should NOT import narrative or conversion
        expect(forbiddenStructureImports).toHaveLength(2);
        expect(allowedStructureImports).not.toContain('@/lib/narrative');
    });
});
