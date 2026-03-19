import { useState, useRef, useEffect, Suspense, lazy } from 'react';
import FileTree from './FileTree.jsx';
import GitPanel from './GitPanel.jsx';

const MonacoEditor = lazy(() => import('@monaco-editor/react').then(m => ({ default: m.default })));

const TABS = [
  { id: 'explorer', icon: '📁', label: 'Files' },
  { id: 'git', icon: '🔀', label: 'Git' },
];

const EXPERT_CATEGORIES = [
  { id: 'auto', label: 'Auto', icon: '🎯' },
  { id: 'designer', label: 'Designer', icon: '🎨' },
  { id: 'dev', label: 'Developer', icon: '💻' },
  { id: 'researcher', label: 'Researcher', icon: '🔬' },
  { id: 'strategist', label: 'Strategist', icon: '💼' },
  { id: 'devops', label: 'DevOps', icon: '🚀' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'ai-engineer', label: 'AI Engineer', icon: '🤖' },
];

export default function ProMode({ daemonOnline, fileTree, selectedFile, fileContent, gitStatus, activeDiff, messages, isThinking, onSendPrompt, onFileSelect, onStage, onCommit, onPush, commitMessage, setCommitMessage, changedFiles }) {
  const [sidebarTab, setSidebarTab] = useState('explorer');
  const [prompt, setPrompt] = useState('');
  const [expert, setExpert] = useState('auto');
  const [chatOpen, setChatOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  function handleSend(e) {
    e.preventDefault();
    if (!prompt.trim() || isThinking) return;
    onSendPrompt(prompt, expert, 'quick');
    setPrompt('');
  }

  const selectedExpert = EXPERT_CATEGORIES.find(e => e.id === expert);

  return (
    <div style={styles.container}>
      {/* Activity bar (leftmost) */}
      <div style={styles.activityBar}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setSidebarTab(tab.id)} title={tab.label} style={styles.activityBtn(sidebarTab === tab.id)}>
            {tab.icon}
          </button>
        ))}
      </div>

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          {TABS.find(t => t.id === sidebarTab)?.label?.toUpperCase()}
        </div>
        {sidebarTab === 'explorer' && (
          <FileTree tree={fileTree} selectedFile={selectedFile?.path} onFileSelect={onFileSelect} changedFiles={changedFiles} />
        )}
        {sidebarTab === 'git' && (
          <GitPanel status={gitStatus} onStage={onStage} onCommit={onCommit} onPush={onPush} commitMessage={commitMessage} setCommitMessage={setCommitMessage} activeDiff={activeDiff} />
        )}
      </div>

      {/* Main editor area */}
      <div style={styles.editorArea}>
        {/* Tab bar */}
        <div style={styles.tabBar}>
          {selectedFile ? (
            <div style={styles.editorTab}>
              <span>{selectedFile.name}</span>
              {changedFiles.includes(selectedFile.path) && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', marginLeft: '6px' }} />}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#52525b', padding: '0 16px' }}>No file open</div>
          )}
          <div style={styles.tabBarRight}>
            <div style={styles.daemonStatus(daemonOnline)}>{daemonOnline ? 'Connected' : 'Offline'}</div>
          </div>
        </div>

        {/* Editor / Welcome */}
        <div style={styles.editorContent}>
          {selectedFile ? (
            <Suspense fallback={<div style={{ padding: '20px', color: '#52525b' }}>Loading editor...</div>}>
              <MonacoEditor
                height="100%"
                language={getLanguage(selectedFile.name)}
                value={fileContent || ''}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  renderLineHighlight: 'all',
                  fontFamily: 'JetBrains Mono, Fira Code, monospace',
                  fontLigatures: true,
                }}
              />
            </Suspense>
          ) : (
            <WelcomeScreen onOpenFolder={() => onFileSelect({ action: 'open-folder' })} />
          )}
        </div>

        {/* Terminal panel */}
        {terminalOpen && (
          <div style={styles.terminal}>
            <div style={styles.terminalHeader}>
              <span style={{ fontSize: '12px', color: '#71717a' }}>Terminal</span>
              <button onClick={() => setTerminalOpen(false)} style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer' }}>×</button>
            </div>
            <div style={styles.terminalBody}>
              <span style={{ color: '#10b981' }}>soupz</span><span style={{ color: '#71717a' }}> ~ </span>
              <span style={{ color: '#fafafa' }}>_</span>
            </div>
          </div>
        )}

        {/* Bottom bar */}
        <div style={styles.statusBar}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {gitStatus.length > 0 && (
              <span style={{ fontSize: '11px', color: '#f59e0b' }}>⊡ {gitStatus.length} change{gitStatus.length !== 1 ? 's' : ''}</span>
            )}
            <span style={{ fontSize: '11px', color: '#71717a' }}>{selectedFile?.name || 'No file'}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setTerminalOpen(!terminalOpen)} style={styles.statusBarBtn(terminalOpen)}>⌘ Terminal</button>
          </div>
        </div>
      </div>

      {/* Chat panel */}
      {chatOpen && (
        <div style={styles.chatPanel}>
          <div style={styles.chatHeader}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Assistant</span>
            <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', fontSize: '16px' }}>×</button>
          </div>

          <div style={styles.chatMessages}>
            {messages.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#52525b', fontSize: '13px' }}>
                Ask anything about your code, files, or project.
              </div>
            )}
            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} />
            ))}
            {isThinking && (
              <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[0, 150, 300].map(d => (
                    <span key={d} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981', animation: `pulse 1s ${d}ms infinite` }} />
                  ))}
                </div>
                <span style={{ color: '#52525b', fontSize: '12px' }}>Working...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={styles.chatInput}>
            {/* Expert selector */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {EXPERT_CATEGORIES.slice(0, 5).map(e => (
                <button key={e.id} onClick={() => setExpert(e.id)} style={styles.expertChip(expert === e.id)}>
                  {e.icon} {e.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
              <input
                placeholder="Ask AI or give instructions..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                style={styles.chatInputField}
              />
              <button type="submit" disabled={!prompt.trim() || isThinking} style={styles.chatSendBtn(!prompt.trim() || isThinking)}>↑</button>
            </form>
          </div>
        </div>
      )}

      {!chatOpen && (
        <button onClick={() => setChatOpen(true)} style={styles.chatToggle}>💬</button>
      )}
    </div>
  );
}

function ChatMessage({ msg }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #18181b' }}>
      <div style={{ fontSize: '11px', color: '#52525b', marginBottom: '4px', textTransform: 'uppercase' }}>
        {msg.role === 'user' ? 'You' : (msg.agentName || 'Soupz')}
      </div>
      <div style={{ fontSize: '13px', lineHeight: '1.6', color: msg.role === 'user' ? '#e4e4e7' : '#a1a1aa', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {msg.content}
      </div>
    </div>
  );
}

function WelcomeScreen({ onOpenFolder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', color: '#52525b' }}>
      <div style={{ fontSize: '64px' }}>⚡</div>
      <h2 style={{ color: '#71717a', fontSize: '18px', fontWeight: '500', margin: 0 }}>Open a folder to start</h2>
      <button onClick={onOpenFolder} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '10px 20px', color: '#a1a1aa', cursor: 'pointer', fontSize: '13px' }}>
        Open Folder
      </button>
    </div>
  );
}

function getLanguage(filename) {
  const ext = filename?.split('.').pop().toLowerCase();
  const map = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', css: 'css', html: 'html', json: 'json', md: 'markdown', py: 'python', sh: 'shell', yaml: 'yaml', yml: 'yaml' };
  return map[ext] || 'plaintext';
}

const styles = {
  container: { display: 'flex', height: '100%', overflow: 'hidden' },
  activityBar: { width: '48px', background: '#18181b', borderRight: '1px solid #27272a', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: '4px', flexShrink: 0 },
  activityBtn: (active) => ({ width: '36px', height: '36px', borderRadius: '8px', border: 'none', background: active ? '#27272a' : 'transparent', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }),
  sidebar: { width: '240px', background: '#18181b', borderRight: '1px solid #27272a', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' },
  sidebarHeader: { padding: '10px 16px', fontSize: '11px', fontWeight: '600', color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #27272a' },
  editorArea: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  tabBar: { height: '36px', background: '#18181b', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  editorTab: { display: 'flex', alignItems: 'center', padding: '0 16px', height: '100%', fontSize: '13px', color: '#fafafa', borderRight: '1px solid #27272a', background: '#09090b' },
  tabBarRight: { padding: '0 12px' },
  daemonStatus: (online) => ({ fontSize: '11px', color: online ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }),
  editorContent: { flex: 1, overflow: 'hidden' },
  terminal: { height: '200px', background: '#09090b', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  terminalHeader: { padding: '4px 12px', borderBottom: '1px solid #18181b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  terminalBody: { flex: 1, padding: '12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', overflowY: 'auto' },
  statusBar: { height: '22px', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', flexShrink: 0 },
  statusBarBtn: (active) => ({ background: active ? 'rgba(0,0,0,0.2)' : 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', borderRadius: '3px' }),
  chatPanel: { width: '320px', background: '#18181b', borderLeft: '1px solid #27272a', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  chatHeader: { padding: '12px 16px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  chatMessages: { flex: 1, overflowY: 'auto' },
  chatInput: { padding: '12px', borderTop: '1px solid #27272a', flexShrink: 0 },
  expertChip: (active) => ({ background: active ? '#27272a' : 'transparent', border: `1px solid ${active ? '#3f3f46' : '#27272a'}`, borderRadius: '6px', padding: '2px 8px', fontSize: '11px', color: active ? '#fafafa' : '#71717a', cursor: 'pointer' }),
  chatInputField: { flex: 1, background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '8px 12px', color: '#fafafa', fontSize: '13px', outline: 'none' },
  chatSendBtn: (disabled) => ({ background: disabled ? '#27272a' : '#10b981', border: 'none', borderRadius: '8px', width: '32px', height: '32px', color: disabled ? '#52525b' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '16px', flexShrink: 0 }),
  chatToggle: { position: 'fixed', bottom: '24px', right: '24px', width: '48px', height: '48px', borderRadius: '50%', background: '#10b981', border: 'none', fontSize: '20px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.4)' },
};
