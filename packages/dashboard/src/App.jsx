import { useState, useEffect, useCallback } from 'react';
import {
  Terminal, Wifi, WifiOff, LogOut, Layers, Code2, Loader2, Sun, Moon, Contrast,
  Leaf, Snowflake, Ghost, Coffee, Landmark, Flower2, SunDim, Github, Check,
} from 'lucide-react';
import { useRoute } from './hooks/useRoute';
import ConnectPage from './components/connect/ConnectPage';
import AuthScreen from './components/auth/AuthScreen';
import SimpleMode from './components/simple/SimpleMode';
import ProMode from './components/pro/ProMode';
import LandingPage from './components/landing/LandingPage';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  checkDaemonHealth, subscribeToDaemon, sendAgentPrompt,
  getFileTree, readFile, writeFile, getGitStatus, getGitDiff,
  gitStage, gitCommit, gitPush,
} from './lib/daemon.js';
import { cn } from './lib/cn';

const MODE_KEY  = 'soupz_ide_mode';
const THEME_KEY = 'soupz_theme';

const THEMES = [
  { id: 'dark',        label: 'Dark',        icon: Moon },
  { id: 'dim',         label: 'Dim',         icon: Contrast },
  { id: 'midnight',    label: 'Midnight',    icon: Moon },
  { id: 'light',       label: 'Light',       icon: Sun },
  { id: 'monokai',     label: 'Monokai',     icon: Leaf },
  { id: 'nord',        label: 'Nord',        icon: Snowflake },
  { id: 'dracula',     label: 'Dracula',     icon: Ghost },
  { id: 'catppuccin',  label: 'Catppuccin',  icon: Coffee },
  { id: 'tokyo-night', label: 'Tokyo Night', icon: Landmark },
  { id: 'rose-pine',   label: 'Rosé Pine',   icon: Flower2 },
  { id: 'solarized',   label: 'Solarized',   icon: SunDim },
  { id: 'github-dark', label: 'GitHub Dark', icon: Github },
];

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export default function App() {
  const { path, getParam, navigate } = useRoute();

  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode]           = useState(() => localStorage.getItem(MODE_KEY) || 'simple');
  const [theme, setTheme]         = useState(() => {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(saved);
    return saved;
  });
  const [workspaceOnline, setWorkspaceOnline] = useState(false);
  const [workspaceMachine, setWorkspaceMachine] = useState(null);
  const [themeOpen, setThemeOpen] = useState(false);

  // File/git state for ProMode
  const [fileTree, setFileTree]   = useState(null);
  const [changedFiles, setChangedFiles] = useState([]);

  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

  useEffect(() => {
    function handleKey(e) {
      // Cmd+1: Chat mode, Cmd+2: IDE mode
      if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); setMode('simple'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); setMode('pro'); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  function changeTheme(t) {
    setTheme(t);
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
    setThemeOpen(false);
  }

  // Auth
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthLoading(false);
      setUser({ id: 'local', email: 'local@soupz.app' });
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Workspace health check
  useEffect(() => {
    async function check() {
      const h = await checkDaemonHealth();
      setWorkspaceOnline(h.online);
      if (h.online) setWorkspaceMachine(h.machine);
    }
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);

  // Supabase relay
  useEffect(() => {
    if (!user || user.id === 'local') return;
    return subscribeToDaemon(user.id, handleWorkspaceResponse);
  }, [user]);

  function handleWorkspaceResponse(response) {
    if (response.type === 'FILE_TREE') {
      setFileTree(response.payload?.tree);
      setChangedFiles(response.payload?.changedFiles || []);
    }
  }

  // Workspace interface object passed to components
  const workspace = {
    online: workspaceOnline,
    machine: workspaceMachine,
    async sendPrompt({ prompt, agentId, buildMode }, onChunk) {
      return sendAgentPrompt(prompt, agentId, buildMode, user?.id, onChunk);
    },
    async readFile(path) {
      return readFile(path, user?.id);
    },
    async writeFile(path, content) {
      return writeFile(path, content, user?.id);
    },
    async gitStatus() {
      return getGitStatus(null, user?.id);
    },
    async gitDiff() {
      return getGitDiff(null, user?.id);
    },
    async gitStage(paths) {
      for (const p of paths) await gitStage(p, user?.id);
    },
    async gitCommit(message) {
      return gitCommit(message, user?.id);
    },
    async gitPush() {
      return gitPush(user?.id);
    },
  };

  // /connect route — no auth needed
  if (path === '/connect') {
    return <ConnectPage getParam={getParam} navigate={navigate} />;
  }

  // /landing route — marketing page, no auth needed
  if (path === '/landing') {
    return <LandingPage navigate={navigate} />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Terminal size={16} className="text-white" />
          </div>
          <Loader2 size={16} className="text-text-faint animate-spin" />
        </div>
      </div>
    );
  }

  if (!user && isSupabaseConfigured()) {
    return <AuthScreen supabase={supabase} onAuth={() => {}} />;
  }

  const CurrentThemeIcon = THEMES.find(t => t.id === theme)?.icon || Moon;

  return (
    <div className="h-screen flex flex-col bg-bg-base overflow-hidden">
      {/* Nav */}
      <nav className="h-11 bg-bg-surface border-b border-border-subtle flex items-center px-3 gap-3 shrink-0 z-10">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
            <Terminal size={12} className="text-white" />
          </div>
          <span className="text-text-pri font-ui font-semibold text-sm tracking-tight hidden sm:block">soupz</span>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 bg-bg-base rounded-md p-0.5 border border-border-subtle">
          <ModeBtn active={mode === 'simple'} onClick={() => setMode('simple')} icon={<Layers size={12} />} label="Chat" />
          <ModeBtn active={mode === 'pro'}    onClick={() => setMode('pro')}    icon={<Code2 size={12} />}  label="IDE" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Theme picker */}
        <div className="relative">
          <button
            onClick={() => setThemeOpen(o => !o)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-text-faint hover:text-text-sec hover:bg-bg-elevated transition-all"
            title="Change theme"
          >
            <CurrentThemeIcon size={13} />
          </button>
          {themeOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setThemeOpen(false)} />
              <div className="absolute right-0 top-8 z-40 bg-bg-surface border border-border-subtle rounded-lg shadow-soft overflow-hidden py-1 min-w-[140px]">
                {THEMES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => changeTheme(id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors',
                      theme === id
                        ? 'text-accent bg-accent/5'
                        : 'text-text-sec hover:text-text-pri hover:bg-bg-elevated',
                    )}
                  >
                    <Icon size={12} />
                    {label}
                    {theme === id && <Check size={10} className="ml-auto text-accent" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Workspace status */}
        <WorkspaceStatus online={workspaceOnline} machine={workspaceMachine} navigate={navigate} />

        {/* User email */}
        {user?.email && user.id !== 'local' && (
          <span className="text-text-faint text-xs font-ui hidden md:block truncate max-w-36">{user.email}</span>
        )}

        {/* Sign out */}
        {isSupabaseConfigured() && user?.id !== 'local' && (
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1 text-text-faint hover:text-text-sec text-xs font-ui transition-colors"
            title="Sign out"
          >
            <LogOut size={13} />
            <span className="hidden sm:block">Sign out</span>
          </button>
        )}
      </nav>

      {/* Main */}
      <div className="flex-1 overflow-hidden min-h-0">
        {!workspaceOnline && !!localStorage.getItem('soupz_daemon_token') && (
          <WorkspaceOfflineBanner navigate={navigate} />
        )}
        {mode === 'simple' ? (
          <SimpleMode daemon={workspace} />
        ) : (
          <ProMode daemon={workspace} fileTree={fileTree} changedPaths={changedFiles} />
        )}
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-ui font-medium transition-all',
        active
          ? 'bg-bg-elevated text-text-pri border border-border-subtle'
          : 'text-text-faint hover:text-text-sec',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function WorkspaceStatus({ online, machine, navigate }) {
  return (
    <button
      onClick={() => !online && navigate('/connect')}
      title={online ? `Connected to ${machine || 'your machine'}` : 'Click to connect your machine'}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-ui transition-all',
        online
          ? 'text-success bg-success/5 border border-success/15 cursor-default'
          : 'text-text-faint bg-bg-elevated border border-border-subtle hover:border-border-mid hover:text-text-sec cursor-pointer',
      )}
    >
      {online ? (
        <><Wifi size={11} /><span className="hidden sm:block">{machine || 'Connected'}</span></>
      ) : (
        <><WifiOff size={11} /><span className="hidden sm:block">Not connected</span></>
      )}
      {online && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
    </button>
  );
}

function WorkspaceOfflineBanner({ navigate }) {
  return (
    <div className="bg-warning/5 border-b border-warning/15 px-4 py-2 flex items-center gap-3 text-xs font-ui">
      <WifiOff size={13} className="text-warning shrink-0" />
      <span className="text-text-sec">
        Not connected — run{' '}
        <code className="font-mono text-warning bg-warning/10 px-1 rounded">npx soupz</code>
        {' '}in your terminal to start
      </span>
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('/landing')}
          className="text-text-faint hover:text-text-sec transition-colors"
        >
          View demo
        </button>
        <button
          onClick={() => navigate('/connect')}
          className="text-accent hover:text-accent-hover transition-colors"
        >
          Connect
        </button>
      </div>
    </div>
  );
}
