'use client';

import { useRef, useMemo, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html, Line, Points } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, EyeOff, X, Layers, Info } from 'lucide-react';
import Image from 'next/image';
import { Sidebar } from '@/components/ui/Sidebar';
import { GlassCard } from '@/components/ui/GlassCard';
import { AIChatWidget } from '@/components/ui/AIChatWidget';
import { formatCurrencyCompact } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

// ============ TYPES ============
interface HierarchyNode {
    id: string;
    name: string;
    type: 'account' | 'campaign' | 'adset' | 'creative';
    metrics: { spend?: number; impressions?: number; conversions?: number; ctr?: number; roas?: number };
    children: HierarchyNode[];
}

interface PositionedOrb {
    id: string;
    name: string;
    type: 'account' | 'campaign' | 'adset' | 'creative';
    metrics: HierarchyNode['metrics'];
    position: [number, number, number];
    size: number;
    color: string;
    parentId: string | null;
    orbitSpeed: number;
    orbitRadius: number;
    initialAngle: number;
    successScore: number;
    // Suggestion fields (optional)
    isSuggestion?: boolean;
    suggestionType?: 'scale' | 'new_creative' | 'kill';
    suggestion?: string;
    basedOnId?: string;
    // Advanced features
    isWinner?: boolean;       // Winners Circle (ROAS > 3x, 3+ conversions)
    isLoser?: boolean;        // Kill Zone (Spend > CPA, 0 conversions)
    fatigueLevel?: number;    // 0-1, higher = more fatigued
    lifecycleDays?: number;   // Estimated days remaining
    imageUrl?: string;        // Creative preview thumbnail
}

interface SearchResult {
    id: string;
    email: string;
    full_name: string;
}

// ============ GENERATE 50 DUMMY CAMPAIGNS ============
function generateDemoHierarchy(): HierarchyNode {
    const campaignNames = [
        'Summer Sale', 'Winter Promo', 'Spring Launch', 'Fall Collection', 'Holiday Special',
        'Flash Sale', 'Clearance', 'New Arrivals', 'Best Sellers', 'Limited Edition',
        'Brand Awareness', 'Retargeting', 'Lookalike', 'Interest Based', 'Broad Reach',
        'Video Views', 'Engagement', 'Conversions', 'Lead Gen', 'App Install',
        'Product Launch', 'Seasonal', 'Weekend Deal', 'Members Only', 'VIP Access',
        'Early Bird', 'Last Chance', 'Bundle Deal', 'Buy One Get One', 'Free Shipping',
        'First Time Buyer', 'Win Back', 'Cross Sell', 'Upsell', 'Loyalty',
        'Influencer', 'UGC Campaign', 'Testimonial', 'Demo Video', 'Tutorial',
        'FAQ Awareness', 'Problem Solution', 'Lifestyle', 'Premium', 'Budget',
        'Mobile Only', 'Desktop Only', 'All Platforms', 'Social Only', 'Search Only'
    ];

    const adsetNames = ['Interest', 'Lookalike', 'Broad', 'Retarget', 'Custom', 'Engaged', 'Buyers', 'Viewers'];
    const creativeNames = ['Video', 'Image', 'Carousel', 'Story', 'Reel', 'Collection', 'Instant'];

    const campaigns: HierarchyNode[] = [];

    for (let i = 0; i < 5; i++) {
        const campaignRoas = 0.5 + Math.random() * 7;
        const numAdSets = 1 + Math.floor(Math.random() * 3); // 1-3 ad sets

        const adsets: HierarchyNode[] = [];
        for (let j = 0; j < numAdSets; j++) {
            const adsetRoas = campaignRoas * (0.7 + Math.random() * 0.6);
            const numCreatives = 1 + Math.floor(Math.random() * 3); // 1-3 creatives

            const creatives: HierarchyNode[] = [];
            for (let k = 0; k < numCreatives; k++) {
                creatives.push({
                    id: `cr-${i}-${j}-${k}`,
                    name: creativeNames[k % creativeNames.length],
                    type: 'creative',
                    metrics: { ctr: parseFloat((0.5 + Math.random() * 5).toFixed(1)), roas: parseFloat((adsetRoas * (0.8 + Math.random() * 0.4)).toFixed(1)) },
                    children: [],
                });
            }

            adsets.push({
                id: `adset-${i}-${j}`,
                name: adsetNames[j % adsetNames.length],
                type: 'adset',
                metrics: { spend: Math.floor(1000 + Math.random() * 9000), roas: parseFloat(adsetRoas.toFixed(1)) },
                children: creatives,
            });
        }

        campaigns.push({
            id: `camp-${i}`,
            name: campaignNames[i % campaignNames.length],
            type: 'campaign',
            metrics: { spend: Math.floor(5000 + Math.random() * 20000), roas: parseFloat(campaignRoas.toFixed(1)) },
            children: adsets,
        });
    }

    return {
        id: 'account',
        name: 'Ad Account',
        type: 'account',
        metrics: { spend: campaigns.reduce((s, c) => s + (c.metrics.spend || 0), 0) },
        children: campaigns,
    };
}

const demoHierarchy = generateDemoHierarchy();

const getOtherUserHierarchy = (name: string): HierarchyNode => ({
    id: 'other-account',
    name: `${name}'s Account`,
    type: 'account',
    metrics: {},
    children: [
        { id: 'oc1', name: 'Campaign 1', type: 'campaign', metrics: {}, children: [] },
        { id: 'oc2', name: 'Campaign 2', type: 'campaign', metrics: {}, children: [] },
    ]
});

// ============ COLORS ============
const typeColors: Record<string, string> = {
    account: '#90EE90',
    campaign: '#87CEEB',
    adset: '#DDA0DD',
    creative: '#FFD580',
};

// Suggestion orb colors - All violet for AI suggestions
const suggestionColors = {
    scale: '#8B5CF6',      // Violet - scale winners
    new_creative: '#8B5CF6', // Violet - add creative
    kill: '#FF6B6B',       // Red - kill underperformers (keep red for danger)
    angle: '#8B5CF6',      // Violet - new angle
    format: '#8B5CF6',     // Violet - format variation
    persona: '#8B5CF6',    // Violet - different persona
};

// ============ ANTONIO'S META ANDROMEDA STRATEGY ============
// Creative Angles (Distinct Concepts)
const CREATIVE_ANGLES = [
    { type: 'Problem_Solution', emoji: '🔧', purpose: 'Targets unaware users with pain points' },
    { type: 'Us_Vs_Them', emoji: '⚔️', purpose: 'Comparison shoppers, show superiority' },
    { type: 'Founder_Story', emoji: '👤', purpose: 'Build trust and brand affinity' },
    { type: 'UGC_Testimonial', emoji: '📱', purpose: 'Social proof from real customers' },
    { type: 'Direct_Offer', emoji: '💰', purpose: 'High-intent retargeting, quick sales' },
];

