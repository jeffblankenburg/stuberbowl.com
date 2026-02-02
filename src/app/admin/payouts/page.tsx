'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Contest, LeaderboardEntry } from '@/types/database'
import Link from 'next/link'

export default function AdminPayoutsPage() {
  const [contest, setContest] = useState<Contest | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable settings (store as strings to avoid leading zero issues)
  const [entryFee, setEntryFee] = useState('')
  const [payoutFirst, setPayoutFirst] = useState('')
  const [payoutSecond, setPayoutSecond] = useState('')
  const [payoutThird, setPayoutThird] = useState('')
  const [payoutLast, setPayoutLast] = useState('')
  const [settingsExpanded, setSettingsExpanded] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAdminAndFetch()
  }, [])

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('sb_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      router.push('/')
      return
    }

    await fetchData()
    setLoading(false)
  }

  const fetchData = async () => {
    const { data: contestData } = await supabase
      .from('sb_contests')
      .select('*')
      .eq('is_active', true)
      .single()

    setContest(contestData)

    if (contestData) {
      setEntryFee(String(contestData.entry_fee ?? 0))
      setPayoutFirst(String(contestData.payout_first ?? 0))
      setPayoutSecond(String(contestData.payout_second ?? 0))
      setPayoutThird(String(contestData.payout_third ?? 0))
      // Default payout_last to entry_fee if not set
      setPayoutLast(String(contestData.payout_last ?? contestData.entry_fee ?? 0))

      const { data: leaderboardData } = await supabase.rpc('sb_get_leaderboard', {
        contest_uuid: contestData.id,
      })
      setLeaderboard(leaderboardData || [])
    }
  }

  const handleSaveSettings = async () => {
    if (!contest) return

    setSaving(true)

    await supabase
      .from('sb_contests')
      .update({
        entry_fee: Number(entryFee) || 0,
        payout_first: Number(payoutFirst) || 0,
        payout_second: Number(payoutSecond) || 0,
        payout_third: Number(payoutThird) || 0,
        payout_last: Number(payoutLast) || 0,
      })
      .eq('id', contest.id)

    await fetchData()
    setSaving(false)
  }

  const settingsChanged = contest && (
    Number(entryFee) !== (contest.entry_fee ?? 0) ||
    Number(payoutFirst) !== (contest.payout_first ?? 0) ||
    Number(payoutSecond) !== (contest.payout_second ?? 0) ||
    Number(payoutThird) !== (contest.payout_third ?? 0) ||
    Number(payoutLast) !== (contest.payout_last ?? contest.entry_fee ?? 0)
  )

  const handleMarkPayout = async (userId: string, place: number, amount: number) => {
    setSaving(true)

    await supabase
      .from('sb_profiles')
      .update({
        has_received_payout: true,
        payout_place: place,
        payout_amount: amount,
      })
      .eq('id', userId)

    await fetchData()
    setSaving(false)
  }

  const handleClearPayout = async (userId: string) => {
    setSaving(true)

    await supabase
      .from('sb_profiles')
      .update({
        has_received_payout: false,
        payout_place: null,
        payout_amount: 0,
      })
      .eq('id', userId)

    await fetchData()
    setSaving(false)
  }

  if (loading) {
    return <div className="p-4 text-center text-zinc-400">Loading...</div>
  }

  if (!contest) {
    return (
      <div className="p-4 space-y-4">
        <Link href="/admin" className="text-zinc-400 hover:text-white inline-flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back
        </Link>
        <div className="text-center py-8">
          <p className="text-zinc-400">No active contest found.</p>
        </div>
      </div>
    )
  }

  // Calculate pot (use local state for live preview)
  const paidPlayers = leaderboard.filter(e => e.has_paid_entry).length
  const entryFeeNum = Number(entryFee) || 0
  const payoutFirstNum = Number(payoutFirst) || 0
  const payoutSecondNum = Number(payoutSecond) || 0
  const payoutThirdNum = Number(payoutThird) || 0
  const payoutLastNum = Number(payoutLast) || entryFeeNum
  const totalPot = paidPlayers * entryFeeNum
  const firstPrize = totalPot * payoutFirstNum / 100
  const secondPrize = totalPot * payoutSecondNum / 100
  const thirdPrize = totalPot * payoutThirdNum / 100
  const lastPrize = payoutLastNum

  // Get top 3 and last (paid only for prizes)
  const paidLeaderboard = leaderboard.filter(e => e.has_paid_entry)
  const winner = paidLeaderboard[0]
  const second = paidLeaderboard[1]
  const third = paidLeaderboard[2]
  const lastPlace = paidLeaderboard.length > 3 ? paidLeaderboard[paidLeaderboard.length - 1] : null

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-zinc-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Payouts</h1>
      </div>

      {/* Contest Settings */}
      <div className="bg-zinc-900 rounded-xl overflow-hidden">
        <button
          onClick={() => setSettingsExpanded(!settingsExpanded)}
          className="w-full p-4 flex items-center justify-between hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span className="text-lg font-semibold text-white">Contest Settings</span>
          </div>
          <svg
            className={`w-5 h-5 text-zinc-400 transition-transform ${settingsExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {settingsExpanded && (
          <div className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Entry Fee ($)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">1st Place (%)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={payoutFirst}
                  onChange={(e) => setPayoutFirst(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">2nd Place (%)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={payoutSecond}
                  onChange={(e) => setPayoutSecond(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">3rd Place (%)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={payoutThird}
                  onChange={(e) => setPayoutThird(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Last Place Gets Back ($)</label>
              <input
                type="text"
                inputMode="numeric"
                value={payoutLast}
                onChange={(e) => setPayoutLast(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder={`Default: $${entryFee || 0} (entry fee)`}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-zinc-500 mt-1">The last place finisher gets this amount back</p>
            </div>

            {payoutFirstNum + payoutSecondNum + payoutThirdNum !== 100 && (
              <p className="text-amber-400 text-sm">
                Payout percentages total {payoutFirstNum + payoutSecondNum + payoutThirdNum}% (should be 100%)
              </p>
            )}

            {settingsChanged && (
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pot Summary */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-4 border border-blue-700/50">
        <div className="text-center space-y-2">
          <p className="text-zinc-400 text-sm">Total Prize Pool</p>
          <p className="text-4xl font-bold text-white">${totalPot.toFixed(0)}</p>
          <p className="text-zinc-500 text-sm">
            {paidPlayers} paid × ${entryFeeNum} entry
          </p>
        </div>
      </div>

      {/* Prize Breakdown */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Prize Distribution</h2>

        {/* 1st Place */}
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 font-bold">1st Place ({payoutFirstNum}%)</p>
              <p className="text-2xl font-bold text-white">${firstPrize.toFixed(0)}</p>
              {winner && (
                <p className="text-zinc-400 text-sm mt-1">
                  {winner.display_name} - {winner.correct_picks} correct
                </p>
              )}
            </div>
            {winner && (
              <button
                onClick={() => handleMarkPayout(winner.user_id, 1, firstPrize)}
                disabled={saving}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  leaderboard.find(e => e.user_id === winner.user_id && e.has_paid_entry)
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-700 text-white hover:bg-zinc-600'
                }`}
              >
                Mark Paid
              </button>
            )}
          </div>
        </div>

        {/* 2nd Place */}
        <div className="bg-zinc-400/20 border border-zinc-400/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-zinc-300 font-bold">2nd Place ({payoutSecondNum}%)</p>
              <p className="text-2xl font-bold text-white">${secondPrize.toFixed(0)}</p>
              {second && (
                <p className="text-zinc-400 text-sm mt-1">
                  {second.display_name} - {second.correct_picks} correct
                </p>
              )}
            </div>
            {second && (
              <button
                onClick={() => handleMarkPayout(second.user_id, 2, secondPrize)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-700 text-white hover:bg-zinc-600 transition-colors"
              >
                Mark Paid
              </button>
            )}
          </div>
        </div>

        {/* 3rd Place */}
        <div className="bg-amber-700/20 border border-amber-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-500 font-bold">3rd Place ({payoutThirdNum}%)</p>
              <p className="text-2xl font-bold text-white">${thirdPrize.toFixed(0)}</p>
              {third && (
                <p className="text-zinc-400 text-sm mt-1">
                  {third.display_name} - {third.correct_picks} correct
                </p>
              )}
            </div>
            {third && (
              <button
                onClick={() => handleMarkPayout(third.user_id, 3, thirdPrize)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-700 text-white hover:bg-zinc-600 transition-colors"
              >
                Mark Paid
              </button>
            )}
          </div>
        </div>

        {/* Last Place */}
        {lastPlace && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-400 font-bold">Last Place (Money Back)</p>
                <p className="text-2xl font-bold text-white">${lastPrize.toFixed(0)}</p>
                <p className="text-zinc-400 text-sm mt-1">
                  {lastPlace.display_name} - {lastPlace.correct_picks} correct
                </p>
              </div>
              <button
                onClick={() => handleMarkPayout(lastPlace.user_id, paidLeaderboard.length, lastPrize)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-700 text-white hover:bg-zinc-600 transition-colors"
              >
                Mark Paid
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Standings for Reference */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Full Standings</h2>
        {leaderboard.map((entry) => {
          const isLastPlace = lastPlace && entry.user_id === lastPlace.user_id
          return (
            <div
              key={entry.user_id}
              className={`rounded-xl p-3 ${isLastPlace ? 'bg-red-900/20 border border-red-700/50' : 'bg-zinc-900'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 w-6">{entry.rank}.</span>
                  <div>
                    <p className="text-white font-medium">{entry.display_name}</p>
                    <p className="text-zinc-500 text-xs">
                      {entry.correct_picks} correct
                      {!entry.has_paid_entry && <span className="text-amber-500 ml-2">• unpaid</span>}
                      {isLastPlace && <span className="text-red-400 ml-2">• gets ${lastPrize} back</span>}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
