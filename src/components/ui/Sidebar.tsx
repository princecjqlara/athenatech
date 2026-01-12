'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import {
    LayoutDashboard,
    Megaphone,
    Users,
    Settings,
    LogOut,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: Megaphone, label: 'Ads', href: '/ads' },
    { icon: Sparkles, label: 'Algorithm', href: '/algorithm' },
    { icon: Users, label: 'Leads', href: '/leads' },
    { icon: ShieldCheck, label: 'Admin', href: '/admin' },
    { icon: Settings, label: 'Settings', href: '/settings' },
];

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { signOut } = useAuth();
    const [expanded, setExpanded] = useState(false);

    const handleLogout = async () => {
        await signOut();
        router.push('/login');
    };

    return (
        <motion.aside
            className="fixed left-0 top-0 h-screen bg-[var(--bg-secondary)] border-r border-[var(--glass-border)] flex flex-col items-center py-6 z-50 overflow-hidden"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            animate={{ width: expanded ? 200 : 72 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
        >
            {/* Logo */}
            <Link href="/dashboard" className="mb-8 flex items-center gap-3 px-4 w-full overflow-hidden">
                <div className="relative w-10 h-10 flex-shrink-0 rounded-xl overflow-hidden">
                    <Image
                        src="/logo.png"
                        alt="ATHENA"
                        fill
                        className="object-cover"
                    />
                </div>
                <AnimatePresence>
                    {expanded && (
                        <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="text-[var(--accent-primary)] font-bold text-lg whitespace-nowrap"
                        >
                            ATHENA
                        </motion.span>
                    )}
                </AnimatePresence>
            </Link>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 flex-1 w-full px-3">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 h-11 rounded-xl transition-all duration-200 overflow-hidden
                ${expanded ? 'px-3' : 'px-0 justify-center'}
                ${isActive
                                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]'
                                }`}
                        >
                            <Icon size={20} className="flex-shrink-0" />
                            <AnimatePresence>
                                {expanded && (
                                    <motion.span
                                        initial={{ opacity: 0, width: 0 }}
                                        animate={{ opacity: 1, width: 'auto' }}
                                        exit={{ opacity: 0, width: 0 }}
                                        className="whitespace-nowrap text-sm font-medium overflow-hidden"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="mt-auto px-3 w-full">
                <button
                    onClick={handleLogout}
                    className={`flex items-center gap-3 h-11 rounded-xl transition-all duration-200 w-full overflow-hidden
            ${expanded ? 'px-3' : 'px-0 justify-center'}
            text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)]`}
                >
                    <LogOut size={20} className="flex-shrink-0" />
                    <AnimatePresence>
                        {expanded && (
                            <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                className="whitespace-nowrap text-sm font-medium overflow-hidden"
                            >
                                Logout
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>

            {/* User avatar */}
            <div className="mt-4 px-3">
                <div className="w-10 h-10 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent-primary)] font-semibold">
                    A
                </div>
            </div>
        </motion.aside>
    );
}