// Format Variations (same concept, different format)
const FORMAT_VARIATIONS = [
    { type: '9:16 Reel', emoji: '📲', purpose: 'Stories/Reels placement' },
    { type: '4:5 Feed Video', emoji: '🎬', purpose: 'Feed placement' },
    { type: 'Static Image', emoji: '🖼️', purpose: 'Quick loading, simple' },
    { type: 'Carousel', emoji: '🎠', purpose: 'Multiple products/benefits' },
];

// Awareness Stages (buyer journey)
const AWARENESS_STAGES = [
    { stage: 'Unaware', emoji: '❓', approach: 'Problem-focused content' },
    { stage: 'Problem_Aware', emoji: '💭', approach: 'Solution teaser' },
    { stage: 'Solution_Aware', emoji: '🎯', approach: 'Why your product' },
    { stage: 'Product_Aware', emoji: '🛒', approach: 'Offers and urgency' },
];

// Portfolio Balance (70/30 rule)
const PORTFOLIO_MIX = {
    safe: { percentage: 70, types: ['Product-focused', 'Clear benefits', 'Proven angles'] },
    wild: { percentage: 30, types: ['Memes', 'Controversial takes', 'Lo-fi/Ugly ads'] },
};

// Personas (different target audiences - from Creative Strategy Roadmap)
const PERSONAS = [
    { persona: 'Young Professional', emoji: '👔', age: '25-34', hook: 'Career-focused messaging' },
    { persona: 'Parent', emoji: '👨‍👩‍👧', age: '30-45', hook: 'Family-focused benefits' },
    { persona: 'Budget Conscious', emoji: '💵', age: 'Any', hook: 'Value and savings focused' },
    { persona: 'Premium Buyer', emoji: '👑', age: '35+', hook: 'Quality and exclusivity' },
    { persona: 'Early Adopter', emoji: '🚀', age: '18-30', hook: 'New and innovative' },
];

// Variations (hook, script, B-roll changes)
const VARIATION_TYPES = [
    { type: 'New Hook', emoji: '🎣', desc: 'Different opening 3 seconds' },
    { type: 'Alt Script', emoji: '📝', desc: 'Same angle, new copy' },
    { type: 'Different Actor', emoji: '🎭', desc: 'New persona/age group' },
    { type: 'New B-Roll', emoji: '🎥', desc: 'Same script, new visuals' },
];

// Ad Concepts (the actual creative idea/hook)
const AD_CONCEPTS = [
    { concept: 'Before/After', emoji: '🔄', desc: 'Transformation showcase' },
    { concept: 'Demo/Tutorial', emoji: '📚', desc: 'How it works' },
    { concept: 'Unboxing', emoji: '📦', desc: 'First impressions' },
    { concept: 'Day in Life', emoji: '🌅', desc: 'Lifestyle integration' },
    { concept: 'Testimonial', emoji: '💬', desc: 'Real customer story' },
    { concept: 'Behind Scenes', emoji: '🎬', desc: 'Brand authenticity' },
];

// Strategic Approaches (recommendations based on what made campaign work)
const STRATEGIC_APPROACHES = [
    { type: 'Offer', emoji: '💰', trigger: 'conversions', desc: 'Try different pricing/discount structure' },
    { type: 'Message', emoji: '✉️', trigger: 'ctr', desc: 'Test new hook/copy angle' },
    { type: 'Angle', emoji: '🎯', trigger: 'roas', desc: 'Explore different creative direction' },
    { type: 'Delivery', emoji: '📍', trigger: 'impressions', desc: 'Optimize placement/schedule' },
    { type: 'Conversion', emoji: '🎯', trigger: 'spend', desc: 'Improve CTA/landing page' },
];

// Determine best approach based on campaign performance
function getBestApproach(metrics: HierarchyNode['metrics']): typeof STRATEGIC_APPROACHES[0] {
    const { roas, ctr, conversions, spend, impressions } = metrics;

    // Prioritize by what's working best
    if (roas && roas > 4) return STRATEGIC_APPROACHES.find(a => a.type === 'Angle')!;
    if (ctr && ctr > 2) return STRATEGIC_APPROACHES.find(a => a.type === 'Message')!;
    if (conversions && conversions > 5) return STRATEGIC_APPROACHES.find(a => a.type === 'Offer')!;
    if (impressions && impressions > 50000) return STRATEGIC_APPROACHES.find(a => a.type === 'Delivery')!;
    if (spend && spend > 5000) return STRATEGIC_APPROACHES.find(a => a.type === 'Conversion')!;

    // Default to angle
    return STRATEGIC_APPROACHES[Math.floor(Math.random() * STRATEGIC_APPROACHES.length)];
}

