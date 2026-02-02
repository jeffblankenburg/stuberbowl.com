'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('sb_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        setDisplayName(data.display_name)
      }
      setLoading(false)
    }

    fetchProfile()
  }, [supabase, router])

  const handleSave = async () => {
    if (!profile || !displayName.trim()) return

    setSaving(true)

    const { error } = await supabase
      .from('sb_profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', profile.id)

    if (!error) {
      setProfile(prev => prev ? { ...prev, display_name: displayName.trim() } : null)
    }

    setSaving(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const formatPhone = (phone: string) => {
    const numbers = phone.replace(/\D/g, '').slice(-10)
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-4 text-center">
        <p className="text-zinc-400">Profile not found.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="text-6xl mb-4">👤</div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-4">
        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Display Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={20}
            />
            <button
              onClick={handleSave}
              disabled={saving || displayName === profile.display_name}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Phone Number
          </label>
          <p className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400">
            {formatPhone(profile.phone)}
          </p>
        </div>
      </div>

      {/* Payment Status */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Payment Status</h2>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Entry Fee</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            profile.has_paid_entry
              ? 'bg-green-900/50 text-green-400'
              : 'bg-amber-900/50 text-amber-400'
          }`}>
            {profile.has_paid_entry ? 'Paid' : 'Unpaid'}
          </span>
        </div>

        {profile.has_received_payout && profile.payout_place && (
          <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-zinc-400">Payout ({profile.payout_place === 1 ? '1st' : profile.payout_place === 2 ? '2nd' : '3rd'} place)</span>
            <span className="text-green-400 font-medium">${profile.payout_amount}</span>
          </div>
        )}
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors"
      >
        Sign Out
      </button>
    </div>
  )
}
