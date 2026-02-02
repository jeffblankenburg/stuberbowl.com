'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  display_name: string
  phone: string
}

interface Props {
  users: User[]
  currentSimulation: {
    id: string
    displayName: string
  } | null
}

export function UserSimulator({ users, currentSimulation }: Props) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSimulate = async () => {
    if (!selectedUserId) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/simulate-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
        credentials: 'include'
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to start simulation:', error)
    }
    setLoading(false)
  }

  const handleStopSimulation = async () => {
    setLoading(true)
    try {
      await fetch('/api/admin/simulate-user', {
        method: 'DELETE',
        credentials: 'include'
      })
      router.refresh()
    } catch (error) {
      console.error('Failed to stop simulation:', error)
    }
    setLoading(false)
  }

  return (
    <div className="bg-purple-900/30 border border-purple-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">👤</span>
        <h3 className="text-white font-medium">User Simulation</h3>
      </div>

      {currentSimulation ? (
        <div className="space-y-3">
          <p className="text-purple-300 text-sm">
            Currently simulating: <span className="font-bold">{currentSimulation.displayName}</span>
          </p>
          <button
            onClick={handleStopSimulation}
            disabled={loading}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Stopping...' : 'Stop Simulation'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-zinc-400 text-sm">View the app as another user</p>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Select a user...</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name} ({user.phone})
              </option>
            ))}
          </select>
          <button
            onClick={handleSimulate}
            disabled={!selectedUserId || loading}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Starting...' : 'Simulate User'}
          </button>
        </div>
      )}
    </div>
  )
}
