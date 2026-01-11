/**
 * Wrong-Blame Prevention
 * 
 * Detects external factors that may affect conversion performance:
 * - LP/offer changes
 * - Tracking anomalies
 * - Audience fatigue
 * 
 * Prevents the system from incorrectly blaming creatives when
 * external factors are the actual cause.
 */

// ==================== CONTEXT CHANGE DETECTION ====================

export type ContextChangeType = 'lp_url' | 'discount' | 'price' | 'guarantee';

export interface ContextChange {
    type: ContextChangeType;
    previousValue: string | boolean | null;
    currentValue: string | boolean | null;
    changedAt: Date;
}

export interface AdContext {
    destinationUrl?: string;
    discountDetected?: string;   // "50% off", "₱500 discount"
    priceDetected?: string;      // "₱999"
    guaranteeDetected?: boolean;
}

/**
 * Normalize URL for comparison (remove tracking params, protocol, trailing slashes)
 */
export function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        // Remove common tracking params
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
        trackingParams.forEach(param => parsed.searchParams.delete(param));
        // Normalize
        return `${parsed.hostname}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`.toLowerCase();
    } catch {
        return url.toLowerCase().replace(/\/$/, '');
    }
}

/**
 * Hash URL for storage (SHA-256 would be better, but this is a simple hash for now)
 */
export function hashUrl(url: string): string {
    const normalized = normalizeUrl(url);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
}

/**
 * Detect changes between contexts
 */
export function detectContextChanges(
    previous: AdContext | null,
    current: AdContext
): ContextChange[] {
    if (!previous) return [];

    const changes: ContextChange[] = [];

    // LP URL change
    if (previous.destinationUrl && current.destinationUrl) {
        const prevHash = hashUrl(previous.destinationUrl);
        const currHash = hashUrl(current.destinationUrl);
        if (prevHash !== currHash) {
            changes.push({
                type: 'lp_url',
                previousValue: previous.destinationUrl,
                currentValue: current.destinationUrl,
                changedAt: new Date(),
            });
        }
    }

    // Discount change
    if (previous.discountDetected !== current.discountDetected) {
        changes.push({
            type: 'discount',
            previousValue: previous.discountDetected || null,
            currentValue: current.discountDetected || null,
            changedAt: new Date(),
        });
    }

    // Price change
    if (previous.priceDetected !== current.priceDetected) {
        changes.push({
            type: 'price',
            previousValue: previous.priceDetected || null,
            currentValue: current.priceDetected || null,
            changedAt: new Date(),
        });
    }

    // Guarantee change
    if (previous.guaranteeDetected !== current.guaranteeDetected) {
        changes.push({
            type: 'guarantee',
            previousValue: previous.guaranteeDetected ?? null,
            currentValue: current.guaranteeDetected ?? null,
            changedAt: new Date(),
        });
    }

    return changes;
}

// ==================== TRACKING ANOMALY DETECTION ====================

export type TrackingAnomalyType = 'conversion_drop' | 'pageview_conversion_mismatch' | 'zero_conversions';

export interface TrackingAnomaly {
    detected: boolean;
    type: TrackingAnomalyType;
    severity: 'warning' | 'critical';
    message: string;
}

export interface MetricsSnapshot {
    spend: number;
    conversions: number;
    pageViews?: number;
}

/**
 * Detect tracking anomalies that may indicate broken tracking
 */
export function detectTrackingAnomaly(
    current: MetricsSnapshot,
    previous: MetricsSnapshot
): TrackingAnomaly | null {
    // Need previous data to compare
    if (!previous || previous.spend === 0) {
        return null;
    }

    // Conversion drop >50% with stable spend
    const spendChange = (current.spend - previous.spend) / previous.spend;
    const conversionChange = previous.conversions > 0
        ? (current.conversions - previous.conversions) / previous.conversions
        : 0;

    if (Math.abs(spendChange) < 0.2 && conversionChange < -0.5 && previous.conversions >= 10) {
        return {
            detected: true,
            type: 'conversion_drop',
            severity: 'critical',
            message: `Conversions dropped ${Math.abs(conversionChange * 100).toFixed(0)}% while spend remained stable. This may indicate a tracking issue rather than creative performance.`,
        };
    }

    // PageView to Conversion ratio anomaly (if CAPI available)
    if (current.pageViews && previous.pageViews && previous.pageViews > 0) {
        const prevRatio = previous.conversions / previous.pageViews;
        const currRatio = current.pageViews > 0 ? current.conversions / current.pageViews : 0;

        if (prevRatio > 0.01 && currRatio / prevRatio < 0.3) {
            return {
                detected: true,
                type: 'pageview_conversion_mismatch',
                severity: 'warning',
                message: `Post-click conversion rate dropped significantly. Check if conversion tracking is working correctly.`,
            };
        }
    }

    // Zero conversions with significant spend
    if (current.conversions === 0 && current.spend >= 1000) {
        return {
            detected: true,
            type: 'zero_conversions',
            severity: 'warning',
            message: `No conversions recorded despite ₱${current.spend.toFixed(0)} spend. Verify tracking is active.`,
        };
    }

    return null;
}

// ==================== AUDIENCE FATIGUE DETECTION ====================

export interface FatigueDiagnosis {
    fatigueDetected: boolean;
    confidence: 'high' | 'medium' | 'low';
    indicators: string[];
    recommendation: string;
}

