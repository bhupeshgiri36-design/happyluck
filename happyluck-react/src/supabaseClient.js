import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    'in your .env file (local) or in Render → Environment (production).'
  )
}

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = key
export const supabase = url && key ? createClient(url, key) : null
