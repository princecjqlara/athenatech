-- Complete Schema Setup for Meta Ads Sync
-- Run this in Supabase SQL Editor to enable syncing
-- This file combines and fixes all needed tables for the sync feature

-- ============================================
-- STEP 1: Create Meta Campaigns Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.meta_campaigns (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,  -- No FK to profiles for dev mode compatibility
    name TEXT NOT NULL,
    objective TEXT,
    status TEXT,
    daily_budget DECIMAL(12,2),
    lifetime_budget DECIMAL(12,2),
    created_time TIMESTAMP WITH TIME ZONE,
    updated_time TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists and recreate
DROP POLICY IF EXISTS "Users can manage own campaigns" ON public.meta_campaigns;
CREATE POLICY "Users can manage own campaigns"
    ON public.meta_campaigns FOR ALL
    USING (true);  -- Permissive for dev mode

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_user ON public.meta_campaigns(user_id);

-- ============================================
-- STEP 2: Create Meta Ad Sets Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.meta_adsets (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    campaign_id TEXT,  -- No FK for dev mode
    name TEXT NOT NULL,
    status TEXT,
    daily_budget DECIMAL(12,2),
    lifetime_budget DECIMAL(12,2),
    targeting JSONB,
    created_time TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own adsets" ON public.meta_adsets;
CREATE POLICY "Users can manage own adsets"
    ON public.meta_adsets FOR ALL
    USING (true);

CREATE INDEX IF NOT EXISTS idx_meta_adsets_user ON public.meta_adsets(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign ON public.meta_adsets(campaign_id);

-- ============================================
-- STEP 3: Create Meta Ads Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.meta_ads (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    campaign_id TEXT,
    adset_id TEXT,
    name TEXT NOT NULL,
    status TEXT,
    creative_id TEXT,
    thumbnail_url TEXT,
    video_id TEXT,
    created_time TIMESTAMP WITH TIME ZONE,
    -- Performance metrics
    spend DECIMAL(12,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    ctr DECIMAL(8,4) DEFAULT 0,
    cpc DECIMAL(12,4) DEFAULT 0,
    cpm DECIMAL(12,4) DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    -- Video metrics
    video_p25 INTEGER DEFAULT 0,
    video_p50 INTEGER DEFAULT 0,
    video_p75 INTEGER DEFAULT 0,
    video_p95 INTEGER DEFAULT 0,
    video_thruplay INTEGER DEFAULT 0,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own ads" ON public.meta_ads;
CREATE POLICY "Users can manage own ads"
    ON public.meta_ads FOR ALL
    USING (true);

CREATE INDEX IF NOT EXISTS idx_meta_ads_user ON public.meta_ads(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON public.meta_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset ON public.meta_ads(adset_id);

-- ============================================
-- STEP 4: Create Meta Leads Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.meta_leads (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    form_id TEXT,
    campaign_id TEXT,
    adset_id TEXT,
    ad_id TEXT,
    name TEXT,
    email TEXT,
    phone TEXT,
    field_data JSONB,
    status TEXT DEFAULT 'new',
    created_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.meta_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own leads" ON public.meta_leads;
CREATE POLICY "Users can manage own leads"
    ON public.meta_leads FOR ALL
    USING (true);

CREATE INDEX IF NOT EXISTS idx_meta_leads_user ON public.meta_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_ad ON public.meta_leads(ad_id);

-- ============================================
-- Success message
-- ============================================
SELECT 'Meta Ads tables created successfully!' as result;
