'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    Link2,
    Save,
    RefreshCw,
    CheckCircle,
    AlertCircle,
    Loader2,
    Unlink,
    Sparkles,
} from 'lucide-react';
import { Sidebar } from '@/components/ui/Sidebar';
import { GlassCard } from '@/components/ui/GlassCard';
import { MetaConnectModal } from '@/components/ui/MetaConnectModal';
import { useAuth } from '@/lib/auth';

interface MetaIntegration {
    adAccountId: string;
    adAccountName: string;
    pageId?: string;
    pageName?: string;
    connectedAt?: string;
}

export default function SettingsPage() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [metaIntegration, setMetaIntegration] = useState<MetaIntegration | null>(null);
    const [loading, setLoading] = useState(true);
    const [showConnectModal, setShowConnectModal] = useState(false);
    const [modalData, setModalData] = useState<{
        token: string;
        expiresIn: string;
        adAccounts: any[];
        pages: any[];
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);

    // Check for OAuth callback params
    useEffect(() => {
        const metaConnect = searchParams.get('meta_connect');
        const errorParam = searchParams.get('error');

        if (errorParam) {
            setError(decodeURIComponent(errorParam));
            router.replace('/settings');
        }

        if (metaConnect === 'true') {
            try {
                const token = searchParams.get('token') || '';
                const expiresIn = searchParams.get('expires_in') || '';
                const adAccounts = JSON.parse(searchParams.get('ad_accounts') || '[]');
                const pages = JSON.parse(searchParams.get('pages') || '[]');

                setModalData({ token, expiresIn, adAccounts, pages });
                setShowConnectModal(true);

                // Clean URL
                router.replace('/settings');
            } catch (e) {
                console.error('Error parsing OAuth callback data:', e);
                setError('Failed to process OAuth response');
            }
        }
    }, [searchParams, router]);

    // Load existing integration
    useEffect(() => {
        const loadIntegration = async () => {
            if (!user?.id) {
                setLoading(false);
                return;
            }

            try {
                // In a real app, fetch from your database
                const stored = localStorage.getItem(`meta_integration_${user.id}`);
                if (stored) {
                    setMetaIntegration(JSON.parse(stored));
                }
            } catch (e) {
                console.error('Error loading integration:', e);
            } finally {
                setLoading(false);
            }
        };

        loadIntegration();
    }, [user]);

    const handleConnect = () => {
        if (!user?.id) {
            setError('Please log in first');
            return;
        }

        // Redirect to API route that handles OAuth (can access server-side env vars)
        window.location.href = `/api/auth/facebook/start?user_id=${user.id}`;
    };

    const handleConnectSuccess = (data: MetaIntegration) => {
        setMetaIntegration(data);
        setShowConnectModal(false);
        setModalData(null);

        // Store locally (in production, this is in the database)
        if (user?.id) {
            localStorage.setItem(`meta_integration_${user.id}`, JSON.stringify(data));
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect your Meta account? Your imported ads will remain.')) {
            return;
        }

        setMetaIntegration(null);
        if (user?.id) {
            localStorage.removeItem(`meta_integration_${user.id}`);
        }
    };

    const handleSync = async () => {
        if (!user?.id) return;

        setSyncing(true);
        setError(null);
        try {
            const response = await fetch('/api/meta/import-ads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Sync failed');
            }

            const imported = data.imported || {};
            const contactsCount = (imported.leads || 0) + (imported.conversations || 0);
            alert(`Synced: ${imported.campaigns || 0} campaigns, ${imported.ads || 0} ads${contactsCount > 0 ? `, ${contactsCount} contacts` : ''}`);
        } catch (e) {
            console.error('Sync error:', e);
            setError(e instanceof Error ? e.message : 'Failed to sync ads');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="flex">
            <Sidebar />

            <main className="main-content flex-1 max-w-4xl">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold mb-2">Settings</h1>
                    <p className="text-[var(--text-secondary)]">
                        Configure your integrations and platform settings.
                    </p>
                </motion.div>

                {/* Error Alert */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
                    >
                        <AlertCircle className="text-red-400" size={20} />
                        <span className="text-red-400">{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="ml-auto text-red-400 hover:text-red-300"
                        >
                            ×
                        </button>
                    </motion.div>
                )}

                <div className="space-y-6">
                    {/* Meta Integration */}
                    <GlassCard className="p-6" delay={0.1}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-[#1877F2]/20 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-[#1877F2]">f</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold">Meta (Facebook) Integration</h3>
                                    <p className="text-sm text-[var(--text-muted)]">Connect your Ad Account and Pages</p>
                                </div>
                            </div>
                            {loading ? (
                                <Loader2 className="animate-spin text-[var(--text-muted)]" size={20} />
                            ) : metaIntegration ? (
                                <span className="badge badge-success flex items-center gap-1">
                                    <CheckCircle size={12} />
                                    Connected
                                </span>
                            ) : (
                                <span className="badge badge-warning">Not Connected</span>
                            )}
                        </div>

                        {metaIntegration ? (
                            <div className="space-y-4">
                                {/* Connected Account Info */}
                                <div className="p-4 rounded-xl bg-[var(--glass-bg)] border border-[var(--glass-border)]">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-[var(--text-muted)] mb-1">Ad Account</div>
                                            <div className="font-medium">{metaIntegration.adAccountName}</div>
                                            <div className="text-xs text-[var(--text-muted)]">ID: {metaIntegration.adAccountId}</div>
                                        </div>
                                        {metaIntegration.pageId && (
                                            <div>
                                                <div className="text-[var(--text-muted)] mb-1">Facebook Page</div>
                                                <div className="font-medium">{metaIntegration.pageName}</div>
                                                <div className="text-xs text-[var(--text-muted)]">Lead Ads enabled</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSync}
                                        disabled={syncing}
                                        className="btn-secondary flex items-center gap-2"
                                    >
                                        {syncing ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <RefreshCw size={16} />
                                        )}
                                        {syncing ? 'Syncing...' : 'Sync Now'}
                                    </button>
                                    <button
                                        onClick={handleDisconnect}
                                        className="btn-secondary text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                    >
                                        <Unlink size={16} />
                                        Disconnect
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button
                                    onClick={handleConnect}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <Link2 size={18} />
                                    Connect Meta Account
                                </button>

                                <p className="text-sm text-[var(--text-muted)]">
                                    Connect your Meta Business account to sync ads, creatives, and leads automatically.
                                </p>
                            </div>
                        )}
                    </GlassCard>

                    {/* CAPI Settings */}
                    <GlassCard className="p-6" delay={0.2}>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-semibold">Conversion API (CAPI)</h3>
                                <p className="text-sm text-[var(--text-muted)]">Configure server-side event tracking</p>
                            </div>
                            <span className="badge badge-success flex items-center gap-1">
                                <CheckCircle size={12} />
                                Configured
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">Pixel ID</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Enter Pixel ID"
                                    defaultValue="1419616119961545"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">Access Token</label>
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="Enter Access Token"
                                    defaultValue="••••••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button className="btn-secondary flex items-center gap-2">
                                <RefreshCw size={16} />
                                Test Connection
                            </button>
                            <button className="btn-primary flex items-center gap-2">
                                <Save size={16} />
                                Save Settings
                            </button>
                        </div>
                    </GlassCard>
                </div>
            </main>

            {/* Meta Connect Modal */}
            {showConnectModal && modalData && user && (
                <MetaConnectModal
                    isOpen={showConnectModal}
                    onClose={() => {
                        setShowConnectModal(false);
                        setModalData(null);
                    }}
                    onSuccess={handleConnectSuccess}
                    token={modalData.token}
                    expiresIn={modalData.expiresIn}
                    userId={user.id}
                    adAccounts={modalData.adAccounts}
                    pages={modalData.pages}
                />
            )}
        </div>
    );
}
