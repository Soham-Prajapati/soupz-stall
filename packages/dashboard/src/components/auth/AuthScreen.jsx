import { useState } from 'react';
import { Terminal, Mail, Lock, Eye, EyeOff, Github, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

export default function AuthScreen({ supabase, onAuth }) {
  const [tab, setTab]         = useState('login');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const hasSupabase = !!supabase;

  async function handleEmailAuth(e) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      const fn = tab === 'login' ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error: err } = await fn.call(supabase.auth, { email, password });
      if (err) setError(err.message);
      else onAuth?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHub() {
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    });
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <Terminal size={16} className="text-white" />
        </div>
        <span className="text-text-pri font-ui font-semibold text-lg tracking-tight">Soupz</span>
      </div>

      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-soft">
          {/* Tabs */}
          <div className="flex border-b border-border-subtle">
            {['login', 'signup'].map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={cn(
                  'flex-1 py-3.5 text-sm font-medium font-ui transition-colors',
                  tab === t
                    ? 'text-text-pri border-b-2 border-accent -mb-px'
                    : 'text-text-sec hover:text-text-pri',
                )}
              >
                {t === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* GitHub OAuth */}
            {hasSupabase && (
              <>
                <button
                  onClick={handleGitHub}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-md bg-bg-elevated border border-border-mid hover:border-border-strong text-text-pri text-sm font-medium font-ui transition-all disabled:opacity-50"
                >
                  <Github size={15} />
                  Continue with GitHub
                </button>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-border-subtle" />
                  <span className="text-text-faint text-xs font-ui">or</span>
                  <div className="flex-1 h-px bg-border-subtle" />
                </div>
              </>
            )}

            {/* Email form */}
            {hasSupabase && (
              <form onSubmit={handleEmailAuth} className="space-y-3">
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-bg-elevated border border-border-subtle rounded-md text-text-pri text-sm font-ui placeholder:text-text-faint focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full pl-9 pr-9 py-2.5 bg-bg-elevated border border-border-subtle rounded-md text-text-pri text-sm font-ui placeholder:text-text-faint focus:border-accent focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-sec transition-colors"
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {error && (
                  <p className="text-danger text-xs font-ui py-2 px-3 bg-danger/5 border border-danger/20 rounded-md">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-accent hover:bg-accent-hover text-white text-sm font-medium font-ui transition-colors disabled:opacity-60"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : (
                    <>{tab === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={14} /></>
                  )}
                </button>
              </form>
            )}

            {/* Local-only option */}
            <div className={cn('text-center', hasSupabase ? 'mt-5 pt-5 border-t border-border-subtle' : '')}>
              {!hasSupabase && (
                <p className="text-text-sec text-sm mb-4">No cloud account configured.</p>
              )}
              <button
                onClick={() => onAuth?.('local')}
                className="text-text-sec hover:text-text-pri text-sm font-ui transition-colors underline underline-offset-2 decoration-border-mid"
              >
                Skip — use locally
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-text-faint text-xs mt-5 font-ui">
          Your AI coding workspace. Works offline, syncs optionally.
        </p>
      </div>
    </div>
  );
}
