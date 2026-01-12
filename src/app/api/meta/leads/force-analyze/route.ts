import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Force AI analysis on all leads without ai_summary
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { user_id, limit = 50 } = body;

        if (!user_id) {
            return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get leads without AI analysis
        const { data: leads, error } = await supabase
            .from('meta_leads')
            .select('id, name, field_data')
            .eq('user_id', user_id)
            .is('ai_summary', null)
            .limit(limit);

        if (error) {
            console.error('[Force Analyze] Error fetching leads:', error);
            return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
        }

        let analyzed = 0;
        const baseUrl = process.env.NEXT_PUBLIC_NGROK_URL || process.env.NEXT_PUBLIC_APP_URL || '';

        for (const lead of leads || []) {
            try {
                // Get conversation messages from field_data
                const messages = lead.field_data?.find((f: any) => f.name === 'conversation_messages')?.values?.[0] || '';

                if (!messages || messages.length < 10) {
                    // Generate a basic summary for leads without messages
                    await supabase
                        .from('meta_leads')
                        .update({
                            ai_summary: `Contact: ${lead.name || 'Unknown'} - No conversation data available`,
                        })
                        .eq('id', lead.id);
                    analyzed++;
                    continue;
                }

                const aiResponse = await fetch(`${baseUrl}/api/ai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'analyze_lead',
                        data: {
                            leadId: lead.id,
                            fieldData: lead.field_data || [],
                        },
                    }),
                });

                if (aiResponse.ok) {
                    const aiData = await aiResponse.json();
                    if (aiData.success && aiData.analysis) {
                        const analysis = typeof aiData.analysis === 'string'
                            ? JSON.parse(aiData.analysis)
                            : aiData.analysis;

                        await supabase
                            .from('meta_leads')
                            .update({
                                ai_summary: analysis?.conversation_analysis?.summary || `Messenger contact: ${lead.name}`,
                                ai_sentiment: analysis?.conversation_analysis?.sentiment,
                                ai_intent: analysis?.conversation_analysis?.intent,
                            })
                            .eq('id', lead.id);
                        analyzed++;
                    }
                }
            } catch (e) {
                console.error('[Force Analyze] Error analyzing lead:', lead.id, e);
            }
        }

        return NextResponse.json({
            success: true,
            analyzed,
            remaining: (leads?.length || 0) - analyzed,
            total_pending: leads?.length || 0,
        });

    } catch (error) {
        console.error('[Force Analyze] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to analyze leads' },
            { status: 500 }
        );
    }
}
