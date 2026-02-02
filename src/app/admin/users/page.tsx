'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import Link from 'next/link'

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
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
    const { data } = await supabase
      .from('sb_profiles')
      .select('*')
      .order('display_name')

    setProfiles(data || [])
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 3) return numbers
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)

    const phoneNumbers = phone.replace(/\D/g, '')

    if (phoneNumbers.length !== 10) {
      setError('Please enter a valid 10-digit phone number')
      setCreating(false)
      return
    }

    if (!displayName.trim()) {
      setError('Please enter a display name')
      setCreating(false)
      return
    }

    // Check if already exists locally
    const existingProfile = profiles.find(p => p.phone === phoneNumbers)
    if (existingProfile) {
      setError('This phone number is already registered')
      setCreating(false)
      return
    }

    // Call the admin API to create the user
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: phoneNumbers,
        displayName: displayName.trim(),
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      setError(result.error || 'Failed to create user')
      setCreating(false)
      return
    }

    setPhone('')
    setDisplayName('')
    await fetchData()
    setCreating(false)
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}? This cannot be undone.`)) {
      return
    }

    const response = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    if (!response.ok) {
      const result = await response.json()
      alert(result.error || 'Failed to delete user')
      return
    }

    await fetchData()
  }

  const handleTogglePaid = async (profileId: string, currentStatus: boolean) => {
    await supabase
      .from('sb_profiles')
      .update({ has_paid_entry: !currentStatus })
      .eq('id', profileId)
    await fetchData()
  }

  const handleToggleAdmin = async (profileId: string, currentStatus: boolean) => {
    await supabase
      .from('sb_profiles')
      .update({ is_admin: !currentStatus })
      .eq('id', profileId)
    await fetchData()
  }

  if (loading) {
    return <div className="p-4 text-center text-zinc-400">Loading...</div>
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-zinc-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Users</h1>
      </div>

      {/* Add User Form */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-4">
        <h2 className="text-lg font-semibold text-white">Add New User</h2>
        <form onSubmit={handleCreateUser} className="space-y-3">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display Name"
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(555) 123-4567"
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
          >
            {creating ? 'Creating...' : 'Add User'}
          </button>
        </form>
      </div>

      {/* Registered Users */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Users ({profiles.length})</h2>
        {profiles.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">No users yet. Add your first user above.</p>
        ) : (
          profiles.map((profile) => (
            <div key={profile.id} className="bg-zinc-900 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {profile.display_name}
                    {profile.is_admin && <span className="ml-2 text-xs text-blue-400">(admin)</span>}
                  </p>
                  <p className="text-zinc-500 text-sm">{formatPhone(profile.phone)}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleTogglePaid(profile.id, profile.has_paid_entry)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      profile.has_paid_entry
                        ? 'bg-green-900/50 text-green-400 hover:bg-green-900/70'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    {profile.has_paid_entry ? 'Paid' : 'Unpaid'}
                  </button>
                  <button
                    onClick={() => handleToggleAdmin(profile.id, profile.is_admin)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      profile.is_admin
                        ? 'bg-blue-900/50 text-blue-400 hover:bg-blue-900/70'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => handleDeleteUser(profile.id, profile.display_name)}
                    className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Delete user"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
