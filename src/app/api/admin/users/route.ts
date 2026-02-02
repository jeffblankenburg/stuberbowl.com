import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - List all users
export async function GET() {
  try {
    const adminClient = createAdminClient()

    const { data: profiles, error } = await adminClient
      .from('sb_profiles')
      .select('*')
      .order('display_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profiles })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST - Create a new user
export async function POST(request: Request) {
  try {
    const { phone, displayName } = await request.json()

    if (!phone || !displayName) {
      return NextResponse.json(
        { error: 'Phone and display name are required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Normalize to 10 digits
    const phone10 = phone.replace(/\D/g, '').slice(-10)

    if (phone10.length !== 10) {
      return NextResponse.json(
        { error: 'Please enter a valid 10-digit phone number' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existingProfile } = await adminClient
      .from('sb_profiles')
      .select('id')
      .eq('phone', phone10)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { error: 'This phone number is already registered' },
        { status: 409 }
      )
    }

    // Create user in Supabase Auth using admin API
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      phone: `+1${phone10}`,
      phone_confirm: true, // Auto-confirm the phone
    })

    if (authError || !authUser?.user) {
      console.error('Auth create user error:', authError)
      return NextResponse.json(
        { error: authError?.message || 'Failed to create auth user' },
        { status: 500 }
      )
    }

    // Create profile
    const { error: profileError } = await adminClient
      .from('sb_profiles')
      .insert({
        id: authUser.user.id,
        phone: phone10,
        display_name: displayName.trim(),
      })

    if (profileError) {
      console.error('Profile create error:', profileError)
      // Try to clean up the auth user if profile creation failed
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authUser.user.id,
        phone: phone10,
        display_name: displayName.trim()
      }
    })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

// DELETE - Delete a user
export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Delete from auth (this will cascade to profile via trigger or we delete manually)
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Auth delete user error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      )
    }

    // Also delete profile (in case cascade doesn't work)
    await adminClient.from('sb_profiles').delete().eq('id', userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
