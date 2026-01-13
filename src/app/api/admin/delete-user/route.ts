import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function DELETE(request: NextRequest) {
    try {
        const { userId, requestingUserId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Prevent self-deletion
        if (userId === requestingUserId) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }

        // Create admin client with service role key
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // DEV BYPASS: Skip admin check for dev user (doesn't exist in DB)
        const isDevUser = requestingUserId === '00000000-0000-0000-0000-000000000001';

        if (!isDevUser) {
            // Verify the requesting user is an admin
            const { data: requestingProfile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('role')
                .eq('id', requestingUserId)
                .single();

            if (profileError || requestingProfile?.role !== 'admin') {
                return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
            }
        }

        // Delete the user from auth.users (this will cascade to profiles due to FK constraint)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('[Admin API] Error deleting user:', deleteError);
            return NextResponse.json({
                error: 'Failed to delete user',
                details: deleteError.message
            }, { status: 500 });
        }

        // Also explicitly delete from profiles (in case cascade didn't work)
        await supabaseAdmin.from('profiles').delete().eq('id', userId);

        console.log('[Admin API] Successfully deleted user:', userId);

        return NextResponse.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('[Admin API] Delete user error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
