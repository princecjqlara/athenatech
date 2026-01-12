-- Add optional columns to meta_integrations for better UX
-- Run this in Supabase SQL Editor (optional - app works without these)

-- Add account name for display
ALTER TABLE public.meta_integrations 
ADD COLUMN IF NOT EXISTS ad_account_name TEXT;

-- Add page name for display
ALTER TABLE public.meta_integrations 
ADD COLUMN IF NOT EXISTS page_name TEXT;

-- Add page access token for lead retrieval
ALTER TABLE public.meta_integrations 
ADD COLUMN IF NOT EXISTS page_access_token TEXT;

-- Add unique constraint on user_id for upsert operations (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'meta_integrations_user_id_key'
    ) THEN
        ALTER TABLE public.meta_integrations 
        ADD CONSTRAINT meta_integrations_user_id_key UNIQUE (user_id);
    END IF;
END $$;
