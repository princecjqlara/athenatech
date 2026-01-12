-- ATHENA RLS Performance Fix Migration
-- Run this in Supabase SQL Editor to fix performance warnings
-- These changes wrap auth.uid() in (select ...) to prevent re-evaluation per row

-- =====================================================
-- FIX RLS POLICIES - Wrap auth.uid() with (select ...)
-- =====================================================

-- 1. meta_integrations (from schema.sql)
DROP POLICY IF EXISTS "Users can manage own integrations" ON public.meta_integrations;
CREATE POLICY "Users can manage own integrations"
  ON public.meta_integrations FOR ALL
  USING ((select auth.uid()) = user_id);

-- 2. recommendations (from phase0_gates.sql)
DROP POLICY IF EXISTS "Users can manage own recommendations" ON public.recommendations;
CREATE POLICY "Users can manage own recommendations"
    ON public.recommendations FOR ALL
    USING ((select auth.uid()) = user_id);

-- 3. scoring_gates (from phase0_gates.sql)
DROP POLICY IF EXISTS "Users can manage own scoring gates" ON public.scoring_gates;
CREATE POLICY "Users can manage own scoring gates"
    ON public.scoring_gates FOR ALL
    USING ((select auth.uid()) = user_id);

-- 4. ad_context_history (from phase0_gates.sql)
DROP POLICY IF EXISTS "Users can manage own ad context history" ON public.ad_context_history;
CREATE POLICY "Users can manage own ad context history"
    ON public.ad_context_history FOR ALL
    USING ((select auth.uid()) = user_id);

-- 5. narrative_analysis (from phase1_integrity.sql)
DROP POLICY IF EXISTS "Users can manage own narrative analysis" ON public.narrative_analysis;
CREATE POLICY "Users can manage own narrative analysis"
    ON public.narrative_analysis FOR ALL
    USING ((select auth.uid()) = user_id);

-- 6. delivery_scores (from phase1_integrity.sql)
DROP POLICY IF EXISTS "Users can manage own delivery scores" ON public.delivery_scores;
CREATE POLICY "Users can manage own delivery scores"
    ON public.delivery_scores FOR ALL
    USING ((select auth.uid()) = user_id);

-- 7. tracking_anomalies (from phase1_integrity.sql)
DROP POLICY IF EXISTS "Users can manage own tracking anomalies" ON public.tracking_anomalies;
CREATE POLICY "Users can manage own tracking anomalies"
    ON public.tracking_anomalies FOR ALL
    USING ((select auth.uid()) = user_id);

-- 8. fatigue_metrics (from phase1_integrity.sql)
DROP POLICY IF EXISTS "Users can manage own fatigue metrics" ON public.fatigue_metrics;
CREATE POLICY "Users can manage own fatigue metrics"
    ON public.fatigue_metrics FOR ALL
    USING ((select auth.uid()) = user_id);

-- 9. monthly_learnings (from phase3_learning.sql)
DROP POLICY IF EXISTS "Users can view own monthly learnings" ON public.monthly_learnings;
CREATE POLICY "Users can view own monthly learnings"
    ON public.monthly_learnings FOR ALL
    USING ((select auth.uid()) = user_id);

-- 10. gate_audit_log (from phase4_audit.sql)
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.gate_audit_log;
CREATE POLICY "Users can view own audit logs"
    ON public.gate_audit_log FOR SELECT
    USING ((select auth.uid()) = user_id);

-- 11. account_baselines (from phase4_audit.sql)
DROP POLICY IF EXISTS "Users can manage own baselines" ON public.account_baselines;
CREATE POLICY "Users can manage own baselines"
    ON public.account_baselines FOR ALL
    USING ((select auth.uid()) = user_id);

-- 12. extraction_jobs (if exists)
DROP POLICY IF EXISTS "Users can manage own extractions" ON public.extraction_jobs;
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'extraction_jobs') THEN
        EXECUTE 'CREATE POLICY "Users can manage own extractions" ON public.extraction_jobs FOR ALL USING ((select auth.uid()) = user_id)';
    END IF;
END $$;

-- 13. meta_campaigns (from facebook_integration.sql)
DROP POLICY IF EXISTS "Users can manage own campaigns" ON public.meta_campaigns;
CREATE POLICY "Users can manage own campaigns"
    ON public.meta_campaigns FOR ALL
    USING ((select auth.uid()) = user_id);

-- 14. meta_adsets (from facebook_integration.sql)
DROP POLICY IF EXISTS "Users can manage own adsets" ON public.meta_adsets;
CREATE POLICY "Users can manage own adsets"
    ON public.meta_adsets FOR ALL
    USING ((select auth.uid()) = user_id);

-- 15. meta_ads (from facebook_integration.sql)
DROP POLICY IF EXISTS "Users can manage own ads" ON public.meta_ads;
CREATE POLICY "Users can manage own ads"
    ON public.meta_ads FOR ALL
    USING ((select auth.uid()) = user_id);

-- 16. meta_leads (from facebook_integration.sql)
DROP POLICY IF EXISTS "Users can manage own leads" ON public.meta_leads;
CREATE POLICY "Users can manage own leads"
    ON public.meta_leads FOR ALL
    USING ((select auth.uid()) = user_id);

-- =====================================================
-- FIX DUPLICATE INDEX
-- Remove one of the duplicate indexes on ad_context_history
-- =====================================================

DROP INDEX IF EXISTS idx_ad_context_snapshot;
-- Keep idx_ad_context_history_ad as it has a more descriptive name

-- =====================================================
-- ALSO FIX invite_codes policies that use auth.uid()
-- =====================================================

DROP POLICY IF EXISTS "Admins can insert invite codes" ON public.invite_codes;
CREATE POLICY "Admins can insert invite codes"
  ON public.invite_codes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete invite codes" ON public.invite_codes;
CREATE POLICY "Admins can delete invite codes"
  ON public.invite_codes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
  );

-- =====================================================
-- VERIFICATION QUERY (Optional - check your policies)
-- =====================================================

-- Run this to verify the changes:
-- SELECT policyname, tablename, qual FROM pg_policies WHERE schemaname = 'public';
