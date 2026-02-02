-- Add previous winners field to contests
ALTER TABLE sb_contests ADD COLUMN IF NOT EXISTS previous_winners TEXT;
