import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send, Mic, MicOff, ChevronDown, Check, X, Paperclip,
  Cpu, Palette, Code2, Search, TrendingUp, Server, DollarSign, Bot,
  Zap, BrainCircuit, Sparkles, Github, RotateCcw, Copy, CheckCheck,
  Square, Volume2, VolumeX, Loader2, User, Terminal
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS, SPECIALISTS, BUILD_MODES, getAgentById } from '../../lib/agents';
import { SKILLS, detectSkill, applySkill, getSkillById } from '../../lib/skills';
import { getAutoSelection } from '../../lib/routing';
import { checkAgentAvailability } from '../../lib/daemon';
import { detectTeamTrigger, getTeamById } from '../../lib/teams';
import InteractiveQuestions from './InteractiveQuestions';
import PreviewPanel from '../shared/PreviewPanel';
import { getDevServerUrl } from '../../lib/daemon';
import { trackUsage } from '../../lib/learning';
import { getMemoryContext } from '../../lib/memory';
import { useKokoroTTS } from '../../hooks/useKokoroTTS';

const STORAGE_KEY = 'soupz_chat_history';
const AGENT_KEY   = 'soupz_agent';
const MODE_KEY    = 'soupz_build_mode';

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

function renderMarkdown(text) {
  const parts = [];
  let last = 0;
  const src = text || '';
  const blockRe = /```(\w*)\n?([\s\S]*?)```/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    if (m.index > last) parts.push({ type: 'text', content: src.slice(last, m.index) });
    parts.push({ type: 'code', lang: m[1], content: m[2] });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ type: 'text', content: src.slice(last) });

  return parts.map((p, i) => {
    if (p.type === 'code') return (
      <div key={i} className="my-3 rounded-md overflow-hidden border border-border-subtle bg-bg-base">
        {p.lang && <div className="px-3 py-1.5 border-b border-border-subtle bg-white/5 text-[10px] font-mono text-text-faint uppercase">{p.lang}</div>}
        <pre className="p-3 text-[12px] font-mono text-text-sec overflow-x-auto leading-relaxed">{p.content}</pre>
      </div>
    );
    const inline = p.content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((chunk, j) => {
      if (chunk.startsWith('`') && chunk.endsWith('`'))
        return <code key={j} className="font-mono text-accent text-[11px] bg-white/5 px-1 rounded">{chunk.slice(1,-1)}</code>;
      if (chunk.startsWith('**') && chunk.endsWith('**'))
        return <strong key={j} className="font-bold text-text-pri">{chunk.slice(2,-2)}</strong>;
      return chunk;
    });
    return <span key={i}>{inline}</span>;
  });
}

