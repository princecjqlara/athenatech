'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
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

export default function LoginPage() {
    const router = useRouter();
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);

        const { error } = await signIn(email, password);

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
                    className="text-center mb-8"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Link href="/" className="inline-block group">
                        <motion.div
                            className="relative w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden"
                            whileHover={{ scale: 1.05, rotate: 2 }}
                            transition={{ type: 'spring', stiffness: 400 }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-2xl" />
                            <Image src="/logo.png" alt="ATHENA" fill sizes="80px" className="object-cover" />
                            <div className="absolute inset-0 ring-1 ring-white/10 rounded-2xl" />
                        </motion.div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                            ATHENA
                        </h1>
                    </Link>
                    <p className="text-gray-400 mt-2 flex items-center justify-center gap-2">
                        <Sparkles size={14} className="text-violet-400" />
                        Creative Intelligence Platform
                        <Sparkles size={14} className="text-fuchsia-400" />
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

                    <div className="relative bg-[#12121a]/90 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
                        <form onSubmit={handleSubmit} className="space-y-5">
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

                            <div>
                                <label className="block text-sm text-gray-400 mb-2 font-medium">
                                    Email
                                </label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-400 transition-colors" size={18} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2 font-medium">
                                    Password
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-violet-400 transition-colors" size={18} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 transition-all"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <motion.button
                                type="submit"
                                disabled={loading}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25 disabled:opacity-50 transition-all"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </motion.button>
                        </form>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-500">
                                Don&apos;t have an account?{' '}
                                <Link href="/signup" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                                    Sign up with invite code
                                </Link>
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.p
                    className="text-center text-gray-600 text-xs mt-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    By signing in, you agree to our Terms of Service
                </motion.p>
            </motion.div>
        </div>
    );
}
