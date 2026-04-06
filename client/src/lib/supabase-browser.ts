import { createClient } from '@supabase/supabase-js';

// Publishable values — safe to commit (anon key is intentionally public)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://zehzhfgegkbgkwmxxljt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_-2fmXlH-bf7-5xnfanF1Pw_JOedzvox';

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // We manage the session ourselves in localStorage — disable Supabase's own storage
    // so it doesn't conflict with our session management.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
