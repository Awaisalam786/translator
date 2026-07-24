-- ==============================================================================
-- Migration: 005_deduplicate_payments_and_unique_constraint.sql
-- Description: Detects & Cleans Duplicate Transaction IDs before Applying Unique Constraint
-- Safety: Retains the latest payment record for each trx_id and removes older duplicates.
-- ==============================================================================

-- 1. Deduplicate payments table by retaining the latest record per trx_id
WITH ranked_payments AS (
    SELECT
        id,
        trx_id,
        ROW_NUMBER() OVER (
            PARTITION BY trx_id
            ORDER BY created_at DESC, id DESC
        ) AS row_num
    FROM public.payments
),
duplicates_to_delete AS (
    SELECT id
    FROM ranked_payments
    WHERE row_num > 1
)
DELETE FROM public.payments
WHERE id IN (SELECT id FROM duplicates_to_delete);


-- 2. Safely Add UNIQUE Constraint to payments(trx_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'payments_trx_id_unique'
          AND table_name = 'payments'
    ) THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT payments_trx_id_unique UNIQUE (trx_id);
    END IF;
END $$;


-- 3. Create Index on trx_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_payments_trx_id ON public.payments(trx_id);
