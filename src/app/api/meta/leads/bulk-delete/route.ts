import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Bulk delete leads
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { user_id, lead_ids } = body;

        if (!user_id || !lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields: user_id, lead_ids (array)' },
                { status: 400 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Delete leads that belong to this user
        const { error, count } = await supabase
            .from('meta_leads')
            .delete({ count: 'exact' })
            .eq('user_id', user_id)
            .in('id', lead_ids);

        if (error) {
            console.error('[Leads API] Error deleting leads:', error);
            return NextResponse.json({ error: 'Failed to delete leads' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            deleted: count,
        });

    } catch (error) {
        console.error('[Leads API] Bulk delete error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete leads' },
            { status: 500 }
        );
    }
}
