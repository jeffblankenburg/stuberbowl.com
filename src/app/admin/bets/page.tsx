'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PropBet, Contest } from '@/types/database'
import Link from 'next/link'

export default function AdminBetsPage() {
  const [contest, setContest] = useState<Contest | null>(null)
  const [propBets, setPropBets] = useState<PropBet[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // New bet form
  const [question, setQuestion] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [category, setCategory] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editOptionA, setEditOptionA] = useState('')
  const [editOptionB, setEditOptionB] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editImagePreview, setEditImagePreview] = useState('')
  const [editSourceUrl, setEditSourceUrl] = useState('')
  const editFileInputRef = useRef<HTMLInputElement>(null)

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
      const { data: betsData } = await supabase
        .from('sb_prop_bets')
        .select('*')
        .eq('contest_id', contestData.id)
        .order('sort_order', { ascending: true })

      setPropBets(betsData || [])
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true)

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('prop-images')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      setUploading(false)
      return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('prop-images')
      .getPublicUrl(fileName)

    setUploading(false)
    return publicUrl
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (e) => {
      const preview = e.target?.result as string
      if (isEdit) {
        setEditImagePreview(preview)
      } else {
        setImagePreview(preview)
      }
    }
    reader.readAsDataURL(file)

    // Upload to Supabase
    const url = await uploadImage(file)
    if (url) {
      if (isEdit) {
        setEditImageUrl(url)
      } else {
        setImageUrl(url)
      }
    }
  }

  const clearImage = (isEdit = false) => {
    if (isEdit) {
      setEditImageUrl('')
      setEditImagePreview('')
      if (editFileInputRef.current) editFileInputRef.current.value = ''
    } else {
      setImageUrl('')
      setImagePreview('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddBet = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contest || !question.trim() || !optionA.trim() || !optionB.trim()) return

    setSaving(true)

    const { error } = await supabase
      .from('sb_prop_bets')
      .insert({
        contest_id: contest.id,
        question: question.trim(),
        option_a: optionA.trim(),
        option_b: optionB.trim(),
        category: category.trim() || null,
        image_url: imageUrl || null,
        source_url: sourceUrl.trim() || null,
        sort_order: propBets.length,
      })

    if (!error) {
      setQuestion('')
      setOptionA('')
      setOptionB('')
      setCategory('')
      setImageUrl('')
      setImagePreview('')
      setSourceUrl('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchData()
    }

    setSaving(false)
  }

  const handleSetResult = async (betId: string, result: 'A' | 'B' | null) => {
    setSaving(true)

    await supabase
      .from('sb_prop_bets')
      .update({ correct_answer: result })
      .eq('id', betId)

    await fetchData()
    setSaving(false)
  }

  const handleStartEdit = (bet: PropBet) => {
    setEditingId(bet.id)
    setEditQuestion(bet.question)
    setEditOptionA(bet.option_a)
    setEditOptionB(bet.option_b)
    setEditImageUrl(bet.image_url || '')
    setEditImagePreview(bet.image_url || '')
    setEditSourceUrl(bet.source_url || '')
  }

  const handleSaveEdit = async () => {
    if (!editingId) return

    setSaving(true)

    await supabase
      .from('sb_prop_bets')
      .update({
        question: editQuestion.trim(),
        option_a: editOptionA.trim(),
        option_b: editOptionB.trim(),
        image_url: editImageUrl || null,
        source_url: editSourceUrl.trim() || null,
      })
      .eq('id', editingId)

    setEditingId(null)
    setEditImagePreview('')
    await fetchData()
    setSaving(false)
  }

  const handleDeleteBet = async (betId: string) => {
    if (!confirm('Delete this prop bet? This cannot be undone.')) return

    await supabase.from('sb_prop_bets').delete().eq('id', betId)
    await fetchData()
  }

  const handleToggleLock = async () => {
    if (!contest) return

    const newLockStatus = !contest.picks_locked

    if (newLockStatus && !confirm('Lock all picks? Users will no longer be able to change their selections.')) {
      return
    }

    await supabase
      .from('sb_contests')
      .update({ picks_locked: newLockStatus })
      .eq('id', contest.id)

    await fetchData()
  }

  const handleReorder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === propBets.length - 1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const currentBet = propBets[index]
    const swapBet = propBets[newIndex]

    // Swap sort_order values
    await Promise.all([
      supabase
        .from('sb_prop_bets')
        .update({ sort_order: newIndex })
        .eq('id', currentBet.id),
      supabase
        .from('sb_prop_bets')
        .update({ sort_order: index })
        .eq('id', swapBet.id),
    ])

    await fetchData()
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
          <p className="text-zinc-500 text-sm mt-2">Create a contest in your Supabase dashboard first.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-zinc-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Prop Bets</h1>
      </div>

      {/* Lock Toggle */}
      <div className="bg-zinc-900 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">Picks Status</p>
            <p className="text-zinc-500 text-sm">
              {contest.picks_locked ? 'Users cannot change picks' : 'Users can still edit picks'}
            </p>
          </div>
          <button
            onClick={handleToggleLock}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              contest.picks_locked
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {contest.picks_locked ? 'Unlock' : 'Lock'}
          </button>
        </div>
      </div>

      {/* Add New Bet */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-4">
        <h2 className="text-lg font-semibold text-white">Add New Prop</h2>
        <form onSubmit={handleAddBet} className="space-y-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question (e.g., Total passing yards?)"
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              placeholder="Option A (e.g., Over 250)"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              placeholder="Option B (e.g., Under 250)"
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (optional, e.g., Game, Halftime)"
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Image Upload */}
          <div className="space-y-2">
            <label className="block text-sm text-zinc-400">Image (optional)</label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-auto rounded-lg" />
                <button
                  type="button"
                  onClick={() => clearImage(false)}
                  className="absolute top-2 right-2 p-1 bg-red-600 rounded-full text-white hover:bg-red-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <span className="text-white text-sm">Uploading...</span>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors"
              >
                <span className="text-zinc-500 text-sm">Click to upload image</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, false)}
              className="hidden"
            />
          </div>

          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Sportsbook Source URL (optional)"
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={saving || uploading || !question.trim() || !optionA.trim() || !optionB.trim()}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
          >
            {saving ? 'Adding...' : 'Add Prop Bet'}
          </button>
        </form>
      </div>

      {/* Props List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">All Props ({propBets.length})</h2>
        {propBets.map((bet, index) => (
          <div key={bet.id} className="bg-zinc-900 rounded-xl p-4 space-y-3">
            {editingId === bet.id ? (
              /* Edit Mode */
              <div className="space-y-3">
                <input
                  type="text"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editOptionA}
                    onChange={(e) => setEditOptionA(e.target.value)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                  />
                  <input
                    type="text"
                    value={editOptionB}
                    onChange={(e) => setEditOptionB(e.target.value)}
                    className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                  />
                </div>

                {/* Edit Image Upload */}
                <div className="space-y-2">
                  {editImagePreview ? (
                    <div className="relative">
                      <img src={editImagePreview} alt="Preview" className="w-full h-auto rounded-lg" />
                      <button
                        type="button"
                        onClick={() => clearImage(true)}
                        className="absolute top-2 right-2 p-1 bg-red-600 rounded-full text-white hover:bg-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {uploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                          <span className="text-white text-sm">Uploading...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => editFileInputRef.current?.click()}
                      className="w-full h-16 border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-zinc-500 transition-colors"
                    >
                      <span className="text-zinc-500 text-sm">Click to upload image</span>
                    </div>
                  )}
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e, true)}
                    className="hidden"
                  />
                </div>

                <input
                  type="url"
                  value={editSourceUrl}
                  onChange={(e) => setEditSourceUrl(e.target.value)}
                  placeholder="Sportsbook Source URL (optional)"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={uploading}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white text-sm rounded-lg"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
                <div className="flex items-start justify-between gap-2">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleReorder(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-zinc-500 hover:text-white disabled:text-zinc-700 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleReorder(index, 'down')}
                      disabled={index === propBets.length - 1}
                      className="p-1 text-zinc-500 hover:text-white disabled:text-zinc-700 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex-1">
                    <p className="text-zinc-500 text-xs mb-1">#{index + 1} {bet.category && `• ${bet.category}`}</p>
                    <p className="text-white font-medium">{bet.question}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStartEdit(bet)}
                      className="text-zinc-500 hover:text-white text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBet(bet.id)}
                      className="text-red-500 hover:text-red-400 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {bet.image_url && (
                  <img src={bet.image_url} alt="" className="w-full h-auto rounded-lg" />
                )}

                {/* Options and Result Selection */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSetResult(bet.id, bet.correct_answer === 'A' ? null : 'A')}
                    className={`p-2 rounded-lg text-sm font-medium transition-all ${
                      bet.correct_answer === 'A'
                        ? 'bg-green-600 text-white ring-2 ring-green-400'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {bet.option_a}
                    {bet.correct_answer === 'A' && ' ✓'}
                  </button>
                  <button
                    onClick={() => handleSetResult(bet.id, bet.correct_answer === 'B' ? null : 'B')}
                    className={`p-2 rounded-lg text-sm font-medium transition-all ${
                      bet.correct_answer === 'B'
                        ? 'bg-green-600 text-white ring-2 ring-green-400'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {bet.option_b}
                    {bet.correct_answer === 'B' && ' ✓'}
                  </button>
                </div>

                {bet.correct_answer && (
                  <p className="text-green-400 text-xs text-center">
                    Result: {bet.correct_answer === 'A' ? bet.option_a : bet.option_b}
                  </p>
                )}
              </>
            )}
          </div>
        ))}

        {propBets.length === 0 && (
          <div className="text-center py-8">
            <p className="text-zinc-400">No prop bets yet.</p>
            <p className="text-zinc-500 text-sm mt-2">Add your first prop bet above.</p>
          </div>
        )}
      </div>
    </div>
  )
}
