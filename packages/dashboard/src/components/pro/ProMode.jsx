import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Files, GitBranch, Settings, ChevronLeft, ChevronRight,
  Play, Loader2, PanelRightClose, PanelRightOpen, X,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import FileTree from '../filetree/FileTree';
import GitPanel from '../git/GitPanel';
import SimpleMode from '../simple/SimpleMode';

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

export default function ProMode({ daemon, fileTree, changedPaths }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const [sidebarOpen, setSidebarOpen] = useState(() =>
    !isMobile && (localStorage.getItem(SIDEBAR_KEY) !== 'false')
  );
  const [chatOpen, setChatOpen] = useState(() =>
    !isMobile && (localStorage.getItem(CHAT_KEY) !== 'false')
  );
  const [activeActivity, setActiveActivity] = useState('files'); // files | git | settings
  const [openFiles, setOpenFiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem(OPEN_FILES_KEY) || '[]'); } catch { return []; }
  });
  const [activeFile, setActiveFile] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [running, setRunning] = useState(false);

  const editorRef = useRef(null);

  useEffect(() => { localStorage.setItem(SIDEBAR_KEY, String(sidebarOpen)); }, [sidebarOpen]);
  useEffect(() => { localStorage.setItem(CHAT_KEY, String(chatOpen)); }, [chatOpen]);
  useEffect(() => {
    localStorage.setItem(OPEN_FILES_KEY, JSON.stringify(openFiles.slice(0, 20)));
  }, [openFiles]);

  // Responsive: on mobile, close sidebar and chat
  useEffect(() => {
    function onResize() {
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
        setChatOpen(false);
      }
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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

  function handleEditorMount(editor) {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition(e => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
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
          { id: 'files', Icon: Files, title: 'Explorer' },
          { id: 'git',   Icon: GitBranch, title: 'Source Control' },
          { id: 'settings', Icon: Settings, title: 'Settings' },
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

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-60 bg-bg-surface border-r border-border-subtle flex flex-col shrink-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border-subtle shrink-0">
            <span className="text-text-faint text-[11px] font-ui uppercase tracking-wider font-medium">
              {activeActivity === 'files' ? 'Explorer' : activeActivity === 'git' ? 'Source Control' : 'Settings'}
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
            {activeActivity === 'git' && (
              <GitPanel daemon={daemon} />
            )}
            {activeActivity === 'settings' && (
              <div className="p-4 text-text-faint text-xs font-ui">Settings coming soon</div>
            )}
          </div>
        </div>
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

          {/* Chat toggle */}
          <button
            onClick={() => setChatOpen(v => !v)}
            className="text-text-faint hover:text-text-sec transition-colors"
            title={chatOpen ? 'Close chat' : 'Open chat'}
          >
            {chatOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>
        </div>

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
                minimap: { enabled: false },
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

        {/* Status bar */}
        <div className="h-[22px] bg-bg-surface border-t border-border-subtle flex items-center px-3 gap-4 shrink-0">
          <span className="text-text-faint text-[11px] font-ui flex items-center gap-1">
            <GitBranch size={10} /> main
          </span>
          {activeFile && (
            <>
              <span className="text-text-faint text-[11px] font-mono">
                Ln {cursorPos.line}, Col {cursorPos.col}
              </span>
              <span className="text-text-faint text-[11px] font-ui uppercase">
                {lang}
              </span>
            </>
          )}
          <button
            onClick={saveFile}
            disabled={!activeFile}
            className="ml-auto text-text-faint hover:text-text-sec text-[11px] font-ui transition-colors disabled:opacity-30"
            title="Save (Cmd+S)"
          >
            Save
          </button>
        </div>
      </div>

      {/* Chat panel */}
      {chatOpen && (
        <div className="w-80 border-l border-border-subtle flex flex-col shrink-0 min-h-0 overflow-hidden">
          <SimpleMode daemon={daemon} />
        </div>
      )}
    </div>
  );
}
