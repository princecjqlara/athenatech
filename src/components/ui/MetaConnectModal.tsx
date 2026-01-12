'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, FileText, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface AdAccount {
    id: string;
    account_id: string;
    name: string;
    currency: string;
    business_name?: string;
}

interface Page {
    id: string;
    name: string;
    access_token: string;
    category: string;
    picture?: string;
}

interface MetaConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (data: { adAccountId: string; adAccountName: string; pageId?: string; pageName?: string }) => void;
    token: string;
    expiresIn: string;
    userId: string;
    adAccounts: AdAccount[];
    pages: Page[];
}

export function MetaConnectModal({
    isOpen,
    onClose,
    onSuccess,
    token,
    expiresIn,
    userId,
    adAccounts,
    pages,
}: MetaConnectModalProps) {
    const [selectedAdAccount, setSelectedAdAccount] = useState<AdAccount | null>(null);
    const [selectedPage, setSelectedPage] = useState<Page | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-select first ad account if only one
    useEffect(() => {
        if (adAccounts.length === 1 && !selectedAdAccount) {
            setSelectedAdAccount(adAccounts[0]);
        }
    }, [adAccounts, selectedAdAccount]);

    const handleSave = async () => {
        if (!selectedAdAccount) {
            setError('Please select an ad account');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const response = await fetch('/api/auth/facebook/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    access_token: token,
                    token_expires_at: expiresIn,
                    ad_account_id: selectedAdAccount.account_id,
                    ad_account_name: selectedAdAccount.name,
                    page_id: selectedPage?.id,
                    page_name: selectedPage?.name,
                    page_access_token: selectedPage?.access_token,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save integration');
            }

            onSuccess({
                adAccountId: selectedAdAccount.account_id,
                adAccountName: selectedAdAccount.name,
                pageId: selectedPage?.id,
                pageName: selectedPage?.name,
            });

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#1877F2]/20 flex items-center justify-center">
                                <span className="text-xl font-bold text-[#1877F2]">f</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Connect Meta Account</h2>
                                <p className="text-sm text-[var(--text-muted)]">Select your ad account and page</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn-icon w-8 h-8">
                            <X size={18} />
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400">
                            <AlertCircle size={16} />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {/* Ad Account Selection */}
                    <div className="mb-6">
                        <label className="flex items-center gap-2 text-sm font-medium mb-3">
                            <Building2 size={16} className="text-[var(--accent-primary)]" />
                            Ad Account <span className="text-red-400">*</span>
                        </label>
                        <div className="space-y-2">
                            {adAccounts.length === 0 ? (
                                <div className="p-4 rounded-lg bg-[var(--glass-bg)] text-center text-[var(--text-muted)]">
                                    No ad accounts found. Make sure you have access to at least one ad account.
                                </div>
                            ) : (
                                adAccounts.map((account) => (
                                    <button
                                        key={account.id}
                                        onClick={() => setSelectedAdAccount(account)}
                                        className={`w-full p-4 rounded-xl border text-left transition-all ${selectedAdAccount?.id === account.id
                                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                                : 'border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--accent-primary)]/50'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium">{account.name}</div>
                                                {account.business_name && (
                                                    <div className="text-sm text-[var(--text-muted)]">{account.business_name}</div>
                                                )}
                                                <div className="text-xs text-[var(--text-muted)] mt-1">
                                                    ID: {account.account_id} • {account.currency}
                                                </div>
                                            </div>
                                            {selectedAdAccount?.id === account.id && (
                                                <CheckCircle size={20} className="text-[var(--accent-primary)]" />
                                            )}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Page Selection (Optional) */}
                    <div className="mb-6">
                        <label className="flex items-center gap-2 text-sm font-medium mb-3">
                            <FileText size={16} className="text-[var(--accent-primary)]" />
                            Facebook Page <span className="text-[var(--text-muted)]">(for Lead Ads)</span>
                        </label>
                        <div className="space-y-2">
                            {pages.length === 0 ? (
                                <div className="p-4 rounded-lg bg-[var(--glass-bg)] text-center text-[var(--text-muted)] text-sm">
                                    No pages found. Page connection is optional but required for lead ads.
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setSelectedPage(null)}
                                        className={`w-full p-3 rounded-xl border text-left transition-all ${!selectedPage
                                                ? 'border-[var(--glass-border)] bg-[var(--glass-bg)]'
                                                : 'border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--accent-primary)]/50'
                                            }`}
                                    >
                                        <span className="text-[var(--text-muted)]">Skip page connection</span>
                                    </button>
                                    {pages.map((page) => (
                                        <button
                                            key={page.id}
                                            onClick={() => setSelectedPage(page)}
                                            className={`w-full p-4 rounded-xl border text-left transition-all ${selectedPage?.id === page.id
                                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                                    : 'border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--accent-primary)]/50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {page.picture ? (
                                                        <img
                                                            src={page.picture}
                                                            alt={page.name}
                                                            className="w-10 h-10 rounded-full"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-[var(--accent-soft)] flex items-center justify-center">
                                                            <FileText size={20} className="text-[var(--accent-primary)]" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-medium">{page.name}</div>
                                                        <div className="text-xs text-[var(--text-muted)]">{page.category}</div>
                                                    </div>
                                                </div>
                                                {selectedPage?.id === page.id && (
                                                    <CheckCircle size={20} className="text-[var(--accent-primary)]" />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving || !selectedAdAccount}
                        className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} />
                                Connect & Import Ads
                            </>
                        )}
                    </button>

                    <p className="text-xs text-[var(--text-muted)] text-center mt-4">
                        Your ads will be imported automatically and synced every 15 minutes.
                    </p>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
