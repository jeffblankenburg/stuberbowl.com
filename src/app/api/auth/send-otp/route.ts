import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Normalize to 10 digits for lookup
    const phone10 = phone.replace(/\D/g, '').slice(-10)

    // Check if this phone number exists in profiles table
    // Users are pre-created by admin using auth.admin.createUser()
    const { data: existingProfile, error: profileError } = await adminClient
      .from('sb_profiles')
      .select('id')
      .eq('phone', phone10)
      .single()

    if (profileError || !existingProfile) {
      return NextResponse.json(
        { error: 'You are not on the guest list. Please contact an administrator.' },
        { status: 403 }
      )
    }

    // User exists, send the OTP
    const { error: otpError } = await adminClient.auth.signInWithOtp({
      phone: `+1${phone10}`,
    })

    if (otpError) {
      console.error('OTP error:', otpError)
      return NextResponse.json({ error: otpError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send OTP error:', error)
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
  }
}
