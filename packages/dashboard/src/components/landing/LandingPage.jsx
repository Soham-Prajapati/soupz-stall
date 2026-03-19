import { useState, useEffect, useRef } from 'react';
import {
  Smartphone, Zap, Wifi, Terminal, Bot, Lock,
  Copy, Check, Github, ArrowRight, ChevronRight,
  Star, ExternalLink,
} from 'lucide-react';
import { CLI_AGENTS } from '../../lib/agents';
import { cn } from '../../lib/cn';

/* ─── Keyframe styles injected once ─────────────────────────────── */
const KEYFRAMES = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes terminalType {
  from { width: 0; }
  to   { width: 100%; }
}
@keyframes slideRight {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
  50%       { box-shadow: 0 0 24px 4px rgba(99,102,241,0.2); }
}
@keyframes floatUp {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-6px); }
}
@keyframes shimmer {
  from { background-position: -200% center; }
  to   { background-position: 200% center; }
}
`;

function InjectStyles() {
  return <style>{KEYFRAMES}</style>;
}

/* ─── Copy button ─────────────────────────────────────────────────── */
function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: select text */
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all duration-200',
        copied
          ? 'bg-success/15 text-success border border-success/25'
          : 'bg-bg-elevated text-text-sec border border-border-subtle hover:border-border-mid hover:text-text-pri',
        className,
      )}
      aria-label="Copy to clipboard"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/* ─── Animated terminal mockup ────────────────────────────────────── */
const TERMINAL_LINES = [
  { delay: 0,    type: 'cmd',  text: '$ npx soupz' },
  { delay: 600,  type: 'info', text: '▸ Starting Soupz daemon v0.9.4...' },
  { delay: 1100, type: 'info', text: '▸ Tunnel established' },
  { delay: 1600, type: 'code', text: '' },
  { delay: 1700, type: 'pair', text: '  Pairing code:  4 7 B 2 - 9 X 1 K  ' },
  { delay: 1700, type: 'code', text: '' },
  { delay: 2400, type: 'info', text: '▸ Waiting for remote connection...' },
  { delay: 3400, type: 'ok',   text: '✓ Connected from iPhone 15 Pro' },
  { delay: 3900, type: 'ok',   text: '✓ Claude Code · Gemini · Copilot ready' },
];

function TerminalMockup() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    // Restart animation loop
    const startLoop = () => {
      setVisibleCount(0);
      setRunning(true);
    };
    startLoop();

    const timers = [];
    TERMINAL_LINES.forEach((line, idx) => {
      const t = setTimeout(() => {
        setVisibleCount(idx + 1);
      }, line.delay + 400);
      timers.push(t);
    });

    // Restart after last line + pause
    const restart = setTimeout(() => {
      setRunning(false);
      setTimeout(startLoop, 800);
    }, TERMINAL_LINES[TERMINAL_LINES.length - 1].delay + 2800);
    timers.push(restart);

    return () => timers.forEach(clearTimeout);
  }, [running]);

  return (
    <div
      className="relative rounded-xl border border-border-subtle bg-bg-surface overflow-hidden"
      style={{ boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)' }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle bg-bg-elevated">
        <span className="w-3 h-3 rounded-full bg-danger/60" />
        <span className="w-3 h-3 rounded-full bg-warning/60" />
        <span className="w-3 h-3 rounded-full bg-success/60" />
        <span className="ml-3 text-xs font-mono text-text-faint">Terminal</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-mono text-success">live</span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 font-mono text-xs leading-relaxed min-h-[200px]">
        {TERMINAL_LINES.slice(0, visibleCount).map((line, idx) => {
          if (line.type === 'code') {
            return <div key={idx} className="h-px bg-border-subtle my-2 mx-0" />;
          }
          if (line.type === 'pair') {
            return (
              <div
                key={idx}
                className="my-2 text-center tracking-[0.25em] font-mono font-medium text-lg"
                style={{
                  color: '#6366F1',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '8px',
                  padding: '10px 0',
                  animation: 'pulseGlow 2s ease-in-out infinite',
                }}
              >
                {line.text}
              </div>
            );
          }
          return (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-2',
                line.type === 'cmd'  && 'text-text-pri',
                line.type === 'info' && 'text-text-faint',
                line.type === 'ok'   && 'text-success',
              )}
              style={{ animation: 'fadeIn 0.2s ease both' }}
            >
              <span className="shrink-0">{line.text}</span>
              {idx === visibleCount - 1 && line.type !== 'ok' && (
                <span
                  className="inline-block w-1.5 h-3.5 bg-text-pri ml-0.5 self-center"
                  style={{ animation: 'blink 1s step-end infinite' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Feature card ─────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'group relative p-6 rounded-xl border border-border-subtle bg-bg-surface',
        'hover:border-border-mid hover:bg-bg-elevated transition-all duration-300',
        'cursor-default',
      )}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms, background-color 0.3s, border-color 0.3s`,
      }}
    >
      {/* Accent glow on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(99,102,241,0.06), transparent 60%)' }}
      />

      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
      >
        <Icon size={18} className="text-accent" />
      </div>

      <h3 className="text-text-pri font-ui font-semibold text-sm mb-2 leading-snug">{title}</h3>
      <p className="text-text-sec font-ui text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─── How-it-works step ─────────────────────────────────────────────── */
function HowStep({ number, title, desc, code, last = false }) {
  return (
    <div className="flex flex-col items-center text-center relative">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-5 font-mono font-semibold text-sm text-accent"
        style={{
          background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.3)',
          boxShadow: '0 0 20px rgba(99,102,241,0.15)',
        }}
      >
        {number}
      </div>
      <h3 className="text-text-pri font-ui font-semibold text-base mb-2">{title}</h3>
      <p className="text-text-sec font-ui text-sm leading-relaxed max-w-[200px]">{desc}</p>
      {code && (
        <div className="mt-3 px-3 py-1.5 rounded-md font-mono text-xs text-accent bg-accent/10 border border-accent/20">
          {code}
        </div>
      )}

      {/* Connector arrow — hidden on mobile, shown on md+ */}
      {!last && (
        <div className="hidden md:flex absolute top-6 left-[calc(50%+80px)] items-center gap-1 text-text-faint">
          <div
            className="h-px w-16 origin-left"
            style={{
              background: 'linear-gradient(90deg, rgba(99,102,241,0.4), rgba(99,102,241,0.1))',
            }}
          />
          <ChevronRight size={14} className="text-accent/40 -ml-2" />
        </div>
      )}
    </div>
  );
}

