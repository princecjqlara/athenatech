-- Add message count tracking for webhook re-analysis
-- Run this in Supabase SQL Editor

-- Add message_count column to track messages for re-analysis
ALTER TABLE public.meta_leads 
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- Add last_analyzed_at to track when AI last analyzed
ALTER TABLE public.meta_leads 
ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMPTZ;
