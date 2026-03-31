import React, { useState, useEffect, useCallback, lazy, Suspense, useRef, useMemo } from 'react';
import {
  Terminal, Wifi, WifiOff, LogOut, Layers, Code2, Loader2, Sun, Moon, Contrast,
  Leaf, Snowflake, Ghost, Coffee, Landmark, Flower2, SunDim, Github, Check, Search,
  Shield, Sparkles, CheckCircle, Lock, Users
} from 'lucide-react';
import AuthScreen from './components/auth/AuthScreen.jsx';
import SimpleMode from './components/simple/SimpleMode.jsx';
import StatusBar from './components/shared/StatusBar.jsx';
import CoreConsole from './components/core/CoreConsole.jsx';
import ErrorBoundary from './components/shared/ErrorBoundary.jsx';
import PairingCodeModal from './components/shared/PairingCodeModal.jsx';

// Lazy-load routes and heavy components not needed on first paint
const ConnectPage = lazy(() => import('./components/connect/ConnectPage.jsx'));
const ProMode = lazy(() => import('./components/pro/ProMode.jsx'));
const BuilderMode = lazy(() => import('./components/builder/BuilderMode.jsx'));
const LandingPage = lazy(() => import('./components/landing/LandingPage.jsx'));
const ProfilePage = lazy(() => import('./components/profile/ProfilePage.jsx'));
const AdminPage = lazy(() => import('./components/admin/AdminPage.jsx'));
const CommandPalette = lazy(() => import('./components/shared/CommandPalette.jsx'));
const FolderPicker = lazy(() => import('./components/shared/FolderPicker.jsx'));
const SetupWizard = lazy(() => import('./components/shared/SetupWizard.jsx'));
const OnboardingOverlay = lazy(() => import('./components/shared/OnboardingOverlay.jsx'));
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import {
  checkDaemonHealth, subscribeToDaemon, sendAgentPrompt,
  getFileTree, readFile, writeFile, getGitStatus, getGitDiff,
  gitStage, gitCommit, gitPush, checkSystemCLIs,
  listTerminals, killTerminalById, getOrderDetail,
  submitOrderInput, getDevServerUrl,
} from './lib/daemon.js';
import { cn } from './lib/cn';
import { flattenFilePaths } from './lib/tree';

const MODE_KEY  = 'soupz_ide_mode';
const THEME_KEY = 'soupz_theme';

const THEME_ALIASES = {
  tokyo: 'tokyo-night',
  github: 'github-dark',
};

const SETUP_COMPLETION_KEY = 'soupz_setup_completed_v1';

function readSetupCompletion() {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem(SETUP_COMPLETION_KEY) || '{}') || {}; }
  catch { return {}; }
}

function writeSetupCompletion(map) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETUP_COMPLETION_KEY, JSON.stringify(map));
}

const THEMES = [
  { id: 'dark',         label: 'Soupz Dark',   icon: Moon },
  { id: 'dim',          label: 'Dim',          icon: Contrast },
  { id: 'midnight',     label: 'Midnight',     icon: Ghost },
  { id: 'tokyo-night',  label: 'Tokyo Night',  icon: SunDim },
  { id: 'dracula',      label: 'Dracula',      icon: Ghost },
  { id: 'rose-pine',    label: 'Rose Pine',    icon: Flower2 },
  { id: 'catppuccin',   label: 'Catppuccin',   icon: Coffee },
  { id: 'nord',         label: 'Nord',         icon: Snowflake },
  { id: 'monokai',      label: 'Monokai',      icon: Leaf },
  { id: 'solarized',    label: 'Solarized',    icon: Landmark },
  { id: 'github-dark',  label: 'GitHub Dark',  icon: Github },
  { id: 'light',        label: 'Soupz Light',  icon: Sun },
];

function normalizeTheme(theme) {
  return THEME_ALIASES[theme] || theme;
}

function applyTheme(theme) {
  const normalized = normalizeTheme(theme || 'dark');
  document.documentElement.setAttribute('data-theme', normalized);
  return normalized;
}

const initialRouteState = () => ({
  path: typeof window !== 'undefined' ? window.location.pathname : '/',
  search: typeof window !== 'undefined' ? window.location.search : '',
});

