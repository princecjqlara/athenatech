/**
 * Checklist Field Tooltips
 * 
 * Provides clear, objective guidance for each checklist field.
 * These tooltips help users answer questions without interpretation.
 */

export interface ChecklistTooltip {
    question: string;
    examples?: string[];
    note?: string;
}

export const CHECKLIST_TOOLTIPS: Record<string, ChecklistTooltip> = {
    // === CTA Atomic Fields ===
    ctaPresent: {
        question: "Is there a call-to-action (CTA) in the creative?",
        examples: [
            "✅ 'Shop Now' button",
            "✅ 'Get Started' text",
            "✅ 'Click here' link",
            "❌ Just product showcase without action prompt",
        ],
    },
    ctaHasActionVerb: {
        question: "Does the CTA contain a clear action verb?",
        examples: [
            "✅ 'Buy now'",
            "✅ 'Get your free guide'",
            "✅ 'Start your trial'",
            "❌ 'Learn more' (vague)",
            "❌ 'Click here' (no specific action)",
        ],
        note: "Action verbs: Buy, Get, Start, Try, Download, Join, Discover, Shop, Order, Claim",
    },
    ctaHasOutcome: {
        question: "Does the CTA describe what happens after clicking?",
        examples: [
            "✅ 'Get 50% off today'",
            "✅ 'Start your free trial'",
            "✅ 'Download your guide'",
            "❌ 'Click here' (no outcome)",
            "❌ 'Learn more' (outcome unclear)",
        ],
    },
    ctaHasUrgency: {
        question: "Does the CTA include urgency language?",
        examples: [
            "✅ 'Buy now - ends today'",
            "✅ 'Limited time offer'",
            "✅ 'Only 3 left'",
            "❌ 'Shop our products' (no urgency)",
        ],
        note: "This is optional. Urgency words: Now, Today, Limited, Ends, Last, Final, Only",
    },

    // === Value Proposition Atomic Fields ===
    benefitStated: {
        question: "Is a specific benefit mentioned?",
        examples: [
            "✅ 'Save time on your commute'",
            "✅ 'Get clearer skin'",
            "✅ 'Grow your revenue'",
            "❌ 'Best product ever' (no specific benefit)",
            "❌ 'Premium quality' (feature, not benefit)",
        ],
        note: "Benefits describe what the user gains. Features describe product attributes.",
    },
    benefitQuantified: {
        question: "Is the benefit quantified with specific numbers?",
        examples: [
            "✅ 'Save ₱500/month'",
            "✅ '2x faster results'",
            "✅ 'Lose 5kg in 30 days'",
            "✅ '10,000+ happy customers'",
            "❌ 'Save money' (not quantified)",
            "❌ 'Faster results' (no number)",
        ],
    },
    timeToBenefitStated: {
        question: "Is the time to achieve the benefit stated?",
        examples: [
            "✅ 'Results in 30 days'",
            "✅ 'Instant access'",
            "✅ 'Same-day delivery'",
            "✅ 'See results in 2 weeks'",
            "❌ 'Great results' (no timeframe)",
        ],
    },
    valueTiming: {
        question: "When does the value proposition first appear?",
        examples: [
            "🎬 Opening (0-3s): Value stated immediately",
            "📍 Middle: Value appears after hook",
            "🎯 End: Value only at conclusion",
            "❌ Not Present: No clear value statement",
        ],
    },

    // === Offer Fields ===
    offerPresent: {
        question: "Is there a specific offer in the creative?",
        examples: [
            "✅ '50% off today only'",
            "✅ 'Free shipping over ₱2,000'",
            "✅ 'Buy 1 Get 1 Free'",
            "❌ Just product showcase",
        ],
    },
    offerTiming: {
        question: "When does the offer appear?",
        examples: [
            "⏱️ Early: Within first 25% of creative",
            "📍 Mid: In middle 50% of creative",
            "⏳ Late: In final 25% of creative",
            "❌ Not Shown: Offer not visible",
        ],
    },

    // === Other Observable Fields ===
    proofPresent: {
        question: "Is there social proof or testimonial?",
        examples: [
            "✅ Customer review quote",
            "✅ Star rating display",
            "✅ 'Trusted by 10,000+ customers'",
            "✅ Before/after results",
            "❌ Just product claims",
        ],
    },
    pricingVisible: {
        question: "Is pricing shown in the creative?",
        examples: [
            "✅ '₱999' price tag",
            "✅ 'Starting at ₱499'",
            "✅ Price comparison shown",
            "❌ 'Contact for pricing'",
            "❌ No price mentioned",
        ],
        note: "Showing pricing early can help qualify leads and reduce wasted clicks.",
    },
    guaranteeMentioned: {
        question: "Is there a guarantee or risk-reversal mentioned?",
        examples: [
            "✅ '30-day money-back guarantee'",
            "✅ 'Free returns'",
            "✅ 'Satisfaction guaranteed'",
            "❌ No risk-reversal mentioned",
        ],
        note: "Guarantees reduce purchase friction by lowering perceived risk.",
    },

    // === Alignment ===
    adLpMatch: {
        question: "Does the ad's main promise match the landing page headline?",
        examples: [
            "✅ Yes: Ad says 'Get 50% off' → LP headline says '50% Sale On Now'",
            "❌ No: Ad says 'Free shipping' → LP headline says 'Best products'",
            "🤷 Unsure: Haven't checked the landing page",
        ],
        note: "Select 'Unsure' if you haven't checked the landing page yet. This field is ONLY used when delivery is healthy but conversion is weak.",
    },
};

/**
 * Get tooltip for a checklist field
 */
export function getChecklistTooltip(fieldName: string): ChecklistTooltip | undefined {
    return CHECKLIST_TOOLTIPS[fieldName];
}
