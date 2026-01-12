'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
    DollarSign,
    Users,
    Eye,
    MousePointer,
    Zap,
    ArrowRight,
    Link2,
    RefreshCw,
} from 'lucide-react';
import { Sidebar } from '@/components/ui/Sidebar';
import { GlassCard, StatCard } from '@/components/ui/GlassCard';

interface DashboardStats {
    spend: number;
    leads: number;
    ctr: number;
    impressions: number;
    adsCount: number;
    creativesCount: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Check if Meta is connected (would come from API)
        // For now, show empty state
        setLoading(false);
        setConnected(false);
        setStats(null);
    }, []);

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
                    <div className="flex items-center gap-4 mb-2">
                        <div className="relative w-10 h-10 rounded-xl overflow-hidden">
                            <Image src="/logo.png" alt="ATHENA" fill sizes="40px" className="object-cover" />
                        </div>
                        <h1 className="text-3xl font-bold">
                            <span className="text-gradient">ATHENA</span> Analytics
                        </h1>
                    </div>
                    <p className="text-[var(--text-secondary)]">
                        AI-powered creative intelligence platform. Connect your Meta account to get started.
                    </p>
                </motion.div>

                {!connected ? (
                    /* Not Connected State */
                    <div className="grid grid-cols-12 gap-5">
                        {/* Connect Meta CTA */}
                        <GlassCard className="col-span-8 p-8" delay={0.1}>
                            <div className="flex items-start gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-[#1877F2]/20 flex items-center justify-center flex-shrink-0">
                                    <span className="text-4xl font-bold text-[#1877F2]">f</span>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold mb-2">Connect Your Meta Account</h2>
                                    <p className="text-[var(--text-secondary)] mb-6">
                                        Link your Facebook Ads account to automatically import campaigns,
                                        creatives, and performance data. ATHENA will analyze your ads with
                                        AI-powered insights.
                                    </p>
                                    <div className="flex gap-4">
                                        <Link href="/settings">
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className="btn-primary flex items-center gap-2"
                                            >
                                                <Link2 size={18} />
                                                Connect Meta Account
                                                <ArrowRight size={18} />
                                            </motion.button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>

                        {/* Quick Actions */}
                        <div className="col-span-4 flex flex-col gap-5">
                            <GlassCard className="p-6" delay={0.2}>
                                <div className="w-16 h-16 mb-4 mx-auto">
                                    <motion.div
                                        animate={{ rotateY: [0, 360] }}
                                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                        className="w-full h-full text-[var(--accent-primary)] opacity-30"
                                        style={{
                                            border: '2px solid currentColor',
                                            borderRadius: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Zap size={32} />
                                    </motion.div>
                                </div>
                                <h3 className="text-lg font-semibold mb-2 text-center">AI Creative Analysis</h3>
                                <p className="text-sm text-[var(--text-muted)] text-center">
                                    Upload creatives and get AI-powered optimization recommendations.
                                </p>
                            </GlassCard>
                        </div>

                        {/* Empty Stats */}
                        <div className="col-span-12 grid grid-cols-4 gap-4">
                            <StatCard value="--" label="Spend" icon={<DollarSign size={24} />} delay={0.3} />
                            <StatCard value="--" label="Leads" icon={<Users size={24} />} delay={0.4} />
                            <StatCard value="--" label="CTR" icon={<MousePointer size={24} />} delay={0.5} />
                            <StatCard value="--" label="Impressions" icon={<Eye size={24} />} delay={0.6} />
                        </div>

                        {/* Getting Started Steps */}
                        <GlassCard className="col-span-12 p-6" delay={0.7}>
                            <h3 className="text-lg font-semibold mb-4">Getting Started</h3>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent-primary)] font-bold">
                                        1
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-1">Connect Meta</h4>
                                        <p className="text-sm text-[var(--text-muted)]">
                                            Link your Facebook Ads account via OAuth
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-muted)] font-bold">
                                        2
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-1 text-[var(--text-muted)]">Import Ads</h4>
                                        <p className="text-sm text-[var(--text-muted)]">
                                            Sync your campaigns and creatives
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-muted)] font-bold">
                                        3
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-1 text-[var(--text-muted)]">Get Insights</h4>
                                        <p className="text-sm text-[var(--text-muted)]">
                                            AI analyzes your creatives automatically
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    </div>
                ) : loading ? (
                    /* Loading State */
                    <div className="flex items-center justify-center h-64">
                        <div className="spinner" />
                    </div>
                ) : (
                    /* Connected State with Data */
                    <div className="grid grid-cols-12 gap-5">
                        {/* Stats Row */}
                        <div className="col-span-12 grid grid-cols-4 gap-4">
                            <StatCard
                                value={stats ? `$${(stats.spend / 1000).toFixed(1)}K` : '--'}
                                label="Spend"
                                icon={<DollarSign size={24} />}
                                delay={0.1}
                            />
                            <StatCard
                                value={stats?.leads?.toLocaleString() || '--'}
                                label="Leads"
                                icon={<Users size={24} />}
                                delay={0.2}
                            />
                            <StatCard
                                value={stats ? `${stats.ctr.toFixed(1)}%` : '--'}
                                label="CTR"
                                icon={<MousePointer size={24} />}
                                delay={0.3}
                            />
                            <StatCard
                                value={stats ? `${(stats.impressions / 1000).toFixed(0)}K` : '--'}
                                label="Impressions"
                                icon={<Eye size={24} />}
                                delay={0.4}
                            />
                        </div>

                        {/* Quick Actions */}
                        <GlassCard className="col-span-8 p-6" delay={0.5}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Recent Activity</h3>
                                <button className="btn-secondary flex items-center gap-2 text-sm">
                                    <RefreshCw size={14} />
                                    Sync Now
                                </button>
                            </div>
                            <p className="text-[var(--text-muted)]">
                                No recent activity. Your ads data will appear here once synced.
                            </p>
                        </GlassCard>

                        <GlassCard className="col-span-4 p-6" delay={0.6}>
                            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
                            <div className="space-y-3">
                                <Link href="/ads" className="block p-3 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--accent-soft)] transition-colors">
                                    <span className="text-sm">View Ads</span>
                                </Link>
                                <Link href="/creatives" className="block p-3 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--accent-soft)] transition-colors">
                                    <span className="text-sm">Creative Library</span>
                                </Link>
                                <Link href="/settings" className="block p-3 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--accent-soft)] transition-colors">
                                    <span className="text-sm">Settings</span>
                                </Link>
                            </div>
                        </GlassCard>
                    </div>
                )}
            </main>
        </div>
    );
}
