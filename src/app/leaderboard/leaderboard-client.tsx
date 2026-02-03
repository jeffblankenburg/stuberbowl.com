'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Contest, LeaderboardEntry } from '@/types/database'

interface LeaderboardClientProps {
  contest: Contest
  initialLeaderboard: LeaderboardEntry[]
  currentUserId: string
  answeredCount: number
}

export function LeaderboardClient({
  contest,
  initialLeaderboard,
  currentUserId,
  answeredCount: initialAnsweredCount,
}: LeaderboardClientProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(initialLeaderboard)
  const [answeredCount, setAnsweredCount] = useState(initialAnsweredCount)
  const [showPreviousWinners, setShowPreviousWinners] = useState(false)
  const supabase = createClient()

  // Fetch updated leaderboard
  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase.rpc('sb_get_leaderboard', { contest_uuid: contest.id })
    if (data) {
      setLeaderboard(data)
    }
  }, [supabase, contest.id])

  // Subscribe to picks changes for realtime leaderboard
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sb_picks',
        },
        () => {
          fetchLeaderboard()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sb_prop_bets',
          filter: `contest_id=eq.${contest.id}`,
        },
        async () => {
          // Refresh leaderboard and answered count when results are entered
          fetchLeaderboard()

          const { count } = await supabase
            .from('sb_prop_bets')
            .select('id', { count: 'exact', head: true })
            .eq('contest_id', contest.id)
            .not('correct_answer', 'is', null)

          setAnsweredCount(count || 0)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, contest.id, fetchLeaderboard])

  // Calculate pot and payouts
  const paidPlayers = leaderboard.filter(e => e.has_paid_entry).length
  const totalPot = paidPlayers * contest.entry_fee
  const lastPlacePayout = contest.payout_last ?? contest.entry_fee

  // Find last place among paid players - only when results have been entered
  const paidLeaderboard = leaderboard.filter(e => e.has_paid_entry)
  const hasResultsEntered = answeredCount > 0
  const lastPlaceUserId = hasResultsEntered && paidLeaderboard.length > 3
    ? paidLeaderboard[paidLeaderboard.length - 1]?.user_id
    : null

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500/20 border-yellow-500/50'
      case 2:
        return 'bg-zinc-400/20 border-zinc-400/50'
      case 3:
        return 'bg-amber-700/20 border-amber-700/50'
      default:
        return 'bg-zinc-900 border-zinc-800'
    }
  }

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇'
      case 2:
        return '🥈'
      case 3:
        return '🥉'
      default:
        return `${rank}.`
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-zinc-400">{contest.name}</p>
        {answeredCount > 0 && (
          <p className="text-sm text-zinc-500">{answeredCount} props answered</p>
        )}
      </div>

      {/* Prize Pool */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-xl p-4 border border-blue-700/50">
        <div className="text-center space-y-1">
          <p className="text-zinc-400 text-sm">Prize Pool</p>
          <p className="text-3xl font-bold text-white">${totalPot.toFixed(0)}</p>
          <div className="flex justify-center gap-4 text-xs text-zinc-400 mt-2">
            <span>1st: ${(totalPot * (contest.payout_first ?? 0) / 100).toFixed(0)}</span>
            <span>2nd: ${(totalPot * (contest.payout_second ?? 0) / 100).toFixed(0)}</span>
            <span>3rd: ${(totalPot * (contest.payout_third ?? 0) / 100).toFixed(0)}</span>
          </div>
          <p className="text-xs text-red-400 mt-2">Last: ${lastPlacePayout} back</p>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        {leaderboard.map((entry) => {
          const isCurrentUser = entry.user_id === currentUserId
          const isLastPlace = entry.user_id === lastPlaceUserId

          return (
            <div
              key={entry.user_id}
              className={`rounded-xl p-4 border transition-all ${
                isLastPlace ? 'bg-red-900/20 border-red-700/50' : getRankStyle(Number(entry.rank))
              } ${isCurrentUser ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold w-8">
                    {getRankEmoji(Number(entry.rank))}
                  </span>
                  <div>
                    <p className={`font-medium ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
                      {entry.display_name}
                      {isCurrentUser && <span className="text-xs text-zinc-500 ml-2">(you)</span>}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {entry.total_picks} picks made
                      {!entry.has_paid_entry && (
                        <span className="text-amber-500 ml-2">• unpaid</span>
                      )}
                      {isLastPlace && (
                        <span className="text-red-400 ml-2">• gets ${lastPlacePayout} back</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-400">{entry.correct_picks}</p>
                  <p className="text-xs text-zinc-500">correct</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {leaderboard.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400">No players yet.</p>
          <p className="text-zinc-500 text-sm mt-2">Make some picks to appear on the leaderboard!</p>
        </div>
      )}

      {/* Previous Winners */}
      {contest.previous_winners && (
        <div className="bg-zinc-900 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowPreviousWinners(!showPreviousWinners)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-800 transition-colors"
          >
            <span className="text-white font-medium">Previous Winners</span>
            <svg
              className={`w-5 h-5 text-zinc-400 transition-transform ${showPreviousWinners ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {showPreviousWinners && (
            <div className="px-4 pb-4 border-t border-zinc-800">
              <div className="pt-3 text-zinc-300 whitespace-pre-line text-sm">
                {contest.previous_winners}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
