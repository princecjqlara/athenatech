/**
 * System Orchestration Integration Tests
 * 
 * Tests the 4-quadrant system activation logic:
 * - Q1: Delivery Good + Conversion Good → No System 2
 * - Q2: Delivery Good + Conversion Bad + ≥30 conv → System 2 Activated
 * - Q3: Delivery Bad + Conversion Good → Structure Only
 * - Q4: Delivery Bad + Conversion Bad → Structure First, No Narrative
 */

import { describe, test, expect } from 'vitest';
import { checkNarrativeEligibility, getEligibilityMessage } from '../../lib/narrativeChecklist';
import { evaluateGates, type GateInput } from '../../lib/gates/scoringGates';
import { GATE_CONFIG } from '../../lib/config/gates';

describe('System Orchestration - 4 Quadrant Tests', () => {
    // ==================== QUADRANT 1 ====================
    // Delivery Good + Conversion Good = System 2 NOT activated
    describe('Q1: Delivery Good + Conversion Good', () => {
        test('System 2 should NOT activate when both delivery and conversion are healthy', () => {
            const result = checkNarrativeEligibility('healthy', 'good', 100);

            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('conversion_healthy');
        });

        test('Message should indicate no issues detected', () => {
            const result = checkNarrativeEligibility('healthy', 'good', 100);
            const message = getEligibilityMessage(result);

            expect(message).toContain('No message issues detected');
        });
    });

    // ==================== QUADRANT 2 ====================
    // Delivery Good + Conversion Bad + ≥30 conversions = System 2 Activated
    describe('Q2: Delivery Good + Conversion Bad', () => {
        test('System 2 should activate when delivery healthy, conversion bad, and ≥30 conversions', () => {
            const result = checkNarrativeEligibility('healthy', 'bad', 30);

            expect(result.eligible).toBe(true);
            expect(result.reason).toBe('delivery_healthy_conversion_bad');
        });

        test('System 2 should NOT activate when conversions < 30', () => {
            const result = checkNarrativeEligibility('healthy', 'bad', 29);

            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('insufficient_conversions');
        });

        test('System 2 should NOT activate when conversions = 0', () => {
            const result = checkNarrativeEligibility('healthy', 'bad', 0);

            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('insufficient_conversions');
        });

        test('Threshold matches GATE_CONFIG.NARRATIVE_MIN_CONVERSIONS', () => {
            const threshold = GATE_CONFIG.NARRATIVE_MIN_CONVERSIONS;

            // At threshold - should pass
            const atThreshold = checkNarrativeEligibility('healthy', 'bad', threshold);
            expect(atThreshold.eligible).toBe(true);

            // Below threshold - should fail
            const belowThreshold = checkNarrativeEligibility('healthy', 'bad', threshold - 1);
            expect(belowThreshold.eligible).toBe(false);
        });
    });

    // ==================== QUADRANT 3 ====================
    // Delivery Bad + Conversion Good = Structure Only (Narrative blocked)
    describe('Q3: Delivery Bad + Conversion Good', () => {
        test('System 2 should NOT activate when delivery is risky', () => {
            const result = checkNarrativeEligibility('risky', 'good', 100);

            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('delivery_unhealthy');
        });

        test('System 2 should NOT activate when delivery is poor', () => {
            const result = checkNarrativeEligibility('poor', 'good', 100);

            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('delivery_unhealthy');
        });

        test('Message should indicate to fix structure first', () => {
            const result = checkNarrativeEligibility('poor', 'good', 100);
            const message = getEligibilityMessage(result);

            expect(message).toContain('Fix structure first');
        });
    });

    // ==================== QUADRANT 4 ====================
    // Delivery Bad + Conversion Bad = Structure First, No Narrative
    describe('Q4: Delivery Bad + Conversion Bad', () => {
        test('System 2 should NOT activate when delivery is bad (even with bad conversion)', () => {
            const result = checkNarrativeEligibility('poor', 'bad', 100);

            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('delivery_unhealthy');
        });

        test('System 2 should NOT activate for risky delivery + bad conversion', () => {
            const result = checkNarrativeEligibility('risky', 'bad', 100);

            expect(result.eligible).toBe(false);
            expect(result.reason).toBe('delivery_unhealthy');
        });
    });
});

describe('System Orchestration - Gate Thresholds', () => {
    const baseInput: GateInput = {
        firstSeenAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 72h ago
        totalSpend: 2000,
        totalImpressions: 10000,
        totalConversions: 50,
    };

    describe('Age Gate', () => {
        test('Should pass after 48 hours', () => {
            const result = evaluateGates(baseInput);
            expect(result.canScoreDelivery).toBe(true);
            expect(result.gates.age.passed).toBe(true);
        });

        test('Should fail before 48 hours', () => {
            const result = evaluateGates({
                ...baseInput,
                firstSeenAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h ago
            });
            expect(result.canScoreDelivery).toBe(false);
            expect(result.gates.age.passed).toBe(false);
        });
    });

    describe('Spend Gate', () => {
        test('Should allow recommendations after ₱1000 spend', () => {
            const result = evaluateGates(baseInput);
            expect(result.canShowRecommendations).toBe(true);
            expect(result.gates.spend.passed).toBe(true);
        });

        test('Should block recommendations before ₱1000 spend', () => {
            const result = evaluateGates({
                ...baseInput,
                totalSpend: 500,
            });
            expect(result.canShowRecommendations).toBe(false);
            expect(result.gates.spend.passed).toBe(false);
        });
    });

    describe('Impression Thresholds', () => {
        test('5000+ impressions = high confidence', () => {
            const result = evaluateGates({
                ...baseInput,
                totalImpressions: 5000,
            });
            expect(result.gates.impressions.level).toBe('high');
        });

        test('1000-4999 impressions = medium confidence', () => {
            const result = evaluateGates({
                ...baseInput,
                totalImpressions: 2500,
            });
            expect(result.gates.impressions.level).toBe('medium');
        });

        test('<1000 impressions = low confidence', () => {
            const result = evaluateGates({
                ...baseInput,
                totalImpressions: 500,
            });
            expect(result.gates.impressions.level).toBe('low');
        });
    });

    describe('Conversion Thresholds', () => {
        test('100+ conversions = high confidence', () => {
            const result = evaluateGates({
                ...baseInput,
                totalConversions: 100,
            });
            expect(result.gates.conversions.level).toBe('high');
        });

        test('30-99 conversions = medium confidence', () => {
            const result = evaluateGates({
                ...baseInput,
                totalConversions: 50,
            });
            expect(result.gates.conversions.level).toBe('medium');
        });

        test('<10 conversions = insufficient', () => {
            const result = evaluateGates({
                ...baseInput,
                totalConversions: 5,
            });
            expect(result.gates.conversions.level).toBe('insufficient');
        });
    });

    describe('iOS/Modeled Conservative Defaults', () => {
        test('Missing iOS data should trigger conservative confidence', () => {
            const result = evaluateGates({
                ...baseInput,
                iosTrafficPercent: undefined,
            });
            expect(result.gates.iosTraffic.penalized).toBe(true);
            expect(result.gateMessages.some(m => m.includes('iOS traffic data unavailable'))).toBe(true);
        });

        test('Missing modeled data should trigger conservative confidence', () => {
            const result = evaluateGates({
                ...baseInput,
                modeledConversionPercent: undefined,
            });
            expect(result.gates.modeledConversions.penalized).toBe(true);
            expect(result.gateMessages.some(m => m.includes('Modeled conversion data unavailable'))).toBe(true);
        });
    });
});
