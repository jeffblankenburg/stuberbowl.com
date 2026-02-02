// Run with: node --env-file=.env.local scripts/create-admin.mjs

import { createClient } from '@supabase/supabase-js'

// *** CHANGE THESE ***
const ADMIN_PHONE = '6143275066'
const ADMIN_NAME = 'Jeff Blankenburg'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars. Run with: node --env-file=.env.local scripts/create-admin.mjs')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

console.log(`Creating admin: ${ADMIN_NAME} (${ADMIN_PHONE})...`)

const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
  phone: `+1${ADMIN_PHONE}`,
  phone_confirm: true,
})

if (authError) {
  console.error('Auth error:', authError.message)
  process.exit(1)
}

console.log('Auth user created:', authUser.user.id)

const { error: profileError } = await adminClient
  .from('sb_profiles')
  .insert({
    id: authUser.user.id,
    phone: ADMIN_PHONE,
    display_name: ADMIN_NAME,
    is_admin: true,
    has_paid_entry: true,
  })

if (profileError) {
  console.error('Profile error:', profileError.message)
  await adminClient.auth.admin.deleteUser(authUser.user.id)
  process.exit(1)
}

console.log('✓ Admin created! Log in at http://localhost:3003/login')
