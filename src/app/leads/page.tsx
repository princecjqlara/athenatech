'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Activity,
    Search,
    Plus,
    Mail,
    Phone,
    Calendar,
    ChevronRight,
    Filter,
    MoreVertical,
    ArrowUpDown,
    Eye,
    Edit,
    Trash2,
    Send,
    X,
    Zap,
    Settings,
    GripVertical,
    Sparkles,
    Check,
    RefreshCw,
    CheckSquare,
    Square,
    AlertTriangle
} from 'lucide-react';
import { Sidebar } from '@/components/ui/Sidebar';
import { GlassCard } from '@/components/ui/GlassCard';
import { AIChatWidget } from '@/components/ui/AIChatWidget';
import { useAuth } from '@/lib/auth';

// Types
interface Tag {
    id: string;
    name: string;
    color: string;
}

interface ConversationContext {
    lastMessage: string;
    lastMessageAt: string;
    messageCount: number;
    aiSummary?: string;
    // Detailed AI Analysis
    sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
    intent?: string;
    topics?: string[];
    nextAction?: string;
    engagementScore?: number; // 0-100
    painPoints?: string[];
    objections?: string[];
}

interface ExtraContactDetails {
    age?: number;
    birthday?: string;
    occupation?: string;
    income?: string;
    interests?: string[];
    preferredContact?: 'email' | 'phone' | 'messenger' | 'whatsapp';
    timezone?: string;
    language?: string;
    socialProfiles?: { platform: string; url: string }[];
    customFields?: { label: string; value: string }[];
}

interface Lead {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
    source: string;
    createdAt: string;
    value?: number;
    // Extended fields
    tags?: Tag[];
    owner?: string;
    pageLink?: string;
    facebookId?: string;
    address?: string;
    company?: string;
    notes?: string;
    lastContactedAt?: string;
    conversationContext?: ConversationContext;
    extraDetails?: ExtraContactDetails;
    // Ad Account Source
    adAccountId?: string;
    adAccountName?: string;
    campaignId?: string;
    campaignName?: string;
    adId?: string;
    adName?: string;
}

interface StageEvent {
    id: string;
    name: string;
    type: 'email' | 'sms' | 'webhook' | 'capi';
    enabled: boolean;
}

interface PipelineStage {
    id: string;
    name: string;
    color: string;
    leads: Lead[];
    events: StageEvent[];
}

// Stage-specific default events based on purpose
const getDefaultEventsForStage = (stageId: string): StageEvent[] => {
    switch (stageId) {
        case 'new':
            return [
                { id: 'email', name: 'Welcome Email', type: 'email', enabled: true },
                { id: 'sms', name: 'Send SMS', type: 'sms', enabled: false },
                { id: 'webhook', name: 'Fire Webhook', type: 'webhook', enabled: false },
                { id: 'capi', name: 'Fire Lead Event', type: 'capi', enabled: true },
            ];
        case 'contacted':
            return [
                { id: 'email', name: 'Follow-up Email', type: 'email', enabled: true },
                { id: 'sms', name: 'SMS Reminder', type: 'sms', enabled: true },
                { id: 'webhook', name: 'Fire Webhook', type: 'webhook', enabled: false },
                { id: 'capi', name: 'Fire Contact Event', type: 'capi', enabled: false },
            ];
        case 'qualified':
            return [
                { id: 'email', name: 'Proposal Email', type: 'email', enabled: true },
                { id: 'sms', name: 'Send SMS', type: 'sms', enabled: false },
                { id: 'webhook', name: 'Notify Sales Team', type: 'webhook', enabled: true },
                { id: 'capi', name: 'Fire Qualified Event', type: 'capi', enabled: false },
            ];
        case 'converted':
            return [
                { id: 'email', name: 'Thank You Email', type: 'email', enabled: true },
                { id: 'sms', name: 'Confirmation SMS', type: 'sms', enabled: true },
                { id: 'webhook', name: 'Fire Webhook', type: 'webhook', enabled: true },
                { id: 'capi', name: 'Fire Purchase Event', type: 'capi', enabled: true },
            ];
        case 'lost':
            return [
                { id: 'email', name: 'Re-engagement Email', type: 'email', enabled: false },
                { id: 'sms', name: 'Send SMS', type: 'sms', enabled: false },
                { id: 'webhook', name: 'Fire Webhook', type: 'webhook', enabled: false },
                { id: 'capi', name: 'Fire Lost Event', type: 'capi', enabled: false },
            ];
        default:
            return [
                { id: 'email', name: 'Send Email', type: 'email', enabled: false },
                { id: 'sms', name: 'Send SMS', type: 'sms', enabled: false },
                { id: 'webhook', name: 'Fire Webhook', type: 'webhook', enabled: false },
                { id: 'capi', name: 'Fire CAPI Event', type: 'capi', enabled: false },
            ];
    }
};

// Available tags
const availableTags: Tag[] = [
    { id: 'hot', name: 'Hot Lead', color: '#FF6B6B' },
    { id: 'vip', name: 'VIP', color: '#FFD93D' },
    { id: 'followup', name: 'Follow Up', color: '#6BCB77' },
    { id: 'demo', name: 'Demo Scheduled', color: '#4D96FF' },
    { id: 'proposal', name: 'Proposal Sent', color: '#9B59B6' },
    { id: 'cold', name: 'Cold Lead', color: '#95A5A6' },
];

const createInitialPipelineStages = (): PipelineStage[] => [
    { id: 'new', name: 'New Leads', color: '#87CEEB', leads: [], events: getDefaultEventsForStage('new') },
    { id: 'contacted', name: 'Contacted', color: '#FFD580', leads: [], events: getDefaultEventsForStage('contacted') },
    { id: 'qualified', name: 'Qualified', color: '#90EE90', leads: [], events: getDefaultEventsForStage('qualified') },
    { id: 'converted', name: 'Converted', color: '#98FB98', leads: [], events: getDefaultEventsForStage('converted') },
    { id: 'lost', name: 'Lost', color: '#FFB6C1', leads: [], events: getDefaultEventsForStage('lost') },
];

const statusColors: Record<Lead['status'], string> = {
    new: '#87CEEB',
    contacted: '#FFD580',
    qualified: '#90EE90',
    converted: '#98FB98',
    lost: '#FFB6C1',
};

// Pipeline Templates Configuration
interface PipelineTemplate {
    id: string;
    name: string;
    description: string;
    emoji: string;
    stages: Array<{
        id: string;
        name: string;
        color: string;
        metaEvent: string | null;  // null = no event fires
        isGoalStage: boolean;       // true = AI won't auto-move leads here
    }>;
}

