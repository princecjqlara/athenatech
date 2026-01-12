import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { metaApi } from '@/lib/meta/metaApi';
import crypto from 'crypto';

const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'TEST_TOKEN';
const FB_APP_SECRET = process.env.FB_APP_SECRET || '';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Webhook verification (GET request from Facebook)
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    console.log('[Facebook Webhook] Verification request:', { mode, token });

    if (mode === 'subscribe' && token === FB_VERIFY_TOKEN) {
        console.log('[Facebook Webhook] Verification successful');
        return new NextResponse(challenge, { status: 200 });
    }

    console.log('[Facebook Webhook] Verification failed');
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Webhook event handler (POST request from Facebook)
export async function POST(request: NextRequest) {
    try {
        const body = await request.text();

        // Verify signature
        const signature = request.headers.get('x-hub-signature-256');
        if (FB_APP_SECRET && signature) {
            const expectedSignature = 'sha256=' + crypto
                .createHmac('sha256', FB_APP_SECRET)
                .update(body)
                .digest('hex');

            if (signature !== expectedSignature) {
                console.error('[Facebook Webhook] Invalid signature');
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        }

        const data = JSON.parse(body);
        console.log('[Facebook Webhook] Received event:', JSON.stringify(data, null, 2));

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Handle different event types
        if (data.object === 'page') {
            for (const entry of data.entry || []) {
                const pageId = entry.id;

                // Handle messaging events
                if (entry.messaging) {
                    for (const event of entry.messaging) {
                        await handleMessagingEvent(event, supabase);
                    }
                }

                // Handle lead events (Lead Ads)
                if (entry.changes) {
                    for (const change of entry.changes) {
                        if (change.field === 'leadgen') {
                            await handleLeadEvent(change.value, pageId, supabase);
                        }
                    }
                }
            }
        }

        return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
    } catch (error) {
        console.error('[Facebook Webhook] Error processing event:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function handleMessagingEvent(event: any, supabase: any) {
    const senderId = event.sender?.id;
    const recipientId = event.recipient?.id; // This is the page ID
    const message = event.message;
    const referral = event.referral;

    console.log('[Facebook Webhook] Messaging event:', {
        senderId,
        recipientId,
        message: message?.text,
        referral: referral,
    });

    // Skip echo messages (messages sent by page)
    if (message?.is_echo) {
        console.log('[Facebook Webhook] Skipping echo message');
        return;
    }

    // Check if this is a referral from an ad
    let adId = null;
    let adSource = null;
    if (referral && referral.source === 'ADS') {
        adId = referral.ad_id;
        adSource = referral.ads_context_data?.ad_title || `Ad ${referral.ad_id}`;
        console.log('[Facebook Webhook] Conversation from ad:', adId, adSource);
    }

    // Find the integration for this page
    const { data: integration } = await supabase
        .from('meta_integrations')
        .select('user_id, access_token, page_access_token, page_id')
        .eq('page_id', recipientId)
        .eq('is_active', true)
        .single();

    if (!integration) {
        console.log('[Facebook Webhook] No integration found for page:', recipientId);
        return;
    }

    // Create or update lead from this messenger contact
    const leadId = `conv-${senderId}-${recipientId}`;

    // Get existing lead to check message count
    const { data: existingLead } = await supabase
        .from('meta_leads')
        .select('id, message_count, field_data, status')
        .eq('id', leadId)
        .single();

    const currentMessageCount = (existingLead?.message_count || 0) + 1;
    const existingMessages = existingLead?.field_data?.find((f: any) => f.name === 'conversation_messages')?.values?.[0] || '';
    const senderType = senderId === recipientId ? 'PAGE' : 'CONTACT';
    const newConversation = existingMessages
        ? `${existingMessages}\n${senderType}: ${message?.text || '[attachment]'}`
        : `${senderType}: ${message?.text || '[attachment]'}`;

    // Upsert lead with incremented message count
    const { error: upsertError } = await supabase
        .from('meta_leads')
        .upsert({
            id: leadId,
            user_id: integration.user_id,
            page_id: recipientId,
            source: 'messenger',
            ad_id: adId || existingLead?.ad_id,
            ad_source: adSource || existingLead?.ad_source,
            status: existingLead?.status || 'new',
            message_count: currentMessageCount,
            field_data: [{ name: 'conversation_messages', values: [newConversation.substring(0, 4000)] }],
            synced_at: new Date().toISOString(),
        }, {
            onConflict: 'id',
            ignoreDuplicates: false
        });

    if (upsertError) {
        console.error('[Facebook Webhook] Error storing messenger lead:', upsertError);
        return;
    }

    console.log('[Facebook Webhook] Lead updated, message count:', currentMessageCount, leadId);

    // Re-analyze every 3 messages
    if (currentMessageCount % 3 === 0 && newConversation.length > 20) {
        console.log('[Facebook Webhook] Triggering re-analysis for:', leadId, 'after', currentMessageCount, 'messages');

        try {
            const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
            const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

            if (!NVIDIA_API_KEY) {
                console.warn('[Facebook Webhook] NVIDIA API key not configured');
                return;
            }

            const aiPrompt = `Analyze this Messenger conversation between a business PAGE and a CONTACT. Determine the current stage in the sales pipeline.

Conversation:
${newConversation.substring(0, 2000)}

Pipeline stages:
- "new": First contact, no meaningful conversation yet
- "contacted": Page has responded, conversation started
- "qualified": Contact shows genuine interest, asked specific questions, or discussed pricing/details
- "converted": Contact made a purchase, signed up, or completed the desired action

Respond with JSON only:
{
  "summary": "Brief 1-2 sentence summary of current conversation state",
  "sentiment": "positive/neutral/negative",
  "intent": "inquiry/purchase/support/complaint/other",
  "suggested_stage": "new/contacted/qualified/converted",
  "stage_reason": "Brief reason for stage"
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
                        { role: 'system', content: 'You are a sales lead analyst. Always respond with valid JSON only.' },
                        { role: 'user', content: aiPrompt },
                    ],
                    max_tokens: 500,
                    temperature: 0.3,
                }),
            });

            if (nvidiaResponse.ok) {
                const nvidiaData = await nvidiaResponse.json();
                const aiContent = nvidiaData.choices?.[0]?.message?.content || '';
                console.log('[Facebook Webhook] AI response:', aiContent.substring(0, 100));

                try {
                    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const analysis = JSON.parse(jsonMatch[0]);
                        const validStages = ['new', 'contacted', 'qualified', 'converted'];
                        const suggestedStage = validStages.includes(analysis.suggested_stage)
                            ? analysis.suggested_stage
                            : existingLead?.status || 'new';

                        await supabase
                            .from('meta_leads')
                            .update({
                                ai_summary: analysis.summary,
                                ai_sentiment: analysis.sentiment,
                                ai_intent: analysis.intent,
                                status: suggestedStage,
                                last_analyzed_at: new Date().toISOString(),
                            })
                            .eq('id', leadId);
                        console.log('[Facebook Webhook] Re-analysis complete, stage:', suggestedStage);
                    }
                } catch (parseError) {
                    console.warn('[Facebook Webhook] Could not parse AI response:', parseError);
                }
            } else {
                console.warn('[Facebook Webhook] NVIDIA API error:', nvidiaResponse.status);
            }
        } catch (aiError) {
            console.warn('[Facebook Webhook] AI analysis failed:', aiError);
        }
    }
}

async function handleLeadEvent(leadData: any, pageId: string, supabase: any) {
    console.log('[Facebook Webhook] Lead event received:', {
        leadgen_id: leadData.leadgen_id,
        page_id: leadData.page_id,
        form_id: leadData.form_id,
        created_time: leadData.created_time,
    });

    try {
        // Find the user associated with this page
        const { data: integration, error: integrationError } = await supabase
            .from('meta_integrations')
            .select('user_id, access_token')
            .eq('page_id', pageId)
            .eq('is_active', true)
            .single();

        if (integrationError || !integration) {
            console.log('[Facebook Webhook] No active integration found for page:', pageId);
            return;
        }

        // Fetch full lead details from Facebook API
        const leadDetails = await metaApi.getLeadDetails(
            integration.access_token,
            leadData.leadgen_id
        );

        // Parse lead field data
        let name = '';
        let email = '';
        let phone = '';
        const fieldData: Record<string, string> = {};

        for (const field of leadDetails.field_data || []) {
            const value = field.values?.[0] || '';
            fieldData[field.name] = value;

            if (field.name.toLowerCase().includes('name') || field.name === 'full_name') {
                name = value;
            }
            if (field.name.toLowerCase().includes('email')) {
                email = value;
            }
            if (field.name.toLowerCase().includes('phone') || field.name === 'phone_number') {
                phone = value;
            }
        }

        // Store lead in database
        const { data: insertedLead, error: insertError } = await supabase
            .from('meta_leads')
            .upsert({
                id: leadDetails.id,
                user_id: integration.user_id,
                ad_id: leadDetails.ad_id,
                adset_id: leadDetails.adset_id,
                campaign_id: leadDetails.campaign_id,
                form_id: leadDetails.form_id,
                name,
                email,
                phone,
                field_data: fieldData,
                status: 'new',
                source: 'Meta Lead Ads',
                created_time: leadDetails.created_time,
                synced_at: new Date().toISOString(),
            }, { onConflict: 'id' })
            .select()
            .single();

        if (insertError) {
            console.error('[Facebook Webhook] Error storing lead:', insertError);
            return;
        }

        console.log('[Facebook Webhook] Lead stored successfully:', insertedLead.id);

        // TODO: Fire CAPI Lead event if configured
        // TODO: Send notification email/SMS

    } catch (error) {
        console.error('[Facebook Webhook] Error processing lead:', error);
    }
}
