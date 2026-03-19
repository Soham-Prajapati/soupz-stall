import { useState, useRef, useEffect } from 'react';

const EXPERT_CATEGORIES = [
  { id: 'auto', label: 'Auto', icon: '🎯', desc: 'AI picks the best expert' },
  { id: 'designer', label: 'Designer', icon: '🎨', desc: 'UI/UX, brand, layouts' },
  { id: 'dev', label: 'Developer', icon: '💻', desc: 'Code, debug, APIs' },
  { id: 'researcher', label: 'Researcher', icon: '🔬', desc: 'Market, research, insights' },
  { id: 'strategist', label: 'Strategist', icon: '💼', desc: 'Business, GTM, roadmap' },
  { id: 'devops', label: 'DevOps', icon: '🚀', desc: 'Deploy, infra, CI/CD' },
  { id: 'finance', label: 'Finance', icon: '📊', desc: 'Financials, unit economics' },
  { id: 'ai-engineer', label: 'AI Engineer', icon: '🤖', desc: 'LLM, RAG, agents' },
];

const BUILD_MODES = [
  { id: 'quick', label: 'Quick Build', icon: '⚡', desc: 'Jump straight to code' },
  { id: 'planned', label: 'Planned Build', icon: '📋', desc: 'Plan first, then build' },
  { id: 'chat', label: 'Chat', icon: '💬', desc: 'Free conversation' },
];

