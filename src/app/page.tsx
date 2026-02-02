import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PicksClient } from './picks-client'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get active contest
  const { data: contest } = await supabase
    .from('sb_contests')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!contest) {
    return (
      <div className="p-4 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">No Active Contest</h1>
        <p className="text-zinc-400">Check back when the contest is set up.</p>
      </div>
    )
  }

  // Get all prop bets for this contest
  const { data: propBets } = await supabase
    .from('sb_prop_bets')
    .select('*')
    .eq('contest_id', contest.id)
    .order('sort_order', { ascending: true })

  // Get user's picks
  const { data: picks } = await supabase
    .from('sb_picks')
    .select('*')
    .eq('user_id', user.id)

  // Get user profile
  const { data: profile } = await supabase
    .from('sb_profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  return (
    <PicksClient
      contest={contest}
      propBets={propBets || []}
      initialPicks={picks || []}
      userId={user.id}
      userName={profile?.display_name || 'Player'}
    />
  )
}
