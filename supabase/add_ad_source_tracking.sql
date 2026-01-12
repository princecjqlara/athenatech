-- Add ad source tracking column to meta_leads
-- Run this in Supabase SQL Editor

-- Add ad_source column to store which ad/campaign the contact came from
ALTER TABLE public.meta_leads 
ADD COLUMN IF NOT EXISTS ad_source TEXT;

-- Add ad_id column for the specific ad ID
ALTER TABLE public.meta_leads 
ADD COLUMN IF NOT EXISTS ad_id TEXT;

-- Add campaign_id for the campaign
ALTER TABLE public.meta_leads 
ADD COLUMN IF NOT EXISTS campaign_id TEXT;

-- Clean up existing fake emails
UPDATE public.meta_leads
SET email = NULL
WHERE email LIKE '%@facebook.com';
