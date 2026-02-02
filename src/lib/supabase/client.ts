import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    // Return a mock client during build or when env vars are missing
    // This prevents build errors - the real client will be used at runtime
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        verifyOtp: async () => ({ error: { message: 'Not configured' } }),
      },
      from: () => ({
        select: () => ({ data: null, error: null, single: async () => ({ data: null, error: null }), eq: () => ({ data: null, error: null, single: async () => ({ data: null, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }), error: null }),
        update: () => ({ eq: () => ({ error: null }) }),
        delete: () => ({ eq: () => ({ error: null }) }),
      }),
      channel: () => ({
        on: () => ({ subscribe: () => ({}) }),
        subscribe: () => ({}),
      }),
      removeChannel: () => {},
      rpc: async () => ({ data: null, error: null }),
    } as unknown as ReturnType<typeof createBrowserClient>
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}