const PIPELINE_TEMPLATES: PipelineTemplate[] = [
    {
        id: 'universal',
        name: 'Universal Default',
        description: 'Standard pipeline for most businesses',
        emoji: '📋',
        stages: [
            { id: 'new_lead', name: 'New Leads', color: '#87CEEB', metaEvent: null, isGoalStage: false },
            { id: 'contacted', name: 'Contacted', color: '#FFD580', metaEvent: null, isGoalStage: false },
            { id: 'qualified', name: 'Qualified', color: '#90EE90', metaEvent: 'Lead', isGoalStage: false },
            { id: 'converted', name: 'Converted', color: '#98FB98', metaEvent: 'Purchase', isGoalStage: true },
            { id: 'lost', name: 'Lost', color: '#FFB6C1', metaEvent: null, isGoalStage: true },
        ],
    },
    {
        id: 'appointment',
        name: 'Appointment Business',
        description: 'Doctors, clinics, test drives - no upfront payment',
        emoji: '📅',
        stages: [
            { id: 'new_lead', name: 'New Leads', color: '#87CEEB', metaEvent: null, isGoalStage: false },
            { id: 'contacted', name: 'Contacted', color: '#FFD580', metaEvent: null, isGoalStage: false },
            { id: 'qualified', name: 'Qualified', color: '#90EE90', metaEvent: 'Lead', isGoalStage: false },
            { id: 'appointment_set', name: 'Appointment Set', color: '#DDA0DD', metaEvent: 'Schedule', isGoalStage: false },
            { id: 'converted', name: 'Completed', color: '#98FB98', metaEvent: null, isGoalStage: true },
            { id: 'lost', name: 'Lost', color: '#FFB6C1', metaEvent: null, isGoalStage: true },
        ],
    },
    {
        id: 'high_ticket',
        name: 'High-Ticket B2B',
        description: 'Real estate, solar, long sales cycles',
        emoji: '💎',
        stages: [
            { id: 'new_lead', name: 'New Leads', color: '#87CEEB', metaEvent: null, isGoalStage: false },
            { id: 'contacted', name: 'Contacted', color: '#FFD580', metaEvent: null, isGoalStage: false },
            { id: 'qualified', name: 'Qualified', color: '#90EE90', metaEvent: 'Lead', isGoalStage: false },
            { id: 'proposal_sent', name: 'Proposal Sent', color: '#87CEEB', metaEvent: null, isGoalStage: false },
            { id: 'converted', name: 'Deal Closed', color: '#98FB98', metaEvent: 'Purchase', isGoalStage: true },
            { id: 'lost', name: 'Lost', color: '#FFB6C1', metaEvent: null, isGoalStage: true },
        ],
    },
    {
        id: 'education',
        name: 'Education & Enrollment',
        description: 'Courses, bootcamps, universities',
        emoji: '🎓',
        stages: [
            { id: 'new_lead', name: 'Inquiries', color: '#87CEEB', metaEvent: null, isGoalStage: false },
            { id: 'contacted', name: 'Contacted', color: '#FFD580', metaEvent: null, isGoalStage: false },
            { id: 'qualified', name: 'Qualified', color: '#90EE90', metaEvent: 'Lead', isGoalStage: false },
            { id: 'enrolled', name: 'Enrolled', color: '#DDA0DD', metaEvent: 'CompleteRegistration', isGoalStage: false },
            { id: 'converted', name: 'Paid', color: '#98FB98', metaEvent: 'Purchase', isGoalStage: true },
            { id: 'lost', name: 'Lost', color: '#FFB6C1', metaEvent: null, isGoalStage: true },
        ],
    },
    {
        id: 'ecommerce',
        name: 'Human-Assisted E-commerce',
        description: 'WhatsApp checkout, manual invoicing',
        emoji: '🛒',
        stages: [
            { id: 'new_lead', name: 'New Orders', color: '#87CEEB', metaEvent: null, isGoalStage: false },
            { id: 'qualified', name: 'Confirmed', color: '#90EE90', metaEvent: 'Lead', isGoalStage: false },
            { id: 'payment_pending', name: 'Payment Pending', color: '#FFD580', metaEvent: null, isGoalStage: false },
            { id: 'converted', name: 'Paid', color: '#98FB98', metaEvent: 'Purchase', isGoalStage: true },
            { id: 'lost', name: 'Cancelled', color: '#FFB6C1', metaEvent: null, isGoalStage: true },
        ],
    },
];

// AI Suggestion types
interface AISuggestion {
    leadId: string;
    leadName: string;
    currentStage: string;
    suggestedStage: string;
    reason: string;
    confidence: number;  // 0-100
}

// AI Activity Log
interface AIActivityLog {
    id: string;
    timestamp: string;
    action: 'stage_transfer' | 'info_update' | 'message_analysis' | 'tag_added';
    leadId: string;
    leadName: string;
    details: string;
    fromValue?: string;
    toValue?: string;
}

