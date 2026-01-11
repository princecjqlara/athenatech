/**
 * Scoring Gates System
 * 
 * Evaluates whether creatives/ads have enough data for reliable scoring.
 * Prevents premature conclusions and over-claiming accuracy.
 * 
 * Gates:
 * - Age gate: Wait 48h before delivery classification
 * - Spend gate: ₱1000 minimum before strong recommendations
 * - Impression gates: 1k (medium), 5k (high) confidence
 * - Conversion gates: 10/30/100 thresholds
 * - iOS/attribution penalties: Reduce confidence when data quality is poor
 */

import { GATE_CONFIG } from '../config/gates';

// ==================== TYPES ====================

export type DeliveryConfidenceLevel = 'high' | 'medium' | 'low' | 'none';
export type ConversionConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

export interface GateStatus {
    // Delivery scoring gates
    canScoreDelivery: boolean;
    deliveryConfidenceMax: DeliveryConfidenceLevel;

    // Conversion scoring gates
    canScoreConversion: boolean;
    conversionConfidenceMax: ConversionConfidenceLevel;

    // Recommendation gate
    canShowRecommendations: boolean;

    // User-facing messages
    gateMessages: string[];

    // Detailed gate status for UI
    gates: {
        age: { passed: boolean; hoursRemaining?: number };
        spend: { passed: boolean; amountRemaining?: number };
        impressions: { level: 'high' | 'medium' | 'low'; current: number; nextThreshold?: number };
        conversions: { level: 'high' | 'medium' | 'low' | 'insufficient'; current: number; nextThreshold?: number };
        iosTraffic: { penalized: boolean; percent?: number };
        modeledConversions: { penalized: boolean; percent?: number };
        attributionMismatch: { blocked: boolean; message?: string };
    };
}

export interface GateInput {
    firstSeenAt: Date;
    totalSpend: number;
    totalImpressions: number;
    totalConversions: number;
    iosTrafficPercent?: number;
    modeledConversionPercent?: number;
    userAttributionWindow?: string;
    metaAttributionWindow?: string;
}

// ==================== GATE EVALUATION ====================

/**
 * Evaluate all gates for a creative/ad.
 * Returns comprehensive status including confidence levels and messages.
 */