// ============ COUNT HELPERS ============
function countDescendants(node: HierarchyNode): number {
    return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

function calcSuccessScore(node: HierarchyNode): number {
    const m = node.metrics;
    if (m.roas) return Math.min(m.roas / 8, 1);
    if (m.ctr) return Math.min(m.ctr / 6, 1);
    return 0.5;
}

// Calculate advanced metrics for Winners Circle, Kill Zone, Fatigue, Lifecycle
function calcAdvancedMetrics(node: HierarchyNode, score: number): {
    isWinner: boolean;
    isLoser: boolean;
    fatigueLevel: number;
    lifecycleDays: number;
} {
    const m = node.metrics;
    const roas = m.roas || 0;
    const conversions = m.conversions || 0;
    const spend = m.spend || 0;
    const ctr = m.ctr || 0;

    // Winners Circle: ROAS > 2x OR high success score OR good conversions
    const isWinner = roas > 2 || score > 0.5 || conversions >= 2;

    // Kill Zone: Low performance - low ROAS with some spend, or 0 conversions with spend
    const isLoser = (spend > 500 && conversions === 0) || (roas > 0 && roas < 1);

    // Fatigue Level: Simulated based on CTR (lower CTR = more fatigued)
    // In real app, this would compare CTR over time
    const fatigueLevel = ctr > 0 ? Math.max(0, 1 - (ctr / 3)) : 0;

    // Lifecycle Days: Estimated based on current performance
    // Higher score = more days remaining
    const lifecycleDays = Math.round(score * 30 + Math.random() * 10);

    return { isWinner, isLoser, fatigueLevel, lifecycleDays };
}

// ============ ADAPTIVE SPACING LOGIC ============
function getAdaptiveConfig(campaignCount: number, totalOrbs: number) {
    // Auto-adjust based on how many items we have
    const isCrowded = campaignCount > 10;
    const isVeryCrowded = campaignCount > 25;
    const isExtremelyCrowded = campaignCount > 40;

    // Increase radius exponentially with count
    const baseRadius = 6;
    const radiusMultiplier = isExtremelyCrowded ? 2.5 : isVeryCrowded ? 2.0 : isCrowded ? 1.5 : 1.0;

    // Decrease orb size when crowded
    const sizeMultiplier = isExtremelyCrowded ? 0.4 : isVeryCrowded ? 0.55 : isCrowded ? 0.7 : 1.0;

    // More Y levels when crowded
    const yLevels = isExtremelyCrowded ? 8 : isVeryCrowded ? 5 : isCrowded ? 3 : 2;
    const ySpacing = isExtremelyCrowded ? 3 : isVeryCrowded ? 2.5 : 2;

    return {
        campaignRadius: baseRadius * radiusMultiplier,
        adsetRadius: 3.5 * radiusMultiplier * 0.7,  // Increased for better spacing
        creativeRadius: 2.0 * radiusMultiplier * 0.5, // Increased to spread out creatives
        accountSize: 1.0 * sizeMultiplier * 1.5,
        campaignSize: 0.5 * sizeMultiplier,
        adsetSize: 0.35 * sizeMultiplier,
        creativeSize: 0.2 * sizeMultiplier,
        yLevels,
        ySpacing,
        orbitSpeed: isVeryCrowded ? 0.02 : 0.04,
    };
}

// ============ BUILD ORBS WITH ADAPTIVE SPACING ============
function buildOrbs(hierarchy: HierarchyNode): PositionedOrb[] {
    const orbs: PositionedOrb[] = [];
    const campaigns = hierarchy.children;
    const campaignCount = campaigns.length;
    const totalOrbs = 1 + countDescendants(hierarchy);

    const config = getAdaptiveConfig(campaignCount, totalOrbs);

    // Account at center
    orbs.push({
        id: hierarchy.id,
        name: hierarchy.name,
        type: 'account',
        metrics: hierarchy.metrics,
        position: [0, 0, 0],
        size: config.accountSize,
        color: typeColors.account,
        parentId: null,
        orbitSpeed: 0,
        orbitRadius: 0,
        initialAngle: 0,
        successScore: 1,
    });

    // Distribute campaigns across Y levels
    campaigns.forEach((campaign, cIdx) => {
        const score = calcSuccessScore(campaign);

        // Angle evenly distributed
        const cAngle = (cIdx / campaignCount) * Math.PI * 2 - Math.PI / 2;

        // Radius: better performers closer
        const radiusVariation = 1 - score * 0.3; // 0.7 to 1.0
        const cRadius = config.campaignRadius * radiusVariation;

        // Y level: distribute across levels to prevent overlap
        const yLevel = cIdx % config.yLevels;
        const cY = (yLevel - config.yLevels / 2 + 0.5) * config.ySpacing;

        orbs.push({
            id: campaign.id,
            name: campaign.name,
            type: 'campaign',
            metrics: campaign.metrics,
            position: [Math.cos(cAngle) * cRadius, cY, Math.sin(cAngle) * cRadius],
            size: config.campaignSize * (0.8 + countDescendants(campaign) / 20),
            color: typeColors.campaign,
            parentId: hierarchy.id,
            orbitSpeed: config.orbitSpeed,
            orbitRadius: cRadius,
            initialAngle: cAngle,
            successScore: score,
            ...calcAdvancedMetrics(campaign, score),
        });

        // Ad sets
        const adsets = campaign.children;
        adsets.forEach((adset, aIdx) => {
            const aScore = calcSuccessScore(adset);
            const spreadAngle = adsets.length === 1 ? 0 : (aIdx / (adsets.length - 1) - 0.5) * (Math.PI * 0.4);
            const aAngle = cAngle + spreadAngle;
            const aRadius = config.adsetRadius * (1 - aScore * 0.2);
            const aY = cY + (aIdx % 2 === 0 ? 0.6 : -0.4);

            const campaignPos: [number, number, number] = [Math.cos(cAngle) * cRadius, cY, Math.sin(cAngle) * cRadius];

            orbs.push({
                id: adset.id,
                name: adset.name,
                type: 'adset',
                metrics: adset.metrics,
                position: [campaignPos[0] + Math.cos(aAngle) * aRadius, aY, campaignPos[2] + Math.sin(aAngle) * aRadius],
                size: config.adsetSize * (0.8 + adset.children.length / 8),
                color: typeColors.adset,
                parentId: campaign.id,
                orbitSpeed: config.orbitSpeed * 1.5,
                orbitRadius: aRadius,
                initialAngle: aAngle,
                successScore: aScore,
                ...calcAdvancedMetrics(adset, aScore),
            });

            // Creatives
            const creatives = adset.children;
            creatives.forEach((creative, crIdx) => {
                const crScore = calcSuccessScore(creative);
                const crSpread = creatives.length === 1 ? 0 : (crIdx / (creatives.length - 1) - 0.5) * (Math.PI * 0.3);
                const crAngle = aAngle + crSpread;
                const crRadius = config.creativeRadius * (1 - crScore * 0.2);
                const crY = aY + (crIdx % 3 - 1) * 0.3;

                const adsetPos: [number, number, number] = [
                    campaignPos[0] + Math.cos(aAngle) * aRadius, aY, campaignPos[2] + Math.sin(aAngle) * aRadius
                ];

                orbs.push({
                    id: creative.id,
                    name: creative.name,
                    type: 'creative',
                    metrics: creative.metrics,
                    position: [adsetPos[0] + Math.cos(crAngle) * crRadius, crY, adsetPos[2] + Math.sin(crAngle) * crRadius],
                    size: config.creativeSize,
                    color: typeColors.creative,
                    parentId: adset.id,
                    orbitSpeed: config.orbitSpeed * 2.5,
                    orbitRadius: crRadius,
                    initialAngle: crAngle,
                    successScore: crScore,
                    ...calcAdvancedMetrics(creative, crScore),
                });
            });
        });
    });

    return orbs;
}

// ============ GENERATE AI SUGGESTIONS (Full Campaign Structure) ============
function generateSuggestions(orbs: PositionedOrb[], config: ReturnType<typeof getAdaptiveConfig>): PositionedOrb[] {
    const suggestions: PositionedOrb[] = [];

    // Find winning CAMPAIGNS to branch from (mother campaigns)
    const winningCampaigns = orbs.filter(o => o.type === 'campaign' && o.successScore > 0.4);
    const accountOrb = orbs.find(o => o.type === 'account');

    // Each winning campaign gets a full suggested campaign structure
    winningCampaigns.slice(0, 4).forEach((campaign, cIdx) => {
        // Determine best approach for this campaign
        const approach = getBestApproach(campaign.metrics);
        const angle = CREATIVE_ANGLES[cIdx % CREATIVE_ANGLES.length];
        const persona = PERSONAS[(cIdx + 1) % PERSONAS.length];
        const stage = AWARENESS_STAGES[(cIdx + 2) % AWARENESS_STAGES.length];
        const concept = AD_CONCEPTS[(cIdx + 3) % AD_CONCEPTS.length];
        const format = FORMAT_VARIATIONS[cIdx % FORMAT_VARIATIONS.length];

        // Position suggestion ADJACENT to parent campaign orb
        const parentPos = campaign.position;
        const parentAngle = campaign.initialAngle;

        // Small offset from parent - place suggestion right next to the campaign it's inspired by
        const sideOffset = 1.5; // Distance from parent campaign orb
        const angleOffset = Math.PI * 0.15 * (cIdx % 2 === 0 ? 1 : -1); // Alternate left/right of parent
        const heightOffset = 0.8 + cIdx * 0.3; // Stack slightly up for each suggestion

        // 1. SUGGESTED CAMPAIGN - positioned RIGHT NEXT TO parent campaign (adjacent, not extended)
        const suggestedCampaignId = `suggest-campaign-${campaign.id}-${cIdx}`;
        const campaignPos: [number, number, number] = [
            parentPos[0] + Math.cos(parentAngle + angleOffset) * sideOffset,
            parentPos[1] + heightOffset,
            parentPos[2] + Math.sin(parentAngle + angleOffset) * sideOffset
        ];

        suggestions.push({
            ...campaign,
            id: suggestedCampaignId,
            name: `${approach.emoji} ${approach.type}: ${angle.type.split('_')[0]}`,
            type: 'campaign',
            isSuggestion: true,
            suggestionType: 'new_creative',
            suggestion: `Inspired by ${campaign.name} → ${approach.desc}`,
            basedOnId: campaign.id,
            color: suggestionColors.new_creative,
            position: campaignPos,
            size: config.campaignSize * 0.7,
            initialAngle: parentAngle + angleOffset,
            orbitRadius: sideOffset,
            orbitSpeed: campaign.orbitSpeed * 0.8, // Slightly slower
            parentId: campaign.id, // Connect to mother campaign (inspiration source)
        });

        // 2. SUGGESTED AD SET (child of suggested campaign) - better spacing
        const suggestedAdSetId = `suggest-adset-${campaign.id}-${cIdx}`;
        const adsetAngle = parentAngle + angleOffset + Math.PI * 0.1;
        const adsetOffset = 1.8; // Close to suggested campaign
        const adsetPos: [number, number, number] = [
            campaignPos[0] + Math.cos(adsetAngle) * adsetOffset,
            campaignPos[1] - 0.4,
            campaignPos[2] + Math.sin(adsetAngle) * adsetOffset
        ];

        suggestions.push({
            ...campaign,
            id: suggestedAdSetId,
            name: `${persona.emoji} ${persona.persona}`,
            type: 'adset',
            isSuggestion: true,
            suggestionType: 'new_creative',
            suggestion: `${stage.emoji} ${stage.stage.replace('_', ' ')} targeting`,
            basedOnId: campaign.id,
            color: suggestionColors.new_creative,
            position: adsetPos,
            size: config.adsetSize * 0.7,
            initialAngle: adsetAngle,
            orbitRadius: adsetOffset,
            orbitSpeed: campaign.orbitSpeed * 1.2,
            parentId: suggestedCampaignId, // Connect to suggested campaign
        });

        // 3. SUGGESTED CREATIVE (child of suggested ad set) - better spacing
        const suggestedCreativeId = `suggest-creative-${campaign.id}-${cIdx}`;
        const creativeAngle = adsetAngle + Math.PI * 0.06;
        const creativeOffset = 1.5; // Increased for clarity
        const creativePos: [number, number, number] = [
            adsetPos[0] + Math.cos(creativeAngle) * creativeOffset,
            adsetPos[1] - 0.25,
            adsetPos[2] + Math.sin(creativeAngle) * creativeOffset
        ];

        suggestions.push({
            ...campaign,
            id: suggestedCreativeId,
            name: `${concept.emoji} ${concept.concept}`,
            type: 'creative',
            isSuggestion: true,
            suggestionType: 'new_creative',
            suggestion: `${format.type} • ${persona.age}`,
            basedOnId: campaign.id,
            color: suggestionColors.new_creative,
            position: creativePos,
            size: config.creativeSize * 0.8,
            initialAngle: creativeAngle,
            orbitRadius: creativeOffset,
            orbitSpeed: campaign.orbitSpeed * 1.5,
            parentId: suggestedAdSetId, // Connect to suggested ad set
        });
    });

    return suggestions;
}

// ============ FIND SIMILAR CREATIVES (Pattern/Structure Similarity) ============
interface SimilarityConnection {
    id: string;
    orbA: PositionedOrb;
    orbB: PositionedOrb;
    similarity: number; // 0-1
    reason: string;
}

function findSimilarCreatives(orbs: PositionedOrb[]): SimilarityConnection[] {
    const connections: SimilarityConnection[] = [];
    const creatives = orbs.filter(o => o.type === 'creative' && !o.isSuggestion);

    // Compare creatives pairwise
    for (let i = 0; i < creatives.length; i++) {
        for (let j = i + 1; j < creatives.length; j++) {
            const a = creatives[i];
            const b = creatives[j];

            // Check for similar performance (ROAS within 20%)
            const roasA = a.metrics.roas || 0;
            const roasB = b.metrics.roas || 0;
            if (roasA > 0 && roasB > 0) {
                const roasDiff = Math.abs(roasA - roasB) / Math.max(roasA, roasB);
                if (roasDiff < 0.2 && roasA > 3 && roasB > 3) {
                    connections.push({
                        id: `sim-perf-${a.id}-${b.id}`,
                        orbA: a,
                        orbB: b,
                        similarity: 1 - roasDiff,
                        reason: 'Similar high performance'
                    });
                }
            }

            // Check for same format (name contains same keywords)
            const formatKeywords = ['video', 'image', 'carousel', 'reel', 'story'];
            const aFormat = formatKeywords.find(k => a.name.toLowerCase().includes(k));
            const bFormat = formatKeywords.find(k => b.name.toLowerCase().includes(k));
            if (aFormat && bFormat && aFormat === bFormat && a.successScore > 0.5 && b.successScore > 0.5) {
                connections.push({
                    id: `sim-format-${a.id}-${b.id}`,
                    orbA: a,
                    orbB: b,
                    similarity: 0.7,
                    reason: `Same format: ${aFormat}`
                });
            }
        }
    }

    // Limit to top 10 connections to avoid clutter
    return connections.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
}

// ============ ORB COMPONENT (Labels on Hover) ============
function Orb({ orb, orbs, time, onClick }: { orb: PositionedOrb; orbs: PositionedOrb[]; time: number; onClick?: (orb: PositionedOrb) => void }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    const livePos = useMemo((): [number, number, number] => {
        if (orb.type === 'account') return orb.position;

        const getParentLivePos = (parentId: string | null, baseY: number): [number, number, number] => {
            if (!parentId) return [0, 0, 0];
            const parent = orbs.find(o => o.id === parentId);
            if (!parent || parent.type === 'account') return [0, 0, 0];
            const gp = getParentLivePos(parent.parentId, parent.position[1]);
            const angle = parent.initialAngle + time * parent.orbitSpeed;
            return [gp[0] + Math.cos(angle) * parent.orbitRadius, parent.position[1], gp[2] + Math.sin(angle) * parent.orbitRadius];
        };

        const pp = getParentLivePos(orb.parentId, orb.position[1]);
        const a = orb.initialAngle + time * orb.orbitSpeed;
        const bob = Math.sin(time * 0.25 + orb.initialAngle * 2) * 0.08;
        return [pp[0] + Math.cos(a) * orb.orbitRadius, orb.position[1] + bob, pp[2] + Math.sin(a) * orb.orbitRadius];
    }, [orb, orbs, time]);

    const metric = useMemo(() => {
        const m = orb.metrics;
        if (m.roas) return `${m.roas.toFixed(1)}x ROAS`;
        if (m.spend) return `${formatCurrencyCompact(m.spend)} Spend`;
        if (m.ctr) return `${m.ctr.toFixed(1)}% CTR`;
        return '';
    }, [orb.metrics]);

    // Determine glow color based on status - only red for problems
    // Only show red on CREATIVE level (leaf nodes) with actual issues, never on suggestions
    const hasProblems = !orb.isSuggestion && orb.type === 'creative' && (orb.isLoser || (orb.fatigueLevel && orb.fatigueLevel > 0.5));

    const glowColor = useMemo(() => {
        if (hasProblems) return '#FF4444'; // Red for losers/errors/fatigue
        return orb.color; // Default orb color
    }, [orb, hasProblems]);

    // Glow opacity based on status
    const glowOpacity = useMemo(() => {
        if (orb.type === 'account') return 0.25;
        if (hasProblems) return 0.25 + Math.sin(time * 4) * 0.1; // Pulsing for errors
        return 0.08 + orb.successScore * 0.05;
    }, [orb, time, hasProblems]);

    // Suggestions are brighter and more emissive
    const emissiveIntensity = orb.isSuggestion ? 0.8 : (orb.type === 'account' ? 1.0 : 0.2 + orb.successScore * 0.3);

    useFrame((state) => {
        if (meshRef.current) meshRef.current.rotation.y += 0.002;
        if (glowRef.current) {
            // Pulsing animation - different for each type, using real-time clock
            const t = state.clock.elapsedTime;
            let pulseSpeed = 1.2;
            let pulseAmount = 0.04;

            if (orb.type === 'account') {
                pulseSpeed = 0.8;
                pulseAmount = 0.12; // Larger, slower pulse for account
            } else if (orb.isSuggestion) {
                pulseSpeed = 3.0;
                pulseAmount = 0.15;
            }

            const s = 1 + Math.sin(t * pulseSpeed + orb.initialAngle) * pulseAmount;
            glowRef.current.scale.setScalar(s);
        }
    });

    return (
        <group position={livePos}>
            {/* Main Glow - color changes based on status */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[orb.size * (orb.type === 'account' ? 1.6 : 1.35), 16, 16]} />
                <meshBasicMaterial
                    color={glowColor}
                    transparent
                    opacity={glowOpacity}
                    depthWrite={false}
                />
            </mesh>
            <mesh
                ref={meshRef}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
                onClick={() => onClick?.(orb)}
            >
                <sphereGeometry args={[orb.size, 32, 32]} />
                <meshStandardMaterial
                    color={orb.color}
                    emissive={orb.color}
                    emissiveIntensity={hovered ? emissiveIntensity * 1.5 : emissiveIntensity}
                    metalness={0.15}
                    roughness={0.35}
                />
            </mesh>
            {/* LABELS: Show on hover for all orbs, always for account */}
            {(hovered || orb.type === 'account') && (
                <Html distanceFactor={25} position={[0, orb.size + 0.25, 0]} center>
                    <div className="text-center whitespace-nowrap pointer-events-none select-none animate-fadeIn">
                        <div
                            className="text-[9px] font-semibold px-2 py-0.5 rounded backdrop-blur-sm"
                            style={{
                                background: orb.isSuggestion ? 'rgba(0,0,0,0.95)' : 'rgba(0,0,0,0.85)',
                                color: orb.color,
                                border: `1px solid ${orb.color}${orb.isSuggestion ? '' : '50'}`,
                                boxShadow: orb.isSuggestion ? `0 0 10px ${orb.color}50` : 'none'
                            }}
                        >
                            {orb.name}
                        </div>
                        {orb.suggestion && (
                            <div className="text-[8px] mt-0.5 px-1 opacity-80" style={{ color: orb.color }}>
                                {orb.suggestion}
                            </div>
                        )}
                        {!orb.isSuggestion && metric && (
                            <div className="text-[10px] font-bold mt-0.5" style={{ color: orb.color }}>{metric}</div>
                        )}
                    </div>
                </Html>
            )}
        </group>
    );
}

// ============ CONNECTIONS ============
function Connections({ orbs, time }: { orbs: PositionedOrb[]; time: number }) {
    const lines = useMemo(() => {
        const result: { id: string; start: [number, number, number]; end: [number, number, number]; color: string; isSuggestion?: boolean }[] = [];

        const getLivePos = (orb: PositionedOrb): [number, number, number] => {
            if (orb.type === 'account') return [0, 0, 0];
            const getParentLivePos = (parentId: string | null): [number, number, number] => {
                if (!parentId) return [0, 0, 0];
                const parent = orbs.find(o => o.id === parentId);
                if (!parent || parent.type === 'account') return [0, 0, 0];
                const gp = getParentLivePos(parent.parentId);
                const angle = parent.initialAngle + time * parent.orbitSpeed;
                return [gp[0] + Math.cos(angle) * parent.orbitRadius, parent.position[1], gp[2] + Math.sin(angle) * parent.orbitRadius];
            };
            const pp = getParentLivePos(orb.parentId);
            const a = orb.initialAngle + time * orb.orbitSpeed;
            return [pp[0] + Math.cos(a) * orb.orbitRadius, orb.position[1], pp[2] + Math.sin(a) * orb.orbitRadius];
        };

        // Draw lines for ALL orbs (campaign → adset → creative)
        orbs.filter(o => o.parentId).forEach(orb => {
            const parent = orbs.find(p => p.id === orb.parentId);
            if (parent) {
                result.push({ id: orb.id, start: getLivePos(parent), end: getLivePos(orb), color: orb.color, isSuggestion: orb.isSuggestion });
            }
        });
        return result;
    }, [orbs, time]);

    return (
        <>
            {lines.map(l => (
                <Line key={l.id} points={[l.start, l.end]} color={l.color} lineWidth={0.8} transparent opacity={0.15} dashed dashScale={8} dashSize={0.1} gapSize={0.08} />
            ))}
        </>
    );
}

// ============ WARP PARTICLES ============
function WarpParticles({ active }: { active: boolean }) {
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.PointsMaterial>(null);
    const count = 400;
    const fade = useRef(0);

    const [positions, velocities] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const vel = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1), r = 20 + Math.random() * 25;
            pos[i3] = r * Math.sin(p) * Math.cos(t);
            pos[i3 + 1] = r * Math.sin(p) * Math.sin(t);
            pos[i3 + 2] = r * Math.cos(p);
            const s = 0.5 + Math.random() * 0.5;
            vel[i3] = (-pos[i3] / r) * s; vel[i3 + 1] = (-pos[i3 + 1] / r) * s; vel[i3 + 2] = (-pos[i3 + 2] / r) * s;
        }
        return [pos, vel];
    }, []);

    useFrame((_, dt) => {
        fade.current = active ? Math.min(1, fade.current + dt * 1.5) : Math.max(0, fade.current - dt * 1);
        if (materialRef.current) materialRef.current.opacity = fade.current * 0.7;
        if (!pointsRef.current || fade.current === 0) return;
        const arr = pointsRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            arr[i3] += velocities[i3]; arr[i3 + 1] += velocities[i3 + 1]; arr[i3 + 2] += velocities[i3 + 2];
            const d = Math.sqrt(arr[i3] ** 2 + arr[i3 + 1] ** 2 + arr[i3 + 2] ** 2);
            if (d < 5) {
                const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1), r = 30 + Math.random() * 15;
                arr[i3] = r * Math.sin(p) * Math.cos(t); arr[i3 + 1] = r * Math.sin(p) * Math.sin(t); arr[i3 + 2] = r * Math.cos(p);
                const sp = 0.5 + Math.random() * 0.5;
                velocities[i3] = (-arr[i3] / r) * sp; velocities[i3 + 1] = (-arr[i3 + 1] / r) * sp; velocities[i3 + 2] = (-arr[i3 + 2] / r) * sp;
            }
        }
        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    if (fade.current === 0 && !active) return null;
    return (
        <Points ref={pointsRef} positions={positions} stride={3} frustumCulled={false}>
            <pointsMaterial ref={materialRef} transparent color="#8B5CF6" size={0.12} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </Points>
    );
}

