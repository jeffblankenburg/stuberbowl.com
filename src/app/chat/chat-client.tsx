'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Contest, ChatMessageWithProfile, GiphyGif } from '@/types/database'
import Image from 'next/image'

interface ChatClientProps {
  contest: Contest
  initialMessages: ChatMessageWithProfile[]
  userId: string
  userName: string
}

export function ChatClient({ contest, initialMessages, userId, userName }: ChatClientProps) {
  const [messages, setMessages] = useState<ChatMessageWithProfile[]>(initialMessages)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // GIF picker state
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [loadingGifs, setLoadingGifs] = useState(false)
  const [gifError, setGifError] = useState<string | null>(null)

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Subscribe to new messages
  useEffect(() => {
    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sb_chat_messages',
          filter: `contest_id=eq.${contest.id}`,
        },
        async (payload: { new: Record<string, unknown> }) => {
          // Fetch the profile for the new message
          const { data: profile } = await supabase
            .from('sb_profiles')
            .select('display_name')
            .eq('id', payload.new.user_id as string)
            .single()

          const newMsg: ChatMessageWithProfile = {
            ...payload.new as unknown as ChatMessageWithProfile,
            profile: profile || { display_name: 'Unknown' },
          }

          setMessages(prev => [...prev, newMsg])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'sb_chat_messages',
          filter: `contest_id=eq.${contest.id}`,
        },
        (payload: { old: Record<string, unknown> }) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, contest.id])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    const messageText = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase
      .from('sb_chat_messages')
      .insert({
        contest_id: contest.id,
        user_id: userId,
        message: messageText,
      })

    if (error) {
      setNewMessage(messageText) // Restore message on error
      console.error('Failed to send message:', error)
    }

    setSending(false)
  }

  // Fetch GIFs from GIPHY API
  const fetchGifs = useCallback(async (query: string) => {
    setLoadingGifs(true)
    setGifError(null)

    try {
      const url = query.trim()
        ? `/api/giphy/search?q=${encodeURIComponent(query)}`
        : '/api/giphy/search'

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error('Failed to fetch GIFs')
      }

      const data = await response.json()
      setGifs(data.data || [])
    } catch (error) {
      console.error('Error fetching GIFs:', error)
      setGifError('Failed to load GIFs')
      setGifs([])
    } finally {
      setLoadingGifs(false)
    }
  }, [])

  // Debounced GIF search
  useEffect(() => {
    if (!showGifPicker) return

    const timer = setTimeout(() => {
      fetchGifs(gifSearch)
    }, 300)

    return () => clearTimeout(timer)
  }, [gifSearch, showGifPicker, fetchGifs])

  // Load trending GIFs when picker opens
  useEffect(() => {
    if (showGifPicker && gifs.length === 0 && !gifSearch) {
      fetchGifs('')
    }
  }, [showGifPicker, gifs.length, gifSearch, fetchGifs])

  const handleSendGif = async (gif: GiphyGif) => {
    if (sending) return

    setShowGifPicker(false)
    setGifSearch('')
    setSending(true)

    const gifUrl = gif.images.fixed_height.url

    const { error } = await supabase
      .from('sb_chat_messages')
      .insert({
        contest_id: contest.id,
        user_id: userId,
        gif_url: gifUrl,
      })

    if (error) {
      console.error('Failed to send GIF:', error)
    }

    setSending(false)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-white text-center">Chat</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((message) => {
          const isOwnMessage = message.user_id === userId

          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  isOwnMessage
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-zinc-800 text-white rounded-bl-md'
                }`}
              >
                {!isOwnMessage && (
                  <p className="text-xs text-blue-400 font-medium mb-1">
                    {message.profile?.display_name || 'Unknown'}
                  </p>
                )}
                {message.gif_url ? (
                  <Image
                    src={message.gif_url}
                    alt="GIF"
                    width={200}
                    height={150}
                    className="rounded-lg"
                    unoptimized
                    onLoad={scrollToBottom}
                  />
                ) : (
                  <p className="break-words">{message.message}</p>
                )}
                <p className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-200' : 'text-zinc-500'}`}>
                  {formatTime(message.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500">No messages yet. Start the conversation!</p>
        </div>
      )}

      {/* GIF Picker */}
      {showGifPicker && (
        <div className="border-t border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3">
            <input
              type="text"
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
              placeholder="Search GIFs..."
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="h-48 overflow-y-auto">
            {loadingGifs ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : gifError ? (
              <div className="flex items-center justify-center h-full text-red-400">
                {gifError}
              </div>
            ) : gifs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-zinc-500">
                No GIFs found
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    onClick={() => handleSendGif(gif)}
                    className="relative overflow-hidden rounded-lg hover:ring-2 hover:ring-blue-500 transition-all"
                  >
                    <Image
                      src={gif.images.fixed_height_small.url}
                      alt={gif.title}
                      width={100}
                      height={100}
                      className="w-full h-auto object-cover"
                      unoptimized
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-500 text-center mt-2">Powered by GIPHY</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowGifPicker(!showGifPicker)}
            className={`px-4 py-3 rounded-full font-medium transition-colors ${
              showGifPicker
                ? 'bg-blue-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            GIF
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-full transition-colors"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
