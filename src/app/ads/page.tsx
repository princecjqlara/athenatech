'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
    Search,
    Filter,
    TrendingUp,
    TrendingDown,
    Eye,
    MousePointer,
    DollarSign,
    Link2,
    Megaphone,
    Image as ImageIcon,
    Upload,
    Play,
    Radio,
    Target,
    Trophy,
    PieChart,
    BarChart3,
    Coins,
    RefreshCw,
    X,
    ArrowUpDown,
    Users,
    UserCheck,
    ChevronRight,
    ChevronDown,
    FolderOpen,
    Folder,
    Calendar,
    MapPin,
    Video,
    ImageIcon as Picture,
    Tag,
    Plus,
    Palette,
    Zap,
    Activity,
    CheckCircle,
    AlertTriangle,
    AlertCircle,
    FileText,
    Lightbulb,
    Settings,
    Edit3,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine,
} from 'recharts';
import { Sidebar } from '@/components/ui/Sidebar';
import { GlassCard } from '@/components/ui/GlassCard';
import { UploadCreativeModal } from '@/components/ui/UploadCreativeModal';
import { StructureFingerprint } from '@/lib/creativeExtractor';
import { NarrativeChecklistForm } from '@/components/ui/NarrativeChecklistForm';
import {
    checkNarrativeEligibility,
    diagnoseNarrative,
    getEligibilityMessage,
    getGapLabel,
    NarrativeChecklist,
    defaultChecklist,
} from '@/lib/narrativeChecklist';

// Types
type AdPhase = 'learning' | 'scaling' | 'stable' | 'declining' | 'fatigued' | 'insufficient';
type AdStatus = 'active' | 'paused' | 'stopped';
type AdPerformance = 'winner' | 'neutral' | 'loser' | 'insufficient';
type CampaignObjective = 'CONVERSIONS' | 'TRAFFIC' | 'AWARENESS' | 'ENGAGEMENT' | 'LEADS';
type CreativeType = 'Problem_Solution' | 'Us_Vs_Them' | 'Founder_Story_BTS' | 'UGC_Testimonial' | 'Direct_Offer_Static';

interface DailyMetrics {
    date: string;
    spend: number;
    revenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
    leads: number;
    ctr: number;
    cpc: number;
    roas: number;
}

interface VideoMetrics {
    thruPlays: number;
    views3s: number;
    retention25: number;
    retention50: number;
    retention75: number;
    retention95: number;
    avgWatchTime: number;
    hookRate: number;
}

interface DemographicBreakdown {
    name: string;
    spend: number;
    conversions: number;
    roas: number;
    percentage: number;
}

interface Demographics {
    age: DemographicBreakdown[];
    gender: DemographicBreakdown[];
    location: DemographicBreakdown[];
    device: DemographicBreakdown[];
    placement: DemographicBreakdown[];
}

interface Location {
    country: string;
    region?: string;
    city?: string;
}

interface Targeting {
    ageMin: number;
    ageMax: number;
    genders: ('male' | 'female' | 'all')[];
    locations: Location[];
    interests: string[];
    audienceSize: number;
}

interface Ad {
    id: string;
    adSetId: string;
    name: string;
    status: AdStatus;
    phase: AdPhase;
    creativeType: CreativeType;
    mediaType: 'video' | 'image' | 'carousel';
    thumbnailUrl?: string;

    // Core metrics
    spend: number;
    revenue: number;
    impressions: number;
    reach: number;
    frequency: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    conversions: number;
    cpa: number;
    leads: number;
    qualifiedLeads: number;

    // Video metrics (for video ads)
    videoMetrics?: VideoMetrics;

    // Demographics breakdown
    demographics?: Demographics;

    // Day-by-day data (last 30 days)
    dailyData: DailyMetrics[];

    // Lead tags assigned to this ad
    tags: LeadTag[];

    performance: AdPerformance;
    createdAt: Date;
}

interface AdSet {
    id: string;
    campaignId: string;
    name: string;
    status: AdStatus;
    budget: number;
    budgetType: 'daily' | 'lifetime';
    targeting: Targeting;
    placements: string[];
    schedule: { start: Date; end?: Date };
    ads: Ad[];

    // Aggregated metrics (calculated from ads)
    spend: number;
    revenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
    leads: number;
    qualifiedLeads: number;
    createdAt: Date;
}

interface Campaign {
    id: string;
    name: string;
    objective: CampaignObjective;
    status: AdStatus;
    budgetType: 'daily' | 'lifetime';
    budget: number;
    adSets: AdSet[];

    // Aggregated metrics (calculated from ad sets)
    spend: number;
    revenue: number;
    impressions: number;
    clicks: number;
    conversions: number;
    leads: number;
    qualifiedLeads: number;
    createdAt: Date;
}

interface Creative {
    id: string;
    name: string;
    type: 'video' | 'image';
    thumbnailUrl: string;
    deliveryScore: number;
    structureRating: string;
    status: 'analyzed' | 'analyzing' | 'needs_optimization';
    placement: string;

    // System Diagnostic Data
    deliveryHealth: DeliveryHealth;
    conversionHealth: ConversionHealth;
    structureAnalysis?: StructureAnalysis;
    conversionAnalysis?: ConversionAnalysis;
    narrativeAnalysis?: NarrativeAnalysis;
    nextBestAction?: NextBestAction;
}

// 3-System Diagnostic Types
type DeliveryHealth = 'healthy' | 'risky' | 'poor';
type ConversionHealth = 'good' | 'bad' | 'insufficient';
type SystemAuthority = 'structure' | 'conversion_owner' | 'winner';
type ConfidenceLevel = 'high' | 'medium' | 'insufficient';

interface StructureAnalysis {
    // Visual signals
    motionOnsetTiming: number; // ms
    motionIntensity: 'low' | 'medium' | 'high';
    cutDensity: number; // cuts per minute
    shotLengthAvg: number; // seconds
    textPresence: { areaPct: number; timing: number; position: string };
    brightnessScore: number; // 0-100

    // Audio signals
    audioStartTiming: number; // ms
    loudnessCurve: 'rising' | 'flat' | 'falling';
    silenceRatio: number; // 0-1
    speechEarly: boolean;

    // Script signals (timing only)
    speechStartTime: number; // ms
    wordsPerSecond: number;
    pauseDensity: number;

    // Output
    deliveryProbability: number; // 0-100
    attentionBreakpoints: string[]; // e.g., "0-1s", "3-5s"
    structuralFixes: string[];
}

interface ConversionAnalysis {
    // === Input Source ===
    inputSource?: 'meta_ads' | 'manual' | 'capi';

    // === Primary Metrics (from Meta Ads) ===
    spend?: number;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    cpm?: number;
    cpc?: number;
    cpa?: number;
    cvr?: number;
    roas?: number;
    value?: number;
    conversions?: number;
    leads?: number;

    // === Video Metrics (if applicable) ===
    video3sViews?: number;
    thruPlay?: number;
    avgWatchTime?: number;
    hookRate?: number;

    // === Efficiency vs Baseline ===
    efficiencyScore?: number;
    cpaEfficiency?: number;
    roasEfficiency?: number;
    accountBaselineCpa?: number;
    accountBaselineRoas?: number;

    // === Confidence ===
    confidence: ConfidenceLevel;
    confidenceReason?: string;
    sampleSize?: number;
    variance?: number;

    // === Trends & Alerts ===
    trend?: 'improving' | 'stable' | 'declining';
    trendPeriod?: string;
    alerts?: ConversionAlert[];

    // === Funnel ===
    funnelDropoffs?: { stage: string; dropRate: number; status?: 'healthy' | 'warning' | 'critical' }[];
    funnelSource?: 'meta_events' | 'capi' | 'estimated';
    funnelLeakLocation?: string;
    primaryIssue?: 'landing_page' | 'checkout' | 'offer' | 'tracking' | 'none';

    // === Breakdown Context ===
    placement?: 'feed' | 'reels' | 'stories' | 'audience_network' | 'messenger';
    geo?: string;
    device?: 'mobile' | 'desktop' | 'tablet';

    // === Output ===
    recommendations?: string[];

    // === Legacy fields ===
    normalizedCpa?: number;
    offerStrength?: number;
    messageLandingAlignment?: number;
}

interface ConversionAlert {
    type: 'cpa_spike' | 'roas_drop' | 'cvr_decline' | 'spend_inefficiency';
    severity: 'warning' | 'critical';
    message: string;
    value: number;
    threshold: number;
    delta: number;
}

interface NarrativeAnalysis {
    // === CTA Atomic Fields ===
    ctaPresent: boolean;
    ctaHasActionVerb: boolean;
    ctaHasOutcome: boolean;
    ctaHasUrgency?: boolean;

    // === Value Proposition Atomic Fields ===
    benefitStated: boolean;
    benefitQuantified: boolean;
    timeToBenefitStated: boolean;
    valueTiming: 'opening' | 'middle' | 'end' | 'not_present';

    // === Offer Fields ===
    offerPresent: boolean;
    offerTiming: 'early' | 'mid' | 'late' | 'not_shown';

    // === Other Observable Fields ===
    proofPresent: boolean;
    pricingVisible: boolean;
    guaranteeMentioned: boolean;

    // === Alignment ===
    adLpMatch: 'yes' | 'unsure' | 'no';

    // === Metadata ===
    userConfirmed: boolean;
    llmAssisted: boolean;

    // === Legacy fields (for backward compatibility) ===
    primaryAngle: string;
    emotionalTone: string;
    persuasionType: 'problem_solution' | 'social_proof' | 'authority' | 'scarcity' | 'other' | 'unknown';
    diagnosticNotes: string[];
}

interface NextBestAction {
    action: string;
    testType: 'offer' | 'message' | 'structure' | 'audience' | 'funnel';
    expectedLearningValue: 'high' | 'medium' | 'low';
    variablesToLock: string[];
    hypothesis: string;
}

interface LeadTag {
    id: string;
    name: string;
    color: string;
}

const statusColors: Record<AdStatus, string> = {
    active: 'badge-success',
    paused: 'badge-warning',
    stopped: 'badge-error',
};

const performanceColors: Record<AdPerformance, string> = {
    winner: 'badge-success',
    neutral: 'badge-info',
    loser: 'badge-error',
    insufficient: 'badge-warning',
};

const phaseColors: Record<AdPhase, string> = {
    learning: 'bg-blue-500/20 text-blue-400',
    scaling: 'bg-green-500/20 text-green-400',
    stable: 'bg-yellow-500/20 text-yellow-400',
    declining: 'bg-orange-500/20 text-orange-400',
    fatigued: 'bg-red-500/20 text-red-400',
    insufficient: 'bg-gray-500/20 text-gray-400',
};

const phaseIcons: Record<AdPhase, string> = {
    learning: '📚',
    scaling: '🚀',
    stable: '✅',
    declining: '📉',
    fatigued: '😴',
    insufficient: '❓',
};

function getScoreColor(score: number) {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--error)';
}

// Helper to generate daily data
function generateDailyData(baseSpend: number, baseRevenue: number, days: number = 14): DailyMetrics[] {
    const data: DailyMetrics[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dailySpend = Math.floor(baseSpend / days * (0.7 + Math.random() * 0.6));
        const dailyRevenue = Math.floor(baseRevenue / days * (0.6 + Math.random() * 0.8));
        const dailyImpressions = Math.floor(5000 + Math.random() * 10000);
        const dailyClicks = Math.floor(dailyImpressions * (0.02 + Math.random() * 0.02));
        data.push({
            date: date.toISOString().split('T')[0],
            spend: dailySpend,
            revenue: dailyRevenue,
            impressions: dailyImpressions,
            clicks: dailyClicks,
            conversions: Math.floor(dailyClicks * 0.05),
            leads: Math.floor(dailyClicks * 0.08),
            ctr: parseFloat((dailyClicks / dailyImpressions * 100).toFixed(2)),
            cpc: parseFloat((dailySpend / dailyClicks).toFixed(2)),
            roas: parseFloat((dailyRevenue / dailySpend).toFixed(2)),
        });
    }
    return data;
}

// Helper to generate demographics
function generateDemographics(spend: number, conversions: number): Demographics {
    return {
        age: [
            { name: '18-24', spend: spend * 0.15, conversions: Math.floor(conversions * 0.12), roas: 2.1, percentage: 15 },
            { name: '25-34', spend: spend * 0.35, conversions: Math.floor(conversions * 0.40), roas: 3.2, percentage: 35 },
            { name: '35-44', spend: spend * 0.28, conversions: Math.floor(conversions * 0.30), roas: 2.8, percentage: 28 },
            { name: '45-54', spend: spend * 0.15, conversions: Math.floor(conversions * 0.12), roas: 2.0, percentage: 15 },
            { name: '55+', spend: spend * 0.07, conversions: Math.floor(conversions * 0.06), roas: 1.5, percentage: 7 },
        ],
        gender: [
            { name: 'Female', spend: spend * 0.62, conversions: Math.floor(conversions * 0.65), roas: 3.1, percentage: 62 },
            { name: 'Male', spend: spend * 0.38, conversions: Math.floor(conversions * 0.35), roas: 2.4, percentage: 38 },
        ],
        location: [
            { name: 'Metro Manila', spend: spend * 0.45, conversions: Math.floor(conversions * 0.50), roas: 3.5, percentage: 45 },
            { name: 'Cebu', spend: spend * 0.20, conversions: Math.floor(conversions * 0.22), roas: 2.8, percentage: 20 },
            { name: 'Davao', spend: spend * 0.15, conversions: Math.floor(conversions * 0.13), roas: 2.2, percentage: 15 },
            { name: 'Other Regions', spend: spend * 0.20, conversions: Math.floor(conversions * 0.15), roas: 1.9, percentage: 20 },
        ],
        device: [
            { name: 'Mobile', spend: spend * 0.78, conversions: Math.floor(conversions * 0.80), roas: 3.0, percentage: 78 },
            { name: 'Desktop', spend: spend * 0.18, conversions: Math.floor(conversions * 0.17), roas: 2.5, percentage: 18 },
            { name: 'Tablet', spend: spend * 0.04, conversions: Math.floor(conversions * 0.03), roas: 1.8, percentage: 4 },
        ],
        placement: [
            { name: 'Feed', spend: spend * 0.40, conversions: Math.floor(conversions * 0.45), roas: 3.2, percentage: 40 },
            { name: 'Stories', spend: spend * 0.25, conversions: Math.floor(conversions * 0.22), roas: 2.5, percentage: 25 },
            { name: 'Reels', spend: spend * 0.20, conversions: Math.floor(conversions * 0.25), roas: 3.5, percentage: 20 },
            { name: 'Messenger', spend: spend * 0.10, conversions: Math.floor(conversions * 0.05), roas: 1.5, percentage: 10 },
            { name: 'Audience Network', spend: spend * 0.05, conversions: Math.floor(conversions * 0.03), roas: 1.2, percentage: 5 },
        ],
    };
}

// Helper to generate video metrics
function generateVideoMetrics(): VideoMetrics {
    return {
        thruPlays: Math.floor(5000 + Math.random() * 10000),
        views3s: Math.floor(8000 + Math.random() * 15000),
        retention25: Math.floor(60 + Math.random() * 20),
        retention50: Math.floor(40 + Math.random() * 20),
        retention75: Math.floor(25 + Math.random() * 15),
        retention95: Math.floor(10 + Math.random() * 10),
        avgWatchTime: Math.floor(8 + Math.random() * 12),
        hookRate: parseFloat((65 + Math.random() * 25).toFixed(1)),
    };
}

