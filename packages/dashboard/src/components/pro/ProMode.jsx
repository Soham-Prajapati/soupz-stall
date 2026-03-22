import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Editor, { loader } from '@monaco-editor/react';

// Define theme once to avoid "t.create is not a function" re-declaration crash
loader.init().then(monaco => {
  monaco.editor.defineTheme('soupz-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '4A4A5A', fontStyle: 'italic' },
      { token: 'keyword', foreground: '6366F1' },
      { token: 'string', foreground: '22C55E' },
      { token: 'number', foreground: 'F59E0B' },
      { token: 'type', foreground: '06B6D4' },
    ],
    colors: {
      'editor.background': '#0C0C0F',
      'editor.foreground': '#F0F0F5',
      'editorLineNumber.foreground': '#3A3A47',
      'editorLineNumber.activeForeground': '#8B8B9A',
      'editor.selectionBackground': '#6366F125',
      'editor.lineHighlightBackground': '#111114',
      'editorCursor.foreground': '#6366F1',
      'editorIndentGuide.background': '#1E1E24',
      'editor.inactiveSelectionBackground': '#6366F110',
      'editorGutter.background': '#0C0C0F',
      'scrollbarSlider.background': '#27272a',
      'scrollbarSlider.hoverBackground': '#3f3f46',
    },
  });
});

import {
  Files, GitBranch, Settings, ChevronLeft, ChevronRight,
  Play, Loader2, PanelRightClose, PanelRightOpen, X, Package,
  Terminal, Search, Trophy, Code2, Bot, Columns
} from 'lucide-react';
import { cn } from '../../lib/cn';
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

