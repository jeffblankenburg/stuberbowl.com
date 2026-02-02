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
      const { data: leaderboardData } = await supabase.rpc('sb_get_leaderboard', {
        contest_uuid: contestData.id,
      })
      setLeaderboard(leaderboardData || [])
    }
  }

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

  // Calculate pot
  const paidPlayers = leaderboard.filter(e => e.has_paid_entry).length
  const totalPot = paidPlayers * contest.entry_fee
  const firstPrize = totalPot * contest.payout_first / 100
  const secondPrize = totalPot * contest.payout_second / 100
  const thirdPrize = totalPot * contest.payout_third / 100

  // Get top 3 (paid only for prizes)
  const paidLeaderboard = leaderboard.filter(e => e.has_paid_entry)
  const winner = paidLeaderboard[0]
  const second = paidLeaderboard[1]
  const third = paidLeaderboard[2]

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

      {/* Pot Summary */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-4 border border-blue-700/50">
        <div className="text-center space-y-2">
          <p className="text-zinc-400 text-sm">Total Prize Pool</p>
          <p className="text-4xl font-bold text-white">${totalPot.toFixed(0)}</p>
          <p className="text-zinc-500 text-sm">
            {paidPlayers} paid × ${contest.entry_fee} entry
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
              <p className="text-yellow-400 font-bold">1st Place ({contest.payout_first}%)</p>
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
              <p className="text-zinc-300 font-bold">2nd Place ({contest.payout_second}%)</p>
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
              <p className="text-amber-500 font-bold">3rd Place ({contest.payout_third}%)</p>
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
      </div>

      {/* Full Standings for Reference */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Full Standings</h2>
        {leaderboard.map((entry) => (
          <div key={entry.user_id} className="bg-zinc-900 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 w-6">{entry.rank}.</span>
                <div>
                  <p className="text-white font-medium">{entry.display_name}</p>
                  <p className="text-zinc-500 text-xs">
                    {entry.correct_picks} correct
                    {!entry.has_paid_entry && <span className="text-amber-500 ml-2">• unpaid</span>}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
