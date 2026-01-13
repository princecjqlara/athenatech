import { NextRequest, NextResponse } from 'next/server';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '3587Bqqa5RPfzMZxaRM0ysmUmg5_2BQWVfEwQUXmETxGY8Q7Y';
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
            case 'analyze_lead_conversation':
                return await analyzeLeadConversation(data);
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

async function analyzeLeadConversation(data: {
    leadName: string;
    conversationHistory: string[];
    currentStage: string;
    leadSource?: string;
    adAccountName?: string;
}) {
    console.log('[AI API] Analyzing lead conversation:', data.leadName);

    const conversationText = data.conversationHistory?.join('\n') || 'No conversation history available';

    const prompt = `You are an expert sales analyst and CRM specialist. Analyze this lead conversation and classify the lead for pipeline management.

Lead Information:
- Name: ${data.leadName}
- Current Stage: ${data.currentStage}
- Source: ${data.leadSource || 'Unknown'}
- Ad Account: ${data.adAccountName || 'Unknown'}

Conversation History:
${conversationText}

Analyze this conversation and provide your assessment in the following JSON format:
{
    "summary": "Brief 1-2 sentence summary of the conversation and lead status",
    "sentiment": "positive" | "neutral" | "negative" | "mixed",
    "intent": "What the lead is trying to achieve",
    "engagementScore": 0-100,
    "suggestedStage": "new" | "contacted" | "qualified" | "converted" | "lost",
    "stageConfidence": 0-100,
    "stageReason": "Why this stage is recommended",
    "topics": ["array", "of", "discussed", "topics"],
    "painPoints": ["identified", "pain", "points"],
    "objections": ["identified", "objections"],
    "nextAction": "Specific recommended next step",
    "priority": "high" | "medium" | "low",
    "qualificationScore": {
        "budget": "confirmed" | "likely" | "unknown" | "unlikely",
        "authority": "confirmed" | "likely" | "unknown" | "unlikely",
        "need": "confirmed" | "likely" | "unknown" | "unlikely",
        "timeline": "confirmed" | "likely" | "unknown" | "unlikely"
    }
}

Be specific and actionable in your analysis. Focus on sales-relevant insights.`;

    try {
        const response = await callNvidiaAI(prompt);

        // Parse the response
        let analysis;
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            } else {
                analysis = JSON.parse(response);
            }
        } catch {
            // If parsing fails, return a structured fallback
            analysis = {
                summary: response.slice(0, 200),
                sentiment: 'neutral',
                intent: 'Unknown',
                engagementScore: 50,
                suggestedStage: data.currentStage,
                stageConfidence: 50,
                stageReason: 'Unable to determine from conversation',
                topics: [],
                painPoints: [],
                objections: [],
                nextAction: 'Follow up with lead',
                priority: 'medium',
                qualificationScore: {
                    budget: 'unknown',
                    authority: 'unknown',
                    need: 'unknown',
                    timeline: 'unknown'
                }
            };
        }

        return NextResponse.json({
            success: true,
            analysis,
        });
    } catch (error) {
        console.error('[AI API] Lead conversation analysis error:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to analyze conversation',
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
            model: 'nvidia/llama-3.1-nemotron-70b-instruct',
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
        throw new Error(`NVIDIA API error: ${response.status}`);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
}
