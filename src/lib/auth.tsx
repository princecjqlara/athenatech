'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { User, Session } from '@supabase/supabase-js';
import { saveAccount } from './savedAccounts';

export type UserRole = 'admin' | 'user';

export interface UserProfile {
    id: string;
    email: string;
    role: UserRole;
    full_name?: string;
    invited_by?: string;
    invite_code?: string;
    is_suspended: boolean;
    created_at: string;
}

interface AuthContextType {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string, inviteCode: string, fullName?: string) => Promise<{ error: Error | null }>;
    signInWithGoogle: () => Promise<{ error: Error | null }>;
    signInWithFacebook: () => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ⚠️ DEV ONLY: Set to true to bypass authentication
const DEV_BYPASS_AUTH = true;

const DEV_MOCK_PROFILE: UserProfile = {
    id: 'dev-user-001',
    email: 'dev@athena.local',
    role: 'admin',
    full_name: 'Developer',
    is_suspended: false,
    created_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // DEV BYPASS: Skip auth and use mock user
        if (DEV_BYPASS_AUTH && process.env.NODE_ENV === 'development') {
            setProfile(DEV_MOCK_PROFILE);
            setUser({ id: 'dev-user-001', email: 'dev@athena.local' } as User);
            setLoading(false);
            return;
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    await fetchProfile(session.user.id);
                } else {
                    setProfile(null);
                    setLoading(false);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    async function fetchProfile(userId: string) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error('Error fetching profile:', error);
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }

    async function signIn(email: string, password: string) {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Save account for quick sign-in again
            saveAccount({ email });

            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    }

    async function signUp(email: string, password: string, inviteCode: string, fullName?: string) {
        try {
            // Verify invite code first
            const { data: invite, error: inviteError } = await supabase
                .from('invite_codes')
                .select('*')
                .eq('code', inviteCode)
                .eq('is_used', false)
                .single();

            if (inviteError || !invite) {
                throw new Error('Invalid or expired invite code');
            }

            // Create user account
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        invite_code: inviteCode,
                    },
                },
            });

            if (authError) throw authError;

            // Mark invite code as used
            if (authData.user) {
                // Small delay to ensure the profile trigger has completed
                await new Promise(resolve => setTimeout(resolve, 500));

                const { error: updateError } = await supabase
                    .from('invite_codes')
                    .update({
                        is_used: true,
                        used_by: authData.user.id,
                        used_at: new Date().toISOString(),
                    })
                    .eq('code', inviteCode);

                if (updateError) {
                    console.error('Failed to mark invite code as used:', updateError);
                }
            }

            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    }

    async function signOut() {
        // Clear all auth state
        setUser(null);
        setProfile(null);
        setSession(null);

        // Only call Supabase signOut if not in dev bypass mode
        if (!DEV_BYPASS_AUTH) {
            await supabase.auth.signOut();
        }

        // Redirect to login page
        window.location.href = '/login';
    }

    async function signInWithGoogle() {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                },
            });

            if (error) throw error;
            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    }

    async function signInWithFacebook() {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'facebook',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                },
            });

            if (error) throw error;
            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    }

    const value = {
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithFacebook,
        signOut,
        isAdmin: profile?.role === 'admin',
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
