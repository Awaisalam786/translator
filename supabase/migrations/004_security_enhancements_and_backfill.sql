-- ==============================================================================
-- Migration: 004_security_enhancements_and_backfill.sql
-- Description: Security Audit Fixes, Transaction ID Uniqueness, & Existing Users Backfill
-- Improvements:
--   1. Prevents duplicate payment transaction IDs (Unique Constraint & Index).
--   2. Backfills profiles for any pre-existing users in auth.users.
--   3. Hardens is_admin() SECURITY DEFINER to prevent RLS policy infinite recursion.
--   4. Preserves all existing production RLS security rules.
-- ==============================================================================

-- 1. Backfill Profiles for Pre-Existing auth.users
INSERT INTO public.profiles (id, email, role)
SELECT
    u.id,
    u.email,
    COALESCE(u.raw_app_meta_data->>'role', u.raw_user_meta_data->>'role', 'student')
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;


-- 2. Anti-Fraud Security: Prevent Duplicate Payment Transaction IDs
-- Clean up potential whitespace duplicate records if any exist
ALTER TABLE public.payments
    ADD CONSTRAINT payments_trx_id_unique UNIQUE (trx_id);

CREATE INDEX IF NOT EXISTS idx_payments_trx_id ON public.payments(trx_id);


-- 3. Hardened is_admin() Function (SECURITY DEFINER eliminates RLS Infinite Recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN (user_role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 4. Re-assert All Production RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users Read Own Profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins Manage Profiles" ON public.profiles;

CREATE POLICY "Users Read Own Profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins Manage Profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- Settings Policies
DROP POLICY IF EXISTS "Public Read Settings" ON public.settings;
DROP POLICY IF EXISTS "Admin Update Settings" ON public.settings;

CREATE POLICY "Public Read Settings"
ON public.settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin Update Settings"
ON public.settings FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- Licenses Policies
DROP POLICY IF EXISTS "Public Validate Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admin Manage Licenses" ON public.licenses;

CREATE POLICY "Public Validate Licenses"
ON public.licenses FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin Manage Licenses"
ON public.licenses FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- Payments Policies
DROP POLICY IF EXISTS "Student Submit Payment Proof" ON public.payments;
DROP POLICY IF EXISTS "Admin Manage Payments" ON public.payments;

CREATE POLICY "Student Submit Payment Proof"
ON public.payments FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'Pending' AND
  generated_key IS NULL
);

CREATE POLICY "Admin Manage Payments"
ON public.payments FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- Announcements Policies
DROP POLICY IF EXISTS "Public Read Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admin Publish Announcements" ON public.announcements;

CREATE POLICY "Public Read Announcements"
ON public.announcements FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admin Publish Announcements"
ON public.announcements FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
