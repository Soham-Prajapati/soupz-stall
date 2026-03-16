import React, { useEffect, useMemo, useState } from 'react';

const lanes = [
  { id: 'waiter', label: 'Waiter Intake' },
  { id: 'head-chef', label: 'Head Chef Router' },
  { id: 'dev-chef', label: 'Developer Station' },
  { id: 'design-chef', label: 'Designer Station' },
  { id: 'expeditor', label: 'Expeditor' },
];

const DEFAULT_REMOTE = normalizeRemoteUrl(import.meta.env.VITE_SOUPZ_REMOTE_URL || 'http://localhost:7533');

function normalizeRemoteUrl(value) {
  return (value || '').replace(/\/$/, '');
}

function queryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function duration(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return '--';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function App() {
  const [remoteUrl, setRemoteUrl] = useState(
    normalizeRemoteUrl(queryParam('remote') || localStorage.getItem('soupz_remote_url') || DEFAULT_REMOTE)
  );
  const [token, setToken] = useState(queryParam('token') || localStorage.getItem('soupz_remote_token') || '');
  const [prompt, setPrompt] = useState('Build POST /api/orders and stream lifecycle events to dashboard timeline.');
  const [agent, setAgent] = useState('auto');
  const [modelPolicy, setModelPolicy] = useState('balanced');
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sending, setSending] = useState(false);
  const [apiError, setApiError] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [showChanges, setShowChanges] = useState(false);
  const [changes, setChanges] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [selectedDiff, setSelectedDiff] = useState('');

  useEffect(() => {
    localStorage.setItem('soupz_remote_url', normalizeRemoteUrl(remoteUrl));
  }, [remoteUrl]);

  useEffect(() => {
    if (token) localStorage.setItem('soupz_remote_token', token);
  }, [token]);

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (token) headers['X-Soupz-Token'] = token;
    const baseUrl = normalizeRemoteUrl(remoteUrl);
    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, { ...options, headers });
    } catch (err) {
      throw new Error(`Network error: could not reach ${baseUrl}`);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  async function loadOrders() {
    if (!token) return;
    try {
      setLoadingOrders(true);
      setApiError('');
      const data = await request('/api/orders');
      setOrders(data.orders || []);
      if (!selectedOrderId && data.orders?.length) {
        setSelectedOrderId(data.orders[0].id);
      }
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoadingOrders(false);
    }
  }

  async function loadOrder(id) {
    if (!id || !token) return;
    try {
      const data = await request(`/api/orders/${id}`);
      setSelectedOrder(data.order);
    } catch (err) {
      setApiError(err.message);
    }
  }

  useEffect(() => {
    loadOrders();
    if (!token) return undefined;
    const interval = setInterval(loadOrders, 2500);
    return () => clearInterval(interval);
  }, [token, remoteUrl]);

  useEffect(() => {
    loadOrder(selectedOrderId);
    if (!selectedOrderId || !token) return undefined;
    const interval = setInterval(() => loadOrder(selectedOrderId), 1500);
    return () => clearInterval(interval);
  }, [selectedOrderId, token, remoteUrl]);

  async function submitOrder() {
    if (!prompt.trim()) return;
    setSending(true);
    setApiError('');
    try {
      const data = await request('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, agent, modelPolicy }),
      });
      const id = data.order?.id;
      await loadOrders();
      if (id) setSelectedOrderId(id);
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function loadChanges() {
    if (!token) return;
    try {
      const data = await request('/api/changes');
      setChanges(data.changes || []);
      if (!selectedFile && data.changes?.length) {
        setSelectedFile(data.changes[0].file);
      }
    } catch (err) {
      setApiError(err.message);
    }
  }

  async function loadDiff(file) {
    if (!file) return;
    try {
      const data = await request(`/api/changes/diff?file=${encodeURIComponent(file)}`);
      setSelectedDiff(data.diff || 'No diff available.');
    } catch (err) {
      setSelectedDiff(`Failed to load diff: ${err.message}`);
    }
  }

  useEffect(() => {
    if (showChanges) loadChanges();
  }, [showChanges, token, remoteUrl]);

  useEffect(() => {
    if (selectedFile && showChanges) loadDiff(selectedFile);
  }, [selectedFile, showChanges]);

  const queue = useMemo(() => orders.slice(0, 3), [orders]);

  const metrics = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter((o) => o.status === 'completed').length;
    const failed = orders.filter((o) => o.status === 'failed').length;
    const successRate = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, failed, successRate };
  }, [orders]);

  const laneStates = useMemo(() => {
    const status = selectedOrder?.status;
    return {
      waiter: status ? 'Done' : 'Idle',
      'head-chef': status === 'queued' || status === 'running' || status === 'completed' || status === 'failed' ? 'Routed' : 'Idle',
      'dev-chef': status === 'running' ? 'Active' : status === 'completed' ? 'Done' : status === 'failed' ? 'Failed' : 'Queued',
      'design-chef': 'Queued',
      expeditor: status === 'completed' ? 'Served' : status === 'failed' ? 'Blocked' : 'Idle',
    };
  }, [selectedOrder]);

  const selectedSummary = useMemo(() => {
    if (!selectedOrder) return 'No order selected.';
    return `${selectedOrder.status.toUpperCase()} | Requested: ${selectedOrder.agent} | Running: ${selectedOrder.runAgent || selectedOrder.agent} | Duration: ${duration(selectedOrder.startedAt, selectedOrder.finishedAt)}`;
  }, [selectedOrder]);

  return (
    <div className="kitchen-shell">
      <header className="topbar card">
        <div>
          <p className="eyebrow">Soupz Command Center</p>
          <h1>Kitchen Control Room</h1>
          <p className="sub">Web-first workflow: prompt, route, execute, inspect.</p>
        </div>
        <div className="topbar-actions">
          <input className="chip input-chip" value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} placeholder="http://localhost:7533" />
          <input className="chip input-chip" value={token} onChange={(e) => setToken(e.target.value)} placeholder="X-Soupz-Token" />
          <button className={`chip ${token ? 'success' : ''}`}>{token ? 'Auth Ready' : 'Token Needed'}</button>
          <button className="chip">Model Policy: {modelPolicy}</button>
          <button className="chip clickable" onClick={() => setShowChanges((v) => !v)}>
            {showChanges ? 'Hide File Changes' : 'View File Changes'}
          </button>
        </div>
      </header>
      {apiError && <div className="card api-error">{apiError}</div>}

      <main className="layout-grid">
        <section className="card composer">
          <div className="section-head">
            <h2>Order Composer</h2>
            <span className="status-dot">Live</span>
          </div>
          <label htmlFor="prompt-input">Prompt</label>
          <textarea
            id="prompt-input"
            placeholder="Describe what you want built..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="composer-row">
            <select value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="auto">Auto Route</option>
              <option value="copilot">Copilot</option>
              <option value="gemini">Gemini</option>
            </select>
            <select value={modelPolicy} onChange={(e) => setModelPolicy(e.target.value)}>
              <option value="free">Free Only</option>
              <option value="balanced">Balanced</option>
              <option value="premium">Premium</option>
            </select>
            <button className="primary" onClick={submitOrder} disabled={sending || !token}>
              {sending ? 'Sending...' : 'Send Order'}
            </button>
          </div>
        </section>

        <section className="card timeline">
          <div className="section-head">
            <h2>Kitchen Timeline</h2>
            <span className="pill">{selectedOrder ? selectedOrder.id : 'No Order'}</span>
          </div>
          <ol>
            {(selectedOrder?.events || []).slice(-8).map((evt, idx) => (
              <li key={`${evt.type}-${idx}`}>
                <span>{evt.type}</span>
                <small>{new Date(evt.at).toLocaleTimeString()}</small>
              </li>
            ))}
            {!selectedOrder?.events?.length && <li><span>No timeline events yet.</span><small>--</small></li>}
          </ol>
        </section>

        <section className="card queue-panel">
          <div className="section-head">
            <h2>Queue</h2>
          </div>
          {loadingOrders && <article className="queue-item"><p>Refreshing queue...</p></article>}
          {!queue.length && !loadingOrders && <article className="queue-item"><p>No orders yet.</p></article>}
          {queue.map((item) => (
            <article key={item.id} className={`queue-item clickable ${selectedOrderId === item.id ? 'active' : ''}`} onClick={() => setSelectedOrderId(item.id)}>
              <strong>{item.id}</strong>
              <p>{item.prompt}</p>
              <div className="meta">
                <span>{item.runAgent || item.agent}</span>
                <span>{item.status}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="card lanes-panel">
          <div className="section-head">
            <h2>Station Lanes</h2>
          </div>
          <div className="lanes">
            {lanes.map((lane) => (
              <div key={lane.id} className="lane-row">
                <div className="lane-badge" style={{ backgroundColor: laneStates[lane.id] === 'Active' ? 'var(--teal)' : laneStates[lane.id] === 'Failed' ? 'var(--danger)' : laneStates[lane.id] === 'Served' || laneStates[lane.id] === 'Done' || laneStates[lane.id] === 'Routed' ? 'var(--green)' : 'var(--steel-300)' }} />
                <div className="lane-copy">
                  <strong>{lane.label}</strong>
                  <small>{laneStates[lane.id]}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card charts-panel">
          <div className="section-head">
            <h2>Metrics</h2>
          </div>
          <div className="chart-grid">
            <div className="chart-box">
              <span>Latency Trend</span>
              <div className="fake-chart line">{selectedOrder ? duration(selectedOrder.startedAt, selectedOrder.finishedAt) : '--'}</div>
            </div>
            <div className="chart-box">
              <span>Success Rate</span>
              <div className="fake-chart gauge">{metrics.successRate}%</div>
            </div>
            <div className="chart-box full">
              <span>Order Split</span>
              <div className="fake-chart bars">{metrics.completed} complete / {metrics.failed} failed / {metrics.total} total</div>
            </div>
          </div>
        </section>
      </main>

      <section className="card output-panel">
        <div className="section-head">
          <h2>Chef Output</h2>
          <span className="pill">{selectedSummary}</span>
        </div>
        <pre>{selectedOrder?.stdout?.slice(-5000) || 'No output yet.'}</pre>
      </section>

      {showChanges && (
        <aside className="changes-drawer card" aria-live="polite">
          <div className="section-head">
            <h2>File Changes</h2>
            <button className="chip clickable" onClick={() => setShowChanges(false)}>Close</button>
          </div>
          <div className="changes-content">
            <div className="changes-list">
              {!changes.length && <p className="muted">No changed files found.</p>}
              {changes.map((c) => (
                <button
                  key={c.file}
                  className={`change-row ${selectedFile === c.file ? 'active' : ''}`}
                  onClick={() => setSelectedFile(c.file)}
                >
                  <strong>{c.file}</strong>
                  <small>{c.status}</small>
                </button>
              ))}
            </div>
            <div className="diff-preview">
              <p className="eyebrow">Selected</p>
              <h3>{selectedFile || 'No file selected'}</h3>
              <p>{changes.find((c) => c.file === selectedFile)?.status || ''}</p>
              <pre>{selectedDiff || 'Select a file to preview diff.'}</pre>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
