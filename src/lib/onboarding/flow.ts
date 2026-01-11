/**
 * Onboarding Flow
 * 
 * GAP 3: Set correct expectations before first use.
 * 2 screens max, blocking, one-time only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ==================== CONSTANTS ====================

export const CURRENT_ONBOARDING_VERSION = 1;

// ==================== TYPES ====================

export interface OnboardingState {
    completed: boolean;
    completedAt?: Date;
    version: number;
}

export interface OnboardingScreen {
    id: string;
    title: string;
    content: string[];
    buttonText: string;
}

// ==================== SCREEN CONTENT ====================

export const ONBOARDING_SCREENS: OnboardingScreen[] = [
    {
        id: 'how-athena-works',
        title: '🔬 ATHENA Observes, Never Guesses',
        content: [
            'ATHENA analyzes your ad performance based on observable facts only.',
            '',
            'What this means:',
            '✓ No scores until enough data exists',
            '✓ "Insufficient data" is a normal state',
            '✓ Recommendations are hypotheses, not orders',
            '✓ All results are specific to YOUR account',
            '',
            'ATHENA will stay silent rather than guess.'
        ],
        buttonText: 'Continue'
    },
    {
        id: 'what-to-expect',
        title: '📊 What to Expect',
        content: [
            'During your first 48 hours:',
            '→ Most sections will show "Gathering data"',
            '→ This is normal and expected',
            '',
            'After gathering data:',
            '→ Recommendations appear as testable ideas',
            '→ Confidence levels indicate data quality',
            '→ "Medium confidence" means real uncertainty',
            '',
            '⚠️ ATHENA recommendations are experiments,',
            '    not guarantees. Track results carefully.'
        ],
        buttonText: 'I Understand — Let\'s Start'
    }
];

// ==================== LOGIC ====================

/**
 * Check if onboarding should be shown.
 */
export async function shouldShowOnboarding(
    supabase: SupabaseClient,
    userId: string
): Promise<boolean> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_version')
        .eq('id', userId)
        .single();

    if (!profile) {
        // New user, show onboarding
        return true;
    }

    if (!profile.onboarding_completed) {
        return true;
    }

    // Re-trigger only for major version changes (not currently planned)
    // if (profile.onboarding_version < CURRENT_ONBOARDING_VERSION) {
    //     return true;
    // }

    return false;
}

/**
 * Mark onboarding as complete.
 */
export async function completeOnboarding(
    supabase: SupabaseClient,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
        .from('profiles')
        .update({
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
            onboarding_version: CURRENT_ONBOARDING_VERSION
        })
        .eq('id', userId);

    return { success: !error, error: error?.message };
}

/**
 * Get onboarding state for a user.
 */
export async function getOnboardingState(
    supabase: SupabaseClient,
    userId: string
): Promise<OnboardingState> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_completed_at, onboarding_version')
        .eq('id', userId)
        .single();

    return {
        completed: profile?.onboarding_completed ?? false,
        completedAt: profile?.onboarding_completed_at
            ? new Date(profile.onboarding_completed_at)
            : undefined,
        version: profile?.onboarding_version ?? 0
    };
}
