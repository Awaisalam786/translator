-- ==============================================================================
-- Migration: 008_add_full_name_and_phone.sql
-- Description: Add full_name and phone_number columns to public.profiles and update trigger
-- Execution: Copy and execute in the Supabase SQL Editor manually.
-- ==============================================================================

-- 1. Add full_name and phone_number columns to public.profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 2. Update trigger to capture full_name and phone_number from raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, trial_started_at, full_name, phone_number)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_app_meta_data->>'role', NEW.raw_user_meta_data->>'role', 'student'),
        NOW(),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
        COALESCE(NEW.raw_user_meta_data->>'phone_number', NULL)
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Ensure RLS Policy allows authenticated users to UPDATE their own profile
DROP POLICY IF EXISTS "Users Update Own Profile" ON public.profiles;
CREATE POLICY "Users Update Own Profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
