-- ==============================================================================
-- Migration: 006_free_trial_and_user_licenses.sql
-- Description: Add 3-Day Free Trial, user_id Foreign Keys & Strict RLS Policies
-- Target Database: Supabase PostgreSQL
-- Execution: Copy and execute in the Supabase SQL Editor manually.
-- ==============================================================================

-- ── 1. SCHEMA CHANGES ────────────────────────────────────────────────────────

-- Add trial_started_at column to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW();

-- Add user_id & expires_at columns to public.licenses
ALTER TABLE public.licenses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add user_id column to public.payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON public.licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);


-- ── 2. AUTOMATIC PROFILE & TRIAL TRIGGER ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, trial_started_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_app_meta_data->>'role', NEW.raw_user_meta_data->>'role', 'student'),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 3. STRICT RLS POLICIES FOR PAYMENTS & LICENSES ────────────────────────────

-- Enable RLS
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Reset previous policies
DROP POLICY IF EXISTS "Public Validate Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Users Read Own Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admin Manage Licenses" ON public.licenses;

DROP POLICY IF EXISTS "Student Submit Payment Proof" ON public.payments;
DROP POLICY IF EXISTS "Users Read Own Payments" ON public.payments;
DROP POLICY IF EXISTS "Admin Manage Payments" ON public.payments;


-- ── RLS: LICENSES ────────────────────────────────────────────────────────────

-- Allow students to SELECT ONLY their own licenses (or unassigned keys being validated)
CREATE POLICY "Users Read Own Licenses"
ON public.licenses FOR SELECT
TO anon, authenticated
USING (
  user_id = auth.uid() OR
  user_id IS NULL OR
  public.is_admin()
);

-- Admins retain full management over all licenses
CREATE POLICY "Admin Manage Licenses"
ON public.licenses FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ── RLS: PAYMENTS ────────────────────────────────────────────────────────────

-- Students can ONLY INSERT payment proofs under their own authenticated auth.uid() account
CREATE POLICY "Student Submit Payment Proof"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  status = 'Pending' AND
  generated_key IS NULL
);

-- Logged-in students can SELECT ONLY their own submitted payment proofs
CREATE POLICY "Users Read Own Payments"
ON public.payments FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  public.is_admin()
);

-- Admins retain full management over all payments
CREATE POLICY "Admin Manage Payments"
ON public.payments FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
