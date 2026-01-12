-- Fix for dev mode: Allow meta_integrations to work without profiles FK
-- Run this in Supabase SQL Editor

-- Option 1: Temporarily drop the FK constraint (simplest for dev)
ALTER TABLE public.meta_integrations 
DROP CONSTRAINT IF EXISTS meta_integrations_user_id_fkey;

-- Make user_id just a regular UUID column without FK reference
-- This allows dev mode to work without a real user in profiles

-- Note: If you want to restore the FK later for production:
-- ALTER TABLE public.meta_integrations
-- ADD CONSTRAINT meta_integrations_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
