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

        // Sync leads from lead forms if page_id is available
        let leadsImported = 0;
        console.log('[Meta Import] Integration page_id:', integration.page_id);

        if (integration.page_id) {
            console.log('[Meta Import] Syncing leads from page:', integration.page_id);

            try {
                // Get all lead forms for the page
                const leadForms = await metaApi.getLeadForms(access_token, integration.page_id);
                console.log('[Meta Import] Found', leadForms.length, 'lead forms');

                for (const form of leadForms) {
                    // Get leads from each form
                    const leads = await metaApi.getFormLeads(access_token, form.id, 100);

                    for (const lead of leads) {
                        // Try to get AI analysis for the lead
                        let aiAnalysis = null;
                        try {
                            const baseUrl = process.env.NEXT_PUBLIC_NGROK_URL || process.env.NEXT_PUBLIC_APP_URL || '';
                            const aiResponse = await fetch(`${baseUrl}/api/ai`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    action: 'analyze_lead',
                                    data: {
                                        leadId: lead.id,
                                        fieldData: lead.field_data,
                                        campaignName: campaigns.find(c => c.id === lead.campaign_id)?.name,
                                        adName: ads.find(a => a.id === lead.ad_id)?.name,
                                    },
                                }),
                            });
                            if (aiResponse.ok) {
                                const aiData = await aiResponse.json();
                                if (aiData.success && aiData.analysis) {
                                    aiAnalysis = typeof aiData.analysis === 'string'
                                        ? JSON.parse(aiData.analysis)
                                        : aiData.analysis;
                                }
                            }
                        } catch (aiError) {
                            console.warn('[Meta Import] AI analysis failed for lead:', lead.id, aiError);
                        }

                        // Extract contact details from field_data as fallback
                        const getField = (names: string[]) => {
                            for (const name of names) {
                                const field = lead.field_data.find(f =>
                                    f.name.toLowerCase().includes(name.toLowerCase())
                                );
                                if (field && field.values.length > 0) return field.values[0];
                            }
                            return null;
                        };

                        const leadData = {
                            id: lead.id,
                            user_id,
                            ad_id: lead.ad_id || null,
                            adset_id: lead.adset_id || null,
                            campaign_id: lead.campaign_id || null,
                            form_id: lead.form_id || form.id,
                            page_id: integration.page_id,
                            created_time: lead.created_time,
                            field_data: lead.field_data,
                            // Extracted contact details
                            full_name: aiAnalysis?.contact_details?.full_name || getField(['name', 'full_name']),
                            email: aiAnalysis?.contact_details?.email || getField(['email', 'mail']),
                            phone: aiAnalysis?.contact_details?.phone || getField(['phone', 'mobile', 'tel']),
                            // AI analysis
                            ai_summary: aiAnalysis?.conversation_analysis?.summary || null,
                            ai_sentiment: aiAnalysis?.conversation_analysis?.sentiment || null,
                            ai_intent: aiAnalysis?.conversation_analysis?.intent || null,
                            lead_quality: aiAnalysis?.lead_quality || null,
                            engagement_score: aiAnalysis?.engagement_score || null,
                            next_actions: aiAnalysis?.next_actions || null,
                            status: 'new',
                            synced_at: new Date().toISOString(),
                        };

                        const { error: leadError } = await supabase
                            .from('meta_leads')
                            .upsert(leadData, { onConflict: 'id' });

                        if (!leadError) {
                            leadsImported++;
                        }
                    }
                }
            } catch (leadSyncError) {
                console.error('[Meta Import] Lead sync error:', leadSyncError);
            }
        }

        console.log('[Meta Import] Synced', leadsImported, 'leads from forms');

        // Sync Messenger conversations (contacts from engagement/sales ads)
        let conversationsImported = 0;
        let aiAnalyzedCount = 0; // Limit AI analysis to prevent timeout
        const AI_ANALYSIS_LIMIT = 20; // Analyze max 20 contacts per sync
        const pageToken = integration.page_access_token || access_token;

        if (integration.page_id && integration.page_access_token) {
            console.log('[Meta Import] Syncing Messenger conversations from page:', integration.page_id);

            try {
                const conversations = await metaApi.getPageConversations(pageToken, integration.page_id, 500);
                console.log('[Meta Import] Found', conversations.length, 'conversations');

                for (const conv of conversations) {
                    console.log('[Meta Import] Processing conversation:', conv.id, 'participants:', JSON.stringify(conv.participants));

                    // Get participant info (the user who messaged, not the page)
                    const allParticipants = conv.participants?.data || [];
                    const participant = allParticipants.find((p: any) =>
                        String(p.id) !== String(integration.page_id)
                    ) || allParticipants[0]; // Fallback to first participant if comparison fails

                    if (!participant) {
                        console.log('[Meta Import] No participant found for conversation:', conv.id);
                        continue;
                    }

                    console.log('[Meta Import] Found participant:', participant.name, participant.id);

                    // Skip duplicate check - let upsert handle it
                    // const { data: existing } = await supabase
                    //     .from('meta_leads')
                    //     .select('id')
                    //     .eq('id', `conv-${conv.id}`)
                    //     .single();

                    // Get recent messages for AI analysis - fetch more messages for better context
                    let messages: any[] = [];
                    try {
                        messages = await metaApi.getConversationMessages(pageToken, conv.id, 25);
                    } catch (e) {
                        console.warn('[Meta Import] Could not fetch messages for conversation:', conv.id);
                    }

                    // Format conversation with BOTH contact and page messages for full context
                    // Messages are in reverse order (newest first), so reverse them
                    const sortedMessages = [...messages].reverse();
                    const conversationTranscript = sortedMessages
                        .map((m: any) => {
                            const sender = m.from?.id === integration.page_id ? 'PAGE' : 'CONTACT';
                            const text = m.message || '[attachment]';
                            return `${sender}: ${text}`;
                        })
                        .join('\n');

                    console.log('[Meta Import] Conversation transcript length:', conversationTranscript.length, 'messages:', messages.length);

                    // Create lead from conversation - don't save email (Facebook doesn't provide real emails)
                    const leadData = {
                        id: `conv-${conv.id}`,
                        user_id,
                        name: participant.name || null,
                        email: null,  // Facebook Messenger doesn't provide real emails
                        phone: null,
                        page_id: integration.page_id,
                        source: 'messenger',
                        field_data: [{
                            name: 'conversation_messages',
                            values: [conversationTranscript.substring(0, 4000)] // Increased limit for full context
                        }],
                        status: 'new',
                        created_time: conv.updated_time,
                        synced_at: new Date().toISOString(),
                    };

                    console.log('[Meta Import] Inserting lead:', leadData.id, leadData.name);

                    const { error: convError } = await supabase
                        .from('meta_leads')
                        .upsert(leadData, { onConflict: 'id' });

                    if (convError) {
                        console.error('[Meta Import] Lead insert error:', convError);
                    } else {
                        conversationsImported++;
                        console.log('[Meta Import] Successfully inserted lead:', leadData.id);

                        // Run AI analysis on the conversation - limited to prevent timeout
                        if (conversationTranscript && conversationTranscript.length > 10 && aiAnalyzedCount < AI_ANALYSIS_LIMIT) {
                            aiAnalyzedCount++;
                            console.log('[Meta Import] Starting AI analysis for:', leadData.id, 'transcript length:', conversationTranscript.length, `(${aiAnalyzedCount}/${AI_ANALYSIS_LIMIT})`);
                            try {
                                // Call NVIDIA API directly instead of through internal API route
                                const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
                                const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

                                if (!NVIDIA_API_KEY) {
                                    console.warn('[Meta Import] NVIDIA API key not configured - setting basic summary');
                                    await supabase
                                        .from('meta_leads')
                                        .update({
                                            ai_summary: `Messenger conversation with ${participant.name || 'contact'}. ${conversationTranscript.substring(0, 150)}...`,
                                        })
                                        .eq('id', leadData.id);
                                } else {
                                    const aiPrompt = `Analyze this Messenger conversation between a business PAGE and a CONTACT. Determine the lead's stage in the sales pipeline.

Conversation:
${conversationTranscript.substring(0, 2000)}

Pipeline stages:
- "new": First contact, no meaningful conversation yet
- "contacted": Page has responded, conversation started
- "qualified": Contact shows genuine interest, asked specific questions, or discussed pricing/details
- "converted": Contact made a purchase, signed up, or completed the desired action

Respond with JSON only:
{
  "summary": "Brief 1-2 sentence summary of what the contact needs",
  "sentiment": "positive/neutral/negative",
  "intent": "inquiry/purchase/support/complaint/other",
  "suggested_stage": "new/contacted/qualified/converted",
  "stage_reason": "Brief reason for the stage suggestion"
}`;

                                    const nvidiaResponse = await fetch(NVIDIA_API_URL, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                            model: 'meta/llama-3.1-70b-instruct',
                                            messages: [
                                                { role: 'system', content: 'You are a sales lead analyst. Always respond with valid JSON only. Be accurate about pipeline stages.' },
                                                { role: 'user', content: aiPrompt },
                                            ],
                                            max_tokens: 500,
                                            temperature: 0.3,
                                        }),
                                    });

                                    if (nvidiaResponse.ok) {
                                        const nvidiaData = await nvidiaResponse.json();
                                        const aiContent = nvidiaData.choices?.[0]?.message?.content || '';
                                        console.log('[Meta Import] NVIDIA response for', leadData.id, ':', aiContent.substring(0, 150));

                                        try {
                                            // Try to parse JSON from response
                                            const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
                                            if (jsonMatch) {
                                                const analysis = JSON.parse(jsonMatch[0]);

                                                // Validate suggested stage
                                                const validStages = ['new', 'contacted', 'qualified', 'converted'];
                                                const suggestedStage = validStages.includes(analysis.suggested_stage)
                                                    ? analysis.suggested_stage
                                                    : 'new';

                                                console.log('[Meta Import] AI suggested stage:', suggestedStage, 'reason:', analysis.stage_reason);

                                                await supabase
                                                    .from('meta_leads')
                                                    .update({
                                                        ai_summary: analysis.summary || `Conversation with ${participant.name}`,
                                                        ai_sentiment: analysis.sentiment,
                                                        ai_intent: analysis.intent,
                                                        status: suggestedStage, // Auto-set stage based on AI
                                                        last_analyzed_at: new Date().toISOString(),
                                                    })
                                                    .eq('id', leadData.id);
                                                console.log('[Meta Import] AI analysis + stage saved for:', leadData.id, 'stage:', suggestedStage);
                                            } else {
                                                // Use raw response as summary
                                                await supabase
                                                    .from('meta_leads')
                                                    .update({
                                                        ai_summary: aiContent.substring(0, 500) || `Conversation with ${participant.name}`,
                                                        last_analyzed_at: new Date().toISOString(),
                                                    })
                                                    .eq('id', leadData.id);
                                            }
                                        } catch (parseError) {
                                            console.warn('[Meta Import] Could not parse AI response, using raw:', parseError);
                                            await supabase
                                                .from('meta_leads')
                                                .update({
                                                    ai_summary: aiContent.substring(0, 500) || `Conversation with ${participant.name}`,
                                                })
                                                .eq('id', leadData.id);
                                        }
                                    } else {
                                        const errorText = await nvidiaResponse.text().catch(() => '');
                                        console.warn('[Meta Import] NVIDIA API error:', nvidiaResponse.status, errorText.substring(0, 200));
                                        // Set fallback summary
                                        await supabase
                                            .from('meta_leads')
                                            .update({
                                                ai_summary: `Messenger: ${participant.name || 'Contact'} - ${conversationTranscript.substring(0, 100)}...`,
                                            })
                                            .eq('id', leadData.id);
                                    }
                                }
                            } catch (aiError) {
                                console.warn('[Meta Import] AI analysis failed for:', leadData.id, aiError);
                                // Set fallback summary on error
                                await supabase
                                    .from('meta_leads')
                                    .update({
                                        ai_summary: `Contact: ${participant.name || 'Unknown'} via Messenger`,
                                    })
                                    .eq('id', leadData.id);
                            }
                        } else {
                            console.log('[Meta Import] Short/no conversation for:', leadData.id, 'length:', conversationTranscript?.length || 0);
                            // Set a basic summary for conversations without messages
                            await supabase
                                .from('meta_leads')
                                .update({
                                    ai_summary: `Contact: ${participant.name || 'Unknown'} via Messenger`,
                                })
                                .eq('id', leadData.id);
                        }
                    }
                }
            } catch (convSyncError) {
                console.error('[Meta Import] Conversation sync error:', convSyncError);
            }
        }

        console.log('[Meta Import] Synced', conversationsImported, 'Messenger contacts');

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
                leads: leadsImported,
                conversations: conversationsImported,
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
