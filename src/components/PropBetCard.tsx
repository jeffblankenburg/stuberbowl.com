'use client'

import { useState } from 'react'
import { PropBet, UserPick } from '@/types/database'

interface PropBetCardProps {
  propBet: PropBet
  userPick?: UserPick
  picksLocked: boolean
  onSelect: (propBetId: string, option: 'A' | 'B') => void
  onValueSubmit?: (propBetId: string, value: string) => void
  index?: number
}

export function PropBetCard({ propBet, userPick, picksLocked, onSelect, onValueSubmit, index }: PropBetCardProps) {
  const hasResult = propBet.correct_answer !== null
  const selectedOption = userPick?.selected_option
  const isCorrect = userPick?.is_correct
  const [inputValue, setInputValue] = useState(userPick?.value_response || '')

  const handleValueBlur = () => {
    if (onValueSubmit && inputValue !== (userPick?.value_response || '')) {
      onValueSubmit(propBet.id, inputValue)
    }
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white font-bold">{index && !propBet.is_tiebreaker ? `${index}. ` : ''}{propBet.question}</p>
          {propBet.category && (
            <p className="text-zinc-400 text-xs mt-1">{propBet.category}</p>
          )}
        </div>
        {propBet.source_url && (
          <a
            href={propBet.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0"
          >
            <img src="/bovada.svg" alt="Bovada" className="h-[30px]" />
          </a>
        )}
      </div>

      {propBet.image_url && (
        <div className="rounded-lg overflow-hidden">
          <img
            src={propBet.image_url}
            alt=""
            className="w-full h-auto"
          />
        </div>
      )}

      {propBet.is_open_ended ? (
        /* Open-ended - text input with save button */
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={picksLocked}
              placeholder="Enter your answer..."
              className={`flex-1 px-4 py-3 bg-zinc-800 border rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                picksLocked ? 'cursor-not-allowed opacity-60' : 'border-zinc-700'
              } ${userPick?.value_response ? 'border-blue-500' : 'border-zinc-700'}`}
            />
            <button
              onClick={() => onValueSubmit && onValueSubmit(propBet.id, inputValue)}
              disabled={picksLocked || !inputValue.trim() || inputValue === (userPick?.value_response || '')}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
          {userPick?.value_response && inputValue === userPick.value_response && (
            <p className="text-blue-400 text-xs">Saved</p>
          )}
        </div>
      ) : (
        /* Binary choice - A/B buttons */
        <>
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
        </>
      )}
    </div>
  )
}
