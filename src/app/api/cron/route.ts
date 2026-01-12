import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { metaApi } from '@/lib/meta/metaApi';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Cron job endpoint - syncs ads and processes leads
 * Call this endpoint every 15 minutes via cron-job.org or similar
 */
export async function GET(request: NextRequest) {
    console.log('[Cron] Starting scheduled sync job at', new Date().toISOString());

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const results = {
            timestamp: new Date().toISOString(),
            jobs: [] as { name: string; status: string; details?: any }[],
        };

        // Job 1: Check Meta token health and sync ads for all active integrations
        const tokenResults = await syncAllActiveIntegrations(supabase);
        results.jobs.push({
            name: 'sync_meta_ads',
            status: 'completed',
            details: tokenResults,
        });

        // Job 2: Process any pending leads (from webhook queue if implemented)
        await processLeads(supabase);
        results.jobs.push({
            name: 'process_leads',
            status: 'completed',
        });

        console.log('[Cron] All jobs completed:', results);
        return NextResponse.json({
            success: true,
            message: 'Cron jobs executed successfully',
            ...results
        });

    } catch (error) {
        console.error('[Cron] Error executing jobs:', error);
        return NextResponse.json({
            error: 'Cron job failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

/**
 * Sync ads for all users with active Meta integrations
 */
async function syncAllActiveIntegrations(supabase: any) {
    // Get all active integrations
    const { data: integrations, error } = await supabase
        .from('meta_integrations')
        .select('*')
        .eq('is_active', true);

    if (error) {
        console.error('[Cron] Failed to fetch integrations:', error);
        return { synced: 0, errors: 1 };
    }

    let synced = 0;
    let expired = 0;
    let errors = 0;

    for (const integration of integrations || []) {
        try {
            // Check token validity
            const tokenStatus = await metaApi.validateToken(integration.access_token);

            if (!tokenStatus.valid) {
                console.log('[Cron] Token expired for user:', integration.user_id);
                await supabase
                    .from('meta_integrations')
                    .update({ is_active: false })
                    .eq('id', integration.id);
                expired++;
                continue;
            }

            // Fetch and sync ads
            const [campaigns, adSets, ads] = await Promise.all([
                metaApi.getCampaigns(integration.access_token, integration.ad_account_id),
                metaApi.getAdSets(integration.access_token, integration.ad_account_id),
                metaApi.getAds(integration.access_token, integration.ad_account_id),
            ]);

            // Upsert campaigns
            if (campaigns.length > 0) {
                await supabase
                    .from('meta_campaigns')
                    .upsert(
                        campaigns.map(c => ({
                            id: c.id,
                            user_id: integration.user_id,
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
            }

            // Upsert ad sets
            if (adSets.length > 0) {
                await supabase
                    .from('meta_adsets')
                    .upsert(
                        adSets.map(as => ({
                            id: as.id,
                            user_id: integration.user_id,
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
            }

            // Upsert ads with insights
            if (ads.length > 0) {
                const adsData = ads.map(ad => {
                    const insights = ad.insights || {};
                    const getActionValue = (actions: any[] | undefined, type: string) => {
                        const action = actions?.find(a => a.action_type === type);
                        return action ? parseFloat(action.value) : 0;
                    };

                    return {
                        id: ad.id,
                        user_id: integration.user_id,
                        campaign_id: ad.campaign_id,
                        adset_id: ad.adset_id,
                        name: ad.name,
                        status: ad.status,
                        creative_id: ad.creative?.id,
                        thumbnail_url: ad.creative?.thumbnail_url || ad.creative?.image_url,
                        video_id: ad.creative?.video_id,
                        created_time: ad.created_time,
                        spend: insights.spend ? parseFloat(insights.spend) : 0,
                        impressions: insights.impressions ? parseInt(insights.impressions) : 0,
                        clicks: insights.clicks ? parseInt(insights.clicks) : 0,
                        reach: insights.reach ? parseInt(insights.reach) : 0,
                        ctr: insights.ctr ? parseFloat(insights.ctr) : 0,
                        cpc: insights.cpc ? parseFloat(insights.cpc) : 0,
                        cpm: insights.cpm ? parseFloat(insights.cpm) : 0,
                        conversions: getActionValue(insights.actions, 'purchase') + getActionValue(insights.actions, 'lead'),
                        leads: getActionValue(insights.actions, 'lead'),
                        video_p25: getActionValue(insights.video_p25_watched_actions, 'video_view'),
                        video_p50: getActionValue(insights.video_p50_watched_actions, 'video_view'),
                        video_p75: getActionValue(insights.video_p75_watched_actions, 'video_view'),
                        video_p95: getActionValue(insights.video_p95_watched_actions, 'video_view'),
                        video_thruplay: getActionValue(insights.video_thruplay_watched_actions, 'video_view'),
                        synced_at: new Date().toISOString(),
                    };
                });

                await supabase
                    .from('meta_ads')
                    .upsert(adsData, { onConflict: 'id' });
            }

            // Update last sync time
            await supabase
                .from('meta_integrations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', integration.id);

            synced++;
            console.log('[Cron] Synced user:', integration.user_id, { campaigns: campaigns.length, ads: ads.length });

        } catch (syncError) {
            console.error('[Cron] Error syncing user:', integration.user_id, syncError);
            errors++;
        }
    }

    return { synced, expired, errors, total: integrations?.length || 0 };
}

/**
 * Process any pending leads
 */
async function processLeads(supabase: any) {
    console.log('[Cron] Processing pending leads...');

    // Get leads that haven't been processed yet (status = 'new')
    const { data: pendingLeads, error } = await supabase
        .from('meta_leads')
        .select('*')
        .eq('status', 'new')
        .limit(50);

    if (error) {
        console.error('[Cron] Error fetching pending leads:', error);
        return;
    }

    for (const lead of pendingLeads || []) {
        try {
            // Mark as processing
            await supabase
                .from('meta_leads')
                .update({ status: 'contacted' })
                .eq('id', lead.id);

            console.log('[Cron] Processed lead:', lead.id);
        } catch (e) {
            console.error('[Cron] Error processing lead:', lead.id, e);
        }
    }

    console.log('[Cron] Processed', pendingLeads?.length || 0, 'leads');
}