// ============ TIME TRACKER ============
function TimeTracker({ onUpdate }: { onUpdate: (t: number) => void }) {
    useFrame(s => onUpdate(s.clock.elapsedTime));
    return null;
}

// ============ CAMERA ZOOM TRANSITION ============
function CameraZoom({ active }: { active: boolean }) {
    const { camera } = useThree();
    const wasActive = useRef(false);

    useFrame((_, dt) => {
        // Only animate when transitioning
        if (active) {
            wasActive.current = true;
            // Zoom in during transition
            camera.position.z += (15 - camera.position.z) * dt * 2.5;
            camera.position.y += (10 - camera.position.y) * dt * 1.5;
        } else if (wasActive.current) {
            // Zoom back out after transition
            camera.position.z += (35 - camera.position.z) * dt * 1.5;
            camera.position.y += (20 - camera.position.y) * dt * 1.2;

            // Stop animating once we're close enough - let OrbitControls take over
            if (Math.abs(camera.position.z - 35) < 0.5 && Math.abs(camera.position.y - 20) < 0.5) {
                wasActive.current = false;
            }
        }
        // When not transitioning and never was, do nothing - OrbitControls works freely
    });

    return null;
}

// ============ SCENE ============
interface SceneProps {
    hierarchy: HierarchyNode;
    transitioning: boolean;
    showSuggestions: boolean;
    performanceFilter: 'all' | 'winners' | 'losers' | 'suggestions' | 'campaigns';
    onOrbClick: (orb: PositionedOrb) => void;
    orbSearchQuery?: string;
}

