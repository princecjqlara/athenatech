/**
 * Conversion Owner System (System 3)
 * 
 * Computes conversion efficiency, confidence levels, and funnel diagnostics
 * from Meta Ads API data and optional website events (CAPI).
 * 
 * This system ONLY speaks when the Structure System reports healthy delivery.
 * It answers: "Is the attention being monetized effectively?"
 */

// ==================== TYPE DEFINITIONS ====================

/**
 * Primary Input: Meta Ads API Insights
 * Auto-pulled from Meta Ads Manager
 */
export interface MetaAdsInsights {
    // Core metrics
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    ctr: number;           // Click-through rate (%)
    cpm: number;           // Cost per mille
    cpc: number;           // Cost per click

    // Conversion metrics
    conversions: number;
    leads: number;
    purchases: number;
    value: number;         // Total conversion value
    roas: number;          // Return on ad spend
    cpa: number;           // Cost per acquisition
    cvr: number;           // Conversion rate (%)

    // Video metrics (if applicable)
    video3sViews?: number;
    thruPlay?: number;     // 15s or complete views
    avgWatchTime?: number;
    hookRate?: number;     // 3s views / impressions

    // Breakdown context
    placement?: 'feed' | 'reels' | 'stories' | 'audience_network' | 'messenger';
    geo?: string;
    ageGender?: string;
    device?: 'mobile' | 'desktop' | 'tablet';

    // Time period
    dateRange: {
        start: Date;
        end: Date;
    };
}

/**
 * Upgrade Input: Website Events / CAPI
 * For funnel-stage diagnosis
 */
export interface FunnelEvents {
    pageViews: number;
    viewContent: number;
    addToCart: number;
    initiateCheckout: number;
    purchase: number;
    leads?: number;
    registrations?: number;

    // Event timestamps for sequence analysis
    timestamps?: {
        firstPageView?: Date;
        lastAction?: Date;
        avgTimeToConvert?: number; // seconds
    };
}

/**
 * Account Baseline for comparison
 */
export interface AccountBaseline {
    avgCpa: number;
    avgRoas: number;
    avgCtr: number;
    avgCvr: number;
    avgCpm: number;
    totalConversions: number;
    totalSpend: number;
}

/**
 * Conversion Owner Output
 */
export interface ConversionOwnerOutput {
    // Efficiency scores (vs baseline)
    efficiencyScore: number;       // 0-100
    cpaEfficiency: number;         // % better/worse than baseline
    roasEfficiency: number;        // % better/worse than baseline

    // Confidence
    confidenceLevel: 'high' | 'medium' | 'low' | 'insufficient';
    confidenceReason: string;
    sampleSize: number;

    // Trends & Alerts
    alerts: ConversionAlert[];
    trend: 'improving' | 'stable' | 'declining';
    trendPeriod: string;

    // Funnel diagnosis (if CAPI available)
    funnelAnalysis?: FunnelAnalysis;

    // Recommendations
    recommendations: string[];
    primaryIssue?: 'landing_page' | 'checkout' | 'offer' | 'tracking' | 'none';
}

export interface ConversionAlert {
    type: 'cpa_spike' | 'roas_drop' | 'cvr_decline' | 'spend_inefficiency';
    severity: 'warning' | 'critical';
    message: string;
    value: number;
    threshold: number;
    delta: number; // % change
}

export interface FunnelAnalysis {
    stages: FunnelStage[];
    biggestDropoff: string;
    dropoffRate: number;
    diagnosis: FunnelDiagnosis;
}

export interface FunnelStage {
    name: string;
    count: number;
    rate: number;        // % of previous stage
    dropoff: number;     // % lost at this stage
    benchmark?: number;  // Industry benchmark
    status: 'healthy' | 'warning' | 'critical';
}

export type FunnelDiagnosis =
    | 'landing_page_friction'
    | 'product_interest_low'
    | 'cart_abandonment'
    | 'checkout_friction'
    | 'offer_mismatch'
    | 'tracking_gaps'
    | 'healthy';

// ==================== COMPUTATION FUNCTIONS ====================

/**
 * Compute conversion efficiency score vs account baseline
 */
