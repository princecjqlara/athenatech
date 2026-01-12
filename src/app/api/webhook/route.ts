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
    const recipientId = event.recipient?.id;
    const message = event.message;

    console.log('[Facebook Webhook] Messaging event:', {
        senderId,
        recipientId,
        message: message?.text,
    });

    // Skip echo messages (messages sent by page)
    if (message?.is_echo) {
        console.log('[Facebook Webhook] Skipping echo message');
        return;
    }

    // TODO: Store message in database for messenger integration
    // TODO: Process with AI if needed
    // TODO: Send auto-reply if configured
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
