import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Square, Copy, CheckCheck, Volume2, VolumeX, User, Loader2, RotateCcw, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/cn';
import { CLI_AGENTS, SPECIALISTS, BUILD_MODES, getAgentById } from '../../lib/agents';
import { getAutoSelection } from '../../lib/routing';
import { checkAgentAvailability, cancelOrder, getDevServerUrl } from '../../lib/daemon';
import { useKokoroTTS } from '../../hooks/useKokoroTTS';

const STORAGE_KEY = 'soupz_builder_history';
const AGENT_KEY = 'soupz_builder_agent';

function getIcon(id) {
  const entry = [...CLI_AGENTS, ...SPECIALISTS].find(a => a.id === id);
  return entry?.icon || null;
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

const BUILD_MODE_KEY = 'soupz_builder_mode';

export default function BuilderMode({ daemon }) {
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [agentId, setAgentId] = useState(() => localStorage.getItem(AGENT_KEY) || 'auto');
  const [buildMode, setBuildMode] = useState(() => localStorage.getItem(BUILD_MODE_KEY) || 'quick');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [devServerUrl, setDevServerUrl] = useState(null);
  const [devServerChecked, setDevServerChecked] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const { speak, stop, speaking } = useKokoroTTS();
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Handle mobile resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check for dev server on mount and when messages change
  useEffect(() => {
    async function checkDevServer() {
      try {
        const result = await getDevServerUrl();
        setDevServerUrl(result?.url || null);
        setDevServerChecked(true);
      } catch {
        setDevServerUrl(null);
        setDevServerChecked(true);
      }
    }
    if (messages.length > 0 && !devServerChecked) {
      checkDevServer();
    }
  }, [messages.length, devServerChecked]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    const aiMsg = { id: Date.now() + 1, role: 'ai', content: '', agentId: effectiveAgentId, autoLabel, streaming: true };
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text }, aiMsg]);
    setIsStreaming(true);
    setCurrentOrderId(null);

    // Check dev server on first message
    if (messages.length === 0) {
      try {
        const result = await getDevServerUrl();
        setDevServerUrl(result?.url || null);
      } catch {}
    }

    try {
      if (daemon?.sendPrompt) {
        const orderId = await daemon.sendPrompt({ prompt: text, agentId: effectiveAgentId, buildMode }, chunk => {
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

  const hasMessages = messages.length > 0;
  const currentAgent = getAgentById(agentId) || { name: 'Auto', color: '#6366F1' };

  // Phase 1: No messages — centered input
  if (!hasMessages) {
    return (
      <div className="flex-1 flex flex-col bg-bg-surface overflow-hidden">
        {/* Header with controls */}
        <div className="h-10 px-4 border-b border-border-subtle flex items-center gap-3 shrink-0 bg-bg-surface">
          {/* Agent Selector */}
          <div className="relative">
            <button onClick={() => setAgentOpen(!agentOpen)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors">
              <span className="text-[12px] font-bold text-text-pri uppercase tracking-tight">{currentAgent.name}</span>
              <ChevronDown size={12} className={cn("text-text-faint transition-transform", agentOpen && "rotate-180")} />
            </button>
            {agentOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAgentOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-40 bg-bg-surface border border-border-subtle rounded-lg shadow-soft py-1 min-w-[140px] animate-fade-in">
                  <button
                    onClick={() => { setAgentId('auto'); localStorage.setItem(AGENT_KEY, 'auto'); setAgentOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors text-left", agentId === 'auto' ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                  >
                    Auto
                  </button>
                  {CLI_AGENTS.map(a => (
                    <button
                      key={a.id}
                      onClick={() => { setAgentId(a.id); localStorage.setItem(AGENT_KEY, a.id); setAgentOpen(false); }}
                      className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors text-left", agentId === a.id ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="w-px h-4 bg-border-subtle" />

          {/* Build Mode Selector */}
          <div className="relative">
            <button onClick={() => setModeOpen(!modeOpen)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors">
              <span className="text-[11px] font-medium text-text-sec uppercase tracking-wider">{buildMode} Build</span>
              <ChevronDown size={12} className={cn("text-text-faint transition-transform", modeOpen && "rotate-180")} />
            </button>
            {modeOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setModeOpen(false)} />
                <div className="absolute left-0 top-full mt-1 z-40 bg-bg-surface border border-border-subtle rounded-lg shadow-soft py-1 min-w-[140px] animate-fade-in">
                  {BUILD_MODES.map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setBuildMode(m.id); localStorage.setItem(BUILD_MODE_KEY, m.id); setModeOpen(false); }}
                      className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors text-left", buildMode === m.id ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                    >
                      <div className="flex-1">
                        <div className="font-bold uppercase text-[10px] tracking-tight">{m.name}</div>
                        <div className="text-[9px] text-text-faint">{m.description}</div>
                      </div>
                      {buildMode === m.id && <Check size={10} className="text-accent" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Centered input */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg-surface">
          <div className="w-full max-w-3xl space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-text-pri tracking-tight">What would you like to build?</h1>
              <p className="text-base text-text-sec max-w-2xl mx-auto">
                Describe your project and the agents will build it for you. Watch the live preview as your idea comes to life.
              </p>
            </div>

            <div className="flex flex-col gap-3 items-stretch max-w-2xl mx-auto">
            <div className="flex items-end gap-2 bg-bg-elevated border border-border-subtle rounded-lg px-4 py-3 focus-within:border-accent transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="E.g., A todo app with dark mode, user authentication, and a clean UI"
                rows={3}
                className="flex-1 bg-transparent text-[15px] font-ui text-text-pri placeholder:text-text-faint focus:outline-none resize-none max-h-48 py-1 min-w-0"
                style={{ lineHeight: '1.6' }}
              />
              {isStreaming ? (
                <button onClick={handleStop} className="p-2 rounded transition-all text-red-500 hover:text-red-400 hover:bg-red-500/10 shrink-0" title="Stop">
                  <Square size={18} />
                </button>
              ) : (
                <button onClick={sendMessage} disabled={!input.trim()} className={cn("p-2 rounded transition-all shrink-0", input.trim() ? "text-accent hover:text-accent-hover" : "text-text-faint/30")}>
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  }

  // Phase 2: Split layout with chat and preview
  return (
    <motion.div
      initial={false}
      className="flex-1 flex flex-col h-full bg-bg-surface overflow-hidden"
    >
      {/* Header */}
      <div className="h-10 px-4 border-b border-border-subtle flex items-center gap-3 shrink-0 bg-bg-surface z-20">
        {/* Agent Selector */}
        <div className="relative">
          <button onClick={() => setAgentOpen(!agentOpen)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors">
            <span className="text-[12px] font-bold text-text-pri uppercase tracking-tight">{currentAgent.name}</span>
            <ChevronDown size={12} className={cn("text-text-faint transition-transform", agentOpen && "rotate-180")} />
          </button>
          {agentOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAgentOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-40 bg-bg-surface border border-border-subtle rounded-lg shadow-soft py-1 min-w-[140px] animate-fade-in">
                <button
                  onClick={() => { setAgentId('auto'); localStorage.setItem(AGENT_KEY, 'auto'); setAgentOpen(false); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors text-left", agentId === 'auto' ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                >
                  Auto
                </button>
                {CLI_AGENTS.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { setAgentId(a.id); localStorage.setItem(AGENT_KEY, a.id); setAgentOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors text-left", agentId === a.id ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="w-px h-4 bg-border-subtle" />

        {/* Build Mode Selector */}
        <div className="relative">
          <button onClick={() => setModeOpen(!modeOpen)} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors">
            <span className="text-[11px] font-medium text-text-sec uppercase tracking-wider">{buildMode} Build</span>
            <ChevronDown size={12} className={cn("text-text-faint transition-transform", modeOpen && "rotate-180")} />
          </button>
          {modeOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setModeOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-40 bg-bg-surface border border-border-subtle rounded-lg shadow-soft py-1 min-w-[140px] animate-fade-in">
                {BUILD_MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setBuildMode(m.id); localStorage.setItem(BUILD_MODE_KEY, m.id); setModeOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-ui transition-colors text-left", buildMode === m.id ? "text-accent bg-accent/5" : "text-text-sec hover:text-text-pri hover:bg-bg-elevated")}
                  >
                    <div className="flex-1">
                      <div className="font-bold uppercase text-[10px] tracking-tight">{m.name}</div>
                      <div className="text-[9px] text-text-faint">{m.description}</div>
                    </div>
                    {buildMode === m.id && <Check size={10} className="text-accent" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {isMobile && (
          <button
            onClick={() => setPreviewOpen(!previewOpen)}
            className={cn("ml-auto px-2 py-1 rounded text-[11px] font-medium transition-all", previewOpen ? "bg-accent/20 text-accent border border-accent/30" : "text-text-faint hover:text-text-pri")}
          >
            {previewOpen ? 'Hide Preview' : 'Show Preview'}
          </button>
        )}
      </div>

      {/* Split container */}
      <div className={cn("flex-1 gap-4 p-4 min-h-0 overflow-hidden", isMobile ? "flex flex-col" : "flex")}>
        {/* Left: Chat Panel */}
        <motion.div
          layout
          className={cn("flex flex-col bg-bg-elevated rounded-lg border border-border-subtle overflow-hidden", isMobile ? "w-full" : "flex-0 w-[35%]")}
        >
          {/* Chat header */}
          <div className="h-11 px-4 border-b border-border-subtle flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-text-pri uppercase tracking-wider">Chat</span>
            <button onClick={() => setMessages([])} className="p-1 text-text-faint hover:text-text-pri hover:bg-white/5 rounded transition-all" title="Clear chat">
              <RotateCcw size={12} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {messages.map(msg => (
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
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="p-3 border-t border-border-subtle shrink-0">
            <div className="flex items-end gap-2 bg-bg-base border border-border-subtle rounded px-3 py-2 focus-within:border-accent transition-colors">
              <textarea
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Describe changes..."
                rows={1}
                className="flex-1 bg-transparent text-[12px] font-ui text-text-pri placeholder:text-text-faint focus:outline-none resize-none max-h-24 py-1 min-w-0"
                style={{ lineHeight: '1.5' }}
              />
              {isStreaming ? (
                <button onClick={handleStop} className="p-1.5 rounded transition-all text-red-500 hover:text-red-400 hover:bg-red-500/10 shrink-0" title="Stop">
                  <Square size={14} />
                </button>
              ) : (
                <button onClick={sendMessage} disabled={!input.trim()} className={cn("p-1.5 rounded transition-all shrink-0", input.trim() ? "text-accent hover:text-accent-hover" : "text-text-faint/30")}>
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right: Preview Panel */}
        <AnimatePresence>
          {!isMobile || previewOpen ? (
            <motion.div
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("flex flex-col bg-bg-elevated rounded-lg border border-border-subtle overflow-hidden", isMobile ? "w-full mt-4 h-64" : "flex-1 min-w-0")}
            >
              <div className="h-11 px-4 border-b border-border-subtle flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-text-pri uppercase tracking-wider">Preview</span>
              </div>

              {devServerUrl ? (
                <iframe
                  key={devServerUrl}
                  src={devServerUrl}
                  className="flex-1 border-none w-full h-full bg-white"
                  title="Live Preview"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-8">
                  <div className="space-y-4">
                    {!devServerChecked ? (
                      <>
                        <Loader2 size={32} className="text-text-faint/30 mx-auto animate-spin" />
                        <p className="text-sm text-text-faint">Waiting for dev server...</p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 mx-auto rounded-lg bg-border-subtle/20 flex items-center justify-center">
                          <span className="text-2xl text-text-faint/30">→</span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-text-pri">Start a dev server to see live preview</p>
                          <p className="text-xs text-text-faint/60 max-w-xs mx-auto">
                            Run a dev server in the terminal (e.g., <code className="font-mono text-accent/80">npm run dev</code>)
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Message({ msg, getIcon, onCopy, onSpeak, isSpeaking }) {
  const isUser = msg.role === 'user';
  const Icon = getIcon(msg.agentId || 'auto');
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className={cn("group px-3 py-3 border-b border-border-subtle/30 transition-colors", !isUser && "bg-white/[0.02]")}>
      <div className="flex gap-2">
        <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border text-xs", isUser ? "bg-transparent border-border-subtle text-text-sec" : "bg-accent/10 border-accent/20 text-accent")}>
          {isUser ? <User size={11} /> : Icon ? <Icon size={12} /> : null}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-text-pri uppercase tracking-wider">{isUser ? 'You' : (msg.agentId || 'Agent')}</span>
            {msg.autoLabel && <span className="text-[9px] text-text-faint font-mono">{msg.autoLabel}</span>}
          </div>
          <div className="text-[12px] text-text-sec leading-relaxed font-ui whitespace-pre-wrap break-words">
            {msg.streaming && !msg.content ? <div className="flex items-center gap-1 py-1"><span className="thinking-dot" /><span className="thinking-dot animate-delay-100" /><span className="thinking-dot animate-delay-200" /></div> : renderMarkdown(msg.content)}
          </div>
          {/* Action bar */}
          {!isUser && !msg.streaming && msg.content && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pt-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] text-text-faint hover:text-text-pri hover:bg-white/5 transition-all"
              >
                {copied ? <CheckCheck size={9} className="text-success" /> : <Copy size={9} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={onSpeak}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-all",
                  isSpeaking ? "text-accent bg-accent/10" : "text-text-faint hover:text-text-pri hover:bg-white/5"
                )}
              >
                {isSpeaking ? <VolumeX size={9} /> : <Volume2 size={9} />}
                {isSpeaking ? 'Stop' : 'Speak'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
