'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle,
    XCircle,
    HelpCircle,
    MessageSquare,
    Clock,
    Eye,
    Megaphone,
    Star,
    MousePointer,
    DollarSign,
    Shield,
    Link2,
    AlertTriangle,
    Lock,
    Lightbulb,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import {
    NarrativeChecklist,
    NarrativeDiagnostic,
    NarrativeEligibility,
    defaultChecklist,
    diagnoseNarrative,
    getEligibilityMessage,
    getGapLabel,
    getTimingLabel,
} from '@/lib/narrativeChecklist';

interface NarrativeChecklistFormProps {
    checklist: NarrativeChecklist;
    eligibility: NarrativeEligibility;
    onUpdate: (checklist: NarrativeChecklist) => void;
    onConfirm: () => void;
}

export function NarrativeChecklistForm({
    checklist,
    eligibility,
    onUpdate,
    onConfirm,
}: NarrativeChecklistFormProps) {
    const [notes, setNotes] = useState('');
    const [showDiagnostic, setShowDiagnostic] = useState(false);

    const diagnostic = diagnoseNarrative(checklist);

    const handleToggle = useCallback((field: keyof NarrativeChecklist, value: boolean) => {
        onUpdate({ ...checklist, [field]: value, userConfirmed: false });
    }, [checklist, onUpdate]);

    const handleTiming = useCallback((field: 'valueTiming' | 'offerTiming', value: string) => {
        onUpdate({ ...checklist, [field]: value, userConfirmed: false });
    }, [checklist, onUpdate]);

    const handleAlignment = useCallback((value: 'yes' | 'unsure' | 'no') => {
        onUpdate({ ...checklist, adLpMatch: value, userConfirmed: false });
    }, [checklist, onUpdate]);

    const handleConfirm = useCallback(() => {
        onUpdate({ ...checklist, userConfirmed: true });
        onConfirm();
    }, [checklist, onUpdate, onConfirm]);

    // If not eligible, show locked state
    if (!eligibility.eligible) {
        return (
            <GlassCard className="p-5">
                <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-500/20 flex items-center justify-center">
                        <Lock className="text-gray-400" size={28} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-gray-400">Message Structure Analysis</h3>
                    <p className="text-[var(--text-muted)] max-w-md mx-auto">
                        {getEligibilityMessage(eligibility)}
                    </p>
                </div>
            </GlassCard>
        );
    }

    return (
        <GlassCard className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <MessageSquare className="text-[var(--accent-primary)]" size={20} />
                        Message Structure
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">
                        Describe what exists and where. The system decides what to test.
                    </p>
                </div>
                {checklist.userConfirmed && (
                    <span className="badge badge-success flex items-center gap-1">
                        <CheckCircle size={12} />
                        Confirmed
                    </span>
                )}
            </div>

            {/* Eligibility Banner */}
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
                <p className="text-sm text-yellow-400 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    {getEligibilityMessage(eligibility)}
                </p>
            </div>

            {/* Section: Message Presence */}
            <div className="mb-6">
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
                    <Eye size={14} />
                    Message Presence
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <ToggleField
                        label="Value Proposition"
                        description="Is there a clear value statement?"
                        value={checklist.valuePropositionPresent}
                        onChange={(v) => handleToggle('valuePropositionPresent', v)}
                    />
                    <ToggleField
                        label="Offer"
                        description="Is there a specific offer?"
                        value={checklist.offerPresent}
                        onChange={(v) => handleToggle('offerPresent', v)}
                    />
                    <ToggleField
                        label="Proof/Testimonial"
                        description="Is there social proof?"
                        value={checklist.proofPresent}
                        onChange={(v) => handleToggle('proofPresent', v)}
                    />
                    <ToggleField
                        label="CTA"
                        description="Is there a call-to-action?"
                        value={checklist.ctaPresent}
                        onChange={(v) => handleToggle('ctaPresent', v)}
                    />
                </div>
            </div>

            {/* Section: Timing */}
            <div className="mb-6">
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
                    <Clock size={14} />
                    Timing (When Does It Appear?)
                </h4>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm mb-2 block">Value Proposition Timing</label>
                        <div className="flex gap-2">
                            {['opening', 'middle', 'end', 'not_present'].map((timing) => (
                                <button
                                    key={timing}
                                    onClick={() => handleTiming('valueTiming', timing)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs transition-all ${checklist.valueTiming === timing
                                            ? 'bg-[var(--accent-primary)] text-white'
                                            : 'bg-[var(--glass-bg)] hover:bg-[var(--glass-bg)]/80'
                                        }`}
                                >
                                    {getTimingLabel(timing).split(' ').slice(-1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-sm mb-2 block">Offer Timing</label>
                        <div className="flex gap-2">
                            {['early', 'mid', 'late', 'not_shown'].map((timing) => (
                                <button
                                    key={timing}
                                    onClick={() => handleTiming('offerTiming', timing)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs transition-all ${checklist.offerTiming === timing
                                            ? 'bg-[var(--accent-primary)] text-white'
                                            : 'bg-[var(--glass-bg)] hover:bg-[var(--glass-bg)]/80'
                                        }`}
                                >
                                    {getTimingLabel(timing).split(' ').slice(-1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Section: Clarity */}
            <div className="mb-6">
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
                    <Megaphone size={14} />
                    Clarity (Observable, Not Emotional)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                    <ToggleField
                        label="Explicit CTA"
                        description="Action + outcome clear?"
                        value={checklist.ctaExplicit}
                        onChange={(v) => handleToggle('ctaExplicit', v)}
                        icon={<MousePointer size={14} />}
                    />
                    <ToggleField
                        label="Pricing Visible"
                        description="Is pricing shown?"
                        value={checklist.pricingVisible}
                        onChange={(v) => handleToggle('pricingVisible', v)}
                        icon={<DollarSign size={14} />}
                    />
                    <ToggleField
                        label="Guarantee"
                        description="Risk reversal mentioned?"
                        value={checklist.guaranteeMentioned}
                        onChange={(v) => handleToggle('guaranteeMentioned', v)}
                        icon={<Shield size={14} />}
                    />
                </div>
            </div>

            {/* Section: Alignment */}
            <div className="mb-6">
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3 flex items-center gap-2">
                    <Link2 size={14} />
                    Alignment
                </h4>
                <div>
                    <label className="text-sm mb-2 block">Ad promise matches landing page?</label>
                    <div className="flex gap-2">
                        {[
                            { value: 'yes', label: '✅ Yes', color: 'bg-green-500' },
                            { value: 'unsure', label: '❓ Unsure', color: 'bg-yellow-500' },
                            { value: 'no', label: '❌ No', color: 'bg-red-500' },
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleAlignment(option.value as 'yes' | 'unsure' | 'no')}
                                className={`flex-1 py-2 px-4 rounded-lg text-sm transition-all ${checklist.adLpMatch === option.value
                                        ? `${option.color} text-white`
                                        : 'bg-[var(--glass-bg)] hover:bg-[var(--glass-bg)]/80'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Section: Notes (NOT USED FOR SCORING) */}
            <div className="mb-6">
                <h4 className="text-sm font-medium text-[var(--text-muted)] mb-2 flex items-center gap-2">
                    <Star size={14} />
                    Notes
                    <span className="text-xs text-gray-500 font-normal">(Not used for scoring)</span>
                </h4>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add context or memory notes here. These are for humans only and do not affect analysis."
                    className="w-full h-20 p-3 rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] text-sm resize-none"
                />
            </div>

            {/* Diagnostic Preview */}
            <div className="border-t border-[var(--glass-border)] pt-4">
                <button
                    onClick={() => setShowDiagnostic(!showDiagnostic)}
                    className="text-sm text-[var(--accent-primary)] flex items-center gap-2 mb-3"
                >
                    <Lightbulb size={14} />
                    {showDiagnostic ? 'Hide' : 'Show'} Diagnostic Preview
                </button>

                <AnimatePresence>
                    {showDiagnostic && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-3"
                        >
                            {diagnostic.primaryGap && diagnostic.primaryGap !== 'none' && (
                                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                                    <p className="text-sm font-medium text-orange-400">
                                        Primary Gap: {getGapLabel(diagnostic.primaryGap)}
                                    </p>
                                </div>
                            )}

                            {diagnostic.findings.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs text-[var(--text-muted)]">Findings:</p>
                                    {diagnostic.findings.slice(0, 3).map((finding, i) => (
                                        <p key={i} className="text-sm pl-3 border-l-2 border-[var(--glass-border)]">
                                            {finding}
                                        </p>
                                    ))}
                                </div>
                            )}

                            {diagnostic.suggestions.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-xs text-[var(--text-muted)]">What to Test:</p>
                                    {diagnostic.suggestions.slice(0, 2).map((suggestion, i) => (
                                        <p key={i} className="text-sm pl-3 border-l-2 border-[var(--accent-primary)]">
                                            {suggestion}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Confirm Button */}
            <button
                onClick={handleConfirm}
                disabled={checklist.userConfirmed}
                className={`w-full mt-4 py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${checklist.userConfirmed
                        ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                        : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/80'
                    }`}
            >
                <CheckCircle size={18} />
                {checklist.userConfirmed ? 'Confirmed' : 'Confirm Checklist'}
            </button>
        </GlassCard>
    );
}

// ==================== SUB-COMPONENTS ====================

interface ToggleFieldProps {
    label: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
    icon?: React.ReactNode;
}

function ToggleField({ label, description, value, onChange, icon }: ToggleFieldProps) {
    return (
        <button
            onClick={() => onChange(!value)}
            className={`p-3 rounded-lg text-left transition-all border ${value
                    ? 'bg-green-500/10 border-green-500/30'
                    : 'bg-[var(--glass-bg)] border-[var(--glass-border)] hover:border-[var(--accent-primary)]/50'
                }`}
        >
            <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium flex items-center gap-1">
                    {icon}
                    {label}
                </span>
                {value ? (
                    <CheckCircle className="text-green-400" size={16} />
                ) : (
                    <XCircle className="text-gray-500" size={16} />
                )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">{description}</p>
        </button>
    );
}

export default NarrativeChecklistForm;
