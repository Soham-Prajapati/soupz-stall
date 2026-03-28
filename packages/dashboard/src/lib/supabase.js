import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export function isSupabaseConfigured() {
  return !!supabase;
}

// Auto-refresh session when tab becomes visible (prevents random logouts)
if (supabase && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error || !session) {
          supabase.auth.refreshSession().catch(() => {});
        }
      });
    }
  });
}
