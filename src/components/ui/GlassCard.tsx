'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  onClick?: () => void;
}

export function GlassCard({ 
  children, 
  className = '', 
  hover = true,
  delay = 0,
  onClick
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={hover ? { y: -4, scale: 1.01 } : {}}
      className={`${hover ? 'glass-card' : 'glass-card-static'} ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

interface StatCardProps {
  value: string | number;
  label: string;
  change?: number;
  icon?: ReactNode;
  delay?: number;
}

export function StatCard({ value, label, change, icon, delay = 0 }: StatCardProps) {
  return (
    <GlassCard delay={delay} className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
          {change !== undefined && (
            <div className={`stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
              {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
            </div>
          )}
        </div>
        {icon && (
          <div className="text-[var(--accent-primary)] opacity-60">
            {icon}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
