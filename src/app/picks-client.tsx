'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PropBetCard } from '@/components/PropBetCard'
import { Contest, PropBet, UserPick } from '@/types/database'

interface PicksClientProps {
  contest: Contest
  propBets: PropBet[]
  initialPicks: UserPick[]
  userId: string
  userName: string
}

export function PicksClient({ contest, propBets, initialPicks, userId, userName }: PicksClientProps) {
  const [picks, setPicks] = useState<UserPick[]>(initialPicks)
  const [saving, setSaving] = useState(false)
  const [propBetsState, setPropBetsState] = useState<PropBet[]>(propBets)
  const supabase = createClient()

  // Calculate progress
  const totalBets = propBetsState.length
  const pickedCount = picks.length
  const correctCount = picks.filter(p => p.is_correct === true).length
  const answeredCount = propBetsState.filter(pb => pb.correct_answer !== null).length

  // Get pick for a specific prop bet
  const getPickForBet = (propBetId: string) => {
    return picks.find(p => p.prop_bet_id === propBetId)
  }

  // Handle selection
  const handleSelect = useCallback(async (propBetId: string, option: 'A' | 'B') => {
    if (contest.picks_locked) return

    setSaving(true)

    const existingPick = picks.find(p => p.prop_bet_id === propBetId)

    if (existingPick) {
      // Update existing pick
      const { error } = await supabase
        .from('sb_picks')
        .update({ selected_option: option, updated_at: new Date().toISOString() })
        .eq('id', existingPick.id)

      if (!error) {
        setPicks(prev => prev.map(p =>
          p.id === existingPick.id ? { ...p, selected_option: option } : p
        ))
      }
    } else {
      // Create new pick
      const { data, error } = await supabase
        .from('sb_picks')
        .insert({
          user_id: userId,
          prop_bet_id: propBetId,
          selected_option: option,
        })
        .select()
        .single()

      if (!error && data) {
        setPicks(prev => [...prev, data])
      }
    }

    setSaving(false)
  }, [contest.picks_locked, picks, supabase, userId])

  // Subscribe to realtime updates for prop bets (results)
  useEffect(() => {
    const channel = supabase
      .channel('prop-bets-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sb_prop_bets',
          filter: `contest_id=eq.${contest.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          setPropBetsState(prev =>
            prev.map(pb => pb.id === payload.new.id ? { ...pb, ...payload.new } : pb)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, contest.id])

  // Subscribe to realtime updates for picks (correctness)
  useEffect(() => {
    const channel = supabase
      .channel('picks-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sb_picks',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          setPicks(prev =>
            prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-blue-400">Stuber Bowl</h1>
        <p className="text-zinc-400">{contest.name}</p>
        <p className="text-sm text-zinc-500">Hey, {userName}!</p>
      </div>

      {/* Progress */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-zinc-400">Your Progress</span>
          <span className="text-white font-medium">{pickedCount}/{totalBets} picked</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${totalBets > 0 ? (pickedCount / totalBets) * 100 : 0}%` }}
          />
        </div>

        {answeredCount > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between text-sm">
            <span className="text-zinc-400">Score</span>
            <span className="text-green-400 font-medium">{correctCount}/{answeredCount} correct</span>
          </div>
        )}
      </div>

      {/* Lock status */}
      {contest.picks_locked && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-3 text-center">
          <p className="text-amber-400 text-sm font-medium">Picks are locked!</p>
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white text-sm px-3 py-1 rounded-full">
          Saving...
        </div>
      )}

      {/* Prop bets list */}
      <div className="space-y-4">
        {propBetsState.map((propBet, index) => (
          <div key={propBet.id}>
            <div className="text-xs text-zinc-500 mb-2">#{index + 1}</div>
            <PropBetCard
              propBet={propBet}
              userPick={getPickForBet(propBet.id)}
              picksLocked={contest.picks_locked}
              onSelect={handleSelect}
            />
          </div>
        ))}
      </div>

      {propBetsState.length === 0 && (
        <div className="text-center py-12">
          <p className="text-zinc-400">No prop bets yet.</p>
          <p className="text-zinc-500 text-sm mt-2">Check back when the admin adds them.</p>
        </div>
      )}
    </div>
  )
}
