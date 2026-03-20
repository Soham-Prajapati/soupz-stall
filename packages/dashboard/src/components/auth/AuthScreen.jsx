import { useState } from 'react';
import { Terminal, Github, Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export default function AuthScreen({ supabase, onAuth }) {
  const [loading, setLoading] = useState(null); // 'google' | 'github' | 'apple' | null
  const [error, setError] = useState('');

  async function handleOAuth(provider) {
    if (!supabase) return;
    setLoading(provider);
    setError('');
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (err) setError(err.message);
    } catch (e) {
      setError(e.message);
    }
    setLoading(null);
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
          <Terminal size={18} className="text-white" />
        </div>
        <span className="text-text-pri font-ui font-bold text-xl tracking-tight">Soupz</span>
      </div>

      <div className="w-full max-w-sm">
        <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden shadow-soft p-7">
          <h1 className="text-text-pri font-ui text-lg font-semibold text-center mb-1">Welcome to Soupz</h1>
          <p className="text-text-faint text-sm font-ui text-center mb-6">Sign in to start building</p>

          <div className="space-y-3">
            {/* Google */}
            <button
              onClick={() => handleOAuth('google')}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium font-ui transition-all disabled:opacity-50"
            >
              {loading === 'google' ? <Loader2 size={15} className="animate-spin" /> : (
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
              )}
              Continue with Google
            </button>

            {/* GitHub */}
            <button
              onClick={() => handleOAuth('github')}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg bg-bg-elevated border border-border-mid hover:border-border-strong text-text-pri text-sm font-medium font-ui transition-all disabled:opacity-50"
            >
              {loading === 'github' ? <Loader2 size={15} className="animate-spin" /> : <Github size={15} />}
              Continue with GitHub
            </button>

            {/* Apple */}
            <button
              onClick={() => handleOAuth('apple')}
              disabled={!!loading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg bg-bg-elevated border border-border-mid hover:border-border-strong text-text-pri text-sm font-medium font-ui transition-all disabled:opacity-50"
            >
              {loading === 'apple' ? <Loader2 size={15} className="animate-spin" /> : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              Continue with Apple
            </button>
          </div>

          {error && (
            <p className="text-danger text-xs font-ui mt-4 py-2 px-3 bg-danger/5 border border-danger/20 rounded-lg">{error}</p>
          )}
        </div>

        <p className="text-center text-text-faint text-[11px] mt-5 font-ui leading-relaxed">
          Your AI coding workspace. Free to use with your own AI agents.
        </p>
      </div>
    </div>
  );
}
