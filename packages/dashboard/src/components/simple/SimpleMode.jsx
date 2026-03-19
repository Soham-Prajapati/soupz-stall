import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Mic, MicOff, ChevronDown, Check, X, Paperclip,
  Cpu, Palette, Code2, Search, TrendingUp, Server, DollarSign, Bot,
  Zap, BrainCircuit, Sparkles, Github, RotateCcw, Copy, CheckCheck,
  Square,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS, SPECIALISTS, BUILD_MODES, getAgentById } from '../../lib/agents';
import { getAutoSelection } from '../../lib/routing';
import { checkAgentAvailability } from '../../lib/daemon';
import OllamaStatus from '../shared/OllamaStatus';
import InteractiveQuestions, { parseSoupzQ, formatAnswers } from '../shared/InteractiveQuestions';
import LearnedAgents, { SuggestionDot } from '../shared/LearnedAgents';
import { trackUsage, getCustomAgents } from '../../lib/learning';

const STORAGE_KEY = 'soupz_chat_history';
const AGENT_KEY   = 'soupz_agent';
const MODE_KEY    = 'soupz_build_mode';

// Map specialist ids → Lucide icon overrides for display
const ICON_MAP = {
  auto: Cpu, designer: Palette, dev: Code2, researcher: Search,
  strategist: TrendingUp, devops: Server, finance: DollarSign,
  'ai-engineer': Bot, gemini: Sparkles, 'claude-code': BrainCircuit,
  copilot: Github, kiro: Zap,
};

function getIcon(id) {
  const entry = [...CLI_AGENTS, ...SPECIALISTS].find(a => a.id === id);
  return ICON_MAP[id] || entry?.icon || Bot;
}

// Minimal markdown: bold, inline code, code blocks
function renderMarkdown(text) {
  const parts = [];
  let i = 0;
  const src = text || '';

  // Split by code fences first
  const blockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    if (m.index > last) parts.push({ type: 'text', content: src.slice(last, m.index) });
    parts.push({ type: 'code', lang: m[1], content: m[2] });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ type: 'text', content: src.slice(last) });

  return parts.map((p, i) => {
    if (p.type === 'code') return (
      <div key={i} className="msg-code my-2 rounded-lg overflow-hidden">
        {p.lang && (
          <div className="msg-code-header">
            <span className="text-text-faint text-xs font-mono">{p.lang}</span>
          </div>
        )}
        <pre className="px-3 py-2.5 text-xs font-mono text-text-sec overflow-x-auto">{p.content}</pre>
      </div>
    );
    // inline: **bold**, `code`
    const inline = p.content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((chunk, j) => {
      if (chunk.startsWith('`') && chunk.endsWith('`'))
        return <code key={j} className="font-mono text-accent text-[11px] bg-bg-elevated px-1 py-0.5 rounded">{chunk.slice(1,-1)}</code>;
      if (chunk.startsWith('**') && chunk.endsWith('**'))
        return <strong key={j} className="font-semibold text-text-pri">{chunk.slice(2,-2)}</strong>;
      return chunk;
    });
    return <span key={i}>{inline}</span>;
  });
}

