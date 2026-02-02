export type Profile = {
  id: string
  phone: string
  display_name: string
  is_admin: boolean
  has_paid_entry: boolean
  has_received_payout: boolean
  payout_amount: number
  payout_place: number | null
  created_at: string
  updated_at: string
}

export type Contest = {
  id: string
  name: string
  year: number
  entry_fee: number
  is_active: boolean
  picks_locked: boolean
  picks_lock_time: string | null
  payout_first: number
  payout_second: number
  payout_third: number
  venmo_username: string | null
  paypal_username: string | null
  landing_message: string | null
  created_at: string
}

export type PropBet = {
  id: string
  contest_id: string
  question: string
  option_a: string
  option_b: string
  category: string | null
  correct_answer: 'A' | 'B' | null
  image_url: string | null
  source_url: string | null
  is_tiebreaker: boolean
  is_open_ended: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type UserPick = {
  id: string
  user_id: string
  prop_bet_id: string
  selected_option: 'A' | 'B' | null
  value_response: string | null
  is_correct: boolean | null
  created_at: string
  updated_at: string
}

export type ChatMessage = {
  id: string
  contest_id: string
  user_id: string
  message: string
  created_at: string
}

export type Invite = {
  id: string
  phone: string
  display_name: string
  invited_by: string | null
  is_claimed: boolean
  created_at: string
}

export type LeaderboardEntry = {
  user_id: string
  display_name: string
  correct_picks: number
  total_picks: number
  has_paid_entry: boolean
  rank: number
}

// Joined types for UI
export type PropBetWithPick = PropBet & {
  user_pick?: UserPick
}

export type ChatMessageWithProfile = ChatMessage & {
  profile: Pick<Profile, 'display_name'>
}