export interface FatigueMetrics {
    frequency: number;
    frequencyPrevious: number;
    ctr: number;
    ctrPrevious: number;
    cpm: number;
    cpmPrevious: number;
}

/**
 * Detect audience fatigue signals
 */
export function detectAudienceFatigue(metrics: FatigueMetrics): FatigueDiagnosis {
    const indicators: string[] = [];

    // Frequency rising
    const frequencyIncrease = metrics.frequencyPrevious > 0
        ? (metrics.frequency - metrics.frequencyPrevious) / metrics.frequencyPrevious
        : 0;
    if (frequencyIncrease > 0.3 && metrics.frequency > 2.5) {
        indicators.push(`Frequency increased ${(frequencyIncrease * 100).toFixed(0)}% to ${metrics.frequency.toFixed(1)}`);
    }

    // CTR falling
    const ctrDecline = metrics.ctrPrevious > 0
        ? (metrics.ctrPrevious - metrics.ctr) / metrics.ctrPrevious
        : 0;
    if (ctrDecline > 0.2) {
        indicators.push(`CTR declined ${(ctrDecline * 100).toFixed(0)}%`);
    }

    // CPM rising (auction pressure)
    const cpmIncrease = metrics.cpmPrevious > 0
        ? (metrics.cpm - metrics.cpmPrevious) / metrics.cpmPrevious
        : 0;
    if (cpmIncrease > 0.25) {
        indicators.push(`CPM increased ${(cpmIncrease * 100).toFixed(0)}%`);
    }

    // Determine fatigue level
    if (indicators.length >= 2) {
        return {
            fatigueDetected: true,
            confidence: indicators.length >= 3 ? 'high' : 'medium',
            indicators,
            recommendation: 'Audience may be fatigued. Consider: (1) expanding audience, (2) refreshing creative, or (3) pausing for 3-5 days.',
        };
    }

    return {
        fatigueDetected: false,
        confidence: 'low',
        indicators: [],
        recommendation: '',
    };
}

// ==================== PRIMARY ISSUE DIAGNOSIS ====================

export type PrimaryIssue =
    | 'landing_page'
    | 'checkout'
    | 'offer'
    | 'tracking'
    | 'audience_fatigue'
    | 'external_change'
    | 'attribution_gap'
    | 'creative'  // Only if no external factors detected
    | 'none';

export interface ConversionDiagnosis {
    primaryIssue: PrimaryIssue;
    confidence: 'high' | 'medium' | 'low';
    safeMessage: string;
    contextChanges: ContextChange[];
    trackingAnomaly: TrackingAnomaly | null;
    fatigueDiagnosis: FatigueDiagnosis | null;
    canBlameCreative: boolean;
}

/**
 * Diagnose conversion issue with wrong-blame prevention
 * 
 * Priority order:
 * 1. Tracking issues
 * 2. External changes (LP, offer)
 * 3. Audience fatigue
 * 4. Attribution gap
 * 5. Only then: funnel/creative issues
 */
export function diagnoseConversionIssue(
    contextChanges: ContextChange[],
    trackingAnomaly: TrackingAnomaly | null,
    fatigueDiagnosis: FatigueDiagnosis | null,
    hasAttributionGap: boolean = false
): ConversionDiagnosis {
    // Priority 1: Tracking issues
    if (trackingAnomaly?.detected) {
        return {
            primaryIssue: 'tracking',
            confidence: trackingAnomaly.severity === 'critical' ? 'high' : 'medium',
            safeMessage: `Potential tracking issue detected. ${trackingAnomaly.message}`,
            contextChanges,
            trackingAnomaly,
            fatigueDiagnosis,
            canBlameCreative: false,
        };
    }

    // Priority 2: External changes
    if (contextChanges.length > 0) {
        const changeTypes = contextChanges.map(c => c.type).join(', ');
        return {
            primaryIssue: 'external_change',
            confidence: 'high',
            safeMessage: `External factors changed: ${changeTypes}. Performance shift may not be due to the creative.`,
            contextChanges,
            trackingAnomaly,
            fatigueDiagnosis,
            canBlameCreative: false,
        };
    }

    // Priority 3: Audience fatigue
    if (fatigueDiagnosis?.fatigueDetected) {
        return {
            primaryIssue: 'audience_fatigue',
            confidence: fatigueDiagnosis.confidence,
            safeMessage: fatigueDiagnosis.recommendation,
            contextChanges,
            trackingAnomaly,
            fatigueDiagnosis,
            canBlameCreative: false,
        };
    }

    // Priority 4: Attribution gap
    if (hasAttributionGap) {
        return {
            primaryIssue: 'attribution_gap',
            confidence: 'medium',
            safeMessage: 'Attribution data may be incomplete due to iOS privacy or modeling. Confidence in conversion metrics is reduced.',
            contextChanges,
            trackingAnomaly,
            fatigueDiagnosis,
            canBlameCreative: false,
        };
    }

    // No external factors detected - can proceed with creative/funnel analysis
    return {
        primaryIssue: 'none',
        confidence: 'high',
        safeMessage: 'No external factors detected. Proceed with creative/funnel analysis.',
        contextChanges,
        trackingAnomaly,
        fatigueDiagnosis,
        canBlameCreative: true,
    };
}
