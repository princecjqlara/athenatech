/**
 * Audit Logger
 * 
 * Logs all gating decisions for debugging and compliance.
 * Every score attempt and system activation is tracked.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { GateStatus } from './scoringGates';
import { SCORING_VERSIONS } from '../config/versions';

// ==================== TYPES ====================

export interface AuditLogEntry {
    traceId: string;
    userId: string;
    creativeId?: string;
    gateType: 'score_attempt' | 'recommendation_gen' | 'system_activation' | 'eligibility_check';
    gateStatus: GateStatus;
    systemsActivated: ('structure' | 'narrative' | 'conversion')[];
    blocked: boolean;
    blockedReason?: string;
}

// ==================== TRACE ID ====================

/**
 * Generate a unique trace ID for linking related decisions.
 */
export function generateTraceId(): string {
    return crypto.randomUUID();
}

// ==================== LOGGING ====================

/**
 * Log a gate decision to the audit trail.
 */
export async function logGateDecision(
    supabase: SupabaseClient,
    entry: AuditLogEntry
): Promise<{ success: boolean; logId?: string; error?: string }> {
    const { data, error } = await supabase.rpc('log_gate_decision', {
        p_trace_id: entry.traceId,
        p_user_id: entry.userId,
        p_creative_id: entry.creativeId || null,
        p_gate_type: entry.gateType,
        p_gate_status: entry.gateStatus,
        p_systems_activated: entry.systemsActivated,
        p_blocked: entry.blocked,
        p_blocked_reason: entry.blockedReason || null,
    });

    if (error) {
        console.error('Failed to log gate decision:', error);
        return { success: false, error: error.message };
    }

    return { success: true, logId: data };
}

/**
 * Log a scoring attempt with full context.
 */
export async function logScoreAttempt(
    supabase: SupabaseClient,
    traceId: string,
    userId: string,
    creativeId: string,
    gateStatus: GateStatus
): Promise<void> {
    const systemsActivated: ('structure' | 'narrative' | 'conversion')[] = [];

    if (gateStatus.canScoreDelivery) {
        systemsActivated.push('structure');
    }
    if (gateStatus.canScoreConversion) {
        systemsActivated.push('conversion');
    }

    await logGateDecision(supabase, {
        traceId,
        userId,
        creativeId,
        gateType: 'score_attempt',
        gateStatus,
        systemsActivated,
        blocked: !gateStatus.canScoreDelivery,
        blockedReason: gateStatus.gateMessages[0],
    });
}

/**
 * Log a system activation decision.
 */
export async function logSystemActivation(
    supabase: SupabaseClient,
    traceId: string,
    userId: string,
    creativeId: string,
    system: 'structure' | 'narrative' | 'conversion',
    activated: boolean,
    reason: string
): Promise<void> {
    await logGateDecision(supabase, {
        traceId,
        userId,
        creativeId,
        gateType: 'system_activation',
        gateStatus: {} as GateStatus, // Minimal status for activation log
        systemsActivated: activated ? [system] : [],
        blocked: !activated,
        blockedReason: activated ? undefined : reason,
    });
}

// ==================== RETRIEVAL ====================

export interface AuditTrailStep {
    stepOrder: number;
    gateType: string;
    systemsActivated: string[];
    blocked: boolean;
    blockedReason?: string;
    createdAt: Date;
    gateStatus: GateStatus;
}

/**
 * Get full audit trail for a trace ID.
 */
export async function getAuditTrail(
    supabase: SupabaseClient,
    traceId: string
): Promise<{ trail: AuditTrailStep[]; error?: string }> {
    const { data, error } = await supabase.rpc('get_audit_trail', {
        p_trace_id: traceId,
    });

    if (error) {
        return { trail: [], error: error.message };
    }

    return {
        trail: (data || []).map((row: Record<string, unknown>) => ({
            stepOrder: row.step_order as number,
            gateType: row.gate_type as string,
            systemsActivated: row.systems_activated as string[],
            blocked: row.blocked as boolean,
            blockedReason: row.blocked_reason as string | undefined,
            createdAt: new Date(row.created_at as string),
            gateStatus: row.gate_status as GateStatus,
        })),
    };
}

/**
 * Format audit trail for debugging output.
 */
export function formatAuditTrail(trail: AuditTrailStep[]): string {
    const lines = [
        `ATHENA Audit Trail (${trail.length} steps)`,
        `Versions: schema=${SCORING_VERSIONS.STRUCTURE_SCHEMA}, model=${SCORING_VERSIONS.SCORING_MODEL}, gates=${SCORING_VERSIONS.GATING_RULES}`,
        '='.repeat(50),
    ];

    for (const step of trail) {
        const status = step.blocked ? '❌ BLOCKED' : '✅ PASSED';
        lines.push(`[${step.stepOrder}] ${step.gateType}: ${status}`);
        if (step.systemsActivated.length > 0) {
            lines.push(`    Systems: ${step.systemsActivated.join(', ')}`);
        }
        if (step.blockedReason) {
            lines.push(`    Reason: ${step.blockedReason}`);
        }
    }

    return lines.join('\n');
}
