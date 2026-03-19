import { useState, useEffect, useCallback } from 'react';
import { Terminal, Wifi, WifiOff, LogOut, Layers, Code2, Loader2 } from 'lucide-react';
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

const MODE_KEY = 'soupz_ide_mode';

export default function App() {
  const { path, getParam, navigate } = useRoute();

  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode]           = useState(() => localStorage.getItem(MODE_KEY) || 'simple');
  const [daemonOnline, setDaemonOnline] = useState(false);
  const [daemonMachine, setDaemonMachine] = useState(null);

  // File/git state for ProMode
  const [fileTree, setFileTree]   = useState(null);
  const [changedFiles, setChangedFiles] = useState([]);

  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

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

  // Daemon health
  useEffect(() => {
    async function check() {
      const h = await checkDaemonHealth();
      setDaemonOnline(h.online);
      if (h.online) setDaemonMachine(h.machine);
    }
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);

  // Supabase relay
  useEffect(() => {
    if (!user || user.id === 'local') return;
    return subscribeToDaemon(user.id, handleDaemonResponse);
  }, [user]);

  function handleDaemonResponse(response) {
    if (response.type === 'FILE_TREE') {
      setFileTree(response.payload?.tree);
      setChangedFiles(response.payload?.changedFiles || []);
    }
  }

  // Daemon interface object passed to components
  const daemon = {
    online: daemonOnline,
    machine: daemonMachine,
    async sendPrompt({ prompt, agentId, buildMode }, onChunk) {
      return sendAgentPrompt(prompt, agentId, buildMode, user?.id);
    },
    async readFile(path) {
      const id = await readFile(path, user?.id);
      return id; // response comes via relay
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

  // /landing route — marketing / investor page, no auth needed
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
          <ModeBtn active={mode === 'simple'} onClick={() => setMode('simple')} icon={<Layers size={12} />} label="Simple" />
          <ModeBtn active={mode === 'pro'}    onClick={() => setMode('pro')}    icon={<Code2 size={12} />}  label="Pro" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Daemon status */}
        <DaemonStatus online={daemonOnline} machine={daemonMachine} navigate={navigate} />

        {/* User */}
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
        {!daemonOnline && (
          <DaemonOfflineBanner navigate={navigate} />
        )}
        {mode === 'simple' ? (
          <SimpleMode daemon={daemon} />
        ) : (
          <ProMode daemon={daemon} fileTree={fileTree} changedPaths={changedFiles} />
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

function DaemonStatus({ online, machine, navigate }) {
  return (
    <button
      onClick={() => !online && navigate('/connect')}
      title={online ? `Connected: ${machine || 'your machine'}` : 'Click to connect your machine'}
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
        <><WifiOff size={11} /><span className="hidden sm:block">Offline</span></>
      )}
      {online && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
    </button>
  );
}

function DaemonOfflineBanner({ navigate }) {
  return (
    <div className="bg-warning/5 border-b border-warning/15 px-4 py-2 flex items-center gap-3 text-xs font-ui">
      <WifiOff size={13} className="text-warning shrink-0" />
      <span className="text-text-sec">
        Daemon not connected — run{' '}
        <code className="font-mono text-warning bg-warning/10 px-1 rounded">npx soupz</code>
        {' '}on your machine to start
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
