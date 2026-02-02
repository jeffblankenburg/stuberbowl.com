-- ============================================
-- STUBER BOWL - FRESH START
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop all existing objects
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_correct_answer_update ON sb_prop_bets;
DROP FUNCTION IF EXISTS sb_handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS sb_update_pick_correctness() CASCADE;
DROP FUNCTION IF EXISTS sb_get_leaderboard(UUID) CASCADE;
DROP FUNCTION IF EXISTS sb_get_leaderboard() CASCADE;
DROP FUNCTION IF EXISTS sb_is_admin() CASCADE;

DROP TABLE IF EXISTS sb_push_subscriptions CASCADE;
DROP TABLE IF EXISTS sb_chat_messages CASCADE;
DROP TABLE IF EXISTS sb_picks CASCADE;
DROP TABLE IF EXISTS sb_prop_bets CASCADE;
DROP TABLE IF EXISTS sb_invites CASCADE;
DROP TABLE IF EXISTS sb_profiles CASCADE;
DROP TABLE IF EXISTS sb_contests CASCADE;

-- ============================================
-- TABLES
-- ============================================

-- Contests (one per year)
CREATE TABLE sb_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL UNIQUE,
  entry_fee DECIMAL(10,2) DEFAULT 20.00,
  picks_locked BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles
CREATE TABLE sb_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  has_paid_entry BOOLEAN DEFAULT FALSE,
  payout_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prop bets
CREATE TABLE sb_prop_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES sb_contests(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  correct_answer TEXT CHECK (correct_answer IN ('A', 'B')),
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User picks
CREATE TABLE sb_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sb_profiles(id) ON DELETE CASCADE,
  prop_bet_id UUID NOT NULL REFERENCES sb_prop_bets(id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL CHECK (selected_option IN ('A', 'B')),
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prop_bet_id)
);

-- Chat messages
CREATE TABLE sb_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sb_profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push subscriptions
CREATE TABLE sb_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sb_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_prop_bets_contest ON sb_prop_bets(contest_id);
CREATE INDEX idx_picks_user ON sb_picks(user_id);
CREATE INDEX idx_picks_prop_bet ON sb_picks(prop_bet_id);
CREATE INDEX idx_chat_messages_created ON sb_chat_messages(created_at DESC);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION sb_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM sb_profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get leaderboard
CREATE OR REPLACE FUNCTION sb_get_leaderboard(contest_uuid UUID)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  correct_count BIGINT,
  total_picks BIGINT,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.display_name,
    COUNT(pk.id) FILTER (WHERE pk.is_correct = TRUE) AS correct_count,
    COUNT(pk.id) AS total_picks,
    RANK() OVER (ORDER BY COUNT(pk.id) FILTER (WHERE pk.is_correct = TRUE) DESC) AS rank
  FROM sb_profiles p
  LEFT JOIN sb_picks pk ON pk.user_id = p.id
  LEFT JOIN sb_prop_bets pb ON pb.id = pk.prop_bet_id AND pb.contest_id = contest_uuid
  WHERE p.has_paid_entry = TRUE
  GROUP BY p.id, p.display_name
  ORDER BY correct_count DESC, p.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update pick correctness when admin enters result
CREATE OR REPLACE FUNCTION sb_update_pick_correctness()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.correct_answer IS NOT NULL AND
     (OLD.correct_answer IS NULL OR OLD.correct_answer != NEW.correct_answer) THEN
    UPDATE sb_picks
    SET is_correct = (selected_option = NEW.correct_answer)
    WHERE prop_bet_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_correct_answer_update
  AFTER UPDATE ON sb_prop_bets
  FOR EACH ROW
  EXECUTE FUNCTION sb_update_pick_correctness();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE sb_contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_prop_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Contests: everyone can read, admin can write
CREATE POLICY "Contests are viewable by authenticated users"
  ON sb_contests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage contests"
  ON sb_contests FOR ALL TO authenticated USING (sb_is_admin());

-- Profiles: everyone can read, users can update own, admin can do all
CREATE POLICY "Profiles are viewable by authenticated users"
  ON sb_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile"
  ON sb_profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can manage profiles"
  ON sb_profiles FOR ALL TO authenticated USING (sb_is_admin());

-- Prop bets: everyone can read, admin can write
CREATE POLICY "Prop bets are viewable by authenticated users"
  ON sb_prop_bets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage prop bets"
  ON sb_prop_bets FOR ALL TO authenticated USING (sb_is_admin());

-- Picks: users can manage own (when not locked), everyone can read
CREATE POLICY "Picks are viewable by authenticated users"
  ON sb_picks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own picks"
  ON sb_picks FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    NOT EXISTS (SELECT 1 FROM sb_contests WHERE is_active = TRUE AND picks_locked = TRUE)
  );
CREATE POLICY "Users can update own picks"
  ON sb_picks FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() AND
    NOT EXISTS (SELECT 1 FROM sb_contests WHERE is_active = TRUE AND picks_locked = TRUE)
  );
CREATE POLICY "Admins can manage all picks"
  ON sb_picks FOR ALL TO authenticated USING (sb_is_admin());

-- Chat: everyone can read and insert own
CREATE POLICY "Chat messages are viewable by authenticated users"
  ON sb_chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can send chat messages"
  ON sb_chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage chat"
  ON sb_chat_messages FOR ALL TO authenticated USING (sb_is_admin());

-- Push subscriptions: users manage own only
CREATE POLICY "Users can manage own push subscriptions"
  ON sb_push_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view push subscriptions"
  ON sb_push_subscriptions FOR SELECT TO authenticated USING (sb_is_admin());

-- ============================================
-- REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE sb_picks;
ALTER PUBLICATION supabase_realtime ADD TABLE sb_prop_bets;
ALTER PUBLICATION supabase_realtime ADD TABLE sb_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE sb_contests;

-- ============================================
-- SEED DATA: Create initial contest
-- ============================================

INSERT INTO sb_contests (name, year, entry_fee)
VALUES ('Stuber Bowl 2025', 2025, 20.00);
