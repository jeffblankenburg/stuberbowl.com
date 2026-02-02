// Run with: npx tsx scripts/create-admin.ts
// Creates the first admin user for Stuber Bowl

import { createClient } from '@supabase/supabase-js'

const ADMIN_PHONE = '6145551234' // <-- CHANGE THIS to your 10-digit phone
const ADMIN_NAME = 'Jeff'        // <-- CHANGE THIS to your name

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing environment variables. Make sure .env.local is loaded.')
    console.error('Run with: npx tsx --env-file=.env.local scripts/create-admin.ts')
    process.exit(1)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  console.log(`Creating admin user: ${ADMIN_NAME} (${ADMIN_PHONE})...`)

  // Create user in Supabase Auth
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    phone: `+1${ADMIN_PHONE}`,
    phone_confirm: true,
  })

  if (authError) {
    console.error('Failed to create auth user:', authError.message)
    process.exit(1)
  }

  console.log('Auth user created:', authUser.user.id)

  // Create profile
  const { error: profileError } = await adminClient
    .from('sb_profiles')
    .insert({
      id: authUser.user.id,
      phone: ADMIN_PHONE,
      display_name: ADMIN_NAME,
      is_admin: true,
    })

  if (profileError) {
    console.error('Failed to create profile:', profileError.message)
    // Clean up auth user
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    process.exit(1)
  }

  console.log('✓ Admin user created successfully!')
  console.log(`  Phone: ${ADMIN_PHONE}`)
  console.log(`  Name: ${ADMIN_NAME}`)
  console.log('\nYou can now log in at http://localhost:3003/login')
}

main()
