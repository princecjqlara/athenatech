import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Debug endpoint to check integration status
 */
export async function GET(request: NextRequest) {
    const userId = request.nextUrl.searchParams.get('user_id');

    if (!userId) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: integrations, error } = await supabase
        .from('meta_integrations')
        .select('id, user_id, ad_account_id, page_id, page_access_token, is_active, updated_at')
        .eq('user_id', userId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const integration = integrations?.[0];

    return NextResponse.json({
        total_records: integrations?.length || 0,
        integration: integration || null,
        has_page: !!integration?.page_id,
        page_id: integration?.page_id || null,
        message: !integration
            ? 'NO INTEGRATION FOUND - please connect Meta account'
            : integration?.page_id
                ? 'Page is connected - should sync leads'
                : 'NO PAGE CONNECTED - reconnect and select a page'
    });
}
