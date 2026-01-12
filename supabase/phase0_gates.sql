-- ATHENA Phase 0: Foundation & Gates
-- Recommendations tracking + Scoring gates tables
-- Run this in Supabase SQL Editor after schema.sql

-- =====================================================
-- RECOMMENDATIONS TABLE
-- Tracks all recommendations with outcome measurement
-- =====================================================

create table if not exists public.recommendations (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) not null,
    
    -- Source tracking
    source_system text not null check (source_system in ('structure', 'narrative', 'conversion')),
    source_creative_id uuid,  -- References creative if applicable
    source_ad_id text,        -- Meta ad ID
    
    -- Recommendation content
    recommendation_type text not null,  -- e.g., 'motion_timing', 'value_placement', 'funnel_fix'
    recommendation_text text not null,
    
    -- Specificity fields (all required for valid recommendations)
    what_to_change text not null,       -- "Move CTA earlier"
    target_range text not null,         -- "0-3s instead of 8s"
    observable_gap text not null,       -- "CTA currently at 8s"
    metric_to_watch text not null,      -- "CTR, CVR"
    run_duration_days int not null default 7,
    confidence text not null default 'medium' check (confidence in ('high', 'medium', 'low')),
    
    -- Outcome tracking
    status text default 'pending' check (status in ('pending', 'followed', 'ignored', 'partial')),
    followed_at timestamp with time zone,
    linked_creative_id uuid,            -- New creative created based on this
    outcome_cpa_change decimal,         -- % change vs original
    outcome_roas_change decimal,
    outcome_conversions int,            -- Sample size for outcome
    outcome_measured_at timestamp with time zone,
    outcome_verdict text check (outcome_verdict in ('improved', 'neutral', 'declined', 'insufficient_data')),
    
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Index for account-level learning queries
create index if not exists idx_recommendations_user_type 
    on public.recommendations(user_id, recommendation_type, outcome_verdict);

create index if not exists idx_recommendations_pending
    on public.recommendations(user_id, status) where status = 'pending';

-- Enable RLS
alter table public.recommendations enable row level security;

create policy "Users can manage own recommendations"
    on public.recommendations for all
    using ((select auth.uid()) = user_id);


-- =====================================================
-- SCORING GATES TABLE
-- Cached gate status per creative
-- =====================================================

create table if not exists public.scoring_gates (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) not null,
    creative_id uuid not null,  -- Internal creative reference
    meta_ad_id text,            -- Meta ad ID for linking
    
    -- Age gate
    first_seen_at timestamp with time zone not null default now(),
    age_gate_passed boolean default false,
    age_gate_passed_at timestamp with time zone,
    
    -- Spend gate
    total_spend decimal default 0,
    spend_gate_passed boolean default false,
    spend_gate_passed_at timestamp with time zone,
    
    -- Impression gates
    total_impressions bigint default 0,
    impression_gate_medium boolean default false,  -- >=1000
    impression_gate_high boolean default false,    -- >=5000
    
    -- Conversion gates (from System 3)
    total_conversions int default 0,
    conversion_gate_low boolean default false,     -- >=10
    conversion_gate_medium boolean default false,  -- >=30
    conversion_gate_high boolean default false,    -- >=100
    
    -- iOS / attribution penalties
    ios_traffic_percent decimal,
    modeled_conversion_percent decimal,
    attribution_window text default '7d_click_1d_view',
    
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    
    -- Unique constraint per user + creative
    unique(user_id, creative_id)
);

-- Index for quick gate lookups
create index if not exists idx_scoring_gates_user_creative 
    on public.scoring_gates(user_id, creative_id);

create index if not exists idx_scoring_gates_meta_ad 
    on public.scoring_gates(user_id, meta_ad_id);

-- Enable RLS
alter table public.scoring_gates enable row level security;

create policy "Users can manage own scoring gates"
    on public.scoring_gates for all
    using ((select auth.uid()) = user_id);


-- =====================================================
-- AD CONTEXT HISTORY TABLE
-- Tracks LP/offer changes for wrong-blame prevention
-- =====================================================

create table if not exists public.ad_context_history (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.profiles(id) not null,
    meta_ad_id text not null,
    
    -- Landing page tracking
    destination_url text,
    lp_url_hash text,  -- SHA256 hash of normalized URL
    lp_changed_at timestamp with time zone,
    
    -- Offer tracking (from ad copy)
    discount_detected text,           -- "50% off", "₱500 discount"
    price_detected text,              -- "₱999"
    guarantee_detected boolean,
    offer_changed_at timestamp with time zone,
    
    -- Snapshot metadata
    snapshot_at timestamp with time zone default now(),
    previous_snapshot_id uuid references public.ad_context_history(id),
    
    created_at timestamp with time zone default now()
);