function Scene({ hierarchy, transitioning, showSuggestions, performanceFilter, onOrbClick, orbSearchQuery = '' }: SceneProps) {
    const [time, setTime] = useState(0);

    const { orbs, suggestions, config, similarityConnections } = useMemo(() => {
        const campaigns = hierarchy.children;
        const totalOrbs = 1 + countDescendants(hierarchy);
        const config = getAdaptiveConfig(campaigns.length, totalOrbs);
        const orbs = buildOrbs(hierarchy);
        const suggestions = generateSuggestions(orbs, config);
        const similarityConnections = findSimilarCreatives(orbs);
        return { orbs, suggestions, config, similarityConnections };
    }, [hierarchy]);

    // Apply filters
    const filteredOrbs = useMemo(() => {
        // Handle "Suggestions Only" filter first
        if (performanceFilter === 'suggestions') {
            // Show account + suggestions only
            return [orbs.find(o => o.type === 'account')!, ...suggestions];
        }

        // Handle "Campaigns Only" filter
        if (performanceFilter === 'campaigns') {
            return orbs.filter(o => o.type === 'account' || o.type === 'campaign');
        }

        let result = [...orbs];
        if (showSuggestions) {
            result = [...result, ...suggestions];
        }
        if (performanceFilter === 'winners') {
            result = result.filter(o => o.isWinner || o.type === 'account');
        } else if (performanceFilter === 'losers') {
            result = result.filter(o => o.isLoser || o.type === 'account');
        }
        return result;
    }, [orbs, suggestions, showSuggestions, performanceFilter]);

    // Apply orb search filter to highlight matching orbs
    const searchFilteredOrbs = useMemo(() => {
        if (!orbSearchQuery.trim()) return filteredOrbs;
        const q = orbSearchQuery.toLowerCase();
        return filteredOrbs.map(orb => ({
            ...orb,
            // Dim non-matching orbs by adjusting color opacity
            _isSearchMatch: orb.name.toLowerCase().includes(q) ||
                orb.type.toLowerCase().includes(q) ||
                (orb.suggestion?.toLowerCase().includes(q) ?? false)
        }));
    }, [filteredOrbs, orbSearchQuery]);

    const allOrbs = searchFilteredOrbs;

    // Compute live positions for similarity lines
    const getLivePos = (orb: PositionedOrb): [number, number, number] => {
        if (orb.type === 'account') return [0, 0, 0];
        const getParentLivePos = (parentId: string | null): [number, number, number] => {
            if (!parentId) return [0, 0, 0];
            const parent = allOrbs.find(o => o.id === parentId);
            if (!parent || parent.type === 'account') return [0, 0, 0];
            const gp = getParentLivePos(parent.parentId);
            const angle = parent.initialAngle + time * parent.orbitSpeed;
            return [gp[0] + Math.cos(angle) * parent.orbitRadius, parent.position[1], gp[2] + Math.sin(angle) * parent.orbitRadius];
        };
        const pp = getParentLivePos(orb.parentId);
        const a = orb.initialAngle + time * orb.orbitSpeed;
        return [pp[0] + Math.cos(a) * orb.orbitRadius, orb.position[1], pp[2] + Math.sin(a) * orb.orbitRadius];
    };

    return (
        <>
            <TimeTracker onUpdate={setTime} />
            <WarpParticles active={transitioning} />
            <CameraZoom active={transitioning} />

            <ambientLight intensity={0.45} />
            <pointLight position={[0, 8, 0]} intensity={1.0} color="#90EE90" />
            <pointLight position={[20, 10, 15]} intensity={0.4} color="#87CEEB" />
            <pointLight position={[-20, 10, -15]} intensity={0.35} color="#DDA0DD" />

            <Stars radius={200} depth={100} count={2500} factor={4} fade speed={0.5} />

            <EffectComposer>
                <Bloom luminanceThreshold={0.45} luminanceSmoothing={0.6} intensity={0.2} />
            </EffectComposer>

            <Connections orbs={allOrbs} time={time} />

            {allOrbs.map(o => <Orb key={o.id} orb={o} orbs={allOrbs} time={time} onClick={onOrbClick} />)}

            <OrbitControls target={[0, 0, 0]} enablePan={false} enableZoom minDistance={15} maxDistance={80} autoRotate autoRotateSpeed={0.08} />
        </>
    );
}

