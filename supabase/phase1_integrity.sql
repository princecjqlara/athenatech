-- ATHENA Phase 1: System Integrity
-- Narrative checklist atomic fields + Phase 2 wrong-blame prevention
-- Run this in Supabase SQL Editor after phase0_gates.sql

-- =====================================================
-- CREATE NARRATIVE ANALYSIS TABLE (if not exists)
-- Stores structured narrative checklist data per creative
-- =====================================================

CREATE TABLE IF NOT EXISTS narrative_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    meta_creative_id TEXT NOT NULL,
    
    -- CTA Atomic Fields
    cta_present BOOLEAN DEFAULT FALSE,
    cta_has_action_verb BOOLEAN DEFAULT FALSE,
    cta_has_outcome BOOLEAN DEFAULT FALSE,
    cta_has_urgency BOOLEAN DEFAULT FALSE,
    
    -- Value Proposition Atomic Fields  
    benefit_stated BOOLEAN DEFAULT FALSE,
    benefit_quantified BOOLEAN DEFAULT FALSE,
    time_to_benefit_stated BOOLEAN DEFAULT FALSE,
    value_timing TEXT CHECK (value_timing IN ('opening', 'middle', 'end', 'not_present')),
    
    -- Offer Fields
    offer_present BOOLEAN DEFAULT FALSE,
    offer_timing TEXT CHECK (offer_timing IN ('early', 'mid', 'late', 'not_shown')),
    
    -- Other Observable Fields
    proof_present BOOLEAN DEFAULT FALSE,
    pricing_visible BOOLEAN DEFAULT FALSE,
    guarantee_mentioned BOOLEAN DEFAULT FALSE,
    
    -- Alignment (HARD-WALLED: Only used when delivery=healthy AND conversion=bad)
    ad_lp_match TEXT CHECK (ad_lp_match IN ('yes', 'no', 'unsure')) DEFAULT 'unsure',
    
    -- Metadata
    user_confirmed BOOLEAN DEFAULT FALSE,
    llm_assisted BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, meta_creative_id)
);

CREATE INDEX IF NOT EXISTS idx_narrative_analysis_creative 
    ON narrative_analysis(user_id, meta_creative_id);

ALTER TABLE narrative_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own narrative analysis" ON narrative_analysis;
CREATE POLICY "Users can manage own narrative analysis"
    ON narrative_analysis FOR ALL
    USING ((select auth.uid()) = user_id);

-- =====================================================
-- CREATE DELIVERY SCORES TABLE (if not exists)
-- Stores delivery system scores per creative per placement
-- =====================================================

CREATE TABLE IF NOT EXISTS delivery_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    creative_id TEXT NOT NULL,
    
    -- Score data
    delivery_probability DECIMAL,
    structure_rating TEXT,
    
    -- Placement context
    placement TEXT NOT NULL DEFAULT 'unknown',
    objective TEXT,
    aspect_ratio TEXT,
    aspect_ratio_mismatch BOOLEAN DEFAULT FALSE,
    aspect_ratio_warning TEXT,
    
    -- Timestamps
    scored_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, creative_id, placement)
);

CREATE INDEX IF NOT EXISTS idx_delivery_scores_creative 
    ON delivery_scores(user_id, creative_id);

ALTER TABLE delivery_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own delivery scores" ON delivery_scores;
CREATE POLICY "Users can manage own delivery scores"
    ON delivery_scores FOR ALL
    USING ((select auth.uid()) = user_id);


-- =====================================================
-- AD CONTEXT HISTORY: WRONG-BLAME PREVENTION
-- (Already created in phase0_gates.sql, but add enhancements)
-- =====================================================

-- Add indexes for efficient change detection
CREATE INDEX IF NOT EXISTS idx_ad_context_snapshot 
    ON ad_context_history(user_id, meta_ad_id, snapshot_at DESC);


-- =====================================================
-- TRACKING ANOMALY LOG
-- =====================================================

