import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET - Fetch user's Meta integration
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    if (!userId) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
        .from('meta_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('[Meta Integration] Error fetching integration:', error);
        return NextResponse.json({ error: 'Failed to fetch integration' }, { status: 500 });
    }

    return NextResponse.json({
        integration: data || null,
    });
}

/**
 * DELETE - Disconnect/deactivate Meta integration
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { user_id } = body;

        if (!user_id) {
            return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Mark integration as inactive (don't delete, preserve history)
        const { error } = await supabase
            .from('meta_integrations')
            .update({
                is_active: false,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user_id);

        if (error) {
            console.error('[Meta Integration] Error deactivating integration:', error);
            return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Meta Integration] Delete error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
