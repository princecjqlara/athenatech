-- Add page_access_token column to meta_integrations
-- Run this in Supabase SQL Editor

ALTER TABLE public.meta_integrations 
ADD COLUMN IF NOT EXISTS page_access_token TEXT;
