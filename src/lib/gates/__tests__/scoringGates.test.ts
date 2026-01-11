/**
 * Scoring Gates Unit Tests
 * 
 * Tests gate evaluation logic including:
 * - Age gate (48h threshold)
 * - Spend gate (₱1000 threshold)
 * - Impression gates (1k/5k thresholds)
 * - Conversion gates (10/30/100 thresholds)
 * - iOS traffic penalties
 * - Modeled conversion penalties
 * - Attribution mismatch blocking
 */

import { evaluateGates, type GateInput } from '../scoringGates';
import { GATE_CONFIG } from '../../config/gates';

describe('evaluateGates', () => {
    const baseInput: GateInput = {
        firstSeenAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 72 hours ago
        totalSpend: 2000,
        totalImpressions: 10000,
        totalConversions: 150,
    };

    describe('Age Gate', () => {
        it('should block delivery scoring for creatives < 48 hours old', () => {
            const input: GateInput = {
                ...baseInput,
                firstSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
            };
            const result = evaluateGates(input);

            expect(result.canScoreDelivery).toBe(false);
            expect(result.gates.age.passed).toBe(false);
            expect(result.gates.age.hoursRemaining).toBeGreaterThan(0);
        });

        it('should allow delivery scoring for creatives >= 48 hours old', () => {
            const input: GateInput = {
                ...baseInput,
                firstSeenAt: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50 hours ago
            };
            const result = evaluateGates(input);

            expect(result.canScoreDelivery).toBe(true);
            expect(result.gates.age.passed).toBe(true);
        });
    });

    describe('Spend Gate', () => {
        it('should block recommendations for spend < ₱1000', () => {
            const input: GateInput = {
                ...baseInput,
                totalSpend: 500,
            };
            const result = evaluateGates(input);

            expect(result.canShowRecommendations).toBe(false);
            expect(result.gates.spend.passed).toBe(false);
            expect(result.gates.spend.amountRemaining).toBe(500);
        });

        it('should allow recommendations for spend >= ₱1000', () => {
            const input: GateInput = {
                ...baseInput,
                totalSpend: 1000,
            };
            const result = evaluateGates(input);

            expect(result.gates.spend.passed).toBe(true);
        });
    });

    describe('Impression Gates', () => {
        it('should set low delivery confidence for < 1000 impressions', () => {
            const input: GateInput = {
                ...baseInput,
                totalImpressions: 500,
            };
            const result = evaluateGates(input);

            expect(result.deliveryConfidenceMax).toBe('low');
            expect(result.gates.impressions.level).toBe('low');
        });

        it('should set medium delivery confidence for 1000-4999 impressions', () => {
            const input: GateInput = {
                ...baseInput,
                totalImpressions: 2500,
            };
            const result = evaluateGates(input);

            expect(result.deliveryConfidenceMax).toBe('medium');
            expect(result.gates.impressions.level).toBe('medium');
        });

        it('should set high delivery confidence for >= 5000 impressions', () => {
            const input: GateInput = {
                ...baseInput,
                totalImpressions: 5000,
            };
            const result = evaluateGates(input);

            expect(result.deliveryConfidenceMax).toBe('high');
            expect(result.gates.impressions.level).toBe('high');
        });
    });

    describe('Conversion Gates', () => {
        it('should set insufficient for < 10 conversions', () => {
            const input: GateInput = {
                ...baseInput,
                totalConversions: 5,
            };
            const result = evaluateGates(input);

            expect(result.canScoreConversion).toBe(false);
            expect(result.conversionConfidenceMax).toBe('insufficient');
        });

        it('should set low confidence for 10-29 conversions', () => {
            const input: GateInput = {
                ...baseInput,
                totalConversions: 20,
            };
            const result = evaluateGates(input);

            expect(result.canScoreConversion).toBe(true);
            expect(result.conversionConfidenceMax).toBe('low');
        });

        it('should set medium confidence for 30-99 conversions', () => {
            const input: GateInput = {
                ...baseInput,
                totalConversions: 50,
            };
            const result = evaluateGates(input);

            expect(result.conversionConfidenceMax).toBe('medium');
        });

        it('should set high confidence for >= 100 conversions', () => {
            const input: GateInput = {
                ...baseInput,
                totalConversions: 100,
            };
            const result = evaluateGates(input);

            expect(result.conversionConfidenceMax).toBe('high');
        });
    });

    describe('iOS Traffic Penalty', () => {
        it('should not penalize for iOS traffic <= 40%', () => {
            const input: GateInput = {
                ...baseInput,
                iosTrafficPercent: 0.35,
            };
            const result = evaluateGates(input);

            expect(result.gates.iosTraffic.penalized).toBe(false);
            expect(result.conversionConfidenceMax).toBe('high');
        });

        it('should cap at medium confidence for iOS traffic 40-60%', () => {
            const input: GateInput = {
                ...baseInput,
                iosTrafficPercent: 0.50,
            };
            const result = evaluateGates(input);

            expect(result.gates.iosTraffic.penalized).toBe(true);
            expect(result.conversionConfidenceMax).toBe('medium');
        });

        it('should cap at low confidence for iOS traffic > 60%', () => {
            const input: GateInput = {
                ...baseInput,
                iosTrafficPercent: 0.70,
            };
            const result = evaluateGates(input);

            expect(result.gates.iosTraffic.penalized).toBe(true);
            expect(result.conversionConfidenceMax).toBe('low');
        });
    });

    describe('Modeled Conversion Penalty', () => {
        it('should not penalize for modeled conversions <= 30%', () => {
            const input: GateInput = {
                ...baseInput,
                modeledConversionPercent: 0.25,
            };
            const result = evaluateGates(input);

            expect(result.gates.modeledConversions.penalized).toBe(false);
        });

        it('should cap at medium confidence for modeled conversions > 30%', () => {
            const input: GateInput = {
                ...baseInput,
                modeledConversionPercent: 0.40,
            };
            const result = evaluateGates(input);

            expect(result.gates.modeledConversions.penalized).toBe(true);
            expect(result.conversionConfidenceMax).toBe('medium');
        });
    });

    describe('Attribution Mismatch', () => {
        it('should not block when attribution windows match', () => {
            const input: GateInput = {
                ...baseInput,
                userAttributionWindow: '7d_click_1d_view',
                metaAttributionWindow: '7d_click_1d_view',
            };
            const result = evaluateGates(input);

            expect(result.gates.attributionMismatch.blocked).toBe(false);
            expect(result.canScoreConversion).toBe(true);
        });

        it('should block conversion scoring when attribution windows mismatch', () => {
            const input: GateInput = {
                ...baseInput,
                userAttributionWindow: '7d_click_1d_view',
                metaAttributionWindow: '1d_click',
            };
            const result = evaluateGates(input);

            expect(result.gates.attributionMismatch.blocked).toBe(true);
            expect(result.canScoreConversion).toBe(false);
            expect(result.conversionConfidenceMax).toBe('insufficient');
        });
    });

    describe('Combined Gates', () => {
        it('should require both age AND spend gates for recommendations', () => {
            // Age passed, spend not passed
            const input1: GateInput = {
                ...baseInput,
                totalSpend: 500,
            };
            expect(evaluateGates(input1).canShowRecommendations).toBe(false);

            // Spend passed, age not passed
            const input2: GateInput = {
                ...baseInput,
                firstSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            };
            expect(evaluateGates(input2).canShowRecommendations).toBe(false);

            // Both passed
            expect(evaluateGates(baseInput).canShowRecommendations).toBe(true);
        });

        it('should include descriptive messages for all blocking gates', () => {
            const input: GateInput = {
                firstSeenAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours
                totalSpend: 300,
                totalImpressions: 500,
                totalConversions: 5,
                iosTrafficPercent: 0.65,
            };
            const result = evaluateGates(input);

            expect(result.gateMessages.length).toBeGreaterThan(0);
            expect(result.gateMessages.some(m => m.includes('Gathering data'))).toBe(true);
            expect(result.gateMessages.some(m => m.includes('spend'))).toBe(true);
            expect(result.gateMessages.some(m => m.includes('conversions'))).toBe(true);
        });
    });
});
