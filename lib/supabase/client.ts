import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // By default the auth client serialises token access through the
        // browser-wide navigator.locks manager. With multiple tabs of the
        // app open in Chrome, one tab can hold that lock and deadlock
        // getUser()/getSession() in another — leaving pages stuck on their
        // loading screen forever. Override it with a pass-through lock that
        // just runs the operation; we never need cross-tab serialisation.
        lock: async (_name, _acquireTimeout, fn) => fn(),
      },
    },
  )
}