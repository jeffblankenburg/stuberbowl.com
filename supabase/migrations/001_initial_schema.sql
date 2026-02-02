-- Stuber Bowl Database Schema
-- Run this SQL in your existing Supabase project's SQL Editor
-- All tables are prefixed with 'sb_' to avoid conflicts

-- ============================================
-- TABLES
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS sb_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  has_paid_entry BOOLEAN DEFAULT FALSE,
  has_received_payout BOOLEAN DEFAULT FALSE,
  payout_amount DECIMAL(10,2) DEFAULT 0,
  payout_place INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contests (one per year)
CREATE TABLE IF NOT EXISTS sb_contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  entry_fee DECIMAL(10,2) DEFAULT 20,
  is_active BOOLEAN DEFAULT TRUE,
  picks_locked BOOLEAN DEFAULT FALSE,
  picks_lock_time TIMESTAMPTZ,
  payout_first INTEGER DEFAULT 70,
  payout_second INTEGER DEFAULT 20,
  payout_third INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prop Bets
CREATE TABLE IF NOT EXISTS sb_prop_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES sb_contests(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  category TEXT,
  correct_answer TEXT CHECK (correct_answer IN ('A', 'B')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Picks
CREATE TABLE IF NOT EXISTS sb_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sb_profiles(id) ON DELETE CASCADE,
  prop_bet_id UUID REFERENCES sb_prop_bets(id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL CHECK (selected_option IN ('A', 'B')),
  is_correct BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prop_bet_id)
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS sb_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID REFERENCES sb_contests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES sb_profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invites (for invite-only access)
CREATE TABLE IF NOT EXISTS sb_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Player',
  invited_by UUID REFERENCES sb_profiles(id),
  is_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push Subscriptions
CREATE TABLE IF NOT EXISTS sb_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES sb_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION sb_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM sb_profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get leaderboard
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
  WITH scores AS (
    SELECT
      p.id as user_id,
      p.display_name,
      COUNT(CASE WHEN pk.is_correct = TRUE THEN 1 END) as correct_picks,
      COUNT(pk.id) as total_picks,
      p.has_paid_entry
    FROM sb_profiles p
    LEFT JOIN sb_picks pk ON pk.user_id = p.id
    LEFT JOIN sb_prop_bets pb ON pk.prop_bet_id = pb.id AND pb.contest_id = contest_uuid
    WHERE EXISTS (SELECT 1 FROM sb_picks WHERE user_id = p.id)
    GROUP BY p.id, p.display_name, p.has_paid_entry
  )
  SELECT
    s.user_id,
    s.display_name,
    s.correct_picks,
    s.total_picks,
    s.has_paid_entry,
    RANK() OVER (ORDER BY s.correct_picks DESC, s.display_name ASC) as rank
  FROM scores s
  ORDER BY s.correct_picks DESC, s.display_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update pick correctness when result is entered
CREATE OR REPLACE FUNCTION sb_update_pick_correctness()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.correct_answer IS NOT NULL THEN
    UPDATE sb_picks
    SET is_correct = (selected_option = NEW.correct_answer),
        updated_at = NOW()
    WHERE prop_bet_id = NEW.id;
  ELSE
    -- If result is cleared, reset correctness
    UPDATE sb_picks
    SET is_correct = NULL,
        updated_at = NOW()
    WHERE prop_bet_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating pick correctness
DROP TRIGGER IF EXISTS on_prop_bet_result_entered ON sb_prop_bets;
CREATE TRIGGER on_prop_bet_result_entered
  AFTER UPDATE OF correct_answer ON sb_prop_bets
  FOR EACH ROW
  EXECUTE FUNCTION sb_update_pick_correctness();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION sb_handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_record sb_invites%ROWTYPE;
BEGIN
  -- Check if phone is in invites
  SELECT * INTO invite_record
  FROM sb_invites
  WHERE phone = NEW.phone AND is_claimed = FALSE;

  IF invite_record.id IS NOT NULL THEN
    -- Create profile from invite
    INSERT INTO sb_profiles (id, phone, display_name)
    VALUES (NEW.id, NEW.phone, invite_record.display_name);

    -- Mark invite as claimed
    UPDATE sb_invites SET is_claimed = TRUE WHERE id = invite_record.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created_sb ON auth.users;
CREATE TRIGGER on_auth_user_created_sb
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sb_handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE sb_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_prop_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Anyone can view profiles" ON sb_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON sb_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile" ON sb_profiles
  FOR UPDATE USING (sb_is_admin());

CREATE POLICY "Admins can insert profiles" ON sb_profiles
  FOR INSERT WITH CHECK (sb_is_admin());

-- CONTESTS policies
CREATE POLICY "Anyone can view contests" ON sb_contests
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage contests" ON sb_contests
  FOR ALL USING (sb_is_admin());

-- PROP_BETS policies
CREATE POLICY "Anyone can view prop bets" ON sb_prop_bets
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage prop bets" ON sb_prop_bets
  FOR ALL USING (sb_is_admin());

-- PICKS policies
CREATE POLICY "Anyone can view picks" ON sb_picks
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own picks" ON sb_picks
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    NOT EXISTS (
      SELECT 1 FROM sb_prop_bets pb
      JOIN sb_contests c ON pb.contest_id = c.id
      WHERE pb.id = prop_bet_id AND c.picks_locked = TRUE
    )
  );

CREATE POLICY "Users can update own picks before lock" ON sb_picks
  FOR UPDATE USING (
    auth.uid() = user_id AND
    NOT EXISTS (
      SELECT 1 FROM sb_prop_bets pb
      JOIN sb_contests c ON pb.contest_id = c.id
      WHERE pb.id = prop_bet_id AND c.picks_locked = TRUE
    )
  );

-- CHAT_MESSAGES policies
CREATE POLICY "Anyone can view chat messages" ON sb_chat_messages
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own messages" ON sb_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete messages" ON sb_chat_messages
  FOR DELETE USING (sb_is_admin());

-- INVITES policies
CREATE POLICY "Admins can manage invites" ON sb_invites
  FOR ALL USING (sb_is_admin());

CREATE POLICY "Anyone can check if phone is invited" ON sb_invites
  FOR SELECT USING (true);

-- PUSH_SUBSCRIPTIONS policies
CREATE POLICY "Users can manage own subscriptions" ON sb_push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- INDEXES for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sb_picks_user ON sb_picks(user_id);
CREATE INDEX IF NOT EXISTS idx_sb_picks_prop ON sb_picks(prop_bet_id);
CREATE INDEX IF NOT EXISTS idx_sb_prop_bets_contest ON sb_prop_bets(contest_id);
CREATE INDEX IF NOT EXISTS idx_sb_chat_messages_contest ON sb_chat_messages(contest_id);
CREATE INDEX IF NOT EXISTS idx_sb_chat_messages_created ON sb_chat_messages(created_at DESC);

-- ============================================
-- REALTIME
-- ============================================

-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE sb_picks;
ALTER PUBLICATION supabase_realtime ADD TABLE sb_prop_bets;
ALTER PUBLICATION supabase_realtime ADD TABLE sb_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE sb_contests;

-- ============================================
-- INITIAL DATA (optional - run separately if needed)
-- ============================================

-- Create first contest (update year as needed)
-- INSERT INTO sb_contests (name, year, entry_fee, picks_lock_time)
-- VALUES ('Stuber Bowl 2025', 2025, 20, '2025-02-09 18:00:00-05');
