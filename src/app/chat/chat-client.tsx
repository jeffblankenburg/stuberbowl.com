'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Contest, ChatMessageWithProfile } from '@/types/database'

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
                <p className="break-words">{message.message}</p>
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

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex gap-2">
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