/* ─── Agent card ────────────────────────────────────────────────────── */
const AGENT_BADGES = {
  gemini:      { label: 'Free',    cls: 'bg-success/10 text-success border-success/20' },
  'claude-code':{ label: 'Premium', cls: 'bg-warning/10 text-warning border-warning/20' },
  copilot:     { label: 'Free',    cls: 'bg-success/10 text-success border-success/20' },
  kiro:        { label: 'Premium', cls: 'bg-warning/10 text-warning border-warning/20' },
  ollama:      { label: 'Local',   cls: 'bg-accent/10 text-accent border-accent/20' },
};

const AGENT_DESCS = {
  gemini:      'Google\'s frontier model. Fast, multimodal, generous free tier.',
  'claude-code':'Best-in-class agentic coding. Deep reasoning, long context.',
  copilot:     'GitHub Copilot via gpt-4.1-mini. Tight GitHub integration.',
  kiro:        'AWS Kiro — spec-first, cloud-native agent workflows.',
  ollama:      'Run Llama, Mistral & friends. 100% local, 100% private.',
};

function AgentCard({ agent }) {
  const Icon = agent.icon;
  const badge = AGENT_BADGES[agent.id];

  return (
    <div
      className="group p-5 rounded-xl border border-border-subtle bg-bg-surface hover:bg-bg-elevated hover:border-border-mid transition-all duration-300 flex flex-col gap-3"
      style={{ '--agent-color': agent.color }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ background: `${agent.color}18`, border: `1px solid ${agent.color}33` }}
        >
          <Icon size={16} style={{ color: agent.color }} />
        </div>
        {badge && (
          <span
            className={cn(
              'text-[10px] font-ui font-medium px-2 py-0.5 rounded-full border',
              badge.cls,
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div>
        <div className="text-text-pri font-ui font-semibold text-sm mb-1">{agent.name}</div>
        <div className="text-text-sec font-ui text-xs leading-relaxed">{AGENT_DESCS[agent.id]}</div>
      </div>
    </div>
  );
}

/* ─── Scroll-fade wrapper ───────────────────────────────────────────── */
function FadeSection({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Section label ─────────────────────────────────────────────────── */
function SectionLabel({ children }) {
  return (
    <div className="flex items-center justify-center mb-4">
      <span className="text-[11px] font-mono font-medium tracking-[0.15em] uppercase text-accent/70 px-3 py-1 rounded-full border border-accent/20 bg-accent/5">
        {children}
      </span>
    </div>
  );
}

/* ─── Main landing page ─────────────────────────────────────────────── */
export default function LandingPage({ navigate }) {
  const NPX_CMD = 'npx soupz';

  // Allow body to scroll when landing page is mounted (app shell sets overflow:hidden)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.style.overflow = '';
    };
  }, []);

  function handleNavToApp() {
    if (navigate) navigate('/');
  }

  return (
    <div
      className="min-h-screen bg-bg-base text-text-pri font-ui overflow-x-hidden"
      style={{ '--header-h': '56px' }}
    >
      <InjectStyles />

      {/* ── Navbar ───────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-6 border-b border-border-subtle"
        style={{ background: 'rgba(12,12,15,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-6xl mx-auto w-full flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 mr-auto">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Terminal size={13} className="text-white" />
            </div>
            <span className="font-ui font-semibold text-sm tracking-tight text-text-pri">soupz</span>
          </div>

          {/* Links */}
          <nav className="hidden sm:flex items-center gap-6 text-sm text-text-sec">
            <a href="#features" className="hover:text-text-pri transition-colors duration-200">Features</a>
            <a href="#how-it-works" className="hover:text-text-pri transition-colors duration-200">How it works</a>
            <a href="#agents" className="hover:text-text-pri transition-colors duration-200">Agents</a>
          </nav>

          <div className="flex items-center gap-3 ml-4">
            <a
              href="https://github.com/soupz"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-subtle text-text-sec hover:text-text-pri hover:border-border-mid text-xs font-ui transition-all duration-200"
            >
              <Github size={13} />
              <span>GitHub</span>
            </a>
            <button
              onClick={handleNavToApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent hover:bg-accent-hover text-white text-xs font-ui font-medium transition-all duration-200"
              style={{ boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 12px rgba(99,102,241,0.2)' }}
            >
              Open app
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-20 bg-grid"
        style={{ background: 'var(--bg-base)' }}
      >
        {/* Grid bg overlay */}
        <div className="absolute inset-0 bg-grid opacity-100 pointer-events-none" />

        {/* Radial glow from center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(99,102,241,0.08), transparent)',
          }}
        />

        <div className="relative max-w-5xl mx-auto w-full grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          {/* Left col: copy */}
          <div>
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/25 bg-accent/8 mb-8"
              style={{
                animation: 'fadeUp 0.6s ease both',
                background: 'rgba(99,102,241,0.07)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-mono text-accent/90 tracking-wide">Open source · Free tier · No credit card</span>
            </div>

            {/* Headline */}
            <h1
              className="font-ui font-bold tracking-tight leading-[1.1] mb-5"
              style={{
                fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
                animation: 'fadeUp 0.6s ease 0.1s both',
                color: '#F0F0F5',
              }}
            >
              Code with every AI.
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #6366F1 0%, #A5B4FC 50%, #6366F1 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'shimmer 4s linear infinite',
                }}
              >
                From anywhere.
              </span>
            </h1>

            {/* Sub */}
            <p
              className="text-text-sec font-ui text-base md:text-lg leading-relaxed mb-8 max-w-md"
              style={{ animation: 'fadeUp 0.6s ease 0.2s both' }}
            >
              Run <code className="font-mono text-accent text-sm bg-accent/10 px-1.5 py-0.5 rounded">npx soupz</code>.
              Connect from your phone. Use Claude, Gemini, or Copilot — free.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-3"
              style={{ animation: 'fadeUp 0.6s ease 0.3s both' }}
            >
              {/* Install command */}
              <div className="flex items-center gap-0 rounded-lg border border-border-mid bg-bg-surface overflow-hidden flex-1 min-w-0 max-w-xs">
                <div className="flex-1 px-3 py-2.5 font-mono text-sm text-text-pri select-all truncate">
                  {NPX_CMD}
                </div>
                <CopyButton text={NPX_CMD} className="rounded-none rounded-r-lg border-0 border-l border-border-subtle h-full" />
              </div>

              {/* GitHub */}
              <a
                href="https://github.com/soupz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border-mid bg-bg-surface hover:bg-bg-elevated hover:border-border-strong text-text-pri text-sm font-ui font-medium transition-all duration-200 shrink-0"
              >
                <Github size={15} />
                <span>View on GitHub</span>
              </a>
            </div>

            {/* Social proof */}
            <div
              className="flex items-center gap-4 mt-6"
              style={{ animation: 'fadeUp 0.6s ease 0.4s both' }}
            >
              <div className="flex items-center gap-1.5 text-text-faint text-xs font-ui">
                <Star size={12} className="text-warning/60" />
                <span>2.4k stars</span>
              </div>
              <div className="w-px h-3 bg-border-subtle" />
              <div className="text-text-faint text-xs font-ui">MIT License</div>
              <div className="w-px h-3 bg-border-subtle" />
              <div className="text-text-faint text-xs font-ui">v0.9.4</div>
            </div>
          </div>

          {/* Right col: terminal */}
          <div
            style={{
              animation: 'fadeUp 0.7s ease 0.35s both',
            }}
          >
            <TerminalMockup />

            {/* Agent pills beneath terminal */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {CLI_AGENTS.map(agent => {
                const Icon = agent.icon;
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-ui transition-all duration-200"
                    style={{
                      borderColor: `${agent.color}30`,
                      background: `${agent.color}0A`,
                      color: agent.color,
                    }}
                  >
                    <Icon size={11} />
                    <span>{agent.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scroll nudge */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ animation: 'fadeIn 1s ease 1.5s both' }}
        >
          <span className="text-text-faint text-xs font-ui">Scroll to explore</span>
          <div
            className="w-5 h-8 rounded-full border border-border-mid flex items-start justify-center pt-1.5"
          >
            <div
              className="w-1 h-2 rounded-full bg-accent/60"
              style={{ animation: 'floatUp 1.5s ease-in-out infinite' }}
            />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-bg-base">
        <div className="max-w-5xl mx-auto">
          <FadeSection className="text-center mb-16">
            <SectionLabel>Features</SectionLabel>
            <h2 className="font-ui font-bold text-3xl md:text-4xl tracking-tight text-text-pri mb-4">
              Built for engineers who move fast
            </h2>
            <p className="text-text-sec text-base max-w-lg mx-auto leading-relaxed">
              Every feature is designed to get out of your way — and let the AI agents do the heavy lifting.
            </p>
          </FadeSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Smartphone}
              title="Code from your phone"
              desc="Leave your laptop home. Full IDE experience from any browser, on any device, mid-lecture or mid-commute."
              delay={0}
            />
            <FeatureCard
              icon={Zap}
              title="Multiple AI agents"
              desc="Claude Code, Gemini, Copilot, Kiro, Ollama. Auto-routes to the best agent for each task."
              delay={60}
            />
            <FeatureCard
              icon={Wifi}
              title="Zero cloud lock-in"
              desc="Local daemon on your machine. Web UI on our servers. Your code never leaves your filesystem."
              delay={120}
            />
            <FeatureCard
              icon={Terminal}
              title="One command setup"
              desc="npx soupz. That's it. No config files, no API keys for free tier, no account required to start."
              delay={180}
            />
            <FeatureCard
              icon={Bot}
              title="Parallel agents"
              desc="Spawn multiple specialists simultaneously — architect, QA, designer — all working in concert."
              delay={240}
            />
            <FeatureCard
              icon={Lock}
              title="Secure by default"
              desc="End-to-end relay. Row-level security on every table. Your sessions are cryptographically isolated."
              delay={300}
            />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-bg-surface border-y border-border-subtle">
        <div className="max-w-4xl mx-auto">
          <FadeSection className="text-center mb-16">
            <SectionLabel>How it works</SectionLabel>
            <h2 className="font-ui font-bold text-3xl md:text-4xl tracking-tight text-text-pri mb-4">
              Three steps to code from anywhere
            </h2>
            <p className="text-text-sec text-base max-w-md mx-auto leading-relaxed">
              Your machine does the computing. Your phone does the commanding.
            </p>
          </FadeSection>

          <FadeSection delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 relative">
              <HowStep
                number="01"
                title="Run npx soupz"
                desc="One command starts a local daemon and opens a secure tunnel. An 8-digit pairing code appears."
                code="npx soupz"
              />
              <HowStep
                number="02"
                title="Scan from phone"
                desc="Open soupz.app on your phone, enter the pairing code. You're connected to your machine instantly."
                code="4 7 B 2 - 9 X 1 K"
              />
              <HowStep
                number="03"
                title="Build with AI"
                desc="Chat with Claude, Gemini, or Copilot from your phone. Agents run on your laptop, code stays local."
                last
              />
            </div>
          </FadeSection>

          {/* Architecture diagram — minimal text-based */}
          <FadeSection delay={200} className="mt-16">
            <div className="rounded-xl border border-border-subtle bg-bg-elevated p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-0 justify-between text-center">
                {/* Your machine */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-bg-surface border border-border-mid flex items-center justify-center">
                    <Terminal size={20} className="text-text-sec" />
                  </div>
                  <div className="text-text-pri font-ui font-medium text-sm">Your machine</div>
                  <div className="text-text-faint font-mono text-xs">daemon + code</div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col md:flex-row items-center gap-1 text-text-faint">
                  <div
                    className="md:w-20 w-px md:h-px h-8 md:border-t border-l border-dashed"
                    style={{ borderColor: 'rgba(99,102,241,0.3)' }}
                  />
                  <div className="text-[10px] font-mono text-accent/60 md:absolute relative">relay</div>
                  <div
                    className="md:w-20 w-px md:h-px h-8 md:border-t border-l border-dashed"
                    style={{ borderColor: 'rgba(99,102,241,0.3)' }}
                  />
                </div>

                {/* Soupz relay */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      animation: 'pulseGlow 3s ease-in-out infinite',
                    }}
                  >
                    <Wifi size={20} className="text-accent" />
                  </div>
                  <div className="text-text-pri font-ui font-medium text-sm">Soupz relay</div>
                  <div className="text-text-faint font-mono text-xs">E2E encrypted</div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col md:flex-row items-center gap-1 text-text-faint">
                  <div
                    className="md:w-20 w-px md:h-px h-8 md:border-t border-l border-dashed"
                    style={{ borderColor: 'rgba(99,102,241,0.3)' }}
                  />
                  <div
                    className="md:w-20 w-px md:h-px h-8 md:border-t border-l border-dashed"
                    style={{ borderColor: 'rgba(99,102,241,0.3)' }}
                  />
                </div>

                {/* Your phone */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-bg-surface border border-border-mid flex items-center justify-center">
                    <Smartphone size={20} className="text-text-sec" />
                  </div>
                  <div className="text-text-pri font-ui font-medium text-sm">Your phone</div>
                  <div className="text-text-faint font-mono text-xs">AI chat UI</div>
                </div>
              </div>

              <p className="text-center text-text-faint text-xs font-ui mt-6 max-w-sm mx-auto leading-relaxed">
                Code never touches our servers. Only prompts and responses are relayed — through an encrypted tunnel you control.
              </p>
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── Agent showcase ───────────────────────────────────────────── */}
      <section id="agents" className="py-24 px-6 bg-bg-base">
        <div className="max-w-5xl mx-auto">
          <FadeSection className="text-center mb-16">
            <SectionLabel>AI Agents</SectionLabel>
            <h2 className="font-ui font-bold text-3xl md:text-4xl tracking-tight text-text-pri mb-4">
              Every frontier model. One interface.
            </h2>
            <p className="text-text-sec text-base max-w-md mx-auto leading-relaxed">
              Connect to the best AI for every task. Mix free and premium. Run them in parallel.
            </p>
          </FadeSection>

          <FadeSection delay={100}>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {CLI_AGENTS.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </FadeSection>

          {/* Comparison table — compact */}
          <FadeSection delay={150} className="mt-12">
            <div className="rounded-xl border border-border-subtle bg-bg-surface overflow-hidden">
              <div className="grid grid-cols-4 text-xs font-ui text-text-faint border-b border-border-subtle">
                <div className="px-4 py-3 font-medium text-text-sec">Agent</div>
                <div className="px-4 py-3 text-center">Free tier</div>
                <div className="px-4 py-3 text-center hidden sm:block">Offline</div>
                <div className="px-4 py-3 text-center">Best for</div>
              </div>
              {[
                { name: 'Gemini',      free: true,  offline: false, use: 'Long-context tasks' },
                { name: 'Claude Code', free: false, offline: false, use: 'Complex reasoning' },
                { name: 'Copilot',     free: true,  offline: false, use: 'Code completion' },
                { name: 'Kiro',        free: false, offline: false, use: 'Cloud architecture' },
                { name: 'Ollama',      free: true,  offline: true,  use: 'Private / local work' },
              ].map((row, i) => (
                <div
                  key={row.name}
                  className={cn(
                    'grid grid-cols-4 text-xs font-ui border-b border-border-subtle last:border-0 hover:bg-bg-elevated transition-colors duration-200',
                  )}
                >
                  <div className="px-4 py-3 text-text-pri font-medium">{row.name}</div>
                  <div className="px-4 py-3 text-center">
                    {row.free
                      ? <Check size={13} className="text-success mx-auto" />
                      : <span className="text-text-faint">—</span>}
                  </div>
                  <div className="px-4 py-3 text-center hidden sm:block">
                    {row.offline
                      ? <Check size={13} className="text-success mx-auto" />
                      : <span className="text-text-faint">—</span>}
                  </div>
                  <div className="px-4 py-3 text-text-sec">{row.use}</div>
                </div>
              ))}
            </div>
          </FadeSection>
        </div>
      </section>

      {/* ── CTA / Footer ─────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-bg-surface border-t border-border-subtle relative overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 50% 60% at 50% 100%, rgba(99,102,241,0.1), transparent)',
          }}
        />
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

        <div className="relative max-w-2xl mx-auto text-center">
          <FadeSection>
            <SectionLabel>Get started</SectionLabel>
            <h2
              className="font-ui font-bold tracking-tight text-text-pri mb-4"
              style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}
            >
              Ready to build from anywhere?
            </h2>
            <p className="text-text-sec text-base leading-relaxed mb-10 max-w-md mx-auto">
              Open source. Free tier. No credit card. Works on macOS, Linux, and Windows — in 30 seconds.
            </p>

            {/* Big install block */}
            <div
              className="flex items-center gap-0 rounded-xl border border-border-mid bg-bg-elevated overflow-hidden mx-auto max-w-xs mb-6"
              style={{ boxShadow: '0 0 0 1px rgba(99,102,241,0.15), 0 8px 32px rgba(0,0,0,0.4)' }}
            >
              <div className="flex-1 px-4 py-3.5 font-mono text-sm text-text-pri text-left select-all">
                npx soupz
              </div>
              <CopyButton text="npx soupz" className="rounded-none rounded-r-xl border-0 border-l border-border-subtle py-3.5" />
            </div>

            {/* GitHub star */}
            <a
              href="https://github.com/soupz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border-mid bg-bg-surface hover:bg-bg-elevated hover:border-border-strong text-text-sec hover:text-text-pri text-sm font-ui font-medium transition-all duration-200 mb-10"
            >
              <Github size={15} />
              <span>View on GitHub</span>
              <span className="flex items-center gap-1 text-warning/80 text-xs font-mono">
                <Star size={11} />
                2.4k
              </span>
            </a>

            {/* Footnote */}
            <p className="text-text-faint text-xs font-ui">
              MIT license · Works with Claude Code, Gemini CLI, GitHub Copilot, Kiro, Ollama
            </p>
          </FadeSection>
        </div>
      </section>

      {/* ── Page footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-border-subtle bg-bg-base px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
              <Terminal size={11} className="text-white" />
            </div>
            <span className="font-ui font-semibold text-sm text-text-pri">soupz</span>
            <span className="text-text-faint text-xs font-ui ml-1">— Your IDE, anywhere.</span>
          </div>

          <div className="flex items-center gap-5 text-xs text-text-faint font-ui">
            <a href="#features" className="hover:text-text-sec transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-text-sec transition-colors">How it works</a>
            <a href="#agents" className="hover:text-text-sec transition-colors">Agents</a>
            <a
              href="https://github.com/soupz"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-sec transition-colors flex items-center gap-1"
            >
              <Github size={11} />
              GitHub
            </a>
          </div>

          <div className="text-text-faint text-xs font-ui">
            &copy; {new Date().getFullYear()} Soupz. MIT License.
          </div>
        </div>
      </footer>
    </div>
  );
}
