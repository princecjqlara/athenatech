import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Debug endpoint to list ALL integrations
 */
export async function GET() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: integrations, error } = await supabase
        .from('meta_integrations')
        .select('id, user_id, ad_account_id, page_id, page_access_token, is_active, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        total: integrations?.length || 0,
        integrations: integrations?.map(i => ({
            ...i,
            has_page: !!i.page_id
        })) || []
    });
}