// ============ PAGE ============
export default function AlgorithmPage() {
    const { profile } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
    const [searching, setSearching] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [transitioning, setTransitioning] = useState(false);

    // Filter controls
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [performanceFilter, setPerformanceFilter] = useState<'all' | 'winners' | 'losers' | 'suggestions' | 'campaigns'>('all');
    const [selectedOrb, setSelectedOrb] = useState<PositionedOrb | null>(null);
    const [orbSearchQuery, setOrbSearchQuery] = useState('');
    const [showOrbSearchDropdown, setShowOrbSearchDropdown] = useState(false);

    const hierarchy = useMemo(() => {
        return selectedUser ? getOtherUserHierarchy(selectedUser.full_name || selectedUser.email.split('@')[0]) : demoHierarchy;
    }, [selectedUser]);

    const stats = useMemo(() => {
        const campaigns = hierarchy.children.length;
        const adsets = hierarchy.children.reduce((s, c) => s + c.children.length, 0);
        const creatives = hierarchy.children.reduce((s, c) => s + c.children.reduce((s2, a) => s2 + a.children.length, 0), 0);
        return { campaigns, adsets, creatives, total: 1 + campaigns + adsets + creatives };
    }, [hierarchy]);

    // Compute orb search suggestions from hierarchy
    const orbSearchSuggestions = useMemo(() => {
        if (!orbSearchQuery.trim() || orbSearchQuery.length < 1) return [];
        const q = orbSearchQuery.toLowerCase();
        const results: { id: string; name: string; type: string }[] = [];

        // Search through hierarchy
        const searchNode = (node: HierarchyNode) => {
            if (node.name.toLowerCase().includes(q) || node.type.toLowerCase().includes(q)) {
                results.push({ id: node.id, name: node.name, type: node.type });
            }
            node.children.forEach(searchNode);
        };
        searchNode(hierarchy);

        return results.slice(0, 6);
    }, [hierarchy, orbSearchQuery]);

    async function handleSearch(q: string) {
        setSearchQuery(q);
        if (q.length < 2) { setSearchResults([]); return; }
        setSearching(true);
        const dummy: SearchResult = { id: 'demo', email: 'test@demo.com', full_name: 'Test User' };
        const { data } = await supabase.from('profiles').select('id, email, full_name').or(`email.ilike.%${q}%,full_name.ilike.%${q}%`).neq('id', profile?.id || '').limit(4);
        const res = [...(data || [])];
        if ('test'.includes(q.toLowerCase()) || 'demo'.includes(q.toLowerCase())) res.unshift(dummy);
        setSearchResults(res.slice(0, 5));
        setSearching(false);
    }

    function selectUser(u: SearchResult) {
        setTransitioning(true);
        setTimeout(() => { setSelectedUser(u); setSearchQuery(''); setSearchResults([]); setShowSearch(false); }, 600);
        setTimeout(() => setTransitioning(false), 1500);
    }

    function clearSelection() {
        setTransitioning(true);
        setTimeout(() => setSelectedUser(null), 600);
        setTimeout(() => setTransitioning(false), 1500);
    }

    return (
        <div className="flex">
            <Sidebar />
            <main className="main-content flex-1 p-0">
                {/* Header */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="absolute top-6 left-24 z-10">
                    <GlassCard className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="relative w-10 h-10 rounded-xl overflow-hidden">
                                <Image src="/logo.png" alt="ATHENA" fill className="object-cover" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold"><span className="text-gradient">Algorithm</span></h1>
                                <p className="text-xs text-[var(--text-secondary)]">
                                    Hover orbs to see details • {stats.total} items
                                </p>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Stats Badge */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="absolute top-6 left-[320px] z-10">
                    <GlassCard className="px-3 py-2 flex items-center gap-3 text-[10px]">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: typeColors.campaign }} />
                            <span>{stats.campaigns} Campaigns</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: typeColors.adset }} />
                            <span>{stats.adsets} Ad Sets</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full" style={{ background: typeColors.creative }} />
                            <span>{stats.creatives} Creatives</span>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Search */}
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="absolute top-6 right-6 z-10">
                    <GlassCard className="p-3 min-w-[220px]">
                        {selectedUser ? (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <User size={12} className="text-[var(--accent-primary)]" />
                                        <span className="text-sm font-medium">{selectedUser.full_name || selectedUser.email}</span>
                                    </div>
                                    <button onClick={clearSelection} className="btn-icon w-5 h-5"><X size={10} /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={12} />
                                    <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)} onFocus={() => setShowSearch(true)} placeholder="Search..." className="input pl-7 text-xs py-1.5" />
                                </div>
                                <AnimatePresence>
                                    {showSearch && searchResults.length > 0 && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 space-y-1">
                                            {searchResults.map(u => (
                                                <button key={u.id} onClick={() => selectUser(u)} className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-[var(--accent-soft)] text-left">
                                                    <User size={10} className="text-[var(--text-muted)]" />
                                                    <span className="text-xs">{u.full_name || u.email}</span>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        )}
                    </GlassCard>
                </motion.div>

                {/* Legend */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="absolute bottom-20 right-6 z-10">
                    <GlassCard className="p-2.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <Info size={10} className="text-[var(--text-muted)]" />
                            <span className="text-[9px] font-semibold">Tips</span>
                        </div>
                        <div className="space-y-1 text-[9px] text-[var(--text-muted)]">
                            <p>📍 Closer = Higher ROAS</p>
                            <p>📐 Larger = More content</p>
                            <p>🖱️ Hover for details</p>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Controls & Filters */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
                    <GlassCard className="px-4 py-2 flex items-center gap-4">
                        {/* Orb Search */}
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={12} />
                            <input
                                type="text"
                                value={orbSearchQuery}
                                onChange={(e) => setOrbSearchQuery(e.target.value)}
                                onFocus={() => setShowOrbSearchDropdown(true)}
                                onBlur={() => setTimeout(() => setShowOrbSearchDropdown(false), 200)}
                                placeholder="Search orbs..."
                                className="text-xs bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded px-2 py-1 pl-6 w-40 focus:border-[var(--accent-primary)] focus:outline-none"
                            />
                            {/* Search Suggestions Dropdown */}
                            <AnimatePresence>
                                {showOrbSearchDropdown && orbSearchSuggestions.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        className="absolute bottom-full left-0 mb-1 w-48 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg shadow-lg overflow-hidden z-50"
                                    >
                                        <div className="text-[9px] text-[var(--text-muted)] px-2 py-1 border-b border-[var(--glass-border)]">
                                            Matching orbs
                                        </div>
                                        {orbSearchSuggestions.map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    setOrbSearchQuery(item.name);
                                                    setShowOrbSearchDropdown(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-[var(--accent-soft)] transition-colors"
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: typeColors[item.type] || '#87CEEB' }}
                                                />
                                                <span className="text-[10px] truncate">{item.name}</span>
                                                <span className="text-[8px] text-[var(--text-muted)] ml-auto capitalize">
                                                    {item.type}
                                                </span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="w-px h-4 bg-[var(--border-subtle)]" />
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showSuggestions}
                                onChange={e => setShowSuggestions(e.target.checked)}
                                className="accent-[var(--accent-primary)]"
                            />
                            <span>💡 Suggestions</span>
                        </label>
                        <select
                            value={performanceFilter}
                            onChange={e => setPerformanceFilter(e.target.value as typeof performanceFilter)}
                            className="text-xs bg-[#1a2a2a] text-white border border-[var(--border-subtle)] rounded px-3 py-1.5 cursor-pointer"
                            style={{ backgroundColor: '#1a2a2a' }}
                        >
                            <option value="all">🌐 All Orbs</option>
                            <option value="suggestions">💡 Suggestions Only</option>
                            <option value="campaigns">📊 Campaigns Only</option>
                            <option value="winners">🏆 Winners Only</option>
                            <option value="losers">⚠️ Losers Only</option>
                        </select>
                    </GlassCard>
                </motion.div>

                {/* Detail Panel - Click Orb Expanded View */}
                <AnimatePresence>
                    {selectedOrb && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="absolute bottom-24 left-24 z-20 w-72"
                        >
                            <GlassCard className="p-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="text-xs text-[var(--text-muted)] uppercase">{selectedOrb.type}</span>
                                        <h3 className="font-semibold text-sm" style={{ color: selectedOrb.color }}>{selectedOrb.name}</h3>
                                    </div>
                                    <button onClick={() => setSelectedOrb(null)} className="btn-icon w-6 h-6"><X size={12} /></button>
                                </div>

                                <div className="space-y-2 text-xs">
                                    {selectedOrb.metrics.roas && (
                                        <div className="flex justify-between">
                                            <span className="text-[var(--text-muted)]">ROAS</span>
                                            <span className="font-semibold">{selectedOrb.metrics.roas.toFixed(2)}x</span>
                                        </div>
                                    )}
                                    {selectedOrb.metrics.spend && (
                                        <div className="flex justify-between">
                                            <span className="text-[var(--text-muted)]">Spend</span>
                                            <span>{formatCurrencyCompact(selectedOrb.metrics.spend)}</span>
                                        </div>
                                    )}
                                    {selectedOrb.metrics.conversions !== undefined && (
                                        <div className="flex justify-between">
                                            <span className="text-[var(--text-muted)]">Conversions</span>
                                            <span>{selectedOrb.metrics.conversions}</span>
                                        </div>
                                    )}
                                    {selectedOrb.metrics.ctr && (
                                        <div className="flex justify-between">
                                            <span className="text-[var(--text-muted)]">CTR</span>
                                            <span>{selectedOrb.metrics.ctr.toFixed(2)}%</span>
                                        </div>
                                    )}

                                    <div className="border-t border-[var(--border-subtle)] pt-2 mt-2">
                                        {selectedOrb.isWinner && (
                                            <div className="flex items-center gap-2 text-green-400">
                                                <span>🏆</span>
                                                <span>Winners Circle - Ready to Scale</span>
                                            </div>
                                        )}
                                        {selectedOrb.isLoser && (
                                            <div className="flex items-center gap-2 text-red-400">
                                                <span>⚠️</span>
                                                <span>Kill Zone - Consider Pausing</span>
                                            </div>
                                        )}
                                        {selectedOrb.fatigueLevel && selectedOrb.fatigueLevel > 0.5 && (
                                            <div className="flex items-center gap-2 text-orange-400">
                                                <span>🔥</span>
                                                <span>Fatigue Warning ({Math.round(selectedOrb.fatigueLevel * 100)}%)</span>
                                            </div>
                                        )}
                                        {selectedOrb.lifecycleDays && (
                                            <div className="flex items-center gap-2 text-blue-400 mt-1">
                                                <span>📅</span>
                                                <span>~{selectedOrb.lifecycleDays} days remaining</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </GlassCard>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Canvas */}
                <div className="w-full h-screen">
                    <Canvas camera={{ position: [0, 20, 35], fov: 50 }} gl={{ antialias: true, alpha: true }} style={{ background: 'linear-gradient(135deg, #0a1a1a 0%, #0d2d2d 50%, #0a1f1f 100%)' }}>
                        <Suspense fallback={null}>
                            <Scene
                                hierarchy={hierarchy}
                                transitioning={transitioning}
                                showSuggestions={showSuggestions}
                                performanceFilter={performanceFilter}
                                onOrbClick={setSelectedOrb}
                                orbSearchQuery={orbSearchQuery}
                            />
                        </Suspense>
                    </Canvas>
                </div>

                {/* AI Chat Widget */}
                <AIChatWidget />
            </main>
        </div>
    );
}
