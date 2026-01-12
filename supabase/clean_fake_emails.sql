-- Clean up fake Facebook ID emails from meta_leads
-- Run this in Supabase SQL Editor

-- Set email to NULL where it looks like a Facebook ID email
UPDATE public.meta_leads
SET email = NULL
WHERE email LIKE '%@facebook.com';