export function computeEfficiencyScore(
    insights: MetaAdsInsights,
    baseline: AccountBaseline
): { score: number; cpaEfficiency: number; roasEfficiency: number } {
    // CPA efficiency (lower is better, so invert)
    const cpaRatio = baseline.avgCpa > 0 ? insights.cpa / baseline.avgCpa : 1;
    const cpaEfficiency = (1 - cpaRatio) * 100; // Positive = better than baseline

    // ROAS efficiency (higher is better)
    const roasRatio = baseline.avgRoas > 0 ? insights.roas / baseline.avgRoas : 1;
    const roasEfficiency = (roasRatio - 1) * 100; // Positive = better than baseline

    // Combined score (weighted)
    const normalizedCpa = Math.max(0, Math.min(100, 50 + cpaEfficiency));
    const normalizedRoas = Math.max(0, Math.min(100, 50 + roasEfficiency));
    const score = Math.round(normalizedCpa * 0.4 + normalizedRoas * 0.6);

    return { score, cpaEfficiency, roasEfficiency };
}

/**
 * Determine confidence level based on conversion volume
 */
export function computeConfidence(
    conversions: number,
    spend: number
): { level: 'high' | 'medium' | 'low' | 'insufficient'; reason: string } {
    if (conversions < 10) {
        return {
            level: 'insufficient',
            reason: `Only ${conversions} conversions - need 10+ for any signal`,
        };
    }

    if (conversions < 30) {
        return {
            level: 'low',
            reason: `${conversions} conversions - early signal, not statistically reliable`,
        };
    }

    if (conversions < 100) {
        return {
            level: 'medium',
            reason: `${conversions} conversions - moderate confidence, trends emerging`,
        };
    }

    return {
        level: 'high',
        reason: `${conversions} conversions - statistically significant sample`,
    };
}

/**
 * Detect alerts and trends from performance data
 */
export function detectAlerts(
    current: MetaAdsInsights,
    baseline: AccountBaseline,
    previous?: MetaAdsInsights
): ConversionAlert[] {
    const alerts: ConversionAlert[] = [];

    // CPA spike detection (>25% above baseline)
    if (current.cpa > baseline.avgCpa * 1.25) {
        const delta = ((current.cpa - baseline.avgCpa) / baseline.avgCpa) * 100;
        alerts.push({
            type: 'cpa_spike',
            severity: delta > 50 ? 'critical' : 'warning',
            message: `CPA ₱${current.cpa.toFixed(0)} is ${delta.toFixed(0)}% above account average`,
            value: current.cpa,
            threshold: baseline.avgCpa * 1.25,
            delta,
        });
    }

    // ROAS drop detection (<75% of baseline)
    if (current.roas < baseline.avgRoas * 0.75 && baseline.avgRoas > 0) {
        const delta = ((baseline.avgRoas - current.roas) / baseline.avgRoas) * 100;
        alerts.push({
            type: 'roas_drop',
            severity: delta > 50 ? 'critical' : 'warning',
            message: `ROAS ${current.roas.toFixed(2)}x is ${delta.toFixed(0)}% below account average`,
            value: current.roas,
            threshold: baseline.avgRoas * 0.75,
            delta,
        });
    }

    // CVR decline vs previous period
    if (previous && current.cvr < previous.cvr * 0.8) {
        const delta = ((previous.cvr - current.cvr) / previous.cvr) * 100;
        alerts.push({
            type: 'cvr_decline',
            severity: delta > 30 ? 'critical' : 'warning',
            message: `Conversion rate dropped ${delta.toFixed(0)}% vs previous period`,
            value: current.cvr,
            threshold: previous.cvr * 0.8,
            delta,
        });
    }

    return alerts;
}

/**
 * Analyze funnel drop-offs (requires CAPI data)
 */