export default function AdsPage() {
    const [activeTab, setActiveTab] = useState<'ads' | 'creatives'>('ads');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [creatives, setCreatives] = useState<Creative[]>([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [selectedAdSet, setSelectedAdSet] = useState<AdSet | null>(null);
    const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
    const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'spend_high' | 'spend_low' | 'roas_high' | 'roas_low' | 'cpa_low' | 'cpa_high' | 'winners' | 'losers'>('newest');
    const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d' | 'custom'>('14d');

    // Filters
    const [filterStatus, setFilterStatus] = useState<AdStatus[]>([]);
    const [filterPhase, setFilterPhase] = useState<AdPhase[]>([]);
    const [filterPerformance, setFilterPerformance] = useState<AdPerformance[]>([]);

    // Lead tags
    const [availableTags, setAvailableTags] = useState<LeadTag[]>([
        { id: 'tag-1', name: 'High Intent', color: '#22c55e' },
        { id: 'tag-2', name: 'Follow Up', color: '#f59e0b' },
        { id: 'tag-3', name: 'Cold Lead', color: '#3b82f6' },
        { id: 'tag-4', name: 'Hot Lead', color: '#ef4444' },
        { id: 'tag-5', name: 'Qualified', color: '#8b5cf6' },
        { id: 'tag-6', name: 'Not Interested', color: '#6b7280' },
    ]);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#3b82f6');
    const [showTagCreator, setShowTagCreator] = useState(false);
    const [filterTags, setFilterTags] = useState<string[]>([]);

    const tagColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6b7280'];

    // Creative System Diagnostics State
    const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
    const [showInputMode, setShowInputMode] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);

    // Handler for when a creative is extracted from upload
    const handleCreativeExtracted = (fingerprint: StructureFingerprint, file: File, previewUrl: string) => {
        // Create a new creative from the extracted fingerprint
        const newCreative: Creative = {
            id: `cr-${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
            type: fingerprint.type as 'video' | 'image',
            thumbnailUrl: previewUrl,
            deliveryScore: fingerprint.type === 'video'
                ? Math.round((fingerprint.avg_motion_0_1s || 0.5) * 50 + (fingerprint.brightness_avg || 0.5) * 30 + (1 - (fingerprint.silence_ratio || 0.5)) * 20)
                : Math.round((fingerprint.brightness_avg || 0.5) * 50 + (fingerprint.contrast_avg || 0.5) * 30 + (fingerprint.edge_density || 0.5) * 20),
            structureRating: fingerprint.confidence === 'high' ? 'A' : fingerprint.confidence === 'medium' ? 'B' : 'C',
            status: 'analyzed',
            placement: 'Uploaded',
            deliveryHealth: fingerprint.motion_intensity === 'high' || fingerprint.type === 'image' ? 'healthy' : fingerprint.motion_intensity === 'medium' ? 'risky' : 'poor',
            conversionHealth: 'insufficient', // New upload, no conversion data yet
            structureAnalysis: {
                motionOnsetTiming: fingerprint.motion_onset_ms || 0,
                motionIntensity: fingerprint.motion_intensity,
                cutDensity: fingerprint.cut_density || 0,
                shotLengthAvg: fingerprint.avg_shot_length_opening || 0,
                textPresence: { areaPct: fingerprint.text_area_pct || 0, timing: 0, position: 'unknown' },
                brightnessScore: Math.round((fingerprint.brightness_avg || 0.5) * 100),
                audioStartTiming: fingerprint.audio_onset_ms || 0,
                loudnessCurve: fingerprint.silence_ratio !== undefined && fingerprint.silence_ratio < 0.5 ? 'rising' : 'flat',
                silenceRatio: fingerprint.silence_ratio || 1,
                speechEarly: fingerprint.speech_early || false,
                speechStartTime: fingerprint.audio_onset_ms || 0,
                wordsPerSecond: 0,
                pauseDensity: 0,
                deliveryProbability: fingerprint.type === 'video'
                    ? Math.round((fingerprint.avg_motion_0_1s || 0.5) * 50 + (fingerprint.brightness_avg || 0.5) * 30 + (1 - (fingerprint.silence_ratio || 0.5)) * 20)
                    : Math.round((fingerprint.brightness_avg || 0.5) * 50 + (fingerprint.contrast_avg || 0.5) * 30 + (fingerprint.edge_density || 0.5) * 20),
                attentionBreakpoints: fingerprint.motion_onset_ms && fingerprint.motion_onset_ms > 500 ? ['Slow motion start'] : [],
                structuralFixes: fingerprint.motion_onset_ms && fingerprint.motion_onset_ms > 500
                    ? ['Add motion in first 500ms']
                    : fingerprint.brightness_avg && fingerprint.brightness_avg < 0.3
                        ? ['Increase brightness']
                        : [],
            },
            // No conversion data yet for new uploads
            conversionAnalysis: {
                inputSource: 'manual',
                spend: 0,
                impressions: 0,
                clicks: 0,
                ctr: 0,
                cpm: 0,
                cpc: 0,
                cpa: 0,
                cvr: 0,
                roas: 0,
                value: 0,
                conversions: 0,
                leads: 0,
                efficiencyScore: 0,
                cpaEfficiency: 0,
                roasEfficiency: 0,
                confidence: 'insufficient',
                confidenceReason: 'New upload - no performance data yet',
                sampleSize: 0,
                trend: 'stable',
                trendPeriod: '7d',
                alerts: [],
                funnelDropoffs: [],
                funnelSource: 'estimated',
                primaryIssue: 'none',
                recommendations: ['Run this creative to gather performance data'],
            },
            narrativeAnalysis: {
                // CTA Atomic Fields
                ctaPresent: false,
                ctaHasActionVerb: false,
                ctaHasOutcome: false,
                ctaHasUrgency: false,

                // Value Proposition Atomic Fields
                benefitStated: false,
                benefitQuantified: false,
                timeToBenefitStated: false,
                valueTiming: 'not_present',

                // Offer Fields
                offerPresent: false,
                offerTiming: 'not_shown',

                // Other Observable Fields
                proofPresent: false,
                pricingVisible: false,
                guaranteeMentioned: false,

                // Alignment
                adLpMatch: 'unsure',

                // Metadata
                userConfirmed: false,
                llmAssisted: false,

                // Legacy
                primaryAngle: 'Unknown',
                emotionalTone: 'Neutral',
                persuasionType: 'unknown',
                diagnosticNotes: ['New upload - use checklist to describe message structure'],
            },
            nextBestAction: {
                action: 'Run this creative to gather performance data',
                testType: 'structure',
                expectedLearningValue: 'high',
                variablesToLock: [],
                hypothesis: 'Structure extracted - need real performance data for conversion analysis',
            },
        };

        // Add to creatives list
        setCreatives(prev => [newCreative, ...prev]);
    };

    // Helper to determine which system has authority
    const getSystemAuthority = (creative: Creative): { authority: SystemAuthority; message: string; action: string } => {
        const deliveryGood = creative.deliveryHealth === 'healthy';
        const conversionGood = creative.conversionHealth === 'good';

        if (deliveryGood && conversionGood) {
            return { authority: 'winner', message: '🏆 Winner! Scale this creative.', action: 'Scale' };
        }
        if (deliveryGood && creative.conversionHealth === 'bad') {
            return { authority: 'conversion_owner', message: 'Attention works, persuasion fails. Fix message/offer/funnel.', action: 'Fix Offer' };
        }
        if (!deliveryGood && conversionGood) {
            return { authority: 'structure', message: 'Hidden gem! Fix structure to unlock potential.', action: 'Fix Structure' };
        }
        // Bad + Bad or any "insufficient" case
        return { authority: 'structure', message: 'Fix structure first before diagnosing conversion.', action: 'Fix Structure' };
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);

            try {
                // Check localStorage for meta integration (in production, fetch from DB)
                const userId = localStorage.getItem('user_id');
                if (!userId) {
                    setLoading(false);
                    setConnected(false);
                    return;
                }

                const integrationData = localStorage.getItem(`meta_integration_${userId}`);
                if (!integrationData) {
                    setLoading(false);
                    setConnected(false);
                    return;
                }

                // Fetch campaigns and ads from the API
                const response = await fetch(`/api/meta/campaigns?user_id=${userId}`);

                if (!response.ok) {
                    console.error('Failed to fetch campaigns');
                    setLoading(false);
                    setConnected(true); // Still connected, just no data yet
                    return;
                }

                const data = await response.json();

                if (data.campaigns && data.campaigns.length > 0) {
                    // Transform API data to Campaign[] format
                    const transformedCampaigns: Campaign[] = data.campaigns.map((camp: any) => ({
                        id: camp.id,
                        name: camp.name,
                        objective: camp.objective || 'CONVERSIONS',
                        status: camp.status?.toLowerCase() === 'active' ? 'active' : camp.status?.toLowerCase() === 'paused' ? 'paused' : 'stopped',
                        budgetType: camp.daily_budget ? 'daily' : 'lifetime',
                        budget: camp.daily_budget || camp.lifetime_budget || 0,
                        adSets: (camp.adsets || []).map((adset: any) => ({
                            id: adset.id,
                            campaignId: camp.id,
                            name: adset.name,
                            status: adset.status?.toLowerCase() === 'active' ? 'active' : adset.status?.toLowerCase() === 'paused' ? 'paused' : 'stopped',
                            budget: adset.daily_budget || adset.lifetime_budget || 0,
                            budgetType: adset.daily_budget ? 'daily' : 'lifetime',
                            targeting: adset.targeting || {
                                ageMin: 18, ageMax: 65, genders: ['all'],
                                locations: [{ country: 'Philippines' }], interests: [], audienceSize: 0
                            },
                            placements: ['Feed', 'Stories'],
                            schedule: { start: new Date(adset.created_time || Date.now()) },
                            ads: (adset.ads || []).map((ad: any) => {
                                const spend = ad.spend || 0;
                                const impressions = ad.impressions || 0;
                                const clicks = ad.clicks || 0;
                                const conversions = ad.conversions || 0;
                                const leads = ad.leads || 0;
                                const reach = ad.reach || impressions * 0.85;
                                const revenue = spend * (ad.roas || 0) || conversions * 100;

                                return {
                                    id: ad.id,
                                    adSetId: adset.id,
                                    name: ad.name,
                                    status: ad.status?.toLowerCase() === 'active' ? 'active' : ad.status?.toLowerCase() === 'paused' ? 'paused' : 'stopped',
                                    phase: spend < 100 ? 'learning' : conversions > 50 ? 'scaling' : 'stable' as AdPhase,
                                    creativeType: 'Problem_Solution' as CreativeType,
                                    mediaType: ad.video_id ? 'video' : 'image' as 'video' | 'image' | 'carousel',
                                    thumbnailUrl: ad.thumbnail_url,
                                    spend,
                                    revenue,
                                    impressions,
                                    reach: Math.floor(reach),
                                    frequency: reach > 0 ? impressions / reach : 1,
                                    clicks,
                                    ctr: ad.ctr || (impressions > 0 ? (clicks / impressions) * 100 : 0),
                                    cpc: ad.cpc || (clicks > 0 ? spend / clicks : 0),
                                    cpm: ad.cpm || (impressions > 0 ? (spend / impressions) * 1000 : 0),
                                    conversions,
                                    cpa: conversions > 0 ? spend / conversions : 0,
                                    leads,
                                    qualifiedLeads: conversions,
                                    videoMetrics: ad.video_id ? {
                                        thruPlays: ad.video_thruplay || 0,
                                        views3s: ad.video_p25 || 0,
                                        retention25: ad.video_p25 ? Math.floor((ad.video_p25 / impressions) * 100) : 0,
                                        retention50: ad.video_p50 ? Math.floor((ad.video_p50 / impressions) * 100) : 0,
                                        retention75: ad.video_p75 ? Math.floor((ad.video_p75 / impressions) * 100) : 0,
                                        retention95: ad.video_p95 ? Math.floor((ad.video_p95 / impressions) * 100) : 0,
                                        avgWatchTime: 0,
                                        hookRate: ad.video_p25 && impressions ? (ad.video_p25 / impressions) * 100 : 0,
                                    } : undefined,
                                    dailyData: [],
                                    tags: [],
                                    performance: revenue / spend > 2 ? 'winner' : revenue / spend < 0.5 ? 'loser' : conversions < 10 ? 'insufficient' : 'neutral' as AdPerformance,
                                    createdAt: new Date(ad.created_time || Date.now()),
                                };
                            }),
                            spend: (adset.ads || []).reduce((sum: number, ad: any) => sum + (ad.spend || 0), 0),
                            revenue: (adset.ads || []).reduce((sum: number, ad: any) => sum + ((ad.spend || 0) * (ad.roas || 1)), 0),
                            impressions: (adset.ads || []).reduce((sum: number, ad: any) => sum + (ad.impressions || 0), 0),
                            clicks: (adset.ads || []).reduce((sum: number, ad: any) => sum + (ad.clicks || 0), 0),
                            conversions: (adset.ads || []).reduce((sum: number, ad: any) => sum + (ad.conversions || 0), 0),
                            leads: (adset.ads || []).reduce((sum: number, ad: any) => sum + (ad.leads || 0), 0),
                            qualifiedLeads: (adset.ads || []).reduce((sum: number, ad: any) => sum + (ad.conversions || 0), 0),
                            createdAt: new Date(adset.created_time || Date.now()),
                        })),
                        spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0, leads: 0, qualifiedLeads: 0,
                        createdAt: new Date(camp.created_time || Date.now()),
                    }));

                    // Calculate campaign-level aggregates
                    transformedCampaigns.forEach(campaign => {
                        campaign.spend = campaign.adSets.reduce((sum, as) => sum + as.spend, 0);
                        campaign.revenue = campaign.adSets.reduce((sum, as) => sum + as.revenue, 0);
                        campaign.impressions = campaign.adSets.reduce((sum, as) => sum + as.impressions, 0);
                        campaign.clicks = campaign.adSets.reduce((sum, as) => sum + as.clicks, 0);
                        campaign.conversions = campaign.adSets.reduce((sum, as) => sum + as.conversions, 0);
                        campaign.leads = campaign.adSets.reduce((sum, as) => sum + as.leads, 0);
                        campaign.qualifiedLeads = campaign.adSets.reduce((sum, as) => sum + as.qualifiedLeads, 0);
                    });

                    setCampaigns(transformedCampaigns);
                    if (transformedCampaigns.length > 0) {
                        setExpandedCampaigns(new Set([transformedCampaigns[0].id]));
                    }
                }

                setConnected(true);
                setLastUpdated(new Date());
            } catch (error) {
                console.error('Error loading ads data:', error);
                setConnected(false);
            } finally {
                setLoading(false);
            }
        };

        loadData();

        // Set up periodic refresh
        const refreshInterval = setInterval(() => {
            loadData();
        }, 60000); // Refresh every minute

    }, []);


    createdAt: new Date('2026-01-01'),
                        },
{
    id: 'adset-002',
        campaignId: 'camp-001',
            name: 'Men 25-54 - All Regions',
                status: 'active',
                    budget: 2500,
                        budgetType: 'daily',
                            targeting: {
        ageMin: 25,
            ageMax: 54,
                genders: ['male'],
                    locations: [{ country: 'Philippines' }],
                        interests: ['Technology', 'Gadgets', 'Sports'],
                            audienceSize: 3200000,
                            },
    placements: ['Feed', 'Messenger'],
        schedule: { start: new Date('2026-01-03') },
    ads: [
        createAd('ad-004', 'adset-002', 'Direct Offer - Flash Sale', 'active', 'scaling', 'Direct_Offer_Static', 'image', 3200, 14500, 145, 'winner', new Date('2026-01-03')),
        createAd('ad-005', 'adset-002', 'Founder Story - Behind Scenes', 'paused', 'declining', 'Founder_Story_BTS', 'video', 1500, 600, 12, 'loser', new Date('2025-12-28')),
    ],
        spend: 4700,
            revenue: 15100,
                impressions: 275000,
                    clicks: 8250,
                        conversions: 157,
                            leads: 290,
                                qualifiedLeads: 157,
                                    createdAt: new Date('2026-01-03'),
                        },
                    ],
spend: 9430,
    revenue: 30600,
        impressions: 520000,
            clicks: 15600,
                conversions: 316,
                    leads: 570,
                        qualifiedLeads: 316,
                            createdAt: new Date('2026-01-01'),
        },
{
    id: 'camp-002',
        name: 'Brand Awareness Q1',
            objective: 'AWARENESS',
                status: 'active',
                    budgetType: 'lifetime',
                        budget: 50000,
                            adSets: [
                                {
                                    id: 'adset-003',
                                    campaignId: 'camp-002',
                                    name: 'Broad Audience - Video Views',
                                    status: 'active',
                                    budget: 25000,
                                    budgetType: 'lifetime',
                                    targeting: {
                                        ageMin: 18,
                                        ageMax: 65,
                                        genders: ['all'],
                                        locations: [{ country: 'Philippines' }],
                                        interests: ['Lifestyle'],
                                        audienceSize: 15000000,
                                    },
                                    placements: ['Feed', 'Stories', 'Reels', 'Audience Network'],
                                    schedule: { start: new Date('2026-01-01'), end: new Date('2026-03-31') },
                                    ads: [
                                        createAd('ad-006', 'adset-003', 'Brand Story - 60s Video', 'active', 'stable', 'Founder_Story_BTS', 'video', 1200, 1550, 31, 'neutral', new Date('2026-01-03')),
                                        createAd('ad-007', 'adset-003', 'Lifestyle Reel - Short', 'active', 'learning', 'UGC_Testimonial', 'video', 980, 1400, 28, 'neutral', new Date('2026-01-07')),
                                    ],
                                    spend: 2180,
                                    revenue: 2950,
                                    impressions: 119000,
                                    clicks: 3235,
                                    conversions: 59,
                                    leads: 137,
                                    qualifiedLeads: 59,
                                    createdAt: new Date('2026-01-01'),
                                },
                            ],
                                spend: 2180,
                                    revenue: 2950,
                                        impressions: 119000,
                                            clicks: 3235,
                                                conversions: 59,
                                                    leads: 137,
                                                        qualifiedLeads: 59,
                                                            createdAt: new Date('2026-01-01'),
        },
{
    id: 'camp-003',
        name: 'Lead Generation - Newsletter',
            objective: 'LEADS',
                status: 'paused',
                    budgetType: 'daily',
                        budget: 1500,
                            adSets: [
                                {
                                    id: 'adset-004',
                                    campaignId: 'camp-003',
                                    name: 'Interest-Based Targeting',
                                    status: 'paused',
                                    budget: 1500,
                                    budgetType: 'daily',
                                    targeting: {
                                        ageMin: 25,
                                        ageMax: 45,
                                        genders: ['all'],
                                        locations: [{ country: 'Philippines', region: 'Metro Manila' }],
                                        interests: ['Business', 'Entrepreneurship'],
                                        audienceSize: 800000,
                                    },
                                    placements: ['Feed', 'Messenger'],
                                    schedule: { start: new Date('2025-12-15') },
                                    ads: [
                                        createAd('ad-008', 'adset-004', 'Lead Magnet - Carousel', 'paused', 'fatigued', 'Direct_Offer_Static', 'carousel', 780, 1100, 22, 'neutral', new Date('2026-01-09')),
                                    ],
                                    spend: 780,
                                    revenue: 1100,
                                    impressions: 42000,
                                    clicks: 1260,
                                    conversions: 22,
                                    leads: 48,
                                    qualifiedLeads: 22,
                                    createdAt: new Date('2025-12-15'),
                                },
                            ],
                                spend: 780,
                                    revenue: 1100,
                                        impressions: 42000,
                                            clicks: 1260,
                                                conversions: 22,
                                                    leads: 48,
                                                        qualifiedLeads: 22,
                                                            createdAt: new Date('2025-12-15'),
        },
    ];

const dummyCreatives: Creative[] = [
    {
        id: 'cr-001',
        name: 'Summer Vibes - 9:16 Reel',
        type: 'video',
        thumbnailUrl: '/creative-thumb-1.jpg',
        deliveryScore: 92,
        structureRating: 'A+',
        status: 'analyzed',
        placement: 'Instagram Reels',
        deliveryHealth: 'healthy',
        conversionHealth: 'good',
        structureAnalysis: {
            motionOnsetTiming: 120,
            motionIntensity: 'high',
            cutDensity: 12,
            shotLengthAvg: 2.1,
            textPresence: { areaPct: 15, timing: 0.5, position: 'center-top' },
            brightnessScore: 78,
            audioStartTiming: 0,
            loudnessCurve: 'rising',
            silenceRatio: 0.05,
            speechEarly: true,
            speechStartTime: 200,
            wordsPerSecond: 2.8,
            pauseDensity: 0.15,
            deliveryProbability: 92,
            attentionBreakpoints: [],
            structuralFixes: []
        },
        conversionAnalysis: {
            // Input Source
            inputSource: 'meta_ads',

            // Primary Metrics (from Meta Ads)
            spend: 2450,
            impressions: 125000,
            clicks: 4875,
            ctr: 3.9,
            cpm: 19.6,
            cpc: 0.50,
            cpa: 45,
            cvr: 4.2,
            roas: 3.8,
            value: 9310,
            conversions: 54,
            leads: 97,

            // Video Metrics
            video3sViews: 87500,
            thruPlay: 31250,
            avgWatchTime: 8.2,
            hookRate: 70,

            // Efficiency vs Baseline
            efficiencyScore: 89,
            cpaEfficiency: 25, // 25% better than baseline
            roasEfficiency: 31, // 31% better than baseline
            accountBaselineCpa: 60,
            accountBaselineRoas: 2.9,

            // Confidence
            confidence: 'high',
            confidenceReason: '54 conversions - statistically significant sample',
            sampleSize: 1250,
            variance: 0.08,

            // Trends & Alerts
            trend: 'improving',
            trendPeriod: '7d',
            alerts: [],

            // Funnel
            funnelDropoffs: [
                { stage: 'Click to LP', dropRate: 12, status: 'healthy' },
                { stage: 'LP to Add to Cart', dropRate: 35, status: 'warning' },
                { stage: 'Cart to Purchase', dropRate: 28, status: 'healthy' }
            ],
            funnelSource: 'meta_events',
            primaryIssue: 'none',

            // Breakdown Context
            placement: 'reels',
            device: 'mobile',

            // Output
            recommendations: ['Scale budget by 20%', 'Test similar hook variations']
        },
        narrativeAnalysis: {
            // CTA Atomic Fields
            ctaPresent: true,
            ctaHasActionVerb: true,
            ctaHasOutcome: true,
            ctaHasUrgency: false,

            // Value Proposition Atomic Fields
            benefitStated: true,
            benefitQuantified: false,
            timeToBenefitStated: false,
            valueTiming: 'opening',

            // Offer Fields
            offerPresent: true,
            offerTiming: 'mid',

            // Other Observable Fields  
            proofPresent: false,
            pricingVisible: false,
            guaranteeMentioned: false,

            // Alignment
            adLpMatch: 'yes',

            // Metadata
            userConfirmed: true,
            llmAssisted: false,

            // Legacy
            primaryAngle: 'Problem/Solution',
            emotionalTone: 'Aspirational',
            persuasionType: 'problem_solution',
            diagnosticNotes: ['Strong opening hook', 'Clear value proposition in first 3 seconds'],
        },
        nextBestAction: {
            action: 'Scale this creative - increase budget',
            testType: 'audience',
            expectedLearningValue: 'medium',
            variablesToLock: ['creative', 'offer', 'landing page'],
            hypothesis: 'Expanding to similar audiences will maintain ROAS'
        }
    },
    {
        id: 'cr-002',
        name: 'Product Showcase - Static',
        type: 'image',
        thumbnailUrl: '/creative-thumb-2.jpg',
        deliveryScore: 85,
        structureRating: 'A',
        status: 'analyzed',
        placement: 'Facebook Feed',
        deliveryHealth: 'healthy',
        conversionHealth: 'bad',
        structureAnalysis: {
            motionOnsetTiming: 0,
            motionIntensity: 'low',
            cutDensity: 0,
            shotLengthAvg: 0,
            textPresence: { areaPct: 22, timing: 0, position: 'bottom' },
            brightnessScore: 85,
            audioStartTiming: 0,
            loudnessCurve: 'flat',
            silenceRatio: 1,
            speechEarly: false,
            speechStartTime: 0,
            wordsPerSecond: 0,
            pauseDensity: 0,
            deliveryProbability: 85,
            attentionBreakpoints: [],
            structuralFixes: []
        },
        conversionAnalysis: {
            inputSource: 'meta_ads',
            spend: 1890,
            impressions: 98000,
            clicks: 2940,
            ctr: 3.0,
            cpm: 19.3,
            cpc: 0.64,
            cpa: 125,
            cvr: 1.2,
            roas: 0.9,
            value: 1701,
            conversions: 15,
            leads: 42,
            efficiencyScore: 32,
            cpaEfficiency: -52, // 52% worse than baseline
            roasEfficiency: -69, // 69% worse than baseline
            accountBaselineCpa: 60,
            accountBaselineRoas: 2.9,
            confidence: 'high',
            confidenceReason: '890 clicks - statistically significant sample',
            sampleSize: 890,
            variance: 0.12,
            trend: 'declining',
            trendPeriod: '7d',
            alerts: [
                { type: 'cpa_spike', severity: 'critical', message: 'CPA ₱125 is 108% above account average', value: 125, threshold: 75, delta: 108 },
                { type: 'roas_drop', severity: 'critical', message: 'ROAS 0.9x is 69% below account average', value: 0.9, threshold: 2.18, delta: 69 }
            ],
            funnelDropoffs: [
                { stage: 'Click to LP', dropRate: 8, status: 'healthy' },
                { stage: 'LP to Add to Cart', dropRate: 68, status: 'critical' },
                { stage: 'Cart to Purchase', dropRate: 42, status: 'warning' }
            ],
            funnelSource: 'meta_events',
            funnelLeakLocation: 'Landing Page to Add to Cart',
            primaryIssue: 'landing_page',
            placement: 'feed',
            device: 'mobile',
            recommendations: ['Test different offer headline', 'Improve LP above-the-fold content', 'Add urgency element']
        },
        narrativeAnalysis: {
            ctaPresent: true,
            ctaHasActionVerb: false,
            ctaHasOutcome: false,
            benefitStated: false,
            benefitQuantified: false,
            timeToBenefitStated: false,
            valueTiming: 'middle',
            offerPresent: true,
            offerTiming: 'early',
            proofPresent: false,
            pricingVisible: false,
            guaranteeMentioned: false,
            adLpMatch: 'no',
            userConfirmed: true,
            llmAssisted: false,
            primaryAngle: 'Direct Offer',
            emotionalTone: 'Neutral',
            persuasionType: 'scarcity',
            diagnosticNotes: ['Offer message doesn\'t match LP', 'Value prop unclear', 'Consider adding social proof']
        },
        nextBestAction: {
            action: 'Test offer headline A vs B',
            testType: 'offer',
            expectedLearningValue: 'high',
            variablesToLock: ['creative structure', 'audience', 'bid strategy'],
            hypothesis: 'Clearer value prop will improve LP conversion'
        }
    },
    {
        id: 'cr-003',
        name: 'Customer Review Compilation',
        type: 'video',
        thumbnailUrl: '/creative-thumb-3.jpg',
        deliveryScore: 78,
        structureRating: 'B+',
        status: 'analyzed',
        placement: 'Stories',
        deliveryHealth: 'risky',
        conversionHealth: 'good',
        structureAnalysis: {
            motionOnsetTiming: 850,
            motionIntensity: 'medium',
            cutDensity: 6,
            shotLengthAvg: 4.2,
            textPresence: { areaPct: 8, timing: 1.5, position: 'bottom' },
            brightnessScore: 65,
            audioStartTiming: 300,
            loudnessCurve: 'flat',
            silenceRatio: 0.25,
            speechEarly: false,
            speechStartTime: 1200,
            wordsPerSecond: 1.8,
            pauseDensity: 0.35,
            deliveryProbability: 68,
            attentionBreakpoints: ['0-1s slow start', '3-5s low energy'],
            structuralFixes: ['Start with motion in first 100ms', 'Add text hook immediately', 'Increase audio presence early']
        },
        conversionAnalysis: {
            cpa: 52,
            cvr: 3.8,
            roas: 3.2,
            normalizedCpa: 78,
            funnelDropoffs: [
                { stage: 'Click to LP', dropRate: 15, status: 'healthy' },
                { stage: 'LP to Add to Cart', dropRate: 38, status: 'warning' },
                { stage: 'Cart to Purchase', dropRate: 25, status: 'healthy' }
            ],
            offerStrength: 82,
            messageLandingAlignment: 88,
            confidence: 'medium',
            sampleSize: 420,
            variance: 0.18,
            efficiencyScore: 76,
            recommendations: ['Hidden gem - fix structure first']
        },
        narrativeAnalysis: {
            ctaPresent: true,
            ctaHasActionVerb: true,
            ctaHasOutcome: false,
            benefitStated: false,
            benefitQuantified: false,
            timeToBenefitStated: false,
            valueTiming: 'middle',
            offerPresent: true,
            offerTiming: 'mid',
            proofPresent: true,
            pricingVisible: false,
            guaranteeMentioned: false,
            adLpMatch: 'yes',
            userConfirmed: true,
            llmAssisted: false,
            primaryAngle: 'Social Proof',
            emotionalTone: 'Authentic',
            persuasionType: 'social_proof',
            diagnosticNotes: ['Strong social proof but late hook', 'Good testimonial quality']
        },
        nextBestAction: {
            action: 'Re-edit with faster hook - test structure',
            testType: 'structure',
            expectedLearningValue: 'high',
            variablesToLock: ['offer', 'testimonials', 'landing page'],
            hypothesis: 'Faster hook will improve delivery and unlock hidden potential'
        }
    },
    {
        id: 'cr-004',
        name: 'Before/After Transformation',
        type: 'image',
        thumbnailUrl: '/creative-thumb-4.jpg',
        deliveryScore: 65,
        structureRating: 'B',
        status: 'needs_optimization',
        placement: 'Instagram Feed',
        deliveryHealth: 'poor',
        conversionHealth: 'insufficient',
        structureAnalysis: {
            motionOnsetTiming: 0,
            motionIntensity: 'low',
            cutDensity: 0,
            shotLengthAvg: 0,
            textPresence: { areaPct: 45, timing: 0, position: 'full' },
            brightnessScore: 52,
            audioStartTiming: 0,
            loudnessCurve: 'flat',
            silenceRatio: 1,
            speechEarly: false,
            speechStartTime: 0,
            wordsPerSecond: 0,
            pauseDensity: 0,
            deliveryProbability: 48,
            attentionBreakpoints: ['Text too heavy', 'Low contrast'],
            structuralFixes: ['Reduce text overlay to <20%', 'Increase image brightness', 'Add focal point to before/after']
        },
        conversionAnalysis: {
            cpa: 0,
            cvr: 0,
            roas: 0,
            normalizedCpa: 0,
            funnelDropoffs: [],
            offerStrength: 0,
            messageLandingAlignment: 0,
            confidence: 'insufficient',
            sampleSize: 45,
            variance: 0,
            efficiencyScore: 0,
            recommendations: ['Fix structure first - insufficient data to diagnose conversion']
        },
        narrativeAnalysis: {
            ctaPresent: false,
            ctaHasActionVerb: false,
            ctaHasOutcome: false,
            benefitStated: true,
            benefitQuantified: false,
            timeToBenefitStated: false,
            valueTiming: 'opening',
            offerPresent: false,
            offerTiming: 'not_shown',
            proofPresent: false,
            pricingVisible: false,
            guaranteeMentioned: false,
            adLpMatch: 'unsure',
            userConfirmed: false,
            llmAssisted: false,
            primaryAngle: 'Transformation',
            emotionalTone: 'Aspirational',
            persuasionType: 'problem_solution',
            diagnosticNotes: ['Missing CTA', 'Offer not visible', 'Focus on structure first']
        },
        nextBestAction: {
            action: 'Fix structural issues before testing conversion',
            testType: 'structure',
            expectedLearningValue: 'high',
            variablesToLock: [],
            hypothesis: 'Fixing text overlay and contrast will improve delivery probability'
        }
    },
    {
        id: 'cr-005',
        name: 'Unboxing Experience',
        type: 'video',
        thumbnailUrl: '/creative-thumb-5.jpg',
        deliveryScore: 88,
        structureRating: 'A',
        status: 'analyzed',
        placement: 'TikTok',
        deliveryHealth: 'healthy',
        conversionHealth: 'good',
        structureAnalysis: {
            motionOnsetTiming: 50,
            motionIntensity: 'high',
            cutDensity: 15,
            shotLengthAvg: 1.5,
            textPresence: { areaPct: 12, timing: 0.3, position: 'top' },
            brightnessScore: 82,
            audioStartTiming: 0,
            loudnessCurve: 'rising',
            silenceRatio: 0.02,
            speechEarly: true,
            speechStartTime: 100,
            wordsPerSecond: 3.2,
            pauseDensity: 0.08,
            deliveryProbability: 88,
            attentionBreakpoints: [],
            structuralFixes: []
        },
        conversionAnalysis: {
            cpa: 38,
            cvr: 5.1,
            roas: 4.2,
            normalizedCpa: 92,
            funnelDropoffs: [
                { stage: 'Click to LP', dropRate: 10, status: 'healthy' },
                { stage: 'LP to Add to Cart', dropRate: 28, status: 'healthy' },
                { stage: 'Cart to Purchase', dropRate: 22, status: 'healthy' }
            ],
            offerStrength: 91,
            messageLandingAlignment: 95,
            confidence: 'high',
            sampleSize: 1850,
            variance: 0.06,
            efficiencyScore: 94,
            recommendations: ['Top performer - scale aggressively', 'Create variations of this format']
        },
        narrativeAnalysis: {
            ctaPresent: true,
            ctaHasActionVerb: true,
            ctaHasOutcome: true,
            ctaHasUrgency: true,
            benefitStated: true,
            benefitQuantified: true,
            timeToBenefitStated: true,
            valueTiming: 'opening',
            offerPresent: true,
            offerTiming: 'early',
            proofPresent: true,
            pricingVisible: true,
            guaranteeMentioned: true,
            adLpMatch: 'yes',
            userConfirmed: true,
            llmAssisted: false,
            primaryAngle: 'UGC/Unboxing',
            emotionalTone: 'Excited',
            persuasionType: 'social_proof',
            diagnosticNotes: ['Perfect UGC format', 'Natural excitement sells', 'Strong hook and payoff']
        },
        nextBestAction: {
            action: 'Scale and create similar UGC variations',
            testType: 'audience',
            expectedLearningValue: 'medium',
            variablesToLock: ['creative format', 'offer', 'funnel'],
            hypothesis: 'This UGC format works - test with different products/creators'
        }
    },
    {
        id: 'cr-006',
        name: 'Limited Time Offer Banner',
        type: 'image',
        thumbnailUrl: '/creative-thumb-6.jpg',
        deliveryScore: 72,
        structureRating: 'B',
        status: 'analyzing',
        placement: 'Display Network',
        deliveryHealth: 'risky',
        conversionHealth: 'bad',
        structureAnalysis: {
            motionOnsetTiming: 0,
            motionIntensity: 'low',
            cutDensity: 0,
            shotLengthAvg: 0,
            textPresence: { areaPct: 38, timing: 0, position: 'center' },
            brightnessScore: 70,
            audioStartTiming: 0,
            loudnessCurve: 'flat',
            silenceRatio: 1,
            speechEarly: false,
            speechStartTime: 0,
            wordsPerSecond: 0,
            pauseDensity: 0,
            deliveryProbability: 62,
            attentionBreakpoints: ['High text density'],
            structuralFixes: ['Reduce text to key message only', 'Increase visual contrast']
        },
        conversionAnalysis: {
            cpa: 145,
            cvr: 0.8,
            roas: 0.6,
            normalizedCpa: 22,
            funnelDropoffs: [
                { stage: 'Click to LP', dropRate: 25, status: 'warning' },
                { stage: 'LP to Add to Cart', dropRate: 72, status: 'critical' },
                { stage: 'Cart to Purchase', dropRate: 55, status: 'critical' }
            ],
            offerStrength: 35,
            messageLandingAlignment: 48,
            confidence: 'medium',
            sampleSize: 380,
            variance: 0.22,
            efficiencyScore: 18,
            funnelLeakLocation: 'Multiple - LP and Cart',
            recommendations: ['Fix structure first', 'Then test offer messaging']
        },
        narrativeAnalysis: {
            ctaPresent: true,
            ctaHasActionVerb: true,
            ctaHasOutcome: false,
            ctaHasUrgency: true,
            benefitStated: false,
            benefitQuantified: false,
            timeToBenefitStated: false,
            valueTiming: 'end',
            offerPresent: true,
            offerTiming: 'early',
            proofPresent: false,
            pricingVisible: false,
            guaranteeMentioned: false,
            adLpMatch: 'no',
            userConfirmed: true,
            llmAssisted: false,
            primaryAngle: 'Scarcity',
            emotionalTone: 'Urgent',
            persuasionType: 'scarcity',
            diagnosticNotes: ['Scarcity overused', 'Message mismatch with LP', 'Needs complete rework']
        },
        nextBestAction: {
            action: 'Fix structure issues, then revisit offer',
            testType: 'structure',
            expectedLearningValue: 'high',
            variablesToLock: [],
            hypothesis: 'True loser - start with structure before investing in offer tests'
        }
    },
];

setLoading(false);
setConnected(true);
setCampaigns(dummyCampaigns);
setCreatives(dummyCreatives);
setLastUpdated(new Date());

// Expand first campaign by default
setExpandedCampaigns(new Set(['camp-001']));

// Live update interval - simulates real-time data refresh
const liveUpdateInterval = setInterval(() => {
    setCampaigns(prevCampaigns => prevCampaigns.map(campaign => ({
        ...campaign,
        adSets: campaign.adSets.map(adSet => ({
            ...adSet,
            ads: adSet.ads.map(ad => {
                const newConversions = ad.conversions + (Math.random() > 0.8 ? 1 : 0);
                const conversionIncrease = newConversions - ad.conversions;
                const newLeads = ad.leads + (Math.random() > 0.7 ? 1 : 0);
                return {
                    ...ad,
                    impressions: ad.impressions + Math.floor(Math.random() * 50),
                    clicks: ad.clicks + Math.floor(Math.random() * 5),
                    conversions: newConversions,
                    spend: ad.spend + Math.floor(Math.random() * 10),
                    revenue: ad.revenue + (conversionIncrease * Math.floor(50 + Math.random() * 100)),
                    leads: newLeads,
                    qualifiedLeads: ad.qualifiedLeads + conversionIncrease,
                };
            }),
        })),
    })));
    setLastUpdated(new Date());
}, 5000);

return () => clearInterval(liveUpdateInterval);
}, []);

// Flatten all ads from campaigns for calculations
const allAds = useMemo(() => {
    return campaigns.flatMap(c => c.adSets.flatMap(as => as.ads));
}, [campaigns]);

// Tag management functions
const addTagToAd = (adId: string, tag: LeadTag) => {
    setCampaigns(prevCampaigns => prevCampaigns.map(campaign => ({
        ...campaign,
        adSets: campaign.adSets.map(adSet => ({
            ...adSet,
            ads: adSet.ads.map(ad => {
                const adTags = ad.tags || [];
                if (ad.id === adId && !adTags.find(t => t.id === tag.id)) {
                    return { ...ad, tags: [...adTags, tag] };
                }
                return ad;
            }),
        })),
    })));
    // Also update selectedAd if it's the same ad
    const selectedTags = selectedAd?.tags || [];
    if (selectedAd?.id === adId && !selectedTags.find(t => t.id === tag.id)) {
        setSelectedAd({ ...selectedAd, tags: [...selectedTags, tag] });
    }
};

const removeTagFromAd = (adId: string, tagId: string) => {
    setCampaigns(prevCampaigns => prevCampaigns.map(campaign => ({
        ...campaign,
        adSets: campaign.adSets.map(adSet => ({
            ...adSet,
            ads: adSet.ads.map(ad => {
                if (ad.id === adId) {
                    return { ...ad, tags: (ad.tags || []).filter(t => t.id !== tagId) };
                }
                return ad;
            }),
        })),
    })));
    // Also update selectedAd if it's the same ad
    if (selectedAd?.id === adId) {
        setSelectedAd({ ...selectedAd, tags: (selectedAd.tags || []).filter(t => t.id !== tagId) });
    }
};

const createNewTag = () => {
    if (!newTagName.trim()) return;
    const newTag: LeadTag = {
        id: `tag-${Date.now()}`,
        name: newTagName.trim(),
        color: newTagColor,
    };
    setAvailableTags([...availableTags, newTag]);
    setNewTagName('');
    setShowTagCreator(false);
};

// Calculate totals and metrics
const totals = useMemo(() => {
    const spend = allAds.reduce((a, b) => a + b.spend, 0);
    const revenue = allAds.reduce((a, b) => a + b.revenue, 0);
    const impressions = allAds.reduce((a, b) => a + b.impressions, 0);
    const ctr = allAds.length ? allAds.reduce((a, b) => a + b.ctr, 0) / allAds.length : 0;
    const conversions = allAds.reduce((a, b) => a + b.conversions, 0);
    const leads = allAds.reduce((a, b) => a + b.leads, 0);
    const qualifiedLeads = allAds.reduce((a, b) => a + b.qualifiedLeads, 0);
    const roas = spend > 0 ? revenue / spend : 0;
    const avgCpa = conversions > 0 ? spend / conversions : 0;
    const winners = allAds.filter(ad => ad.performance === 'winner').length;
    const losers = allAds.filter(ad => ad.performance === 'loser').length;
    const neutrals = allAds.filter(ad => ad.performance === 'neutral').length;
    const insufficient = allAds.filter(ad => ad.performance === 'insufficient').length;

    return { spend, revenue, impressions, ctr, conversions, leads, qualifiedLeads, roas, avgCpa, winners, losers, neutrals, insufficient };
}, [allAds]);

// Chart data for Performance Split (Donut)
const performanceSplitData = useMemo(() => [
    { name: 'Winners', value: totals.winners, color: 'var(--success)' },
    { name: 'Neutral', value: totals.neutrals, color: 'var(--info)' },
    { name: 'Losers', value: totals.losers, color: 'var(--error)' },
    { name: 'Insufficient', value: totals.insufficient, color: 'var(--warning)' },
].filter(item => item.value > 0), [totals]);

// Chart data for Creative Type Performance (Bar)
const creativeTypeData = useMemo(() => {
    const typeMap: Record<string, { spend: number; revenue: number; count: number }> = {};
    allAds.forEach(ad => {
        if (!typeMap[ad.creativeType]) {
            typeMap[ad.creativeType] = { spend: 0, revenue: 0, count: 0 };
        }
        typeMap[ad.creativeType].spend += ad.spend;
        typeMap[ad.creativeType].revenue += ad.revenue;
        typeMap[ad.creativeType].count += 1;
    });
    return Object.entries(typeMap).map(([type, data]) => ({
        name: type.replace(/_/g, ' '),
        roas: data.spend > 0 ? (data.revenue / data.spend).toFixed(2) : 0,
        revenue: data.revenue,
        spend: data.spend,
    }));
}, [allAds]);

// Chart data for ROAS by Ad (Horizontal Bar)
const roasByAdData = useMemo(() =>
    allAds.map(ad => ({
        name: ad.name.length > 20 ? ad.name.substring(0, 20) + '...' : ad.name,
        roas: ad.spend > 0 ? parseFloat((ad.revenue / ad.spend).toFixed(2)) : 0,
        performance: ad.performance,
    })).sort((a, b) => b.roas - a.roas),
    [allAds]);

// Chart data for Spend vs Revenue over time (simulated daily data)
const spendVsRevenueData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, i) => ({
        name: day,
        spend: Math.floor(totals.spend / 7 * (0.8 + Math.random() * 0.4)),
        revenue: Math.floor(totals.revenue / 7 * (0.7 + Math.random() * 0.6)),
    }));
}, [totals.spend, totals.revenue]);

// Filter ads based on search query and filters
const filteredAds = useMemo(() => {
    let result = allAds;

    // Apply search filter
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(ad =>
            ad.name.toLowerCase().includes(q) ||
            ad.status.toLowerCase().includes(q) ||
            ad.performance.toLowerCase().includes(q) ||
            ad.phase.toLowerCase().includes(q) ||
            ad.creativeType.toLowerCase().includes(q)
        );
    }

    // Apply status filter
    if (filterStatus.length > 0) {
        result = result.filter(ad => filterStatus.includes(ad.status));
    }

    // Apply phase filter
    if (filterPhase.length > 0) {
        result = result.filter(ad => filterPhase.includes(ad.phase));
    }

    // Apply performance filter
    if (filterPerformance.length > 0) {
        result = result.filter(ad => filterPerformance.includes(ad.performance));
    }

    // Apply tag filter
    if (filterTags.length > 0) {
        result = result.filter(ad => (ad.tags || []).some(tag => filterTags.includes(tag.id)));
    }

    // Apply sorting
    switch (sortBy) {
        case 'newest':
            result = [...result].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            break;
        case 'oldest':
            result = [...result].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            break;
        case 'spend_high':
            result = [...result].sort((a, b) => b.spend - a.spend);
            break;
        case 'spend_low':
            result = [...result].sort((a, b) => a.spend - b.spend);
            break;
        case 'roas_high':
            result = [...result].sort((a, b) => (b.revenue / b.spend) - (a.revenue / a.spend));
            break;
        case 'roas_low':
            result = [...result].sort((a, b) => (a.revenue / a.spend) - (b.revenue / b.spend));
            break;
        case 'cpa_low':
            result = [...result].sort((a, b) => a.cpa - b.cpa);
            break;
        case 'cpa_high':
            result = [...result].sort((a, b) => b.cpa - a.cpa);
            break;
        case 'winners':
            result = [...result].sort((a, b) => {
                const order = { winner: 0, neutral: 1, insufficient: 2, loser: 3 };
                return order[a.performance] - order[b.performance];
            });
            break;
        case 'losers':
            result = [...result].sort((a, b) => {
                const order = { loser: 0, insufficient: 1, neutral: 2, winner: 3 };
                return order[a.performance] - order[b.performance];
            });
            break;
    }

    return result;
}, [allAds, searchQuery, sortBy, filterStatus, filterPhase, filterPerformance, filterTags]);

// Filter creatives based on search query
const filteredCreatives = useMemo(() => {
    if (!searchQuery.trim()) return creatives;
    const q = searchQuery.toLowerCase();
    return creatives.filter(creative =>
        creative.name.toLowerCase().includes(q) ||
        creative.type.toLowerCase().includes(q) ||
        creative.placement.toLowerCase().includes(q)
    );
}, [creatives, searchQuery]);

return (
    <div className="flex">
        <Sidebar />

        <main className="main-content flex-1">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">
                            <span className="text-gradient">Ads & Creatives</span>
                        </h1>
                        <p className="text-[var(--text-secondary)]">
                            Manage your ad campaigns and creative assets with AI-powered insights.
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        {connected && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/30">
                                <Radio size={16} className="text-[var(--success)] animate-pulse" />
                                <span className="text-sm text-[var(--success)] font-medium">Live</span>
                                <span className="text-xs text-[var(--text-muted)]">
                                    Updated {lastUpdated.toLocaleTimeString()}
                                </span>
                            </div>
                        )}
                        {activeTab === 'creatives' && (
                            <button className="btn-primary flex items-center gap-2" disabled={!connected}>
                                <Upload size={18} />
                                Upload
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-[var(--glass-bg)] rounded-xl border border-[var(--glass-border)] w-fit">
                    <button
                        onClick={() => setActiveTab('ads')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'ads'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <Megaphone size={18} />
                        Ads
                    </button>
                    <button
                        onClick={() => setActiveTab('creatives')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'creatives'
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        <ImageIcon size={18} />
                        Creatives
                    </button>
                </div>
            </motion.div>

            {/* Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'ads' ? (
                    <motion.div
                        key="ads"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Filters */}
                        <GlassCard className="p-4 mb-6">
                            <div className="space-y-4">
                                {/* Row 1: Search, Sort, Date Range */}
                                <div className="flex items-center gap-4 flex-wrap">
                                    <div className="flex-1 min-w-[200px] relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search campaigns, ad sets, or ads..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="input pl-10 w-full"
                                        />
                                    </div>

                                    {/* Date Range */}
                                    <div className="flex items-center gap-1 bg-[var(--glass-bg)] rounded-lg p-1 border border-[var(--glass-border)]">
                                        <Calendar size={16} className="text-[var(--text-muted)] ml-2" />
                                        {(['7d', '14d', '30d'] as const).map(range => (
                                            <button
                                                key={range}
                                                onClick={() => setDateRange(range)}
                                                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${dateRange === range
                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                    : 'hover:bg-[var(--glass-bg)] text-[var(--text-secondary)]'
                                                    }`}
                                            >
                                                {range}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Sort */}
                                    <div className="flex items-center gap-2">
                                        <ArrowUpDown size={18} className="text-[var(--text-muted)]" />
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                            className="input py-2 px-3 min-w-[160px]"
                                            disabled={!connected}
                                        >
                                            <optgroup label="By Date">
                                                <option value="newest">Newest First</option>
                                                <option value="oldest">Oldest First</option>
                                            </optgroup>
                                            <optgroup label="By Spend">
                                                <option value="spend_high">Spend: High to Low</option>
                                                <option value="spend_low">Spend: Low to High</option>
                                            </optgroup>
                                            <optgroup label="By ROAS">
                                                <option value="roas_high">ROAS: High to Low</option>
                                                <option value="roas_low">ROAS: Low to High</option>
                                            </optgroup>
                                            <optgroup label="By CPA">
                                                <option value="cpa_low">CPA: Low to High</option>
                                                <option value="cpa_high">CPA: High to Low</option>
                                            </optgroup>
                                            <optgroup label="By Performance">
                                                <option value="winners">Winners First</option>
                                                <option value="losers">Losers First</option>
                                            </optgroup>
                                        </select>
                                    </div>
                                </div>

                                {/* Row 2: Filter Chips */}
                                <div className="flex items-center gap-4 flex-wrap">
                                    {/* Status Filters */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-[var(--text-muted)]">Status:</span>
                                        {(['active', 'paused', 'stopped'] as AdStatus[]).map(status => (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    if (filterStatus.includes(status)) {
                                                        setFilterStatus(filterStatus.filter(s => s !== status));
                                                    } else {
                                                        setFilterStatus([...filterStatus, status]);
                                                    }
                                                }}
                                                className={`px-2 py-1 rounded-full text-xs transition-colors border ${filterStatus.includes(status)
                                                    ? `${statusColors[status]} border-current`
                                                    : 'border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="w-px h-6 bg-[var(--glass-border)]" />

                                    {/* Phase Filters */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-[var(--text-muted)]">Phase:</span>
                                        {(['learning', 'scaling', 'stable', 'declining', 'fatigued'] as AdPhase[]).map(phase => (
                                            <button
                                                key={phase}
                                                onClick={() => {
                                                    if (filterPhase.includes(phase)) {
                                                        setFilterPhase(filterPhase.filter(p => p !== phase));
                                                    } else {
                                                        setFilterPhase([...filterPhase, phase]);
                                                    }
                                                }}
                                                className={`px-2 py-1 rounded-full text-xs transition-colors ${filterPhase.includes(phase)
                                                    ? phaseColors[phase]
                                                    : 'bg-[var(--glass-bg)] text-[var(--text-muted)] hover:bg-[var(--glass-border)]'
                                                    }`}
                                            >
                                                {phaseIcons[phase]} {phase}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="w-px h-6 bg-[var(--glass-border)]" />

                                    {/* Performance Filters */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-[var(--text-muted)]">Performance:</span>
                                        {(['winner', 'neutral', 'loser'] as AdPerformance[]).map(perf => (
                                            <button
                                                key={perf}
                                                onClick={() => {
                                                    if (filterPerformance.includes(perf)) {
                                                        setFilterPerformance(filterPerformance.filter(p => p !== perf));
                                                    } else {
                                                        setFilterPerformance([...filterPerformance, perf]);
                                                    }
                                                }}
                                                className={`px-2 py-1 rounded-full text-xs transition-colors border ${filterPerformance.includes(perf)
                                                    ? `${performanceColors[perf]} border-current`
                                                    : 'border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--text-secondary)]'
                                                    }`}
                                            >
                                                {perf === 'winner' && '🏆'} {perf === 'loser' && '📉'} {perf}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Clear Filters */}
                                    {(filterStatus.length > 0 || filterPhase.length > 0 || filterPerformance.length > 0 || filterTags.length > 0) && (
                                        <>
                                            <div className="w-px h-6 bg-[var(--glass-border)]" />
                                            <button
                                                onClick={() => {
                                                    setFilterStatus([]);
                                                    setFilterPhase([]);
                                                    setFilterPerformance([]);
                                                    setFilterTags([]);
                                                }}
                                                className="text-xs text-[var(--error)] hover:underline"
                                            >
                                                Clear Filters
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Row 3: Tag Filters */}
                                {availableTags.length > 0 && (
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <Tag size={14} className="text-[var(--text-muted)]" />
                                            <span className="text-xs text-[var(--text-muted)]">Lead Tags:</span>
                                        </div>
                                        {availableTags.map(tag => (
                                            <button
                                                key={tag.id}
                                                onClick={() => {
                                                    if (filterTags.includes(tag.id)) {
                                                        setFilterTags(filterTags.filter(t => t !== tag.id));
                                                    } else {
                                                        setFilterTags([...filterTags, tag.id]);
                                                    }
                                                }}
                                                className={`px-2 py-1 rounded-full text-xs transition-all flex items-center gap-1 ${filterTags.includes(tag.id)
                                                    ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-primary)]'
                                                    : 'opacity-70 hover:opacity-100'
                                                    }`}
                                                style={{
                                                    backgroundColor: `${tag.color}20`,
                                                    color: tag.color,
                                                    borderColor: tag.color,
                                                    ...(filterTags.includes(tag.id) ? { ringColor: tag.color } : {})
                                                }}
                                            >
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                                {tag.name}
                                            </button>
                                        ))}

                                        {/* Create New Tag Button */}
                                        <button
                                            onClick={() => setShowTagCreator(!showTagCreator)}
                                            className="px-2 py-1 rounded-full text-xs text-[var(--text-muted)] border border-dashed border-[var(--glass-border)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors flex items-center gap-1"
                                        >
                                            <Plus size={12} />
                                            New Tag
                                        </button>

                                        {/* Tag Creator Popup */}
                                        {showTagCreator && (
                                            <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                                                <input
                                                    type="text"
                                                    placeholder="Tag name..."
                                                    value={newTagName}
                                                    onChange={(e) => setNewTagName(e.target.value)}
                                                    className="input py-1 px-2 text-xs w-24"
                                                    onKeyDown={(e) => e.key === 'Enter' && createNewTag()}
                                                />
                                                <div className="flex items-center gap-1">
                                                    {tagColors.map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setNewTagColor(color)}
                                                            className={`w-4 h-4 rounded-full transition-transform ${newTagColor === color ? 'scale-125 ring-1 ring-offset-1' : 'hover:scale-110'}`}
                                                            style={{ backgroundColor: color }}
                                                        />
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={createNewTag}
                                                    disabled={!newTagName.trim()}
                                                    className="px-2 py-1 rounded bg-[var(--accent-primary)] text-white text-xs disabled:opacity-50"
                                                >
                                                    Add
                                                </button>
                                                <button
                                                    onClick={() => setShowTagCreator(false)}
                                                    className="p-1 rounded hover:bg-[var(--glass-bg)] text-[var(--text-muted)]"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </GlassCard>

                        {/* Stats Row 1 - Financial */}
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
                                        <DollarSign className="text-[var(--accent-primary)]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">Total Spend</p>
                                        <p className="text-xl font-bold text-[var(--accent-primary)]">
                                            {allAds.length ? `₱${totals.spend.toLocaleString()}` : '--'}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--success)]/20 flex items-center justify-center">
                                        <Coins className="text-[var(--success)]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">Revenue</p>
                                        <p className="text-xl font-bold text-[var(--success)]">
                                            {allAds.length ? `₱${totals.revenue.toLocaleString()}` : '--'}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totals.roas >= 2 ? 'bg-[var(--success)]/20' : totals.roas >= 1 ? 'bg-[var(--warning)]/20' : 'bg-[var(--error)]/20'}`}>
                                        <Target className={totals.roas >= 2 ? 'text-[var(--success)]' : totals.roas >= 1 ? 'text-[var(--warning)]' : 'text-[var(--error)]'} size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">ROAS</p>
                                        <p className={`text-xl font-bold ${totals.roas >= 2 ? 'text-[var(--success)]' : totals.roas >= 1 ? 'text-[var(--warning)]' : 'text-[var(--error)]'}`}>
                                            {allAds.length ? `${totals.roas.toFixed(2)}x` : '--'}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
                                        <BarChart3 className="text-[var(--accent-primary)]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">Avg. CPA</p>
                                        <p className="text-xl font-bold text-[var(--accent-primary)]">
                                            {allAds.length ? `₱${totals.avgCpa.toFixed(2)}` : '--'}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                        </div>

                        {/* Stats Row 2 - Engagement & Leads */}
                        <div className="grid grid-cols-6 gap-4 mb-6">
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
                                        <Eye className="text-[var(--accent-primary)]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">Impressions</p>
                                        <p className="text-xl font-bold text-[var(--accent-primary)]">
                                            {allAds.length ? `${(totals.impressions / 1000).toFixed(1)}K` : '--'}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
                                        <MousePointer className="text-[var(--accent-primary)]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">Avg. CTR</p>
                                        <p className="text-xl font-bold text-[var(--accent-primary)]">
                                            {allAds.length ? `${totals.ctr.toFixed(1)}%` : '--'}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
                                        <TrendingUp className="text-[var(--accent-primary)]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">Conversions</p>
                                        <p className="text-xl font-bold text-[var(--accent-primary)]">
                                            {allAds.length ? totals.conversions : '--'}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--success)]/20 flex items-center justify-center">
                                        <Trophy className="text-[var(--success)]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">Winners / Losers</p>
                                        <p className="text-xl font-bold">
                                            <span className="text-[var(--success)]">{totals.winners}</span>
                                            <span className="text-[var(--text-muted)]"> / </span>
                                            <span className="text-[var(--error)]">{totals.losers}</span>
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--info)]/20 flex items-center justify-center">
                                        <Users className="text-[var(--info)]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">Total Leads</p>
                                        <p className="text-xl font-bold text-[var(--info)]">
                                            {allAds.length ? totals.leads : '--'}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-[var(--success)]/20 flex items-center justify-center">
                                        <UserCheck className="text-[var(--success)]" size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-[var(--text-muted)]">Qualified Leads</p>
                                        <p className="text-xl font-bold">
                                            <span className="text-[var(--success)]">{allAds.length ? totals.qualifiedLeads : '--'}</span>
                                            {allAds.length > 0 && (
                                                <span className="text-sm text-[var(--text-muted)] ml-2">
                                                    ({((totals.qualifiedLeads / totals.leads) * 100).toFixed(0)}%)
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </GlassCard>
                        </div>

                        {/* Ads Content */}
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="spinner" />
                            </div>
                        ) : !connected ? (
                            <GlassCard className="p-12 text-center">
                                <div className="w-20 h-20 rounded-full bg-[#1877F2]/20 flex items-center justify-center mx-auto mb-6">
                                    <span className="text-4xl font-bold text-[#1877F2]">f</span>
                                </div>
                                <h2 className="text-2xl font-bold mb-3">Connect Meta to View Ads</h2>
                                <p className="text-[var(--text-muted)] mb-6 max-w-md mx-auto">
                                    Link your Facebook Ads account to import and manage your campaigns here.
                                </p>
                                <Link href="/settings">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="btn-primary flex items-center gap-2 mx-auto"
                                    >
                                        <Link2 size={18} />
                                        Connect Meta Account
                                    </motion.button>
                                </Link>
                            </GlassCard>
                        ) : allAds.length === 0 ? (
                            <GlassCard className="p-12 text-center">
                                <div className="w-20 h-20 rounded-full bg-[var(--accent-soft)] flex items-center justify-center mx-auto mb-6">
                                    <Megaphone className="text-[var(--accent-primary)]" size={32} />
                                </div>
                                <h2 className="text-2xl font-bold mb-3">No Ads Found</h2>
                                <p className="text-[var(--text-muted)] mb-6">
                                    Your ad data will appear here once synced from Meta.
                                </p>
                                <button className="btn-secondary flex items-center gap-2 mx-auto">
                                    <RefreshCw size={18} />
                                    Sync Now
                                </button>
                            </GlassCard>
                        ) : (
                            <div className="space-y-4">
                                {/* Campaign Tree View */}
                                {campaigns.map((campaign) => (
                                    <GlassCard key={campaign.id} className="overflow-hidden">
                                        {/* Campaign Header */}
                                        <div
                                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--glass-bg)] transition-colors"
                                            onClick={() => {
                                                const newExpanded = new Set(expandedCampaigns);
                                                if (newExpanded.has(campaign.id)) {
                                                    newExpanded.delete(campaign.id);
                                                } else {
                                                    newExpanded.add(campaign.id);
                                                }
                                                setExpandedCampaigns(newExpanded);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                {expandedCampaigns.has(campaign.id) ? (
                                                    <ChevronDown size={20} className="text-[var(--accent-primary)]" />
                                                ) : (
                                                    <ChevronRight size={20} className="text-[var(--text-muted)]" />
                                                )}
                                                <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
                                                    <FolderOpen className="text-[var(--accent-primary)]" size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{campaign.name}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                                                        <span className={`badge ${statusColors[campaign.status]}`}>{campaign.status}</span>
                                                        <span>•</span>
                                                        <span>{campaign.objective}</span>
                                                        <span>•</span>
                                                        <span>{campaign.adSets.length} Ad Sets</span>
                                                        <span>•</span>
                                                        <span>{campaign.adSets.reduce((a, as) => a + as.ads.length, 0)} Ads</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 text-sm">
                                                <div className="text-right">
                                                    <p className="text-[var(--text-muted)]">Spend</p>
                                                    <p className="font-semibold">₱{campaign.spend.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[var(--text-muted)]">Revenue</p>
                                                    <p className="font-semibold text-[var(--success)]">₱{campaign.revenue.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[var(--text-muted)]">ROAS</p>
                                                    <p className={`font-semibold ${campaign.revenue / campaign.spend >= 2 ? 'text-[var(--success)]' : campaign.revenue / campaign.spend >= 1 ? 'text-[var(--warning)]' : 'text-[var(--error)]'}`}>
                                                        {(campaign.revenue / campaign.spend).toFixed(2)}x
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[var(--text-muted)]">Conversions</p>
                                                    <p className="font-semibold">{campaign.conversions}</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedCampaign(campaign);
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-colors text-xs font-medium"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        </div>

                                        {/* Ad Sets (Expanded) */}
                                        <AnimatePresence>
                                            {expandedCampaigns.has(campaign.id) && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="border-t border-[var(--glass-border)]"
                                                >
                                                    {campaign.adSets.map((adSet) => (
                                                        <div key={adSet.id} className="ml-6 border-l-2 border-[var(--glass-border)]">
                                                            {/* Ad Set Header */}
                                                            <div
                                                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--glass-bg)] transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newExpanded = new Set(expandedAdSets);
                                                                    if (newExpanded.has(adSet.id)) {
                                                                        newExpanded.delete(adSet.id);
                                                                    } else {
                                                                        newExpanded.add(adSet.id);
                                                                    }
                                                                    setExpandedAdSets(newExpanded);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    {expandedAdSets.has(adSet.id) ? (
                                                                        <ChevronDown size={18} className="text-[var(--accent-primary)]" />
                                                                    ) : (
                                                                        <ChevronRight size={18} className="text-[var(--text-muted)]" />
                                                                    )}
                                                                    <div className="w-8 h-8 rounded-lg bg-[var(--info)]/20 flex items-center justify-center">
                                                                        <Users className="text-[var(--info)]" size={16} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-medium">{adSet.name}</h4>
                                                                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                                                            <span className={`badge ${statusColors[adSet.status]}`}>{adSet.status}</span>
                                                                            <span>•</span>
                                                                            <MapPin size={12} />
                                                                            <span>{adSet.targeting.locations.map(l => l.region || l.country).join(', ')}</span>
                                                                            <span>•</span>
                                                                            <span>Ages {adSet.targeting.ageMin}-{adSet.targeting.ageMax}</span>
                                                                            <span>•</span>
                                                                            <span>{adSet.ads.length} Ads</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-4 text-sm">
                                                                    <div className="text-right">
                                                                        <p className="text-[var(--text-muted)]">Spend</p>
                                                                        <p className="font-semibold">₱{adSet.spend.toLocaleString()}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[var(--text-muted)]">ROAS</p>
                                                                        <p className={`font-semibold ${adSet.revenue / adSet.spend >= 2 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                                                                            {(adSet.revenue / adSet.spend).toFixed(2)}x
                                                                        </p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-[var(--text-muted)]">Leads</p>
                                                                        <p className="font-semibold">{adSet.leads}</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedAdSet(adSet);
                                                                        }}
                                                                        className="px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-colors text-xs font-medium"
                                                                    >
                                                                        View
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Ads (Expanded) */}
                                                            <AnimatePresence>
                                                                {expandedAdSets.has(adSet.id) && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: 'auto', opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        transition={{ duration: 0.2 }}
                                                                        className="border-t border-[var(--glass-border)] bg-[var(--glass-bg)]/50"
                                                                    >
                                                                        {adSet.ads.map((ad) => (
                                                                            <div
                                                                                key={ad.id}
                                                                                className="ml-6 p-3 flex items-center justify-between cursor-pointer hover:bg-[var(--glass-bg)] transition-colors border-l-2 border-[var(--glass-border)]"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedAd(ad);
                                                                                }}
                                                                            >
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="w-8 h-8 rounded-lg bg-[var(--glass-bg)] flex items-center justify-center">
                                                                                        {ad.mediaType === 'video' ? (
                                                                                            <Video className="text-[var(--accent-primary)]" size={16} />
                                                                                        ) : (
                                                                                            <ImageIcon className="text-[var(--accent-primary)]" size={16} />
                                                                                        )}
                                                                                    </div>
                                                                                    <div>
                                                                                        <h5 className="font-medium text-sm">{ad.name}</h5>
                                                                                        <div className="flex items-center gap-2 text-xs">
                                                                                            <span className={`badge ${statusColors[ad.status]}`}>{ad.status}</span>
                                                                                            <span className={`px-2 py-0.5 rounded-full text-xs ${phaseColors[ad.phase]}`}>
                                                                                                {phaseIcons[ad.phase]} {ad.phase}
                                                                                            </span>
                                                                                            <span className={`badge ${performanceColors[ad.performance]}`}>
                                                                                                {ad.performance === 'winner' && <TrendingUp size={10} />}
                                                                                                {ad.performance === 'loser' && <TrendingDown size={10} />}
                                                                                                {ad.performance}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-4 text-xs">
                                                                                    <div className="text-right">
                                                                                        <p className="text-[var(--text-muted)]">Spend</p>
                                                                                        <p className="font-semibold">₱{ad.spend.toLocaleString()}</p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="text-[var(--text-muted)]">Revenue</p>
                                                                                        <p className="font-semibold text-[var(--success)]">₱{ad.revenue.toLocaleString()}</p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="text-[var(--text-muted)]">ROAS</p>
                                                                                        <p className={`font-semibold ${ad.revenue / ad.spend >= 2 ? 'text-[var(--success)]' : ad.revenue / ad.spend >= 1 ? 'text-[var(--warning)]' : 'text-[var(--error)]'}`}>
                                                                                            {(ad.revenue / ad.spend).toFixed(2)}x
                                                                                        </p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="text-[var(--text-muted)]">Leads</p>
                                                                                        <p className="font-semibold">{ad.leads}</p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </GlassCard>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="creatives"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Filters */}
                        <GlassCard className="p-4 mb-6">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex-1 min-w-[200px] relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search creatives..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="input pl-10 w-full"
                                    />
                                </div>
                                <button className="btn-secondary flex items-center gap-2 flex-shrink-0" disabled={!connected}>
                                    <Filter size={18} />
                                    Type: All
                                </button>
                                <button
                                    onClick={() => setShowUploadModal(true)}
                                    className="btn-primary flex items-center gap-2 flex-shrink-0"
                                >
                                    <Upload size={18} />
                                    Upload Creative
                                </button>
                            </div>
                        </GlassCard>

                        {/* Creatives Content */}
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="spinner" />
                            </div>
                        ) : !connected ? (
                            <GlassCard className="p-12 text-center">
                                <div className="w-20 h-20 rounded-full bg-[#1877F2]/20 flex items-center justify-center mx-auto mb-6">
                                    <span className="text-4xl font-bold text-[#1877F2]">f</span>
                                </div>
                                <h2 className="text-2xl font-bold mb-3">Connect Meta to View Creatives</h2>
                                <p className="text-[var(--text-muted)] mb-6 max-w-md mx-auto">
                                    Link your Facebook Ads account to import creatives and get AI-powered analysis.
                                </p>
                                <Link href="/settings">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="btn-primary flex items-center gap-2 mx-auto"
                                    >
                                        <Link2 size={18} />
                                        Connect Meta Account
                                    </motion.button>
                                </Link>
                            </GlassCard>
                        ) : creatives.length === 0 ? (
                            <GlassCard className="p-12 text-center">
                                <div className="w-20 h-20 rounded-full bg-[var(--accent-soft)] flex items-center justify-center mx-auto mb-6">
                                    <ImageIcon className="text-[var(--accent-primary)]" size={32} />
                                </div>
                                <h2 className="text-2xl font-bold mb-3">No Creatives Found</h2>
                                <p className="text-[var(--text-muted)] mb-6">
                                    Your creative assets will appear here once synced from Meta.
                                </p>
                                <div className="flex gap-4 justify-center">
                                    <button className="btn-secondary flex items-center gap-2">
                                        <RefreshCw size={18} />
                                        Sync Now
                                    </button>
                                    <button
                                        onClick={() => setShowUploadModal(true)}
                                        className="btn-primary flex items-center gap-2"
                                    >
                                        <Upload size={18} />
                                        Upload Creative
                                    </button>
                                </div>
                            </GlassCard>
                        ) : (
                            <div className="grid grid-cols-3 gap-5">
                                {filteredCreatives.map((creative, idx) => {
                                    const systemInfo = getSystemAuthority(creative);
                                    const deliveryColors = {
                                        healthy: 'bg-green-500/20 text-green-400 border-green-500/30',
                                        risky: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                                        poor: 'bg-red-500/20 text-red-400 border-red-500/30'
                                    };
                                    const conversionColors = {
                                        good: 'bg-green-500/20 text-green-400 border-green-500/30',
                                        bad: 'bg-red-500/20 text-red-400 border-red-500/30',
                                        insufficient: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                    };
                                    const authorityColors = {
                                        winner: 'from-green-500 to-emerald-400',
                                        conversion_owner: 'from-blue-500 to-cyan-400',
                                        structure: 'from-orange-500 to-yellow-400'
                                    };

                                    return (
                                        <motion.div
                                            key={creative.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.1 }}
                                        >
                                            <GlassCard className="overflow-hidden group">
                                                {/* Thumbnail */}
                                                <div className="relative h-40 bg-[var(--bg-tertiary)]">
                                                    {/* Type Badge */}
                                                    <div className="absolute top-3 left-3">
                                                        <span className="badge badge-info flex items-center gap-1">
                                                            {creative.type === 'video' ? <Play size={12} /> : <ImageIcon size={12} />}
                                                            {creative.type}
                                                        </span>
                                                    </div>

                                                    {/* Score Circle */}
                                                    <div className="absolute top-3 right-3">
                                                        <div
                                                            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg"
                                                            style={{
                                                                background: `conic-gradient(${getScoreColor(creative.deliveryScore)} ${creative.deliveryScore}%, var(--glass-bg) ${creative.deliveryScore}%)`,
                                                            }}
                                                        >
                                                            <div className="w-9 h-9 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                                                                {creative.deliveryScore}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* System Authority Indicator */}
                                                    <div className="absolute bottom-3 left-3 right-3">
                                                        <div className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${authorityColors[systemInfo.authority]} text-white text-xs font-medium flex items-center gap-2`}>
                                                            {systemInfo.authority === 'winner' && <Trophy size={12} />}
                                                            {systemInfo.authority === 'conversion_owner' && <Target size={12} />}
                                                            {systemInfo.authority === 'structure' && <Activity size={12} />}
                                                            {systemInfo.action}
                                                        </div>
                                                    </div>

                                                    {/* Status */}
                                                    {creative.status === 'analyzing' && (
                                                        <div className="absolute inset-0 bg-[var(--bg-primary)]/80 flex items-center justify-center">
                                                            <div className="spinner" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Info */}
                                                <div className="p-4">
                                                    <h3 className="font-semibold mb-2 truncate">{creative.name}</h3>

                                                    {/* System State Badges */}
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs border ${deliveryColors[creative.deliveryHealth]}`}>
                                                            {creative.deliveryHealth === 'healthy' && <CheckCircle size={10} className="inline mr-1" />}
                                                            {creative.deliveryHealth === 'risky' && <AlertTriangle size={10} className="inline mr-1" />}
                                                            {creative.deliveryHealth === 'poor' && <AlertCircle size={10} className="inline mr-1" />}
                                                            Delivery: {creative.deliveryHealth}
                                                        </span>
                                                        <span className={`px-2 py-1 rounded-full text-xs border ${conversionColors[creative.conversionHealth]}`}>
                                                            Conversion: {creative.conversionHealth}
                                                        </span>
                                                    </div>

                                                    {/* Placement & Grade */}
                                                    <div className="flex items-center justify-between text-sm mb-3">
                                                        <span className="text-[var(--text-muted)]">{creative.placement}</span>
                                                        <span
                                                            className="font-bold"
                                                            style={{ color: getScoreColor(creative.deliveryScore) }}
                                                        >
                                                            Grade: {creative.structureRating}
                                                        </span>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => setSelectedCreative(creative)}
                                                            className="flex-1 py-2 px-3 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--accent-primary)]/80 transition-colors"
                                                        >
                                                            <Zap size={14} />
                                                            Show System
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedCreative(creative);
                                                                setShowInputMode(true);
                                                            }}
                                                            className="py-2 px-3 rounded-lg bg-[var(--glass-bg)] text-[var(--text-secondary)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--glass-border)] transition-colors border border-[var(--glass-border)]"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </GlassCard>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </main>

        {/* Ad Detail Modal */}
        <AnimatePresence>
            {selectedAd && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setSelectedAd(null)}
                    />

                    {/* Modal Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-[600px] max-w-[90vw] bg-[var(--bg-secondary)] border-l border-[var(--glass-border)] z-50 overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--glass-border)] p-6 z-10">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">{selectedAd.name}</h2>
                                    <div className="flex items-center gap-2">
                                        <span className={`badge ${statusColors[selectedAd.status]}`}>
                                            {selectedAd.status}
                                        </span>
                                        <span className={`badge ${performanceColors[selectedAd.performance]}`}>
                                            {selectedAd.performance === 'winner' && <TrendingUp size={12} />}
                                            {selectedAd.performance === 'loser' && <TrendingDown size={12} />}
                                            {selectedAd.performance}
                                        </span>
                                        <span className="text-sm text-[var(--text-muted)]">
                                            {selectedAd.creativeType.replace(/_/g, ' ')}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedAd(null)}
                                    className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
                            {/* Phase Badge */}
                            <div className="flex items-center gap-4">
                                <span className={`px-4 py-2 rounded-xl text-sm font-medium ${phaseColors[selectedAd.phase]}`}>
                                    {phaseIcons[selectedAd.phase]} {selectedAd.phase.charAt(0).toUpperCase() + selectedAd.phase.slice(1)} Phase
                                </span>
                                <span className="text-sm text-[var(--text-muted)]">
                                    {selectedAd.mediaType === 'video' ? '🎥 Video' : selectedAd.mediaType === 'carousel' ? '📸 Carousel' : '🖼️ Image'}
                                </span>
                            </div>

                            {/* Lead Tags Section */}
                            <GlassCard className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Tag size={18} className="text-[var(--accent-primary)]" />
                                        Lead Tags
                                    </h3>
                                    <span className="text-xs text-[var(--text-muted)]">
                                        {(selectedAd.tags || []).length} tag{(selectedAd.tags || []).length !== 1 ? 's' : ''}
                                    </span>
                                </div>

                                {/* Current Tags */}
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {(!selectedAd.tags || selectedAd.tags.length === 0) ? (
                                        <span className="text-sm text-[var(--text-muted)] italic">No tags assigned</span>
                                    ) : (
                                        selectedAd.tags.map(tag => (
                                            <span
                                                key={tag.id}
                                                className="px-3 py-1.5 rounded-full text-sm flex items-center gap-2 group"
                                                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                                            >
                                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                                {tag.name}
                                                <button
                                                    onClick={() => removeTagFromAd(selectedAd.id, tag.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20 rounded-full p-0.5"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </span>
                                        ))
                                    )}
                                </div>

                                {/* Add Tag Dropdown */}
                                <div className="relative">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-[var(--text-muted)]">Add tag:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {availableTags
                                                .filter(tag => !(selectedAd.tags || []).find(t => t.id === tag.id))
                                                .map(tag => (
                                                    <button
                                                        key={tag.id}
                                                        onClick={() => addTagToAd(selectedAd.id, tag)}
                                                        className="px-2 py-1 rounded-full text-xs flex items-center gap-1 transition-all hover:scale-105"
                                                        style={{ backgroundColor: `${tag.color}10`, color: tag.color, border: `1px dashed ${tag.color}40` }}
                                                    >
                                                        <Plus size={10} />
                                                        {tag.name}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-4 gap-4">
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">Total Spend</p>
                                    <p className="text-2xl font-bold text-[var(--accent-primary)]">
                                        ₱{selectedAd.spend.toLocaleString()}
                                    </p>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">Revenue</p>
                                    <p className="text-2xl font-bold text-[var(--success)]">
                                        ₱{selectedAd.revenue.toLocaleString()}
                                    </p>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">ROAS</p>
                                    <p className={`text-2xl font-bold ${(selectedAd.revenue / selectedAd.spend) >= 2 ? 'text-[var(--success)]' : (selectedAd.revenue / selectedAd.spend) >= 1 ? 'text-[var(--warning)]' : 'text-[var(--error)]'}`}>
                                        {(selectedAd.revenue / selectedAd.spend).toFixed(2)}x
                                    </p>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">Conversions</p>
                                    <p className="text-2xl font-bold text-[var(--accent-primary)]">
                                        {selectedAd.conversions}
                                    </p>
                                </GlassCard>
                            </div>

                            {/* Day-to-Day Performance Chart */}
                            <GlassCard className="p-5">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <TrendingUp size={18} className="text-[var(--accent-primary)]" />
                                    Daily Performance ({dateRange})
                                </h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={selectedAd.dailyData.slice(dateRange === '7d' ? -7 : dateRange === '14d' ? -14 : -30)}>
                                            <defs>
                                                <linearGradient id="dailySpendGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--error)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--error)" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="dailyRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                                            <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => v.split('-').slice(1).join('/')} />
                                            <YAxis stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--glass-bg)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-primary)'
                                                }}
                                                formatter={(value) => [`₱${Number(value).toLocaleString()}`, '']}
                                            />
                                            <Legend />
                                            <Area type="monotone" dataKey="spend" name="Spend" stroke="var(--error)" fill="url(#dailySpendGradient)" strokeWidth={2} />
                                            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--success)" fill="url(#dailyRevenueGradient)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </GlassCard>

                            {/* ROAS Trend Chart */}
                            <GlassCard className="p-5">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Target size={18} className="text-[var(--accent-primary)]" />
                                    ROAS Trend
                                </h3>
                                <div className="h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={selectedAd.dailyData.slice(dateRange === '7d' ? -7 : dateRange === '14d' ? -14 : -30)}>
                                            <defs>
                                                <linearGradient id="roasGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                                            <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => v.split('-').slice(1).join('/')} />
                                            <YAxis stroke="var(--text-muted)" fontSize={10} tickFormatter={(v) => `${v}x`} domain={[0, 'auto']} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--glass-bg)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-primary)'
                                                }}
                                                formatter={(value) => [`${Number(value).toFixed(2)}x`, 'ROAS']}
                                            />
                                            <Area type="monotone" dataKey="roas" name="ROAS" stroke="var(--accent-primary)" fill="url(#roasGradient)" strokeWidth={2} />
                                            {/* Reference line at 2x ROAS */}
                                            <ReferenceLine y={2} stroke="var(--success)" strokeDasharray="5 5" label={{ value: '2x Target', fill: 'var(--success)', fontSize: 10 }} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </GlassCard>

                            {/* Video Metrics (if video ad) */}
                            {selectedAd.videoMetrics && (
                                <GlassCard className="p-5">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Video size={18} className="text-[var(--accent-primary)]" />
                                        Video Retention Metrics
                                    </h3>
                                    <div className="grid grid-cols-4 gap-4 mb-4">
                                        <div className="text-center p-3 rounded-lg bg-[var(--glass-bg)]">
                                            <p className="text-2xl font-bold text-[var(--accent-primary)]">{selectedAd.videoMetrics.hookRate}%</p>
                                            <p className="text-xs text-[var(--text-muted)]">Hook Rate</p>
                                        </div>
                                        <div className="text-center p-3 rounded-lg bg-[var(--glass-bg)]">
                                            <p className="text-2xl font-bold text-[var(--success)]">{selectedAd.videoMetrics.thruPlays.toLocaleString()}</p>
                                            <p className="text-xs text-[var(--text-muted)]">ThruPlays</p>
                                        </div>
                                        <div className="text-center p-3 rounded-lg bg-[var(--glass-bg)]">
                                            <p className="text-2xl font-bold text-[var(--info)]">{selectedAd.videoMetrics.views3s.toLocaleString()}</p>
                                            <p className="text-xs text-[var(--text-muted)]">3s Views</p>
                                        </div>
                                        <div className="text-center p-3 rounded-lg bg-[var(--glass-bg)]">
                                            <p className="text-2xl font-bold text-[var(--warning)]">{selectedAd.videoMetrics.avgWatchTime}s</p>
                                            <p className="text-xs text-[var(--text-muted)]">Avg Watch Time</p>
                                        </div>
                                    </div>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={[
                                                { name: '0%', retention: 100 },
                                                { name: '25%', retention: selectedAd.videoMetrics.retention25 },
                                                { name: '50%', retention: selectedAd.videoMetrics.retention50 },
                                                { name: '75%', retention: selectedAd.videoMetrics.retention75 },
                                                { name: '95%', retention: selectedAd.videoMetrics.retention95 },
                                            ]}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                                                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                                                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                                                <Tooltip
                                                    contentStyle={{
                                                        background: 'var(--glass-bg)',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: '8px',
                                                        color: 'var(--text-primary)'
                                                    }}
                                                    formatter={(value) => [`${value}%`, 'Retention']}
                                                />
                                                <Area type="monotone" dataKey="retention" name="Retention" stroke="var(--accent-primary)" fill="var(--accent-soft)" strokeWidth={2} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </GlassCard>
                            )}

                            {/* Demographics */}
                            {selectedAd.demographics && (
                                <GlassCard className="p-5">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Users size={18} className="text-[var(--accent-primary)]" />
                                        Demographics Breakdown
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Age Distribution */}
                                        <div>
                                            <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Age Distribution</h4>
                                            <div className="space-y-2">
                                                {selectedAd.demographics.age.map(demo => (
                                                    <div key={demo.name} className="flex items-center gap-2">
                                                        <span className="text-xs w-12">{demo.name}</span>
                                                        <div className="flex-1 h-4 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-full"
                                                                style={{ width: `${demo.percentage}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs w-10 text-right">{demo.percentage}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Gender Distribution */}
                                        <div>
                                            <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Gender Distribution</h4>
                                            <div className="flex items-center gap-4 h-32">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RechartsPieChart>
                                                        <Pie
                                                            data={selectedAd.demographics.gender.map(g => ({ name: g.name, value: g.percentage }))}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={25}
                                                            outerRadius={45}
                                                        >
                                                            <Cell fill="var(--accent-primary)" />
                                                            <Cell fill="var(--info)" />
                                                        </Pie>
                                                        <Tooltip formatter={(value) => [`${value}%`, '']} />
                                                    </RechartsPieChart>
                                                </ResponsiveContainer>
                                                <div className="space-y-2">
                                                    {selectedAd.demographics.gender.map((g, i) => (
                                                        <div key={g.name} className="flex items-center gap-2 text-xs">
                                                            <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-[var(--accent-primary)]' : 'bg-[var(--info)]'}`} />
                                                            <span>{g.name}: {g.percentage}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Location Distribution */}
                                        <div>
                                            <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Top Locations</h4>
                                            <div className="space-y-2">
                                                {selectedAd.demographics.location.map(loc => (
                                                    <div key={loc.name} className="flex items-center justify-between text-sm">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin size={12} className="text-[var(--text-muted)]" />
                                                            {loc.name}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[var(--success)]">{loc.roas.toFixed(1)}x</span>
                                                            <span className="text-[var(--text-muted)]">₱{loc.spend.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Placement Distribution */}
                                        <div>
                                            <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2">Placements</h4>
                                            <div className="space-y-2">
                                                {selectedAd.demographics.placement.map(place => (
                                                    <div key={place.name} className="flex items-center gap-2">
                                                        <span className="text-xs w-24">{place.name}</span>
                                                        <div className="flex-1 h-3 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${place.roas >= 3 ? 'bg-[var(--success)]' : place.roas >= 2 ? 'bg-[var(--warning)]' : 'bg-[var(--error)]'}`}
                                                                style={{ width: `${place.percentage}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs w-12 text-right">{place.roas.toFixed(1)}x</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </GlassCard>
                            )}

                            {/* Detailed Metrics */}
                            <GlassCard className="p-4">
                                <h3 className="text-lg font-semibold mb-4">Detailed Metrics</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Impressions</span>
                                        <span className="font-semibold">{selectedAd.impressions.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Reach</span>
                                        <span className="font-semibold">{selectedAd.reach.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Frequency</span>
                                        <span className="font-semibold">{selectedAd.frequency.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Clicks</span>
                                        <span className="font-semibold">{selectedAd.clicks.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">CTR</span>
                                        <span className="font-semibold">{selectedAd.ctr}%</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">CPC</span>
                                        <span className="font-semibold">₱{selectedAd.cpc.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">CPM</span>
                                        <span className="font-semibold">₱{selectedAd.cpm.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">CPA</span>
                                        <span className="font-semibold">₱{selectedAd.cpa.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Total Leads</span>
                                        <span className="font-semibold text-[var(--info)]">{selectedAd.leads}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Qualified Leads</span>
                                        <span className="font-semibold text-[var(--success)]">
                                            {selectedAd.qualifiedLeads} ({((selectedAd.qualifiedLeads / selectedAd.leads) * 100).toFixed(0)}%)
                                        </span>
                                    </div>
                                </div>
                            </GlassCard>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Campaign Detail Modal */}
        <AnimatePresence>
            {selectedCampaign && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setSelectedCampaign(null)}
                    />

                    {/* Modal Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-[600px] max-w-[90vw] bg-[var(--bg-secondary)] border-l border-[var(--glass-border)] z-50 overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--glass-border)] p-6 z-10">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">{selectedCampaign.name}</h2>
                                    <div className="flex items-center gap-2">
                                        <span className={`badge ${statusColors[selectedCampaign.status]}`}>
                                            {selectedCampaign.status}
                                        </span>
                                        <span className="text-sm text-[var(--text-muted)]">
                                            📊 {selectedCampaign.objective}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedCampaign(null)}
                                    className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
                            {/* Campaign Stats Grid */}
                            <div className="grid grid-cols-4 gap-4">
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">Total Spend</p>
                                    <p className="text-2xl font-bold text-[var(--accent-primary)]">
                                        ₱{selectedCampaign.spend.toLocaleString()}
                                    </p>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">Revenue</p>
                                    <p className="text-2xl font-bold text-[var(--success)]">
                                        ₱{selectedCampaign.revenue.toLocaleString()}
                                    </p>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">ROAS</p>
                                    <p className={`text-2xl font-bold ${(selectedCampaign.revenue / selectedCampaign.spend) >= 2 ? 'text-[var(--success)]' : (selectedCampaign.revenue / selectedCampaign.spend) >= 1 ? 'text-[var(--warning)]' : 'text-[var(--error)]'}`}>
                                        {(selectedCampaign.revenue / selectedCampaign.spend).toFixed(2)}x
                                    </p>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">Conversions</p>
                                    <p className="text-2xl font-bold text-[var(--info)]">
                                        {selectedCampaign.conversions}
                                    </p>
                                </GlassCard>
                            </div>

                            {/* Campaign Overview */}
                            <GlassCard className="p-4">
                                <h3 className="text-lg font-semibold mb-4">Campaign Overview</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Budget</span>
                                        <span className="font-semibold">₱{selectedCampaign.budget.toLocaleString()} / {selectedCampaign.budgetType}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Ad Sets</span>
                                        <span className="font-semibold">{selectedCampaign.adSets.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Total Ads</span>
                                        <span className="font-semibold">{selectedCampaign.adSets.reduce((a, as) => a + as.ads.length, 0)}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Impressions</span>
                                        <span className="font-semibold">{selectedCampaign.impressions.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Leads</span>
                                        <span className="font-semibold text-[var(--info)]">{selectedCampaign.leads}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Qualified Leads</span>
                                        <span className="font-semibold text-[var(--success)]">{selectedCampaign.qualifiedLeads}</span>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Ad Sets List */}
                            <GlassCard className="p-4">
                                <h3 className="text-lg font-semibold mb-4">Ad Sets ({selectedCampaign.adSets.length})</h3>
                                <div className="space-y-2">
                                    {selectedCampaign.adSets.map(adSet => (
                                        <div
                                            key={adSet.id}
                                            className="p-3 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] cursor-pointer transition-colors flex items-center justify-between"
                                            onClick={() => {
                                                setSelectedCampaign(null);
                                                setSelectedAdSet(adSet);
                                            }}
                                        >
                                            <div>
                                                <h4 className="font-medium">{adSet.name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                                    <span className={`badge ${statusColors[adSet.status]}`}>{adSet.status}</span>
                                                    <span>•</span>
                                                    <span>{adSet.ads.length} ads</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="text-right">
                                                    <p className="text-[var(--text-muted)] text-xs">Spend</p>
                                                    <p className="font-semibold">₱{adSet.spend.toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[var(--text-muted)] text-xs">ROAS</p>
                                                    <p className={`font-semibold ${adSet.revenue / adSet.spend >= 2 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                                                        {(adSet.revenue / adSet.spend).toFixed(2)}x
                                                    </p>
                                                </div>
                                                <ChevronRight size={16} className="text-[var(--text-muted)]" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Ad Set Detail Modal */}
        <AnimatePresence>
            {selectedAdSet && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setSelectedAdSet(null)}
                    />

                    {/* Modal Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-[600px] max-w-[90vw] bg-[var(--bg-secondary)] border-l border-[var(--glass-border)] z-50 overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--glass-border)] p-6 z-10">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">{selectedAdSet.name}</h2>
                                    <div className="flex items-center gap-2">
                                        <span className={`badge ${statusColors[selectedAdSet.status]}`}>
                                            {selectedAdSet.status}
                                        </span>
                                        <span className="text-sm text-[var(--text-muted)]">
                                            📍 {selectedAdSet.placements.join(', ')}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedAdSet(null)}
                                    className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
                            {/* Ad Set Stats Grid */}
                            <div className="grid grid-cols-4 gap-4">
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">Spend</p>
                                    <p className="text-2xl font-bold text-[var(--accent-primary)]">
                                        ₱{selectedAdSet.spend.toLocaleString()}
                                    </p>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">Revenue</p>
                                    <p className="text-2xl font-bold text-[var(--success)]">
                                        ₱{selectedAdSet.revenue.toLocaleString()}
                                    </p>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">ROAS</p>
                                    <p className={`text-2xl font-bold ${(selectedAdSet.revenue / selectedAdSet.spend) >= 2 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                                        {(selectedAdSet.revenue / selectedAdSet.spend).toFixed(2)}x
                                    </p>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-1">Conversions</p>
                                    <p className="text-2xl font-bold text-[var(--info)]">
                                        {selectedAdSet.conversions}
                                    </p>
                                </GlassCard>
                            </div>

                            {/* Targeting Info */}
                            <GlassCard className="p-4">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Users size={18} className="text-[var(--accent-primary)]" />
                                    Targeting
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Age Range</span>
                                        <span className="font-semibold">{selectedAdSet.targeting.ageMin} - {selectedAdSet.targeting.ageMax}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Genders</span>
                                        <span className="font-semibold capitalize">{selectedAdSet.targeting.genders.join(', ')}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Audience Size</span>
                                        <span className="font-semibold">{(selectedAdSet.targeting.audienceSize / 1000000).toFixed(1)}M</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                                        <span className="text-[var(--text-muted)]">Budget</span>
                                        <span className="font-semibold">₱{selectedAdSet.budget.toLocaleString()} / {selectedAdSet.budgetType}</span>
                                    </div>
                                </div>

                                {/* Locations */}
                                <div className="mt-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-2">Locations:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedAdSet.targeting.locations.map((loc, i) => (
                                            <span key={i} className="px-2 py-1 rounded-full bg-[var(--glass-bg)] text-xs flex items-center gap-1">
                                                <MapPin size={12} />
                                                {loc.region ? `${loc.region}, ${loc.country}` : loc.country}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Interests */}
                                <div className="mt-4">
                                    <p className="text-sm text-[var(--text-muted)] mb-2">Interests:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedAdSet.targeting.interests.map((interest, i) => (
                                            <span key={i} className="px-2 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)] text-xs">
                                                {interest}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Leads Info */}
                            <GlassCard className="p-4">
                                <h3 className="text-lg font-semibold mb-4">Leads Performance</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-4 rounded-lg bg-[var(--glass-bg)]">
                                        <p className="text-3xl font-bold text-[var(--info)]">{selectedAdSet.leads}</p>
                                        <p className="text-sm text-[var(--text-muted)]">Total Leads</p>
                                    </div>
                                    <div className="text-center p-4 rounded-lg bg-[var(--glass-bg)]">
                                        <p className="text-3xl font-bold text-[var(--success)]">{selectedAdSet.qualifiedLeads}</p>
                                        <p className="text-sm text-[var(--text-muted)]">Qualified</p>
                                    </div>
                                    <div className="text-center p-4 rounded-lg bg-[var(--glass-bg)]">
                                        <p className="text-3xl font-bold text-[var(--accent-primary)]">
                                            {((selectedAdSet.qualifiedLeads / selectedAdSet.leads) * 100).toFixed(0)}%
                                        </p>
                                        <p className="text-sm text-[var(--text-muted)]">Qualification Rate</p>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Ads List */}
                            <GlassCard className="p-4">
                                <h3 className="text-lg font-semibold mb-4">Ads ({selectedAdSet.ads.length})</h3>
                                <div className="space-y-2">
                                    {selectedAdSet.ads.map(ad => (
                                        <div
                                            key={ad.id}
                                            className="p-3 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] cursor-pointer transition-colors flex items-center justify-between"
                                            onClick={() => {
                                                setSelectedAdSet(null);
                                                setSelectedAd(ad);
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-[var(--glass-border)] flex items-center justify-center">
                                                    {ad.mediaType === 'video' ? (
                                                        <Video className="text-[var(--accent-primary)]" size={16} />
                                                    ) : (
                                                        <ImageIcon className="text-[var(--accent-primary)]" size={16} />
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="font-medium text-sm">{ad.name}</h4>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className={`badge ${statusColors[ad.status]}`}>{ad.status}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs ${phaseColors[ad.phase]}`}>
                                                            {phaseIcons[ad.phase]} {ad.phase}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="text-right">
                                                    <p className="text-[var(--text-muted)] text-xs">ROAS</p>
                                                    <p className={`font-semibold ${ad.revenue / ad.spend >= 2 ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                                                        {(ad.revenue / ad.spend).toFixed(2)}x
                                                    </p>
                                                </div>
                                                <span className={`badge ${performanceColors[ad.performance]}`}>
                                                    {ad.performance}
                                                </span>
                                                <ChevronRight size={16} className="text-[var(--text-muted)]" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GlassCard>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Creative System Diagnostic Modal */}
        <AnimatePresence>
            {selectedCreative && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => {
                            setSelectedCreative(null);
                            setShowInputMode(false);
                        }}
                    />

                    {/* Modal Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 h-full w-[700px] max-w-[95vw] bg-[var(--bg-secondary)] border-l border-[var(--glass-border)] z-50 overflow-y-auto"
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-[var(--bg-secondary)] border-b border-[var(--glass-border)] p-6 z-10">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold mb-2">{selectedCreative.name}</h2>
                                    <div className="flex items-center gap-2">
                                        <span className="badge badge-info flex items-center gap-1">
                                            {selectedCreative.type === 'video' ? <Play size={12} /> : <ImageIcon size={12} />}
                                            {selectedCreative.type}
                                        </span>
                                        <span className="text-sm text-[var(--text-muted)]">
                                            {selectedCreative.placement}
                                        </span>
                                        <span
                                            className="font-bold text-sm"
                                            style={{ color: getScoreColor(selectedCreative.deliveryScore) }}
                                        >
                                            Grade: {selectedCreative.structureRating}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedCreative(null);
                                        setShowInputMode(false);
                                    }}
                                    className="p-2 rounded-lg hover:bg-[var(--glass-bg)] transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-120px)]">
                            {/* System State Matrix */}
                            <GlassCard className="p-5">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Settings size={18} className="text-[var(--accent-primary)]" />
                                    System State Matrix
                                </h3>

                                {(() => {
                                    const systemInfo = getSystemAuthority(selectedCreative);
                                    const deliveryColors = {
                                        healthy: 'bg-green-500/20 text-green-400 border-green-500',
                                        risky: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
                                        poor: 'bg-red-500/20 text-red-400 border-red-500'
                                    };
                                    const conversionColors = {
                                        good: 'bg-green-500/20 text-green-400 border-green-500',
                                        bad: 'bg-red-500/20 text-red-400 border-red-500',
                                        insufficient: 'bg-gray-500/20 text-gray-400 border-gray-500'
                                    };
                                    const authorityColors = {
                                        winner: 'from-green-500 to-emerald-400',
                                        conversion_owner: 'from-blue-500 to-cyan-400',
                                        structure: 'from-orange-500 to-yellow-400'
                                    };

                                    return (
                                        <div className="space-y-4">
                                            {/* State Badges */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className={`p-4 rounded-xl border-2 ${deliveryColors[selectedCreative.deliveryHealth]}`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Activity size={18} />
                                                        <span className="font-semibold">Delivery (Structure)</span>
                                                    </div>
                                                    <p className="text-2xl font-bold capitalize">{selectedCreative.deliveryHealth}</p>
                                                    <p className="text-sm opacity-80">Score: {selectedCreative.deliveryScore}%</p>
                                                </div>
                                                <div className={`p-4 rounded-xl border-2 ${conversionColors[selectedCreative.conversionHealth]}`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Target size={18} />
                                                        <span className="font-semibold">Conversion Owner</span>
                                                    </div>
                                                    <p className="text-2xl font-bold capitalize">{selectedCreative.conversionHealth}</p>
                                                    <p className="text-sm opacity-80">
                                                        {selectedCreative.conversionAnalysis?.confidence || 'N/A'} confidence
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Authority Message */}
                                            <div className={`p-4 rounded-xl bg-gradient-to-r ${authorityColors[systemInfo.authority]} text-white`}>
                                                <div className="flex items-center gap-3">
                                                    {systemInfo.authority === 'winner' && <Trophy size={24} />}
                                                    {systemInfo.authority === 'conversion_owner' && <Target size={24} />}
                                                    {systemInfo.authority === 'structure' && <Activity size={24} />}
                                                    <div>
                                                        <p className="font-bold text-lg">{systemInfo.action}</p>
                                                        <p className="text-sm opacity-90">{systemInfo.message}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </GlassCard>

                            {/* Structure System Panel */}
                            {selectedCreative.structureAnalysis && (
                                <GlassCard className={`p-5 ${selectedCreative.deliveryHealth === 'healthy' ? 'opacity-60' : ''}`}>
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Activity size={18} className="text-orange-400" />
                                        Structure System (Delivery)
                                        {selectedCreative.deliveryHealth === 'healthy' && (
                                            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full ml-auto">✓ Healthy</span>
                                        )}
                                    </h3>

                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                            <p className="text-xs text-[var(--text-muted)] mb-1">Delivery Probability</p>
                                            <p className="text-2xl font-bold" style={{ color: getScoreColor(selectedCreative.structureAnalysis.deliveryProbability) }}>
                                                {selectedCreative.structureAnalysis.deliveryProbability}%
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                            <p className="text-xs text-[var(--text-muted)] mb-1">Motion Onset</p>
                                            <p className="text-2xl font-bold">{selectedCreative.structureAnalysis.motionOnsetTiming}ms</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                            <p className="text-xs text-[var(--text-muted)] mb-1">Motion Intensity</p>
                                            <p className="text-2xl font-bold capitalize">{selectedCreative.structureAnalysis.motionIntensity}</p>
                                        </div>
                                    </div>

                                    {/* Attention Breakpoints */}
                                    {selectedCreative.structureAnalysis.attentionBreakpoints.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-sm font-medium text-[var(--text-muted)] mb-2">⚠️ Attention Breakpoints</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedCreative.structureAnalysis.attentionBreakpoints.map((bp, i) => (
                                                    <span key={i} className="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm">
                                                        {bp}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Structural Fixes */}
                                    {selectedCreative.structureAnalysis.structuralFixes.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-[var(--text-muted)] mb-2">🔧 Recommended Fixes</p>
                                            <ul className="space-y-2">
                                                {selectedCreative.structureAnalysis.structuralFixes.map((fix, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm">
                                                        <span className="text-orange-400">→</span>
                                                        {fix}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </GlassCard>
                            )}

                            {/* Conversion Owner Panel */}
                            {selectedCreative.conversionAnalysis && selectedCreative.deliveryHealth === 'healthy' && (
                                <GlassCard className="p-5">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Target size={18} className="text-blue-400" />
                                        Conversion Owner (Business Performance)
                                    </h3>

                                    <div className="grid grid-cols-4 gap-3 mb-4">
                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)] text-center">
                                            <p className="text-xs text-[var(--text-muted)]">CPA</p>
                                            <p className="text-xl font-bold">₱{selectedCreative.conversionAnalysis.cpa}</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)] text-center">
                                            <p className="text-xs text-[var(--text-muted)]">CVR</p>
                                            <p className="text-xl font-bold">{selectedCreative.conversionAnalysis.cvr}%</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)] text-center">
                                            <p className="text-xs text-[var(--text-muted)]">ROAS</p>
                                            <p className="text-xl font-bold text-[var(--success)]">{selectedCreative.conversionAnalysis.roas}x</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)] text-center">
                                            <p className="text-xs text-[var(--text-muted)]">Efficiency</p>
                                            <p className="text-xl font-bold" style={{ color: getScoreColor(selectedCreative.conversionAnalysis.efficiencyScore) }}>
                                                {selectedCreative.conversionAnalysis.efficiencyScore}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Funnel Dropoffs */}
                                    {selectedCreative.conversionAnalysis.funnelDropoffs.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-sm font-medium text-[var(--text-muted)] mb-2">📊 Funnel Analysis</p>
                                            <div className="space-y-2">
                                                {selectedCreative.conversionAnalysis.funnelDropoffs.map((stage, i) => (
                                                    <div key={i} className="flex items-center gap-3">
                                                        <span className="text-sm w-40 text-[var(--text-muted)]">{stage.stage}</span>
                                                        <div className="flex-1 h-3 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${stage.dropRate > 50 ? 'bg-red-500' : stage.dropRate > 30 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                                style={{ width: `${stage.dropRate}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-semibold w-12 text-right">{stage.dropRate}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {selectedCreative.conversionAnalysis.funnelLeakLocation && (
                                                <p className="mt-2 text-sm text-red-400">
                                                    🚨 Leak detected: {selectedCreative.conversionAnalysis.funnelLeakLocation}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Recommendations */}
                                    {selectedCreative.conversionAnalysis.recommendations.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-[var(--text-muted)] mb-2">💡 Recommendations</p>
                                            <ul className="space-y-2">
                                                {selectedCreative.conversionAnalysis.recommendations.map((rec, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm">
                                                        <span className="text-blue-400">→</span>
                                                        {rec}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Confidence Badge */}
                                    <div className="mt-4 pt-4 border-t border-[var(--glass-border)] flex items-center justify-between text-sm">
                                        <span className="text-[var(--text-muted)]">
                                            Sample size: {selectedCreative.conversionAnalysis.sampleSize} conversions
                                        </span>
                                        <span className={`px-3 py-1 rounded-full ${selectedCreative.conversionAnalysis.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                                            selectedCreative.conversionAnalysis.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {selectedCreative.conversionAnalysis.confidence} confidence
                                        </span>
                                    </div>
                                </GlassCard>
                            )}

                            {/* Conversion Owner Locked Message */}
                            {selectedCreative.deliveryHealth !== 'healthy' && (
                                <GlassCard className="p-5 opacity-50">
                                    <div className="flex items-center gap-3 text-[var(--text-muted)]">
                                        <Target size={24} />
                                        <div>
                                            <p className="font-semibold">Conversion Owner System</p>
                                            <p className="text-sm">Waiting for healthy delivery... Fix structure first.</p>
                                        </div>
                                    </div>
                                </GlassCard>
                            )}

                            {/* Narrative Diagnostic Panel */}
                            {selectedCreative.narrativeAnalysis && selectedCreative.deliveryHealth === 'healthy' && selectedCreative.conversionHealth === 'bad' && (
                                <GlassCard className="p-5">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <FileText size={18} className="text-purple-400" />
                                        Narrative Diagnostic (Persuasion)
                                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full ml-auto">Secondary</span>
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-bg)]">
                                                <span className="text-sm">Value Intro Early</span>
                                                {selectedCreative.narrativeAnalysis.valueIntroducedEarly ?
                                                    <CheckCircle size={16} className="text-green-400" /> :
                                                    <AlertCircle size={16} className="text-red-400" />
                                                }
                                            </div>
                                            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-bg)]">
                                                <span className="text-sm">Offer Visible</span>
                                                {selectedCreative.narrativeAnalysis.offerVisible ?
                                                    <CheckCircle size={16} className="text-green-400" /> :
                                                    <AlertCircle size={16} className="text-red-400" />
                                                }
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-bg)]">
                                                <span className="text-sm">CTA Present</span>
                                                {selectedCreative.narrativeAnalysis.ctaPresent ?
                                                    <CheckCircle size={16} className="text-green-400" /> :
                                                    <AlertCircle size={16} className="text-red-400" />
                                                }
                                            </div>
                                            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--glass-bg)]">
                                                <span className="text-sm">LP Alignment</span>
                                                {selectedCreative.narrativeAnalysis.messageLandingPageAligned ?
                                                    <CheckCircle size={16} className="text-green-400" /> :
                                                    <AlertCircle size={16} className="text-red-400" />
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                            <p className="text-[var(--text-muted)]">Primary Angle</p>
                                            <p className="font-semibold">{selectedCreative.narrativeAnalysis.primaryAngle}</p>
                                        </div>
                                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                                            <p className="text-[var(--text-muted)]">Emotional Tone</p>
                                            <p className="font-semibold">{selectedCreative.narrativeAnalysis.emotionalTone}</p>
                                        </div>
                                    </div>

                                    {selectedCreative.narrativeAnalysis.diagnosticNotes.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-[var(--text-muted)] mb-2">📝 Diagnostic Notes</p>
                                            <ul className="space-y-1">
                                                {selectedCreative.narrativeAnalysis.diagnosticNotes.map((note, i) => (
                                                    <li key={i} className="text-sm text-[var(--text-muted)]">• {note}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </GlassCard>
                            )}

                            {/* Next Best Action */}
                            {selectedCreative.nextBestAction && (
                                <GlassCard className="p-5 border-2 border-[var(--accent-primary)]/30">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                        <Lightbulb size={18} className="text-[var(--accent-primary)]" />
                                        Next Best Action
                                        <span className={`text-xs px-2 py-1 rounded-full ml-auto ${selectedCreative.nextBestAction.expectedLearningValue === 'high' ? 'bg-green-500/20 text-green-400' :
                                            selectedCreative.nextBestAction.expectedLearningValue === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-gray-500/20 text-gray-400'
                                            }`}>
                                            {selectedCreative.nextBestAction.expectedLearningValue} learning value
                                        </span>
                                    </h3>

                                    <div className="p-4 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-primary)]/30 mb-4">
                                        <p className="font-bold text-lg text-[var(--accent-primary)] mb-2">
                                            {selectedCreative.nextBestAction.action}
                                        </p>
                                        <p className="text-sm text-[var(--text-muted)]">
                                            <strong>Hypothesis:</strong> {selectedCreative.nextBestAction.hypothesis}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-4 text-sm">
                                        <div>
                                            <p className="text-[var(--text-muted)]">Test Type</p>
                                            <p className="font-semibold capitalize">{selectedCreative.nextBestAction.testType}</p>
                                        </div>
                                        {selectedCreative.nextBestAction.variablesToLock.length > 0 && (
                                            <div className="flex-1">
                                                <p className="text-[var(--text-muted)]">Lock Variables</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {selectedCreative.nextBestAction.variablesToLock.map((v, i) => (
                                                        <span key={i} className="px-2 py-0.5 rounded bg-[var(--glass-bg)] text-xs">
                                                            {v}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button className="w-full mt-4 py-3 px-4 rounded-xl bg-[var(--accent-primary)] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[var(--accent-primary)]/80 transition-colors">
                                        <Zap size={18} />
                                        Execute: {selectedCreative.nextBestAction.action.split(' - ')[0]}
                                    </button>
                                </GlassCard>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Upload Creative Modal */}
        <UploadCreativeModal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            onCreativeExtracted={handleCreativeExtracted}
        />
    </div>
);
}
