import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send, Mic, MicOff, ChevronDown, Check, X, Paperclip,
  Cpu, Palette, Code2, Search, TrendingUp, Server, DollarSign, Bot,
  Zap, BrainCircuit, Sparkles, Github, RotateCcw, Copy, CheckCheck,
  Square, Volume2, VolumeX, Loader2, User, Terminal, GitBranch
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS, SPECIALISTS, BUILD_MODES, getAgentById } from '../../lib/agents';
import { SKILLS, detectSkill, applySkill, getSkillById } from '../../lib/skills';
import { getAutoSelection } from '../../lib/routing';
import { checkAgentAvailability, cancelOrder } from '../../lib/daemon';
import { detectTeamTrigger, getTeamById, createTeamPlan, executeTeam, getSubAgentById } from '../../lib/teams';
import TeamExecutionCard from '../shared/TeamExecutionCard';
import InteractiveQuestions from './InteractiveQuestions';
import PreviewPanel from '../shared/PreviewPanel';
import GitPanel from '../git/GitPanel';
import { getDevServerUrl } from '../../lib/daemon';
import { trackUsage } from '../../lib/learning';
import { getMemoryContext } from '../../lib/memory';
import { useKokoroTTS } from '../../hooks/useKokoroTTS';

const STORAGE_KEY = 'soupz_chat_history';
const AGENT_KEY   = 'soupz_agent';
const MODE_KEY    = 'soupz_build_mode';
const ENABLED_AGENTS_KEY = 'soupz_enabled_agents';
const MODEL_TIER_KEY = 'soupz_model_tier';

