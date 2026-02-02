import { createClient } from '@supabase/supabase-js'

// Admin client bypasses RLS - use only in server-side code
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // Return a mock client during build
    return {
      auth: {
        signInWithOtp: async () => ({ error: { message: 'Not configured' } }),
        admin: {
          createUser: async () => ({ data: null, error: { message: 'Not configured' } }),
          deleteUser: async () => ({ error: { message: 'Not configured' } }),
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: { message: 'Not configured' } }),
            order: async () => ({ data: [], error: null }),
          }),
          order: async () => ({ data: [], error: null }),
        }),
        insert: async () => ({ data: null, error: null }),
        update: () => ({
          eq: async () => ({ error: null }),
        }),
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof createClient>
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
