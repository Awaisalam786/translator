-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Database Schema, Indexes, Constraints, and RLS Policies for Leselampe
-- Execution: Copy and execute in the Supabase SQL Editor manually.
-- ==============================================================================

-- 1. Create Tables
CREATE TABLE IF NOT EXISTS public.settings (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    jazz_cash_number TEXT DEFAULT '0300-1234567',
    jazz_cash_title TEXT DEFAULT 'Awais Alam',
    easy_paisa_number TEXT DEFAULT '0300-1234567',
    easy_paisa_title TEXT DEFAULT 'Awais Alam',
    subscription_fee NUMERIC DEFAULT 500,
    master_passcode TEXT DEFAULT 'awaisalam',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.licenses (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    key TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT '1 Month',
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    trx_id TEXT NOT NULL,
    provider TEXT DEFAULT 'JazzCash',
    amount NUMERIC DEFAULT 500,
    status TEXT DEFAULT 'Pending',
    date TEXT,
    generated_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    version TEXT DEFAULT '2.1.0',
    date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Indexes
CREATE INDEX IF NOT EXISTS idx_licenses_key ON public.licenses(key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- 3. Insert Initial Default Settings (If table is empty)
INSERT INTO public.settings (jazz_cash_number, jazz_cash_title, easy_paisa_number, easy_paisa_title, subscription_fee, master_passcode)
SELECT '0300-1234567', 'Awais Alam', '0300-1234567', 'Awais Alam', 500, 'awaisalam'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- 4. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 5. Drop Existing RLS Policies (Safe idempotency)
DROP POLICY IF EXISTS "Anon Select Settings" ON public.settings;
DROP POLICY IF EXISTS "Anon Update Settings" ON public.settings;
DROP POLICY IF EXISTS "Anon Select Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Anon Insert Licenses" ON public.licenses;
DROP POLICY IF EXISTS "Anon Select Payments" ON public.payments;
DROP POLICY IF EXISTS "Anon Insert Payments" ON public.payments;
DROP POLICY IF EXISTS "Anon Update Payments" ON public.payments;
DROP POLICY IF EXISTS "Anon Select Announcements" ON public.announcements;
DROP POLICY IF EXISTS "Anon Insert Announcements" ON public.announcements;

-- 6. Create RLS Security Policies for SUPABASE_ANON_KEY
CREATE POLICY "Anon Select Settings" ON public.settings FOR SELECT TO anon USING (true);
CREATE POLICY "Anon Update Settings" ON public.settings FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon Select Licenses" ON public.licenses FOR SELECT TO anon USING (true);
CREATE POLICY "Anon Insert Licenses" ON public.licenses FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Anon Select Payments" ON public.payments FOR SELECT TO anon USING (true);
CREATE POLICY "Anon Insert Payments" ON public.payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon Update Payments" ON public.payments FOR UPDATE TO anon USING (true);

CREATE POLICY "Anon Select Announcements" ON public.announcements FOR SELECT TO anon USING (true);
CREATE POLICY "Anon Insert Announcements" ON public.announcements FOR INSERT TO anon WITH CHECK (true);