CREATE TABLE IF NOT EXISTS tracking_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    meta_ad_id TEXT NOT NULL,
    
    -- Anomaly details
    anomaly_type TEXT NOT NULL CHECK (anomaly_type IN ('conversion_drop', 'pageview_conversion_mismatch', 'zero_conversions')),
    severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
    message TEXT NOT NULL,
    
    -- Metrics at time of detection
    current_spend DECIMAL,
    current_conversions INT,
    previous_spend DECIMAL,
    previous_conversions INT,
    
    -- Status
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_anomalies_user 
    ON tracking_anomalies(user_id, detected_at DESC);

ALTER TABLE tracking_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tracking anomalies"
    ON tracking_anomalies FOR ALL
    USING ((select auth.uid()) = user_id);


-- =====================================================
-- FATIGUE METRICS HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS fatigue_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    meta_ad_id TEXT NOT NULL,
    
    -- Fatigue indicators
    frequency DECIMAL,
    ctr DECIMAL,
    cpm DECIMAL,
    
    -- Diagnosis
    fatigue_detected BOOLEAN DEFAULT FALSE,
    fatigue_confidence TEXT CHECK (fatigue_confidence IN ('high', 'medium', 'low')),
    fatigue_indicators TEXT[], -- Array of indicator strings
    
    snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fatigue_metrics_ad 
    ON fatigue_metrics(user_id, meta_ad_id, snapshot_at DESC);

ALTER TABLE fatigue_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own fatigue metrics"
    ON fatigue_metrics FOR ALL
    USING ((select auth.uid()) = user_id);


-- =====================================================
-- FUNCTION: Check for wrong-blame conditions
-- Returns TRUE if external factors detected
-- =====================================================

CREATE OR REPLACE FUNCTION check_wrong_blame_conditions(
    p_user_id UUID,
    p_meta_ad_id TEXT,
    p_lookback_days INT DEFAULT 7
)
RETURNS TABLE (
    has_external_factors BOOLEAN,
    context_changes_count INT,
    tracking_anomaly_detected BOOLEAN,
    fatigue_detected BOOLEAN,
    can_blame_creative BOOLEAN,
    summary TEXT
) AS $$
DECLARE
    v_context_changes INT := 0;
    v_tracking_anomaly BOOLEAN := FALSE;
    v_fatigue BOOLEAN := FALSE;
BEGIN
    -- Check for context changes
    SELECT COUNT(*)
    INTO v_context_changes
    FROM ad_context_history
    WHERE user_id = p_user_id
      AND meta_ad_id = p_meta_ad_id
      AND snapshot_at > NOW() - (p_lookback_days || ' days')::INTERVAL
      AND (lp_changed_at IS NOT NULL OR offer_changed_at IS NOT NULL);
    
    -- Check for unresolved tracking anomalies
    SELECT EXISTS(
        SELECT 1 FROM tracking_anomalies
        WHERE user_id = p_user_id
          AND meta_ad_id = p_meta_ad_id
          AND resolved = FALSE
          AND detected_at > NOW() - (p_lookback_days || ' days')::INTERVAL
    ) INTO v_tracking_anomaly;
    
    -- Check for recent fatigue detection
    SELECT EXISTS(
        SELECT 1 FROM fatigue_metrics
        WHERE user_id = p_user_id
          AND meta_ad_id = p_meta_ad_id
          AND fatigue_detected = TRUE
          AND snapshot_at > NOW() - (p_lookback_days || ' days')::INTERVAL
    ) INTO v_fatigue;
    
    -- Return results
    RETURN QUERY SELECT
        (v_context_changes > 0 OR v_tracking_anomaly OR v_fatigue) AS has_external_factors,
        v_context_changes AS context_changes_count,
        v_tracking_anomaly AS tracking_anomaly_detected,
        v_fatigue AS fatigue_detected,
        NOT (v_context_changes > 0 OR v_tracking_anomaly OR v_fatigue) AS can_blame_creative,
        CASE 
            WHEN v_tracking_anomaly THEN 'Tracking anomaly detected - cannot blame creative'
            WHEN v_context_changes > 0 THEN v_context_changes || ' LP/offer changes detected - cannot blame creative'
            WHEN v_fatigue THEN 'Audience fatigue detected - cannot blame creative'
            ELSE 'No external factors - safe to analyze creative'
        END AS summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
