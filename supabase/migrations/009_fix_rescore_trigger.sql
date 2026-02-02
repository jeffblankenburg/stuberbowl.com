-- Fix the trigger to also reset pick correctness when result is cleared

CREATE OR REPLACE FUNCTION sb_update_pick_correctness()
RETURNS TRIGGER AS $$
BEGIN
  -- If correct_answer is being set to NULL, reset all picks for this bet
  IF NEW.correct_answer IS NULL AND OLD.correct_answer IS NOT NULL THEN
    UPDATE sb_picks
    SET is_correct = NULL
    WHERE prop_bet_id = NEW.id;
  -- If correct_answer is being set or changed, score the picks
  ELSIF NEW.correct_answer IS NOT NULL AND
        (OLD.correct_answer IS NULL OR OLD.correct_answer != NEW.correct_answer) THEN
    UPDATE sb_picks
    SET is_correct = (selected_option = NEW.correct_answer)
    WHERE prop_bet_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
