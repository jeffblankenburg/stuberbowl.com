'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
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
  const [currentIndex, setCurrentIndex] = useState(0)
  const supabase = createClient()

  // Current prop bet (may be undefined if on completion screen)
  const currentPropBet = propBetsState[currentIndex]
  const isFirstQuestion = currentIndex === 0
  const isLastQuestion = currentIndex === propBetsState.length - 1
  const isCompletionScreen = currentIndex === propBetsState.length

  // Find unanswered questions
  const unansweredQuestions = propBetsState.filter(pb => {
    const pick = picks.find(p => p.prop_bet_id === pb.id)
    if (pb.is_open_ended) {
      return !pick?.value_response
    }
    return !pick?.selected_option
  })

  // Calculate progress
  const totalBets = propBetsState.length
  const pickedCount = picks.length
  const correctCount = picks.filter(p => p.is_correct === true).length
  const answeredCount = propBetsState.filter(pb => pb.correct_answer !== null).length

  // Get pick for a specific prop bet
  const getPickForBet = (propBetId: string) => {
    return picks.find(p => p.prop_bet_id === propBetId)
  }

  // Handle binary selection
  const handleSelect = useCallback(async (propBetId: string, option: 'A' | 'B') => {
    if (contest.picks_locked) return

    setSaving(true)

    const existingPick = picks.find(p => p.prop_bet_id === propBetId)
    const isNewPick = !existingPick

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

    // Auto-advance to next question (or completion screen) if this was a new pick
    if (isNewPick && currentIndex < propBetsState.length) {
      setCurrentIndex(prev => prev + 1)
    }
  }, [contest.picks_locked, picks, supabase, userId, currentIndex, propBetsState.length])

  // Handle open-ended value submission
  const handleValueSubmit = useCallback(async (propBetId: string, value: string) => {
    if (contest.picks_locked) return

    setSaving(true)

    const existingPick = picks.find(p => p.prop_bet_id === propBetId)
    const isNewPick = !existingPick

    if (existingPick) {
      // Update existing pick
      const { error } = await supabase
        .from('sb_picks')
        .update({ value_response: value, updated_at: new Date().toISOString() })
        .eq('id', existingPick.id)

      if (!error) {
        setPicks(prev => prev.map(p =>
          p.id === existingPick.id ? { ...p, value_response: value } : p
        ))
      }
    } else {
      // Create new pick
      const { data, error } = await supabase
        .from('sb_picks')
        .insert({
          user_id: userId,
          prop_bet_id: propBetId,
          value_response: value,
        })
        .select()
        .single()

      if (!error && data) {
        setPicks(prev => [...prev, data])
      }
    }

    setSaving(false)

    // Auto-advance to next question (or completion screen) if this was a new pick
    if (isNewPick && currentIndex < propBetsState.length) {
      setCurrentIndex(prev => prev + 1)
    }
  }, [contest.picks_locked, picks, supabase, userId, currentIndex, propBetsState.length])

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

  // Calculate the display index (excluding tiebreakers from numbering)
  const getDisplayIndex = (index: number) => {
    let displayNum = 0
    for (let i = 0; i <= index; i++) {
      if (!propBetsState[i].is_tiebreaker) {
        displayNum++
      }
    }
    return displayNum
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Status Bar */}
      <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 p-4 space-y-3 z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-blue-400">{contest.name}</h1>
            <p className="text-zinc-500 text-xs">{userName}</p>
          </div>
          <div className="text-right">
            <p className="text-white font-medium">{pickedCount}/{totalBets}</p>
            <p className="text-zinc-500 text-xs">picked</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${totalBets > 0 ? (pickedCount / totalBets) * 100 : 0}%` }}
          />
        </div>

        {/* Score (if game has started) */}
        {answeredCount > 0 && (
          <div className="flex justify-center">
            <span className="text-green-400 text-sm font-medium">{correctCount}/{answeredCount} correct</span>
          </div>
        )}

        {/* Lock status */}
        {contest.picks_locked && (
          <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-2 text-center">
            <p className="text-amber-400 text-xs font-medium">Picks are locked!</p>
          </div>
        )}
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white text-sm px-3 py-1 rounded-full z-20">
          Saving...
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col p-4">
        {propBetsState.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-zinc-400">No prop bets yet.</p>
              <p className="text-zinc-500 text-sm mt-2">Check back when the admin adds them.</p>
            </div>
          </div>
        ) : isCompletionScreen ? (
          /* Completion Screen */
          <div className="flex-1 flex flex-col">
            {/* Back button */}
            <div className="mb-4">
              <button
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="p-2 rounded-lg text-white bg-zinc-800 active:bg-zinc-700"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-6">
              {/* Completion status */}
              <div className="bg-zinc-900 rounded-xl p-6 text-center space-y-4">
                {unansweredQuestions.length === 0 ? (
                  <>
                    <div className="text-5xl">🎉</div>
                    <h2 className="text-2xl font-bold text-green-400">All Done!</h2>
                    <p className="text-zinc-400">
                      You&apos;ve answered all {totalBets} questions. Good luck!
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl">📝</div>
                    <h2 className="text-2xl font-bold text-amber-400">Almost There!</h2>
                    <p className="text-zinc-400">
                      You&apos;ve answered {pickedCount} of {totalBets} questions.
                    </p>
                    <div className="text-left bg-zinc-800 rounded-lg p-4 mt-4">
                      <p className="text-zinc-300 text-sm font-medium mb-2">Unanswered:</p>
                      <ul className="space-y-2">
                        {unansweredQuestions.map((q, idx) => (
                          <li key={q.id}>
                            <button
                              onClick={() => setCurrentIndex(propBetsState.indexOf(q))}
                              className="text-blue-400 text-sm text-left hover:underline"
                            >
                              {q.is_tiebreaker ? 'Tiebreaker' : `#${getDisplayIndex(propBetsState.indexOf(q))}`}: {q.question}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>

              {/* Feature callouts */}
              <div className="space-y-3">
                <Link href="/leaderboard" className="bg-zinc-900 rounded-xl p-4 flex items-center gap-4 active:bg-zinc-800 transition-colors">
                  <div className="text-3xl">🏆</div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Leaderboard</p>
                    <p className="text-zinc-400 text-sm">See how you stack up against other players</p>
                  </div>
                  <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>

                <Link href="/chat" className="bg-zinc-900 rounded-xl p-4 flex items-center gap-4 active:bg-zinc-800 transition-colors">
                  <div className="text-3xl">💬</div>
                  <div className="flex-1">
                    <p className="text-white font-medium">Chat</p>
                    <p className="text-zinc-400 text-sm">Talk trash and celebrate with everyone</p>
                  </div>
                  <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Navigation row with arrows */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCurrentIndex(prev => prev - 1)}
                disabled={isFirstQuestion}
                className={`p-2 rounded-lg transition-colors ${
                  isFirstQuestion
                    ? 'text-zinc-700 cursor-not-allowed'
                    : 'text-white bg-zinc-800 active:bg-zinc-700'
                }`}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              <span className="text-zinc-500 text-sm">
                {currentPropBet.is_tiebreaker ? 'Tiebreaker' : `${getDisplayIndex(currentIndex)} / ${propBetsState.filter(pb => !pb.is_tiebreaker).length}`}
              </span>

              <button
                onClick={() => setCurrentIndex(prev => prev + 1)}
                disabled={isCompletionScreen}
                className={`p-2 rounded-lg transition-colors ${
                  isCompletionScreen
                    ? 'text-zinc-700 cursor-not-allowed'
                    : 'text-white bg-zinc-800 active:bg-zinc-700'
                }`}
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Current prop bet card */}
            <div className="flex-1">
              <PropBetCard
                key={currentPropBet.id}
                propBet={currentPropBet}
                userPick={getPickForBet(currentPropBet.id)}
                picksLocked={contest.picks_locked}
                onSelect={handleSelect}
                onValueSubmit={handleValueSubmit}
                index={currentPropBet.is_tiebreaker ? undefined : getDisplayIndex(currentIndex)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
