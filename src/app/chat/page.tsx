import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatClient } from './chat-client'
import { getActiveUserId } from '@/lib/simulation'

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the active user ID (simulated or real)
  const activeUserId = await getActiveUserId(user.id)

  // Get active contest
  const { data: contest } = await supabase
    .from('sb_contests')
    .select('*')
    .eq('is_active', true)
    .single()

  if (!contest) {
    return (
      <div className="p-4 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">No Active Contest</h1>
        <p className="text-zinc-400">Check back when the contest is set up.</p>
      </div>
    )
  }

  // Get recent messages (last 100)
  const { data: messages } = await supabase
    .from('sb_chat_messages')
    .select(`
      *,
      profile:sb_profiles(display_name)
    `)
    .eq('contest_id', contest.id)
    .order('created_at', { ascending: true })
    .limit(100)

  // Get current user profile (use active user ID for simulation)
  const { data: profile } = await supabase
    .from('sb_profiles')
    .select('display_name')
    .eq('id', activeUserId)
    .single()

  return (
    <ChatClient
      contest={contest}
      initialMessages={messages || []}
      userId={activeUserId}
      userName={profile?.display_name || 'Player'}
    />
  )
}
