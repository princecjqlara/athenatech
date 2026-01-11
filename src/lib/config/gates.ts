/**
 * Gate Configuration
 * 
 * Centralized thresholds for all gating logic.
 * These values control when the system provides scores and recommendations.
 */

export const GATE_CONFIG = {
    // ==================== AGE GATE ====================
    // Wait before scoring delivery (hours)
    AGE_GATE_HOURS: 48,

    // ==================== SPEND GATE ====================
    // Minimum spend before strong recommendations (PHP)
    SPEND_GATE_PHP: 1000,

    // ==================== IMPRESSION THRESHOLDS ====================
    // For delivery classification confidence
    IMPRESSIONS_MEDIUM: 1000,   // Medium confidence
    IMPRESSIONS_HIGH: 5000,     // High confidence

    // ==================== CONVERSION THRESHOLDS ====================
    // For conversion efficiency scoring
    CONVERSIONS_INSUFFICIENT: 10,  // No signal below this
    CONVERSIONS_LOW: 30,           // Low confidence
    CONVERSIONS_MEDIUM: 100,       // Medium → High threshold

    // ==================== NARRATIVE SYSTEM THRESHOLDS ====================
    // Minimum conversions for System 2 activation
    NARRATIVE_MIN_CONVERSIONS: 30,

    // ==================== iOS/ATTRIBUTION PENALTIES ====================
    // iOS traffic thresholds
    IOS_TRAFFIC_PENALTY_THRESHOLD: 0.40,    // >40% iOS → medium confidence max
    IOS_TRAFFIC_CRITICAL_THRESHOLD: 0.60,   // >60% iOS → low confidence max

    // Modeled conversions threshold
    MODELED_CONVERSION_PENALTY: 0.30,       // >30% modeled → confidence penalty

    // ==================== OUTCOME MEASUREMENT ====================
    // Days to wait before measuring recommendation outcomes
    OUTCOME_WAIT_DAYS: 7,

    // Minimum conversions for outcome verdict
    OUTCOME_MIN_CONVERSIONS: 30,

    // ==================== META-LEARNING ====================
    // Minimum samples for account patterns
    ACCOUNT_PATTERN_MIN_SAMPLES: 3,

    // Recency decay (days) for patterns
    PATTERN_RECENCY_DAYS: 60,

    // k-anonymity for cross-account patterns
    K_ANONYMITY_MINIMUM: 10,
} as const;

// Type for accessing config values
export type GateConfigKey = keyof typeof GATE_CONFIG;
