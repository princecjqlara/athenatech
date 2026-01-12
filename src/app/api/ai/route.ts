import { NextRequest, NextResponse } from 'next/server';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, data } = body;

        switch (action) {
            case 'analyze_creative':
                return await analyzeCreative(data);
            case 'generate_recommendations':
                return await generateRecommendations(data);
            case 'extract_features':
                return await extractFeatures(data);
            case 'analyze_lead':
                return await analyzeLead(data);
            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }
    } catch (error) {
        console.error('[AI API] Error:', error);
        return NextResponse.json({
            error: 'AI processing failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

async function analyzeCreative(data: { creativeUrl?: string; description?: string }) {
    console.log('[AI API] Analyzing creative:', data);

    const prompt = `You are an expert advertising creative analyst. Analyze this ad creative and provide insights.

Creative Details:
${data.description || 'Image/Video creative'}

Provide analysis in the following JSON format:
{
  "delivery_score": 0-100,
  "structure_analysis": {
    "opening_strength": "strong/medium/weak",
    "motion_timing": "early/balanced/late",
    "text_visibility": "high/medium/low",
    "visual_hierarchy": "clear/moderate/unclear"
  },
  "recommendations": [
    "recommendation 1",
    "recommendation 2"
  ],
  "risk_factors": [
    "risk 1 if any"
  ],
  "predicted_performance": {
    "ctr_estimate": "above_average/average/below_average",
    "thumbstop_potential": "high/medium/low"
  }
}`;

    try {
        const response = await callNvidiaAI(prompt);
        return NextResponse.json({
            success: true,
            analysis: response,
        });
    } catch (error) {
        console.error('[AI API] NVIDIA API error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to analyze creative',
        }, { status: 500 });
    }
}

async function generateRecommendations(data: {
    adPerformance?: any;
    creativesData?: any[];
}) {
    console.log('[AI API] Generating recommendations:', data);

    const prompt = `You are an expert Meta Ads optimization consultant. Based on the following ad performance data, provide actionable recommendations.

Performance Data:
${JSON.stringify(data.adPerformance || {}, null, 2)}

Provide recommendations in JSON format:
{
  "priority_actions": [
    {
      "action": "description",
      "impact": "high/medium/low",
      "effort": "low/medium/high"
    }
  ],
  "creative_suggestions": [
    "suggestion 1"
  ],
  "audience_insights": "insights text",
  "budget_recommendation": "recommendation text"
}`;

    try {
        const response = await callNvidiaAI(prompt);
        return NextResponse.json({
            success: true,
            recommendations: response,
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: 'Failed to generate recommendations',
        }, { status: 500 });
    }
}

async function extractFeatures(data: { mediaUrl?: string; mediaType?: string }) {
    console.log('[AI API] Extracting features from:', data);

    // For now, return mock structure features
    // In production, this would use computer vision APIs
    const mockFeatures = {
        video: {
            duration_s: 15,
            aspect_ratio: '9:16',
            fps: 30,
            cuts_total: 5,
            cuts_0_1s: 2,
            cuts_1_3s: 2,
            cuts_3_5s: 1,
            motion_onset_ms: 200,
            text_area_pct: 15,
            brightness_avg: 0.6,
            contrast_avg: 0.7,
        },
        image: {
            aspect_ratio: '1:1',
            subject_occupancy: 0.4,
            edge_density: 0.3,
            clutter_score: 0.2,
            text_area_pct: 10,
            brightness: 0.65,
            contrast: 0.75,
            palette_entropy: 0.5,
        },
    };

    return NextResponse.json({
        success: true,
        features: mockFeatures[data.mediaType as keyof typeof mockFeatures] || mockFeatures.image,
    });
}

/**
 * Analyze a lead's data and extract contact details + conversation insights
 */
async function analyzeLead(data: {
    leadId: string;
    fieldData: { name: string; values: string[] }[];
    campaignName?: string;
    adName?: string;
}) {
    console.log('[AI API] Analyzing lead:', data.leadId);

    // Extract field data into readable format
    const fieldSummary = data.fieldData
        .map(f => `${f.name}: ${f.values.join(', ')}`)
        .join('\n');

    const prompt = `You are an expert lead analyst and sales consultant. Analyze this lead form submission and provide comprehensive insights.

Lead Form Data:
${fieldSummary}

Campaign: ${data.campaignName || 'Unknown'}
Ad: ${data.adName || 'Unknown'}

Provide analysis in the following JSON format:
{
  "contact_details": {
    "full_name": "extracted name or null",
    "email": "extracted email or null",
    "phone": "extracted phone or null",
    "company": "extracted company or null",
    "job_title": "extracted job title or null",
    "location": "extracted location or null",
    "age": "extracted or estimated age or null",
    "interests": ["extracted interests"]
  },
  "conversation_analysis": {
    "summary": "brief summary of what the lead is interested in",
    "sentiment": "positive/neutral/negative",
    "intent": "purchase/inquiry/browsing/comparison",
    "urgency": "high/medium/low",
    "topics_discussed": ["topic1", "topic2"],
    "pain_points": ["pain point if any"],
    "objections": ["objection if any"]
  },
  "engagement_score": 0-100,
  "lead_quality": "hot/warm/cold",
  "next_actions": [
    {
      "action": "recommended action",
      "priority": "high/medium/low",
      "reason": "why this action"
    }
  ],
  "preferred_contact_method": "email/phone/whatsapp",
  "best_contact_time": "morning/afternoon/evening/anytime"
}`;

    try {
        const response = await callNvidiaAI(prompt);
        return NextResponse.json({
            success: true,
            analysis: response,
        });
    } catch (error) {
        console.error('[AI API] Lead analysis error:', error);
        // Return a fallback analysis
        return NextResponse.json({
            success: true,
            analysis: JSON.stringify({
                contact_details: extractContactDetailsManually(data.fieldData),
                conversation_analysis: {
                    summary: 'Lead submitted form from ad campaign',
                    sentiment: 'neutral',
                    intent: 'inquiry',
                    urgency: 'medium',
                    topics_discussed: [],
                    pain_points: [],
                    objections: [],
                },
                engagement_score: 50,
                lead_quality: 'warm',
                next_actions: [
                    { action: 'Follow up within 24 hours', priority: 'high', reason: 'Fresh lead' }
                ],
                preferred_contact_method: 'email',
                best_contact_time: 'anytime',
            }),
        });
    }
}

/**
 * Extract contact details manually from field data as fallback
 */
function extractContactDetailsManually(fieldData: { name: string; values: string[] }[]) {
    const findField = (patterns: string[]) => {
        for (const pattern of patterns) {
            const field = fieldData.find(f =>
                f.name.toLowerCase().includes(pattern.toLowerCase())
            );
            if (field && field.values.length > 0) {
                return field.values[0];
            }
        }
        return null;
    };

    return {
        full_name: findField(['name', 'full_name', 'fullname']) ||
            `${findField(['first_name', 'firstname']) || ''} ${findField(['last_name', 'lastname']) || ''}`.trim() || null,
        email: findField(['email', 'e-mail', 'mail']),
        phone: findField(['phone', 'mobile', 'tel', 'contact_number']),
        company: findField(['company', 'business', 'organization']),
        job_title: findField(['job', 'title', 'position', 'role']),
        location: findField(['city', 'location', 'address', 'country']),
        age: findField(['age', 'birthday', 'dob']),
        interests: [],
    };
}

async function callNvidiaAI(prompt: string): Promise<string> {
    if (!NVIDIA_API_KEY) {
        console.warn('[AI API] NVIDIA API key not configured, using mock response');
        return JSON.stringify({
            delivery_score: 75,
            structure_analysis: {
                opening_strength: 'strong',
                motion_timing: 'early',
                text_visibility: 'high',
                visual_hierarchy: 'clear',
            },
            recommendations: [
                'Consider adding motion in the first 0.5 seconds',
                'Text overlay is well-positioned for mobile viewing',
            ],
            risk_factors: [],
            predicted_performance: {
                ctr_estimate: 'above_average',
                thumbstop_potential: 'high',
            },
        });
    }

    const response = await fetch(NVIDIA_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'meta/llama-3.1-70b-instruct',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert advertising analyst. Always respond with valid JSON.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: 2048,
            temperature: 0.7,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[AI API] NVIDIA API error ${response.status}:`, errorText);
        throw new Error(`NVIDIA API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
}