export default function SimpleMode({ daemonOnline, onSendPrompt, messages, isThinking }) {
  const [prompt, setPrompt] = useState('');
  const [expert, setExpert] = useState('auto');
  const [buildMode, setBuildMode] = useState('quick');
  const [showExperts, setShowExperts] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!prompt.trim() || isThinking) return;
    onSendPrompt(prompt, expert, buildMode);
    setPrompt('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  const selectedExpert = EXPERT_CATEGORIES.find(e => e.id === expert);
  const selectedMode = BUILD_MODES.find(m => m.id === buildMode);

  return (
    <div style={styles.container}>
      {/* Top bar */}
      <div style={styles.topbar}>
        <div style={styles.topLeft}>
          <div style={styles.daemonDot(daemonOnline)} />
          <span style={styles.daemonLabel}>{daemonOnline ? 'Laptop connected' : 'Laptop offline'}</span>
        </div>
        <div style={styles.modeSelector}>
          {BUILD_MODES.map(m => (
            <button key={m.id} onClick={() => setBuildMode(m.id)} style={styles.modeBtn(buildMode === m.id)}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>⚡</div>
            <h2 style={styles.emptyTitle}>What do you want to build?</h2>
            <p style={styles.emptySub}>Describe your idea and I'll get to work</p>
            <div style={styles.suggestions}>
              {['Build a landing page for a SaaS app', 'Create a REST API with authentication', 'Design a mobile onboarding flow'].map(s => (
                <button key={s} onClick={() => setPrompt(s)} style={styles.suggestion}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {isThinking && (
          <div style={styles.thinking}>
            <div style={styles.thinkingDots}>
              <span style={{ ...styles.dot, animationDelay: '0ms' }} />
              <span style={{ ...styles.dot, animationDelay: '150ms' }} />
              <span style={{ ...styles.dot, animationDelay: '300ms' }} />
            </div>
            <span style={{ color: '#71717a', fontSize: '13px' }}>{selectedExpert?.icon} {selectedExpert?.label} is working...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        {/* Expert selector */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowExperts(!showExperts)} style={styles.expertBtn}>
            {selectedExpert?.icon} {selectedExpert?.label} ▾
          </button>
          {showExperts && (
            <div style={styles.expertDropdown}>
              {EXPERT_CATEGORIES.map(e => (
                <button key={e.id} onClick={() => { setExpert(e.id); setShowExperts(false); }} style={styles.expertOption(expert === e.id)}>
                  <span>{e.icon}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#fafafa' }}>{e.label}</div>
                    <div style={{ fontSize: '11px', color: '#71717a' }}>{e.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputBox}>
            <textarea
              ref={textareaRef}
              placeholder={`${selectedMode?.icon} ${buildMode === 'quick' ? 'Describe what to build...' : buildMode === 'planned' ? 'Describe your project goal...' : 'Ask anything...'}`}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              style={styles.textarea}
              rows={1}
            />
            <button type="submit" disabled={!prompt.trim() || isThinking || !daemonOnline} style={styles.sendBtn(!prompt.trim() || isThinking || !daemonOnline)}>
              {isThinking ? '...' : '↑'}
            </button>
          </div>
          {!daemonOnline && (
            <p style={styles.offlineHint}>Run <code style={{ background: '#27272a', padding: '2px 6px', borderRadius: '4px' }}>npx soupz</code> in your terminal to connect your laptop</p>
          )}
        </form>
      </div>
    </div>
  );
}

function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <div style={{ background: '#10b981', color: '#fff', padding: '12px 16px', borderRadius: '16px 16px 4px 16px', maxWidth: '70%', fontSize: '14px', lineHeight: '1.6' }}>
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-start' }}>
      <div style={{ width: '32px', height: '32px', background: '#27272a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
        {msg.agentIcon || '⚡'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', color: '#52525b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{msg.agentName || 'Soupz'}</div>
        <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '4px 16px 16px 16px', padding: '12px 16px', fontSize: '14px', lineHeight: '1.7', color: '#d4d4d8' }}>
          {msg.type === 'plan' ? <PlanView plan={msg.plan} /> : <MarkdownContent content={msg.content} />}
        </div>
        {msg.fileChanges?.length > 0 && <FileChanges changes={msg.fileChanges} />}
      </div>
    </div>
  );
}

function PlanView({ plan }) {
  if (!plan) return null;
  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#10b981', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Build Plan</div>
      {plan.map((phase, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: phase.status === 'done' ? '#10b981' : phase.status === 'active' ? '#3b82f6' : '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#fff', flexShrink: 0 }}>
            {phase.status === 'done' ? '✓' : i + 1}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: phase.status === 'done' ? '#71717a' : '#fafafa' }}>{phase.title}</div>
            {phase.desc && <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>{phase.desc}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function FileChanges({ changes }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginTop: '8px', background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(!expanded)} style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
        <span style={{ fontSize: '12px', color: '#a1a1aa' }}>📁 {changes.length} file{changes.length !== 1 ? 's' : ''} changed</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button style={{ background: '#10b981', border: 'none', borderRadius: '4px', padding: '3px 10px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Accept All</button>
          <button style={{ background: '#27272a', border: 'none', borderRadius: '4px', padding: '3px 10px', color: '#a1a1aa', fontSize: '11px', cursor: 'pointer' }}>Reject All</button>
          <span style={{ color: '#52525b', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>
      {expanded && changes.map((f, i) => (
        <div key={i} style={{ borderTop: '1px solid #27272a', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: f.type === 'add' ? '#10b981' : f.type === 'delete' ? '#ef4444' : '#f59e0b', fontWeight: '700', minWidth: '12px' }}>{f.type === 'add' ? 'A' : f.type === 'delete' ? 'D' : 'M'}</span>
          <span style={{ flex: 1, fontSize: '12px', color: '#a1a1aa', fontFamily: 'monospace' }}>{f.path}</span>
          <span style={{ fontSize: '11px', color: '#52525b' }}>+{f.additions || 0} -{f.deletions || 0}</span>
        </div>
      ))}
    </div>
  );
}

function MarkdownContent({ content }) {
  // Basic markdown rendering
  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {content?.split('\n').map((line, i) => {
        if (line.startsWith('```')) return <div key={i} style={{ height: '4px' }} />;
        if (line.startsWith('# ')) return <h3 key={i} style={{ color: '#fafafa', fontWeight: '700', margin: '8px 0 4px', fontSize: '15px' }}>{line.slice(2)}</h3>;
        if (line.startsWith('## ')) return <h4 key={i} style={{ color: '#e4e4e7', fontWeight: '600', margin: '6px 0 4px', fontSize: '14px' }}>{line.slice(3)}</h4>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ paddingLeft: '12px' }}>• {line.slice(2)}</div>;
        if (line.trim() === '') return <div key={i} style={{ height: '8px' }} />;
        return <span key={i}>{line}<br /></span>;
      })}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: '#09090b' },
  topbar: { height: '48px', borderBottom: '1px solid #18181b', display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between', flexShrink: 0 },
  topLeft: { display: 'flex', alignItems: 'center', gap: '8px' },
  daemonDot: (online) => ({ width: '8px', height: '8px', borderRadius: '50%', background: online ? '#10b981' : '#ef4444', boxShadow: online ? '0 0 6px #10b981' : 'none' }),
  daemonLabel: { fontSize: '12px', color: '#71717a' },
  modeSelector: { display: 'flex', gap: '4px', background: '#18181b', padding: '4px', borderRadius: '8px' },
  modeBtn: (active) => ({ background: active ? '#27272a' : 'transparent', border: 'none', borderRadius: '6px', padding: '4px 12px', color: active ? '#fafafa' : '#71717a', cursor: 'pointer', fontSize: '12px', fontWeight: active ? '600' : '400' }),
  messages: { flex: 1, overflowY: 'auto', padding: '24px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '12px', textAlign: 'center' },
  emptyIcon: { fontSize: '48px', marginBottom: '8px' },
  emptyTitle: { fontSize: '22px', fontWeight: '700', color: '#fafafa', margin: 0 },
  emptySub: { fontSize: '15px', color: '#71717a', margin: 0 },
  suggestions: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', width: '100%', maxWidth: '480px' },
  suggestion: { background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '10px 16px', color: '#a1a1aa', cursor: 'pointer', fontSize: '13px', textAlign: 'left' },
  thinking: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', marginBottom: '16px' },
  thinkingDots: { display: 'flex', gap: '4px' },
  dot: { width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1s ease-in-out infinite' },
  inputArea: { padding: '16px 24px 24px', borderTop: '1px solid #18181b', flexShrink: 0 },
  expertBtn: { background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', padding: '6px 12px', color: '#a1a1aa', cursor: 'pointer', fontSize: '13px', marginBottom: '10px' },
  expertDropdown: { position: 'absolute', bottom: '100%', left: 0, background: '#18181b', border: '1px solid #27272a', borderRadius: '10px', padding: '6px', width: '240px', boxShadow: '0 -8px 24px rgba(0,0,0,0.4)', zIndex: 100 },
  expertOption: (active) => ({ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', width: '100%', background: active ? '#27272a' : 'transparent', border: 'none', textAlign: 'left', marginBottom: '2px' }),
  form: { flex: 1 },
  inputBox: { display: 'flex', gap: '10px', alignItems: 'flex-end', background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '10px 10px 10px 16px' },
  textarea: { flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: '#fafafa', fontSize: '15px', lineHeight: '1.5', maxHeight: '200px', overflow: 'auto', fontFamily: 'inherit' },
  sendBtn: (disabled) => ({ background: disabled ? '#27272a' : '#10b981', border: 'none', borderRadius: '8px', width: '36px', height: '36px', color: disabled ? '#52525b' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
  offlineHint: { fontSize: '12px', color: '#52525b', marginTop: '8px', textAlign: 'center' },
};
