/**
 * Recommendation Specificity Validator Tests
 */

import {
    validateRecommendation,
    buildRecommendation,
    RECOMMENDATION_TEMPLATES
} from '../specificityValidator';
import type { CreateRecommendationInput } from '../../types/recommendations';

describe('validateRecommendation', () => {
    const validRecommendation: Partial<CreateRecommendationInput> = {
        sourceSystem: 'structure',
        recommendationType: 'motion_timing',
        recommendationText: 'Add motion in first 0.5 seconds',
        whatToChange: 'Add motion in the first 0.5 seconds',
        targetRange: '0-0.5s (currently 1.2s)',
        observableGap: 'Motion currently starts at 1.2s',
        metricToWatch: 'thumbstop, hook_rate',
        runDurationDays: 7,
        confidence: 'high',
    };

    it('should pass for valid recommendations', () => {
        const result = validateRecommendation(validRecommendation);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    describe('whatToChange validation', () => {
        it('should fail for empty whatToChange', () => {
            const rec = { ...validRecommendation, whatToChange: '' };
            const result = validateRecommendation(rec);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('whatToChange'))).toBe(true);
        });

        it('should fail for short whatToChange', () => {
            const rec = { ...validRecommendation, whatToChange: 'Fix it' };
            const result = validateRecommendation(rec);
            expect(result.valid).toBe(false);
        });

        it('should fail for vague phrases', () => {
            const vaguePhrases = [
                'Make it stronger',
                'Test a better version',
                'Improve the creative',
                'Optimize for results',
                'Enhance the message',
            ];

            for (const phrase of vaguePhrases) {
                const rec = { ...validRecommendation, whatToChange: phrase };
                const result = validateRecommendation(rec);
                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.includes('vague'))).toBe(true);
            }
        });
    });

    describe('targetRange validation', () => {
        it('should fail for targetRange without numbers', () => {
            const rec = { ...validRecommendation, targetRange: 'Earlier in the video' };
            const result = validateRecommendation(rec);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('targetRange'))).toBe(true);
        });

        it('should pass for targetRange with numbers', () => {
            const validRanges = [
                '0-3s instead of 8s',
                'Under 20% of current',
                'Add 2-3 cuts',
                'Reduce to 15% discount',
            ];

            for (const range of validRanges) {
                const rec = { ...validRecommendation, targetRange: range };
                const result = validateRecommendation(rec);
                expect(result.errors.some(e => e.includes('targetRange'))).toBe(false);
            }
        });
    });

    describe('metricToWatch validation', () => {
        it('should fail for invalid metrics', () => {
            const rec = { ...validRecommendation, metricToWatch: 'engagement' };
            const result = validateRecommendation(rec);
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('metricToWatch'))).toBe(true);
        });

        it('should pass for valid metrics', () => {
            const validMetrics = ['CTR', 'CPA', 'ROAS', 'CVR', 'thumbstop', 'hook_rate'];

            for (const metric of validMetrics) {
                const rec = { ...validRecommendation, metricToWatch: metric };
                const result = validateRecommendation(rec);
                expect(result.errors.some(e => e.includes('metricToWatch'))).toBe(false);
            }
        });
    });

    describe('runDurationDays validation', () => {
        it('should fail for duration < 3 days', () => {
            const rec = { ...validRecommendation, runDurationDays: 2 };
            const result = validateRecommendation(rec);
            expect(result.valid).toBe(false);
        });

        it('should fail for duration > 30 days', () => {
            const rec = { ...validRecommendation, runDurationDays: 45 };
            const result = validateRecommendation(rec);
            expect(result.valid).toBe(false);
        });

        it('should pass for duration 3-30 days', () => {
            for (const days of [3, 7, 14, 30]) {
                const rec = { ...validRecommendation, runDurationDays: days };
                const result = validateRecommendation(rec);
                expect(result.errors.some(e => e.includes('runDurationDays'))).toBe(false);
            }
        });
    });
});

describe('buildRecommendation', () => {
    it('should fill placeholders with values', () => {
        const rec = buildRecommendation(
            'motion_timing',
            { current: '1.5' },
            'structure',
            'high'
        );

        expect(rec.targetRange).toContain('1.5');
        expect(rec.observableGap).toContain('1.5');
    });

    it('should produce valid recommendations from templates', () => {
        const types = Object.keys(RECOMMENDATION_TEMPLATES) as Array<keyof typeof RECOMMENDATION_TEMPLATES>;

        for (const type of types) {
            const rec = buildRecommendation(
                type,
                { current: '5', target: '2', percent: '30', type: 'testimonial', placement: 'feed' },
                'structure',
                'medium'
            );

            // All template-built recommendations should pass basic validation
            // (except placeholder check which templates include)
            expect(rec.sourceSystem).toBeDefined();
            expect(rec.recommendationType).toBe(type);
            expect(rec.runDurationDays).toBeGreaterThanOrEqual(3);
            expect(rec.runDurationDays).toBeLessThanOrEqual(30);
        }
    });
});

describe('RECOMMENDATION_TEMPLATES', () => {
    it('should have valid runDurationDays for all templates', () => {
        for (const [type, template] of Object.entries(RECOMMENDATION_TEMPLATES)) {
            expect(template.runDurationDays).toBeGreaterThanOrEqual(3);
            expect(template.runDurationDays).toBeLessThanOrEqual(30);
        }
    });

    it('should have non-empty required fields for all templates', () => {
        for (const [type, template] of Object.entries(RECOMMENDATION_TEMPLATES)) {
            expect(template.targetRangeTemplate.length).toBeGreaterThan(0);
            expect(template.metricToWatch.length).toBeGreaterThan(0);
            expect(template.whatToChangeExample.length).toBeGreaterThan(10);
            expect(template.observableGapExample.length).toBeGreaterThan(10);
        }
    });
});