export default function App() {
  const [route, setRoute] = useState(initialRouteState);
  const { path, search } = route;

  const navigate = useCallback((to) => {
    window.history.pushState({}, '', to);
    setRoute({ path: window.location.pathname, search: window.location.search });
  }, []);

  const getParam = useCallback((key) => {
    return new URLSearchParams(search).get(key);
  }, [search]);

  useEffect(() => {
    function onPop() {
      setRoute({ path: window.location.pathname, search: window.location.search });
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Bootstrap daemon connection from URL query params.
  // This enables one-click links from dev-web stack and phone pairing handoff.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const remote = params.get('remote');
      const token = params.get('token');

      if (remote) {
        localStorage.setItem('soupz_daemon_url', remote);
        try { sessionStorage.setItem('soupz_auto_remote_hint', '1'); } catch {}
      }
      if (token) localStorage.setItem('soupz_daemon_token', token);

      if (remote || token) {
        params.delete('remote');
        params.delete('token');
        const next = params.toString();
        const cleaned = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`;
        window.history.replaceState({}, '', cleaned);
      }
    } catch {
      // Ignore malformed URLs.
    }
  }, []);

  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode]           = useState(() => localStorage.getItem(MODE_KEY) || 'simple');
  const [theme, setTheme]         = useState(() => {
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    const normalized = applyTheme(saved);
    if (normalized !== saved) localStorage.setItem(THEME_KEY, normalized);
    return normalized;
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
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [workspaceRoot, setWorkspaceRoot] = useState(null);
  const storedWorkspaceRoot = typeof window !== 'undefined' ? (localStorage.getItem('soupz_workspace_root') || '') : '';
  const activeWorkspaceRoot = workspaceRoot || storedWorkspaceRoot || '';
  const setupSignature = useMemo(() => {
    if (typeof window === 'undefined') return 'local::global';
    const host = localStorage.getItem('soupz_hostname') || 'local';
    return `${host}::${activeWorkspaceRoot || 'global'}`;
  }, [activeWorkspaceRoot, workspaceMachine]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const flattenedFilePaths = useMemo(() => flattenFilePaths(fileTree || []), [fileTree]);

  const [devServerUrl, setDevServerUrl] = useState(null);
  useEffect(() => {
    let ignore = false;
    let timer = null;
    async function poll() {
      if (!workspaceOnline) {
        setDevServerUrl(null);
        return;
      }
      try {
        const result = await getDevServerUrl();
        if (!ignore) setDevServerUrl(result?.url || null);
      } catch {
        if (!ignore) setDevServerUrl(null);
      }
      timer = setTimeout(poll, 15000);
    }
    poll();
    return () => {
      ignore = true;
      if (timer) clearTimeout(timer);
    };
  }, [workspaceOnline]);

  // Auto-check setup on mount/login
  useEffect(() => {
    if (!user || !workspaceOnline) return;
    const completionMap = readSetupCompletion();
    const entry = completionMap[setupSignature];
    const sessionKey = `soupz_setup_dismissed::${setupSignature}`;
    if (entry?.completedAt) {
      setSetupOpen(false);
      return;
    }
    if (typeof window !== 'undefined' && sessionStorage.getItem(sessionKey) === '1') {
      return;
    }
    checkSystemCLIs().then(clis => {
      if (!Array.isArray(clis) || clis.length === 0) return;
      const missing = clis.some(c => !c.installed);
      if (missing) {
        setSetupOpen(true);
      } else {
        completionMap[setupSignature] = {
          completedAt: Date.now(),
          versions: clis.reduce((acc, cli) => {
            acc[cli.name] = cli.version || null;
            return acc;
          }, {}),
        };
        writeSetupCompletion(completionMap);
        setSetupOpen(false);
      }
    }).catch(() => {});
  }, [user, workspaceOnline, setupSignature]);

  const handleSetupClose = useCallback((detail = {}) => {
    const sessionKey = `soupz_setup_dismissed::${setupSignature}`;
    if (detail.completed && Array.isArray(detail.clis)) {
      const map = readSetupCompletion();
      map[setupSignature] = {
        completedAt: Date.now(),
        versions: detail.clis.reduce((acc, cli) => {
          acc[cli.name] = cli.version || null;
          return acc;
        }, {}),
      };
      writeSetupCompletion(map);
    } else if (typeof window !== 'undefined') {
      sessionStorage.setItem(sessionKey, '1');
    }
    setSetupOpen(false);
  }, [setupSignature]);

  useEffect(() => {
    function handleKey(e) {
      // Cmd+1: Chat mode, Cmd+2: IDE mode, Cmd+3: Builder mode
      if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); setMode('simple'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); setMode('pro'); }
      if ((e.metaKey || e.ctrlKey) && e.key === '3') { e.preventDefault(); setMode('builder'); }
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
    if (actionId === 'toggle-mode') setMode(m => m === 'simple' ? 'builder' : m === 'builder' ? 'pro' : 'simple');
    else if (actionId.startsWith('theme-')) {
      const t = actionId.replace('theme-', '');
      const normalized = applyTheme(t);
      setTheme(normalized);
      localStorage.setItem(THEME_KEY, normalized);
    }
    else if (actionId.startsWith('agent-')) {
      const a = actionId.replace('agent-', '');
      localStorage.setItem('soupz_agent', a);
      window.dispatchEvent(new StorageEvent('storage', { key: 'soupz_agent', newValue: a }));
    }
  }

  function changeTheme(t) {
    const normalized = applyTheme(t);
    setTheme(normalized);
    localStorage.setItem(THEME_KEY, normalized);
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
      console.log('Soupz Auth: Session loaded', curr ? `User: ${curr.email}` : 'No session');
      setUser(curr);
      if (curr) upsertProfile(curr);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const curr = session?.user ?? null;
      console.log(`Soupz Auth: Event [${event}]`, curr ? `User: ${curr.email}` : 'No user');
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
          const root = activeWorkspaceRoot;
          const treeData = await getFileTree(root || undefined);
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
  }, [activeWorkspaceRoot]);

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
    if (response.type === 'FILE_CHANGED') {
      const path = response.path;
      setChangedFiles(prev => {
        if (prev.includes(path)) return prev;
        return [...prev, `M  ${path}`]; // Add mock git status for dot
      });
    }
  }

  // Workspace interface object passed to components
  const workspace = {
    online: workspaceOnline,
    machine: workspaceMachine,
    activeFleet,
    rootPath: activeWorkspaceRoot || null,
    getRootPath() { return activeWorkspaceRoot || null; },
    async refreshTree() {
      try {
        const root = activeWorkspaceRoot;
        const treeData = await getFileTree(root || undefined);
        if (treeData?.tree) {
          const children = Array.isArray(treeData.tree) ? treeData.tree : (treeData.tree.children || []);
          setFileTree(children);
          // If porcelain exists, use it for file tree coloring
          if (treeData.porcelain) setChangedFiles(treeData.porcelain);
          else if (treeData.changedFiles) setChangedFiles(treeData.changedFiles);
        }
      } catch (err) {
        console.error('Failed to auto-fetch file tree:', err);
      }
    },
    async sendPrompt({ prompt, agentId, allowedAgents, sameAgentOnly, buildMode, cwd, orchestrationMode, useAiPlanner, plannerStyle, plannerNotes, returnOrderImmediately }, onChunk) {
      return sendAgentPrompt({ prompt, agentId, allowedAgents, sameAgentOnly, buildMode, cwd, orchestrationMode, useAiPlanner, plannerStyle, plannerNotes, returnOrderImmediately }, user?.id, onChunk);
    },
    async readFile(path) {
      return readFile(path, user?.id, activeWorkspaceRoot);
    },
    async writeFile(path, content) {
      return writeFile(path, content, user?.id, activeWorkspaceRoot);
    },
    async runFile(path) {
      const { runFile } = await import('./lib/daemon.js');
      return runFile(path, user?.id, activeWorkspaceRoot);
    },
    async gitStatus() {
      return getGitStatus(null, user?.id, activeWorkspaceRoot);
    },
    async gitDiff() {
      return getGitDiff(null, user?.id, activeWorkspaceRoot);
    },
    async gitStage(paths) {
      for (const p of paths) await gitStage(p, user?.id, activeWorkspaceRoot);
    },
    async gitCommit(message) {
      return gitCommit(message, user?.id, activeWorkspaceRoot);
    },
    async gitPush() {
      return gitPush(user?.id, activeWorkspaceRoot);
    },
    async listTerminals() {
      return listTerminals();
    },
    async killTerminal(id) {
      return killTerminalById(id);
    },
    async getOrderDetail(orderId) {
      return getOrderDetail(orderId);
    },
    async submitOrderInput(orderId, answers) {
      return submitOrderInput(orderId, answers);
    },
  };

  const routeLoader = (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <Loader2 size={16} className="text-text-faint animate-spin" />
    </div>
  );

  // AUTH GUARD: If not logged in and using Supabase, block internal routes
  const isAuthRequired = isSupabaseConfigured();
  const isInternalRoute = path !== '/' && path !== '/connect' && path !== '/auth' && path !== '/core';
  
  if (isAuthRequired && !user && !authLoading && isInternalRoute) {
    return <AuthScreen supabase={supabase} onAuth={() => navigate('/dashboard')} />;
  }

  // /connect route
  if (path === '/connect') {
    return (
      <ErrorBoundary name="Connect Page">
        <Suspense fallback={routeLoader}><ConnectPage getParam={getParam} navigate={navigate} /></Suspense>
      </ErrorBoundary>
    );
  }

  // /core route (minimal orchestrator demo)
  if (path === '/core') {
    return <CoreConsole workspace={workspace} />;
  }

  // Default home site
  if (path === '/') {
    return (
      <ErrorBoundary name="Landing Page">
        <Suspense fallback={routeLoader}><LandingPage navigate={navigate} theme={theme} setTheme={setTheme} themes={THEMES} /></Suspense>
      </ErrorBoundary>
    );
  }

  // /profile route
  if (path === '/profile') {
    return (
      <ErrorBoundary name="Profile Page">
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
      </ErrorBoundary>
    );
  }

  // /admin route
  if (path === '/admin') {
    return (
      <ErrorBoundary name="Admin Page">
        <Suspense fallback={routeLoader}>
          <AdminPage user={user} navigate={navigate} />
        </Suspense>
      </ErrorBoundary>
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
          <ModeBtn active={mode === 'simple'} onClick={() => setMode('simple')} icon={<Layers size={12} />} label="Chat" />
          <ModeBtn active={mode === 'builder'} onClick={() => setMode('builder')} icon={<Sparkles size={12} />} label="Build" />
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
              <div className="fixed inset-0 z-[80]" onClick={() => setThemeOpen(false)} />
              <div className="absolute right-0 top-8 z-[90] bg-bg-surface border border-border-subtle rounded-lg shadow-soft overflow-hidden py-1 min-w-[140px]">
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
        <WorkspaceStatus
          online={workspaceOnline}
          machine={workspaceMachine}
          navigate={navigate}
          onShowShare={() => setPairingModalOpen(true)}
        />

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
            <SimpleMode daemon={workspace} filePaths={flattenedFilePaths} />
          ) : mode === 'builder' ? (
            <ErrorBoundary name="Builder Mode">
              <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 size={16} className="text-text-faint animate-spin" /></div>}>
                <BuilderMode daemon={workspace} />
              </Suspense>
            </ErrorBoundary>
          ) : (
            <ErrorBoundary name="Pro Mode">
              <Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 size={16} className="text-text-faint animate-spin" /></div>}>
                <ProMode
                  daemon={workspace}
                  fileTree={fileTree}
                  changedPaths={changedFiles}
                  onEditorStateChange={setEditorState}
                  theme={theme}
                  onOpenCommandPalette={() => setCmdPaletteOpen(true)}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
      </main>

      {/* Command Palette */}
      {cmdPaletteOpen && (
        <ErrorBoundary name="Command Palette">
          <Suspense fallback={null}>
            <CommandPalette
              open={cmdPaletteOpen}
              onClose={() => setCmdPaletteOpen(false)}
              onAction={handleCommand}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Folder Picker (Cmd+O) */}
      {folderPickerOpen && (
        <ErrorBoundary name="Folder Picker">
          <Suspense fallback={null}>
            <FolderPicker
              open={folderPickerOpen}
              onClose={() => setFolderPickerOpen(false)}
              onSelect={handleOpenFolder}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Setup Wizard */}
      {setupOpen && (
        <ErrorBoundary name="Setup Wizard">
          <Suspense fallback={null}>
            <SetupWizard
              isOpen={setupOpen}
              onClose={handleSetupClose}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {pairingModalOpen && (
        <PairingCodeModal
          machineName={workspaceMachine}
          onClose={() => setPairingModalOpen(false)}
        />
      )}

      {/* VS Code-style Status Bar */}
      <StatusBar
        workspaceOnline={workspaceOnline}
        machine={workspaceMachine}
        mode={mode}
        editorState={editorState}
        daemon={workspace}
        rootPath={activeWorkspaceRoot}
        devServerUrl={devServerUrl}
      />

      {/* Onboarding Overlay (only on dashboard) */}
      <Suspense fallback={null}>
        <OnboardingOverlay />
      </Suspense>
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

function WorkspaceStatus({ online, machine, navigate, onShowShare }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (online) onShowShare?.();
        else navigate('/connect');
      }}
      title={online
        ? `Click to show pairing code for ${machine || 'your machine'}`
        : 'Click to connect your machine'}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-ui transition-all',
        online
          ? 'text-success bg-success/5 border border-success/15 hover:border-success/30 hover:text-success/90 cursor-pointer'
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
          onClick={() => navigate('/')}
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