export function analyzeFunnel(events: FunnelEvents): FunnelAnalysis {
    const stages: FunnelStage[] = [];

    // PageView → ViewContent
    if (events.pageViews > 0) {
        const rate = (events.viewContent / events.pageViews) * 100;
        stages.push({
            name: 'PageView → ViewContent',
            count: events.viewContent,
            rate,
            dropoff: 100 - rate,
            benchmark: 40, // 40% benchmark
            status: rate >= 30 ? 'healthy' : rate >= 15 ? 'warning' : 'critical',
        });
    }

    // ViewContent → AddToCart
    if (events.viewContent > 0) {
        const rate = (events.addToCart / events.viewContent) * 100;
        stages.push({
            name: 'ViewContent → AddToCart',
            count: events.addToCart,
            rate,
            dropoff: 100 - rate,
            benchmark: 15, // 15% benchmark
            status: rate >= 10 ? 'healthy' : rate >= 5 ? 'warning' : 'critical',
        });
    }

    // AddToCart → InitiateCheckout
    if (events.addToCart > 0) {
        const rate = (events.initiateCheckout / events.addToCart) * 100;
        stages.push({
            name: 'AddToCart → Checkout',
            count: events.initiateCheckout,
            rate,
            dropoff: 100 - rate,
            benchmark: 50, // 50% benchmark
            status: rate >= 40 ? 'healthy' : rate >= 25 ? 'warning' : 'critical',
        });
    }

    // InitiateCheckout → Purchase
    if (events.initiateCheckout > 0) {
        const rate = (events.purchase / events.initiateCheckout) * 100;
        stages.push({
            name: 'Checkout → Purchase',
            count: events.purchase,
            rate,
            dropoff: 100 - rate,
            benchmark: 65, // 65% benchmark
            status: rate >= 50 ? 'healthy' : rate >= 30 ? 'warning' : 'critical',
        });
    }

    // Find biggest dropoff
    const criticalStage = stages.reduce((worst, stage) =>
        stage.dropoff > (worst?.dropoff || 0) ? stage : worst, stages[0]);

    // Diagnose issue
    const diagnosis = diagnoseFunnelIssue(stages, events);

    return {
        stages,
        biggestDropoff: criticalStage?.name || 'unknown',
        dropoffRate: criticalStage?.dropoff || 0,
        diagnosis,
    };
}

function diagnoseFunnelIssue(stages: FunnelStage[], events: FunnelEvents): FunnelDiagnosis {
    // Check for tracking gaps
    if (events.pageViews > 0 && events.viewContent === 0) {
        return 'tracking_gaps';
    }

    // Find worst stage
    const critical = stages.find(s => s.status === 'critical');
    if (!critical) return 'healthy';

    if (critical.name.includes('PageView')) {
        return 'landing_page_friction';
    }
    if (critical.name.includes('ViewContent')) {
        return 'product_interest_low';
    }
    if (critical.name.includes('AddToCart')) {
        return 'cart_abandonment';
    }
    if (critical.name.includes('Checkout')) {
        return 'checkout_friction';
    }

    return 'offer_mismatch';
}

/**
 * Generate recommendations based on analysis
 */
export function generateRecommendations(
    output: Partial<ConversionOwnerOutput>,
    insights: MetaAdsInsights
): string[] {
    const recommendations: string[] = [];

    // Based on efficiency
    if (output.cpaEfficiency && output.cpaEfficiency < -20) {
        recommendations.push('CPA is high - review audience targeting and offer alignment');
    }
    if (output.roasEfficiency && output.roasEfficiency < -20) {
        recommendations.push('ROAS is below baseline - test stronger offers or higher-value audiences');
    }

    // Based on funnel
    if (output.funnelAnalysis) {
        const { diagnosis } = output.funnelAnalysis;
        switch (diagnosis) {
            case 'landing_page_friction':
                recommendations.push('Landing page has high bounce - test faster load time and clearer headline');
                break;
            case 'product_interest_low':
                recommendations.push('Low product engagement - test product imagery and copy');
                break;
            case 'cart_abandonment':
                recommendations.push('Cart abandonment is high - add urgency, trust badges, or free shipping');
                break;
            case 'checkout_friction':
                recommendations.push('Checkout drop-off detected - simplify form, add payment options');
                break;
            case 'offer_mismatch':
                recommendations.push('Ad promise may not match landing page - review copy alignment');
                break;
            case 'tracking_gaps':
                recommendations.push('Tracking issue detected - verify pixel/CAPI implementation');
                break;
        }
    }

    // Based on alerts
    if (output.alerts) {
        for (const alert of output.alerts) {
            if (alert.type === 'cpa_spike' && alert.severity === 'critical') {
                recommendations.push('Pause or reduce budget until CPA stabilizes');
            }
        }
    }

    // Based on confidence
    if (output.confidenceLevel === 'insufficient') {
        recommendations.push('Gather more data before making optimization decisions');
    }

    return recommendations;
}

