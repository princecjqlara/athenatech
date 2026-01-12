-- Facebook Ads Integration Schema
-- Run this in Supabase SQL Editor after the main schema.sql

-- Meta campaigns table
CREATE TABLE IF NOT EXISTS public.meta_campaigns (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
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

CREATE POLICY "Users can manage own campaigns"
    ON public.meta_campaigns FOR ALL
    USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_user ON public.meta_campaigns(user_id);

-- Meta ad sets table
CREATE TABLE IF NOT EXISTS public.meta_adsets (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    campaign_id TEXT REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT,
    daily_budget DECIMAL(12,2),
    lifetime_budget DECIMAL(12,2),
    targeting JSONB,
    created_time TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own adsets"
    ON public.meta_adsets FOR ALL
    USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_meta_adsets_user ON public.meta_adsets(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_adsets_campaign ON public.meta_adsets(campaign_id);

-- Meta ads table with insights
CREATE TABLE IF NOT EXISTS public.meta_ads (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    campaign_id TEXT REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,
    adset_id TEXT REFERENCES public.meta_adsets(id) ON DELETE CASCADE,
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

CREATE POLICY "Users can manage own ads"
    ON public.meta_ads FOR ALL
    USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_meta_ads_user ON public.meta_ads(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign ON public.meta_ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_adset ON public.meta_ads(adset_id);
CREATE INDEX IF NOT EXISTS idx_meta_ads_status ON public.meta_ads(status);

-- Meta leads table (from Lead Ads)
CREATE TABLE IF NOT EXISTS public.meta_leads (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    ad_id TEXT,
    adset_id TEXT,
    campaign_id TEXT,
    form_id TEXT,
    -- Lead data
    name TEXT,
    email TEXT,
    phone TEXT,
    field_data JSONB,
    -- Status tracking
    status TEXT DEFAULT 'new',
    source TEXT DEFAULT 'Meta Lead Ads',
    created_time TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.meta_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own leads"
    ON public.meta_leads FOR ALL
    USING ((select auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_meta_leads_user ON public.meta_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_leads_status ON public.meta_leads(status);
CREATE INDEX IF NOT EXISTS idx_meta_leads_ad ON public.meta_leads(ad_id);

-- Add unique constraint for upsert on meta_integrations
ALTER TABLE public.meta_integrations 
    DROP CONSTRAINT IF EXISTS meta_integrations_user_id_key;
ALTER TABLE public.meta_integrations 
    ADD CONSTRAINT meta_integrations_user_id_key UNIQUE (user_id);
