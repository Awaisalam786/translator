-- ==============================================================================
-- Master SQL Script: 000_master_schema_and_rls.sql
-- Description: Complete Database Schema, Indexes, Constraints, Triggers & Strict RLS Policies
-- Target Database: Supabase PostgreSQL
-- Execution: Copy and execute in the Supabase SQL Editor manually.
-- ==============================================================================

-- ── 1. CREATE TABLES ─────────────────────────────────────────────────────────

-- Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings Table (Payment numbers & monthly reader subscription fee)
CREATE TABLE IF NOT EXISTS public.settings (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    jazz_cash_number TEXT DEFAULT '0300-1234567',
    jazz_cash_title TEXT DEFAULT 'Awais Alam',
    easy_paisa_number TEXT DEFAULT '0300-1234567',
    easy_paisa_title TEXT DEFAULT 'Awais Alam',
    subscription_fee NUMERIC DEFAULT 500,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Licenses Table (Activation keys database: LESE-XXXX-XXXX)
CREATE TABLE IF NOT EXISTS public.licenses (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    key TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT '1 Month',
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments Table (JazzCash / EasyPaisa transaction proof submissions)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    trx_id TEXT UNIQUE NOT NULL,
    provider TEXT DEFAULT 'JazzCash',
    amount NUMERIC DEFAULT 500,
    status TEXT DEFAULT 'Pending',
    date TEXT,
    generated_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements Table (Application broadcast update notices)
CREATE TABLE IF NOT EXISTS public.announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    version TEXT DEFAULT '2.1.0',
    date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ── 2. CREATE INDEXES ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_payments_trx_id ON public.payments(trx_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);


-- ── 3. DEFAULT SEED DATA ─────────────────────────────────────────────────────

-- Seed initial settings if table is empty
INSERT INTO public.settings (jazz_cash_number, jazz_cash_title, easy_paisa_number, easy_paisa_title, subscription_fee)
SELECT '0300-1234567', 'Awais Alam', '0300-1234567', 'Awais Alam', 500
WHERE NOT EXISTS (SELECT 1 FROM public.settings);


-- ── 4. AUTOMATIC PROFILE TRIGGER ON SIGNUP ───────────────────────────────────

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


-- ── 5. STRICT IS_ADMIN AUTHORIZATION FUNCTION ────────────────────────────────

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


-- ── 6. ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────

-- Enable RLS on all 5 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Reset previous policies cleanly
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


-- ── RLS: PROFILES ────────────────────────────────────────────────────────────
CREATE POLICY "Users Read Own Profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins Manage Profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ── RLS: SETTINGS ────────────────────────────────────────────────────────────
-- Everyone can read public settings (payment numbers & monthly fee)
CREATE POLICY "Public Read Settings"
ON public.settings FOR SELECT
TO anon, authenticated
USING (true);

-- Only verified Admins can update settings
CREATE POLICY "Admin Update Settings"
ON public.settings FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ── RLS: LICENSES ────────────────────────────────────────────────────────────
-- Everyone can validate activation keys
CREATE POLICY "Public Validate Licenses"
ON public.licenses FOR SELECT
TO anon, authenticated
USING (true);

-- Only verified Admins can INSERT, UPDATE, or DELETE activation keys
CREATE POLICY "Admin Manage Licenses"
ON public.licenses FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ── RLS: PAYMENTS ────────────────────────────────────────────────────────────
-- Students can ONLY INSERT payment proofs (Cannot view or edit existing payments!)
CREATE POLICY "Student Submit Payment Proof"
ON public.payments FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'Pending' AND
  generated_key IS NULL
);

-- Only verified Admins can view, approve, reject, or delete payments
CREATE POLICY "Admin Manage Payments"
ON public.payments FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- ── RLS: ANNOUNCEMENTS ───────────────────────────────────────────────────────
-- Everyone can read announcements & update notices
CREATE POLICY "Public Read Announcements"
ON public.announcements FOR SELECT
TO anon, authenticated
USING (true);

-- Only verified Admins can publish or edit notices
CREATE POLICY "Admin Publish Announcements"
ON public.announcements FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
