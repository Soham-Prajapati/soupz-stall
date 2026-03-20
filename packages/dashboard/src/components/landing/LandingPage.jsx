import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Smartphone, Zap, Wifi, Terminal, Bot, Lock,
  Copy, Check, Github, ArrowRight, ChevronRight,
  Star, Mic, Globe, Code2, Layers, Monitor,
  Cpu, BrainCircuit, Sparkles, ArrowUpRight,
} from 'lucide-react';
import { CLI_AGENTS } from '../../lib/agents';
import { cn } from '../../lib/cn';

/* ═══════════════════════════════════════════════════════════════════
   STYLES — injected once
   ═══════════════════════════════════════════════════════════════════ */
const STYLES = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}
@keyframes pulseRing {
  0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.25); }
  70%  { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
  100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
}
@keyframes slideAcross {
  from { transform: translateX(-100%); }
  to   { transform: translateX(0); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
}
@keyframes typing {
  from { width: 0; }
  to   { width: 100%; }
}
.fade-up { animation: fadeUp 0.5s cubic-bezier(0.2,0,0,1) both; }
.fade-up-1 { animation-delay: 0.05s; }
.fade-up-2 { animation-delay: 0.1s; }
.fade-up-3 { animation-delay: 0.15s; }
.fade-up-4 { animation-delay: 0.2s; }
.fade-up-5 { animation-delay: 0.25s; }
.fade-up-6 { animation-delay: 0.35s; }

.grid-bg {
  background-image:
    linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px);
  background-size: 64px 64px;
}
`;

/* ═══════════════════════════════════════════════════════════════════
   SCROLL REVEAL HOOK
   ═══════════════════════════════════════════════════════════════════ */
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useReveal(0.1);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.5s cubic-bezier(0.2,0,0,1) ${delay}ms, transform 0.5s cubic-bezier(0.2,0,0,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COPY BUTTON
   ═══════════════════════════════════════════════════════════════════ */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-all',
        copied ? 'text-success bg-success/10' : 'text-text-sec hover:text-text-pri bg-bg-elevated hover:bg-bg-overlay',
      )}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ANIMATED TERMINAL
   ═══════════════════════════════════════════════════════════════════ */
const TERM_LINES = [
  { d: 0,    t: 'cmd',  text: '$ npx soupz' },
  { d: 600,  t: 'out',  text: 'Starting agent server...' },
  { d: 1100, t: 'out',  text: 'Tunnel established' },
  { d: 1600, t: 'pair', text: '4 7 B 2 - 9 X 1 K' },
  { d: 2600, t: 'out',  text: 'Waiting for connection...' },
  { d: 3600, t: 'ok',   text: 'Connected from iPhone 15 Pro' },
  { d: 4100, t: 'ok',   text: 'Claude + Gemini + Copilot ready' },
];

function AnimTerminal() {
  const [count, setCount] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    setCount(0);
    const timers = TERM_LINES.map((l, i) =>
      setTimeout(() => setCount(i + 1), l.d + 300)
    );
    const restart = setTimeout(() => setRun(r => r + 1), 6000);
    return () => { timers.forEach(clearTimeout); clearTimeout(restart); };
  }, [run]);

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-subtle bg-bg-elevated/50">
        <span className="w-2.5 h-2.5 rounded-full bg-danger/50" />
        <span className="w-2.5 h-2.5 rounded-full bg-warning/50" />
        <span className="w-2.5 h-2.5 rounded-full bg-success/50" />
        <span className="ml-3 text-[11px] font-mono text-text-faint">terminal</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] font-mono text-success/80">live</span>
        </div>
      </div>
      {/* Body */}
      <div className="p-4 font-mono text-xs leading-[1.8] min-h-[180px]">
        {TERM_LINES.slice(0, count).map((line, i) => {
          if (line.t === 'pair') {
            return (
              <div key={i} className="my-3 text-center">
                <div
                  className="inline-block tracking-[0.3em] font-medium text-base px-6 py-2.5 rounded-lg border"
                  style={{
                    color: 'var(--accent)',
                    borderColor: 'rgba(99,102,241,0.25)',
                    background: 'rgba(99,102,241,0.06)',
                    animation: 'pulseRing 2s infinite',
                  }}
                >
                  {line.text}
                </div>
              </div>
            );
          }
          return (
            <div
              key={i}
              className={cn(
                line.t === 'cmd' && 'text-text-pri',
                line.t === 'out' && 'text-text-faint',
                line.t === 'ok'  && 'text-success',
              )}
              style={{ animation: 'fadeIn 0.15s ease both' }}
            >
              {line.t === 'out' && <span className="text-text-faint mr-1">{'>'}</span>}
              {line.t === 'ok' && <span className="mr-1">{'✓'}</span>}
              {line.text}
            </div>
          );
        })}
        {count < TERM_LINES.length && (
          <span className="inline-block w-1.5 h-3 bg-text-sec" style={{ animation: 'blink 1s step-end infinite' }} />
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PHONE MOCKUP — shows the chat interface
   ═══════════════════════════════════════════════════════════════════ */
function PhoneMockup() {
  const messages = [
    { role: 'user', text: 'Add dark mode toggle to the header' },
    { role: 'ai', agent: 'Claude', text: 'Done. Added theme switcher with 12 color themes. The toggle persists to localStorage.' },
    { role: 'user', text: 'Now make it work on mobile' },
    { role: 'ai', agent: 'Gemini', text: 'Updated responsive breakpoints. Bottom sheet on mobile, dropdown on desktop.' },
  ];

  return (
    <div
      className="w-[220px] rounded-[28px] border-2 border-border-mid bg-bg-surface overflow-hidden"
      style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-2 pb-1">
        <span className="text-[8px] font-ui text-text-faint">9:41</span>
        <div className="w-16 h-4 rounded-full bg-bg-base" />
        <div className="flex gap-0.5">
          <span className="text-[8px] text-text-faint">{'●●●●'}</span>
        </div>
      </div>
      {/* App header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border-subtle">
        <div className="w-5 h-5 rounded bg-accent flex items-center justify-center">
          <Terminal size={9} className="text-white" />
        </div>
        <span className="text-[10px] font-ui font-medium text-text-pri">soupz</span>
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-success" />
      </div>
      {/* Messages */}
      <div className="px-2.5 py-2 space-y-2 min-h-[160px]">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-2.5 py-1.5 text-[9px] leading-[1.4] font-ui',
                m.role === 'user'
                  ? 'bg-accent/15 text-text-pri border border-accent/20'
                  : 'bg-bg-elevated text-text-sec border border-border-subtle',
              )}
            >
              {m.agent && (
                <span className="text-[8px] font-medium text-accent block mb-0.5">{m.agent}</span>
              )}
              {m.text}
            </div>
          </div>
        ))}
      </div>
      {/* Input */}
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-t border-border-subtle">
        <Mic size={10} className="text-text-faint" />
        <div className="flex-1 h-5 rounded bg-bg-elevated border border-border-subtle" />
        <div className="w-5 h-5 rounded bg-accent flex items-center justify-center">
          <ArrowRight size={8} className="text-white" />
        </div>
      </div>
      {/* Home indicator */}
      <div className="flex justify-center py-1.5">
        <div className="w-20 h-1 rounded-full bg-text-faint/30" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN LANDING PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function LandingPage({ navigate }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => { document.body.style.overflow = prev; document.documentElement.style.overflow = ''; };
  }, []);

  const go = () => navigate?.('/');

  return (
    <div className="min-h-screen bg-bg-base text-text-pri font-ui overflow-x-hidden">
      <style>{STYLES}</style>

      {/* ═══ NAV ═══════════════════════════════════════════════════════ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-5 md:px-8 border-b border-border-subtle/60"
        style={{ background: 'rgba(15,15,19,0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-6xl mx-auto w-full flex items-center">
          <div className="flex items-center gap-2 mr-auto">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Terminal size={13} className="text-white" />
            </div>
            <span className="font-ui font-semibold text-sm tracking-tight">soupz</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[13px] text-text-sec">
            <a href="#features" className="hover:text-text-pri transition-colors">Features</a>
            <a href="#how" className="hover:text-text-pri transition-colors">How it works</a>
            <a href="#agents" className="hover:text-text-pri transition-colors">Agents</a>
          </nav>

          <div className="flex items-center gap-3 ml-6">
            <a
              href="https://github.com/soupz"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-[13px] text-text-sec hover:text-text-pri transition-colors"
            >
              <Github size={14} />
            </a>
            <button
              onClick={go}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-[13px] font-medium transition-all"
            >
              Open app
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ HERO ══════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center justify-center px-5 md:px-8 pt-14">
        {/* Grid background */}
        <div className="absolute inset-0 grid-bg opacity-100" />
        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 35%, rgba(99,102,241,0.07), transparent)' }} />

        <div className="relative max-w-6xl mx-auto w-full py-20 md:py-0">
          <div className="grid md:grid-cols-[1fr_auto] gap-12 md:gap-20 items-center">
            {/* Left — Copy */}
            <div className="max-w-xl">
              {/* Badge */}
              <div className="fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/20 bg-accent/5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-xs font-mono text-accent/80">Open source &middot; Free tier</span>
              </div>

              {/* Headline — 3 second clarity: "what is it + what does it do" */}
              <h1
                className="fade-up fade-up-1 font-ui font-semibold tracking-tight leading-[1.08] mb-6"
                style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', color: '#F0F0F5' }}
              >
                Your IDE,
                <br />
                on every device.
              </h1>

              {/* Sub — who it's for + outcome */}
              <p className="fade-up fade-up-2 text-text-sec text-lg md:text-xl leading-relaxed mb-10 max-w-md">
                Run one command. Connect from your phone.
                <br className="hidden md:block" />
                Code with Claude, Gemini, or Copilot — free.
              </p>

              {/* CTA row */}
              <div className="fade-up fade-up-3 flex flex-col sm:flex-row gap-3 mb-8">
                <div className="flex items-center rounded-lg border border-border-mid bg-bg-surface overflow-hidden">
                  <div className="px-4 py-3 font-mono text-sm text-text-pri select-all">npx soupz</div>
                  <CopyBtn text="npx soupz" />
                </div>
                <a
                  href="https://github.com/soupz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-border-mid bg-bg-surface hover:bg-bg-elevated text-text-pri text-sm font-medium transition-all"
                >
                  <Github size={15} />
                  GitHub
                </a>
              </div>

              {/* Social proof */}
              <div className="fade-up fade-up-4 flex items-center gap-4 text-text-faint text-xs font-ui">
                <span className="flex items-center gap-1"><Star size={11} className="text-warning/60" /> 2.4k stars</span>
                <span className="w-px h-3 bg-border-subtle" />
                <span>MIT License</span>
                <span className="w-px h-3 bg-border-subtle" />
                <span>macOS &middot; Linux &middot; Windows</span>
              </div>
            </div>

            {/* Right — Visual: Terminal + Phone overlapping */}
            <div className="fade-up fade-up-5 relative hidden md:block">
              <div className="w-[400px]">
                <AnimTerminal />
              </div>
              {/* Phone floating over terminal */}
              <div
                className="absolute -bottom-8 -right-6"
                style={{ animation: 'float 4s ease-in-out infinite' }}
              >
                <PhoneMockup />
              </div>
            </div>

            {/* Mobile: show terminal only */}
            <div className="fade-up fade-up-5 md:hidden">
              <AnimTerminal />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LOGOS / AGENT STRIP ═══════════════════════════════════════ */}
      <section className="py-10 px-5 border-y border-border-subtle bg-bg-surface/50">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-text-faint text-xs font-ui mb-5 uppercase tracking-widest">Works with</p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {CLI_AGENTS.map(agent => {
              const Icon = agent.icon;
              return (
                <div key={agent.id} className="flex items-center gap-2 text-text-sec">
                  <Icon size={16} style={{ color: agent.color }} />
                  <span className="text-sm font-ui font-medium">{agent.name}</span>
                  {agent.tier === 'free' && (
                    <span className="text-[9px] font-mono text-success/60 border border-success/20 rounded px-1 py-0.5">FREE</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ THE PITCH — Why this matters ═════════════════════════════ */}
      <section className="py-24 md:py-32 px-5 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <Reveal>
            <p className="text-text-sec text-lg md:text-xl leading-relaxed mb-6">
              You have a laptop at home, a phone in your pocket, and an idea in your head.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <p className="text-text-pri text-2xl md:text-3xl font-semibold leading-snug tracking-tight mb-6">
              Why should coding only happen at your desk?
            </p>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-text-sec text-base md:text-lg leading-relaxed max-w-xl mx-auto">
              Soupz bridges your machine and your device. AI agents run locally on your laptop.
              You command them from anywhere — your phone, a tablet, another browser.
              Your code never leaves your machine.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ═══ FEATURES ════════════════════════════════════════════════ */}
      <section id="features" className="py-24 md:py-32 px-5 md:px-8 bg-bg-surface border-y border-border-subtle">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-accent text-xs font-mono uppercase tracking-widest mb-4">Features</p>
            <h2 className="font-ui font-semibold text-3xl md:text-4xl tracking-tight mb-4">
              Everything you need.<br className="hidden sm:block" /> Nothing you don't.
            </h2>
            <p className="text-text-sec text-base max-w-md mx-auto">
              Built for engineers who ship from trains, cafes, and couches.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border-subtle rounded-xl overflow-hidden border border-border-subtle">
            {[
              { icon: Smartphone, title: 'Code from your phone', desc: 'Full chat + file editor from any browser. Voice input for hands-free coding on the go.' },
              { icon: Zap, title: '5 AI agents', desc: 'Claude, Gemini, Copilot, Kiro, Ollama. Auto-routes to the best agent for each task.' },
              { icon: Lock, title: 'Code stays local', desc: 'Your files never touch our servers. Only prompts and responses are relayed through an encrypted tunnel.' },
              { icon: Terminal, title: 'One command setup', desc: 'npx soupz. No config, no API keys for free tier, no signup required.' },
              { icon: Mic, title: 'Voice-first', desc: 'Speak your prompts. Neural TTS reads responses aloud. Code while walking.' },
              { icon: Layers, title: 'Sub-agents & teams', desc: 'Run parallel code reviews, security audits, and test generation simultaneously.' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 50}>
                <div className="bg-bg-surface p-6 md:p-8 h-full hover:bg-bg-elevated transition-colors group">
                  <div className="w-10 h-10 rounded-lg border border-border-mid bg-bg-base flex items-center justify-center mb-4 group-hover:border-accent/30 transition-colors">
                    <Icon size={18} className="text-text-sec group-hover:text-accent transition-colors" />
                  </div>
                  <h3 className="font-ui font-medium text-sm text-text-pri mb-2">{title}</h3>
                  <p className="text-text-faint text-[13px] leading-relaxed">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ════════════════════════════════════════════ */}
      <section id="how" className="py-24 md:py-32 px-5 md:px-8">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-20">
            <p className="text-accent text-xs font-mono uppercase tracking-widest mb-4">How it works</p>
            <h2 className="font-ui font-semibold text-3xl md:text-4xl tracking-tight mb-4">
              Three steps. Thirty seconds.
            </h2>
          </Reveal>

          <div className="space-y-16 md:space-y-24">
            {/* Step 1 */}
            <Reveal>
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-mono text-sm font-medium">1</span>
                    <h3 className="font-ui font-medium text-lg text-text-pri">Run the command</h3>
                  </div>
                  <p className="text-text-sec text-[15px] leading-relaxed mb-4">
                    One command starts a local agent server on your machine. An 8-digit pairing code appears.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border-mid bg-bg-surface font-mono text-sm text-text-pri">
                    <span className="text-text-faint">$</span> npx soupz
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="w-full max-w-sm">
                    <AnimTerminal />
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Step 2 */}
            <Reveal delay={50}>
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="md:order-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-mono text-sm font-medium">2</span>
                    <h3 className="font-ui font-medium text-lg text-text-pri">Connect from any device</h3>
                  </div>
                  <p className="text-text-sec text-[15px] leading-relaxed">
                    Open the web app on your phone, tablet, or another computer. Enter the pairing code. You're connected instantly — no accounts needed.
                  </p>
                </div>
                <div className="flex justify-center md:order-1">
                  <PhoneMockup />
                </div>
              </div>
            </Reveal>

            {/* Step 3 */}
            <Reveal delay={100}>
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-mono text-sm font-medium">3</span>
                    <h3 className="font-ui font-medium text-lg text-text-pri">Build with AI</h3>
                  </div>
                  <p className="text-text-sec text-[15px] leading-relaxed mb-4">
                    Chat with any AI agent. Edit files in the Monaco editor. Run git commands. All from your phone. Agents execute on your laptop — code stays local.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CLI_AGENTS.filter(a => a.tier === 'free' || a.tier === 'freemium').map(a => {
                      const Icon = a.icon;
                      return (
                        <span key={a.id} className="flex items-center gap-1.5 text-xs font-ui px-2.5 py-1 rounded-md border border-border-subtle bg-bg-surface text-text-sec">
                          <Icon size={12} style={{ color: a.color }} />
                          {a.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-center">
                  {/* IDE mockup */}
                  <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-surface overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-elevated/50 text-[10px] font-mono text-text-faint">
                      <Code2 size={11} className="text-text-sec" />
                      <span>App.jsx</span>
                      <span className="ml-auto text-accent/60">Ln 42, Col 8</span>
                    </div>
                    <div className="p-3 font-mono text-[10px] leading-[1.8] text-text-sec min-h-[120px]">
                      <div><span className="text-accent/60">1</span>  <span className="text-[#C586C0]">import</span> {'{'} useState {'}'} <span className="text-[#C586C0]">from</span> <span className="text-[#CE9178]">'react'</span>;</div>
                      <div><span className="text-accent/60">2</span></div>
                      <div><span className="text-accent/60">3</span>  <span className="text-[#C586C0]">export default function</span> <span className="text-[#DCDCAA]">App</span>() {'{'}</div>
                      <div><span className="text-accent/60">4</span>    <span className="text-[#C586C0]">const</span> [theme, setTheme] = <span className="text-[#DCDCAA]">useState</span>(<span className="text-[#CE9178]">'dark'</span>);</div>
                      <div><span className="text-accent/60">5</span></div>
                      <div><span className="text-accent/60">6</span>    <span className="text-[#C586C0]">return</span> {'<'}<span className="text-[#4EC9B0]">ThemeProvider</span> value={'{'}theme{'}'}{'>'};</div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Architecture strip */}
          <Reveal delay={50} className="mt-20">
            <div className="rounded-xl border border-border-subtle bg-bg-elevated p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-0">
                {[
                  { icon: Monitor, label: 'Your laptop', sub: 'agents + code' },
                  null,
                  { icon: Wifi, label: 'Encrypted relay', sub: 'prompts only', accent: true },
                  null,
                  { icon: Smartphone, label: 'Any device', sub: 'chat + editor' },
                ].map((item, i) => {
                  if (!item) {
                    return (
                      <div key={i} className="hidden md:block w-16 h-px border-t border-dashed border-accent/30" />
                    );
                  }
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 px-4">
                      <div
                        className={cn(
                          'w-11 h-11 rounded-xl flex items-center justify-center border',
                          item.accent
                            ? 'bg-accent/10 border-accent/25'
                            : 'bg-bg-surface border-border-mid',
                        )}
                      >
                        <Icon size={18} className={item.accent ? 'text-accent' : 'text-text-sec'} />
                      </div>
                      <span className="text-text-pri text-xs font-medium">{item.label}</span>
                      <span className="text-text-faint text-[10px] font-mono">{item.sub}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-center text-text-faint text-[11px] mt-6 max-w-sm mx-auto">
                Code never touches our servers. Your sessions are cryptographically isolated.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ AGENTS ══════════════════════════════════════════════════ */}
      <section id="agents" className="py-24 md:py-32 px-5 md:px-8 bg-bg-surface border-y border-border-subtle">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-accent text-xs font-mono uppercase tracking-widest mb-4">AI Agents</p>
            <h2 className="font-ui font-semibold text-3xl md:text-4xl tracking-tight mb-4">
              Every model. One interface.
            </h2>
            <p className="text-text-sec text-base max-w-md mx-auto">
              Use free models, premium models, or local models. Mix and match. Smart routing picks the best one.
            </p>
          </Reveal>

          {/* Agent cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-12">
            {CLI_AGENTS.map((agent, i) => {
              const Icon = agent.icon;
              return (
                <Reveal key={agent.id} delay={i * 40}>
                  <div className="relative rounded-xl border border-border-subtle bg-bg-base p-5 text-center group hover:border-border-mid transition-all">
                    <div
                      className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center border"
                      style={{
                        borderColor: `${agent.color}25`,
                        background: `${agent.color}08`,
                      }}
                    >
                      <Icon size={18} style={{ color: agent.color }} />
                    </div>
                    <div className="text-text-pri text-sm font-medium mb-0.5">{agent.name}</div>
                    <div className="text-text-faint text-[11px]">{agent.description.replace(/^(Google |Anthropic |GitHub |AWS |Local )/, '')}</div>
                    {(agent.tier === 'free' || agent.tier === 'freemium') && (
                      <div className="absolute top-2 right-2 text-[8px] font-mono text-success/70 border border-success/20 rounded px-1 py-0.5 bg-success/5">
                        {agent.tier === 'free' ? 'FREE' : 'FREE TIER'}
                      </div>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>

          {/* Comparison table */}
          <Reveal delay={100}>
            <div className="rounded-xl border border-border-subtle overflow-hidden">
              <div className="grid grid-cols-4 text-xs font-ui border-b border-border-subtle bg-bg-elevated">
                <div className="px-4 py-3 font-medium text-text-sec">Agent</div>
                <div className="px-4 py-3 text-center text-text-sec">Free</div>
                <div className="px-4 py-3 text-center text-text-sec hidden sm:block">Offline</div>
                <div className="px-4 py-3 text-text-sec">Best for</div>
              </div>
              {[
                { name: 'Gemini', free: true, offline: false, use: 'Research, long context' },
                { name: 'Claude Code', free: false, offline: false, use: 'Complex reasoning, refactoring' },
                { name: 'Copilot', free: true, offline: false, use: 'Code completion, GitHub ops' },
                { name: 'Kiro', free: false, offline: false, use: 'AWS, cloud infrastructure' },
                { name: 'Ollama', free: true, offline: true, use: 'Private, local, offline work' },
              ].map(row => (
                <div key={row.name} className="grid grid-cols-4 text-xs font-ui border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 transition-colors">
                  <div className="px-4 py-3 text-text-pri font-medium">{row.name}</div>
                  <div className="px-4 py-3 text-center">{row.free ? <Check size={13} className="text-success mx-auto" /> : <span className="text-text-faint">—</span>}</div>
                  <div className="px-4 py-3 text-center hidden sm:block">{row.offline ? <Check size={13} className="text-success mx-auto" /> : <span className="text-text-faint">—</span>}</div>
                  <div className="px-4 py-3 text-text-sec">{row.use}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══════════════════════════════════════════════ */}
      <section className="py-28 md:py-36 px-5 md:px-8 relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-60" />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 50% 70% at 50% 100%, rgba(99,102,241,0.08), transparent)' }} />

        <div className="relative max-w-2xl mx-auto text-center">
          <Reveal>
            <h2
              className="font-ui font-semibold tracking-tight mb-5"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}
            >
              Start building from your phone.
            </h2>
            <p className="text-text-sec text-base leading-relaxed mb-10 max-w-md mx-auto">
              Free tier. No credit card. Works on every platform. Takes 30 seconds.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="flex items-center justify-center gap-0 rounded-xl border border-border-mid bg-bg-surface overflow-hidden mx-auto max-w-xs mb-6">
              <div className="flex-1 px-4 py-3.5 font-mono text-sm text-text-pri text-left select-all">npx soupz</div>
              <CopyBtn text="npx soupz" />
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={go}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-all"
              >
                Open app
                <ArrowRight size={14} />
              </button>
              <a
                href="https://github.com/soupz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-3 rounded-lg border border-border-mid bg-bg-surface hover:bg-bg-elevated text-text-sec hover:text-text-pri text-sm font-medium transition-all"
              >
                <Github size={15} />
                GitHub
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ══════════════════════════════════════════════════ */}
      <footer className="border-t border-border-subtle bg-bg-surface px-5 md:px-8 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
              <Terminal size={10} className="text-white" />
            </div>
            <span className="font-ui font-semibold text-sm">soupz</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-text-faint">
            <a href="#features" className="hover:text-text-sec transition-colors">Features</a>
            <a href="#how" className="hover:text-text-sec transition-colors">How it works</a>
            <a href="#agents" className="hover:text-text-sec transition-colors">Agents</a>
            <a href="https://github.com/soupz" target="_blank" rel="noopener noreferrer" className="hover:text-text-sec transition-colors flex items-center gap-1">
              <Github size={11} /> GitHub
            </a>
          </div>
          <span className="text-text-faint text-xs">&copy; {new Date().getFullYear()} Soupz. MIT License.</span>
        </div>
      </footer>
    </div>
  );
}
