-- Add tiebreaker support to prop bets
ALTER TABLE sb_prop_bets ADD COLUMN IF NOT EXISTS is_tiebreaker BOOLEAN DEFAULT FALSE;

-- Add value response field to picks for tiebreaker answers
ALTER TABLE sb_picks ADD COLUMN IF NOT EXISTS value_response TEXT;

-- Make selected_option nullable for tiebreaker picks
ALTER TABLE sb_picks ALTER COLUMN selected_option DROP NOT NULL;
