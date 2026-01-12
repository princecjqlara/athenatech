-- ATHENA Phase 4: Audit & Versioning
-- Safety logging, gate audit trail, and version tracking
-- Run after phase3_learning.sql

-- =====================================================
-- GATE AUDIT LOG
-- Tracks every gating decision for debugging and compliance
-- =====================================================

CREATE TABLE IF NOT EXISTS gate_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id UUID NOT NULL,  -- Links related decisions
    user_id UUID REFERENCES profiles(id),
    creative_id TEXT,
    
    -- Decision context
    gate_type TEXT NOT NULL CHECK (gate_type IN (
        'score_attempt',
        'recommendation_gen', 
        'system_activation',
        'eligibility_check'
    )),
    
    -- Full gate status snapshot
    gate_status JSONB NOT NULL,
    
    -- Which systems were activated
    systems_activated TEXT[] DEFAULT '{}',
    
    -- If blocked, why
    blocked BOOLEAN DEFAULT FALSE,
    blocked_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_trace 
    ON gate_audit_log(trace_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_creative 
    ON gate_audit_log(user_id, creative_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_type
    ON gate_audit_log(gate_type, created_at DESC);

ALTER TABLE gate_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audit logs" ON gate_audit_log;
CREATE POLICY "Users can view own audit logs"
    ON gate_audit_log FOR SELECT
    USING ((select auth.uid()) = user_id);

-- Admin policy for debugging (optional)
-- CREATE POLICY "Admins can view all audit logs"
--     ON gate_audit_log FOR SELECT
--     USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));


-- =====================================================
-- VERSIONING: Add version columns to score tables
-- =====================================================

-- Delivery scores versioning
ALTER TABLE delivery_scores 
    ADD COLUMN IF NOT EXISTS structure_schema_version TEXT DEFAULT '1.0',
    ADD COLUMN IF NOT EXISTS scoring_model_version TEXT DEFAULT '1.0',
    ADD COLUMN IF NOT EXISTS gating_rules_version TEXT DEFAULT '1.0';

-- Recommendations versioning
ALTER TABLE recommendations
    ADD COLUMN IF NOT EXISTS recommendation_engine_version TEXT DEFAULT '1.0';

-- Narrative analysis versioning
ALTER TABLE narrative_analysis
    ADD COLUMN IF NOT EXISTS checklist_schema_version TEXT DEFAULT '1.0';


-- =====================================================
-- ATTRIBUTION PERSISTENCE
-- Store user's attribution window setting
-- =====================================================

ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS attribution_window TEXT 
    CHECK (attribution_window IN (
        '1d_click',
        '7d_click', 
        '1d_view',
        '7d_click_1d_view',
        '28d_click'
    )) DEFAULT '7d_click';


-- =====================================================
-- ACCOUNT BASELINES (per conversion type)
-- =====================================================

CREATE TABLE IF NOT EXISTS account_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    
    -- Segmentation keys
    conversion_type TEXT NOT NULL CHECK (conversion_type IN (
        'purchase', 'lead', 'registration', 'add_to_cart', 'view_content', 'other'
    )),
    placement TEXT,           -- NULL = all placements
    objective TEXT,           -- NULL = all objectives
    
    -- Baseline metrics
    avg_cpa DECIMAL,
    avg_roas DECIMAL,
    avg_ctr DECIMAL,
    avg_cvr DECIMAL,
    avg_cpm DECIMAL,
    
    -- Sample quality
    sample_size INT NOT NULL DEFAULT 0,
    total_spend DECIMAL DEFAULT 0,
    total_conversions INT DEFAULT 0,
    
    -- Quality indicator
    quality TEXT GENERATED ALWAYS AS (
        CASE 
            WHEN total_conversions >= 200 THEN 'high'
            WHEN total_conversions >= 50 THEN 'medium'
            WHEN total_conversions >= 10 THEN 'low'
            ELSE 'none'
        END
    ) STORED,
    
    -- Exclusions applied
    promo_days_excluded INT DEFAULT 0,
    
    -- Timestamps
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    period_start DATE,
    period_end DATE,
    
    UNIQUE(user_id, conversion_type, placement, objective)
);

CREATE INDEX IF NOT EXISTS idx_baselines_user
    ON account_baselines(user_id, conversion_type);

ALTER TABLE account_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own baselines" ON account_baselines;
CREATE POLICY "Users can manage own baselines"
    ON account_baselines FOR ALL
    USING ((select auth.uid()) = user_id);


-- =====================================================
-- FUNCTION: Log gate decision
-- =====================================================

CREATE OR REPLACE FUNCTION log_gate_decision(
    p_trace_id UUID,
    p_user_id UUID,
    p_creative_id TEXT,
    p_gate_type TEXT,
    p_gate_status JSONB,
    p_systems_activated TEXT[] DEFAULT '{}',
    p_blocked BOOLEAN DEFAULT FALSE,
    p_blocked_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO gate_audit_log (
        trace_id,
        user_id,
        creative_id,
        gate_type,
        gate_status,
        systems_activated,
        blocked,
        blocked_reason
    ) VALUES (
        p_trace_id,
        p_user_id,
        p_creative_id,
        p_gate_type,
        p_gate_status,
        p_systems_activated,
        p_blocked,
        p_blocked_reason
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- FUNCTION: Get audit trail for debugging
-- =====================================================

CREATE OR REPLACE FUNCTION get_audit_trail(
    p_trace_id UUID
)
RETURNS TABLE (
    step_order INT,
    gate_type TEXT,
    systems_activated TEXT[],
    blocked BOOLEAN,
    blocked_reason TEXT,
    created_at TIMESTAMPTZ,
    gate_status JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROW_NUMBER() OVER (ORDER BY gal.created_at)::INT AS step_order,
        gal.gate_type,
        gal.systems_activated,
        gal.blocked,
        gal.blocked_reason,
        gal.created_at,
        gal.gate_status
    FROM gate_audit_log gal
    WHERE gal.trace_id = p_trace_id
    ORDER BY gal.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
