-- ATHENA Gap Remediation Migrations
-- Phase 5: Alerting, Extraction, Privacy
-- Run after phase4_audit.sql

-- =====================================================
-- GAP 1: System Alerts Table
-- =====================================================

CREATE TABLE IF NOT EXISTS system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    message TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_unresolved 
    ON system_alerts(severity, created_at DESC) 
    WHERE resolved_at IS NULL;

-- =====================================================
-- GAP 3: Onboarding Tracking
-- =====================================================

ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS onboarding_version INT DEFAULT 0;

-- =====================================================
-- GAP 4: Privacy Opt-Out
-- =====================================================

ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS share_aggregates BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS share_aggregates_updated_at TIMESTAMPTZ;

-- =====================================================
-- GAP 5: Extraction Jobs State Machine
-- =====================================================

CREATE TABLE IF NOT EXISTS extraction_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    creative_id TEXT NOT NULL,
    
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'complete', 'partial', 'failed')),
    
    extracted_signals TEXT[] DEFAULT '{}',
    missing_signals TEXT[] DEFAULT '{}',
    error_message TEXT,
    
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    UNIQUE(user_id, creative_id)
);

CREATE INDEX IF NOT EXISTS idx_extraction_status 
    ON extraction_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_extraction_pending
    ON extraction_jobs(started_at)
    WHERE status = 'pending';

ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own extractions" ON extraction_jobs;
CREATE POLICY "Users can manage own extractions"
    ON extraction_jobs FOR ALL
    USING (auth.uid() = user_id);

-- =====================================================
-- GAP 1: Ingestion Health Check Function
-- =====================================================

CREATE OR REPLACE FUNCTION check_ingestion_health(
    hours_threshold INT,
    min_active_users INT
) RETURNS TABLE(healthy BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    WITH active_users AS (
        SELECT COUNT(DISTINCT user_id) as cnt
        FROM scoring_gates
        WHERE updated_at > NOW() - INTERVAL '7 days'
    ),
    recent_data AS (
        SELECT COUNT(*) as cnt
        FROM ad_context_history
        WHERE created_at > NOW() - (hours_threshold || ' hours')::INTERVAL
    )
    SELECT 
        (SELECT cnt FROM active_users) < min_active_users 
        OR (SELECT cnt FROM recent_data) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GAP 1: Gate Failure Rate Check Function
-- =====================================================

CREATE OR REPLACE FUNCTION check_gate_failure_rate(
    hours INT,
    failure_threshold DECIMAL,
    min_decisions INT
) RETURNS TABLE(healthy BOOLEAN) AS $$
DECLARE
    total_decisions INT;
    failed_decisions INT;
BEGIN
    SELECT COUNT(*) INTO total_decisions
    FROM gate_audit_log
    WHERE created_at > NOW() - (hours || ' hours')::INTERVAL;
    
    SELECT COUNT(*) INTO failed_decisions
    FROM gate_audit_log
    WHERE created_at > NOW() - (hours || ' hours')::INTERVAL
    AND blocked = TRUE;
    
    -- Healthy if not enough decisions to judge, or failure rate below threshold
    RETURN QUERY
    SELECT 
        total_decisions < min_decisions 
        OR (failed_decisions::DECIMAL / NULLIF(total_decisions, 0)) < failure_threshold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
