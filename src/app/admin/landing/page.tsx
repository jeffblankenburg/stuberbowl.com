'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Contest } from '@/types/database'
import Link from 'next/link'

export default function AdminLandingPage() {
  const [contest, setContest] = useState<Contest | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [landingMessage, setLandingMessage] = useState('')
  const [venmoUsername, setVenmoUsername] = useState('')
  const [paypalUsername, setPaypalUsername] = useState('')

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
      setLandingMessage(contestData.landing_message || '')
      setVenmoUsername(contestData.venmo_username || '')
      setPaypalUsername(contestData.paypal_username || '')
    }
  }

  const handleSave = async () => {
    if (!contest) return

    setSaving(true)

    await supabase
      .from('sb_contests')
      .update({
        landing_message: landingMessage.trim() || null,
        venmo_username: venmoUsername.trim() || null,
        paypal_username: paypalUsername.trim() || null,
      })
      .eq('id', contest.id)

    await fetchData()
    setSaving(false)
  }

  const hasChanges = contest && (
    landingMessage !== (contest.landing_message || '') ||
    venmoUsername !== (contest.venmo_username || '') ||
    paypalUsername !== (contest.paypal_username || '')
  )

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

  // Preview links
  const entryFee = contest.entry_fee ?? 10
  const venmoLink = venmoUsername
    ? `https://venmo.com/${venmoUsername}?txn=pay&amount=${entryFee}&note=${encodeURIComponent('Stuber Bowl Entry')}`
    : null
  const paypalLink = paypalUsername
    ? `https://www.paypal.com/paypalme/${paypalUsername}/${entryFee}`
    : null

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-zinc-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Landing Page</h1>
      </div>

      {/* Welcome Message */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-3">
        <label className="block text-sm font-medium text-zinc-400">
          Welcome Message
        </label>
        <textarea
          value={landingMessage}
          onChange={(e) => setLandingMessage(e.target.value)}
          rows={3}
          placeholder="Welcome to Stuber Bowl! Pay your entry fee to get started..."
          className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Payment Links */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-4">
        <h2 className="text-lg font-semibold text-white">Payment Links</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Venmo Username
            </label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">venmo.com/</span>
              <input
                type="text"
                value={venmoUsername}
                onChange={(e) => setVenmoUsername(e.target.value)}
                placeholder="John-Stuber"
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {venmoLink && (
              <p className="text-xs text-zinc-500 mt-1 break-all">
                Preview: <a href={venmoLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{venmoLink}</a>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              PayPal.me Username
            </label>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">paypal.me/</span>
              <input
                type="text"
                value={paypalUsername}
                onChange={(e) => setPaypalUsername(e.target.value)}
                placeholder="johnmstuber"
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {paypalLink && (
              <p className="text-xs text-zinc-500 mt-1 break-all">
                Preview: <a href={paypalLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{paypalLink}</a>
              </p>
            )}
          </div>
        </div>

        <p className="text-zinc-500 text-sm">
          Entry fee (${entryFee}) will be pre-filled in payment links. Edit entry fee in the Payouts section.
        </p>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-semibold rounded-xl transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      )}
    </div>
  )
}
