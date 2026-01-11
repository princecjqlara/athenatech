'use client';

/**
 * WrongBlameAlert Component
 * 
 * Shows an alert when external factors may be affecting conversion performance,
 * preventing the system from incorrectly blaming the creative.
 */

import React from 'react';
import type { ConversionDiagnosis, ContextChange, TrackingAnomaly, FatigueDiagnosis } from '@/lib/wrongBlame';

interface WrongBlameAlertProps {
    diagnosis: ConversionDiagnosis;
    className?: string;
    onDismiss?: () => void;
}

export function WrongBlameAlert({
    diagnosis,
    className = '',
    onDismiss,
}: WrongBlameAlertProps) {
    // Don't show if no external factors detected
    if (diagnosis.canBlameCreative) {
        return null;
    }

    const config = getAlertConfig(diagnosis.primaryIssue);

    return (
        <div className={`rounded-lg p-4 ${config.bgColor} border ${config.borderColor} ${className}`}>
            <div className="flex items-start gap-3">
                {/* Icon */}
                <span className="text-2xl">{config.icon}</span>

                <div className="flex-1">
                    {/* Title */}
                    <h4 className={`font-medium ${config.textColor}`}>
                        {config.title}
                    </h4>

                    {/* Description */}
                    <p className="text-sm text-gray-300 mt-1">
                        {diagnosis.safeMessage}
                    </p>

                    {/* Details */}
                    <div className="mt-3 space-y-2">
                        {/* Context changes */}
                        {diagnosis.contextChanges.length > 0 && (
                            <ContextChangesDetail changes={diagnosis.contextChanges} />
                        )}

                        {/* Tracking anomaly */}
                        {diagnosis.trackingAnomaly?.detected && (
                            <TrackingAnomalyDetail anomaly={diagnosis.trackingAnomaly} />
                        )}

                        {/* Fatigue */}
                        {diagnosis.fatigueDiagnosis?.fatigueDetected && (
                            <FatigueDetail fatigue={diagnosis.fatigueDiagnosis} />
                        )}
                    </div>

                    {/* Confidence badge */}
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                            Confidence: {diagnosis.confidence}
                        </span>
                    </div>
                </div>

                {/* Dismiss button */}
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-gray-500 hover:text-gray-300"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}

// ==================== SUB-COMPONENTS ====================

function ContextChangesDetail({ changes }: { changes: ContextChange[] }) {
    return (
        <div className="text-xs bg-gray-800/50 rounded p-2">
            <span className="text-gray-400">Recent changes detected:</span>
            <ul className="mt-1 space-y-1">
                {changes.map((change, i) => (
                    <li key={i} className="text-gray-300">
                        • {formatChangeType(change.type)}: {formatChange(change)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TrackingAnomalyDetail({ anomaly }: { anomaly: TrackingAnomaly }) {
    return (
        <div className={`text-xs rounded p-2 ${anomaly.severity === 'critical' ? 'bg-red-500/10' : 'bg-yellow-500/10'
            }`}>
            <span className={
                anomaly.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'
            }>
                {anomaly.severity === 'critical' ? '⚠️' : '⚡'} {anomaly.message}
            </span>
        </div>
    );
}

function FatigueDetail({ fatigue }: { fatigue: FatigueDiagnosis }) {
    return (
        <div className="text-xs bg-purple-500/10 rounded p-2">
            <span className="text-purple-400">🔄 Fatigue indicators:</span>
            <ul className="mt-1 space-y-1 text-gray-300">
                {fatigue.indicators.map((indicator, i) => (
                    <li key={i}>• {indicator}</li>
                ))}
            </ul>
        </div>
    );
}

// ==================== HELPERS ====================

function getAlertConfig(primaryIssue: ConversionDiagnosis['primaryIssue']) {
    const configs: Record<string, { icon: string; title: string; bgColor: string; borderColor: string; textColor: string }> = {
        tracking: {
            icon: '📊',
            title: 'Tracking Issue Detected',
            bgColor: 'bg-red-900/20',
            borderColor: 'border-red-700',
            textColor: 'text-red-300',
        },
        external_change: {
            icon: '🔄',
            title: 'External Changes Detected',
            bgColor: 'bg-yellow-900/20',
            borderColor: 'border-yellow-700',
            textColor: 'text-yellow-300',
        },
        audience_fatigue: {
            icon: '😴',
            title: 'Audience Fatigue Suspected',
            bgColor: 'bg-purple-900/20',
            borderColor: 'border-purple-700',
            textColor: 'text-purple-300',
        },
        attribution_gap: {
            icon: '📱',
            title: 'Attribution Data Limited',
            bgColor: 'bg-blue-900/20',
            borderColor: 'border-blue-700',
            textColor: 'text-blue-300',
        },
        none: {
            icon: '✅',
            title: 'No External Factors',
            bgColor: 'bg-gray-800',
            borderColor: 'border-gray-700',
            textColor: 'text-gray-300',
        },
    };

    return configs[primaryIssue] || configs.none;
}

function formatChangeType(type: ContextChange['type']): string {
    const labels: Record<string, string> = {
        lp_url: 'Landing Page',
        discount: 'Discount',
        price: 'Price',
        guarantee: 'Guarantee',
    };
    return labels[type] || type;
}

function formatChange(change: ContextChange): string {
    if (change.type === 'lp_url') {
        return 'URL changed';
    }
    if (change.previousValue === null) {
        return `added "${change.currentValue}"`;
    }
    if (change.currentValue === null) {
        return `removed "${change.previousValue}"`;
    }
    return `"${change.previousValue}" → "${change.currentValue}"`;
}