// ==================== MAIN ANALYSIS FUNCTION ====================

/**
 * Run full Conversion Owner analysis
 */
export function analyzeConversion(
    insights: MetaAdsInsights,
    baseline: AccountBaseline,
    funnelEvents?: FunnelEvents,
    previousPeriod?: MetaAdsInsights
): ConversionOwnerOutput {
    // Compute efficiency
    const { score, cpaEfficiency, roasEfficiency } = computeEfficiencyScore(insights, baseline);

    // Compute confidence
    const { level: confidenceLevel, reason: confidenceReason } = computeConfidence(
        insights.conversions,
        insights.spend
    );

    // Detect alerts
    const alerts = detectAlerts(insights, baseline, previousPeriod);

    // Analyze funnel if CAPI data available
    const funnelAnalysis = funnelEvents ? analyzeFunnel(funnelEvents) : undefined;

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (previousPeriod) {
        const roasChange = insights.roas - previousPeriod.roas;
        const cpaChange = previousPeriod.cpa - insights.cpa;
        if (roasChange > 0.2 && cpaChange > 0) trend = 'improving';
        else if (roasChange < -0.2 || cpaChange < -5) trend = 'declining';
    }

    // Build partial output for recommendations
    const partialOutput: Partial<ConversionOwnerOutput> = {
        cpaEfficiency,
        roasEfficiency,
        funnelAnalysis,
        alerts,
        confidenceLevel,
    };

    // Generate recommendations
    const recommendations = generateRecommendations(partialOutput, insights);

    // Determine primary issue
    let primaryIssue: ConversionOwnerOutput['primaryIssue'] = 'none';
    if (funnelAnalysis) {
        const diagnosisMap: Record<FunnelDiagnosis, ConversionOwnerOutput['primaryIssue']> = {
            landing_page_friction: 'landing_page',
            product_interest_low: 'offer',
            cart_abandonment: 'checkout',
            checkout_friction: 'checkout',
            offer_mismatch: 'offer',
            tracking_gaps: 'tracking',
            healthy: 'none',
        };
        primaryIssue = diagnosisMap[funnelAnalysis.diagnosis];
    }

    return {
        efficiencyScore: score,
        cpaEfficiency,
        roasEfficiency,
        confidenceLevel,
        confidenceReason,
        sampleSize: insights.conversions,
        alerts,
        trend,
        trendPeriod: '7d',
        funnelAnalysis,
        recommendations,
        primaryIssue,
    };
}

// ==================== UTILITY FUNCTIONS ====================

export function getConfidenceColor(level: string): string {
    switch (level) {
        case 'high': return '#22c55e';
        case 'medium': return '#f59e0b';
        case 'low': return '#ef4444';
        default: return '#6b7280';
    }
}

export function getEfficiencyLabel(efficiency: number): string {
    if (efficiency >= 20) return '🚀 Outperforming';
    if (efficiency >= 0) return '✅ On Target';
    if (efficiency >= -20) return '⚠️ Below Average';
    return '🔴 Underperforming';
}

export function getDiagnosisLabel(diagnosis: FunnelDiagnosis): string {
    const labels: Record<FunnelDiagnosis, string> = {
        landing_page_friction: '🏠 Landing Page Friction',
        product_interest_low: '📦 Low Product Interest',
        cart_abandonment: '🛒 Cart Abandonment',
        checkout_friction: '💳 Checkout Friction',
        offer_mismatch: '🎯 Offer Mismatch',
        tracking_gaps: '📊 Tracking Issues',
        healthy: '✅ Healthy Funnel',
    };
    return labels[diagnosis];
}
