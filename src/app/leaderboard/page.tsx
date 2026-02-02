import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeaderboardClient } from './leaderboard-client'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
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

  // Get leaderboard using the database function
  const { data: leaderboard } = await supabase
    .rpc('sb_get_leaderboard', { contest_uuid: contest.id })

  // Get total number of answered prop bets
  const { count: answeredCount } = await supabase
    .from('sb_prop_bets')
    .select('id', { count: 'exact', head: true })
    .eq('contest_id', contest.id)
    .not('correct_answer', 'is', null)

  return (
    <LeaderboardClient
      contest={contest}
      initialLeaderboard={leaderboard || []}
      currentUserId={user.id}
      answeredCount={answeredCount || 0}
    />
  )
}
