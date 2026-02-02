-- Add last place payout column to contests
-- This allows the last place finisher to get their money back
ALTER TABLE sb_contests
ADD COLUMN IF NOT EXISTS payout_last NUMERIC(10,2) DEFAULT NULL;

-- By default, payout_last is NULL which means it defaults to the entry_fee at runtime
-- When set, it's the explicit dollar amount the last place finisher receives
