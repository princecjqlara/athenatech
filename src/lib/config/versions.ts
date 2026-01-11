/**
 * Version Configuration
 * 
 * Tracks schema and model versions for all scoring components.
 * Update these when making breaking changes.
 */

export const SCORING_VERSIONS = {
    // Structure system schema version
    STRUCTURE_SCHEMA: '1.0',

    // Scoring model version (update when algorithm changes)
    SCORING_MODEL: '1.0',

    // Gating rules version (update when thresholds change)
    GATING_RULES: '1.0',

    // Recommendation engine version
    RECOMMENDATION_ENGINE: '1.0',

    // Narrative checklist schema version
    CHECKLIST_SCHEMA: '1.0',
} as const;

export type ScoringVersionKey = keyof typeof SCORING_VERSIONS;

/**
 * Get all versions as a flat object for storage.
 */
export function getVersionsForStorage(): Record<string, string> {
    return {
        structure_schema_version: SCORING_VERSIONS.STRUCTURE_SCHEMA,
        scoring_model_version: SCORING_VERSIONS.SCORING_MODEL,
        gating_rules_version: SCORING_VERSIONS.GATING_RULES,
    };
}

/**
 * Compare stored version with current version.
 * Returns true if stored version is outdated.
 */
export function isVersionOutdated(
    storedVersion: string,
    versionKey: ScoringVersionKey
): boolean {
    const current = SCORING_VERSIONS[versionKey];
    return storedVersion !== current;
}
