-- Add missing columns to meta_leads table for Messenger sync
-- Run this in Supabase SQL Editor

-- Add page_id column if it doesn't exist
ALTER TABLE public.meta_leads 
ADD COLUMN IF NOT EXISTS page_id TEXT;

-- Add source column if it doesn't exist  
ALTER TABLE public.meta_leads 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Meta Lead Ads';

-- Add full_name as alias for name (in case code uses either)
-- Skip if already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'meta_leads' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE public.meta_leads ADD COLUMN full_name TEXT;
    END IF;
END $$;