// Lead Details Modal Component with Edit/Delete
function LeadDetailsModal({
    lead,
    onClose,
    onEdit,
    onDelete,
    onAddTag,
    onRemoveTag,
    allTags,
    onUpdateConversationContext
}: {
    lead: Lead;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onAddTag: (tagId: string) => void;
    onRemoveTag: (tagId: string) => void;
    allTags: Tag[];
    onUpdateConversationContext?: (context: ConversationContext) => void;
}) {
    const [showTagPicker, setShowTagPicker] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const handleAnalyzeConversation = async () => {
        setIsAnalyzing(true);
        setAiError(null);

        try {
            const response = await fetch('/api/ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'analyze_lead_conversation',
                    data: {
                        leadName: lead.name,
                        conversationHistory: lead.conversationContext?.lastMessage
                            ? [lead.conversationContext.lastMessage]
                            : ['Initial contact - no conversation history yet'],
                        currentStage: lead.status,
                        leadSource: lead.source,
                        adAccountName: lead.adAccountName,
                    }
                })
            });

            const result = await response.json();

            if (result.success && result.analysis && onUpdateConversationContext) {
                // Update the lead's conversation context with AI analysis
                const updatedContext: ConversationContext = {
                    ...lead.conversationContext,
                    lastMessage: lead.conversationContext?.lastMessage || '',
                    lastMessageAt: lead.conversationContext?.lastMessageAt || new Date().toISOString(),
                    messageCount: lead.conversationContext?.messageCount || 1,
                    aiSummary: result.analysis.summary,
                    sentiment: result.analysis.sentiment,
                    intent: result.analysis.intent,
                    topics: result.analysis.topics,
                    nextAction: result.analysis.nextAction,
                    engagementScore: result.analysis.engagementScore,
                    painPoints: result.analysis.painPoints,
                    objections: result.analysis.objections,
                };
                onUpdateConversationContext(updatedContext);
            } else {
                setAiError(result.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('AI analysis error:', error);
            setAiError('Failed to connect to AI service');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Edit/Delete */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Lead Details</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAnalyzeConversation}
                            disabled={isAnalyzing}
                            className="btn-secondary py-2 px-3 flex items-center gap-1 bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                        >
                            {isAnalyzing ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    AI Analyze
                                </>
                            )}
                        </button>
                        <button onClick={onEdit} className="btn-secondary py-2 px-3 flex items-center gap-1">
                            <Edit size={14} />
                            Edit
                        </button>
                        <button onClick={onDelete} className="btn-icon w-9 h-9 text-red-400 hover:bg-red-500/10">
                            <Trash2 size={16} />
                        </button>
                        <button onClick={onClose} className="btn-icon w-9 h-9">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* AI Error Alert */}
                {aiError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between">
                        <span>{aiError}</span>
                        <button onClick={() => setAiError(null)} className="hover:text-white">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Lead Name & Status */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-2xl font-bold">
                        {lead.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">{lead.name}</h3>
                        {lead.company && <p className="text-sm text-[var(--text-muted)]">{lead.company}</p>}
                        <div className="flex items-center gap-2 mt-1">
                            <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ backgroundColor: statusColors[lead.status] + '30', color: statusColors[lead.status] }}
                            >
                                {lead.status.toUpperCase()}
                            </span>
                            {lead.value && lead.status === 'converted' && (
                                <span className="text-sm font-medium text-green-400">₱{lead.value.toLocaleString()}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tags */}
                <div className="mb-6">
                    <div className="text-xs text-[var(--text-muted)] mb-2">TAGS</div>
                    <div className="flex flex-wrap gap-2">
                        {lead.tags?.map(tag => (
                            <span
                                key={tag.id}
                                className="px-2 py-1 rounded-full text-xs flex items-center gap-1"
                                style={{ backgroundColor: tag.color + '30', color: tag.color }}
                            >
                                {tag.name}
                                <button onClick={() => onRemoveTag(tag.id)} className="hover:text-white">
                                    <X size={10} />
                                </button>
                            </span>
                        ))}
                        <button
                            onClick={() => setShowTagPicker(!showTagPicker)}
                            className="px-2 py-1 rounded-full text-xs bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--accent-primary)]"
                        >
                            + Add Tag
                        </button>
                    </div>
                    {showTagPicker && (
                        <div className="mt-2 p-2 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                            <div className="flex flex-wrap gap-1">
                                {allTags.filter(t => !lead.tags?.some(lt => lt.id === t.id)).map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => { onAddTag(tag.id); setShowTagPicker(false); }}
                                        className="px-2 py-1 rounded-full text-xs hover:opacity-80"
                                        style={{ backgroundColor: tag.color + '30', color: tag.color }}
                                    >
                                        {tag.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Contact Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                        <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-1">
                            <Mail size={12} /> EMAIL
                        </div>
                        <div className="text-sm">{lead.email}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                        <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs mb-1">
                            <Phone size={12} /> PHONE
                        </div>
                        <div className="text-sm">{lead.phone}</div>
                    </div>
                    {lead.owner && (
                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                            <div className="text-[var(--text-muted)] text-xs mb-1">OWNER</div>
                            <div className="text-sm">{lead.owner}</div>
                        </div>
                    )}
                    <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                        <div className="text-[var(--text-muted)] text-xs mb-1">SOURCE</div>
                        <div className="text-sm">{lead.source}</div>
                    </div>
                    {lead.pageLink && (
                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                            <div className="text-[var(--text-muted)] text-xs mb-1">FACEBOOK PAGE</div>
                            <a href={lead.pageLink} target="_blank" className="text-sm text-[var(--accent-primary)] hover:underline truncate block">
                                {lead.pageLink}
                            </a>
                        </div>
                    )}
                    {lead.address && (
                        <div className="p-3 rounded-lg bg-[var(--glass-bg)]">
                            <div className="text-[var(--text-muted)] text-xs mb-1">ADDRESS</div>
                            <div className="text-sm">{lead.address}</div>
                        </div>
                    )}
                </div>

                {/* Ad Account Source */}
                {(lead.adAccountName || lead.campaignName || lead.adName) && (
                    <div className="mb-6">
                        <div className="text-xs text-[var(--text-muted)] mb-2 flex items-center gap-2">
                            <Activity size={12} className="text-blue-400" /> AD SOURCE
                        </div>
                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-3">
                            {lead.adAccountName && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-[var(--text-muted)]">Ad Account</span>
                                    <span className="text-sm font-medium text-blue-300">{lead.adAccountName}</span>
                                </div>
                            )}
                            {lead.campaignName && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-[var(--text-muted)]">Campaign</span>
                                    <span className="text-sm text-blue-200">{lead.campaignName}</span>
                                </div>
                            )}
                            {lead.adName && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-[var(--text-muted)]">Ad</span>
                                    <span className="text-sm text-blue-200">{lead.adName}</span>
                                </div>
                            )}
                            {lead.adAccountId && (
                                <div className="text-xs text-[var(--text-muted)] pt-2 border-t border-blue-500/20">
                                    Account ID: {lead.adAccountId}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {lead.conversationContext && (
                    <div className="mb-6">
                        <div className="text-xs text-[var(--text-muted)] mb-2 flex items-center gap-2">
                            <Sparkles size={12} className="text-purple-400" /> AI CONVERSATION ANALYSIS
                        </div>
                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-4">
                            {/* Summary */}
                            {lead.conversationContext.aiSummary && (
                                <p className="text-sm text-purple-200">{lead.conversationContext.aiSummary}</p>
                            )}

                            {/* Metrics Row */}
                            <div className="flex flex-wrap gap-3">
                                {lead.conversationContext.sentiment && (
                                    <div className={`px-2 py-1 rounded-full text-xs ${lead.conversationContext.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                                        lead.conversationContext.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                                            lead.conversationContext.sentiment === 'mixed' ? 'bg-yellow-500/20 text-yellow-400' :
                                                'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        {lead.conversationContext.sentiment.toUpperCase()}
                                    </div>
                                )}
                                {lead.conversationContext.engagementScore !== undefined && (
                                    <div className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">
                                        Engagement: {lead.conversationContext.engagementScore}%
                                    </div>
                                )}
                                <div className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400">
                                    {lead.conversationContext.messageCount} messages
                                </div>
                            </div>

                            {/* Intent & Next Action */}
                            {(lead.conversationContext.intent || lead.conversationContext.nextAction) && (
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    {lead.conversationContext.intent && (
                                        <div className="p-2 rounded bg-[var(--glass-bg)]">
                                            <div className="text-[var(--text-muted)] mb-1">Intent</div>
                                            <div>{lead.conversationContext.intent}</div>
                                        </div>
                                    )}
                                    {lead.conversationContext.nextAction && (
                                        <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
                                            <div className="text-green-400 mb-1">Next Action</div>
                                            <div className="text-green-300">{lead.conversationContext.nextAction}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Topics */}
                            {lead.conversationContext.topics && lead.conversationContext.topics.length > 0 && (
                                <div>
                                    <div className="text-xs text-[var(--text-muted)] mb-1">Topics Discussed</div>
                                    <div className="flex flex-wrap gap-1">
                                        {lead.conversationContext.topics.map((topic, i) => (
                                            <span key={i} className="px-2 py-0.5 rounded text-xs bg-[var(--glass-bg)]">{topic}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pain Points & Objections */}
                            {(lead.conversationContext.painPoints || lead.conversationContext.objections) && (
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    {lead.conversationContext.painPoints && (
                                        <div>
                                            <div className="text-orange-400 mb-1">Pain Points</div>
                                            <ul className="space-y-1">
                                                {lead.conversationContext.painPoints.map((p, i) => (
                                                    <li key={i} className="text-orange-200">• {p}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {lead.conversationContext.objections && (
                                        <div>
                                            <div className="text-red-400 mb-1">Objections</div>
                                            <ul className="space-y-1">
                                                {lead.conversationContext.objections.map((o, i) => (
                                                    <li key={i} className="text-red-200">• {o}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Last Message */}
                            {lead.conversationContext.lastMessage && (
                                <div className="p-2 rounded bg-[var(--glass-bg)] text-xs italic">
                                    "{lead.conversationContext.lastMessage}"
                                    <span className="text-[var(--text-muted)] ml-2">— {lead.conversationContext.lastMessageAt}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Extra Contact Details */}
                {lead.extraDetails && (
                    <div className="mb-6">
                        <div className="text-xs text-[var(--text-muted)] mb-2">ADDITIONAL DETAILS</div>
                        <div className="p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                            <div className="grid grid-cols-3 gap-3 text-xs">
                                {lead.extraDetails.age && (
                                    <div><span className="text-[var(--text-muted)]">Age:</span> {lead.extraDetails.age}</div>
                                )}
                                {lead.extraDetails.occupation && (
                                    <div><span className="text-[var(--text-muted)]">Occupation:</span> {lead.extraDetails.occupation}</div>
                                )}
                                {lead.extraDetails.income && (
                                    <div><span className="text-[var(--text-muted)]">Income:</span> {lead.extraDetails.income}</div>
                                )}
                                {lead.extraDetails.preferredContact && (
                                    <div><span className="text-[var(--text-muted)]">Preferred:</span> {lead.extraDetails.preferredContact}</div>
                                )}
                                {lead.extraDetails.timezone && (
                                    <div><span className="text-[var(--text-muted)]">Timezone:</span> {lead.extraDetails.timezone}</div>
                                )}
                                {lead.extraDetails.language && (
                                    <div><span className="text-[var(--text-muted)]">Language:</span> {lead.extraDetails.language}</div>
                                )}
                            </div>
                            {lead.extraDetails.interests && lead.extraDetails.interests.length > 0 && (
                                <div className="mt-3">
                                    <div className="text-xs text-[var(--text-muted)] mb-1">Interests</div>
                                    <div className="flex flex-wrap gap-1">
                                        {lead.extraDetails.interests.map((interest, i) => (
                                            <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">{interest}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {lead.extraDetails.customFields && lead.extraDetails.customFields.length > 0 && (
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    {lead.extraDetails.customFields.map((field, i) => (
                                        <div key={i} className="text-xs">
                                            <span className="text-[var(--text-muted)]">{field.label}:</span> {field.value}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Notes */}
                {lead.notes && (
                    <div className="mb-6">
                        <div className="text-xs text-[var(--text-muted)] mb-2">NOTES</div>
                        <div className="p-3 rounded-lg bg-[var(--glass-bg)] text-sm">{lead.notes}</div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--glass-border)]">
                    <span>Created: {lead.createdAt}</span>
                    {lead.lastContactedAt && <span>Last Contact: {lead.lastContactedAt}</span>}
                </div>
            </motion.div>
        </motion.div>
    );
}

// Edit Lead Modal Component
function EditLeadModal({
    lead,
    onClose,
    onSave
}: {
    lead: Lead;
    onClose: () => void;
    onSave: (updatedLead: Lead) => void;
}) {
    const [formData, setFormData] = useState({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company || '',
        owner: lead.owner || '',
        address: lead.address || '',
        notes: lead.notes || '',
        value: lead.value || 0,
    });

    const handleSave = () => {
        onSave({ ...lead, ...formData });
        onClose();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-6 max-w-md w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Edit Lead</h2>
                    <button onClick={onClose} className="btn-icon w-8 h-8">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-[var(--text-muted)] block mb-1">Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="input w-full"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="input w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1">Phone</label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="input w-full"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1">Company</label>
                            <input
                                type="text"
                                value={formData.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                className="input w-full"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-[var(--text-muted)] block mb-1">Owner</label>
                            <input
                                type="text"
                                value={formData.owner}
                                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                                className="input w-full"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-[var(--text-muted)] block mb-1">Value (₱)</label>
                        <input
                            type="number"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                            className="input w-full"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-[var(--text-muted)] block mb-1">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="input w-full h-20 resize-none"
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={handleSave} className="btn-primary flex-1">Save Changes</button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Stage Events Modal Component
function StageEventsModal({ stage, onClose, onSave }: {
    stage: PipelineStage;
    onClose: () => void;
    onSave: (stageId: string, events: StageEvent[]) => void;
}) {
    const [events, setEvents] = useState<StageEvent[]>(stage.events);

    const toggleEvent = (eventId: string) => {
        setEvents(events.map(e =>
            e.id === eventId ? { ...e, enabled: !e.enabled } : e
        ));
    };

    const handleSave = () => {
        onSave(stage.id, events);
        onClose();
    };

    const getEventIcon = (type: StageEvent['type']) => {
        switch (type) {
            case 'email': return <Mail size={18} />;
            case 'sms': return <Phone size={18} />;
            case 'webhook': return <Zap size={18} />;
            case 'capi': return <Send size={18} />;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-6 max-w-md w-full shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: stage.color }}
                        />
                        <h2 className="text-xl font-bold">{stage.name} Events</h2>
                    </div>
                    <button onClick={onClose} className="btn-icon w-8 h-8">
                        <X size={18} />
                    </button>
                </div>

                <p className="text-sm text-[var(--text-muted)] mb-4">
                    Events that fire when a lead enters this stage
                </p>

                <div className="space-y-3">
                    {events.map((event) => (
                        <div
                            key={event.id}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${event.enabled
                                ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)]/30'
                                : 'bg-[var(--glass-bg)] border-[var(--glass-border)] hover:border-[var(--accent-primary)]/20'
                                }`}
                            onClick={() => toggleEvent(event.id)}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`${event.enabled ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                                    {getEventIcon(event.type)}
                                </div>
                                <div>
                                    <div className="font-medium">{event.name}</div>
                                    <div className="text-xs text-[var(--text-muted)] capitalize">{event.type}</div>
                                </div>
                            </div>
                            <div
                                className={`w-12 h-6 rounded-full transition-all relative ${event.enabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--glass-border)]'
                                    }`}
                            >
                                <div
                                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${event.enabled ? 'left-7' : 'left-1'
                                        }`}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="btn-secondary flex-1">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="btn-primary flex-1">
                        Save Changes
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// Dropdown Menu Component
function LeadDropdownMenu({ lead, onViewDetails, onEdit, onDelete }: {
    lead: Lead;
    onViewDetails: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                className="btn-icon w-8 h-8"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
            >
                <MoreVertical size={16} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl shadow-2xl z-50 overflow-hidden"
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewDetails();
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--accent-soft)] transition-colors"
                        >
                            <Eye size={16} className="text-[var(--accent-primary)]" />
                            <span>View Details</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--accent-soft)] transition-colors"
                        >
                            <Edit size={16} className="text-[var(--text-muted)]" />
                            <span>Edit Lead</span>
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                                setIsOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-500/10 transition-colors text-red-400"
                        >
                            <Trash2 size={16} />
                            <span>Delete Lead</span>
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Draggable Lead Card Component
function DraggableLeadCard({
    lead,
    stageColor,
    onDragStart,
    onClick
}: {
    lead: Lead;
    stageColor: string;
    onDragStart: (e: React.DragEvent, lead: Lead) => void;
    onClick: () => void;
}) {
    const [isDragging, setIsDragging] = useState(false);

    return (
        <div
            draggable
            onDragStart={(e) => {
                setIsDragging(true);
                onDragStart(e, lead);
            }}
            onDragEnd={() => setIsDragging(false)}
            onClick={onClick}
            className={`p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] cursor-grab hover:border-[var(--accent-primary)]/30 transition-all group ${isDragging ? 'opacity-50 scale-95' : ''
                }`}
        >
            <div className="flex items-start gap-2">
                <GripVertical size={14} className="text-[var(--text-muted)] mt-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{lead.name}</div>
                    <div className="text-xs text-[var(--text-muted)] truncate mt-1">
                        {lead.email}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        {lead.status === 'converted' && lead.value ? (
                            <span className="text-sm font-medium" style={{ color: stageColor }}>
                                ₱{lead.value.toLocaleString()}
                            </span>
                        ) : (
                            <span className="text-sm text-[var(--text-muted)]">—</span>
                        )}
                        <span className="text-xs text-[var(--text-muted)] truncate ml-2">
                            {lead.source}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LeadsPage() {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'leads' | 'pipelines'>('leads');
    const [searchQuery, setSearchQuery] = useState('');
    const [pipelineSearchQuery, setPipelineSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<Lead['status'] | 'all'>('all');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);
    const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(createInitialPipelineStages());
    const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
    const [dragOverStage, setDragOverStage] = useState<string | null>(null);

    // Advanced Filters
    const [tagFilter, setTagFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'recently_edited' | 'value_high' | 'value_low' | 'name'>('newest');
    const [sourceFilter, setSourceFilter] = useState<string>('all');

    // Date Filters
    const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'range'>('all');
    const [dateRangeStart, setDateRangeStart] = useState<string>('');
    const [dateRangeEnd, setDateRangeEnd] = useState<string>('');

    // Pipeline Type & Settings
    const [selectedPipelineType, setSelectedPipelineType] = useState<string>('universal');
    const [showPipelineSettings, setShowPipelineSettings] = useState(false);
    const [customStages, setCustomStages] = useState<Array<{ id: string; name: string; color: string }>>([]);
    const [newStageName, setNewStageName] = useState('');

    // AI Suggestions
    const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
    const [showAiSuggestions, setShowAiSuggestions] = useState(false);

    // Edit/Delete Lead
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<Lead | null>(null);
    const [allLeads, setAllLeads] = useState<Lead[]>([]);
    const [leadsLoading, setLeadsLoading] = useState(true);

    // Bulk Delete State
    const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // AI Activity Log
    const [aiActivityLog, setAiActivityLog] = useState<AIActivityLog[]>([]);
    const [showAiHistory, setShowAiHistory] = useState(false);

    // Fetch leads from database on mount
    useEffect(() => {
        const fetchLeads = async () => {
            if (!profile?.id) {
                setLeadsLoading(false);
                return;
            }

            try {
                const response = await fetch(`/api/meta/leads?user_id=${profile.id}`);
                if (response.ok) {
                    const data = await response.json();
                    const leads: Lead[] = (data.leads || []).map((lead: Record<string, unknown>) => ({
                        id: lead.id as string,
                        name: (lead.name as string) || 'Unknown',
                        email: (lead.email as string) || '',
                        phone: (lead.phone as string) || '',
                        status: (lead.status as Lead['status']) || 'new',
                        source: 'Meta Lead Ads',
                        createdAt: lead.created_time ? new Date(lead.created_time as string).toLocaleDateString() : new Date().toLocaleDateString(),
                        value: 0,
                        campaignId: lead.campaign_id as string | undefined,
                        adId: lead.ad_id as string | undefined,
                    }));
                    setAllLeads(leads);
                    // Update pipeline stages with fetched leads
                    setPipelineStages(stages => stages.map(s => ({
                        ...s,
                        leads: leads.filter(l => l.status === s.id)
                    })));
                }
            } catch (error) {
                console.error('Error fetching leads:', error);
            } finally {
                setLeadsLoading(false);
            }
        };
        fetchLeads();
    }, [profile?.id]);

    // Lead CRUD handlers
    const handleUpdateLead = (updatedLead: Lead) => {
        setAllLeads(leads => leads.map(l => l.id === updatedLead.id ? updatedLead : l));
        setPipelineStages(stages => stages.map(s => ({
            ...s,
            leads: s.leads.map(l => l.id === updatedLead.id ? updatedLead : l)
        })));
        setSelectedLead(updatedLead);
        // Log AI activity
        setAiActivityLog(log => [{
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString(),
            action: 'info_update',
            leadId: updatedLead.id,
            leadName: updatedLead.name,
            details: 'Lead info updated',
        }, ...log]);
    };

    const handleDeleteLead = (leadId: string) => {
        const lead = allLeads.find(l => l.id === leadId);
        setAllLeads(leads => leads.filter(l => l.id !== leadId));
        setPipelineStages(stages => stages.map(s => ({
            ...s,
            leads: s.leads.filter(l => l.id !== leadId)
        })));
        setSelectedLead(null);
        setShowDeleteConfirm(null);
        // Log AI activity
        if (lead) {
            setAiActivityLog(log => [{
                id: Date.now().toString(),
                timestamp: new Date().toLocaleString(),
                action: 'info_update',
                leadId: leadId,
                leadName: lead.name,
                details: 'Lead deleted',
            }, ...log]);
        }
    };

    const handleAddTagToLead = (leadId: string, tagId: string) => {
        const tag = availableTags.find(t => t.id === tagId);
        if (!tag) return;
        setAllLeads(leads => leads.map(l => {
            if (l.id === leadId) {
                return { ...l, tags: [...(l.tags || []), tag] };
            }
            return l;
        }));
        setPipelineStages(stages => stages.map(s => ({
            ...s,
            leads: s.leads.map(l => l.id === leadId ? { ...l, tags: [...(l.tags || []), tag] } : l)
        })));
        if (selectedLead?.id === leadId) {
            setSelectedLead(prev => prev ? { ...prev, tags: [...(prev.tags || []), tag] } : null);
        }
        // Log AI activity
        const lead = allLeads.find(l => l.id === leadId);
        setAiActivityLog(log => [{
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString(),
            action: 'tag_added',
            leadId: leadId,
            leadName: lead?.name || '',
            details: `Tag added: ${tag.name}`,
            toValue: tag.name,
        }, ...log]);
    };

    const handleRemoveTagFromLead = (leadId: string, tagId: string) => {
        setAllLeads(leads => leads.map(l => {
            if (l.id === leadId) {
                return { ...l, tags: (l.tags || []).filter(t => t.id !== tagId) };
            }
            return l;
        }));
        setPipelineStages(stages => stages.map(s => ({
            ...s,
            leads: s.leads.map(l => l.id === leadId ? { ...l, tags: (l.tags || []).filter(t => t.id !== tagId) } : l)
        })));
        if (selectedLead?.id === leadId) {
            setSelectedLead(prev => prev ? { ...prev, tags: (prev.tags || []).filter(t => t.id !== tagId) } : null);
        }
    };

    // Bulk Delete Handlers
    const toggleLeadSelection = (leadId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedLeadIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(leadId)) {
                newSet.delete(leadId);
            } else {
                newSet.add(leadId);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedLeadIds.size === filteredLeads.length) {
            setSelectedLeadIds(new Set());
        } else {
            setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedLeadIds.size === 0) return;

        setIsBulkDeleting(true);

        // Remove leads locally
        const idsToDelete = Array.from(selectedLeadIds);
        const deletedLeadNames = allLeads.filter(l => idsToDelete.includes(l.id)).map(l => l.name);

        setAllLeads(leads => leads.filter(l => !selectedLeadIds.has(l.id)));
        setPipelineStages(stages => stages.map(s => ({
            ...s,
            leads: s.leads.filter(l => !selectedLeadIds.has(l.id))
        })));

        // Log AI activity
        setAiActivityLog(log => [{
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString(),
            action: 'info_update',
            leadId: 'bulk',
            leadName: `${idsToDelete.length} leads`,
            details: `Bulk deleted: ${deletedLeadNames.slice(0, 3).join(', ')}${deletedLeadNames.length > 3 ? ` and ${deletedLeadNames.length - 3} more` : ''}`,
        }, ...log]);

        // Clear selection and close modal
        setSelectedLeadIds(new Set());
        setShowBulkDeleteConfirm(false);
        setIsBulkDeleting(false);
    };

    const clearSelection = () => {
        setSelectedLeadIds(new Set());
    };

    // Load saved pipeline type from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('athena-pipeline-type');
        if (saved) setSelectedPipelineType(saved);
        const savedCustom = localStorage.getItem('athena-custom-stages');
        if (savedCustom) {
            try { setCustomStages(JSON.parse(savedCustom)); } catch { }
        }
    }, []);

    // Save pipeline type to localStorage
    useEffect(() => {
        localStorage.setItem('athena-pipeline-type', selectedPipelineType);
    }, [selectedPipelineType]);

    // Get current template
    const currentTemplate = useMemo(() =>
        PIPELINE_TEMPLATES.find(t => t.id === selectedPipelineType) || PIPELINE_TEMPLATES[0]
        , [selectedPipelineType]);

    // Generate AI suggestions (simulated)
    const generateAISuggestions = () => {
        const suggestions: AISuggestion[] = [];
        pipelineStages.forEach(stage => {
            const template = currentTemplate.stages.find(s => s.id === stage.id);
            // AI won't suggest moving to goal stages (converted/lost)
            if (template?.isGoalStage) return;

            const nextStageIndex = currentTemplate.stages.findIndex(s => s.id === stage.id) + 1;
            const nextStage = currentTemplate.stages[nextStageIndex];

            // Don't suggest if next stage is a goal stage
            if (!nextStage || nextStage.isGoalStage) return;

            stage.leads.forEach(lead => {
                // Simulate AI decision based on lead data
                if (Math.random() > 0.6) {
                    suggestions.push({
                        leadId: lead.id,
                        leadName: lead.name,
                        currentStage: stage.name,
                        suggestedStage: nextStage.name,
                        reason: getAIReason(stage.id, nextStage.id, lead),
                        confidence: Math.round(60 + Math.random() * 35),
                    });
                }
            });
        });
        setAiSuggestions(suggestions);
        setShowAiSuggestions(true);
    };

    const getAIReason = (fromStage: string, toStage: string, lead: Lead): string => {
        const reasons = [
            `${lead.name} has been in ${fromStage} for 3+ days with positive engagement`,
            `Email opened 2x, ready to move forward`,
            `Lead responded positively, suggest progressing`,
            `High engagement score detected, consider advancing`,
            `Similar leads typically progress at this point`,
        ];
        return reasons[Math.floor(Math.random() * reasons.length)];
    };

    // Apply AI suggestion
    const applyAISuggestion = (suggestion: AISuggestion) => {
        const targetStage = currentTemplate.stages.find(s => s.name === suggestion.suggestedStage);
        if (!targetStage) return;

        setPipelineStages(stages => stages.map(stage => {
            const lead = stage.leads.find(l => l.id === suggestion.leadId);
            if (lead) {
                return { ...stage, leads: stage.leads.filter(l => l.id !== suggestion.leadId) };
            }
            if (stage.id === targetStage.id) {
                const movedLead = pipelineStages.flatMap(s => s.leads).find(l => l.id === suggestion.leadId);
                if (movedLead) {
                    return { ...stage, leads: [...stage.leads, { ...movedLead, status: targetStage.id as Lead['status'] }] };
                }
            }
            return stage;
        }));

        setAiSuggestions(prev => prev.filter(s => s.leadId !== suggestion.leadId));
    };

    // Add custom stage
    const addCustomStage = () => {
        if (!newStageName.trim()) return;
        const newStage = {
            id: `custom_${Date.now()}`,
            name: newStageName.trim(),
            color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
        };
        setCustomStages(prev => {
            const updated = [...prev, newStage];
            localStorage.setItem('athena-custom-stages', JSON.stringify(updated));
            return updated;
        });
        setNewStageName('');

        // Add to pipeline stages (no Meta events for custom stages)
        setPipelineStages(prev => [...prev.slice(0, -1), {
            id: newStage.id,
            name: newStage.name,
            color: newStage.color,
            leads: [],
            events: getDefaultEventsForStage('custom'),
        }, prev[prev.length - 1]]); // Keep "Lost" at the end
    };

    const filteredLeads = useMemo(() => {
        let leads = allLeads.filter(lead => {
            const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                lead.phone.includes(searchQuery) ||
                (lead.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
            const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
            const matchesTag = tagFilter === 'all' || lead.tags?.some(t => t.id === tagFilter);
            const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;

            // Date filtering
            let matchesDate = true;
            if (dateFilterType !== 'all') {
                const leadDate = new Date(lead.createdAt);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                switch (dateFilterType) {
                    case 'today':
                        matchesDate = leadDate >= today;
                        break;
                    case 'yesterday':
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);
                        matchesDate = leadDate >= yesterday && leadDate < today;
                        break;
                    case 'last7days':
                        const last7 = new Date(today);
                        last7.setDate(last7.getDate() - 7);
                        matchesDate = leadDate >= last7;
                        break;
                    case 'last30days':
                        const last30 = new Date(today);
                        last30.setDate(last30.getDate() - 30);
                        matchesDate = leadDate >= last30;
                        break;
                    case 'range':
                        if (dateRangeStart) {
                            matchesDate = leadDate >= new Date(dateRangeStart);
                        }
                        if (dateRangeEnd && matchesDate) {
                            const endDate = new Date(dateRangeEnd);
                            endDate.setHours(23, 59, 59, 999);
                            matchesDate = leadDate <= endDate;
                        }
                        break;
                }
            }

            return matchesSearch && matchesStatus && matchesTag && matchesSource && matchesDate;
        });

        // Sort leads
        leads.sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'oldest':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case 'recently_edited':
                    const aEdited = a.lastContactedAt || a.createdAt;
                    const bEdited = b.lastContactedAt || b.createdAt;
                    return new Date(bEdited).getTime() - new Date(aEdited).getTime();
                case 'value_high':
                    return (b.value || 0) - (a.value || 0);
                case 'value_low':
                    return (a.value || 0) - (b.value || 0);
                case 'name':
                    return a.name.localeCompare(b.name);
                default:
                    return 0;
            }
        });

        return leads;
    }, [searchQuery, statusFilter, tagFilter, sourceFilter, sortBy, allLeads, dateFilterType, dateRangeStart, dateRangeEnd]);

    // Filter pipeline leads based on search
    const filteredPipelineStages = useMemo(() => {
        if (!pipelineSearchQuery.trim()) return pipelineStages;

        return pipelineStages.map(stage => ({
            ...stage,
            leads: stage.leads.filter(lead =>
                lead.name.toLowerCase().includes(pipelineSearchQuery.toLowerCase()) ||
                lead.email.toLowerCase().includes(pipelineSearchQuery.toLowerCase()) ||
                lead.source.toLowerCase().includes(pipelineSearchQuery.toLowerCase())
            )
        }));
    }, [pipelineStages, pipelineSearchQuery]);

    const handleSaveStageEvents = (stageId: string, events: StageEvent[]) => {
        setPipelineStages(stages =>
            stages.map(s => s.id === stageId ? { ...s, events } : s)
        );
    };

    // Drag and Drop handlers
    const handleDragStart = (e: React.DragEvent, lead: Lead) => {
        setDraggedLead(lead);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', lead.id);
    };

    const handleDragOver = (e: React.DragEvent, stageId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverStage(stageId);
    };

    const handleDragLeave = () => {
        setDragOverStage(null);
    };

    const handleDrop = (e: React.DragEvent, targetStageId: string) => {
        e.preventDefault();
        setDragOverStage(null);

        if (!draggedLead) return;

        // Find source stage
        const sourceStage = pipelineStages.find(s =>
            s.leads.some(l => l.id === draggedLead.id)
        );

        if (!sourceStage || sourceStage.id === targetStageId) {
            setDraggedLead(null);
            return;
        }

        // Update stages
        setPipelineStages(stages => stages.map(stage => {
            if (stage.id === sourceStage.id) {
                // Remove from source
                return {
                    ...stage,
                    leads: stage.leads.filter(l => l.id !== draggedLead.id)
                };
            } else if (stage.id === targetStageId) {
                // Add to target with updated status
                const updatedLead = {
                    ...draggedLead,
                    status: targetStageId as Lead['status']
                };

                // Simulate firing events for the target stage
                const targetStage = stages.find(s => s.id === targetStageId);
                if (targetStage) {
                    const enabledEvents = targetStage.events.filter(e => e.enabled);
                    if (enabledEvents.length > 0) {
                        console.log(`[Pipeline] Firing events for ${targetStage.name}:`, enabledEvents.map(e => e.name));
                    }
                }

                return {
                    ...stage,
                    leads: [...stage.leads, updatedLead]
                };
            }
            return stage;
        }));

        setDraggedLead(null);
    };

    // Calculate total value only from converted leads
    const totalConvertedValue = useMemo(() => {
        const convertedStage = pipelineStages.find(s => s.id === 'converted');
        return convertedStage?.leads.reduce((sum, l) => sum + (l.value || 0), 0) || 0;
    }, [pipelineStages]);

    const avgConvertedValue = useMemo(() => {
        const convertedStage = pipelineStages.find(s => s.id === 'converted');
        if (!convertedStage || convertedStage.leads.length === 0) return 0;
        return Math.round(convertedStage.leads.reduce((sum, l) => sum + (l.value || 0), 0) / convertedStage.leads.length);
    }, [pipelineStages]);

    const totalLeads = useMemo(() => {
        return pipelineStages.reduce((sum, s) => sum + s.leads.length, 0);
    }, [pipelineStages]);

    const conversionRate = useMemo(() => {
        const convertedStage = pipelineStages.find(s => s.id === 'converted');
        if (totalLeads === 0) return 0;
        return Math.round(((convertedStage?.leads.length || 0) / totalLeads) * 100);
    }, [pipelineStages, totalLeads]);

    return (
        <div className="flex">
            <Sidebar />

            <main className="main-content flex-1 p-8 min-w-0 overflow-x-hidden">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">
                                <span className="text-gradient">Leads & Pipelines</span>
                            </h1>
                            <p className="text-[var(--text-secondary)]">
                                Manage your leads and track their journey through your pipeline
                            </p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Plus size={18} />
                            Add Lead
                        </motion.button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 p-1 bg-[var(--glass-bg)] rounded-xl border border-[var(--glass-border)] w-fit">
                        <button
                            onClick={() => setActiveTab('leads')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'leads'
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <Users size={18} />
                            Leads
                        </button>
                        <button
                            onClick={() => setActiveTab('pipelines')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'pipelines'
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <Activity size={18} />
                            Pipelines
                        </button>
                    </div>
                </motion.div>

                {/* Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'leads' ? (
                        <motion.div
                            key="leads"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Filters */}
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                {/* Search */}
                                <div className="relative flex-1 min-w-[200px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search leads..."
                                        className="input pl-10 w-full"
                                    />
                                </div>

                                {/* Status Filter */}
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as Lead['status'] | 'all')}
                                    className="input"
                                    style={{ width: '120px' }}
                                >
                                    <option value="all">All Status</option>
                                    <option value="new">New</option>
                                    <option value="contacted">Contacted</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="converted">Converted</option>
                                    <option value="lost">Lost</option>
                                </select>

                                {/* Tag Filter */}
                                <select
                                    value={tagFilter}
                                    onChange={(e) => setTagFilter(e.target.value)}
                                    className="input"
                                    style={{ width: '130px' }}
                                >
                                    <option value="all">All Tags</option>
                                    {availableTags.map(tag => (
                                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                                    ))}
                                </select>

                                {/* Source Filter */}
                                <select
                                    value={sourceFilter}
                                    onChange={(e) => setSourceFilter(e.target.value)}
                                    className="input"
                                    style={{ width: '120px' }}
                                >
                                    <option value="all">All Sources</option>
                                    <option value="Meta Ads">Meta Ads</option>
                                    <option value="Website">Website</option>
                                    <option value="Referral">Referral</option>
                                </select>

                                {/* Date Filter */}
                                <select
                                    value={dateFilterType}
                                    onChange={(e) => setDateFilterType(e.target.value as typeof dateFilterType)}
                                    className="input"
                                    style={{ width: '130px' }}
                                >
                                    <option value="all">All Dates</option>
                                    <option value="today">Today</option>
                                    <option value="yesterday">Yesterday</option>
                                    <option value="last7days">Last 7 Days</option>
                                    <option value="last30days">Last 30 Days</option>
                                    <option value="range">Custom Range</option>
                                </select>

                                {/* Date Range Inputs */}
                                {dateFilterType === 'range' && (
                                    <>
                                        <input
                                            type="date"
                                            value={dateRangeStart}
                                            onChange={(e) => setDateRangeStart(e.target.value)}
                                            className="input"
                                            style={{ width: '140px' }}
                                            placeholder="Start date"
                                        />
                                        <span className="text-[var(--text-muted)]">to</span>
                                        <input
                                            type="date"
                                            value={dateRangeEnd}
                                            onChange={(e) => setDateRangeEnd(e.target.value)}
                                            className="input"
                                            style={{ width: '140px' }}
                                            placeholder="End date"
                                        />
                                    </>
                                )}

                                {/* Sort */}
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                                    className="input"
                                    style={{ width: '140px' }}
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="recently_edited">Recently Edited</option>
                                    <option value="value_high">Value: High→Low</option>
                                    <option value="value_low">Value: Low→High</option>
                                    <option value="name">Name A→Z</option>
                                </select>
                            </div>

                            {/* Leads Table */}
                            <GlassCard className="overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-[var(--glass-border)]">
                                            <th className="p-4 w-12">
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={toggleSelectAll}
                                                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0
                                                        ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30'
                                                        : selectedLeadIds.size > 0
                                                            ? 'bg-gradient-to-r from-red-500/50 to-rose-500/50 text-white'
                                                            : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-red-500/50'
                                                        }`}
                                                >
                                                    {selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0 ? (
                                                        <CheckSquare size={14} />
                                                    ) : selectedLeadIds.size > 0 ? (
                                                        <div className="w-2 h-2 bg-white rounded-sm" />
                                                    ) : (
                                                        <Square size={14} />
                                                    )}
                                                </motion.button>
                                            </th>
                                            <th className="text-left p-4 text-sm font-semibold text-[var(--text-secondary)]">
                                                <div className="flex items-center gap-2 cursor-pointer hover:text-[var(--text-primary)]">
                                                    Name
                                                    <ArrowUpDown size={14} />
                                                </div>
                                            </th>
                                            <th className="text-left p-4 text-sm font-semibold text-[var(--text-secondary)]">Contact</th>
                                            <th className="text-left p-4 text-sm font-semibold text-[var(--text-secondary)]">Status</th>
                                            <th className="text-left p-4 text-sm font-semibold text-[var(--text-secondary)]">Source</th>
                                            <th className="text-left p-4 text-sm font-semibold text-[var(--text-secondary)]">Value</th>
                                            <th className="text-left p-4 text-sm font-semibold text-[var(--text-secondary)]">Date</th>
                                            <th className="p-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLeads.map((lead, index) => {
                                            const isSelected = selectedLeadIds.has(lead.id);
                                            return (
                                                <motion.tr
                                                    key={lead.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className={`border-b border-[var(--glass-border)] transition-all cursor-pointer ${isSelected
                                                        ? 'bg-red-500/10 hover:bg-red-500/15 border-l-2 border-l-red-500'
                                                        : 'hover:bg-[var(--accent-soft)]'
                                                        }`}
                                                    onClick={() => setSelectedLead(lead)}
                                                >
                                                    <td className="p-4">
                                                        <motion.button
                                                            whileHover={{ scale: 1.15 }}
                                                            whileTap={{ scale: 0.85 }}
                                                            onClick={(e) => toggleLeadSelection(lead.id, e)}
                                                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${isSelected
                                                                ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/30'
                                                                : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:border-red-500/50 hover:text-red-400'
                                                                }`}
                                                        >
                                                            {isSelected ? <Check size={14} /> : <Square size={14} />}
                                                        </motion.button>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-medium">{lead.name}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-1 text-sm">
                                                            <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                                                                <Mail size={14} />
                                                                {lead.email}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                                                <Phone size={14} />
                                                                {lead.phone}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span
                                                            className="px-3 py-1 rounded-full text-xs font-medium capitalize"
                                                            style={{
                                                                backgroundColor: `${statusColors[lead.status]}20`,
                                                                color: statusColors[lead.status],
                                                            }}
                                                        >
                                                            {lead.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-sm text-[var(--text-secondary)]">
                                                        {lead.source}
                                                    </td>
                                                    <td className="p-4 text-sm font-medium">
                                                        {lead.status === 'converted' && lead.value ? (
                                                            <span className="text-[var(--accent-primary)]">
                                                                ₱{lead.value.toLocaleString()}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[var(--text-muted)]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-sm text-[var(--text-muted)]">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar size={14} />
                                                            {lead.createdAt}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <LeadDropdownMenu
                                                            lead={lead}
                                                            onViewDetails={() => setSelectedLead(lead)}
                                                            onEdit={() => setEditingLead(lead)}
                                                            onDelete={() => setShowDeleteConfirm(lead)}
                                                        />
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {filteredLeads.length === 0 && (
                                    <div className="p-12 text-center text-[var(--text-muted)]">
                                        No leads found matching your criteria
                                    </div>
                                )}
                            </GlassCard>

                            {/* Floating Bulk Delete Action Bar */}
                            <AnimatePresence>
                                {selectedLeadIds.size > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40"
                                    >
                                        <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border border-[var(--glass-border)] rounded-2xl shadow-2xl shadow-black/50 px-6 py-4 flex items-center gap-6 backdrop-blur-xl">
                                            {/* Selection Count */}
                                            <div className="flex items-center gap-3">
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white font-bold shadow-lg shadow-red-500/30"
                                                >
                                                    {selectedLeadIds.size}
                                                </motion.div>
                                                <div>
                                                    <div className="font-semibold text-white">
                                                        {selectedLeadIds.size === 1 ? 'Lead' : 'Leads'} Selected
                                                    </div>
                                                    <div className="text-xs text-[var(--text-muted)]">
                                                        Ready for bulk action
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div className="w-px h-10 bg-[var(--glass-border)]" />

                                            {/* Actions */}
                                            <div className="flex items-center gap-3">
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={clearSelection}
                                                    className="px-4 py-2 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-white hover:border-white/30 transition-all flex items-center gap-2"
                                                >
                                                    <X size={16} />
                                                    Clear
                                                </motion.button>

                                                <motion.button
                                                    whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(239, 68, 68, 0.4)" }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => setShowBulkDeleteConfirm(true)}
                                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all flex items-center gap-2"
                                                >
                                                    <Trash2 size={16} />
                                                    Delete {selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'Lead' : 'Leads'}
                                                </motion.button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="pipelines"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Pipeline Controls */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                                    <input
                                        type="text"
                                        value={pipelineSearchQuery}
                                        onChange={(e) => setPipelineSearchQuery(e.target.value)}
                                        placeholder="Search across all stages..."
                                        className="input pl-10 w-full"
                                    />
                                </div>

                                {/* Pipeline Type Selector */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-[var(--text-muted)] uppercase">Template:</span>
                                    <select
                                        value={selectedPipelineType}
                                        onChange={(e) => setSelectedPipelineType(e.target.value)}
                                        className="input py-2 text-sm"
                                    >
                                        {PIPELINE_TEMPLATES.map(t => (
                                            <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* AI Suggestions Button */}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={generateAISuggestions}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    <Sparkles size={16} className="text-purple-400" />
                                    AI Suggest
                                    {aiSuggestions.length > 0 && (
                                        <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                            {aiSuggestions.length}
                                        </span>
                                    )}
                                </motion.button>

                                {/* Settings Button */}
                                <button
                                    onClick={() => setShowPipelineSettings(true)}
                                    className="btn-icon w-10 h-10"
                                    title="Pipeline Settings"
                                >
                                    <Settings size={18} />
                                </button>
                            </div>

                            {/* AI Suggestions Panel */}
                            <AnimatePresence>
                                {showAiSuggestions && aiSuggestions.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mb-6 overflow-hidden"
                                    >
                                        <GlassCard className="p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles size={18} className="text-purple-400" />
                                                    <span className="font-semibold">AI Suggestions</span>
                                                    <span className="text-xs text-[var(--text-muted)]">
                                                        (will not auto-move to Converted or Lost)
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => setShowAiSuggestions(false)}
                                                    className="btn-icon w-6 h-6"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                                {aiSuggestions.map((s, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">{s.leadName}</span>
                                                                <span className="text-xs text-[var(--text-muted)]">
                                                                    {s.currentStage} → {s.suggestedStage}
                                                                </span>
                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                                                                    {s.confidence}% confident
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-[var(--text-muted)] mt-1">{s.reason}</div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => applyAISuggestion(s)}
                                                                className="btn-primary py-1 px-3 text-xs flex items-center gap-1"
                                                            >
                                                                <Check size={12} />
                                                                Apply
                                                            </button>
                                                            <button
                                                                onClick={() => setAiSuggestions(prev => prev.filter((_, j) => j !== i))}
                                                                className="btn-icon w-7 h-7"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </GlassCard>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Pipeline Kanban Board */}
                            <div className="grid grid-cols-5 gap-3 pb-4">
                                {filteredPipelineStages.map((stage) => (
                                    <div
                                        key={stage.id}
                                        className={`min-w-0 transition-all ${dragOverStage === stage.id ? 'scale-[1.02]' : ''
                                            }`}
                                        onDragOver={(e) => handleDragOver(e, stage.id)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, stage.id)}
                                    >
                                        <GlassCard className={`p-3 h-full transition-all ${dragOverStage === stage.id
                                            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                                            : ''
                                            }`}>
                                            {/* Stage Header */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: stage.color }}
                                                    />
                                                    <h3 className="font-semibold text-sm truncate">{stage.name}</h3>
                                                    <span className="text-xs text-[var(--text-muted)] bg-[var(--glass-bg)] px-1.5 py-0.5 rounded-full flex-shrink-0">
                                                        {stage.leads.length}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                                    <button
                                                        className="btn-icon w-6 h-6"
                                                        onClick={() => setSelectedStage(pipelineStages.find(s => s.id === stage.id) || null)}
                                                        title="Configure stage events"
                                                    >
                                                        <Settings size={12} />
                                                    </button>
                                                    <button className="btn-icon w-6 h-6">
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Active Events Indicator */}
                                            {stage.events && stage.events.some(e => e.enabled) && (
                                                <div className="mb-2 flex flex-wrap gap-1">
                                                    {stage.events.filter(e => e.enabled).map(event => (
                                                        <span
                                                            key={event.id}
                                                            className="text-[10px] px-1.5 py-0.5 bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded-full"
                                                        >
                                                            {event.type}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Stage Cards */}
                                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                                {stage.leads.map((lead) => (
                                                    <DraggableLeadCard
                                                        key={lead.id}
                                                        lead={lead}
                                                        stageColor={stage.color}
                                                        onDragStart={handleDragStart}
                                                        onClick={() => setSelectedLead(lead)}
                                                    />
                                                ))}

                                                {stage.leads.length === 0 && (
                                                    <div className="p-3 text-center text-[var(--text-muted)] text-xs border-2 border-dashed border-[var(--glass-border)] rounded-lg">
                                                        {pipelineSearchQuery ? 'No matches' : 'Drop leads here'}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Add Card Button */}
                                            <button className="w-full mt-2 p-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)] rounded-lg transition-colors flex items-center justify-center gap-1">
                                                <Plus size={12} />
                                                Add Lead
                                            </button>
                                        </GlassCard>
                                    </div>
                                ))}
                            </div>

                            {/* Pipeline Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                                <GlassCard className="p-4">
                                    <div className="text-sm text-[var(--text-secondary)] mb-1">Total Leads</div>
                                    <div className="text-2xl font-bold">{totalLeads}</div>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <div className="text-sm text-[var(--text-secondary)] mb-1">Converted Value</div>
                                    <div className="text-2xl font-bold text-[var(--accent-primary)]">
                                        ₱{totalConvertedValue.toLocaleString()}
                                    </div>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <div className="text-sm text-[var(--text-secondary)] mb-1">Conversion Rate</div>
                                    <div className="text-2xl font-bold text-[#98FB98]">
                                        {conversionRate}%
                                    </div>
                                </GlassCard>
                                <GlassCard className="p-4">
                                    <div className="text-sm text-[var(--text-secondary)] mb-1">Avg Converted Value</div>
                                    <div className="text-2xl font-bold">
                                        ₱{avgConvertedValue.toLocaleString()}
                                    </div>
                                </GlassCard>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Lead Details Modal */}
                <AnimatePresence>
                    {selectedLead && !editingLead && (
                        <LeadDetailsModal
                            lead={selectedLead}
                            onClose={() => setSelectedLead(null)}
                            onEdit={() => setEditingLead(selectedLead)}
                            onDelete={() => setShowDeleteConfirm(selectedLead)}
                            onAddTag={(tagId) => handleAddTagToLead(selectedLead.id, tagId)}
                            onRemoveTag={(tagId) => handleRemoveTagFromLead(selectedLead.id, tagId)}
                            allTags={availableTags}
                        />
                    )}
                </AnimatePresence>

                {/* Edit Lead Modal */}
                <AnimatePresence>
                    {editingLead && (
                        <EditLeadModal
                            lead={editingLead}
                            onClose={() => setEditingLead(null)}
                            onSave={(updated) => {
                                handleUpdateLead(updated);
                                setEditingLead(null);
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {showDeleteConfirm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={() => setShowDeleteConfirm(null)}
                        >
                            <motion.div
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0.9 }}
                                className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-6 max-w-sm w-full text-center"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                                    <Trash2 className="text-red-400" size={24} />
                                </div>
                                <h3 className="text-lg font-bold mb-2">Delete Lead?</h3>
                                <p className="text-sm text-[var(--text-muted)] mb-6">
                                    Are you sure you want to delete <strong>{showDeleteConfirm.name}</strong>? This action cannot be undone.
                                </p>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary flex-1">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleDeleteLead(showDeleteConfirm.id)}
                                        className="flex-1 py-2 px-4 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bulk Delete Confirmation Modal */}
                <AnimatePresence>
                    {showBulkDeleteConfirm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
                            onClick={() => setShowBulkDeleteConfirm(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.8, opacity: 0, y: 50 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] border border-red-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Animated Warning Icon */}
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                                    className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/40"
                                >
                                    <motion.div
                                        animate={{
                                            scale: [1, 1.1, 1],
                                        }}
                                        transition={{
                                            duration: 1.5,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                    >
                                        <AlertTriangle className="text-white" size={36} />
                                    </motion.div>
                                </motion.div>

                                {/* Title */}
                                <h3 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-red-400 to-rose-400 bg-clip-text text-transparent">
                                    Delete {selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'Lead' : 'Leads'}?
                                </h3>

                                <p className="text-center text-[var(--text-muted)] mb-6">
                                    This action is permanent and cannot be undone.
                                </p>

                                {/* Preview of leads to be deleted */}
                                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <div className="text-xs text-red-400 font-semibold mb-2">LEADS TO BE DELETED:</div>
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {Array.from(selectedLeadIds).slice(0, 5).map(id => {
                                            const lead = allLeads.find(l => l.id === id);
                                            return lead ? (
                                                <div key={id} className="flex items-center gap-2 text-sm">
                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500/30 to-rose-500/30 flex items-center justify-center text-xs font-bold text-red-300">
                                                        {lead.name.charAt(0)}
                                                    </div>
                                                    <span className="text-[var(--text-secondary)]">{lead.name}</span>
                                                    <span className="text-[var(--text-muted)] text-xs">({lead.email})</span>
                                                </div>
                                            ) : null;
                                        })}
                                        {selectedLeadIds.size > 5 && (
                                            <div className="text-xs text-[var(--text-muted)] pt-1">
                                                ...and {selectedLeadIds.size - 5} more
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-4">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowBulkDeleteConfirm(false)}
                                        disabled={isBulkDeleting}
                                        className="flex-1 py-3 px-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-white hover:border-white/30 font-medium transition-all disabled:opacity-50"
                                    >
                                        Cancel
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(239, 68, 68, 0.5)" }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={handleBulkDelete}
                                        disabled={isBulkDeleting}
                                        className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold shadow-lg shadow-red-500/30 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                                    >
                                        {isBulkDeleting ? (
                                            <>
                                                <RefreshCw size={16} className="animate-spin" />
                                                Deleting...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 size={16} />
                                                Delete All
                                            </>
                                        )}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Stage Events Modal */}
                <AnimatePresence>
                    {selectedStage && (
                        <StageEventsModal
                            stage={selectedStage}
                            onClose={() => setSelectedStage(null)}
                            onSave={handleSaveStageEvents}
                        />
                    )}
                </AnimatePresence>

                {/* AI Chat Widget */}
                <AIChatWidget />

                {/* Pipeline Settings Modal */}
                <AnimatePresence>
                    {showPipelineSettings && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                            onClick={() => setShowPipelineSettings(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-6 max-w-lg w-full shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold">Pipeline Settings</h2>
                                    <button onClick={() => setShowPipelineSettings(false)} className="btn-icon w-8 h-8">
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Current Template Info */}
                                <div className="mb-6">
                                    <div className="text-sm text-[var(--text-muted)] mb-2">Current Template</div>
                                    <div className="p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl">{currentTemplate.emoji}</span>
                                            <span className="font-semibold">{currentTemplate.name}</span>
                                        </div>
                                        <p className="text-sm text-[var(--text-muted)] mb-3">{currentTemplate.description}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {currentTemplate.stages.map(s => (
                                                <div key={s.id} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{ backgroundColor: s.color + '20' }}>
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                    {s.name}
                                                    {s.metaEvent && (
                                                        <span className="text-[10px] opacity-60">({s.metaEvent})</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Stages */}
                                <div className="mb-6">
                                    <div className="text-sm text-[var(--text-muted)] mb-2">Add Custom Stage</div>
                                    <p className="text-xs text-[var(--text-muted)] mb-3">
                                        Custom stages will not fire any Meta events
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newStageName}
                                            onChange={(e) => setNewStageName(e.target.value)}
                                            placeholder="Stage name..."
                                            className="input flex-1"
                                            onKeyDown={(e) => e.key === 'Enter' && addCustomStage()}
                                        />
                                        <button onClick={addCustomStage} className="btn-primary">
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    {customStages.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {customStages.map(s => (
                                                <div
                                                    key={s.id}
                                                    className="flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)]"
                                                >
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                                                    {s.name}
                                                    <button
                                                        onClick={() => {
                                                            setCustomStages(prev => prev.filter(c => c.id !== s.id));
                                                            setPipelineStages(prev => prev.filter(p => p.id !== s.id));
                                                        }}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Event Legend */}
                                <div className="p-4 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                                    <div className="text-xs font-semibold mb-2 text-[var(--accent-primary)]">Meta Events</div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>✅ <strong>Lead</strong> = QualifiedLead</div>
                                        <div>✅ <strong>Purchase</strong> = Conversion</div>
                                        <div>⚠️ <strong>Schedule</strong> = Appointment</div>
                                        <div>⚠️ <strong>CompleteRegistration</strong></div>
                                    </div>
                                    <div className="mt-2 text-[10px] text-[var(--text-muted)]">
                                        AI will never auto-move leads to goal stages (Converted/Lost)
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowPipelineSettings(false)}
                                    className="btn-primary w-full mt-6"
                                >
                                    Done
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main >
        </div >
    );
}
