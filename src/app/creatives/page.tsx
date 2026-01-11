'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Search,
    Filter,
    Upload,
    RefreshCw,
    Play,
    Image as ImageIcon,
    Link2,
} from 'lucide-react';
import { Sidebar } from '@/components/ui/Sidebar';
import { GlassCard } from '@/components/ui/GlassCard';

interface Creative {
    id: string;
    name: string;
    type: 'video' | 'image';
    thumbnailUrl: string;
    deliveryScore: number;
    structureRating: string;
    status: 'analyzed' | 'analyzing' | 'needs_optimization';
    placement: string;
}

function getScoreColor(score: number) {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--error)';
}

export default function CreativesPage() {
    const [creatives, setCreatives] = useState<Creative[]>([]);
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        // Check connection status and fetch creatives from API
        setLoading(false);
        setConnected(false);
        setCreatives([]);
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
                    <h1 className="text-3xl font-bold mb-2">Creative Library</h1>
                    <p className="text-[var(--text-secondary)]">
                        AI-analyzed creatives with structure scores and optimization recommendations.
                    </p>
                </motion.div>

                {/* Filters */}
                <GlassCard className="p-4 mb-6" delay={0.1}>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={18} />
                            <input
                                type="text"
                                placeholder="Search creatives..."
                                className="input pl-10"
                                disabled={!connected}
                            />
                        </div>
                        <button className="btn-secondary flex items-center gap-2" disabled={!connected}>
                            <Filter size={18} />
                            Type: All
                        </button>
                        <button className="btn-secondary flex items-center gap-2" disabled={!connected}>
                            <RefreshCw size={18} />
                            Sync
                        </button>
                        <button className="btn-primary flex items-center gap-2" disabled={!connected}>
                            <Upload size={18} />
                            Upload
                        </button>
                    </div>
                </GlassCard>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="spinner" />
                    </div>
                ) : !connected ? (
                    /* Not Connected State */
                    <GlassCard className="p-12 text-center" delay={0.2}>
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
                    /* Empty State */
                    <GlassCard className="p-12 text-center" delay={0.2}>
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
                            <button className="btn-primary flex items-center gap-2">
                                <Upload size={18} />
                                Upload Creative
                            </button>
                        </div>
                    </GlassCard>
                ) : (
                    /* Creatives Grid */
                    <div className="grid grid-cols-3 gap-5">
                        {creatives.map((creative, idx) => (
                            <motion.div
                                key={creative.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + idx * 0.1 }}
                            >
                                <GlassCard className="overflow-hidden cursor-pointer group">
                                    {/* Thumbnail */}
                                    <div className="relative h-48 bg-[var(--bg-tertiary)]">
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

                                        {/* Status */}
                                        {creative.status === 'analyzing' && (
                                            <div className="absolute inset-0 bg-[var(--bg-primary)]/80 flex items-center justify-center">
                                                <div className="spinner" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="p-4">
                                        <h3 className="font-semibold mb-1 truncate">{creative.name}</h3>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-[var(--text-muted)]">{creative.placement}</span>
                                            <span
                                                className="font-bold"
                                                style={{ color: getScoreColor(creative.deliveryScore) }}
                                            >
                                                Grade: {creative.structureRating}
                                            </span>
                                        </div>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
