import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  Terminal, Wifi, WifiOff, LogOut, Layers, Code2, Loader2, Sun, Moon, Contrast,
  Leaf, Snowflake, Ghost, Coffee, Landmark, Flower2, SunDim, Github, Check, Search,
  Shield,
} from 'lucide-react';
import { useRoute } from './hooks/useRoute';
import AuthScreen from './components/auth/AuthScreen';
import SimpleMode from './components/simple/SimpleMode';
import StatusBar from './components/shared/StatusBar';

// Lazy-load routes and heavy components not needed on first paint
const ConnectPage = lazy(() => import('./components/connect/ConnectPage'));
const ProMode = lazy(() => import('./components/pro/ProMode'));
const LandingPage = lazy(() => import('./components/landing/LandingPage'));
const ProfilePage = lazy(() => import('./components/profile/ProfilePage'));
const AdminPage = lazy(() => import('./components/admin/AdminPage'));
const CommandPalette = lazy(() => import('./components/shared/CommandPalette'));
const FolderPicker = lazy(() => import('./components/shared/FolderPicker'));
const SetupWizard = lazy(() => import('./components/shared/SetupWizard'));
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  checkDaemonHealth, subscribeToDaemon, sendAgentPrompt,
  getFileTree, readFile, writeFile, getGitStatus, getGitDiff,
  gitStage, gitCommit, gitPush, checkSystemCLIs,
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
  const [activeFleet, setActiveFleet] = useState([]); // Track background workers

  // ... (inside checkDaemonHealth loop)
  useEffect(() => {
    // ...
    const handleWsMessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'fleet_update') {
          setActiveFleet(msg.active);
        }
      } catch {}
    };
    // ...
  }, []);
  const [themeOpen, setThemeOpen] = useState(false);

  // File/git state for ProMode
  const [fileTree, setFileTree]   = useState(null);
  const [changedFiles, setChangedFiles] = useState([]);
  // Editor state lifted from ProMode for StatusBar
  const [editorState, setEditorState] = useState(null);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [workspaceRoot, setWorkspaceRoot] = useState(null);

  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

  // Auto-check setup on mount/login
  useEffect(() => {
    if (user && workspaceOnline && !localStorage.getItem('soupz_setup_completed')) {
      checkSystemCLIs().then(clis => {
        if (clis && clis.length > 0 && clis.some(c => !c.installed)) {
          setSetupOpen(true);
        } else if (clis && clis.length > 0) {
          localStorage.setItem('soupz_setup_completed', 'true');
        }
      }).catch(() => {});
    }
  }, [user, workspaceOnline]);

  useEffect(() => {
    function handleKey(e) {
      // Cmd+1: Chat mode, Cmd+2: IDE mode
      if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); setMode('simple'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); setMode('pro'); }
      // Cmd+Shift+P: Command Palette
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') { e.preventDefault(); setCmdPaletteOpen(v => !v); }
      // Cmd+K: also opens palette (common shortcut)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !e.shiftKey) { e.preventDefault(); setCmdPaletteOpen(v => !v); }
      // Cmd+O: Open folder on connected machine
      if ((e.metaKey || e.ctrlKey) && e.key === 'o' && !e.shiftKey) { e.preventDefault(); setFolderPickerOpen(v => !v); }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  async function handleOpenFolder(folderPath) {
    setWorkspaceRoot(folderPath);
    localStorage.setItem('soupz_workspace_root', folderPath);
    try {
      const treeData = await getFileTree(folderPath);
      if (treeData?.tree) {
        const children = Array.isArray(treeData.tree) ? treeData.tree : (treeData.tree.children || []);
        setFileTree(children);
        setChangedFiles(treeData.changedFiles || []);
      }
    } catch { /* failed to load */ }
    // Switch to IDE mode to show the files
    setMode('pro');
  }

  function handleCommand(actionId) {
    if (actionId === 'toggle-mode') setMode(m => m === 'simple' ? 'pro' : 'simple');
    else if (actionId.startsWith('theme-')) {
      const t = actionId.replace('theme-', '');
      setTheme(t); localStorage.setItem(THEME_KEY, t); applyTheme(t);
    }
    else if (actionId.startsWith('agent-')) {
      const a = actionId.replace('agent-', '');
      localStorage.setItem('soupz_agent', a);
      window.dispatchEvent(new StorageEvent('storage', { key: 'soupz_agent', newValue: a }));
    }
  }

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

    async function upsertProfile(u) {
      if (!u || u.id === 'local') return;
      const githubUsername = u.user_metadata?.user_name || u.user_metadata?.preferred_username || u.email?.split('@')[0];
      try {
        await supabase
          .from('soupz_profiles')
          .upsert({
            id: u.id,
            display_name: githubUsername,
            avatar_url: u.user_metadata?.avatar_url || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
      } catch (err) {
        console.error('Failed to sync profile:', err);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const curr = session?.user ?? null;
      setUser(curr);
      if (curr) upsertProfile(curr);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const curr = session?.user ?? null;
      setUser(curr);
      if (curr && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        upsertProfile(curr);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Workspace health check + auto-fetch file tree for local connections
  useEffect(() => {
    async function check() {
      const h = await checkDaemonHealth();
      setWorkspaceOnline(h.online);
      if (h.online) {
        setWorkspaceMachine(h.machine);
        // Auto-fetch file tree when locally connected
        try {
          const root = workspaceRoot || localStorage.getItem('soupz_workspace_root') || '';
          const treeData = await getFileTree(root);
          if (treeData?.tree) {
            const children = Array.isArray(treeData.tree) ? treeData.tree : (treeData.tree.children || []);
            setFileTree(children);
            setChangedFiles(treeData.changedFiles || []);
          }
        } catch (err) {
          console.error('Failed to auto-fetch file tree:', err);
        }
      }
    }
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, [workspaceRoot]);

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
    activeFleet,
    async sendPrompt({ prompt, agentId, buildMode }, onChunk) {
      return sendAgentPrompt(prompt, agentId, buildMode, user?.id, onChunk);
    },
    async readFile(path) {
      return readFile(path, user?.id);
    },
    async writeFile(path, content) {
      return writeFile(path, content, user?.id);
    },
    async runFile(path) {
      const { runFile } = await import('./lib/daemon.js');
      return runFile(path, user?.id);
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

  const routeLoader = (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <Loader2 size={16} className="text-text-faint animate-spin" />
    </div>
  );

  // AUTH GUARD: If not logged in and Supabase is active, only allow Landing/Connect
  const isAuthRequired = isSupabaseConfigured();
  if (isAuthRequired && !user && !authLoading) {
    if (path === '/landing') return <Suspense fallback={routeLoader}><LandingPage navigate={navigate} /></Suspense>;
    if (path === '/connect') return <Suspense fallback={routeLoader}><ConnectPage getParam={getParam} navigate={navigate} /></Suspense>;
    return <AuthScreen supabase={supabase} onAuth={() => {}} />;
  }

  // /connect route
  if (path === '/connect') {
    return <Suspense fallback={routeLoader}><ConnectPage getParam={getParam} navigate={navigate} /></Suspense>;
  }

  // /landing route
  if (path === '/landing') {
    return <Suspense fallback={routeLoader}><LandingPage navigate={navigate} /></Suspense>;
  }

  // /profile route
  if (path === '/profile') {
    return (
      <Suspense fallback={routeLoader}>
        <ProfilePage
          user={user}
          navigate={navigate}
          onSignOut={async () => {
            await supabase.auth.signOut();
            setUser(null);
            navigate('/');
          }}
        />
      </Suspense>
    );
  }

  // /admin route
  if (path === '/admin') {
    return (
      <Suspense fallback={routeLoader}>
        <AdminPage user={user} navigate={navigate} />
      </Suspense>
    );
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
          <ModeBtn active={mode === 'simple'} onClick={() => setMode('simple')} icon={<Layers size={12} />} label="Build" />
          <ModeBtn active={mode === 'pro'}    onClick={() => setMode('pro')}    icon={<Code2 size={12} />}  label="Code" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Command Palette trigger */}
        <button
          onClick={() => setCmdPaletteOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-text-faint hover:text-text-sec hover:bg-bg-elevated transition-all border border-transparent hover:border-border-subtle"
          title="Command Palette (Cmd+Shift+P)"
        >
          <Search size={13} />
          <span className="text-[11px] font-ui hidden md:inline">Search</span>
          <kbd className="text-[9px] font-mono text-text-faint bg-bg-elevated px-1 py-0.5 rounded border border-border-subtle hidden lg:inline">
            {navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>

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

        {/* Admin Link (Authorized only) */}
        {(user?.id === 'local' || user?.user_metadata?.user_name === 'Soham-Prajapati' || user?.user_metadata?.preferred_username === 'Soham-Prajapati') && (
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated border border-border-subtle text-text-sec hover:text-accent hover:border-accent/30 transition-all shadow-sm"
            title="Admin Command Center"
          >
            <Shield size={14} className="text-accent" />
            <span className="text-[11px] font-ui font-bold uppercase tracking-tight">Admin</span>
          </button>
        )}

        {/* User identity — click to open profile */}
        {user?.id && user.id !== 'local' && (
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 hover:bg-bg-elevated rounded-md px-1.5 py-1 transition-all cursor-pointer"
            title="View profile"
          >
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt=""
                className="w-5 h-5 rounded-full border border-border-subtle"
              />
            ) : null}
            <span className="text-text-faint text-xs font-ui truncate max-w-24 hidden sm:block">
              {user.user_metadata?.full_name || user.user_metadata?.name || user.email}
            </span>
          </button>
        )}

        {/* Sign out */}
        {isSupabaseConfigured() && user?.id !== 'local' && (
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setUser(null);
              navigate('/');
            }}
            className="flex items-center gap-1 text-text-faint hover:text-text-sec text-xs font-ui transition-colors"
            title="Sign out"
          >
            <LogOut size={13} />
            <span className="hidden sm:block">Sign out</span>
          </button>
        )}
      </nav>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {!workspaceOnline && !!localStorage.getItem('soupz_daemon_token') && (
          <WorkspaceOfflineBanner navigate={navigate} />
        )}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {mode === 'simple' ? (
            <SimpleMode daemon={workspace} />
          ) : (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 size={16} className="text-text-faint animate-spin" /></div>}>
              <ProMode daemon={workspace} fileTree={fileTree} changedPaths={changedFiles} onEditorStateChange={setEditorState} />
            </Suspense>
          )}
        </div>
      </main>

      {/* Command Palette */}
      {cmdPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            open={cmdPaletteOpen}
            onClose={() => setCmdPaletteOpen(false)}
            onAction={handleCommand}
          />
        </Suspense>
      )}

      {/* Folder Picker (Cmd+O) */}
      {folderPickerOpen && (
        <Suspense fallback={null}>
          <FolderPicker
            open={folderPickerOpen}
            onClose={() => setFolderPickerOpen(false)}
            onSelect={handleOpenFolder}
          />
        </Suspense>
      )}

      {/* Setup Wizard */}
      {setupOpen && (
        <Suspense fallback={null}>
          <SetupWizard
            isOpen={setupOpen}
            onClose={() => setSetupOpen(false)}
          />
        </Suspense>
      )}

      {/* VS Code-style Status Bar */}
      <StatusBar
        workspaceOnline={workspaceOnline}
        machine={workspaceMachine}
        mode={mode}
        editorState={editorState}
      />
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