export function evaluateGates(input: GateInput): GateStatus {
    const messages: string[] = [];
    const now = Date.now();
    const ageHours = (now - input.firstSeenAt.getTime()) / (1000 * 60 * 60);

    // === Age Gate ===
    const ageGatePassed = ageHours >= GATE_CONFIG.AGE_GATE_HOURS;
    const hoursRemaining = ageGatePassed ? undefined : Math.ceil(GATE_CONFIG.AGE_GATE_HOURS - ageHours);

    if (!ageGatePassed) {
        messages.push(`Gathering data. Delivery scoring available in ~${hoursRemaining}h.`);
    }

    // === Spend Gate ===
    const spendGatePassed = input.totalSpend >= GATE_CONFIG.SPEND_GATE_PHP;
    const spendRemaining = spendGatePassed ? undefined : GATE_CONFIG.SPEND_GATE_PHP - input.totalSpend;

    if (!spendGatePassed) {
        messages.push(`Need ₱${spendRemaining?.toFixed(0)} more spend before recommendations.`);
    }

    // === Impression Gate ===
    let deliveryConfidenceMax: DeliveryConfidenceLevel = 'none';
    let impressionLevel: 'high' | 'medium' | 'low' = 'low';
    let impressionNextThreshold: number | undefined;

    if (input.totalImpressions >= GATE_CONFIG.IMPRESSIONS_HIGH) {
        deliveryConfidenceMax = 'high';
        impressionLevel = 'high';
    } else if (input.totalImpressions >= GATE_CONFIG.IMPRESSIONS_MEDIUM) {
        deliveryConfidenceMax = 'medium';
        impressionLevel = 'medium';
        impressionNextThreshold = GATE_CONFIG.IMPRESSIONS_HIGH;
        messages.push(
            `${(GATE_CONFIG.IMPRESSIONS_HIGH - input.totalImpressions).toLocaleString()} more impressions for high confidence.`
        );
    } else {
        deliveryConfidenceMax = 'low';
        impressionLevel = 'low';
        impressionNextThreshold = GATE_CONFIG.IMPRESSIONS_MEDIUM;
        messages.push(
            `Early signal only. Need ${GATE_CONFIG.IMPRESSIONS_MEDIUM.toLocaleString()} impressions for medium confidence.`
        );
    }

    // === Conversion Gate ===
    let conversionConfidenceMax: ConversionConfidenceLevel = 'insufficient';
    let conversionLevel: 'high' | 'medium' | 'low' | 'insufficient' = 'insufficient';
    let conversionNextThreshold: number | undefined;

    if (input.totalConversions >= GATE_CONFIG.CONVERSIONS_MEDIUM) {
        conversionConfidenceMax = 'high';
        conversionLevel = 'high';
    } else if (input.totalConversions >= GATE_CONFIG.CONVERSIONS_LOW) {
        conversionConfidenceMax = 'medium';
        conversionLevel = 'medium';
        conversionNextThreshold = GATE_CONFIG.CONVERSIONS_MEDIUM;
    } else if (input.totalConversions >= GATE_CONFIG.CONVERSIONS_INSUFFICIENT) {
        conversionConfidenceMax = 'low';
        conversionLevel = 'low';
        conversionNextThreshold = GATE_CONFIG.CONVERSIONS_LOW;
    } else {
        conversionNextThreshold = GATE_CONFIG.CONVERSIONS_INSUFFICIENT;
        messages.push(
            `Only ${input.totalConversions} conversions. Need ${GATE_CONFIG.CONVERSIONS_INSUFFICIENT}+ for any signal.`
        );
    }

    // === iOS Traffic Penalty ===
    let iosPenalized = false;
    let iosDataMissing = false;

    if (input.iosTrafficPercent === undefined) {
        // CONSERVATIVE DEFAULT: Assume worst case when data is missing
        conversionConfidenceMax = clampConversionConfidence(conversionConfidenceMax, 'low');
        iosPenalized = true;
        iosDataMissing = true;
        messages.push(
            '⚠️ iOS traffic data unavailable. Using conservative estimate (confidence capped).'
        );
    } else if (input.iosTrafficPercent > GATE_CONFIG.IOS_TRAFFIC_CRITICAL_THRESHOLD) {
        conversionConfidenceMax = clampConversionConfidence(conversionConfidenceMax, 'low');
        iosPenalized = true;
        messages.push(
            `High iOS traffic (${(input.iosTrafficPercent * 100).toFixed(0)}%). Conversion data may be incomplete.`
        );
    } else if (input.iosTrafficPercent > GATE_CONFIG.IOS_TRAFFIC_PENALTY_THRESHOLD) {
        conversionConfidenceMax = clampConversionConfidence(conversionConfidenceMax, 'medium');
        iosPenalized = true;
    }

    // === Modeled Conversion Penalty ===
    let modeledPenalized = false;
    let modeledDataMissing = false;

    if (input.modeledConversionPercent === undefined) {
        // CONSERVATIVE DEFAULT: Assume significant modeling when data is missing
        conversionConfidenceMax = clampConversionConfidence(conversionConfidenceMax, 'medium');
        modeledPenalized = true;
        modeledDataMissing = true;
        messages.push(
            '⚠️ Modeled conversion data unavailable. Using conservative estimate.'
        );
    } else if (input.modeledConversionPercent > GATE_CONFIG.MODELED_CONVERSION_PENALTY) {
        conversionConfidenceMax = clampConversionConfidence(conversionConfidenceMax, 'medium');
        modeledPenalized = true;
        messages.push(
            `${(input.modeledConversionPercent * 100).toFixed(0)}% of conversions are modeled. Confidence reduced.`
        );
    }

    // === Attribution Mismatch ===
    let attributionBlocked = false;
    let attributionMessage: string | undefined;

    if (
        input.userAttributionWindow &&
        input.metaAttributionWindow &&
        input.userAttributionWindow !== input.metaAttributionWindow
    ) {
        attributionBlocked = true;
        attributionMessage = `Attribution window mismatch: You use "${input.userAttributionWindow}" but Meta reports "${input.metaAttributionWindow}". Baseline comparisons blocked.`;
        messages.push(attributionMessage);
        // Block conversion scoring entirely
        conversionConfidenceMax = 'insufficient';
    }

    return {
        canScoreDelivery: ageGatePassed,
        deliveryConfidenceMax,
        canScoreConversion: input.totalConversions >= GATE_CONFIG.CONVERSIONS_INSUFFICIENT && !attributionBlocked,
        conversionConfidenceMax,
        canShowRecommendations: ageGatePassed && spendGatePassed,
        gateMessages: messages,
        gates: {
            age: { passed: ageGatePassed, hoursRemaining },
            spend: { passed: spendGatePassed, amountRemaining: spendRemaining },
            impressions: { level: impressionLevel, current: input.totalImpressions, nextThreshold: impressionNextThreshold },
            conversions: { level: conversionLevel, current: input.totalConversions, nextThreshold: conversionNextThreshold },
            iosTraffic: { penalized: iosPenalized, percent: input.iosTrafficPercent },
            modeledConversions: { penalized: modeledPenalized, percent: input.modeledConversionPercent },
            attributionMismatch: { blocked: attributionBlocked, message: attributionMessage },
        },
    };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Clamp conversion confidence to a maximum level.
 * Used for iOS/modeling penalties.
 */
function clampConversionConfidence(
    current: ConversionConfidenceLevel,
    max: ConversionConfidenceLevel
): ConversionConfidenceLevel {
    const order: ConversionConfidenceLevel[] = ['insufficient', 'low', 'medium', 'high'];
    const currentIdx = order.indexOf(current);
    const maxIdx = order.indexOf(max);
    return order[Math.min(currentIdx, maxIdx)];
}

/**
 * Get a user-friendly summary of gate status.
 */
export function getGateStatusSummary(gateStatus: GateStatus): string {
    if (!gateStatus.canScoreDelivery) {
        return 'Gathering initial data...';
    }

    if (gateStatus.conversionConfidenceMax === 'insufficient') {
        return 'Delivery data available. Waiting for conversions.';
    }

    if (!gateStatus.canShowRecommendations) {
        return 'Data available. Recommendations after more spend.';
    }

    const confidenceLabel = getConfidenceLabel(gateStatus.conversionConfidenceMax);
    return `${confidenceLabel} confidence data available.`;
}

/**
 * Get confidence label for display.
 */
export function getConfidenceLabel(level: ConversionConfidenceLevel | DeliveryConfidenceLevel): string {
    switch (level) {
        case 'high':
            return '✅ High';
        case 'medium':
            return '⚠️ Medium';
        case 'low':
            return '🔻 Low';
        case 'insufficient':
        case 'none':
            return '📊 Insufficient';
    }
}

/**
 * Get confidence color for UI.
 */
export function getConfidenceColor(level: ConversionConfidenceLevel | DeliveryConfidenceLevel): string {
    switch (level) {
        case 'high':
            return '#22c55e'; // green-500
        case 'medium':
            return '#f59e0b'; // amber-500
        case 'low':
            return '#ef4444'; // red-500
        case 'insufficient':
        case 'none':
            return '#6b7280'; // gray-500
    }
}
