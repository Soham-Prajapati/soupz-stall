import { useState, useEffect, useRef, useCallback } from 'react';

const DAEMON_PORT = 7533;
const DEFAULT_CWD = '/Users/shubh/Developer/aiTesting';

// Agent metadata
const AGENTS = {
  auto:   { label: 'Auto',    icon: '🤖', desc: 'Let the orchestrator pick' },
  gemini: { label: 'Gemini',  icon: '🔮', desc: 'Research, design, frontend' },
  copilot:{ label: 'Copilot', icon: '🐙', desc: 'Coding, shell, DevOps' },
};

function getDaemonUrl() {
  // In dev mode, Vite proxies /api/* to localhost:7533
  // In production / direct access, use actual URL
  if (window.location.port === '5174') return '';
  return `http://${window.location.hostname}:${DAEMON_PORT}`;
}

function getWsUrl(token) {
  const host = window.location.hostname || 'localhost';
  const port = window.location.port === '5174' ? DAEMON_PORT : window.location.port;
  return `ws://${host}:${port}${token ? `?token=${token}` : ''}`;
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [agentStatus, setAgentStatus] = useState({});
  const [selectedAgent, setSelectedAgent] = useState('auto');
  const [cwd, setCwd] = useState(DEFAULT_CWD);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [running, setRunning] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('soupz_token') || '');
  const wsRef = useRef(null);
  const outputRef = useRef(null);
  const promptRef = useRef(null);
  const activeOrderRef = useRef(null);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [messages]);

  // Check if we need pairing (non-local access)
  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal && !token) {
      setShowPairing(true);
      setConnecting(false);
    }
  }, [token]);

  // Connect to daemon
  const connectDaemon = useCallback(async () => {
    setConnecting(true);
    try {
      const base = getDaemonUrl();
      const res = await fetch(`${base}/health`);
      if (res.ok) {
        setConnected(true);
        // Fetch agent availability
        try {
          const agentRes = await fetch(`${base}/api/agents`);
          if (agentRes.ok) {
            const data = await agentRes.json();
            setAgentStatus(data);
          }
        } catch { /* agents endpoint optional */ }
      }
    } catch {
      setConnected(false);
    }
    setConnecting(false);
  }, []);

  useEffect(() => {
    connectDaemon();
    const interval = setInterval(connectDaemon, 15000);
    return () => clearInterval(interval);
  }, [connectDaemon]);

  // WebSocket connection
  useEffect(() => {
    if (!connected) return;

    const ws = new WebSocket(getWsUrl(token));
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate if we have a token
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'order_update' && msg.data) {
          handleOrderUpdate(msg.data);
        } else if (msg.type === 'order_output' && msg.data) {
          handleOrderOutput(msg.data);
        }
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      // Reconnect after 3s
      setTimeout(() => {
        if (wsRef.current === ws) connectDaemon();
      }, 3000);
    };

    return () => {
      ws.close();
    };
  }, [connected, token, connectDaemon]);

  function handleOrderUpdate(data) {
    if (data.id !== activeOrderRef.current) return;
    if (data.status === 'done' || data.status === 'error') {
      setRunning(false);
      if (data.status === 'error') {
        addMessage('error', `Order failed: ${data.status}`);
      }
    }
  }

  function handleOrderOutput(data) {
    // Streaming output from daemon
    if (data.text) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.type === 'agent' && last.streaming) {
          return [...prev.slice(0, -1), { ...last, text: last.text + data.text }];
        }
        return [...prev, { type: 'agent', text: data.text, streaming: true, ts: Date.now() }];
      });
    }
  }

  function addMessage(type, text, meta = {}) {
    setMessages(prev => [...prev, { type, text, ts: Date.now(), ...meta }]);
  }

  // Send prompt
  async function handleSend() {
    const p = prompt.trim();
    if (!p || running) return;

    setPrompt('');
    setRunning(true);
    addMessage('user', p);

    const agent = selectedAgent === 'auto' ? 'auto' : selectedAgent;

    try {
      const base = getDaemonUrl();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['X-Soupz-Token'] = token;

      // Step 1: Classify the prompt if auto
      if (agent === 'auto') {
        addMessage('system', '🤖 Routing — finding the best agent...');
        try {
          const classifyRes = await fetch(`${base}/api/classify`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ prompt: p }),
          });
          if (classifyRes.ok) {
            const data = await classifyRes.json();
            addMessage('system', `Routed to ${data.cliAgent} (${data.specialist}) via ${data.method}`, {
              routing: data
            });
          }
        } catch { /* classification is optional, order will auto-route */ }
      }

      // Step 2: Create order
      const orderRes = await fetch(`${base}/api/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: p,
          agent,
          cwd,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.text();
        throw new Error(err);
      }

      const order = await orderRes.json();
      activeOrderRef.current = order.id;

      addMessage('system', `⚡ Order ${order.id} created — agent: ${order.runAgent || order.agent}`, {
        routing: { agent: order.runAgent || order.agent, fallback: order.fallback }
      });

      // Step 3: Poll for results (WebSocket may also push updates)
      pollOrder(order.id, base, headers);

    } catch (err) {
      addMessage('error', `Failed: ${err.message}`);
      setRunning(false);
    }
  }

  async function pollOrder(orderId, base, headers) {
    const maxPolls = 300; // 5 minutes max
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const res = await fetch(`${base}/api/orders/${orderId}`, { headers });
        if (!res.ok) continue;
        const data = await res.json();

        // Update output
        if (data.stdout) {
          setMessages(prev => {
            const existing = prev.find(m => m.orderId === orderId && m.type === 'agent');
            if (existing) {
              return prev.map(m =>
                m.orderId === orderId && m.type === 'agent'
                  ? { ...m, text: data.stdout }
                  : m
              );
            }
            return [...prev, { type: 'agent', text: data.stdout, orderId, ts: Date.now() }];
          });
        }

        if (data.status === 'done') {
          setRunning(false);
          const duration = data.durationMs ? `${(data.durationMs / 1000).toFixed(1)}s` : '?';
          addMessage('system', `✅ Done in ${duration}`);
          return;
        }

        if (data.status === 'error') {
          setRunning(false);
          addMessage('error', `Agent error: ${data.stderr || 'Unknown error'}`);
          return;
        }
      } catch { /* keep polling */ }
    }
    setRunning(false);
    addMessage('error', 'Timed out after 5 minutes');
  }

  // Pairing
  async function handlePair() {
    const code = pairingCode.trim();
    if (!code) return;
    setPairingError('');
    try {
      const base = getDaemonUrl();
      const res = await fetch(`${base}/pair/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const err = await res.json();
        setPairingError(err.error || 'Invalid code');
        return;
      }
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem('soupz_token', data.token);
      setShowPairing(false);
      connectDaemon();
    } catch {
      setPairingError('Cannot connect to daemon');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Auto-resize textarea
  function handlePromptChange(e) {
    setPrompt(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <span className="logo">🫕 Soupz</span>
          <span className={`status-dot ${connected ? 'online' : connecting ? 'connecting' : ''}`} />
          <span className="status-text">
            {connected ? 'daemon online' : connecting ? 'connecting...' : 'offline'}
          </span>
        </div>
      </div>

      {/* Agent Chips */}
      <div className="agents-bar">
        {Object.entries(AGENTS).map(([id, a]) => {
          const isReady = id === 'auto' || agentStatus[id];
          return (
            <button
              key={id}
              className={`agent-chip ${selectedAgent === id ? 'active' : ''} ${!isReady && id !== 'auto' ? 'unavailable' : ''}`}
              onClick={() => isReady || id === 'auto' ? setSelectedAgent(id) : null}
              title={a.desc}
            >
              <span className={`dot ${isReady || id === 'auto' ? 'ready' : 'down'}`} />
              {a.icon} {a.label}
            </button>
          );
        })}
      </div>

      {/* Output */}
      <div className="output-area" ref={outputRef}>
        {messages.length === 0 && (
          <div className="empty-state">
            <div className="icon">🫕</div>
            <h3>Soupz Orchestrator</h3>
            <p>
              Type a prompt below. The orchestrator will pick the best free AI model 
              and run it on your machine. Output appears here.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.type === 'user') {
            return <div key={i} className="message user">{msg.text}</div>;
          }
          if (msg.type === 'system') {
            return (
              <div key={i} className="message system">
                <span>{msg.text}</span>
                {msg.routing && (
                  <div className="routing-info">
                    {msg.routing.cliAgent && (
                      <span className="routing-badge agent-badge">{msg.routing.cliAgent}</span>
                    )}
                    {msg.routing.specialist && (
                      <span className="routing-badge method-badge">{msg.routing.specialist}</span>
                    )}
                    {msg.routing.method && (
                      <span className="routing-badge time-badge">via {msg.routing.method}</span>
                    )}
                  </div>
                )}
              </div>
            );
          }
          if (msg.type === 'agent') {
            return (
              <div key={i} className="message agent">
                {msg.text}
                {msg.streaming && <span className="cursor-blink" />}
              </div>
            );
          }
          if (msg.type === 'error') {
            return <div key={i} className="message error">❌ {msg.text}</div>;
          }
          return null;
        })}
      </div>

      {/* Input */}
      <div className="input-area">
        <div className="cwd-row">
          <label>📂 cwd:</label>
          <input
            className="cwd-input"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="/path/to/project"
          />
        </div>
        <div className="prompt-row">
          <textarea
            ref={promptRef}
            className="prompt-input"
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={handleKeyDown}
            placeholder={running ? 'Agent is running...' : 'Type your prompt... (Enter to send, Shift+Enter for newline)'}
            disabled={running || !connected}
            rows={1}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={running || !prompt.trim() || !connected}
            title="Send prompt"
          >
            {running ? '⏳' : '→'}
          </button>
        </div>
      </div>

      {/* Pairing Modal */}
      {showPairing && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>🔗 Pair Your Device</h2>
            <p>
              Enter the pairing code shown on your laptop terminal
              (run <code>soupz</code> to see it)
            </p>
            <input
              className="code-input"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
              placeholder="00000000"
              maxLength={8}
              inputMode="numeric"
              autoFocus
            />
            {pairingError && <div className="modal-error">{pairingError}</div>}
            <button
              className="modal-btn"
              onClick={handlePair}
              disabled={pairingCode.length < 8}
            >
              Connect
            </button>
            <div
              className="skip-link"
              onClick={() => setShowPairing(false)}
            >
              Skip (local access only)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
