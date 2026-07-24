-- ==============================================================================
-- Migration: 002_production_rls_security.sql
-- Description: Production-Grade RLS Policies & Supabase Auth Role Integration
-- Requirements:
--   - Anonymous users CANNOT update settings, create licenses, edit payments, or publish notices.
--   - Anonymous users can only READ public settings/announcements and INSERT new payment proofs.
--   - Only Authenticated Admin Users (auth.role() = 'authenticated') can manage database state.
-- ==============================================================================

-- 1. Security Refactoring: Remove Plaintext Passcode Column
ALTER TABLE public.settings DROP COLUMN IF EXISTS master_passcode;

-- 2. Admin Authentication Verification Function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Checks if user is logged in via Supabase Auth as authenticated role
  RETURN (
    auth.role() = 'authenticated'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop Permissive Development Policies
DROP POLICY IF EXISTS "Anon Select Settings" ON public.settings;
DROP POLICY IF EXISTS "Anon Update Settings" ON public.settings;
DROP POLICY IF EXISTS "Anon Select Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Anon Insert Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Anon Select Payments" ON public.payments;
DROP POLICY IF EXISTS "Anon Insert Payments" ON public.payments;
DROP POLICY IF EXISTS "Anon Update Payments" ON public.payments;
DROP POLICY IF EXISTS "Anon Select Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anon Insert Announcements" ON public.announcements;

DROP POLICY IF EXISTS "Public Read Settings" ON public.settings;
DROP POLICY IF EXISTS "Admin Update Settings" ON public.settings;
DROP POLICY IF EXISTS "Public Validate Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Admin Manage Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Student Submit Payment Proof" ON public.payments;
DROP POLICY IF EXISTS "Admin Manage Payments" ON public.payments;
DROP POLICY IF EXISTS "Public Read Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admin Publish Announcements" ON public.announcements;

-- ==============================================================================
-- 4. Production RLS Policies: SETTINGS
-- ==============================================================================

-- Students (anon) can read public settings (Payment numbers & fee)
CREATE POLICY "Public Read Settings"
ON public.settings FOR SELECT
TO anon, authenticated
USING (true);

-- Only Authenticated Admin Users can update settings
CREATE POLICY "Admin Update Settings"
ON public.settings FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ==============================================================================
-- 5. Production RLS Policies: LICENSES
-- ==============================================================================

-- Anonymous students can validate activation keys
CREATE POLICY "Public Validate Licenses"
ON public.licenses FOR SELECT
TO anon, authenticated
USING (true);

-- Only Authenticated Admin Users can generate, update, or delete license keys
CREATE POLICY "Admin Manage Licenses"
ON public.licenses FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ==============================================================================
-- 6. Production RLS Policies: PAYMENTS
-- ==============================================================================

-- Anonymous students can ONLY INSERT payment proofs (Cannot view or edit existing payments!)
CREATE POLICY "Student Submit Payment Proof"
ON public.payments FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'Pending' AND
  generated_key IS NULL
);

-- Only Authenticated Admin Users can view, approve, reject, or modify payment proofs
CREATE POLICY "Admin Manage Payments"
ON public.payments FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ==============================================================================
-- 7. Production RLS Policies: ANNOUNCEMENTS
-- ==============================================================================

-- Public read access for announcements & app update notices
CREATE POLICY "Public Read Announcements"
ON public.announcements FOR SELECT
TO anon, authenticated
USING (true);

-- Only Authenticated Admin Users can publish announcements
CREATE POLICY "Admin Publish Announcements"
ON public.announcements FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
