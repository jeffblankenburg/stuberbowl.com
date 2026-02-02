-- Add landing page content fields to contests
ALTER TABLE sb_contests
ADD COLUMN IF NOT EXISTS venmo_username TEXT DEFAULT 'John-Stuber',
ADD COLUMN IF NOT EXISTS paypal_username TEXT DEFAULT 'johnmstuber',
ADD COLUMN IF NOT EXISTS landing_message TEXT DEFAULT 'Welcome to Stuber Bowl! Pay your entry fee to get started, then make your picks before the game starts.';

-- Update existing contests with defaults
UPDATE sb_contests
SET
  venmo_username = COALESCE(venmo_username, 'John-Stuber'),
  paypal_username = COALESCE(paypal_username, 'johnmstuber'),
  landing_message = COALESCE(landing_message, 'Welcome to Stuber Bowl! Pay your entry fee to get started, then make your picks before the game starts.');
