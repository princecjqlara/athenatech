import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Get campaigns with ad sets and ads for a user
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    let userId = searchParams.get('user_id');

    if (!userId) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // DEV BYPASS: If dev user ID, find any user with Meta integration
        const isDevUser = userId === '00000000-0000-0000-0000-000000000001';

        if (isDevUser) {
            // Find any user with an active Meta integration
            const { data: anyIntegration } = await supabase
                .from('meta_integrations')
                .select('user_id')
                .eq('is_active', true)
                .limit(1)
                .single();

            if (anyIntegration) {
                userId = anyIntegration.user_id;
            }
        }

        // Check if user has Meta integration
        const { data: integration, error: integrationError } = await supabase
            .from('meta_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

        if (integrationError || !integration) {
            return NextResponse.json({
                connected: false,
                campaigns: [],
            });
        }

        // Fetch campaigns
        const { data: campaigns, error: campaignsError } = await supabase
            .from('meta_campaigns')
            .select('*')
            .eq('user_id', userId)
            .order('created_time', { ascending: false });

        if (campaignsError) {
            console.error('[Campaigns API] Error fetching campaigns:', campaignsError);
            return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
        }

        // Fetch ad sets
        const { data: adsets, error: adsetsError } = await supabase
            .from('meta_adsets')
            .select('*')
            .eq('user_id', userId);

        if (adsetsError) {
            console.error('[Campaigns API] Error fetching ad sets:', adsetsError);
        }

        // Fetch ads
        const { data: ads, error: adsError } = await supabase
            .from('meta_ads')
            .select('*')
            .eq('user_id', userId);

        if (adsError) {
            console.error('[Campaigns API] Error fetching ads:', adsError);
        }

        // Build hierarchical structure
        const adsetsWithAds = (adsets || []).map(adset => ({
            ...adset,
            ads: (ads || []).filter(ad => ad.adset_id === adset.id),
        }));

        const campaignsWithData = (campaigns || []).map(campaign => ({
            ...campaign,
            adsets: adsetsWithAds.filter(adset => adset.campaign_id === campaign.id),
        }));

        return NextResponse.json({
            connected: true,
            campaigns: campaignsWithData,
            totals: {
                campaigns: campaigns?.length || 0,
                adsets: adsets?.length || 0,
                ads: ads?.length || 0,
            },
        });

    } catch (error) {
        console.error('[Campaigns API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch campaigns' },
            { status: 500 }
        );
    }
}
