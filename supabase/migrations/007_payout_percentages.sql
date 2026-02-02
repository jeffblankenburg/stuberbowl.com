-- Add payout percentage columns to contests
ALTER TABLE sb_contests
ADD COLUMN IF NOT EXISTS payout_first INTEGER DEFAULT 70,
ADD COLUMN IF NOT EXISTS payout_second INTEGER DEFAULT 20,
ADD COLUMN IF NOT EXISTS payout_third INTEGER DEFAULT 10;

-- Update existing contests with default values
UPDATE sb_contests
SET
  payout_first = COALESCE(payout_first, 70),
  payout_second = COALESCE(payout_second, 20),
  payout_third = COALESCE(payout_third, 10);
