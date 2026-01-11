/**
 * System Alerting
 * 
 * GAP 1: Rule-based alerting for operational failures.
 * Alerts only on abnormal conditions, not on normal "insufficient data" states.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ==================== TYPES ====================

export type AlertSeverity = 'warning' | 'critical';

export interface AlertRule {
    id: string;
    name: string;
    description: string;
    check: (supabase: SupabaseClient) => Promise<boolean>;  // true = healthy
    debounceMinutes: number;
    severity: AlertSeverity;
}

export interface SystemAlert {
    id?: string;
    ruleId: string;
    severity: AlertSeverity;
    message: string;
    acknowledged: boolean;
    acknowledgedBy?: string;
    createdAt: Date;
    resolvedAt?: Date;
}

// ==================== DEBOUNCE STATE ====================

// In-memory debounce for serverless (resets on cold start, which is acceptable)
const lastAlertTime: Map<string, number> = new Map();

// ==================== ALERT RULES ====================

export const ALERT_RULES: AlertRule[] = [
    {
        id: 'meta_ingestion_stall',
        name: 'Meta Ads data not received',
        description: 'No user has received data in 6 hours and at least 5 users have active connections',
        check: async (supabase) => {
            const { data } = await supabase.rpc('check_ingestion_health', {
                hours_threshold: 6,
                min_active_users: 5
            });
            return data?.healthy ?? true;
        },
        debounceMinutes: 30,
        severity: 'critical'
    },
    {
        id: 'extraction_queue_stall',
        name: 'Extraction queue not processing',
        description: 'Pending extractions > 10 and oldest pending > 1 hour',
        check: async (supabase) => {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('extraction_jobs')
                .select('id')
                .eq('status', 'pending')
                .lt('started_at', oneHourAgo);

            return (data?.length ?? 0) < 10;
        },
        debounceMinutes: 15,
        severity: 'warning'
    },
    {
        id: 'gate_decision_failure_rate',
        name: 'Abnormal gate failure rate',
        description: '>90% of gate decisions in last hour are failures with >50 total decisions',
        check: async (supabase) => {
            const { data } = await supabase.rpc('check_gate_failure_rate', {
                hours: 1,
                failure_threshold: 0.9,
                min_decisions: 50
            });
            return data?.healthy ?? true;
        },
        debounceMinutes: 60,
        severity: 'warning'
    }
];

// ==================== ALERT EXECUTION ====================

/**
 * Run all alert checks and return triggered alerts.
 */
export async function runAlertChecks(
    supabase: SupabaseClient
): Promise<SystemAlert[]> {
    const alerts: SystemAlert[] = [];

    for (const rule of ALERT_RULES) {
        try {
            const healthy = await rule.check(supabase);

            if (!healthy) {
                const lastAlert = lastAlertTime.get(rule.id) ?? 0;
                const debounceMs = rule.debounceMinutes * 60 * 1000;

                if (Date.now() - lastAlert > debounceMs) {
                    const alert: SystemAlert = {
                        ruleId: rule.id,
                        severity: rule.severity,
                        message: rule.name,
                        acknowledged: false,
                        createdAt: new Date()
                    };

                    // Persist alert
                    await persistAlert(supabase, alert);

                    alerts.push(alert);
                    lastAlertTime.set(rule.id, Date.now());
                }
            }
        } catch (error) {
            // Don't fail the entire check if one rule errors
            console.error(`Alert rule ${rule.id} failed:`, error);
        }
    }

    return alerts;
}

/**
 * Persist alert to database.
 */
async function persistAlert(
    supabase: SupabaseClient,
    alert: SystemAlert
): Promise<void> {
    await supabase
        .from('system_alerts')
        .insert({
            rule_id: alert.ruleId,
            severity: alert.severity,
            message: alert.message,
            acknowledged: false,
            created_at: alert.createdAt.toISOString()
        });
}

/**
 * Get unresolved alerts.
 */
export async function getUnresolvedAlerts(
    supabase: SupabaseClient
): Promise<SystemAlert[]> {
    const { data } = await supabase
        .from('system_alerts')
        .select('*')
        .is('resolved_at', null)
        .order('created_at', { ascending: false });

    return (data || []).map(row => ({
        id: row.id,
        ruleId: row.rule_id,
        severity: row.severity,
        message: row.message,
        acknowledged: row.acknowledged,
        acknowledgedBy: row.acknowledged_by,
        createdAt: new Date(row.created_at),
        resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined
    }));
}

/**
 * Acknowledge an alert.
 */
export async function acknowledgeAlert(
    supabase: SupabaseClient,
    alertId: string,
    userId: string
): Promise<{ success: boolean }> {
    const { error } = await supabase
        .from('system_alerts')
        .update({
            acknowledged: true,
            acknowledged_by: userId
        })
        .eq('id', alertId);

    return { success: !error };
}

/**
 * Resolve an alert.
 */
export async function resolveAlert(
    supabase: SupabaseClient,
    alertId: string
): Promise<{ success: boolean }> {
    const { error } = await supabase
        .from('system_alerts')
        .update({
            resolved_at: new Date().toISOString()
        })
        .eq('id', alertId);

    return { success: !error };
}

/**
 * Get user-facing degradation message (not technical alert).
 */
export function getUserDegradationMessage(alerts: SystemAlert[]): string | null {
    if (alerts.length === 0) return null;

    const hasCritical = alerts.some(a => a.severity === 'critical');

    if (hasCritical) {
        return 'Data sync may be delayed. Results could be outdated.';
    }

    return 'Some features may be slower than usual.';
}
