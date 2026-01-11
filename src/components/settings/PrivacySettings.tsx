'use client';

import React, { useState } from 'react';
import { PRIVACY_COPY } from '@/lib/privacy';

/**
 * Privacy Settings Panel
 * 
 * GAP 4: User opt-out toggle for aggregated sharing.
 */

interface PrivacySettingsProps {
    shareAggregates: boolean;
    onUpdate: (shareAggregates: boolean) => Promise<void>;
    loading?: boolean;
}

export function PrivacySettings({
    shareAggregates,
    onUpdate,
    loading = false
}: PrivacySettingsProps) {
    const [localValue, setLocalValue] = useState(shareAggregates);
    const [saving, setSaving] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleToggle = async () => {
        const newValue = !localValue;
        setLocalValue(newValue);
        setSaving(true);

        try {
            await onUpdate(newValue);

            if (!newValue) {
                setShowConfirmation(true);
                setTimeout(() => setShowConfirmation(false), 5000);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 rounded-lg bg-[var(--glass-bg)] border border-[var(--border-subtle)]">
            <h3 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">
                Privacy Settings
            </h3>

            <div className="flex items-start gap-4">
                {/* Toggle */}
                <button
                    onClick={handleToggle}
                    disabled={loading || saving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${localValue ? 'bg-primary-600' : 'bg-gray-600'
                        } ${(loading || saving) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                    <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${localValue ? 'left-7' : 'left-1'
                            }`}
                    />
                </button>

                {/* Label and description */}
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">📊</span>
                        <span className="font-medium text-[var(--text-primary)]">
                            {PRIVACY_COPY.toggle.label}
                        </span>
                    </div>

                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                        {PRIVACY_COPY.toggle.description}
                    </p>

                    <div className="mt-3 p-3 rounded bg-[var(--surface-secondary)] text-sm text-[var(--text-muted)]">
                        {PRIVACY_COPY.toggle.helpText.split('\n').map((line, idx) => (
                            <p key={idx} className={line === '' ? 'my-2' : ''}>
                                {line}
                            </p>
                        ))}
                    </div>
                </div>
            </div>

            {/* Opt-out confirmation */}
            {showConfirmation && (
                <div className="mt-4 p-3 rounded-lg bg-blue-500/20 border border-blue-500/40 text-sm">
                    <p className="text-blue-300">
                        {PRIVACY_COPY.optOutConfirmation}
                    </p>
                </div>
            )}

            {saving && (
                <div className="mt-4 text-sm text-[var(--text-muted)]">
                    Saving...
                </div>
            )}
        </div>
    );
}
