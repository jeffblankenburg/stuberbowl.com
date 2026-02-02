-- Add open_ended flag (separate from tiebreaker)
-- is_tiebreaker = doesn't count toward score
-- is_open_ended = user types answer instead of A/B

ALTER TABLE sb_prop_bets ADD COLUMN IF NOT EXISTS is_open_ended BOOLEAN DEFAULT FALSE;

-- Drop existing function first (return type may differ)
DROP FUNCTION IF EXISTS sb_get_leaderboard(UUID);

-- Update leaderboard function to exclude tiebreaker questions from score
CREATE OR REPLACE FUNCTION sb_get_leaderboard(contest_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  correct_picks BIGINT,
  total_picks BIGINT,
  has_paid_entry BOOLEAN,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as user_id,
    p.display_name,
    COUNT(pk.id) FILTER (WHERE pk.is_correct = true) as correct_picks,
    COUNT(pk.id) FILTER (WHERE pk.is_correct IS NOT NULL) as total_picks,
    p.has_paid_entry,
    RANK() OVER (ORDER BY COUNT(pk.id) FILTER (WHERE pk.is_correct = true) DESC) as rank
  FROM sb_profiles p
  LEFT JOIN sb_picks pk ON pk.user_id = p.id
  LEFT JOIN sb_prop_bets pb ON pb.id = pk.prop_bet_id
  WHERE pb.contest_id = contest_uuid
    AND pb.is_tiebreaker = false  -- Exclude tiebreaker questions from score
  GROUP BY p.id, p.display_name, p.has_paid_entry
  ORDER BY correct_picks DESC, p.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
