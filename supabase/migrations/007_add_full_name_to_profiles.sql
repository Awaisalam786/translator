-- ==============================================================================
-- Migration: 007_add_full_name_to_profiles.sql
-- Description: Add full_name column to public.profiles and allow user update policy
-- Execution: Copy and execute in the Supabase SQL Editor manually.
-- ==============================================================================

-- 1. Add full_name column to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. Ensure RLS Policy allows authenticated users to UPDATE their own profile
DROP POLICY IF EXISTS "Users Update Own Profile" ON public.profiles;
CREATE POLICY "Users Update Own Profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