export default function SimpleMode({ daemon }) {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [input, setInput]       = useState('');
  const [agentId, setAgentId]   = useState(() => localStorage.getItem(AGENT_KEY) || 'auto');
  const [buildMode, setBuildMode] = useState(() => localStorage.getItem(MODE_KEY) || 'quick');
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [modeOpen, setModeOpen]   = useState(false);
  const [listening, setListening] = useState(false);
  const [fileChanges, setFileChanges] = useState([]);
  const [copiedId, setCopiedId]   = useState(null);
  const [useOllama, setUseOllama] = useState(
    () => localStorage.getItem('soupz_use_ollama') !== 'false',
  );

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const recogRef = useRef(null);
  // abortRef lets pauseStreaming() stop mid-flight chunk processing
  const abortRef = useRef(false);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  }, [messages]);

  useEffect(() => { localStorage.setItem(AGENT_KEY, agentId); }, [agentId]);
  useEffect(() => { localStorage.setItem(MODE_KEY, buildMode); }, [buildMode]);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for file changes from daemon
  useEffect(() => {
    if (!daemon?.onFileChange) return;
    return daemon.onFileChange(changes => setFileChanges(prev => [...prev, ...changes]));
  }, [daemon]);

  async function sendMessage(overrideText) {
    const text = (overrideText !== undefined ? overrideText : input).trim();
    if (!text || isStreaming) return;
    if (overrideText === undefined) setInput('');

    // Resolve the effective agent — run auto-selection when agentId is 'auto'
    let effectiveAgentId = agentId;
    let autoLabel = null;

    if (agentId === 'auto') {
      try {
        const avail = await checkAgentAvailability();
        const { cliAgent, specialist } = await getAutoSelection(text, avail, useOllama);
        effectiveAgentId = cliAgent;
        const agentEntry = getAgentById(cliAgent);
        autoLabel = `Auto → ${agentEntry?.name || cliAgent}`;
      } catch {
        effectiveAgentId = 'claude-code'; // safe fallback
        autoLabel = 'Auto → Claude Code';
      }
    }

    const userMsg = { id: Date.now(), role: 'user', content: text };
    const aiMsg   = {
      id: Date.now() + 1,
      role: 'ai',
      content: '',
      agentId: effectiveAgentId,
      autoLabel,
      streaming: true,
    };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);
    abortRef.current = false;

    try {
      if (daemon?.sendPrompt) {
        await daemon.sendPrompt({ prompt: text, agentId: effectiveAgentId, buildMode }, chunk => {
          if (abortRef.current) return;
          setMessages(prev => prev.map(m =>
            m.id === aiMsg.id ? { ...m, content: m.content + chunk } : m
          ));
        });
      } else {
        // No daemon — show helpful message
        await new Promise(r => setTimeout(r, 600));
        if (!abortRef.current) {
          setMessages(prev => prev.map(m =>
            m.id === aiMsg.id
              ? { ...m, content: `**Daemon not connected.**\n\nRun \`npx soupz\` on your machine and connect via the pairing code.` }
              : m
          ));
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiMsg.id ? { ...m, content: `Error: ${err.message}` } : m
      ));
    } finally {
      setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, streaming: false } : m));
      setIsStreaming(false);
      abortRef.current = false;
      // Track usage for learning system — runs after stream completes
      trackUsage(text, effectiveAgentId, 'auto', buildMode, 'sent');
    }
  }

  // Stop the current stream and let user type a new message to redirect
  function pauseStreaming() {
    abortRef.current = true;
    setIsStreaming(false);
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  }

  // Called when user submits answers to a SOUPZ_Q block
  function handleQuestionSubmit(questions, answers) {
    const formatted = formatAnswers(questions, answers);
    sendMessage(`Answers to questions:\n\n${formatted}`);
  }

  function startVoice() {
    const SpeechRecog = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecog) return;
    const r = new SpeechRecog();
    r.continuous = false;
    r.interimResults = false;
    r.onresult = e => {
      setInput(e.results[0][0].transcript);
      setListening(false);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recogRef.current = r;
    r.start();
    setListening(true);
  }

  function stopVoice() {
    recogRef.current?.stop();
    setListening(false);
  }

  function copyMessage(content, id) {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  const currentAgent = getAgentById(agentId) || { name: 'Auto', id: 'auto' };
  const AgentIcon = getIcon(agentId);

  return (
    <div className="flex flex-col h-full bg-bg-base">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-surface shrink-0 flex-wrap gap-y-2">
        {/* Agent selector */}
        <div className="relative">
          <button
            onClick={() => { setAgentOpen(v => !v); setModeOpen(false); }}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-elevated border border-border-subtle hover:border-border-mid text-text-pri text-xs font-ui transition-all"
          >
            <AgentIcon size={12} style={{ color: currentAgent.color }} />
            <span>{currentAgent.name}</span>
            <ChevronDown size={10} className="text-text-faint ml-0.5" />
            <SuggestionDot />
          </button>
          {agentOpen && (
            <AgentDropdown
              selected={agentId}
              onSelect={id => { setAgentId(id); setAgentOpen(false); }}
              onClose={() => setAgentOpen(false)}
            />
          )}
        </div>

        {/* Build mode */}
        <div className="relative">
          <button
            onClick={() => { setModeOpen(v => !v); setAgentOpen(false); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-bg-elevated border border-border-subtle hover:border-border-mid text-text-sec text-xs font-ui transition-all"
          >
            <span>{BUILD_MODES.find(m => m.id === buildMode)?.label || 'Quick Build'}</span>
            <ChevronDown size={10} className="text-text-faint ml-0.5" />
          </button>
          {modeOpen && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-bg-elevated border border-border-mid rounded-lg shadow-soft z-50 overflow-hidden">
              {BUILD_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setBuildMode(m.id); setModeOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs font-ui hover:bg-bg-overlay transition-colors',
                    buildMode === m.id ? 'text-accent' : 'text-text-sec hover:text-text-pri',
                  )}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-text-faint text-[11px]">{m.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Pause button — only visible while streaming */}
          {isStreaming && (
            <button
              onClick={pauseStreaming}
              title="Pause generation"
              className="flex items-center gap-1 px-2 py-1 rounded border border-transparent text-text-faint hover:text-warning hover:bg-warning/10 hover:border-warning/20 text-xs font-ui transition-all"
            >
              <Square size={11} />
              <span className="hidden sm:inline">Pause</span>
            </button>
          )}
          <OllamaStatus
            useOllama={useOllama}
            onToggle={v => {
              setUseOllama(v);
              localStorage.setItem('soupz_use_ollama', String(v));
            }}
          />
          <button
            onClick={clearHistory}
            title="Clear history"
            className="p-1.5 rounded text-text-faint hover:text-text-sec hover:bg-bg-elevated transition-all"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* File changes panel */}
      {fileChanges.length > 0 && (
        <div className="px-3 py-2 border-b border-border-subtle bg-bg-surface shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-text-faint text-xs font-ui">File changes</span>
            <span className="text-text-faint text-xs bg-bg-elevated px-1.5 py-0.5 rounded">{fileChanges.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {fileChanges.map((f, i) => (
              <div key={i} className="flex items-center gap-1 bg-bg-elevated border border-border-subtle rounded px-2 py-1">
                <span className="font-mono text-xs text-warning">{f.path}</span>
                <button
                  onClick={() => { daemon?.acceptChange?.(f); setFileChanges(p => p.filter((_, j) => j !== i)); }}
                  className="text-success hover:text-success/80 transition-colors"
                  title="Accept"
                >
                  <Check size={11} />
                </button>
                <button
                  onClick={() => { daemon?.rejectChange?.(f); setFileChanges(p => p.filter((_, j) => j !== i)); }}
                  className="text-danger hover:text-danger/80 transition-colors"
                  title="Reject"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 min-h-0 space-y-4">
        {messages.length === 0 && (
          <EmptyState agentName={currentAgent.name} AgentIcon={AgentIcon} agentColor={currentAgent.color} />
        )}
        {messages.map(msg => (
          <Message
            key={msg.id}
            msg={msg}
            onCopy={copyMessage}
            copied={copiedId === msg.id}
            getIcon={getIcon}
            autoLabel={msg.autoLabel}
            onQuestionSubmit={handleQuestionSubmit}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border-subtle bg-bg-surface px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="Ask anything, build something…"
              rows={1}
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2.5 text-sm font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors resize-none pr-2 max-h-40"
              style={{ lineHeight: '1.5' }}
            />
          </div>

          {/* Voice button */}
          {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
            <button
              onMouseDown={startVoice}
              onMouseUp={stopVoice}
              onTouchStart={startVoice}
              onTouchEnd={stopVoice}
              className={cn(
                'flex-shrink-0 p-2.5 rounded-lg border transition-all',
                listening
                  ? 'bg-danger/10 border-danger text-danger'
                  : 'bg-bg-elevated border-border-subtle text-text-faint hover:text-text-sec hover:border-border-mid',
              )}
              title="Hold to speak"
            >
              {listening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className={cn(
              'flex-shrink-0 p-2.5 rounded-lg transition-all',
              input.trim() && !isStreaming
                ? 'bg-accent hover:bg-accent-hover text-white'
                : 'bg-bg-elevated border border-border-subtle text-text-faint cursor-not-allowed',
            )}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-text-faint text-[11px] font-ui mt-1.5 ml-1">
          Enter to send · Shift+Enter for newline · Hold mic to speak
        </p>
      </div>
    </div>
  );
}

function Message({ msg, onCopy, copied, getIcon, autoLabel, onQuestionSubmit }) {
  const isUser = msg.role === 'user';
  const Icon = getIcon(msg.agentId || 'auto');

  if (isUser) return (
    <div className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-[70%] bg-accent/15 border border-accent/20 rounded-xl rounded-tr-sm px-3.5 py-2.5 text-text-pri text-sm font-ui leading-relaxed whitespace-pre-wrap">
        {msg.content}
      </div>
    </div>
  );

  // Detect [SOUPZ_Q]...[/SOUPZ_Q] in finished AI messages
  const parsed = !msg.streaming ? parseSoupzQ(msg.content) : null;

  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-md bg-bg-elevated border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={12} className="text-text-sec" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Agent header — show auto-routing label when applicable */}
        {(autoLabel || msg.autoLabel) && (
          <div className="mb-1 flex items-center gap-1">
            <span className="text-[10px] font-ui text-text-faint px-1.5 py-0.5 bg-bg-elevated border border-border-subtle rounded">
              {autoLabel || msg.autoLabel}
            </span>
          </div>
        )}
        <div className="bg-bg-surface border border-border-subtle rounded-xl rounded-tl-sm px-3.5 py-2.5 text-text-sec text-sm font-ui leading-relaxed">
          {msg.streaming && !msg.content ? (
            <div className="flex items-center gap-1 py-1">
              {[0,1,2].map(i => <span key={i} className="thinking-dot" style={i ? { animationDelay: `${i * 0.2}s` } : {}} />)}
            </div>
          ) : parsed ? (
            <>
              {parsed.before.trim() && (
                <div className="mb-2">{renderMarkdown(parsed.before)}</div>
              )}
              <InteractiveQuestions
                data={parsed.data}
                onSubmit={(answers) => onQuestionSubmit?.(parsed.data.questions, answers)}
              />
              {parsed.after.trim() && (
                <div className="mt-2">{renderMarkdown(parsed.after)}</div>
              )}
            </>
          ) : (
            <div>{renderMarkdown(msg.content)}</div>
          )}
        </div>
        {!msg.streaming && msg.content && (
          <button
            onClick={() => onCopy(msg.content, msg.id)}
            className="mt-1 ml-1 text-text-faint hover:text-text-sec transition-colors"
            title="Copy"
          >
            {copied ? <CheckCheck size={11} className="text-success" /> : <Copy size={11} />}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ agentName, AgentIcon, agentColor }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-48 text-center gap-3 py-8">
      <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-center">
        <AgentIcon size={20} style={{ color: agentColor }} />
      </div>
      <div>
        <p className="text-text-pri text-sm font-ui font-medium">{agentName} ready</p>
        <p className="text-text-faint text-xs mt-1">Send a message to start building</p>
      </div>
    </div>
  );
}

function AgentDropdown({ selected, onSelect, onClose }) {
  const [tab, setTab] = useState('cli');
  const [customAgents, setCustomAgents] = useState(() => getCustomAgents());

  useEffect(() => {
    function onClickOutside(e) {
      if (!e.target.closest('[data-agent-dropdown]')) onClose();
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [onClose]);

  // Refresh custom agents list when dropdown opens or storage changes
  useEffect(() => {
    setCustomAgents(getCustomAgents());
    function onStorage(e) {
      if (e.key === 'soupz_custom_agents') setCustomAgents(getCustomAgents());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <div
      data-agent-dropdown
      className="absolute top-full left-0 mt-1 w-72 bg-bg-elevated border border-border-mid rounded-xl shadow-soft z-50 overflow-hidden"
    >
      <div className="flex border-b border-border-subtle">
        {['cli', 'specialist'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-xs font-ui font-medium transition-colors',
              tab === t ? 'text-text-pri border-b-2 border-accent -mb-px' : 'text-text-faint hover:text-text-sec',
            )}
          >
            {t === 'cli' ? 'CLI Agents' : 'Specialists'}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-y-auto py-1">
        {tab === 'cli' ? (
          <>
            <AgentOption agent={{ id: 'auto', name: 'Auto', color: '#A855F7', description: 'AI picks best agent', icon: Cpu }} selected={selected} onSelect={onSelect} />
            {CLI_AGENTS.map(a => <AgentOption key={a.id} agent={a} selected={selected} onSelect={onSelect} />)}
            {/* Custom agents surfaced under CLI tab */}
            {customAgents.length > 0 && (
              <>
                <div className="mx-3 my-1 border-t border-border-subtle" />
                {customAgents.map(a => (
                  <AgentOption
                    key={a.id}
                    agent={{ ...a, description: a.description }}
                    selected={selected}
                    onSelect={onSelect}
                  />
                ))}
              </>
            )}
          </>
        ) : (
          SPECIALISTS.filter(s => s.id !== 'auto' && s.id !== 'orchestrator').map(a => (
            <AgentOption key={a.id} agent={{ ...a, description: a.desc }} selected={selected} onSelect={onSelect} />
          ))
        )}
      </div>
      {/* Learned agents section — frequently used, suggestions, my agents */}
      <LearnedAgents
        selectedId={selected}
        onSelect={id => { onSelect(id); onClose(); }}
      />
    </div>
  );
}

function AgentOption({ agent, selected, onSelect }) {
  const Icon = getIcon(agent.id) || agent.icon || Bot;
  return (
    <button
      onClick={() => onSelect(agent.id)}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-bg-overlay transition-colors',
        selected === agent.id ? 'bg-bg-overlay' : '',
      )}
    >
      <Icon size={14} style={{ color: agent.color }} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-ui font-medium text-text-pri">{agent.name}</div>
        <div className="text-[11px] text-text-faint truncate">{agent.description || agent.desc}</div>
      </div>
      {selected === agent.id && <Check size={11} className="text-accent shrink-0" />}
    </button>
  );
}