function parseQuestionBlock(content) {
  const match = content.match(/\[SOUPZ_Q\]([\s\S]*?)\[\/SOUPZ_Q\]/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export default function SimpleMode({ daemon, compact = false }) {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [agentId, setAgentId] = useState(() => localStorage.getItem(AGENT_KEY) || 'auto');
  const [buildMode, setBuildMode] = useState(() => localStorage.getItem(MODE_KEY) || 'quick');
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [activeSkill, setActiveSkill] = useState(null);
  const allCommands = useMemo(() => {
    return [
      ...SKILLS.map(s => ({ ...s, type: 'skill' })),
      ...CLI_AGENTS.map(a => ({ id: a.id, name: a.name, description: a.description || 'CLI Agent', color: a.color, type: 'agent' })),
      ...SPECIALISTS.map(a => ({ id: a.id, name: a.name, description: a.desc || 'Specialist Agent', color: a.color, type: 'agent' })),
    ];
  }, []);

  const [slashCommandOpen, setSlashCommandOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(allCommands);
  const [slashIndex, setSlashIndex] = useState(0);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (input.startsWith('/')) {
      const q = input.slice(1).toLowerCase();
      const filtered = allCommands.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.id.toLowerCase().includes(q) || 
        c.description.toLowerCase().includes(q)
      );
      setFilteredCommands(filtered);
      setSlashCommandOpen(true);
      setSlashIndex(0);
    } else {
      setSlashCommandOpen(false);
    }
  }, [input, allCommands]);

  async function handleCommandSelect(cmd) {
    if (cmd.type === 'skill') {
      setActiveSkill(cmd.id);
    } else if (cmd.type === 'agent') {
      setAgentId(cmd.id);
    }
    setInput('');
    setSlashCommandOpen(false);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    
    let effectiveAgentId = agentId;
    let autoLabel = null;

    if (agentId === 'auto') {
      try {
        const avail = await checkAgentAvailability();
        const { cliAgent, fallbackReason } = await getAutoSelection(text, avail, true);
        effectiveAgentId = cliAgent;
        autoLabel = `Auto → ${getAgentById(cliAgent)?.name || cliAgent}${fallbackReason ? ` (${fallbackReason})` : ''}`;
      } catch {
        effectiveAgentId = 'gemini';
        autoLabel = 'Auto → Gemini (fallback)';
      }
    }

    let appliedSkill = activeSkill;
    let promptForDaemon = text;
    if (appliedSkill) promptForDaemon = applySkill(appliedSkill, text);

    const aiMsg = { id: Date.now() + 1, role: 'ai', content: '', agentId: effectiveAgentId, autoLabel, streaming: true };
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text }, aiMsg]);
    setIsStreaming(true);

    try {
      if (daemon?.sendPrompt) {
        await daemon.sendPrompt({ prompt: promptForDaemon, agentId: effectiveAgentId, buildMode }, chunk => {
          setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: m.content + chunk } : m));
        });
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: `Error: ${err.message}` } : m));
    } finally {
      setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, streaming: false } : m));
      setIsStreaming(false);
      setActiveSkill(null);
    }
  }

  const currentAgent = getAgentById(agentId) || { name: 'Auto', color: '#6366F1' };
  const AgentIcon = getIcon(agentId);

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      {/* Header */}
      <div className="h-10 px-4 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-surface">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setAgentOpen(!agentOpen)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors">
              <AgentIcon size={14} style={{ color: currentAgent.color }} />
              <span className="text-[12px] font-bold text-text-pri">{currentAgent.name}</span>
              <ChevronDown size={12} className="text-text-faint" />
            </button>
          </div>
          <div className="w-px h-4 bg-border-subtle mx-1" />
          <button onClick={() => setModeOpen(!modeOpen)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors">
            <span className="text-[11px] font-medium text-text-sec uppercase tracking-wider">{buildMode} Build</span>
            <ChevronDown size={12} className="text-text-faint" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {!compact && (
            <button onClick={() => setPreviewOpen(!previewOpen)} className={cn("px-2 py-1 rounded text-[11px] font-medium transition-all", previewOpen ? "bg-accent/20 text-accent border border-accent/30" : "text-text-faint hover:text-text-pri")}>
              Preview
            </button>
          )}
          <button onClick={() => setMessages([])} className="p-1.5 text-text-faint hover:text-text-pri hover:bg-white/5 rounded transition-all">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
              <AgentIcon size={24} style={{ color: currentAgent.color }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-pri uppercase tracking-widest">What would you like to build?</h3>
              <p className="text-xs text-text-faint mt-1 max-w-xs mx-auto">Describe your task and the agent will help you execute it.</p>
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <Message key={msg.id} msg={msg} getIcon={getIcon} onCopy={() => {}} onSpeak={() => {}} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Slash Command Dropdown */}
      {slashCommandOpen && filteredCommands.length > 0 && (
        <div className="mx-4 mb-2 bg-bg-elevated border border-border-subtle rounded-md shadow-2xl overflow-hidden z-50 animate-fade-up">
          <div className="px-3 py-1.5 border-b border-border-subtle bg-white/5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-faint uppercase tracking-widest">Commands & Agents</span>
            <span className="text-[9px] text-text-faint">↑↓ to navigate · Enter to select</span>
          </div>
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {filteredCommands.map((c, i) => (
              <button
                key={`${c.type}-${c.id}`}
                onClick={() => handleCommandSelect(c)}
                onMouseEnter={() => setSlashIndex(i)}
                className={cn(
                  "w-full px-3 py-2 flex items-center gap-3 text-left transition-colors border-l-2",
                  i === slashIndex ? "bg-accent/10 text-text-pri border-accent" : "text-text-sec hover:bg-white/5 border-transparent"
                )}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color || '#8B5CF6' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold font-ui flex items-center gap-2">
                    /{c.id}
                    <span className={cn(
                      "text-[8px] px-1 rounded uppercase tracking-tighter",
                      c.type === 'skill' ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                    )}>
                      {c.type}
                    </span>
                  </div>
                  <div className="text-[10px] text-text-faint truncate">{c.description}</div>
                </div>
                {i === slashIndex && <span className="text-[9px] text-accent font-mono border border-accent/30 px-1 rounded">ENTER</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Skill Indicator */}
      {activeSkill && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-2 py-1 bg-accent/10 border border-accent/20 rounded text-accent text-[11px] font-medium w-fit">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Active: /{activeSkill}
          <button onClick={() => setActiveSkill(null)} className="hover:text-text-pri ml-1"><X size={10} /></button>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 bg-bg-surface border-t border-border-subtle shrink-0">
        <div className="flex items-end gap-2 bg-bg-elevated border border-border-subtle rounded px-3 py-2 focus-within:border-accent transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
            }}
            onKeyDown={e => {
              if (slashCommandOpen && filteredCommands.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIndex(i => (i + 1) % filteredCommands.length); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIndex(i => (i - 1 + filteredCommands.length) % filteredCommands.length); }
                else if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  const cmd = filteredCommands[slashIndex];
                  handleCommandSelect(cmd);
                }
                else if (e.key === 'Escape') { setSlashCommandOpen(false); }
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={compact ? "Ask anything..." : "What would you like to build? (type / for skills)"}
            rows={1}
            className="flex-1 bg-transparent text-[13px] font-ui text-text-pri placeholder:text-text-faint focus:outline-none resize-none max-h-48 py-1 min-w-0"
            style={{ lineHeight: '1.5' }}
          />
          <button onClick={sendMessage} disabled={!input.trim() || isStreaming} className={cn("p-1.5 rounded transition-all", input.trim() && !isStreaming ? "text-accent hover:text-accent-hover" : "text-text-faint/30")}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Message({ msg, getIcon, onCopy, onSpeak }) {
  const isUser = msg.role === 'user';
  const Icon = getIcon(msg.agentId || 'auto');
  const questionData = !isUser && !msg.streaming ? parseQuestionBlock(msg.content) : null;

  return (
    <div className={cn("group px-4 py-4 border-b border-border-subtle/30 transition-colors", !isUser && "bg-white/[0.02]")}>
      <div className="flex gap-3">
        <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 border", isUser ? "bg-transparent border-border-subtle text-text-sec" : "bg-accent/10 border-accent/20 text-accent")}>
          {isUser ? <User size={13} /> : <Icon size={14} />}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-text-pri uppercase tracking-wider">{isUser ? 'You' : (msg.agentId || 'Soupz')}</span>
            {msg.autoLabel && <span className="text-[10px] text-text-faint font-mono">{msg.autoLabel}</span>}
          </div>
          <div className="text-[13px] text-[#CCCCCC] leading-relaxed font-ui whitespace-pre-wrap break-words">
            {msg.streaming && !msg.content ? <div className="flex items-center gap-1 py-1"><span className="thinking-dot" /><span className="thinking-dot animate-delay-100" /><span className="thinking-dot animate-delay-200" /></div> : renderMarkdown(msg.content)}
            {questionData && <InteractiveQuestions data={questionData} onAnswer={() => {}} />}
          </div>
        </div>
      </div>
    </div>
  );
}
