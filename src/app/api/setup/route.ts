import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin user setup endpoint - used to create the first admin
export async function POST(request: NextRequest) {
    try {
        const { email, password, fullName } = await request.json();

        // Use service role client for admin operations
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Create the user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                full_name: fullName,
            },
        });

        if (authError) {
            console.error('Error creating user:', authError);
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        if (!authData.user) {
            return NextResponse.json({ error: 'User not created' }, { status: 500 });
        }

        // Create profile and set as admin
        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
            id: authData.user.id,
            email: authData.user.email,
            full_name: fullName,
            role: 'admin',
            is_suspended: false,
        });

        if (profileError) {
            console.error('Error creating profile:', profileError);
            return NextResponse.json({ error: profileError.message }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            message: 'Admin user created successfully',
            user: {
                id: authData.user.id,
                email: authData.user.email,
                role: 'admin',
            },
        });
    } catch (error) {
        console.error('Error in setup:', error);
        return NextResponse.json(
            { error: 'Setup failed', message: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
