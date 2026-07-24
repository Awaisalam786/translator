-- ==============================================================================
-- Migration: 003_rbac_profiles_security.sql
-- Description: Production RBAC with public.profiles Table & Strict is_admin() Authorization
-- Requirements:
--   - Role-Based Access Control (RBAC) via public.profiles table.
--   - Strict is_admin() checks (auth.uid() matching role = 'admin' in profiles).
--   - Zero permissive auth.role() = 'authenticated' checks.
--   - Automatic profile creation trigger on auth.users sign up.
-- ==============================================================================

-- 1. Create Profiles Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast RBAC role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Automatic Profile Generation Trigger on User Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_app_meta_data->>'role', NEW.raw_user_meta_data->>'role', 'student')
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


-- ==============================================================================
-- 3. Production Authorization Function: is_admin()
-- Checks explicitly against public.profiles for role = 'admin'
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ==============================================================================
-- 4. Reset & Re-apply RLS Policies
-- ==============================================================================

-- Drop Previous Policies
DROP POLICY IF EXISTS "Users Read Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins Manage Profiles" ON public.profiles;

DROP POLICY IF EXISTS "Public Read Settings" ON public.settings;
DROP POLICY IF EXISTS "Admin Update Settings" ON public.settings;

DROP POLICY IF EXISTS "Public Validate Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admin Manage Licenses" ON public.licenses;

DROP POLICY IF EXISTS "Student Submit Payment Proof" ON public.payments;
DROP POLICY IF EXISTS "Admin Manage Payments" ON public.payments;

DROP POLICY IF EXISTS "Public Read Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admin Publish Announcements" ON public.announcements;


-- ── PROFILES POLICIES ────────────────────────────────────────────────────────
-- Users can view their own profile
CREATE POLICY "Users Read Own Profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Admins can view and manage all profiles
CREATE POLICY "Admins Manage Profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ── SETTINGS POLICIES ────────────────────────────────────────────────────────
-- Everyone (students and anon) can read public settings (payment numbers & fee)
CREATE POLICY "Public Read Settings"
ON public.settings FOR SELECT
TO anon, authenticated
USING (true);

-- Only verified Admins (role = 'admin' in profiles) can UPDATE settings
CREATE POLICY "Admin Update Settings"
ON public.settings FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ── LICENSES POLICIES ────────────────────────────────────────────────────────
-- Everyone (students and anon) can validate activation keys
CREATE POLICY "Public Validate Licenses"
ON public.licenses FOR SELECT
TO anon, authenticated
USING (true);

-- Only verified Admins (role = 'admin' in profiles) can INSERT, UPDATE, or DELETE keys
CREATE POLICY "Admin Manage Licenses"
ON public.licenses FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ── PAYMENTS POLICIES ────────────────────────────────────────────────────────
-- Students and anonymous users can ONLY INSERT payment proofs (Cannot SELECT or UPDATE)
CREATE POLICY "Student Submit Payment Proof"
ON public.payments FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'Pending' AND
  generated_key IS NULL
);

-- Only verified Admins (role = 'admin' in profiles) can SELECT, APPROVE, REJECT, or DELETE payments
CREATE POLICY "Admin Manage Payments"
ON public.payments FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ── ANNOUNCEMENTS POLICIES ───────────────────────────────────────────────────
-- Everyone can read announcements & update notices
CREATE POLICY "Public Read Announcements"
ON public.announcements FOR SELECT
TO anon, authenticated
USING (true);

-- Only verified Admins (role = 'admin' in profiles) can publish or edit notices
CREATE POLICY "Admin Publish Announcements"
ON public.announcements FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
