import { useState, useEffect, useRef, lazy, Suspense, useMemo, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import ErrorBoundary from '../shared/ErrorBoundary';
import { useThemeVars } from '../../hooks/useThemeVars';
import { flattenFilePaths } from '../../lib/tree';

let lastThemeSignature = null;

function isColorLight(hexColor = '') {
  const hex = hexColor.replace('#', '').trim();
  if (hex.length !== 6 && hex.length !== 3) return false;
  const normalized = hex.length === 3
    ? hex.split('').map(ch => ch + ch).join('')
    : hex;
  const bigint = parseInt(normalized, 16);
  if (Number.isNaN(bigint)) return false;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  // Relative luminance per WCAG
  const [sr, sg, sb] = [r, g, b].map(v => {
    const channel = v / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
  return luminance > 0.6;
}

async function syncMonacoTheme(themeVars = {}) {
  const monaco = await loader.init();
  const signature = JSON.stringify(themeVars);
  if (signature === lastThemeSignature) {
    monaco.editor.setTheme('soupz-dynamic');
    return;
  }
  lastThemeSignature = signature;
  const fallback = (key, fallbackHex) => themeVars[key]?.trim() || fallbackHex;
  const baseBg = fallback('--bg-base', '#0C0C0F');
  const base = isColorLight(baseBg) ? 'vs' : 'vs-dark';
  monaco.editor.defineTheme('soupz-dynamic', {
    base,
    inherit: true,
    rules: [
      { token: 'comment', foreground: '8A8FA4', fontStyle: 'italic' },
      { token: 'keyword', foreground: fallback('--accent', '#6366F1') },
      { token: 'string', foreground: fallback('--success', '#22C55E') },
      { token: 'number', foreground: fallback('--warning', '#F59E0B') },
      { token: 'type', foreground: '#0EA5E9' },
    ],
    colors: {
      'editor.background': baseBg,
      'editor.foreground': fallback('--text-pri', '#F0F0F5'),
      'editorLineNumber.foreground': '#4B4B5C',
      'editorLineNumber.activeForeground': '#9EA1B6',
      'editor.selectionBackground': `${fallback('--accent', '#6366F1')}33`,
      'editor.lineHighlightBackground': `${fallback('--bg-elevated', '#1E1E24')}AA`,
      'editorCursor.foreground': fallback('--accent', '#6366F1'),
      'editorIndentGuide.background': fallback('--border-subtle', '#1E1E24'),
      'editor.inactiveSelectionBackground': `${fallback('--accent', '#6366F1')}22`,
      'editorGutter.background': baseBg,
      'scrollbarSlider.background': `${fallback('--border-mid', '#2D2D39')}99`,
      'scrollbarSlider.hoverBackground': `${fallback('--border-strong', '#3F3F4D')}AA`,
    },
  });
  monaco.editor.setTheme('soupz-dynamic');
}

import {
  Files, GitBranch, Settings, ChevronLeft, ChevronRight,
  Play, Loader2, PanelRightClose, PanelRightOpen, X, Package,
  Terminal, Search, Trophy, Code2, Bot, Columns, MessageSquare,
  Save, FileText
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS } from '../../lib/agents';
import FileTree from '../filetree/FileTree';
import SimpleMode from '../simple/SimpleMode';

// Lazy-load heavy panels that aren't needed on first render
const GitPanel = lazy(() => import('../git/GitPanel'));
const StatsPanel = lazy(() => import('../shared/StatsPanel'));
const MCPPanel = lazy(() => import('../shared/MCPPanel'));
const ExtensionsMarketplace = lazy(() => import('../shared/ExtensionsMarketplace'));
const SearchPanel = lazy(() => import('./SearchPanel'));
const TerminalPanel = lazy(() => import('./TerminalPanel'));
const AgentDashboard = lazy(() => import('./AgentDashboard'));

const SIDEBAR_KEY = 'soupz_sidebar_open';
const CHAT_KEY    = 'soupz_chat_open';
const OPEN_FILES_KEY = 'soupz_open_files';

const LANG_MAP = {
  js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
  py: 'python', rs: 'rust', go: 'go', java: 'java', html: 'html',
  css: 'css', scss: 'css', json: 'json', md: 'markdown', yaml: 'yaml', yml: 'yaml',
};

function getLang(filename) {
  const ext = filename?.split('.').pop()?.toLowerCase();
  return LANG_MAP[ext] || 'plaintext';
}

function escapeHtml(input = '') {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdownToHtml(markdown = '') {
  const lines = String(markdown || '').split('\n');
  const html = [];
  let inCode = false;
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  for (const raw of lines) {
    const line = raw ?? '';
    if (line.trimStart().startsWith('```')) {
      closeLists();
      if (!inCode) {
        inCode = true;
        html.push('<pre><code>');
      } else {
        inCode = false;
        html.push('</code></pre>');
      }
      continue;
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      html.push('<p></p>');
      continue;
    }

    const heading3 = trimmed.match(/^###\s+(.+)$/);
    const heading2 = trimmed.match(/^##\s+(.+)$/);
    const heading1 = trimmed.match(/^#\s+(.+)$/);
    if (heading3 || heading2 || heading1) {
      closeLists();
      const level = heading3 ? 'h3' : heading2 ? 'h2' : 'h1';
      const text = escapeHtml((heading3 || heading2 || heading1)[1]);
      html.push(`<${level}>${text}</${level}>`);
      continue;
    }

    const ul = trimmed.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${escapeHtml(ul[1])}</li>`);
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${escapeHtml(ol[1])}</li>`);
      continue;
    }

    closeLists();
    const withInlineCode = escapeHtml(trimmed).replace(/`([^`]+)`/g, '<code>$1</code>');
    html.push(`<p>${withInlineCode}</p>`);
  }

  closeLists();
  if (inCode) html.push('</code></pre>');

  return html.join('\n');
}

function normalizeChangedPath(entry = '') {
  const raw = String(entry || '').trimEnd();
  if (!raw) return '';
  const maybePorcelainPath = raw.length >= 4 ? raw.slice(3).trim() : '';
  const path = maybePorcelainPath || raw;
  if (path.includes('->')) {
    const parts = path.split('->');
    return parts[parts.length - 1].trim();
  }
  return path.trim();
}

function fileNodeFromPath(filePath = '') {
  const normalizedPath = normalizeChangedPath(filePath);
  if (!normalizedPath) return null;
  const segments = normalizedPath.split('/').filter(Boolean);
  return {
    path: normalizedPath,
    name: segments[segments.length - 1] || normalizedPath,
  };
}

export default function ProMode({ daemon, fileTree, changedPaths, onEditorStateChange, theme, onOpenCommandPalette = () => {} }) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const themeVars = useThemeVars(['--bg-base', '--bg-elevated', '--text-pri', '--text-sec', '--accent', '--border-subtle', '--border-mid', '--border-strong']);
  const flattenedPaths = useMemo(() => flattenFilePaths(fileTree || []), [fileTree]);
  const changedPathSet = useMemo(() => {
    const set = new Set();
    (Array.isArray(changedPaths) ? changedPaths : []).forEach((entry) => {
      const normalized = normalizeChangedPath(entry);
      if (normalized) set.add(normalized);
    });
    return set;
  }, [changedPaths]);

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    !(typeof window !== 'undefined' && window.innerWidth < 768) && (localStorage.getItem(SIDEBAR_KEY) !== 'false')
  );
  const [chatOpen, setChatOpen] = useState(() =>
    !(typeof window !== 'undefined' && window.innerWidth < 768) && (localStorage.getItem(CHAT_KEY) !== 'false')
  );
  const [activeActivity, setActiveActivity] = useState('files'); // files | git | settings
  const [openFiles, setOpenFiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem(OPEN_FILES_KEY) || '[]'); } catch { return []; }
  });
  const [activeFile, setActiveFile] = useState(null);
  const [splitMode, setSplitMode] = useState(false);
  const [activeFileRight, setActiveFileRight] = useState(null);
  const [activePane, setActivePane] = useState('left'); // 'left' | 'right'
  const [fileContents, setFileContents] = useState({});
  const [loadingFiles, setLoadingFiles] = useState(new Set());
  const [fileAccessOrder, setFileAccessOrder] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [running, setRunning] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [chatWidth, setChatWidth] = useState(320);
  const [terminalHeight, setTerminalHeight] = useState(192);
  const [terminalMaximized, setTerminalMaximized] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat');
  const [runToast, setRunToast] = useState(null);
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false);

  const sidebarPanelWidth = useMemo(() => `min(${sidebarWidth}px, 40vw)`, [sidebarWidth]);
  const chatPanelWidth = useMemo(() => `min(${chatWidth}px, 45vw)`, [chatWidth]);

  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const activeEditorFile = activePane === 'right' && activeFileRight ? activeFileRight : activeFile;
  const activeEditorLang = getLang(activeEditorFile?.name || '');
  const canPreviewMarkdown = activeEditorLang === 'markdown' && !!activeEditorFile?.path;

  const markdownPreviewHtml = useMemo(() => {
    if (!canPreviewMarkdown) return '';
    try {
      return renderMarkdownToHtml(String(fileContents[activeEditorFile.path] || ''));
    } catch {
      return '<p>Markdown preview unavailable.</p>';
    }
  }, [canPreviewMarkdown, activeEditorFile, fileContents]);

  useEffect(() => {
    syncMonacoTheme(themeVars);
  }, [theme, themeVars]);

  useEffect(() => { localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen)); }, [sidebarOpen]);
  useEffect(() => { localStorage.setItem(CHAT_KEY, String(chatOpen)); }, [chatOpen]);
  useEffect(() => {
    localStorage.setItem(OPEN_FILES_KEY, JSON.stringify(openFiles.slice(0, 20)));
  }, [openFiles]);

  const handleRunActiveFile = async () => {
    if (!activeEditorFile?.path || !daemon?.runFile) return;
    setRunning(true);
    setRunToast({ status: 'running', message: `Running ${activeEditorFile.name}...` });
    try {
      const result = await daemon.runFile(activeEditorFile.path);
      const exitCode = Number.isFinite(result?.exitCode) ? result.exitCode : (result?.ok ? 0 : 1);
      const firstStdoutLine = String(result?.stdout || '').trim().split('\n').find(Boolean) || '';
      const firstStderrLine = String(result?.stderr || '').trim().split('\n').find(Boolean) || '';
      if (result?.ok) {
        const detail = firstStdoutLine ? ` ${firstStdoutLine.slice(0, 90)}` : '';
        setRunToast({ status: 'done', message: `Run finished (exit ${exitCode}).${detail}` });
      } else {
        const detail = (firstStderrLine || firstStdoutLine || 'Execution failed').slice(0, 120);
        setRunToast({ status: 'error', message: `Run failed (exit ${exitCode}). ${detail}` });
      }
    } catch (err) {
      setRunToast({ status: 'error', message: err?.message || 'Failed to run file' });
    } finally {
      setRunning(false);
      setTimeout(() => setRunToast(null), 5000);
    }
  };

  useEffect(() => {
    if (!canPreviewMarkdown && markdownPreviewOpen) {
      setMarkdownPreviewOpen(false);
    }
  }, [canPreviewMarkdown, markdownPreviewOpen]);

  // Responsive: update isMobile and close panels on mobile
  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
        setChatOpen(false);
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  async function openFile(node) {
    if (!node || node.children) return;

    if (splitMode && activePane === 'right') {
      setActiveFileRight(node);
    } else {
      setActiveFile(node);
    }

    // Update access order for LRU
    setFileAccessOrder(prev => {
      const filtered = prev.filter(p => p !== node.path);
      return [...filtered, node.path];
    });

    // Cap open tabs at 20, close LRU when exceeding
    setOpenFiles(prev => {
      const existing = prev.find(f => f.path === node.path);
      let next = existing ? prev : [...prev, node];

      if (next.length > 20) {
        const lruPath = fileAccessOrder[0];
        next = next.filter(f => f.path !== lruPath);
        setFileAccessOrder(order => order.filter(p => p !== lruPath));
      }
      return next;
    });

    // Load file content if not cached
    if (!fileContents[node.path]) {
      setLoadingFiles(prev => new Set([...prev, node.path]));
      try {
        const content = await daemon?.readFile?.(node.path) || '';
        setFileContents(prev => ({ ...prev, [node.path]: content }));
      } catch { /* no daemon */ }
      finally {
        setLoadingFiles(prev => {
          const next = new Set(prev);
          next.delete(node.path);
          return next;
        });
      }
    }
  }

  function closeFile(path) {
    setOpenFiles(prev => {
      const next = prev.filter(f => f.path !== path);
      if (activeFile?.path === path) {
        setActiveFile(next[next.length - 1] || null);
      }
      return next;
    });
  }

  const queueAutosave = useCallback((path, value) => {
    if (!path) return;
    const text = typeof value === 'string' ? value : (value ?? '');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      daemon?.writeFile?.(path, text);
    }, 1000);
  }, [daemon]);

  const updateFileContents = useCallback((path, value) => {
    if (!path) return;
    const text = typeof value === 'string' ? value : (value ?? '');
    setFileContents(prev => ({ ...prev, [path]: text }));
    queueAutosave(path, text);
  }, [queueAutosave]);

  function handleEditorChange(value) {
    if (!activeFile) return;
    updateFileContents(activeFile.path, value);
  }

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition(e => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
    });
    // Cmd/Ctrl+S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile();
    });
    // Override Monaco command palette shortcuts to open Soupz palette instead
    const paletteShortcuts = [
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      monaco.KeyCode.F1,
    ];
    paletteShortcuts.forEach(binding => {
      editor.addCommand(binding, () => {
        onOpenCommandPalette?.();
      });
    });
  }

  async function saveFile(targetPath) {
    const path = targetPath
      || (activePane === 'right' && activeFileRight ? activeFileRight.path : null)
      || activeFile?.path;
    if (!path) return;
    await daemon?.writeFile?.(path, fileContents[path] ?? '');
  }

  async function runFile() {
    if (!activeFile) return;
    setRunning(true);
    try { await daemon?.runFile?.(activeFile.path); } catch { /* no daemon */ }
    setRunning(false);
  }

  const lang = getLang(activeFile?.name || '');

  // Cmd+Shift+F triggers in-editor find to avoid dual search UI confusion.
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        editorRef.current?.focus();
        editorRef.current?.getAction?.('actions.find')?.run?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lift editor state to parent (for StatusBar)
  useEffect(() => {
    onEditorStateChange?.({
      cursorPos,
      activeFile,
      lang,
      tabSize: 2,
    });
  }, [cursorPos, activeFile, lang, onEditorStateChange]);

  // Mobile: tab-based layout with bottom navigation
  if (isMobile) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-hidden min-h-0">
          {mobileTab === 'chat' && <SimpleMode daemon={daemon} filePaths={flattenedPaths} />}
          {mobileTab === 'files' && (
            <div className="h-full bg-bg-surface">
              <FileTree tree={fileTree} changedPaths={changedPaths} onSelect={(node) => { openFile(node); setMobileTab('editor'); }} selectedPath={activeFile?.path} />
            </div>
          )}
          {mobileTab === 'editor' && activeFile && (
            <div className="h-full flex flex-col">
              <div className="h-8 bg-bg-surface border-b border-border-subtle flex items-center px-3 shrink-0">
                <span className="text-xs font-mono text-text-sec truncate">{activeFile.name}</span>
                <button onClick={() => saveFile()} className="ml-auto text-[10px] font-ui text-accent px-2 py-0.5 rounded border border-accent/20">Save</button>
              </div>
              <div className="flex-1 min-h-0">
                <Editor
                  theme="soupz-dynamic"
                  language={lang}
                  value={fileContents[activeFile.path] || ''}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', lineNumbers: 'on', scrollBeyondLastLine: false, padding: { top: 8 } }}
                />
              </div>
            </div>
          )}
          {mobileTab === 'editor' && !activeFile && (
            <div className="h-full flex items-center justify-center bg-bg-base">
              <p className="text-text-faint text-sm font-ui">Select a file to edit</p>
            </div>
          )}
          {mobileTab === 'git' && (
            <ErrorBoundary name="Git Panel">
              <Suspense fallback={<PanelLoader />}>
                <div className="h-full overflow-y-auto">
                  <GitPanel
                    daemon={daemon}
                    compact
                    onOpenFile={(filePath) => {
                      const node = fileNodeFromPath(filePath);
                      if (!node) return;
                      openFile(node);
                      setMobileTab('editor');
                    }}
                  />
                </div>
              </Suspense>
            </ErrorBoundary>
          )}
          {mobileTab === 'terminal' && (
            <ErrorBoundary name="Terminal">
              <Suspense fallback={<PanelLoader />}>
                <div className="h-full overflow-hidden">
                  <TerminalPanel daemon={daemon} onClose={() => setMobileTab('chat')} maximized variant="mobile" onMaximize={() => {}} />
                </div>
              </Suspense>
            </ErrorBoundary>
          )}
          {mobileTab === 'settings' && (
            <div className="h-full overflow-y-auto">
              <ErrorBoundary name="Stats Panel">
                <Suspense fallback={<PanelLoader />}>
                  <StatsPanel />
                </Suspense>
              </ErrorBoundary>
              <ErrorBoundary name="MCP Panel">
                <Suspense fallback={<PanelLoader />}>
                  <MCPPanel />
                </Suspense>
              </ErrorBoundary>
              <ErrorBoundary name="Extensions">
                <Suspense fallback={<PanelLoader />}>
                  <ExtensionsMarketplace />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}
        </div>
        {/* Bottom tab bar */}
        <div className="h-12 bg-bg-surface border-t border-border-subtle flex items-center justify-around shrink-0 px-1">
          {[
            { id: 'chat', Icon: MessageSquare, label: 'Chat' },
            { id: 'files', Icon: Files, label: 'Files' },
            { id: 'editor', Icon: Code2, label: 'Editor' },
            { id: 'git', Icon: GitBranch, label: 'Git' },
            { id: 'terminal', Icon: Terminal, label: 'Term' },
            { id: 'settings', Icon: Settings, label: 'More' },
          ].map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setMobileTab(id)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md transition-all min-w-[48px]',
                mobileTab === id
                  ? 'text-accent'
                  : 'text-text-faint',
              )}
            >
              <Icon size={18} />
              <span className="text-[9px] font-ui">{label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-bg-base overflow-hidden">
      {/* Activity rail */}
      <div className="w-24 bg-bg-surface border-r border-border-subtle flex flex-col py-2 gap-1 shrink-0 z-10">
        <div className="px-2 pb-2 pt-1 border-b border-border-subtle">
          <p className="text-[10px] font-ui uppercase tracking-wider text-text-faint">Workspace</p>
        </div>
        {[
          { id: 'files',      Icon: Files,     title: 'Explorer', label: 'Files' },
          { id: 'search',     Icon: Search,    title: 'Search', label: 'Search' },
          { id: 'git',        Icon: GitBranch, title: 'Source Control', label: 'Source' },
          { id: 'agents',     Icon: Bot,       title: 'Agent Tasks', label: 'Agents' },
          { id: 'stats',      Icon: Trophy,    title: 'Stats & Leaderboard', label: 'Stats' },
          { id: 'settings',   Icon: Settings,  title: 'Settings', label: 'Settings' },
        ].map(({ id, Icon, title, label }) => (
          <button
            key={id}
            onClick={() => {
              if (activeActivity === id) {
                setSidebarOpen(v => !v);
              } else {
                setActiveActivity(id);
                setSidebarOpen(true);
              }
            }}
            title={title}
            className={cn(
              'mx-2 rounded-lg px-2 py-2 flex flex-col items-center gap-1 transition-all border',
              activeActivity === id && sidebarOpen
                ? 'bg-accent/12 text-accent border-accent/30'
                : 'text-text-faint border-transparent hover:text-text-sec hover:bg-bg-elevated hover:border-border-subtle',
            )}
          >
            <Icon size={16} />
            <span className="text-[10px] font-ui leading-none">{label}</span>
          </button>
        ))}
      </div>

      {/* Sidebar — resizable */}
      {sidebarOpen && (
        <div style={{ width: sidebarPanelWidth }} className="bg-bg-surface border-r border-border-subtle flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle shrink-0">
            <p className="text-text-pri text-sm font-ui font-semibold">
              {activeActivity === 'files' ? 'Explorer' : activeActivity === 'search' ? 'Search' : activeActivity === 'git' ? 'Source Control' : activeActivity === 'agents' ? 'Agent Tasks' : activeActivity === 'extensions' ? 'Extensions' : activeActivity === 'stats' ? 'Insights' : 'Settings'}
            </p>
            <p className="text-text-faint text-[11px] font-ui mt-0.5">
              {activeActivity === 'files' ? 'Browse and edit project files' : activeActivity === 'search' ? 'Find symbols, text, and files quickly' : activeActivity === 'git' ? 'Review and ship repository changes' : activeActivity === 'agents' ? 'Track worker activity and status' : activeActivity === 'extensions' ? 'Manage capability packs' : activeActivity === 'stats' ? 'Usage and progress snapshots' : 'Editor and agent preferences'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeActivity === 'files' && (
              treeLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 size={16} className="text-text-faint animate-spin mb-2" />
                  <p className="text-xs text-text-faint font-ui">Loading files...</p>
                </div>
              ) : (
                <FileTree
                  tree={fileTree}
                  changedPaths={changedPaths}
                  onSelect={openFile}
                  selectedPath={activeFile?.path}
                  onCreateFile={async (name) => {
                    await daemon?.writeFile?.(name, '');
                    await daemon?.refreshTree?.();
                  }}
                  onCreateFolder={async (name) => {
                    await daemon?.runFile?.(`mkdir -p ${name}`);
                    await daemon?.refreshTree?.();
                  }}
                  onRefresh={() => daemon?.refreshTree?.()}
                />
              )
            )}
            {activeActivity === 'search' && (
              <ErrorBoundary name="Search Panel">
                <Suspense fallback={<PanelLoader />}>
                  <SearchPanel
                    daemon={daemon}
                    fileTree={fileTree}
                    onOpenFile={(node) => {
                      openFile(node);
                      if (node.lineNum && editorRef.current) {
                        setTimeout(() => {
                          editorRef.current.revealLineInCenter(node.lineNum);
                          editorRef.current.setPosition({ lineNumber: node.lineNum, column: 1 });
                          editorRef.current.focus();
                        }, 100);
                      }
                    }}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
            {activeActivity === 'git' && (
              <ErrorBoundary name="Git Panel">
                <Suspense fallback={<PanelLoader />}>
                  <GitPanel
                    daemon={daemon}
                    compact={false}
                    onOpenFile={(filePath) => {
                      const node = fileNodeFromPath(filePath);
                      if (!node) return;
                      openFile(node);
                    }}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
            {activeActivity === 'agents' && (
              <ErrorBoundary name="Agent Dashboard">
                <Suspense fallback={<PanelLoader />}>
                  <AgentDashboard daemon={daemon} />
                </Suspense>
              </ErrorBoundary>
            )}
            {activeActivity === 'extensions' && (
              <ErrorBoundary name="Extensions">
                <Suspense fallback={<PanelLoader />}>
                  <ExtensionsMarketplace />
                </Suspense>
              </ErrorBoundary>
            )}
            {activeActivity === 'stats' && (
              <ErrorBoundary name="Stats Panel">
                <Suspense fallback={<PanelLoader />}>
                  <StatsPanel workspace={daemon} />
                </Suspense>
              </ErrorBoundary>
            )}
            {activeActivity === 'settings' && (
              <div className="space-y-0">
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-[11px] text-text-faint font-ui uppercase tracking-wider font-medium mb-2">Editor</p>
                    <div className="space-y-2">
                      {[
                        { label: 'Font ligatures', defaultOn: true },
                        { label: 'Smooth scrolling', defaultOn: true },
                        { label: 'Word wrap', defaultOn: false },
                      ].map(opt => (
                        <SettingsCheckbox key={opt.label} label={opt.label} defaultChecked={opt.defaultOn} />
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-border-subtle pt-3">
                    <p className="text-[11px] text-text-faint font-ui uppercase tracking-wider font-medium mb-2">Keyboard</p>
                    <div className="space-y-1">
                      {[
                        ['Send message', 'Enter'],
                        ['New line', 'Shift+Enter'],
                        ['Save file', '⌘S'],
                      ].map(([action, key]) => (
                        <div key={action} className="flex items-center justify-between">
                          <span className="text-xs text-text-sec font-ui">{action}</span>
                          <code className="text-[10px] font-mono text-text-faint bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle">{key}</code>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border-subtle pt-3">
                    <p className="text-[11px] text-text-faint font-ui uppercase tracking-wider font-medium mb-2">Agents</p>
                    <AgentsSettings />
                  </div>
                </div>
                <ErrorBoundary name="MCP Panel">
                  <Suspense fallback={<PanelLoader />}>
                    <MCPPanel />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sidebar resize handle */}
      {sidebarOpen && (
        <ResizeHandle
          direction="horizontal"
          onResize={(delta) => setSidebarWidth(prev => Math.max(180, Math.min(400, prev + delta)))}
        />
      )}

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 h-9 border-b border-border-subtle bg-bg-surface shrink-0">
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="text-text-faint hover:text-text-sec transition-colors mr-1"
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>

          {/* Open file tabs */}
          <div className="flex-1 flex items-center gap-1 overflow-x-auto min-w-0">
            {openFiles.map(f => (
              <button
                key={f.path}
                onClick={() => openFile(f)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition-all shrink-0',
                  activeFile?.path === f.path
                    ? 'bg-bg-elevated border border-border-subtle text-text-pri'
                    : 'text-text-faint hover:text-text-sec hover:bg-bg-elevated/50',
                )}
              >
                {changedPathSet.has(f.path) && <span className="w-1 h-1 rounded-full bg-warning" />}
                <span>{f.name}</span>
                <span
                  onClick={e => { e.stopPropagation(); closeFile(f.path); }}
                  className="ml-0.5 text-text-faint hover:text-text-pri rounded transition-colors w-3 h-3 flex items-center justify-center"
                >
                  <X size={10} />
                </span>
              </button>
            ))}
            {openFiles.length >= 20 && (
              <div className="flex items-center px-2 py-1 text-[10px] font-ui text-text-faint bg-warning/15 rounded border border-warning/30 shrink-0 ml-1">
                {openFiles.length}/20
              </div>
            )}
          </div>

          {/* Split Editor toggle */}
          <button
            onClick={() => setSplitMode(v => !v)}
            className={cn(
              'text-text-faint hover:text-text-sec transition-colors',
              splitMode && 'text-text-pri',
            )}
            title={splitMode ? 'Close split editor' : 'Split editor right'}
          >
            <Columns size={15} />
          </button>

          {/* Save */}
          <button
            onClick={() => saveFile()}
            disabled={!activeFile && !(splitMode && activeFileRight)}
            className="text-text-faint hover:text-text-sec transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={activePane === 'right' && activeFileRight
              ? `Save ${activeFileRight.name}`
              : activeFile ? `Save ${activeFile.name}` : 'Open a file to save'}
          >
            <Save size={15} />
          </button>

          {/* Run Active File */}
          <button
            onClick={handleRunActiveFile}
            disabled={!activeEditorFile || running}
            className={cn(
              'text-text-faint hover:text-text-sec transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              runToast?.status === 'error' && 'text-danger'
            )}
            title={activeEditorFile ? `Run ${activeEditorFile.name}` : 'Open a file to run'}
          >
            <Play size={15} />
          </button>

          {canPreviewMarkdown && (
            <button
              onClick={() => setMarkdownPreviewOpen(v => !v)}
              className={cn(
                'text-text-faint hover:text-text-sec transition-colors',
                markdownPreviewOpen && 'text-accent'
              )}
              title={markdownPreviewOpen ? 'Show markdown source' : 'Show markdown preview'}
            >
              <FileText size={15} />
            </button>
          )}

          {/* Terminal toggle */}
          <button
            onClick={() => setTerminalOpen(v => !v)}
            className={cn(
              'text-text-faint hover:text-text-sec transition-colors',
              terminalOpen && 'text-text-pri',
            )}
            title={terminalOpen ? 'Close terminal' : 'Open terminal'}
          >
            <Terminal size={15} />
          </button>

          {/* Chat toggle */}
          <button
            onClick={() => setChatOpen(v => !v)}
            className="text-text-faint hover:text-text-sec transition-colors"
            title={chatOpen ? 'Close chat' : 'Open chat'}
          >
            {chatOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="h-6 flex items-center bg-bg-base border-b border-border-subtle shrink-0">
          <div className="flex-1 flex items-center px-3 overflow-x-auto" onClick={() => setActivePane('left')}>
            {activeFile ? activeFile.path.split('/').filter(Boolean).map((seg, i, arr) => (
              <span key={i} className="flex items-center shrink-0">
                {i > 0 && <span className="text-text-faint text-[10px] mx-1">/</span>}
                <span className={cn(
                  'text-[11px] font-ui',
                  i === arr.length - 1 ? (activePane === 'left' ? 'text-text-pri font-bold' : 'text-text-sec') : 'text-text-faint hover:text-text-sec cursor-pointer',
                )}>
                  {seg}
                </span>
              </span>
            )) : <span className="text-[11px] font-ui text-text-faint italic">No file selected</span>}
          </div>
          {splitMode && (
            <div className="flex-1 flex items-center px-3 border-l border-border-subtle overflow-x-auto" onClick={() => setActivePane('right')}>
              {activeFileRight ? activeFileRight.path.split('/').filter(Boolean).map((seg, i, arr) => (
                <span key={i} className="flex items-center shrink-0">
                  {i > 0 && <span className="text-text-faint text-[10px] mx-1">/</span>}
                  <span className={cn(
                    'text-[11px] font-ui',
                    i === arr.length - 1 ? (activePane === 'right' ? 'text-text-pri font-bold' : 'text-text-sec') : 'text-text-faint hover:text-text-sec cursor-pointer',
                  )}>
                    {seg}
                  </span>
                </span>
              )) : <span className="text-[11px] font-ui text-text-faint italic">Select a file from Explorer</span>}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0 overflow-hidden flex">
          {/* Left Pane */}
          <div className="flex-1 h-full min-w-0" onClick={() => setActivePane('left')}>
            {activeFile ? (
              loadingFiles.has(activeFile.path) ? (
                <FileLoadingSkeleton />
              ) : (
                markdownPreviewOpen && getLang(activeFile.name) === 'markdown' ? (
                  <div className="h-full overflow-auto p-6 bg-bg-surface text-text-pri">
                    <div
                      className="max-w-none text-sm leading-7 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_pre]:my-3 [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border-subtle [&_pre]:bg-bg-elevated [&_pre]:p-3 [&_code]:bg-bg-elevated [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_blockquote]:border-l-2 [&_blockquote]:border-border-mid [&_blockquote]:pl-3 [&_blockquote]:text-text-sec"
                      dangerouslySetInnerHTML={{ __html: markdownPreviewHtml }}
                    />
                  </div>
                ) : (
                  <Editor
                    path={activeFile.path}
                    value={String(fileContents[activeFile.path] || '')}
                    language={getLang(activeFile.name)}
                    theme="soupz-dynamic"
                    onChange={(value) => updateFileContents(activeFile.path, value)}
                    onMount={handleEditorMount}
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      fontLigatures: true,
                      lineHeight: 1.7,
                      minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
                      scrollBeyondLastLine: false,
                      padding: { top: 12, bottom: 12 },
                      renderLineHighlight: 'line',
                      smoothScrolling: true,
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      roundedSelection: true,
                      tabSize: 2,
                      wordWrap: 'off',
                    }}
                  />
                )
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-text-faint bg-bg-surface/30">
                <Files size={32} className="opacity-30" />
                <p className="text-sm font-ui">Select a file to edit</p>
              </div>
            )}
          </div>

          {/* Right Pane (Split Mode) */}
          {splitMode && (
            <div className="flex-1 h-full min-w-0 border-l border-border-subtle" onClick={() => setActivePane('right')}>
              {activeFileRight ? (
                loadingFiles.has(activeFileRight.path) ? (
                  <FileLoadingSkeleton />
                ) : (
                  <Editor
                    path={activeFileRight.path + '_right'} // Unique path to prevent model clash if same file
                    value={String(fileContents[activeFileRight.path] || '')}
                    language={getLang(activeFileRight.name)}
                    theme="soupz-dynamic"
                    onChange={(value) => updateFileContents(activeFileRight.path, value)}
                    onMount={(editor, monaco) => {
                      // Cmd/Ctrl+S to save right pane
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        if (activeFileRight?.path) {
                          saveFile(activeFileRight.path);
                        }
                      });
                      // Mirror palette overrides on secondary editor
                      [
                        monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP,
                        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
                        monaco.KeyCode.F1,
                      ].forEach(binding => {
                        editor.addCommand(binding, () => {
                          onOpenCommandPalette?.();
                        });
                      });
                    }}
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      fontLigatures: true,
                      lineHeight: 1.7,
                      minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
                      scrollBeyondLastLine: false,
                      padding: { top: 12, bottom: 12 },
                      renderLineHighlight: 'line',
                      smoothScrolling: true,
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      roundedSelection: true,
                      tabSize: 2,
                      wordWrap: 'off',
                    }}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-text-faint bg-bg-surface/30">
                  <Columns size={32} className="opacity-30" />
                  <p className="text-sm font-ui">Select a file for the right pane</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Terminal panel — resizable */}
        {terminalOpen && (
          <div
            className={cn(
              "flex flex-col shrink-0 min-h-0",
              terminalMaximized ? "absolute inset-0 z-50 bg-bg-base" : "relative"
            )}
            style={terminalMaximized ? {} : { height: terminalHeight }}
          >
            {!terminalMaximized && (
              <ResizeHandle
                direction="vertical"
                onResize={(delta) => setTerminalHeight(prev => Math.max(100, Math.min(800, prev - delta)))}
              />
            )}
            <ErrorBoundary name="Terminal">
              <Suspense fallback={<PanelLoader />}>
                <TerminalPanel
                  daemon={daemon}
                  onClose={() => { setTerminalOpen(false); setTerminalMaximized(false); }}
                  maximized={terminalMaximized}
                  onMaximize={() => setTerminalMaximized(!terminalMaximized)}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* Chat panel — resizable */}
      {chatOpen && (
        <>
          <ResizeHandle
            direction="horizontal"
            onResize={(delta) => setChatWidth(prev => Math.max(260, Math.min(600, prev - delta)))}
          />
          <div style={{ width: chatPanelWidth }} className="border-l border-border-subtle flex flex-col shrink-0 min-h-0 overflow-hidden">
            <SimpleMode daemon={daemon} compact={chatWidth < 360} filePaths={flattenedPaths} />
          </div>
        </>
      )}

      {runToast && (
        <div
          className={cn(
            'absolute bottom-6 right-6 px-3 py-2 rounded border text-xs font-ui shadow-soft bg-bg-surface flex items-center gap-2 z-30',
            runToast.status === 'error' && 'border-danger/40 text-danger',
            runToast.status === 'done' && 'border-success/40 text-success',
            runToast.status === 'running' && 'border-accent/40 text-accent'
          )}
        >
          {runToast.message}
        </div>
      )}
    </div>
  );
}

function FileLoadingSkeleton() {
  return (
    <div className="flex-1 min-h-0 bg-bg-surface p-4 flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-4 bg-bg-elevated rounded animate-pulse" style={{ width: `${80 - i * 10}%` }} />
      ))}
    </div>
  );
}

function ResizeHandle({ direction = 'horizontal', onResize }) {
  const handleRef = useRef(null);
  const startRef = useRef(null);

  function onMouseDown(e) {
    e.preventDefault();
    startRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(e) {
      const current = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = current - startRef.current;
      startRef.current = current;
      onResize(delta);
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  const isH = direction === 'horizontal';
  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      className={cn(
        'shrink-0 bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors z-10',
        isH ? 'w-1 cursor-col-resize hover:w-1' : 'h-1 cursor-row-resize hover:h-1',
      )}
    />
  );
}

function PanelLoader() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={16} className="text-text-faint animate-spin" />
    </div>
  );
}

function AgentsSettings() {
  const [enabledAgents, setEnabledAgents] = useState(() => {
    try {
      const stored = localStorage.getItem('soupz_enabled_agents');
      return stored ? JSON.parse(stored) : CLI_AGENTS.map(a => a.id);
    } catch {
      return CLI_AGENTS.map(a => a.id);
    }
  });

  const [agentConfig, setAgentConfig] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('soupz_agent_config') || '{}');
    } catch {
      return {};
    }
  });

  function toggleAgent(agentId) {
    setEnabledAgents(prev => {
      const next = prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId];
      localStorage.setItem('soupz_enabled_agents', JSON.stringify(next));
      return next;
    });
  }

  function setTemperature(agentId, value) {
    setAgentConfig(prev => {
      const next = { ...prev, [agentId]: { ...(prev[agentId] || {}), temperature: value } };
      localStorage.setItem('soupz_agent_config', JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {CLI_AGENTS.map(agent => {
        const enabled = enabledAgents.includes(agent.id);
        const temp = agentConfig[agent.id]?.temperature ?? 0.7;
        const isPremium = agent.id === 'claude-code';
        return (
          <div
            key={agent.id}
            className="border border-border-subtle rounded p-2.5 space-y-2 bg-bg-base"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agent.color }} />
              <span className="text-[11px] font-medium text-text-pri font-ui flex-1">{agent.name}</span>
              {isPremium && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  Premium
                </span>
              )}
              {!isPremium && (
                <span className="text-[8px] font-mono text-text-faint uppercase">{agent.tier}</span>
              )}
              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => toggleAgent(agent.id)}
                className={cn(
                  'relative w-8 h-4 rounded-full transition-colors shrink-0',
                  enabled ? 'bg-accent' : 'bg-bg-elevated border border-border-mid',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-3 h-3 rounded-full transition-transform bg-white',
                    enabled ? 'translate-x-4' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-text-faint font-ui">Temperature</span>
                <span className="text-[10px] font-mono text-text-sec">{temp.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temp}
                onChange={e => setTemperature(agent.id, parseFloat(e.target.value))}
                className="w-full h-1 bg-bg-elevated rounded appearance-none cursor-pointer accent-accent"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SettingsCheckbox({ label, defaultChecked = false }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => setChecked(v => !v)}
        className={cn(
          'w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
          checked
            ? 'bg-accent border-accent'
            : 'bg-bg-elevated border-border-mid group-hover:border-border-strong',
        )}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="text-white">
            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className="text-xs text-text-sec font-ui">{label}</span>
    </label>
  );
}
