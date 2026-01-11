-- ATHENA Phase 3: Learning Loop
-- Recommendation cron job and monthly summary tables
-- Run this in Supabase SQL Editor after phase1_integrity.sql

-- =====================================================
-- MONTHLY LEARNING SUMMARIES
-- =====================================================

CREATE TABLE IF NOT EXISTS monthly_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    month TEXT NOT NULL, -- YYYY-MM format
    
    -- Counts
    recommendations_generated INT DEFAULT 0,
    recommendations_followed INT DEFAULT 0,
    recommendations_ignored INT DEFAULT 0,
    outcomes_measured INT DEFAULT 0,
    
    -- Rates
    follow_rate DECIMAL,
    success_rate DECIMAL,
    avg_cpa_improvement DECIMAL,
    
    -- Top performers (JSON array)
    top_performing_types JSONB DEFAULT '[]',
    
    -- Insights (JSON array of strings)
    insights JSONB DEFAULT '[]',
    
    -- Timestamps
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_learnings_user 
    ON monthly_learnings(user_id, month DESC);

ALTER TABLE monthly_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monthly learnings"
    ON monthly_learnings FOR ALL
    USING (auth.uid() = user_id);


-- =====================================================
-- FUNCTION: Generate monthly summary
-- Called by cron on the 1st of each month
-- =====================================================

CREATE OR REPLACE FUNCTION generate_monthly_summary(
    p_user_id UUID,
    p_month TEXT  -- YYYY-MM format
)
RETURNS UUID AS $$
DECLARE
    v_summary_id UUID;
    v_generated INT;
    v_followed INT;
    v_ignored INT;
    v_measured INT;
    v_improved INT;
    v_cpa_improvements DECIMAL[];
    v_avg_cpa DECIMAL;
    v_follow_rate DECIMAL;
    v_success_rate DECIMAL;
    v_top_types JSONB;
    v_insights TEXT[];
BEGIN
    -- Count recommendations for this month
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'followed'),
        COUNT(*) FILTER (WHERE status = 'ignored'),
        COUNT(*) FILTER (WHERE status = 'followed' AND outcome_verdict IS NOT NULL),
        COUNT(*) FILTER (WHERE status = 'followed' AND outcome_verdict = 'improved')
    INTO v_generated, v_followed, v_ignored, v_measured, v_improved
    FROM recommendations
    WHERE user_id = p_user_id
      AND TO_CHAR(created_at, 'YYYY-MM') = p_month;
    
    -- Calculate rates
    v_follow_rate := CASE WHEN v_generated > 0 THEN (v_followed::DECIMAL / v_generated) * 100 ELSE 0 END;
    v_success_rate := CASE WHEN v_measured > 0 THEN (v_improved::DECIMAL / v_measured) * 100 ELSE 0 END;
    
    -- Calculate average CPA improvement
    SELECT AVG(outcome_cpa_change)
    INTO v_avg_cpa
    FROM recommendations
    WHERE user_id = p_user_id
      AND TO_CHAR(created_at, 'YYYY-MM') = p_month
      AND outcome_cpa_change IS NOT NULL;
    
    -- Get top performing types
    SELECT COALESCE(jsonb_agg(t ORDER BY t.success_rate DESC), '[]')
    INTO v_top_types
    FROM (
        SELECT 
            recommendation_type AS type,
            (COUNT(*) FILTER (WHERE outcome_verdict = 'improved')::DECIMAL / NULLIF(COUNT(*), 0)) * 100 AS success_rate
        FROM recommendations
        WHERE user_id = p_user_id
          AND TO_CHAR(created_at, 'YYYY-MM') = p_month
          AND outcome_verdict IS NOT NULL
        GROUP BY recommendation_type
        HAVING COUNT(*) >= 3
        ORDER BY success_rate DESC
        LIMIT 3
    ) t;
    
    -- Generate insights
    v_insights := ARRAY[]::TEXT[];
    
    IF v_follow_rate < 30 THEN
        v_insights := array_append(v_insights, 'Low follow rate. Consider testing more recommendations.');
    END IF;
    
    IF v_success_rate >= 60 THEN
        v_insights := array_append(v_insights, 'Great success rate! Your recommendations are effective.');
    ELSIF v_success_rate < 30 AND v_measured >= 5 THEN
        v_insights := array_append(v_insights, 'Low success rate. Review recommendation types that work best.');
    END IF;
    
    IF v_improved >= 5 THEN
        v_insights := array_append(v_insights, v_improved || ' recommendations improved performance this month.');
    END IF;
    
    -- Upsert monthly summary
    INSERT INTO monthly_learnings (
        user_id,
        month,
        recommendations_generated,
        recommendations_followed,
        recommendations_ignored,
        outcomes_measured,
        follow_rate,
        success_rate,
        avg_cpa_improvement,
        top_performing_types,
        insights,
        generated_at
    ) VALUES (
        p_user_id,
        p_month,
        v_generated,
        v_followed,
        v_ignored,
        v_measured,
        v_follow_rate,
        v_success_rate,
        COALESCE(v_avg_cpa, 0),
        v_top_types,
        to_jsonb(v_insights),
        NOW()
    )
    ON CONFLICT (user_id, month) DO UPDATE SET
        recommendations_generated = EXCLUDED.recommendations_generated,
        recommendations_followed = EXCLUDED.recommendations_followed,
        recommendations_ignored = EXCLUDED.recommendations_ignored,
        outcomes_measured = EXCLUDED.outcomes_measured,
        follow_rate = EXCLUDED.follow_rate,
        success_rate = EXCLUDED.success_rate,
        avg_cpa_improvement = EXCLUDED.avg_cpa_improvement,
        top_performing_types = EXCLUDED.top_performing_types,
        insights = EXCLUDED.insights,
        generated_at = EXCLUDED.generated_at
    RETURNING id INTO v_summary_id;
    
    RETURN v_summary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- FUNCTION: Measure pending recommendation outcomes
-- Called by cron daily
-- =====================================================

CREATE OR REPLACE FUNCTION measure_pending_outcomes()
RETURNS INT AS $$
DECLARE
    v_count INT := 0;
    v_rec RECORD;
BEGIN
    -- Find followed recommendations that are due for measurement
    FOR v_rec IN (
        SELECT r.id, r.user_id, r.meta_creative_id, r.run_duration_days, r.followed_at
        FROM recommendations r
        WHERE r.status = 'followed'
          AND r.outcome_verdict IS NULL
          AND r.followed_at < NOW() - (r.run_duration_days || ' days')::INTERVAL
    ) LOOP
        -- Call the outcome measurement function
        PERFORM measure_recommendation_outcome(
            v_rec.id,
            v_rec.user_id,
            v_rec.meta_creative_id
        );
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================
-- CROSS-ACCOUNT PATTERNS (Anonymized)
-- Optional: for showing "Similar accounts" insights
-- =====================================================

CREATE TABLE IF NOT EXISTS cross_account_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_type TEXT NOT NULL,
    vertical TEXT, -- Optional vertical/industry
    
    -- Aggregated stats
    account_count INT DEFAULT 0,
    total_sample_size INT DEFAULT 0,
    avg_success_rate DECIMAL,
    avg_cpa_improvement DECIMAL,
    
    -- Timestamps
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(recommendation_type, vertical)
);

-- Note: This table is populated by a background job that aggregates
-- anonymized patterns across accounts. No user-specific data is stored.
