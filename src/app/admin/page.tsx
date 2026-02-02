import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('sb_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/')
  }

  // Get active contest
  const { data: contest } = await supabase
    .from('sb_contests')
    .select('*')
    .eq('is_active', true)
    .single()

  // Get stats
  const { count: userCount } = await supabase
    .from('sb_profiles')
    .select('id', { count: 'exact', head: true })

  const { count: paidCount } = await supabase
    .from('sb_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('has_paid_entry', true)

  const { count: propCount } = await supabase
    .from('sb_prop_bets')
    .select('id', { count: 'exact', head: true })
    .eq('contest_id', contest?.id || '')

  const { count: answeredCount } = await supabase
    .from('sb_prop_bets')
    .select('id', { count: 'exact', head: true })
    .eq('contest_id', contest?.id || '')
    .not('correct_answer', 'is', null)

  const { count: inviteCount } = await supabase
    .from('sb_invites')
    .select('id', { count: 'exact', head: true })
    .eq('is_claimed', false)

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-zinc-400">{contest?.name || 'No active contest'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-white">{userCount || 0}</p>
          <p className="text-zinc-400 text-sm">Users</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{paidCount || 0}</p>
          <p className="text-zinc-400 text-sm">Paid</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-white">{propCount || 0}</p>
          <p className="text-zinc-400 text-sm">Props</p>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{answeredCount || 0}</p>
          <p className="text-zinc-400 text-sm">Answered</p>
        </div>
      </div>

      {/* Contest Status */}
      {contest && (
        <div className="bg-zinc-900 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Picks Status</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              contest.picks_locked
                ? 'bg-red-900/50 text-red-400'
                : 'bg-green-900/50 text-green-400'
            }`}>
              {contest.picks_locked ? 'Locked' : 'Open'}
            </span>
          </div>
        </div>
      )}

      {/* Pending Invites */}
      {inviteCount && inviteCount > 0 && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4">
          <p className="text-amber-400 text-sm">
            {inviteCount} pending invite{inviteCount !== 1 ? 's' : ''} waiting to be claimed
          </p>
        </div>
      )}

      {/* Admin Menu */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Manage</h2>

        <Link
          href="/admin/users"
          className="flex items-center justify-between bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <p className="text-white font-medium">Users</p>
              <p className="text-zinc-500 text-sm">Invite users, mark payments</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        <Link
          href="/admin/bets"
          className="flex items-center justify-between bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-white font-medium">Prop Bets</p>
              <p className="text-zinc-500 text-sm">Create bets, enter results</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        <Link
          href="/admin/payouts"
          className="flex items-center justify-between bg-zinc-900 rounded-xl p-4 hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <p className="text-white font-medium">Payouts</p>
              <p className="text-zinc-500 text-sm">Track prize distribution</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      {/* No Contest Warning */}
      {!contest && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 text-center">
          <p className="text-amber-400">No active contest. Create one in your Supabase dashboard.</p>
        </div>
      )}
    </div>
  )
}
