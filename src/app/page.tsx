'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Zap,
  BarChart3,
  Users,
  Sparkles,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  // Redirect to login page on mount
  useEffect(() => {
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center max-w-4xl mx-auto"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-24 h-24 mx-auto mb-8 rounded-2xl overflow-hidden"
        >
          <Image
            src="/logo.png"
            alt="ATHENA"
            fill
            className="object-cover animate-float"
          />
        </motion.div>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          <span className="text-gradient">ATHENA</span>
        </h1>
        <p className="text-xl md:text-2xl text-[var(--text-secondary)] mb-4">
          Creative Intelligence Platform
        </p>
        <p className="text-[var(--text-muted)] mb-12 max-w-2xl mx-auto">
          AI-powered creative analysis, conversion optimization, and ads intelligence
          for Meta Ads. Transform your advertising with data-driven insights.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-primary flex items-center gap-2 text-lg px-8 py-4"
            >
              Enter Dashboard
              <ArrowRight size={20} />
            </motion.button>
          </Link>
          <Link href="/settings">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-secondary flex items-center gap-2 text-lg px-8 py-4"
            >
              Connect Meta
            </motion.button>
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 stagger-children">
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="AI Analysis"
            description="Deep creative structure analysis with NVIDIA AI"
          />
          <FeatureCard
            icon={<BarChart3 className="w-8 h-8" />}
            title="Performance"
            description="Real-time insights and delivery predictions"
          />
          <FeatureCard
            icon={<Users className="w-8 h-8" />}
            title="Lead Capture"
            description="Automatic lead ingestion from Meta Lead Ads"
          />
          <FeatureCard
            icon={<Sparkles className="w-8 h-8" />}
            title="Smart CAPI"
            description="Automated server-side event firing"
          />
        </div>
      </motion.div>

      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent-primary)] opacity-5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[var(--accent-secondary)] opacity-5 rounded-full blur-[80px]" />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02 }}
      className="glass-card p-6 text-center"
    >
      <div className="text-[var(--accent-primary)] mb-4 flex justify-center">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-muted)]">{description}</p>
    </motion.div>
  );
}
