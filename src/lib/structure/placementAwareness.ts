/**
 * Placement-Aware Scoring
 * 
 * Ensures delivery scores are context-specific per placement.
 * Detects aspect ratio mismatches that may degrade performance.
 */

// ==================== PLACEMENT DEFINITIONS ====================

export type Placement =
    | 'feed'
    | 'reels'
    | 'stories'
    | 'audience_network'
    | 'messenger'
    | 'right_column'
    | 'search'
    | 'unknown';

export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9' | '2:3' | 'other';

/**
 * Accepted aspect ratios per placement
 */
export const PLACEMENT_ASPECT_RATIOS: Record<Placement, { accepted: AspectRatio[]; optimal: AspectRatio }> = {
    feed: {
        accepted: ['1:1', '4:5', '16:9'],
        optimal: '1:1',
    },
    reels: {
        accepted: ['9:16'],
        optimal: '9:16',
    },
    stories: {
        accepted: ['9:16'],
        optimal: '9:16',
    },
    audience_network: {
        accepted: ['16:9', '1:1'],
        optimal: '16:9',
    },
    messenger: {
        accepted: ['1:1', '4:5'],
        optimal: '1:1',
    },
    right_column: {
        accepted: ['1:1'],
        optimal: '1:1',
    },
    search: {
        accepted: ['1:1', '16:9'],
        optimal: '1:1',
    },
    unknown: {
        accepted: ['1:1', '4:5', '9:16', '16:9'],
        optimal: '1:1',
    },
};

// ==================== OBJECTIVE DEFINITIONS ====================

export type CampaignObjective =
    | 'CONVERSIONS'
    | 'LEAD_GENERATION'
    | 'TRAFFIC'
    | 'ENGAGEMENT'
    | 'APP_INSTALLS'
    | 'VIDEO_VIEWS'
    | 'REACH'
    | 'AWARENESS'
    | 'SALES'
    | 'unknown';

// ==================== MISMATCH DETECTION ====================

export interface AspectRatioMismatch {
    mismatch: boolean;
    severity: 'critical' | 'warning' | 'none';
    warning: string;
    suggestion?: string;
}

/**
 * Detect aspect ratio mismatch for a placement
 */
export function detectAspectRatioMismatch(
    creativeAspectRatio: AspectRatio,
    placement: Placement
): AspectRatioMismatch {
    const config = PLACEMENT_ASPECT_RATIOS[placement];

    if (!config) {
        return { mismatch: false, severity: 'none', warning: '' };
    }

    // Check if accepted
    if (config.accepted.includes(creativeAspectRatio)) {
        // Accepted but not optimal
        if (creativeAspectRatio !== config.optimal) {
            return {
                mismatch: false,
                severity: 'warning',
                warning: `${creativeAspectRatio} is accepted in ${placement}, but ${config.optimal} is optimal.`,
                suggestion: `Consider creating a ${config.optimal} version for better ${placement} performance.`,
            };
        }
        return { mismatch: false, severity: 'none', warning: '' };
    }

    // Not accepted - will be cropped/letterboxed
    return {
        mismatch: true,
        severity: 'critical',
        warning: `This ${creativeAspectRatio} creative will be cropped or letterboxed in ${placement} (expects ${config.accepted.join(' or ')}).`,
        suggestion: `Create a ${config.optimal} version for ${placement} to avoid cropping.`,
    };
}

// ==================== PLACEMENT-SPECIFIC BENCHMARKS ====================

export interface PlacementBenchmarks {
    thumbstop: { low: number; medium: number; high: number };
    holdRate: { low: number; medium: number; high: number };
    ctrMultiplier: number;  // Relative to account baseline
}

export const PLACEMENT_BENCHMARKS: Record<Placement, PlacementBenchmarks> = {
    feed: {
        thumbstop: { low: 0.15, medium: 0.25, high: 0.35 },
        holdRate: { low: 0.10, medium: 0.20, high: 0.30 },
        ctrMultiplier: 1.0,
    },
    reels: {
        thumbstop: { low: 0.20, medium: 0.35, high: 0.50 },
        holdRate: { low: 0.15, medium: 0.30, high: 0.45 },
        ctrMultiplier: 0.7,  // Lower CTR expected due to format
    },
    stories: {
        thumbstop: { low: 0.25, medium: 0.40, high: 0.55 },
        holdRate: { low: 0.20, medium: 0.35, high: 0.50 },
        ctrMultiplier: 0.8,
    },
    audience_network: {
        thumbstop: { low: 0.10, medium: 0.18, high: 0.25 },
        holdRate: { low: 0.08, medium: 0.15, high: 0.22 },
        ctrMultiplier: 1.5,  // Higher CTR expected
    },
    messenger: {
        thumbstop: { low: 0.15, medium: 0.25, high: 0.35 },
        holdRate: { low: 0.12, medium: 0.22, high: 0.32 },
        ctrMultiplier: 1.2,
    },
    right_column: {
        thumbstop: { low: 0.05, medium: 0.10, high: 0.15 },
        holdRate: { low: 0.03, medium: 0.08, high: 0.12 },
        ctrMultiplier: 0.5,
    },
    search: {
        thumbstop: { low: 0.10, medium: 0.20, high: 0.30 },
        holdRate: { low: 0.08, medium: 0.15, high: 0.22 },
        ctrMultiplier: 1.3,
    },
    unknown: {
        thumbstop: { low: 0.15, medium: 0.25, high: 0.35 },
        holdRate: { low: 0.10, medium: 0.20, high: 0.30 },
        ctrMultiplier: 1.0,
    },
};

// ==================== SCORING CONTEXT ====================

export interface ScoringContext {
    placement: Placement;
    objective?: CampaignObjective;
    aspectRatioMismatch?: AspectRatioMismatch;
}

/**
 * Validate scoring context before scoring
 */
export function validateScoringContext(context: Partial<ScoringContext>): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!context.placement || context.placement === 'unknown') {
        errors.push('Cannot score without placement context. Scores are placement-specific.');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Get placement-specific benchmarks
 */
export function getPlacementBenchmarks(placement: Placement): PlacementBenchmarks {
    return PLACEMENT_BENCHMARKS[placement] || PLACEMENT_BENCHMARKS.unknown;
}

/**
 * Parse aspect ratio from dimensions
 */
export function parseAspectRatio(width: number, height: number): AspectRatio {
    const ratio = width / height;

    if (Math.abs(ratio - 1) < 0.05) return '1:1';
    if (Math.abs(ratio - 0.8) < 0.05) return '4:5';
    if (Math.abs(ratio - 0.5625) < 0.05) return '9:16';
    if (Math.abs(ratio - 1.778) < 0.05) return '16:9';
    if (Math.abs(ratio - 0.667) < 0.05) return '2:3';

    return 'other';
}
