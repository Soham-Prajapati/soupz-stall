import { useState, useEffect } from 'react';

const AGENTS = [
  { id: 'orchestrator', name: 'Orchestrator', icon: '🎯', status: 'ready', color: '#10b981', handle: '@orchestrator', desc: 'Routes to best available agent' },
  { id: 'designer', name: 'Designer', icon: '🎨', status: 'idle', color: '#8b5cf6', handle: '@designer', desc: 'UI/UX & Brand Identity' },
  { id: 'developer', name: 'Developer', icon: '💻', status: 'working', color: '#3b82f6', handle: '@dev', desc: 'Full-stack & Debugging' },
  { id: 'architect', name: 'Architect', icon: '🏗️', status: 'idle', color: '#f59e0b', handle: '@architect', desc: 'System Design & APIs' },
  { id: 'researcher', name: 'Researcher', icon: '🔬', status: 'idle', color: '#ec4899', handle: '@researcher', desc: 'Market Data & Insights' },
  { id: 'tester', name: 'Tester', icon: '🧪', status: 'idle', color: '#ef4444', handle: '@tester', desc: 'QA & Edge Cases' },
];

const s = {
  app: { display: 'flex', height: '100vh', width: '100vw', background: '#09090b', color: '#fafafa', overflow: 'hidden' },
  fleet: { width: '280px', background: '#09090b', borderRight: '1px solid #18181b', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  fleetHeader: { padding: '20px 16px', borderBottom: '1px solid #18181b', display: 'flex', alignItems: 'center', gap: '10px' },
  brandIcon: { width: '32px', height: '32px', background: 'linear-gradient(135deg, #10b981, #3b82f6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' },
  brandText: { fontSize: '15px', fontWeight: '700', letterSpacing: '-0.025em' },
  fleetList: { flex: 1, overflowY: 'auto', padding: '12px' },
  agentCard: (isSel, color) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.15s', background: isSel ? '#18181b' : 'transparent', border: isSel ? `1px solid ${color}33` : '1px solid transparent' }),
  agentIcon: (color) => ({ width: '36px', height: '36px', background: `${color}15`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', border: `1px solid ${color}33` }),
  agentStatus: (status) => ({ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', color: status === 'working' ? '#3b82f6' : '#71717a', display: 'flex', alignItems: 'center', gap: '4px' }),
  pulse: { width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%', boxShadow: '0 0 8px #3b82f6', animation: 'pulse 1.5s infinite' },

  center: { flex: 1, display: 'flex', flexDirection: 'column', background: '#09090b', overflow: 'hidden' },
  topbar: { height: '56px', background: '#09090b', borderBottom: '1px solid #18181b', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' },
  statChip: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#71717a' },
  statItem: { display: 'flex', alignItems: 'center', gap: '4px' },
  chatArea: { flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' },
  msg: (role) => ({ alignSelf: role === 'user' ? 'flex-end' : 'flex-start', maxWidth: role === 'user' ? '70%' : '85%', display: 'flex', gap: '12px', alignItems: 'flex-start' }),
  bubble: (role, color) => ({ padding: '14px 18px', borderRadius: '12px', fontSize: '14px', lineHeight: '1.6', background: role === 'user' ? `${color}cc` : '#18181b', border: role === 'user' ? 'none' : '1px solid #27272a' }),
  thinking: { fontSize: '13px', color: '#71717a', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' },

  inputContainer: { padding: '24px', background: '#09090b', borderTop: '1px solid #18181b' },
  inputBox: { background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '8px 8px 8px 16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' },
  inputRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  inputField: { flex: 1, background: 'transparent', border: 'none', color: '#fafafa', outline: 'none', fontSize: '15px', padding: '8px 0' },
  contextRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  contextChip: { background: '#27272a', padding: '2px 10px', borderRadius: '6px', fontSize: '11px', color: '#a1a1aa', border: '1px solid #3f3f46', display: 'flex', alignItems: 'center', gap: '4px' },
  planToggle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#a1a1aa', borderLeft: '1px solid #27272a', paddingLeft: '12px', marginLeft: '8px' },
  sendBtn: (color, disabled) => ({ background: disabled ? '#27272a' : color, color: disabled ? '#52525b' : '#fff', border: 'none', width: '36px', height: '36px', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }),

  right: { width: '420px', background: '#09090b', borderLeft: '1px solid #18181b', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  tabs: { display: 'flex', borderBottom: '1px solid #18181b', padding: '0 16px' },
  tab: (active) => ({ padding: '16px 12px', fontSize: '13px', fontWeight: '600', color: active ? '#fafafa' : '#71717a', border: 'none', background: 'none', cursor: 'pointer', borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent' }),
  panel: { flex: 1, overflowY: 'auto', padding: '20px' },
  planCard: { background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', marginBottom: '12px' },
  planStep: { display: 'flex', gap: '12px', marginBottom: '16px' },
  stepNum: { width: '20px', height: '20px', background: '#27272a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', flexShrink: 0 },
  diffBox: { background: '#0c0c0e', border: '1px solid #18181b', borderRadius: '8px', padding: '12px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.6', overflow: 'auto' },
};

export default function KitchenView() {
  const [selected, setSelected] = useState('orchestrator');
  const [activeTab, setActiveTab] = useState('plan');
  const [prompt, setPrompt] = useState('');
  const [isPlanOn, setIsPlanOn] = useState(true);
  const [messages, setMessages] = useState([
    { role: 'agent', agent: 'orchestrator', content: 'Ready to collaborate. Use @agent to route specifically, or just tell me your goal.' }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  const selectedAgent = AGENTS.find(a => a.id === selected);

  const handleOrder = () => {
    if (!prompt.trim() || isThinking) return;
    const p = prompt;
    setPrompt('');
    setIsThinking(true);
    setMessages(prev => [...prev, { role: 'user', content: p }]);

    setTimeout(() => {
      setIsThinking(false);
      setMessages(prev => [...prev, {
        role: 'agent',
        agent: selected,
        content: `I've analyzed your request for "${p}". Starting Phase 1 of the implementation plan.`
      }]);
    }, 2500);
  };

  return (
    <div style={s.app}>
      {/* LEFT: FLEET */}
      <aside style={s.fleet}>
        <div style={s.fleetHeader}>
          <div style={s.brandIcon}>🍜</div>
          <div style={s.brandText}>SOUPZ STALL</div>
        </div>
        <div style={s.fleetList}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#52525b', padding: '0 12px 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent Fleet</div>
          {AGENTS.map(a => (
            <div key={a.id} onClick={() => setSelected(a.id)} style={s.agentCard(selected === a.id, a.color)}>
              <div style={s.agentIcon(a.color)}>{a.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>{a.name}</div>
                <div style={s.agentStatus(a.status)}>
                  {a.status === 'working' && <div style={s.pulse} />}
                  {a.status === 'working' ? 'Processing' : 'Available'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* CENTER: COMMAND */}
      <main style={s.center}>
        <div style={s.topbar}>
          <div style={{ fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#71717a' }}>Current Agent:</span>
            <span style={{ color: selectedAgent.color }}>{selectedAgent.name}</span>
          </div>
          <div style={s.statChip}>
            <div style={s.statItem}><span>12</span> <span style={{ color: '#52525b' }}>Files</span></div>
            <div style={s.statItem}><span>4.2k</span> <span style={{ color: '#52525b' }}>Tokens</span></div>
            <div style={{ ...s.statItem, color: '#10b981' }}><span>● Online</span></div>
          </div>
        </div>

        <div style={s.chatArea}>
          {messages.map((m, i) => (
            <div key={i} style={s.msg(m.role)}>
              {m.role === 'agent' && <div style={s.agentIcon(AGENTS.find(a => a.id === m.agent)?.color || '#3f3f46')}>{AGENTS.find(a => a.id === m.agent)?.icon}</div>}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={s.bubble(m.role, selectedAgent.color)}>{m.content}</div>
                {m.role === 'agent' && <div style={{ fontSize: '11px', color: '#52525b', marginTop: '6px' }}>{m.agent} • Just now</div>}
              </div>
            </div>
          ))}
          {isThinking && (
            <div style={s.msg('agent')}>
              <div style={s.agentIcon(selectedAgent.color)}>{selectedAgent.icon}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={s.thinking}>
                  <span>{selectedAgent.name} is thinking</span>
                  <span style={{ display: 'flex', gap: '2px' }}>
                    <span style={{ animation: 'blink 1s infinite' }}>.</span>
                    <span style={{ animation: 'blink 1s infinite 0.2s' }}>.</span>
                    <span style={{ animation: 'blink 1s infinite 0.4s' }}>.</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={s.inputContainer}>
          <div style={s.inputBox}>
            <div style={s.contextRow}>
              <div style={s.contextChip}>📄 main.js</div>
              <div style={s.contextChip}>📄 config.json</div>
              <div style={s.contextChip}>🌐 web-context</div>
            </div>
            <div style={s.inputRow}>
              <input 
                style={s.inputField} 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleOrder()}
                placeholder={`Ask ${selectedAgent.name} to plan or build...`} 
              />
              <div style={s.planToggle}>
                <span style={{ color: isPlanOn ? '#3b82f6' : '#71717a' }}>Plan</span>
                <div 
                  onClick={() => setIsPlanOn(!isPlanOn)}
                  style={{ width: '28px', height: '16px', background: isPlanOn ? '#3b82f6' : '#27272a', borderRadius: '10px', position: 'relative', cursor: 'pointer' }}>
                  <div style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', position: 'absolute', top: '2px', left: isPlanOn ? '14px' : '2px', transition: 'left 0.15s' }} />
                </div>
              </div>
              <button onClick={handleOrder} style={s.sendBtn(selectedAgent.color, !prompt.trim())}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* RIGHT: EXECUTION */}
      <aside style={s.right}>
        <div style={s.tabs}>
          {['PLAN', 'DIFF VIEW', 'METRICS', 'HISTORY'].map(t => (
            <button key={t} onClick={() => setActiveTab(t.toLowerCase().replace(' ', ''))} style={s.tab(activeTab === t.toLowerCase().replace(' ', ''))}>{t}</button>
          ))}
        </div>
        <div style={s.panel}>
          {activeTab === 'plan' && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#52525b', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Implementation Strategy</div>
              <div style={s.planCard}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#3b82f6' }}>●</span> Phase 1: Context Analysis
                </div>
                <div style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: '1.5' }}>Scanning workspace for relevant symbols and dependencies. Mapping @developer intent to @architect specs.</div>
              </div>
              <div style={s.planCard}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#71717a' }}>○</span> Phase 2: Implementation
                </div>
                <div style={{ fontSize: '13px', color: '#52525b', lineHeight: '1.5' }}>Generating surgical diffs for core logic transformation. (Awaiting Phase 1 completion)</div>
              </div>
            </div>
          )}
          {activeTab === 'diffview' && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#52525b', marginBottom: '12px' }}>packages/core/engine.js</div>
              <div style={s.diffBox}>
                <div style={{ color: '#ef4444' }}>- const legacy = await oldModel.run(p);</div>
                <div style={{ color: '#10b981' }}>+ const response = await fleet.orchestrate(p);</div>
                <div style={{ color: '#10b981' }}>+ return response.map(verify);</div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button style={{ ...s.sendBtn('#10b981', false), width: 'auto', padding: '0 20px', fontSize: '13px', fontWeight: '600' }}>Accept Changes</button>
                <button style={{ ...s.sendBtn('#27272a', false), width: 'auto', padding: '0 20px', fontSize: '13px', fontWeight: '600', color: '#a1a1aa' }}>Discard</button>
              </div>
            </div>
          )}
          {activeTab === 'metrics' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { l: 'Efficiency', v: '94%', c: '#10b981' },
                { l: 'Latency', v: '1.2s', c: '#3b82f6' },
                { l: 'Success', v: '99.9%', c: '#8b5cf6' },
                { l: 'Tokens', v: '12.4k', c: '#f59e0b' },
              ].map(m => (
                <div key={m.l} style={{ background: '#18181b', padding: '16px', borderRadius: '10px', border: '1px solid #27272a' }}>
                  <div style={{ fontSize: '11px', color: '#52525b', marginBottom: '4px' }}>{m.l}</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: m.c }}>{m.v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
        @keyframes blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
