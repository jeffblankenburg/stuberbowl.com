-- Add image_url and source_url columns to prop bets
ALTER TABLE sb_prop_bets ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE sb_prop_bets ADD COLUMN IF NOT EXISTS source_url TEXT;