-- Index for change detection queries
create index if not exists idx_ad_context_history_ad 
    on public.ad_context_history(user_id, meta_ad_id, snapshot_at desc);

-- Enable RLS
alter table public.ad_context_history enable row level security;

create policy "Users can manage own ad context history"
    on public.ad_context_history for all
    using ((select auth.uid()) = user_id);


-- =====================================================
-- FUNCTION: Update gates from metrics
-- =====================================================

create or replace function public.update_scoring_gates(
    p_user_id uuid,
    p_creative_id uuid,
    p_meta_ad_id text,
    p_spend decimal,
    p_impressions bigint,
    p_conversions int,
    p_ios_percent decimal default null,
    p_modeled_percent decimal default null
)
returns void as $$
declare
    v_gate_record public.scoring_gates%rowtype;
    v_age_hours decimal;
begin
    -- Upsert the gate record
    insert into public.scoring_gates (
        user_id, creative_id, meta_ad_id,
        total_spend, total_impressions, total_conversions,
        ios_traffic_percent, modeled_conversion_percent
    )
    values (
        p_user_id, p_creative_id, p_meta_ad_id,
        p_spend, p_impressions, p_conversions,
        p_ios_percent, p_modeled_percent
    )
    on conflict (user_id, creative_id) do update set
        total_spend = p_spend,
        total_impressions = p_impressions,
        total_conversions = p_conversions,
        ios_traffic_percent = coalesce(p_ios_percent, scoring_gates.ios_traffic_percent),
        modeled_conversion_percent = coalesce(p_modeled_percent, scoring_gates.modeled_conversion_percent),
        updated_at = now()
    returning * into v_gate_record;
    
    -- Calculate age in hours
    v_age_hours := extract(epoch from (now() - v_gate_record.first_seen_at)) / 3600;
    
    -- Update gate flags
    update public.scoring_gates set
        -- Age gate: 48 hours
        age_gate_passed = (v_age_hours >= 48),
        age_gate_passed_at = case 
            when not age_gate_passed and v_age_hours >= 48 then now() 
            else age_gate_passed_at 
        end,
        
        -- Spend gate: ₱1000
        spend_gate_passed = (p_spend >= 1000),
        spend_gate_passed_at = case 
            when not spend_gate_passed and p_spend >= 1000 then now() 
            else spend_gate_passed_at 
        end,
        
        -- Impression gates
        impression_gate_medium = (p_impressions >= 1000),
        impression_gate_high = (p_impressions >= 5000),
        
        -- Conversion gates
        conversion_gate_low = (p_conversions >= 10),
        conversion_gate_medium = (p_conversions >= 30),
        conversion_gate_high = (p_conversions >= 100)
    where id = v_gate_record.id;
end;
$$ language plpgsql security definer;


-- =====================================================
-- FUNCTION: Measure recommendation outcomes
-- =====================================================

create or replace function public.measure_recommendation_outcome(
    p_recommendation_id uuid,
    p_linked_cpa decimal,
    p_linked_roas decimal,
    p_linked_conversions int,
    p_original_cpa decimal,
    p_original_roas decimal
)
returns void as $$
declare
    v_cpa_change decimal;
    v_roas_change decimal;
    v_verdict text;
begin
    -- Check minimum conversions
    if p_linked_conversions < 30 then
        update public.recommendations set
            outcome_verdict = 'insufficient_data',
            outcome_conversions = p_linked_conversions,
            outcome_measured_at = now(),
            updated_at = now()
        where id = p_recommendation_id;
        return;
    end if;
    
    -- Calculate changes
    v_cpa_change := case 
        when p_original_cpa > 0 then ((p_linked_cpa - p_original_cpa) / p_original_cpa) * 100 
        else 0 
    end;
    
    v_roas_change := case 
        when p_original_roas > 0 then ((p_linked_roas - p_original_roas) / p_original_roas) * 100 
        else 0 
    end;
    
    -- Determine verdict
    if v_cpa_change < -10 or v_roas_change > 10 then
        v_verdict := 'improved';
    elsif v_cpa_change > 10 or v_roas_change < -10 then
        v_verdict := 'declined';
    else
        v_verdict := 'neutral';
    end if;
    
    -- Update recommendation
    update public.recommendations set
        outcome_cpa_change = v_cpa_change,
        outcome_roas_change = v_roas_change,
        outcome_conversions = p_linked_conversions,
        outcome_measured_at = now(),
        outcome_verdict = v_verdict,
        updated_at = now()
    where id = p_recommendation_id;
end;
$$ language plpgsql security definer;
