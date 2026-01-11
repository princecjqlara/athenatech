'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Key, ArrowRight, Eye, EyeOff, Sparkles, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth';

// Animated floating orb component
function FloatingOrb({ delay, size, color, position }: { delay: number; size: number; color: string; position: { x: string; y: string } }) {
    return (
        <motion.div
            className="absolute rounded-full blur-3xl opacity-30"
            style={{
                width: size,
                height: size,
                background: color,
                left: position.x,
                top: position.y,
            }}
            animate={{
                y: [0, -30, 0],
                x: [0, 15, 0],
                scale: [1, 1.1, 1],
            }}
            transition={{
                duration: 8,
                delay,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
        />
    );
}

export default function SignUpPage() {
    const router = useRouter();
    const { signUp } = useAuth();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        if (!inviteCode.trim()) {
            setError('Invite code is required');
            return;
        }

        setLoading(true);

        const { error } = await signUp(email, password, inviteCode.trim(), fullName);

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push('/dashboard');
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background */}
            <div className="fixed inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#0d0d15] to-[#0a0a0f]" />

            {/* Floating orbs */}
            <FloatingOrb delay={0} size={400} color="rgba(139, 92, 246, 0.3)" position={{ x: '10%', y: '20%' }} />
            <FloatingOrb delay={2} size={300} color="rgba(59, 130, 246, 0.25)" position={{ x: '70%', y: '60%' }} />
            <FloatingOrb delay={4} size={250} color="rgba(236, 72, 153, 0.2)" position={{ x: '80%', y: '10%' }} />
            <FloatingOrb delay={1} size={200} color="rgba(34, 197, 94, 0.2)" position={{ x: '5%', y: '70%' }} />

            {/* Grid pattern overlay */}
            <div
                className="fixed inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                }}
            />

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full max-w-md relative z-10"
            >
                {/* Logo */}
                <motion.div
                    className="text-center mb-6"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Link href="/" className="inline-block group">
                        <motion.div
                            className="relative w-16 h-16 mx-auto mb-3 rounded-2xl overflow-hidden"
                            whileHover={{ scale: 1.05, rotate: 2 }}
                            transition={{ type: 'spring', stiffness: 400 }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-2xl" />
                            <Image src="/logo.png" alt="ATHENA" fill sizes="64px" className="object-cover" />
                            <div className="absolute inset-0 ring-1 ring-white/10 rounded-2xl" />
                        </motion.div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                            Join ATHENA
                        </h1>
                    </Link>
                    <p className="text-gray-400 mt-1 text-sm flex items-center justify-center gap-2">
                        <Shield size={12} className="text-violet-400" />
                        Invite-only access
                        <Sparkles size={12} className="text-fuchsia-400" />
                    </p>
                </motion.div>

                {/* Form Card */}
                <motion.div
                    className="relative"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    {/* Card glow effect */}
                    <div className="absolute -inset-[1px] bg-gradient-to-r from-violet-500/50 via-fuchsia-500/50 to-violet-500/50 rounded-2xl blur-sm opacity-50" />

                    <div className="relative bg-[#12121a]/90 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2"
                                >
                                    <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                    {error}
                                </motion.div>
                            )}

                            {/* Invite Code - Highlighted */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-1.5 font-medium flex items-center gap-2">
                                    <Key size={12} className="text-violet-400" />
                                    Invite Code <span className="text-red-400">*</span>
                                </label>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                        placeholder="XXXX-XXXX"
                                        className="w-full px-4 py-3 bg-violet-500/10 border border-violet-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all uppercase tracking-widest text-center font-mono"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                                        Full Name
                                    </label>
                                    <div className="relative group">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-400 transition-colors" size={16} />
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Your name"
                                            className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                                        Email <span className="text-red-400">*</span>
                                    </label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-400 transition-colors" size={16} />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Email"
                                            className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                                    Password <span className="text-red-400">*</span>
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-400 transition-colors" size={16} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min 8 characters"
                                        className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-400 mb-1.5 font-medium">
                                    Confirm Password <span className="text-red-400">*</span>
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-400 transition-colors" size={16} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm password"
                                        className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all text-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <motion.button
                                type="submit"
                                disabled={loading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 disabled:opacity-50 transition-all mt-5"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Create Account
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </motion.button>
                        </form>

                        <div className="mt-5 text-center">
                            <p className="text-sm text-gray-500">
                                Already have an account?{' '}
                                <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.p
                    className="text-center text-gray-600 text-xs mt-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    By signing up, you agree to our Terms of Service
                </motion.p>
            </motion.div>
        </div>
    );
}
