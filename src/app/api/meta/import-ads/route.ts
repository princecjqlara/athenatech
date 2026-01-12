import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { metaApi } from '@/lib/meta/metaApi';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Import ads from Meta Ads API
 * Called after initial connection and by cron job for sync
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { user_id } = body;

        if (!user_id) {
            return NextResponse.json(
                { error: 'Missing user_id' },
                { status: 400 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get user's Meta integration
        const { data: integration, error: integrationError } = await supabase
            .from('meta_integrations')
            .select('*')
            .eq('user_id', user_id)
            .eq('is_active', true)
            .single();

        if (integrationError || !integration) {
            return NextResponse.json(
                { error: 'No active Meta integration found' },
                { status: 404 }
            );
        }

        const { access_token, ad_account_id } = integration;

        // Validate token
        const tokenStatus = await metaApi.validateToken(access_token);
        if (!tokenStatus.valid) {
            // Mark integration as inactive
            await supabase
                .from('meta_integrations')
                .update({ is_active: false })
                .eq('id', integration.id);

            return NextResponse.json(
                { error: 'Access token expired. Please reconnect.' },
                { status: 401 }
            );
        }

        console.log('[Meta Import] Starting import for account:', ad_account_id);

        // Fetch all data from Meta
        const [campaigns, adSets, ads] = await Promise.all([
            metaApi.getCampaigns(access_token, ad_account_id),
            metaApi.getAdSets(access_token, ad_account_id),
            metaApi.getAds(access_token, ad_account_id),
        ]);

        console.log('[Meta Import] Fetched:', {
            campaigns: campaigns.length,
            adSets: adSets.length,
            ads: ads.length,
        });

        // Upsert campaigns
        if (campaigns.length > 0) {
            const { error: campaignsError } = await supabase
                .from('meta_campaigns')
                .upsert(
                    campaigns.map(c => ({
                        id: c.id,
                        user_id,
                        name: c.name,
                        objective: c.objective,
                        status: c.status,
                        daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
                        lifetime_budget: c.lifetime_budget ? parseFloat(c.lifetime_budget) / 100 : null,
                        created_time: c.created_time,
                        updated_time: c.updated_time,
                        synced_at: new Date().toISOString(),
                    })),
                    { onConflict: 'id' }
                );

            if (campaignsError) {
                console.error('[Meta Import] Campaigns error:', campaignsError);
            }
        }

        // Upsert ad sets
        if (adSets.length > 0) {
            const { error: adSetsError } = await supabase
                .from('meta_adsets')
                .upsert(
                    adSets.map(as => ({
                        id: as.id,
                        user_id,
                        campaign_id: as.campaign_id,
                        name: as.name,
                        status: as.status,
                        daily_budget: as.daily_budget ? parseFloat(as.daily_budget) / 100 : null,
                        lifetime_budget: as.lifetime_budget ? parseFloat(as.lifetime_budget) / 100 : null,
                        targeting: as.targeting,
                        created_time: as.created_time,
                        synced_at: new Date().toISOString(),
                    })),
                    { onConflict: 'id' }
                );

            if (adSetsError) {
                console.error('[Meta Import] Ad sets error:', adSetsError);
            }
        }

        // Upsert ads with insights
        if (ads.length > 0) {
            const adsData = ads.map(ad => {
                const insights = ad.insights || {};
                const getActionValue = (actions: { action_type: string; value: string }[] | undefined, type: string) => {
                    const action = actions?.find(a => a.action_type === type);
                    return action ? parseFloat(action.value) : 0;
                };

                return {
                    id: ad.id,
                    user_id,
                    campaign_id: ad.campaign_id,
                    adset_id: ad.adset_id,
                    name: ad.name,
                    status: ad.status,
                    creative_id: ad.creative?.id,
                    thumbnail_url: ad.creative?.thumbnail_url || ad.creative?.image_url,
                    video_id: ad.creative?.video_id,
                    created_time: ad.created_time,
                    // Insights
                    spend: insights.spend ? parseFloat(insights.spend) : 0,
                    impressions: insights.impressions ? parseInt(insights.impressions) : 0,
                    clicks: insights.clicks ? parseInt(insights.clicks) : 0,
                    reach: insights.reach ? parseInt(insights.reach) : 0,
                    ctr: insights.ctr ? parseFloat(insights.ctr) : 0,
                    cpc: insights.cpc ? parseFloat(insights.cpc) : 0,
                    cpm: insights.cpm ? parseFloat(insights.cpm) : 0,
                    conversions: getActionValue(insights.actions, 'purchase') + getActionValue(insights.actions, 'lead'),
                    leads: getActionValue(insights.actions, 'lead'),
                    // Video metrics
                    video_p25: getActionValue(insights.video_p25_watched_actions, 'video_view'),
                    video_p50: getActionValue(insights.video_p50_watched_actions, 'video_view'),
                    video_p75: getActionValue(insights.video_p75_watched_actions, 'video_view'),
                    video_p95: getActionValue(insights.video_p95_watched_actions, 'video_view'),
                    video_thruplay: getActionValue(insights.video_thruplay_watched_actions, 'video_view'),
                    synced_at: new Date().toISOString(),
                };
            });

            const { error: adsError } = await supabase
                .from('meta_ads')
                .upsert(adsData, { onConflict: 'id' });

            if (adsError) {
                console.error('[Meta Import] Ads error:', adsError);
            }
        }

        // Update last sync time on integration
        await supabase
            .from('meta_integrations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', integration.id);

        return NextResponse.json({
            success: true,
            imported: {
                campaigns: campaigns.length,
                adSets: adSets.length,
                ads: ads.length,
            },
            synced_at: new Date().toISOString(),
        });

    } catch (error) {
        console.error('[Meta Import] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Import failed' },
            { status: 500 }
        );
    }
}

/**
 * GET handler to check import status
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('user_id');

    if (!userId) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get counts
    const [campaignsResult, adSetsResult, adsResult] = await Promise.all([
        supabase.from('meta_campaigns').select('id', { count: 'exact' }).eq('user_id', userId),
        supabase.from('meta_adsets').select('id', { count: 'exact' }).eq('user_id', userId),
        supabase.from('meta_ads').select('id', { count: 'exact' }).eq('user_id', userId),
    ]);

    return NextResponse.json({
        campaigns: campaignsResult.count || 0,
        adSets: adSetsResult.count || 0,
        ads: adsResult.count || 0,
    });
}
