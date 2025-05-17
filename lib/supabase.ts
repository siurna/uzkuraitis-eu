import { createClient } from "@supabase/supabase-js"

// Create a single supabase client for the browser
const createBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

  return createClient(supabaseUrl, supabaseAnonKey)
}

// Create a single supabase client for server components
const createServerClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL as string
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

  return createClient(supabaseUrl, supabaseServiceKey)
}

// Browser client singleton
let browserClient: ReturnType<typeof createClient> | null = null

// Get the browser client (client-side only)
export const getSupabaseBrowserClient = () => {
  if (typeof window === "undefined") {
    throw new Error("getSupabaseBrowserClient should only be called on the client side")
  }

  if (!browserClient) {
    browserClient = createBrowserClient()
  }

  return browserClient
}

// Get the server client (server-side only)
export const getSupabaseServerClient = () => {
  return createServerClient()
}