const MODEL_TIERS = [
  { id: 'fast',      label: 'Fast',      desc: 'Faster responses, lighter models' },
  { id: 'balanced',  label: 'Balanced',  desc: 'Good speed and quality' },
  { id: 'premium',   label: 'Premium',   desc: 'Best quality, slower' },
];

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
        {p.lang && <div className="px-3 py-1.5 border-b border-border-subtle bg-bg-elevated/50 text-[10px] font-mono text-text-faint uppercase">{p.lang}</div>}
        <pre className="p-3 text-[12px] font-mono text-text-sec overflow-x-auto leading-relaxed">{p.content}</pre>
      </div>
    );
    const inline = p.content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((chunk, j) => {
      if (chunk.startsWith('`') && chunk.endsWith('`'))
        return <code key={j} className="font-mono text-accent text-[11px] bg-bg-elevated/50 px-1 rounded">{chunk.slice(1,-1)}</code>;
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

export default function SimpleMode({ daemon, compact = false, filePaths = [] }) {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [agentId, setAgentId] = useState(() => localStorage.getItem(AGENT_KEY) || 'auto');
  const [buildMode, setBuildMode] = useState(() => localStorage.getItem(MODE_KEY) || 'quick');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [tierOpen, setTierOpen] = useState(false);
  const [modelTier, setModelTier] = useState(() => localStorage.getItem(MODEL_TIER_KEY) || 'balanced');
  const [activeSkill, setActiveSkill] = useState(null);
  const [pendingTeamPlan, setPendingTeamPlan] = useState(null);
  const [teamCustomInstructions, setTeamCustomInstructions] = useState({});
  const [expandedInstructions, setExpandedInstructions] = useState({});
  const [enabledAgents, setEnabledAgents] = useState(() => {
    try {
      const stored = localStorage.getItem(ENABLED_AGENTS_KEY);
      return stored ? JSON.parse(stored) : CLI_AGENTS.map(a => a.id);
    } catch {
      return CLI_AGENTS.map(a => a.id);
    }
  });
  const normalizedFilePaths = useMemo(() => {
    if (!Array.isArray(filePaths)) return [];
    return Array.from(new Set(filePaths)).sort((a, b) => a.localeCompare(b));
  }, [filePaths]);
  
  // TTS
  const { speak, stop, speaking } = useKokoroTTS();
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  // STT (Speech-to-Text)
  const [isListening, setIsListening] = useState(false);
  const [speechSupport, setSpeechSupport] = useState(
    () => typeof window !== 'undefined' && !!(window.webkitSpeechRecognition || window.SpeechRecognition)
  );
  const [speechError, setSpeechError] = useState(null);
  const speechRecognitionRef = useRef(null);

  // Image upload
  const [attachedImages, setAttachedImages] = useState([]);
  const fileInputRef = useRef(null);
  const [mentionMatches, setMentionMatches] = useState([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionRangeRef = useRef(null);
  const [cursorVersion, setCursorVersion] = useState(0);

  const handleImageFile = async (file) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      console.error('Image too large (max 10MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setAttachedImages(prev => [...prev, { id: Date.now(), dataUrl, name: file.name }]);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageFile(file);
      }
    }
  };

  const handleFilePickerChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (id) => {
    setAttachedImages(prev => prev.filter(img => img.id !== id));
  };

  const insertMention = (path) => {
    if (!path) return;
    const textarea = textareaRef.current;
    const range = mentionRangeRef.current;
    const start = range ? range.start : (textarea?.selectionStart ?? input.length);
    const end = range ? range.end : (textarea?.selectionEnd ?? input.length);
    const before = input.slice(0, start);
    const after = input.slice(end);
    const insertion = `@${path} `;
    const nextValue = `${before}${insertion}${after}`;
    setInput(nextValue);
    setMentionOpen(false);
    setMentionMatches([]);
    setMentionIndex(0);
    mentionRangeRef.current = null;
    setTimeout(() => {
      if (textarea) {
        const cursor = before.length + insertion.length;
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      }
    }, 0);
  };

  // Initialize and manage speech recognition
  useEffect(() => {
    if (!speechSupport) return;

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setInput(prev => {
            const newInput = prev ? prev + ' ' + transcript : transcript;
            return newInput.trim();
          });
        } else {
          interimTranscript += transcript;
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'network') {
        setSpeechError('Speech recognition unavailable (network)');
      } else if (['not-allowed', 'service-not-allowed'].includes(event.error)) {
        setSpeechSupport(false);
        setSpeechError('Microphone access denied');
      } else {
        setSpeechError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    speechRecognitionRef.current = recognition;

    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
      }
    };
  }, [speechSupport]);

  const handleMicToggle = () => {
    if (!speechSupport || !speechRecognitionRef.current) return;

    if (isListening) {
      speechRecognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        speechRecognitionRef.current.start();
      } catch (e) {
        console.error('Failed to start speech recognition:', e);
        setIsListening(false);
      }
    }
  };

  const handleSpeechRetry = () => {
    setSpeechError(null);
    if (!speechSupport && (window.webkitSpeechRecognition || window.SpeechRecognition)) {
      setSpeechSupport(true);
    }
  };

  const handleDragOver = (e) => {
    if (e.dataTransfer?.types?.includes('text/plain')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e) => {
    const payload = e.dataTransfer?.getData('application/x-soupz-path') || e.dataTransfer?.getData('text/plain');
    if (payload) {
      e.preventDefault();
      insertMention(payload.trim());
    }
  };

  const derivedHtmlPreview = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i];
      if (msg.role !== 'ai' || !msg.content) continue;
      const block = msg.content.match(/```html\n([\s\S]*?)```/i);
      if (block && block[1]) return block[1].trim();
      if (msg.content.includes('<html') || msg.content.includes('<body')) {
        return msg.content;
      }
    }
    return null;
  }, [messages]);

  const previewHelperText = useMemo(() => {
    if (previewStatus === 'loading') return 'Checking the daemon for a running dev server...';
    if (previewStatus === 'ready' && previewUrl) return `Live preview → ${previewUrl}`;
    if (previewStatus === 'html' && derivedHtmlPreview) return 'Rendering the last HTML block from the agent output.';
    if (previewStatus === 'empty') return 'No preview yet. Ask an agent to build UI or start `npm run dev` locally.';
    if (previewStatus === 'error') return 'Unable to reach the dev server. Ensure it is running and paired.';
    return '';
  }, [previewStatus, previewUrl, derivedHtmlPreview]);

  const evaluatePreview = useCallback(async () => {
    try {
      const result = await getDevServerUrl();
      if (result?.url) {
        return { status: 'ready', url: result.url };
      }
      if (derivedHtmlPreview) {
        return { status: 'html', url: null };
      }
      return { status: 'empty', url: null };
    } catch (err) {
      console.warn('Preview check failed:', err);
      return { status: derivedHtmlPreview ? 'html' : 'error', url: null };
    }
  }, [derivedHtmlPreview]);

  const refreshPreview = useCallback(async () => {
    setPreviewStatus('loading');
    const next = await evaluatePreview();
    setPreviewUrl(next.url);
    setPreviewStatus(next.status);
  }, [evaluatePreview]);

  useEffect(() => {
    if (!previewOpen) return undefined;
    let ignore = false;
    (async () => {
      setPreviewStatus('loading');
      const next = await evaluatePreview();
      if (ignore) return;
      setPreviewUrl(next.url);
      setPreviewStatus(next.status);
    })();
    return () => { ignore = true; };
  }, [previewOpen, messages.length, evaluatePreview]);

  const filteredCLIAgents = useMemo(() => {
    return CLI_AGENTS.filter(a => enabledAgents.includes(a.id));
  }, [enabledAgents]);

  const allCommands = useMemo(() => {
    return [
      ...SKILLS.map(s => ({ ...s, type: 'skill' })),
      ...filteredCLIAgents.map(a => ({ id: a.id, name: a.name, description: a.description || 'CLI Agent', color: a.color, type: 'agent' })),
      ...SPECIALISTS.map(a => ({ id: a.id, name: a.name, description: a.desc || 'Specialist Agent', color: a.color, type: 'agent' })),
    ];
  }, [filteredCLIAgents]);

  const [slashCommandOpen, setSlashCommandOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewStatus, setPreviewStatus] = useState('idle');
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

  useEffect(() => {
    if (!textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const beforeCursor = input.slice(0, cursor);
    const mentionMatch = beforeCursor.match(/@([^\s@]*)$/);
    if (mentionMatch && normalizedFilePaths.length > 0) {
      const query = mentionMatch[1].toLowerCase();
      const matches = normalizedFilePaths
        .filter(path => path.toLowerCase().includes(query))
        .slice(0, 8);
      if (matches.length > 0) {
        mentionRangeRef.current = { start: mentionMatch.index, end: cursor };
        setMentionMatches(matches);
        setMentionIndex(0);
        setMentionOpen(true);
        return;
      }
    }
    mentionRangeRef.current = null;
    setMentionMatches([]);
    setMentionOpen(false);
  }, [input, normalizedFilePaths, cursorVersion]);

  async function handleCommandSelect(cmd) {
    if (cmd.type === 'skill') {
      setActiveSkill(cmd.id);
    } else if (cmd.type === 'agent') {
      setAgentId(cmd.id);
      localStorage.setItem(AGENT_KEY, cmd.id);
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
        const availMap = avail?.simple || avail;
        const { cliAgent, fallbackReason } = await getAutoSelection(text, availMap, true);
        effectiveAgentId = cliAgent;
        autoLabel = `Auto → ${getAgentById(cliAgent)?.name || cliAgent}${fallbackReason ? ` (${fallbackReason})` : ''}`;
      } catch {
        effectiveAgentId = 'gemini';
        autoLabel = 'Auto → Gemini (fallback)';
      }
    }

    // Check for team trigger — show plan preview instead of executing immediately
    const teamTrigger = detectTeamTrigger(text);
    if (teamTrigger && teamTrigger.confidence > 0 && daemon?.sendPrompt) {
      try {
        const avail = await checkAgentAvailability();
        const plan = createTeamPlan(teamTrigger.teamId, text, avail?.simple || avail);
        if (plan) {
          setTeamCustomInstructions({});
          setExpandedInstructions({});
          setPendingTeamPlan({ text, plan, effectiveAgentId });
          return;
        }
      } catch {
        // Fall through to single-agent flow if plan creation fails
      }
    }

    let appliedSkill = activeSkill;
    let promptForDaemon = text;
    if (appliedSkill) promptForDaemon = applySkill(appliedSkill, text);

    const userMsg = { id: Date.now(), role: 'user', content: text, images: attachedImages.length > 0 ? attachedImages : undefined };
    const aiMsg = { id: Date.now() + 1, role: 'ai', content: '', agentId: effectiveAgentId, autoLabel, streaming: true };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setIsStreaming(true);
    setCurrentOrderId(null);

    try {
      if (daemon?.sendPrompt) {
        // Get specialist parameters if a specialist is active
        const specialistId = activeSkill && SPECIALISTS.find(s => s.id === activeSkill) ? activeSkill : null;
        const specialist = specialistId ? SPECIALISTS.find(s => s.id === specialistId) : null;

        const requestPayload = {
          prompt: promptForDaemon,
          agentId: effectiveAgentId,
          buildMode,
          modelTier,
          images: attachedImages.length > 0 ? attachedImages.map(img => ({ dataUrl: img.dataUrl })) : undefined
        };

        if (specialist) {
          requestPayload.specialist = specialistId;
          if (typeof specialist.temperature === 'number') requestPayload.temperature = specialist.temperature;
          if (typeof specialist.maxTokens === 'number') requestPayload.maxTokens = specialist.maxTokens;
        }

        const orderId = await daemon.sendPrompt(requestPayload, chunk => {
          setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: m.content + chunk } : m));
        });
        setCurrentOrderId(orderId);
      }
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, content: `Error: ${err.message}` } : m));
    } finally {
      setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, streaming: false } : m));
      setIsStreaming(false);
      setCurrentOrderId(null);
      setActiveSkill(null);
      setAttachedImages([]);
    }
  }

  async function handleStop() {
    if (!currentOrderId) return;
    try {
      await cancelOrder(currentOrderId);
      setMessages(prev => prev.map(m => m.streaming ? { ...m, content: m.content + '\n\n[Cancelled by user]', streaming: false } : m));
      setIsStreaming(false);
      setCurrentOrderId(null);
    } catch (err) {
      console.error('Failed to cancel order:', err);
    }
  }

  function toggleAgent(agentIdToToggle) {
    setEnabledAgents(prev => {
      const next = prev.includes(agentIdToToggle)
        ? prev.filter(id => id !== agentIdToToggle)
        : [...prev, agentIdToToggle];
      localStorage.setItem(ENABLED_AGENTS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleAllAgents(enable) {
    const next = enable ? CLI_AGENTS.map(a => a.id) : [];
    setEnabledAgents(next);
    localStorage.setItem(ENABLED_AGENTS_KEY, JSON.stringify(next));
  }

  async function runPendingTeam() {
    if (!pendingTeamPlan || !daemon?.sendPrompt) return;
    const { text, plan, effectiveAgentId } = pendingTeamPlan;
    setPendingTeamPlan(null);

    // Apply any custom instructions to tasks
    const finalTasks = plan.tasks.map(task => {
      const custom = teamCustomInstructions[task.subAgentId];
      if (custom?.trim()) {
        return { ...task, prompt: task.prompt + `\n\nADDITIONAL INSTRUCTIONS: ${custom}` };
      }
      return task;
    });
    const finalPlan = { ...plan, tasks: finalTasks };

    const teamMsgId = Date.now() + 1;
    const teamMsg = { id: teamMsgId, role: 'ai', content: '', agentId: effectiveAgentId, autoLabel: `Team: ${plan.teamId}`, streaming: true, isTeam: true };
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text }, teamMsg]);
    setIsStreaming(true);

    try {
      await executeTeam(daemon.sendPrompt, finalPlan, (phase, subAgentId, chunk) => {
        let addition = '';
        if (phase === 'sub-agent-start') addition = `\n### ${subAgentId} started...\n`;
        else if (phase === 'sub-agent-chunk') addition = chunk || '';
        else if (phase === 'sub-agent-done') addition = `\n---\n`;
        else if (phase === 'coordinator-start') addition = '\n### Synthesizing results...\n';
        else if (phase === 'coordinator-chunk') addition = chunk || '';
        if (addition) {
          setMessages(prev => prev.map(m => m.id === teamMsgId ? { ...m, content: m.content + addition } : m));
        }
      });
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === teamMsgId ? { ...m, content: m.content + `\n\nTeam error: ${err.message}` } : m));
    } finally {
      setMessages(prev => prev.map(m => m.id === teamMsgId ? { ...m, streaming: false } : m));
      setIsStreaming(false);
      setActiveSkill(null);
    }
  }

  const currentAgent = getAgentById(agentId) || { name: 'Auto', color: 'var(--accent)' };
  const AgentIcon = getIcon(agentId);

  return (
    <div
      className="flex flex-col h-full bg-bg-surface overflow-hidden relative"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="h-10 px-2 sm:px-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2 shrink-0 bg-bg-surface z-20">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          {/* Agent Selector */}
          <div className="relative min-w-0">
            <button onClick={() => setAgentOpen(!agentOpen)} className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded hover:bg-text-pri/5 transition-colors min-w-0">
              <AgentIcon size={14} className="shrink-0" style={{ color: currentAgent.color }} />
              <span className="text-[11px] sm:text-[12px] font-bold text-text-pri uppercase tracking-tight truncate max-w-[80px] sm:max-w-none">{currentAgent.name}</span>
              <ChevronDown size={12} className={cn("text-text-faint transition-transform shrink-0", agentOpen && "rotate-180")} />
            </button>
            {agentOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setAgentOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-[70] bg-bg-surface border border-border-subtle rounded-lg shadow-soft overflow-hidden min-w-[220px] animate-fade-in">
                  {agentId === 'auto' && (
                    <div className="border-b border-border-subtle bg-bg-elevated/50">
                      <p className="px-3 py-1.5 text-[9px] font-bold text-text-faint uppercase tracking-widest">Filter Agents</p>
                      <div className="px-3 pb-2 space-y-1">
                        {CLI_AGENTS.map(a => (
                          <label
                            key={a.id}
                            className="flex items-center gap-2 cursor-pointer hover:bg-text-pri/5 rounded px-1 py-0.5 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              className={cn(
                                "w-3 h-3 rounded border flex items-center justify-center transition-all cursor-pointer",
                                enabledAgents.includes(a.id)
                                  ? "bg-accent border-accent"
                                  : "border-border-subtle bg-bg-base"
                              )}
                              onClick={() => toggleAgent(a.id)}
                            >
                              {enabledAgents.includes(a.id) && <Check size={10} className="text-bg-base" />}
                            </div>
                            <a.icon size={11} style={{ color: a.color }} />
                            <span className="text-[11px] text-text-sec">{a.name}</span>
                          </label>
                        ))}
                        <div className="flex gap-1 pt-1">
                          <button
                            onClick={() => toggleAllAgents(true)}
                            className="flex-1 text-[9px] text-accent hover:text-accent-hover px-1 py-0.5 rounded hover:bg-accent/10 transition-colors"
                          >
                            All
                          </button>
                          <button
                            onClick={() => toggleAllAgents(false)}
                            className="flex-1 text-[9px] text-text-faint hover:text-text-pri px-1 py-0.5 rounded hover:bg-text-pri/5 transition-colors"
                          >
                            None
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="py-1">
                    <p className="px-3 py-1 text-[9px] font-bold text-text-faint uppercase tracking-widest">Select Agent</p>
                    <button
                      onClick={() => { setAgentId('auto'); localStorage.setItem(AGENT_KEY, 'auto'); setAgentOpen(false); }}
                      className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors", agentId === 'auto' ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                    >
                      <Cpu size={12} className="text-accent" />
                      Auto Select
                    </button>
                    {filteredCLIAgents.map(a => (
                      <button
                        key={a.id}
                        onClick={() => { setAgentId(a.id); localStorage.setItem(AGENT_KEY, a.id); setAgentOpen(false); }}
                        className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors", agentId === a.id ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                      >
                        <a.icon size={12} style={{ color: a.color }} />
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-4 bg-border-subtle mx-0.5 sm:mx-1 hidden sm:block" />

          {/* Build Mode Selector */}
          <div className="relative">
            <button onClick={() => setModeOpen(!modeOpen)} className="flex items-center justify-between gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded hover:bg-text-pri/5 transition-colors min-w-[90px]">
              <span className="text-[10px] sm:text-[11px] font-medium text-text-sec uppercase tracking-wider">{buildMode}<span className="hidden sm:inline"> Build</span></span>
              <ChevronDown size={12} className={cn("text-text-faint transition-transform shrink-0", modeOpen && "rotate-180")} />
            </button>
            {modeOpen && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setModeOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-[70] bg-bg-surface border border-border-subtle rounded-lg shadow-soft py-1 min-w-[160px] animate-fade-in">
                  {BUILD_MODES.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setBuildMode(m.id); localStorage.setItem(MODE_KEY, m.id); setModeOpen(false); }}
                      className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors text-left", buildMode === m.id ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                    >
                      <div className="flex-1">
                        <div className="font-bold uppercase text-[10px] tracking-tight">{m.label || m.name}</div>
                        <div className="text-[9px] text-text-faint">{m.desc || m.description}</div>
                      </div>
                      {buildMode === m.id && <Check size={10} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="w-px h-4 bg-border-subtle mx-0.5 hidden sm:block" />

          {/* Model Tier Selector */}
          <div className="relative">
            <button onClick={() => setTierOpen(!tierOpen)} className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded hover:bg-text-pri/5 transition-colors">
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tight",
                modelTier === 'fast' && "bg-green-500/15 text-green-400",
                modelTier === 'balanced' && "bg-accent/15 text-accent",
                modelTier === 'premium' && "bg-amber-500/15 text-amber-400",
              )}>{modelTier}</span>
              <ChevronDown size={12} className={cn("text-text-faint transition-transform shrink-0", tierOpen && "rotate-180")} />
            </button>
            {tierOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setTierOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-[100] bg-bg-surface border border-border-subtle rounded-lg shadow-soft py-1 min-w-[150px] animate-fade-in">
                  {MODEL_TIERS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setModelTier(t.id); localStorage.setItem(MODEL_TIER_KEY, t.id); setTierOpen(false); }}
                      className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors text-left", modelTier === t.id ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                    >
                      <div className="flex-1">
                        <div className="font-bold uppercase text-[10px] tracking-tight">{t.label}</div>
                        <div className="text-[9px] text-text-faint">{t.desc}</div>
                      </div>
                      {modelTier === t.id && <Check size={10} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {!compact && (
            <button onClick={() => setPreviewOpen(!previewOpen)} className={cn("px-1.5 sm:px-2 py-1 rounded text-[10px] sm:text-[11px] font-medium transition-all flex items-center gap-1", previewOpen ? "bg-accent/20 text-accent border border-accent/30" : "text-text-faint hover:text-text-pri")}>
              <Terminal size={12} /> <span className="hidden sm:inline">Preview</span>
            </button>
          )}
          <button onClick={() => setMessages([])} className="p-1.5 text-text-faint hover:text-text-pri hover:bg-text-pri/5 rounded transition-all" title="Clear Chat">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Messages + Preview */}
      <div className={cn('flex-1 min-h-0 flex flex-col', previewOpen ? 'lg:flex-row lg:gap-3' : '')}>
        <div className={cn('flex-1 min-h-0 overflow-y-auto custom-scrollbar', previewOpen ? 'lg:pr-2' : '')}>
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
              <Message
                key={msg.id}
                msg={msg}
                getIcon={getIcon}
                onCopy={() => navigator.clipboard.writeText(msg.content)}
                onSpeak={() => {
                  if (speakingMsgId === msg.id && speaking) {
                    stop();
                    setSpeakingMsgId(null);
                  } else {
                    setSpeakingMsgId(msg.id);
                    speak(msg.content);
                  }
                }}
                isSpeaking={speakingMsgId === msg.id && speaking}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
        {previewOpen && (
          <div className="mt-3 lg:mt-0 lg:w-[360px] flex flex-col min-h-[240px]">
            <PreviewPanel
              previewUrl={previewUrl}
              previewHtml={derivedHtmlPreview}
              onRefresh={refreshPreview}
            />
            <p className="text-[10px] text-text-faint mt-2">
              {previewHelperText || 'Drop HTML or start a dev server to preview work without leaving chat.'}
            </p>
          </div>
        )}
      </div>

      {/* Team Plan Preview */}
      {pendingTeamPlan && (
        <div className="mx-4 mb-2 bg-bg-elevated border border-border-subtle rounded-lg overflow-hidden animate-fade-up">
          <div className="px-4 py-2.5 border-b border-border-subtle flex items-center justify-between bg-bg-elevated/50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[12px] font-bold text-text-pri uppercase tracking-wide">{pendingTeamPlan.plan.name}</span>
              <span className="text-[9px] font-mono text-text-faint bg-bg-base px-1.5 py-0.5 rounded uppercase">{pendingTeamPlan.plan.strategy}</span>
            </div>
            <button onClick={() => setPendingTeamPlan(null)} className="p-0.5 text-text-faint hover:text-text-pri transition-colors rounded">
              <X size={13} />
            </button>
          </div>
          <div className="p-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
            {pendingTeamPlan.plan.tasks.map(task => {
              const subAgent = getSubAgentById(task.subAgentId);
              const isExpanded = expandedInstructions[task.subAgentId];
              return (
                <div key={task.subAgentId} className="border border-border-subtle rounded p-2 space-y-1.5 bg-bg-base">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent/60" />
                      <span className="text-[11px] font-medium text-text-pri">{subAgent?.name || task.subAgentId}</span>
                      {subAgent?.description && (
                        <span className="text-[10px] text-text-faint">{subAgent.description}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedInstructions(prev => ({ ...prev, [task.subAgentId]: !prev[task.subAgentId] }))}
                      className="text-[9px] text-text-faint hover:text-accent transition-colors px-1.5 py-0.5 rounded border border-border-subtle hover:border-accent/40"
                    >
                      {isExpanded ? 'hide' : '+ instructions'}
                    </button>
                  </div>
                  {isExpanded && (
                    <textarea
                      value={teamCustomInstructions[task.subAgentId] || ''}
                      onChange={e => setTeamCustomInstructions(prev => ({ ...prev, [task.subAgentId]: e.target.value }))}
                      placeholder="Custom instructions for this agent (optional)..."
                      rows={2}
                      className="w-full bg-bg-elevated border border-border-subtle rounded px-2 py-1.5 text-[11px] font-ui text-text-sec placeholder:text-text-faint focus:outline-none focus:border-accent resize-none"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-border-subtle flex items-center gap-2">
            <button
              onClick={runPendingTeam}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-accent text-bg-base text-[11px] font-bold uppercase tracking-wide hover:bg-accent-hover transition-colors"
            >
              Run Team
            </button>
            <button
              onClick={() => setPendingTeamPlan(null)}
              className="px-3 py-1.5 rounded border border-border-subtle text-[11px] font-medium text-text-sec hover:text-text-pri hover:border-border-mid transition-colors"
            >
              Cancel
            </button>
            <span className="text-[9px] text-text-faint ml-auto">{pendingTeamPlan.plan.tasks.length} agents</span>
          </div>
        </div>
      )}

      {/* Slash Command Dropdown */}
      {slashCommandOpen && filteredCommands.length > 0 && (
        <div className="mx-4 mb-2 bg-bg-elevated border border-border-subtle rounded-md shadow-2xl overflow-hidden z-50 animate-fade-up">
          <div className="px-3 py-1.5 border-b border-border-subtle bg-bg-elevated/50 flex items-center justify-between">
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
                  i === slashIndex ? "bg-accent/10 text-text-pri border-accent" : "text-text-sec hover:bg-text-pri/5 border-transparent"
                )}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color || 'var(--accent)' }} />
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

      {mentionOpen && mentionMatches.length > 0 && (
        <div className="mx-4 mb-2 bg-bg-elevated border border-border-subtle rounded-md shadow-2xl overflow-hidden z-40 animate-fade-up">
          <div className="px-3 py-1.5 border-b border-border-subtle bg-bg-elevated/50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-faint uppercase tracking-widest">Files</span>
            <span className="text-[9px] text-text-faint">Type to filter · Enter to insert</span>
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {mentionMatches.map((path, idx) => (
              <button
                key={path}
                onClick={() => insertMention(path)}
                onMouseEnter={() => setMentionIndex(idx)}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-[11px] font-mono border-l-2 transition-colors',
                  idx === mentionIndex ? 'bg-accent/10 text-text-pri border-accent' : 'text-text-sec hover:bg-text-pri/5 border-transparent'
                )}
              >
                {path}
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
      <div className="p-3 sm:p-4 bg-bg-surface border-t border-border-subtle shrink-0">
        {/* Image thumbnails */}
        {attachedImages.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachedImages.map(img => (
              <div key={img.id} className="relative group">
                <img src={img.dataUrl} alt="attached" className="h-16 w-16 rounded border border-border-subtle object-cover bg-bg-elevated" />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-600 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
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
              if (mentionOpen && mentionMatches.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionMatches.length); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertMention(mentionMatches[mentionIndex]); return; }
                if (e.key === 'Escape') { setMentionOpen(false); mentionRangeRef.current = null; return; }
              }
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
            onKeyUp={() => setCursorVersion(v => v + 1)}
            onClick={() => setCursorVersion(v => v + 1)}
            onPaste={handlePaste}
            placeholder={compact ? "Ask anything..." : "What would you like to build? (type / for skills)"}
            rows={1}
            className="flex-1 bg-transparent text-[13px] font-ui text-text-pri placeholder:text-text-faint focus:outline-none resize-none max-h-48 py-1 min-w-0"
            style={{ lineHeight: '1.5' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded transition-all text-text-faint hover:text-text-pri hover:bg-text-pri/5"
            title="Attach image"
          >
            <Paperclip size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFilePickerChange}
            className="hidden"
          />
          {speechSupport && (
            <div className="relative">
              <button
                onClick={handleMicToggle}
                className={cn(
                  "p-1.5 rounded transition-all relative",
                  isListening
                    ? "text-red-500 hover:text-red-400 hover:bg-red-500/10"
                    : "text-text-faint hover:text-text-pri hover:bg-text-pri/5"
                )}
                title={isListening ? "Stop recording" : "Start recording"}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              {isListening && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
          )}
          {speechError && (
            <div className="text-[10px] text-red-400 px-2 flex items-center gap-1">
              <span>{speechError}</span>
              <button onClick={handleSpeechRetry} className="text-accent hover:underline">Retry</button>
            </div>
          )}
          {isStreaming ? (
            <button onClick={handleStop} className="p-1.5 rounded transition-all text-red-500 hover:text-red-400 hover:bg-red-500/10" title="Stop">
              <Square size={16} />
            </button>
          ) : (
            <button onClick={sendMessage} disabled={!input.trim()} className={cn("p-1.5 rounded transition-all", input.trim() ? "text-accent hover:text-accent-hover" : "text-text-faint/30")}>
              <Send size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ msg, getIcon, onCopy, onSpeak, isSpeaking }) {
  const isUser = msg.role === 'user';
  const Icon = msg.isTeam ? User : getIcon(msg.agentId || 'auto');
  const questionData = !isUser && !msg.streaming ? parseQuestionBlock(msg.content) : null;
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cn("group px-4 py-4 border-b border-border-subtle/30 transition-colors", !isUser && "bg-bg-elevated/60")}>
      <div className="flex gap-3">
        <div className={cn("w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5 border", isUser ? "bg-transparent border-border-subtle text-text-sec" : msg.isTeam ? "bg-purple-500/10 border-purple-500/20 text-purple-400" : "bg-accent/10 border-accent/20 text-accent")}>
          {isUser ? <User size={13} /> : <Icon size={14} />}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-text-pri uppercase tracking-wider">{isUser ? 'You' : msg.isTeam ? 'Team' : (msg.agentId || 'Soupz')}</span>
            {msg.autoLabel && <span className="text-[10px] text-text-faint font-mono">{msg.autoLabel}</span>}
          </div>
          {msg.images && msg.images.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {msg.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img.dataUrl}
                  alt="attached"
                  className="h-20 w-20 rounded border border-border-subtle object-cover bg-bg-elevated cursor-pointer hover:opacity-80 transition-opacity"
                  title="Click to expand"
                />
              ))}
            </div>
          )}
          <div className="text-[13px] text-text-sec leading-relaxed font-ui whitespace-pre-wrap break-words">
            {msg.isTeam
              ? <TeamExecutionCard content={msg.content} streaming={msg.streaming} />
              : msg.streaming && !msg.content
                ? <div className="flex items-center gap-1 py-1"><span className="thinking-dot" /><span className="thinking-dot animate-delay-100" /><span className="thinking-dot animate-delay-200" /></div>
                : renderMarkdown(msg.content)
            }
            {questionData && <InteractiveQuestions data={questionData} onAnswer={() => {}} />}
          </div>
          {/* Action bar for AI messages */}
          {!isUser && !msg.streaming && msg.content && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pt-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-text-faint hover:text-text-pri hover:bg-text-pri/5 transition-all"
              >
                {copied ? <CheckCheck size={11} className="text-success" /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={onSpeak}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all",
                  isSpeaking ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-pri hover:bg-text-pri/5"
                )}
              >
                {isSpeaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
                {isSpeaking ? 'Stop' : 'Speak'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