export default function ProMode({ daemon, fileTree, changedPaths, onEditorStateChange }) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

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
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [running, setRunning] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [chatWidth, setChatWidth] = useState(320);
  const [terminalHeight, setTerminalHeight] = useState(192);
  const [terminalMaximized, setTerminalMaximized] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat');

  const editorRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  useEffect(() => { localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen)); }, [sidebarOpen]);
  useEffect(() => { localStorage.setItem(CHAT_KEY, String(chatOpen)); }, [chatOpen]);
  useEffect(() => {
    localStorage.setItem(OPEN_FILES_KEY, JSON.stringify(openFiles.slice(0, 20)));
  }, [openFiles]);

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

    if (!openFiles.find(f => f.path === node.path)) {
      setOpenFiles(prev => [...prev, node]);
    }
    if (!fileContents[node.path]) {
      try {
        const content = await daemon?.readFile?.(node.path) || '';
        setFileContents(prev => ({ ...prev, [node.path]: content }));
      } catch { /* no daemon */ }
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

  function handleEditorChange(value) {
    if (!activeFile) return;
    setFileContents(prev => ({ ...prev, [activeFile.path]: value }));
    
    // Autosave
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      daemon?.writeFile?.(activeFile.path, value);
    }, 1000);
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
  }

  async function saveFile() {
    if (!activeFile) return;
    await daemon?.writeFile?.(activeFile.path, fileContents[activeFile.path]);
  }

  async function runFile() {
    if (!activeFile) return;
    setRunning(true);
    try { await daemon?.runFile?.(activeFile.path); } catch { /* no daemon */ }
    setRunning(false);
  }

  const lang = getLang(activeFile?.name || '');

  // Cmd+Shift+F to open search panel
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setActiveActivity('search');
        setSidebarOpen(true);
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
          {mobileTab === 'chat' && <SimpleMode daemon={daemon} />}
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
                  theme="vs-dark"
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
            <Suspense fallback={<PanelLoader />}>
              <div className="h-full overflow-y-auto"><GitPanel daemon={daemon} /></div>
            </Suspense>
          )}
          {mobileTab === 'settings' && (
            <div className="h-full overflow-y-auto">
              <Suspense fallback={<PanelLoader />}>
                <StatsPanel />
                <MCPPanel />
                <ExtensionsMarketplace />
              </Suspense>
            </div>
          )}
        </div>
        {/* Bottom tab bar */}
        <div className="h-12 bg-bg-surface border-t border-border-subtle flex items-center justify-around shrink-0 px-1">
          {[
            { id: 'chat', Icon: Terminal, label: 'Chat' },
            { id: 'files', Icon: Files, label: 'Files' },
            { id: 'editor', Icon: Code2, label: 'Editor' },
            { id: 'git', Icon: GitBranch, label: 'Git' },
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
      {/* Activity bar */}
      <div className="w-12 bg-bg-surface border-r border-border-subtle flex flex-col items-center py-2 gap-1 shrink-0 z-10">
        {[
          { id: 'files',      Icon: Files,     title: 'Explorer' },
          { id: 'search',     Icon: Search,    title: 'Search' },
          { id: 'git',        Icon: GitBranch, title: 'Source Control' },
          { id: 'agents',     Icon: Bot,       title: 'Agent Tasks' },
          { id: 'extensions', Icon: Package,   title: 'Extensions' },
          { id: 'stats',      Icon: Trophy,    title: 'Stats & Leaderboard' },
          { id: 'settings',   Icon: Settings,  title: 'Settings' },
        ].map(({ id, Icon, title }) => (
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
              'w-9 h-9 rounded-md flex items-center justify-center transition-all',
              activeActivity === id && sidebarOpen
                ? 'bg-bg-elevated text-text-pri border border-border-subtle'
                : 'text-text-faint hover:text-text-sec hover:bg-bg-elevated',
            )}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      {/* Sidebar — resizable */}
      {sidebarOpen && (
        <div style={{ width: sidebarWidth }} className="bg-bg-surface border-r border-border-subtle flex flex-col shrink-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle shrink-0">
            <span className="text-text-faint text-[11px] font-ui uppercase tracking-wider font-medium">
              {activeActivity === 'files' ? 'Explorer' : activeActivity === 'search' ? 'Search' : activeActivity === 'git' ? 'Source Control' : activeActivity === 'agents' ? 'Agent Tasks' : activeActivity === 'extensions' ? 'Extensions' : activeActivity === 'stats' ? 'Stats & Leaderboard' : 'Settings'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeActivity === 'files' && (
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
            )}
            {activeActivity === 'search' && (
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
            )}
            {activeActivity === 'git' && (
              <Suspense fallback={<PanelLoader />}>
                <GitPanel daemon={daemon} />
              </Suspense>
            )}
            {activeActivity === 'agents' && (
              <Suspense fallback={<PanelLoader />}>
                <AgentDashboard daemon={daemon} />
              </Suspense>
            )}
            {activeActivity === 'extensions' && (
              <Suspense fallback={<PanelLoader />}>
                <ExtensionsMarketplace />
              </Suspense>
            )}
            {activeActivity === 'stats' && (
              <Suspense fallback={<PanelLoader />}>
                <StatsPanel workspace={daemon} />
              </Suspense>
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
                </div>
                <Suspense fallback={<PanelLoader />}>
                  <MCPPanel />
                </Suspense>
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
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
                {changedPaths?.includes(f.path) && <span className="w-1 h-1 rounded-full bg-warning" />}
                <span>{f.name}</span>
                <span
                  onClick={e => { e.stopPropagation(); closeFile(f.path); }}
                  className="ml-0.5 text-text-faint hover:text-text-pri rounded transition-colors w-3 h-3 flex items-center justify-center"
                >
                  <X size={10} />
                </span>
              </button>
            ))}
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
              <Editor
                path={activeFile.path}
                value={String(fileContents[activeFile.path] || '')}
                language={getLang(activeFile.name)}
                theme="soupz-dark"
                onChange={(value) => {
                  setFileContents(prev => ({ ...prev, [activeFile.path]: value }));
                }}
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
                <Editor
                  path={activeFileRight.path + '_right'} // Unique path to prevent model clash if same file
                  value={String(fileContents[activeFileRight.path] || '')}
                  language={getLang(activeFileRight.name)}
                  theme="soupz-dark"
                  onChange={(value) => {
                    setFileContents(prev => ({ ...prev, [activeFileRight.path]: value }));
                    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                    saveTimeoutRef.current = setTimeout(() => {
                      daemon?.writeFile?.(activeFileRight.path, value);
                    }, 1000);
                  }}
                  onMount={(editor, monaco) => {
                    // Cmd/Ctrl+S to save
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                      if (activeFileRight) {
                        daemon?.writeFile?.(activeFileRight.path, editor.getValue());
                      }
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
            <TerminalPanel 
              daemon={daemon} 
              onClose={() => { setTerminalOpen(false); setTerminalMaximized(false); }} 
              maximized={terminalMaximized}
              onMaximize={() => setTerminalMaximized(!terminalMaximized)}
            />
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
          <div style={{ width: chatWidth }} className="border-l border-border-subtle flex flex-col shrink-0 min-h-0">
            <SimpleMode daemon={daemon} compact={chatWidth < 360} />
          </div>
        </>
      )}
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
