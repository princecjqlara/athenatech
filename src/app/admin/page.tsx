'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Users,
    Plus,
    Copy,
    Check,
    Ban,
    PlayCircle,
    Trash2,
    RefreshCw,
    Shield,
} from 'lucide-react';
import { Sidebar } from '@/components/ui/Sidebar';
import { GlassCard } from '@/components/ui/GlassCard';
import { supabase } from '@/lib/supabase';
import { useAuth, UserProfile } from '@/lib/auth';

interface InviteCode {
    id: string;
    code: string;
    created_by: string;
    created_at: string;
    is_used: boolean;
    used_by?: string;
    used_at?: string;
}

export default function AdminPage() {
    const { profile, isAdmin } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users');

    useEffect(() => {
        if (isAdmin) {
            fetchUsers();
            fetchInviteCodes();
        }
    }, [isAdmin]);

    async function fetchUsers() {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setUsers(data);
        }
        setLoading(false);
    }

    async function fetchInviteCodes() {
        const { data, error } = await supabase
            .from('invite_codes')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setInviteCodes(data);
        }
    }

    async function generateInviteCode() {
        if (!profile) return;
        setGenerating(true);

        // Generate a random 8-character alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // In dev mode, the mock user doesn't exist in DB, so skip created_by
        const isDevUser = profile.id === 'dev-user-001';
        const insertData: { code: string; created_by?: string } = { code };
        if (!isDevUser) {
            insertData.created_by = profile.id;
        }

        const { error } = await supabase.from('invite_codes').insert(insertData);

        if (!error) {
            fetchInviteCodes();
        }
        setGenerating(false);
    }

    async function deleteInviteCode(id: string) {
        await supabase.from('invite_codes').delete().eq('id', id);
        fetchInviteCodes();
    }

    async function toggleUserSuspension(userId: string, currentStatus: boolean) {
        await supabase
            .from('profiles')
            .update({ is_suspended: !currentStatus })
            .eq('id', userId);
        fetchUsers();
    }

    function copyToClipboard(code: string) {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
    }

    if (!isAdmin) {
        return (
            <div className="flex">
                <Sidebar />
                <main className="main-content flex-1">
                    <GlassCard className="p-12 text-center">
                        <Shield className="mx-auto mb-4 text-[var(--error)]" size={48} />
                        <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
                        <p className="text-[var(--text-muted)]">
                            You need admin privileges to access this page.
                        </p>
                    </GlassCard>
                </main>
            </div>
        );
    }

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
                    <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
                    <p className="text-[var(--text-secondary)]">
                        Manage users and invite codes.
                    </p>
                </motion.div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'users'
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                            : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--glass-border)]'
                            }`}
                    >
                        <Users size={16} className="inline mr-2" />
                        Users ({users.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('invites')}
                        className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'invites'
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                            : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border border-[var(--glass-border)]'
                            }`}
                    >
                        Invite Codes ({inviteCodes.filter(c => !c.is_used).length} available)
                    </button>
                </div>

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <GlassCard className="overflow-hidden" delay={0.1}>
                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="spinner mx-auto" />
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-12 text-center">
                                <Users className="mx-auto mb-4 text-[var(--text-muted)]" size={48} />
                                <p className="text-[var(--text-muted)]">No users yet</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Email</th>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Status</th>
                                            <th>Joined</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user) => (
                                            <tr key={user.id}>
                                                <td className="font-medium">{user.email}</td>
                                                <td>{user.full_name || '-'}</td>
                                                <td>
                                                    <span className={`badge ${user.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${user.is_suspended ? 'badge-error' : 'badge-success'}`}>
                                                        {user.is_suspended ? 'Suspended' : 'Active'}
                                                    </span>
                                                </td>
                                                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                                                <td>
                                                    {user.id !== profile?.id && (
                                                        <button
                                                            onClick={() => toggleUserSuspension(user.id, user.is_suspended)}
                                                            className={`btn-icon w-8 h-8 ${user.is_suspended ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}
                                                            title={user.is_suspended ? 'Activate User' : 'Suspend User'}
                                                        >
                                                            {user.is_suspended ? <PlayCircle size={16} /> : <Ban size={16} />}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GlassCard>
                )}

                {/* Invite Codes Tab */}
                {activeTab === 'invites' && (
                    <>
                        <div className="flex justify-end mb-4">
                            <motion.button
                                onClick={generateInviteCode}
                                disabled={generating}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="btn-primary flex items-center gap-2"
                            >
                                {generating ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
                                Generate Invite Code
                            </motion.button>
                        </div>

                        <GlassCard className="overflow-hidden" delay={0.1}>
                            {inviteCodes.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Plus className="mx-auto mb-4 text-[var(--text-muted)]" size={48} />
                                    <p className="text-[var(--text-muted)]">No invite codes yet. Generate one above.</p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Code</th>
                                                <th>Status</th>
                                                <th>Created</th>
                                                <th>Used By</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inviteCodes.map((invite) => (
                                                <tr key={invite.id}>
                                                    <td>
                                                        <span className="font-mono text-[var(--accent-primary)] bg-[var(--glass-bg)] px-2 py-1 rounded">
                                                            {invite.code}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${invite.is_used ? 'badge-warning' : 'badge-success'}`}>
                                                            {invite.is_used ? 'Used' : 'Available'}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(invite.created_at).toLocaleDateString()}</td>
                                                    <td>{invite.used_by || '-'}</td>
                                                    <td className="flex gap-2">
                                                        {!invite.is_used && (
                                                            <>
                                                                <button
                                                                    onClick={() => copyToClipboard(invite.code)}
                                                                    className="btn-icon w-8 h-8"
                                                                    title="Copy Code"
                                                                >
                                                                    {copiedCode === invite.code ? <Check size={16} className="text-[var(--success)]" /> : <Copy size={16} />}
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteInviteCode(invite.id)}
                                                                    className="btn-icon w-8 h-8 text-[var(--error)]"
                                                                    title="Delete Code"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </GlassCard>
                    </>
                )}
            </main>
        </div>
    );
}
