import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveUserId } from '@/lib/simulation'
import Link from 'next/link'
import Image from 'next/image'

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

  // Get the active user ID (simulated or real)
  const activeUserId = await getActiveUserId(user.id)

  // Get user profile
  const { data: profile } = await supabase
    .from('sb_profiles')
    .select('display_name, has_paid_entry')
    .eq('id', activeUserId)
    .single()

  // Get pick count for this user
  const { count: pickCount } = await supabase
    .from('sb_picks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', activeUserId)

  // Get total prop count
  const { count: totalProps } = await supabase
    .from('sb_prop_bets')
    .select('id', { count: 'exact', head: true })
    .eq('contest_id', contest.id)

  const entryFee = contest.entry_fee ?? 10
  const venmoUsername = contest.venmo_username || 'John-Stuber'
  const paypalUsername = contest.paypal_username || 'johnmstuber'
  const landingMessage = contest.landing_message || 'Welcome to Stuber Bowl! Pay your entry fee to get started, then make your picks before the game starts.'

  // Build payment links with amount pre-populated
  const venmoLink = `https://venmo.com/${venmoUsername}?txn=pay&amount=${entryFee}&note=${encodeURIComponent('Stuber Bowl Entry')}`
  const paypalLink = `https://www.paypal.com/paypalme/${paypalUsername}/${entryFee}`

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <Image
            src="/stuberbowl.png"
            alt="Stuber Bowl"
            width={120}
            height={120}
            className="rounded-2xl"
          />
        </div>
        <h1 className="text-2xl font-bold text-white">{contest.name}</h1>
        <p className="text-zinc-400">Hey, {profile?.display_name || 'Player'}!</p>
      </div>

      {/* Welcome Message */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <p className="text-zinc-300 whitespace-pre-line">{landingMessage}</p>
      </div>

      {/* Payment Status */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Entry Fee</span>
          <span className="text-white font-bold">${entryFee}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Payment Status</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            profile?.has_paid_entry
              ? 'bg-green-900/50 text-green-400'
              : 'bg-amber-900/50 text-amber-400'
          }`}>
            {profile?.has_paid_entry ? 'Paid' : 'Unpaid'}
          </span>
        </div>

        {!profile?.has_paid_entry && (
          <div className="pt-4 border-t border-zinc-800 space-y-3">
            <p className="text-zinc-400 text-sm text-center">Pay with:</p>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={venmoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#008CFF] hover:bg-[#0070CC] text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                <img src="/venmo.svg" alt="Venmo" className="w-6 h-6 brightness-0 invert" />
                <span>Venmo</span>
              </a>
              <a
                href={paypalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#0070BA] hover:bg-[#005C99] text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                <img src="/paypal.svg" alt="PayPal" className="w-6 h-6 brightness-0 invert" />
                <span>PayPal</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Picks Progress */}
      <Link
        href="/picks"
        className="block bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-4 border border-blue-700/50 hover:border-blue-500/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-lg">Make Your Picks</p>
            <p className="text-zinc-400 text-sm">
              {pickCount || 0} of {totalProps || 0} picks made
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pickCount === totalProps && totalProps! > 0 ? (
              <span className="text-green-400 text-2xl">✓</span>
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold">{pickCount || 0}</span>
              </div>
            )}
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${totalProps ? ((pickCount || 0) / totalProps) * 100 : 0}%` }}
          />
        </div>
      </Link>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/leaderboard"
          className="bg-zinc-900 rounded-xl p-4 text-center hover:bg-zinc-800 transition-colors"
        >
          <span className="text-2xl block mb-1">🏆</span>
          <span className="text-white font-medium">Leaderboard</span>
        </Link>
        <Link
          href="/chat"
          className="bg-zinc-900 rounded-xl p-4 text-center hover:bg-zinc-800 transition-colors"
        >
          <span className="text-2xl block mb-1">💬</span>
          <span className="text-white font-medium">Chat</span>
        </Link>
      </div>

      {/* Lock Status */}
      {contest.picks_locked && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 text-center">
          <p className="text-amber-400 text-sm font-medium">Picks are locked!</p>
        </div>
      )}
    </div>
  )
}
