/**
 * Privacy Settings
 * 
 * GAP 4: User opt-out for aggregated sharing.
 * Default: opted-in. Does not affect user's own insights.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ==================== TYPES ====================

export interface PrivacySettings {
    shareAggregates: boolean;
    shareAggregatesUpdatedAt?: Date;
}

// ==================== DEFAULTS ====================

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
    shareAggregates: true  // Default opted-in
};

// ==================== OPERATIONS ====================

/**
 * Get privacy settings for a user.
 */
export async function getPrivacySettings(
    supabase: SupabaseClient,
    userId: string
): Promise<PrivacySettings> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('share_aggregates, share_aggregates_updated_at')
        .eq('id', userId)
        .single();

    return {
        shareAggregates: profile?.share_aggregates ?? DEFAULT_PRIVACY_SETTINGS.shareAggregates,
        shareAggregatesUpdatedAt: profile?.share_aggregates_updated_at
            ? new Date(profile.share_aggregates_updated_at)
            : undefined
    };
}

/**
 * Update privacy settings.
 */
export async function updatePrivacySettings(
    supabase: SupabaseClient,
    userId: string,
    settings: Partial<PrivacySettings>
): Promise<{ success: boolean; error?: string }> {
    const updates: Record<string, unknown> = {};

    if (settings.shareAggregates !== undefined) {
        updates.share_aggregates = settings.shareAggregates;
        updates.share_aggregates_updated_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
        return { success: true };
    }

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

    return { success: !error, error: error?.message };
}

/**
 * Get eligible user IDs for aggregation (those who opted in).
 */
export async function getEligibleUsersForAggregation(
    supabase: SupabaseClient
): Promise<string[]> {
    const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('share_aggregates', true);

    return data?.map(p => p.id) ?? [];
}

/**
 * Check if user is eligible for aggregation.
 */
export async function isUserEligibleForAggregation(
    supabase: SupabaseClient,
    userId: string
): Promise<boolean> {
    const settings = await getPrivacySettings(supabase, userId);
    return settings.shareAggregates;
}

// ==================== UI COPY ====================

export const PRIVACY_COPY = {
    toggle: {
        label: 'Contribute to Community Insights',
        description: 'Include my patterns in anonymous cross-account learnings',
        helpText: [
            'Your data is never shared individually.',
            'Only patterns seen across 10+ accounts are used,',
            'and they cannot be traced back to you.',
            '',
            'Opting out will not affect your own insights or recommendations.'
        ].join('\n')
    },
    optOutConfirmation:
        'You\'ve opted out of community insights. ' +
        'Your data will not be included in cross-account patterns. ' +
        'Your own account insights remain fully functional.'
};
