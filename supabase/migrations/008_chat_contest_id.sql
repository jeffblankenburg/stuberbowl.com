-- Add contest_id column to chat messages
ALTER TABLE sb_chat_messages
ADD COLUMN IF NOT EXISTS contest_id UUID REFERENCES sb_contests(id) ON DELETE CASCADE;

-- Set contest_id for existing messages (use the active contest)
UPDATE sb_chat_messages
SET contest_id = (SELECT id FROM sb_contests WHERE is_active = true LIMIT 1)
WHERE contest_id IS NULL;

-- Make contest_id NOT NULL after backfilling
ALTER TABLE sb_chat_messages
ALTER COLUMN contest_id SET NOT NULL;

-- Add index for filtering by contest
CREATE INDEX IF NOT EXISTS idx_chat_messages_contest ON sb_chat_messages(contest_id);
