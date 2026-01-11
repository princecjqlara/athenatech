import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Get leads for a user
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Build query
        let query = supabase
            .from('meta_leads')
            .select('*', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_time', { ascending: false })
            .range(offset, offset + limit - 1);

        // Filter by status if provided
        if (status) {
            query = query.eq('status', status);
        }

        const { data: leads, count, error } = await query;

        if (error) {
            console.error('[Leads API] Error fetching leads:', error);
            return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
        }

        // Get status counts
        const { data: statusCounts } = await supabase
            .from('meta_leads')
            .select('status')
            .eq('user_id', userId);

        const counts = {
            total: count || 0,
            new: statusCounts?.filter(l => l.status === 'new').length || 0,
            contacted: statusCounts?.filter(l => l.status === 'contacted').length || 0,
            qualified: statusCounts?.filter(l => l.status === 'qualified').length || 0,
            converted: statusCounts?.filter(l => l.status === 'converted').length || 0,
        };

        return NextResponse.json({
            leads: leads || [],
            counts,
            pagination: {
                limit,
                offset,
                total: count || 0,
            },
        });

    } catch (error) {
        console.error('[Leads API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch leads' },
            { status: 500 }
        );
    }
}

/**
 * Update a lead's status
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { lead_id, status, user_id } = body;

        if (!lead_id || !status || !user_id) {
            return NextResponse.json(
                { error: 'Missing required fields: lead_id, status, user_id' },
                { status: 400 }
            );
        }

        const validStatuses = ['new', 'contacted', 'qualified', 'converted', 'lost'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
                { status: 400 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('meta_leads')
            .update({
                status,
                updated_at: new Date().toISOString(),
            })
            .eq('id', lead_id)
            .eq('user_id', user_id)
            .select()
            .single();

        if (error) {
            console.error('[Leads API] Error updating lead:', error);
            return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
        }

        return NextResponse.json({ success: true, lead: data });

    } catch (error) {
        console.error('[Leads API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update lead' },
            { status: 500 }
        );
    }
}
