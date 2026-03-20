import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Files, GitBranch, Settings, ChevronLeft, ChevronRight,
  Play, Loader2, PanelRightClose, PanelRightOpen, X, Package,
  Terminal, Search, Trophy,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import FileTree from '../filetree/FileTree';
import GitPanel from '../git/GitPanel';
import SimpleMode from '../simple/SimpleMode';
import StatsPanel from '../shared/StatsPanel';
import MCPPanel from '../shared/MCPPanel';
import ExtensionsMarketplace from '../shared/ExtensionsMarketplace';
import SearchPanel from './SearchPanel';
import TerminalPanel from './TerminalPanel';

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
  const [fileContents, setFileContents] = useState({});
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [running, setRunning] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [chatWidth, setChatWidth] = useState(320);
  const [terminalHeight, setTerminalHeight] = useState(192);

  const editorRef = useRef(null);

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
    setActiveFile(node);
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

  // Mobile: show only chat
  if (isMobile) {
    return (
      <div className="h-full">
        <SimpleMode daemon={daemon} />
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
              {activeActivity === 'files' ? 'Explorer' : activeActivity === 'search' ? 'Search' : activeActivity === 'git' ? 'Source Control' : activeActivity === 'extensions' ? 'Extensions' : activeActivity === 'stats' ? 'Stats & Leaderboard' : 'Settings'}
            </span>
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {activeActivity === 'files' && (
              <FileTree
                tree={fileTree}
                changedPaths={changedPaths}
                onSelect={openFile}
                selectedPath={activeFile?.path}
              />
            )}
            {activeActivity === 'search' && (
              <SearchPanel
                daemon={daemon}
                fileTree={fileTree}
                onOpenFile={(node) => {
                  openFile(node);
                  // If lineNum provided, scroll editor to that line
                  if (node.lineNum && editorRef.current) {
                    setTimeout(() => {
                      editorRef.current.revealLineInCenter(node.lineNum);
                      editorRef.current.setPosition({ lineNumber: node.lineNum, column: 1 });
                      editorRef.current.focus();
                    }, 100);
                  }
                }}
              />
            )}
            {activeActivity === 'git' && (
              <GitPanel daemon={daemon} />
            )}
            {activeActivity === 'extensions' && (
              <ExtensionsMarketplace />
            )}
            {activeActivity === 'stats' && (
              <div className="flex-1 overflow-y-auto min-h-0">
                <StatsPanel />
              </div>
            )}
            {activeActivity === 'settings' && (
              <div className="flex-1 overflow-y-auto min-h-0">
                {/* Editor & keyboard settings */}
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
                {/* Stats & Achievements */}
                <StatsPanel />
                {/* MCP Servers */}
                <MCPPanel />
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

          {/* Run button */}
          {activeFile && (
            <button
              onClick={runFile}
              disabled={running}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-success/10 border border-success/20 text-success text-xs font-ui hover:bg-success/20 transition-all disabled:opacity-50"
            >
              {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Run
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
        {activeFile && (
          <div className="h-6 flex items-center px-3 bg-bg-base border-b border-border-subtle shrink-0 overflow-x-auto">
            {activeFile.path.split('/').filter(Boolean).map((seg, i, arr) => (
              <span key={i} className="flex items-center shrink-0">
                {i > 0 && <span className="text-text-faint text-[10px] mx-1">/</span>}
                <span className={cn(
                  'text-[11px] font-ui',
                  i === arr.length - 1 ? 'text-text-pri' : 'text-text-faint hover:text-text-sec cursor-pointer',
                )}>
                  {seg}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeFile ? (
            <Editor
              path={activeFile.path}
              value={fileContents[activeFile.path] || ''}
              language={lang}
              theme="soupz-dark"
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              beforeMount={monaco => {
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
                    'editor.selectionBackground': '#6366F120',
                    'editor.lineHighlightBackground': '#111114',
                    'editorCursor.foreground': '#6366F1',
                    'editorIndentGuide.background': '#1E1E24',
                    'editor.inactiveSelectionBackground': '#6366F110',
                    'editorGutter.background': '#0C0C0F',
                    'scrollbarSlider.background': '#27272a',
                    'scrollbarSlider.hoverBackground': '#3f3f46',
                  },
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
            <div className="flex flex-col items-center justify-center h-full gap-3 text-text-faint">
              <Files size={32} className="opacity-30" />
              <p className="text-sm font-ui">Select a file to edit</p>
            </div>
          )}
        </div>

        {/* Terminal panel — resizable */}
        {terminalOpen && (
          <>
            <ResizeHandle
              direction="vertical"
              onResize={(delta) => setTerminalHeight(prev => Math.max(100, Math.min(500, prev - delta)))}
            />
            <div style={{ height: terminalHeight }}>
              <TerminalPanel daemon={daemon} onClose={() => setTerminalOpen(false)} />
            </div>
          </>
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
