import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getActiveUserId } from '@/lib/simulation'
import { ProfileClient } from './profile-client'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the active user ID (simulated or real)
  const activeUserId = await getActiveUserId(user.id)

  // Get profile for the active user
  const { data: profile } = await supabase
    .from('sb_profiles')
    .select('*')
    .eq('id', activeUserId)
    .single()

  if (!profile) {
    return (
      <div className="p-4 text-center">
        <p className="text-zinc-400">Profile not found.</p>
      </div>
    )
  }

  return <ProfileClient profile={profile} />
}
