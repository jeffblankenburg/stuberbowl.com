-- Add GIF support to chat messages
ALTER TABLE sb_chat_messages ADD COLUMN IF NOT EXISTS gif_url TEXT;

-- Make message nullable (can send GIF without text)
ALTER TABLE sb_chat_messages ALTER COLUMN message DROP NOT NULL;

-- Add check constraint to ensure at least message or gif_url is provided
ALTER TABLE sb_chat_messages ADD CONSTRAINT chk_message_or_gif
  CHECK (message IS NOT NULL OR gif_url IS NOT NULL);
