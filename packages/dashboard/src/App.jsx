import { useState, useEffect, useCallback } from 'react';
import AuthScreen from './components/AuthScreen.jsx';
import SimpleMode from './components/SimpleMode.jsx';
import ProMode from './components/ProMode.jsx';
import { supabase, isSupabaseConfigured } from './lib/supabase.js';
import { checkDaemonHealth, subscribeToDaemon, sendAgentPrompt, getFileTree, getGitStatus, gitStage, gitCommit, gitPush } from './lib/daemon.js';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState('simple'); // simple | pro
  const [daemonOnline, setDaemonOnline] = useState(false);

  // File/git state
  const [fileTree, setFileTree] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [gitStatus, setGitStatus] = useState([]);
  const [activeDiff, setActiveDiff] = useState(null);
  const [changedFiles, setChangedFiles] = useState([]);
  const [commitMessage, setCommitMessage] = useState('');

  // Chat state
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);

  // Auth
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // No Supabase — skip auth, go straight to app
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

  // Daemon health check
  useEffect(() => {
    async function checkDaemon() {
      const health = await checkDaemonHealth();
      setDaemonOnline(health.online);
    }
    checkDaemon();
    const interval = setInterval(checkDaemon, 10000);
    return () => clearInterval(interval);
  }, []);

  // Supabase relay subscription (for remote/phone access)
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToDaemon(user.id, (response) => {
      handleDaemonResponse(response);
    });
    return unsub;
  }, [user]);

  function handleDaemonResponse(response) {
    if (response.type === 'AGENT_OUTPUT') {
      const { chunk, done, agentId, agentName, agentIcon } = response.payload;
      if (done) {
        setIsThinking(false);
      } else {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'agent' && last?.streaming) {
            return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
          }
          return [...prev, { role: 'agent', agentId, agentName, agentIcon, content: chunk, streaming: true }];
        });
      }
    } else if (response.type === 'FILE_TREE') {
      setFileTree(response.payload.tree);
      setChangedFiles(response.payload.changedFiles || []);
    } else if (response.type === 'FILE_CONTENT') {
      setFileContent(response.payload.content);
    } else if (response.type === 'GIT_STATUS') {
      setGitStatus(response.payload.files || []);
    } else if (response.type === 'GIT_DIFF') {
      setActiveDiff(response.payload);
    } else if (response.type === 'ERROR') {
      setIsThinking(false);
      setMessages(prev => [...prev, { role: 'agent', agentId: 'error', agentName: 'Error', content: response.payload.message }]);
    }
  }

  async function handleSendPrompt(prompt, expertId, buildMode) {
    if (!prompt.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);
    setIsThinking(true);

    try {
      await sendAgentPrompt(prompt, expertId, buildMode, user?.id);
    } catch (err) {
      setIsThinking(false);
      setMessages(prev => [...prev, { role: 'agent', agentName: 'Error', content: `Failed to send: ${err.message}. Make sure your daemon is running (npx soupz)` }]);
    }
  }

  async function handleFileSelect(node) {
    if (node.action === 'open-folder') {
      // Trigger folder picker via daemon
      return;
    }
    if (node.type === 'file') {
      setSelectedFile(node);
      // Request file content from daemon
      // This will come back via the relay subscription
    }
  }

  async function handleGitStage(filePath, stage) {
    await gitStage(filePath, user?.id);
    const newStatus = await getGitStatus(null, user?.id);
    setGitStatus(newStatus || []);
  }

  async function handleCommit(message) {
    await gitCommit(message, user?.id);
    setCommitMessage('');
  }

  async function handlePush() {
    await gitPush(user?.id);
  }

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#09090b' }}>
        <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #10b981, #3b82f6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>⚡</div>
      </div>
    );
  }

  if (!user && isSupabaseConfigured()) {
    return <AuthScreen onAuth={setUser} />;
  }

  return (
    <div style={{ height: '100vh', background: '#09090b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Nav */}
      <nav style={navStyles.nav}>
        <div style={navStyles.left}>
          <div style={navStyles.logo}>⚡</div>
          <span style={navStyles.brand}>soupz</span>
        </div>

        <div style={navStyles.modeSwitcher}>
          <button onClick={() => setMode('simple')} style={navStyles.modeBtn(mode === 'simple')}>
            Simple
          </button>
          <button onClick={() => setMode('pro')} style={navStyles.modeBtn(mode === 'pro')}>
            Pro
          </button>
        </div>

        <div style={navStyles.right}>
          <div style={navStyles.daemonDot(daemonOnline)} title={daemonOnline ? 'Laptop connected' : 'Run npx soupz'} />
          <span style={{ fontSize: '12px', color: '#52525b' }}>{user?.email}</span>
          {isSupabaseConfigured() && (
            <button onClick={() => supabase.auth.signOut()} style={navStyles.signOut}>Sign out</button>
          )}
        </div>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'simple' ? (
          <SimpleMode
            daemonOnline={daemonOnline}
            messages={messages}
            isThinking={isThinking}
            onSendPrompt={handleSendPrompt}
          />
        ) : (
          <ProMode
            daemonOnline={daemonOnline}
            fileTree={fileTree}
            selectedFile={selectedFile}
            fileContent={fileContent}
            gitStatus={gitStatus}
            activeDiff={activeDiff}
            messages={messages}
            isThinking={isThinking}
            changedFiles={changedFiles}
            commitMessage={commitMessage}
            setCommitMessage={setCommitMessage}
            onSendPrompt={handleSendPrompt}
            onFileSelect={handleFileSelect}
            onStage={handleGitStage}
            onCommit={handleCommit}
            onPush={handlePush}
          />
        )}
      </div>
    </div>
  );
}

const navStyles = {
  nav: { height: '48px', background: '#18181b', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between', flexShrink: 0, zIndex: 10 },
  left: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo: { width: '28px', height: '28px', background: 'linear-gradient(135deg, #10b981, #3b82f6)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' },
  brand: { fontSize: '16px', fontWeight: '700', color: '#fafafa', letterSpacing: '-0.03em' },
  modeSwitcher: { display: 'flex', background: '#09090b', borderRadius: '8px', padding: '3px', gap: '2px' },
  modeBtn: (active) => ({ background: active ? '#27272a' : 'transparent', border: 'none', borderRadius: '6px', padding: '4px 16px', color: active ? '#fafafa' : '#71717a', cursor: 'pointer', fontSize: '13px', fontWeight: active ? '600' : '400' }),
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  daemonDot: (online) => ({ width: '8px', height: '8px', borderRadius: '50%', background: online ? '#10b981' : '#52525b', boxShadow: online ? '0 0 6px #10b981' : 'none', cursor: 'help' }),
  signOut: { background: 'none', border: '1px solid #27272a', borderRadius: '6px', padding: '3px 10px', color: '#71717a', cursor: 'pointer', fontSize: '12px' },
};
