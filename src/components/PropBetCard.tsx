'use client'

import { PropBet, UserPick } from '@/types/database'

interface PropBetCardProps {
  propBet: PropBet
  userPick?: UserPick
  picksLocked: boolean
  onSelect: (propBetId: string, option: 'A' | 'B') => void
}

export function PropBetCard({ propBet, userPick, picksLocked, onSelect }: PropBetCardProps) {
  const hasResult = propBet.correct_answer !== null
  const selectedOption = userPick?.selected_option
  const isCorrect = userPick?.is_correct

  return (
    <div className="bg-zinc-900 rounded-xl p-4 space-y-3">
      <p className="text-white font-bold">{propBet.question}</p>

      {propBet.image_url && (
        <div className="rounded-lg overflow-hidden">
          <img
            src={propBet.image_url}
            alt=""
            className="w-full h-auto"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Option A */}
        <button
          onClick={() => !picksLocked && !hasResult && onSelect(propBet.id, 'A')}
          disabled={picksLocked || hasResult}
          className={`p-3 rounded-lg text-sm font-medium transition-all ${
            hasResult
              ? propBet.correct_answer === 'A'
                ? 'bg-green-600 text-white'
                : selectedOption === 'A'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-800 text-zinc-500'
              : selectedOption === 'A'
              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          } ${picksLocked && !hasResult ? 'cursor-not-allowed' : ''}`}
        >
          {propBet.option_a}
          {hasResult && propBet.correct_answer === 'A' && (
            <span className="ml-2">✓</span>
          )}
        </button>

        {/* Option B */}
        <button
          onClick={() => !picksLocked && !hasResult && onSelect(propBet.id, 'B')}
          disabled={picksLocked || hasResult}
          className={`p-3 rounded-lg text-sm font-medium transition-all ${
            hasResult
              ? propBet.correct_answer === 'B'
                ? 'bg-green-600 text-white'
                : selectedOption === 'B'
                ? 'bg-red-600 text-white'
                : 'bg-zinc-800 text-zinc-500'
              : selectedOption === 'B'
              ? 'bg-blue-600 text-white ring-2 ring-blue-400'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          } ${picksLocked && !hasResult ? 'cursor-not-allowed' : ''}`}
        >
          {propBet.option_b}
          {hasResult && propBet.correct_answer === 'B' && (
            <span className="ml-2">✓</span>
          )}
        </button>
      </div>

      {/* Result indicator */}
      {hasResult && userPick && (
        <p className={`text-xs text-center ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
          {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
        </p>
      )}
    </div>
  )
}
