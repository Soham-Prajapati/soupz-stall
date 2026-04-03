import { useState, useEffect, useRef } from 'react';
import {
  Smartphone, Zap, Wifi, Terminal, Lock,
  Copy, Check, Github, ArrowRight,
  Star, Mic, Code2, Monitor, Layers, Sparkles, Search
} from 'lucide-react';
import { CLI_AGENTS } from '../../../lib/agents';
import { cn } from '../../../lib/cn';

/* ═══════════════════════════════════════════════════════════════════
   STYLES & KEYFRAMES
   ═══════════════════════════════════════════════════════════════════ */
const STYLES = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(40px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pulseGlow {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%      { opacity: 0.7; transform: scale(1.05); }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-20px) rotate(2deg); }
}
@keyframes drift {
  0%   { transform: translate(0, 0); }
  50%  { transform: translate(40px, -30px); }
  100% { transform: translate(0, 0); }
}
@keyframes rotateClockwise {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
@keyframes morphing {
  0% { border-radius: 40% 60% 60% 40% / 40% 40% 60% 60%; }
  33% { border-radius: 60% 40% 40% 60% / 60% 60% 40% 40%; }
  66% { border-radius: 40% 60% 40% 60% / 40% 60% 40% 60%; }
  100% { border-radius: 40% 60% 60% 40% / 40% 40% 60% 60%; }
}

.theme-morphism .fade-up { animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) both; }
.theme-morphism .delay-100 { animation-delay: 150ms; }
.theme-morphism .delay-200 { animation-delay: 300ms; }
.theme-morphism .delay-300 { animation-delay: 450ms; }

.theme-morphism .bento-card {
  position: relative;
  overflow: hidden;
  border-radius: 2.5rem;
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.theme-morphism .bento-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.1), transparent 40%);
  opacity: 0;
  transition: opacity 0.5s;
  pointer-events: none;
}
.theme-morphism .bento-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-6px);
  box-shadow: 0 40px 80px -20px rgba(0,0,0,0.7);
  background: rgba(255, 255, 255, 0.04);
}
.theme-morphism .bento-card:hover::before {
  opacity: 1;
}

.theme-morphism .ambient-orb-1 {
  position: absolute; top: -20%; left: -10%; width: 65vw; height: 65vw;
  background: radial-gradient(circle, #10B981 0%, transparent 80%);
  opacity: 0.2; filter: blur(120px); animation: float 18s ease-in-out infinite; pointer-events: none; z-index: 0;
}
.theme-morphism .ambient-orb-2 {
  position: absolute; top: 25%; right: -20%; width: 55vw; height: 55vw;
  background: radial-gradient(circle, #3b82f6 0%, transparent 80%);
  opacity: 0.15; filter: blur(120px); animation: float 22s ease-in-out infinite reverse; pointer-events: none; z-index: 0;
}
.theme-morphism .ambient-orb-3 {
  position: absolute; bottom: -20%; left: 5%; width: 75vw; height: 50vw;
  background: radial-gradient(ellipse, var(--accent) 0%, transparent 80%);
  opacity: 0.14; filter: blur(140px); animation: drift 20s ease-in-out infinite; pointer-events: none; z-index: 0;
}
.theme-morphism .bg-curve {
  position: absolute;
  width: 160%;
  height: 160%;
  top: -30%;
  left: -30%;
  border: 1px solid rgba(255, 255, 255, 0.04);
  pointer-events: none;
  z-index: 0;
  animation: rotateClockwise 80s linear infinite, morphing 15s ease-in-out infinite;
}
.theme-morphism .bg-curve-2 {
  position: absolute;
  width: 140%;
  height: 140%;
  top: -20%;
  left: -20%;
  border: 1px solid rgba(255, 255, 255, 0.02);
  pointer-events: none;
  z-index: 0;
  animation: rotateClockwise 100s linear infinite reverse, morphing 20s ease-in-out infinite alternate;
}
.theme-morphism .bg-line {
  position: absolute;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent);
  width: 1px;
  height: 100vh;
  pointer-events: none;
  z-index: 0;
}
.theme-morphism .glow-blob {
  position: absolute;
  width: 400px;
  height: 400px;
  background: var(--accent);
  filter: blur(150px);
  opacity: 0.1;
  pointer-events: none;
  z-index: 0;
  animation: morphing 12s ease-in-out infinite;
}
`;

const SHOW_SOURCE_LINKS = import.meta.env.VITE_SHOW_SOURCE_LINKS === 'true';

function BackgroundElements() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="bg-curve" />
      <div className="bg-curve-2" />
      
      {/* Dynamic Grid Lines */}
      {[...Array(12)].map((_, i) => (
        <div 
          key={i} 
          className="bg-line" 
          style={{ 
            left: `${(i + 1) * 8}%`, 
            opacity: 0.05 + (i % 3) * 0.05,
            height: '200%',
            transform: 'rotate(15deg) translateY(-25%)'
          }} 
        />
      ))}

      {/* SVG Liquid Curves */}
      <svg className="absolute top-0 left-0 w-full h-full opacity-[0.03]" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <path d="M0,1000 C300,800 400,900 600,700 C800,500 900,600 1000,400 V0 H0 Z" fill="white" />
        <path d="M0,500 C200,600 300,400 500,500 C700,600 800,400 1000,500 V1000 H0 Z" fill="white" />
      </svg>

      <div className="ambient-orb-1" />
      <div className="ambient-orb-2" />
      <div className="ambient-orb-3" />

      {/* Scattered Glow Blobs */}
      <div className="glow-blob" style={{ top: '10%', left: '20%' }} />
      <div className="glow-blob" style={{ top: '60%', right: '10%', background: '#3b82f6' }} />
      <div className="glow-blob" style={{ bottom: '5%', left: '40%', background: '#8b5cf6' }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════════ */
function useReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, className = '', delay = 0 }) {
  const [ref, visible] = useReveal(0.05);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.98)',
        transition: `all 1s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono transition-all border border-transparent',
        copied ? 'bg-success/15 text-success border-success/30' : 'text-text-sec bg-bg-elevated hover:bg-bg-overlay hover:border-border-mid hover:text-text-pri'
      )}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy Command'}
    </button>
  );
}

const TERM_LINES = [
  { d: 0,    t: 'cmd',  text: '$ npx soupz' },
  { d: 600,  t: 'out',  text: 'Starting agent server...' },
  { d: 1100, t: 'out',  text: 'Tunnel established' },
  { d: 1600, t: 'pair', text: '4 7 B - 2 9 X - 1 K 5' },
  { d: 2600, t: 'out',  text: 'Waiting for connection...' },
  { d: 3600, t: 'ok',   text: 'Connected from iPhone 15 Pro' },
  { d: 4100, t: 'ok',   text: 'Claude + Gemini + Copilot ready' },
];

function AnimTerminal() {
  const [count, setCount] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    setCount(0);
    const timers = TERM_LINES.map((l, i) => setTimeout(() => setCount(i + 1), l.d + 300));
    const restart = setTimeout(() => setRun(r => r + 1), 6000);
    return () => { timers.forEach(clearTimeout); clearTimeout(restart); };
  }, [run]);

  return (
    <div className="h-[300px] rounded-2xl border border-white/10 bg-black/50 backdrop-blur-2xl overflow-hidden shadow-2xl flex flex-col">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/10 bg-white/5">
        <span className="w-3 h-3 rounded-full bg-danger/80" />
        <span className="w-3 h-3 rounded-full bg-warning/80" />
        <span className="w-3 h-3 rounded-full bg-success/80" />
        <span className="ml-3 text-xs font-mono text-text-faint">terminal // main session</span>
      </div>
      <div className="p-6 font-mono text-sm leading-[1.8] flex-1 overflow-hidden">
        {TERM_LINES.slice(0, count).map((line, i) => {
          if (line.t === 'pair') {
            return (
              <div key={i} className="my-5 text-center">
                <div className="inline-block tracking-[0.4em] font-bold text-xl px-8 py-4 rounded-xl border border-accent/30 bg-accent/10 text-accent" style={{ animation: 'pulseGlow 2.5s infinite' }}>
                  {line.text}
                </div>
              </div>
            );
          }
          return (
            <div key={i} className={cn('break-words whitespace-pre-wrap', line.t === 'cmd' && 'text-text-pri', line.t === 'out' && 'text-text-faint', line.t === 'ok' && 'text-success')} style={{ animation: 'fadeUp 0.3s ease both' }}>
              {line.t === 'out' && <span className="text-text-faint mr-2">{'>'}</span>}
              {line.t === 'ok' && <span className="mr-2">{'✓'}</span>}
              {line.text}
            </div>
          );
        })}
        {count < TERM_LINES.length && <span className="inline-block w-2.5 h-4 bg-text-sec ml-1 translate-y-1" style={{ animation: 'blink 1.2s step-end infinite' }} />}
      </div>
    </div>
  );
}

function PhoneMockup() {
  const messages = [
    { role: 'user', text: 'Add a dark mode toggle logic.' },
    { role: 'ai', agent: 'Claude', text: 'Done. Configured local storage hook.' },
    { role: 'user', text: 'Ensure the glassmorphism drops on mobile.' },
    { role: 'ai', agent: 'Gemini', text: 'Removed backdrop-filter under md breakpoint.' },
  ];

  return (
    <div className="w-[260px] rounded-[40px] border-[8px] border-black/40 bg-bg-base overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      {/* iPhone Dynamic Island */}
      <div className="absolute top-2 inset-x-0 h-6 bg-black rounded-full w-24 mx-auto z-20 flex justify-center items-center">
        <div className="w-10 h-1.5 rounded-full bg-white/5 mx-auto"></div>
      </div>
      <div className="flex items-center justify-between px-7 pt-10 pb-3 text-[11px] font-ui text-text-faint font-medium">
        <span>9:41</span>
        <div className="flex gap-1.5"><Wifi size={11} /><Smartphone size={11} /></div>
      </div>
      <div className="px-4 py-5 flex flex-col gap-4 min-h-[250px] bg-gradient-to-b from-transparent to-bg-surface/50">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[90%] rounded-2xl px-4 py-3 text-[12px] leading-relaxed font-ui shadow-sm', m.role === 'user' ? 'bg-accent text-white rounded-br-sm' : 'bg-bg-elevated/80 backdrop-blur-md text-text-pri border border-white/10 rounded-bl-sm')}>
              {m.agent && <span className="text-[10px] font-bold text-accent block mb-1 uppercase tracking-wider">{m.agent}</span>}
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 pb-6 pt-3">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-full border border-white/10 bg-bg-surface/80 backdrop-blur-xl">
          <Mic size={16} className="text-text-faint" />
          <div className="flex-1 text-[11px] text-text-faint">Ask Claude to fix...</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BENTO BOX CARD INTERACTION
   ═══════════════════════════════════════════════════════════════════ */
function BentoCard({ children, className, glow = false }) {
  const cardRef = useRef(null);
  
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty('--mouse-x', `${x}px`);
    cardRef.current.style.setProperty('--mouse-y', `${y}px`);
  };

  return (
    <div 
      ref={cardRef} 
      onMouseMove={handleMouseMove} 
      className={cn('bento-card group flex flex-col p-10', className, glow && 'border-accent/20 bg-accent/[0.04]')}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function LandingMorphism({ navigate }) {
  return (
    <div className="theme-morphism min-h-screen bg-bg-base text-text-pri font-ui selection:bg-accent/30 pb-32 overflow-hidden relative">
      <style>{STYLES}</style>
      
      {/* ═══ BACKGROUND GRID & ELEMENTS ═══════════════════════════════ */}
      <BackgroundElements />

      {/* ═══ NAVBAR ═══════════════════════════════════════════════════ */}
      <header className="fixed top-0 inset-x-0 z-50 h-20 flex items-center px-6 md:px-10 border-b border-white/5 bg-bg-base/40 backdrop-blur-3xl transition-all">
        <div className="max-w-[1400px] w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shadow-[0_0_15px_var(--accent-glow)]">
              <Terminal size={16} className="text-white" />
            </div>
            <span className="font-ui font-bold text-xl tracking-tight">soupz</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate?.('/docs')}
              className="hidden md:inline-flex text-sm font-medium text-text-sec hover:text-text-pri transition-colors"
            >
              Documentation
            </button>
            <button
              onClick={() => navigate?.('/dashboard')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black hover:scale-105 active:scale-95 text-sm font-semibold transition-transform"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ═══ HERO SECTION ═════════════════════════════════════════════ */}
      <section className="relative pt-40 pb-24 px-6 md:px-10 overflow-visible">
        <div className="relative max-w-[1000px] mx-auto text-center z-10">
          
          <Reveal delay={0}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/30 bg-accent/10 mb-8 backdrop-blur-md">
              <Sparkles size={14} className="text-accent" />
              <span className="text-sm font-bold text-accent tracking-wide">SOUPZ CLI</span>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <h1 className="font-ui font-extrabold tracking-tighter leading-[1.05] mb-8" style={{ fontSize: 'clamp(3.5rem, 8vw, 6.5rem)' }}>
              Code the future.<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-text-pri via-text-sec to-accent">From anywhere.</span>
            </h1>
          </Reveal>

          <Reveal delay={300}>
            <p className="text-text-sec text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto mb-6 font-medium">
              Launch local AI agents on your machine. Command them securely from your browser, tablet, or phone.
            </p>
            <div className="inline-block px-4 py-1.5 rounded-full border border-success/30 bg-success/10 mb-8">
              <span className="text-sm font-bold text-success">Free to use</span>
            </div>
          </Reveal>

          <Reveal delay={450}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
               <div className="flex items-center rounded-xl p-1.5 border border-white/10 bg-bg-surface/50 backdrop-blur-3xl shadow-2xl transition-all hover:border-white/20">
                 <div className="px-6 py-2 font-mono text-base font-bold text-text-pri select-all">npx soupz</div>
                 <CopyBtn text="npx soupz" />
               </div>
               <a href="https://www.npmjs.com/package/soupz" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-6 py-3.5 rounded-xl border border-success/25 bg-success/10 hover:bg-success/20 hover:-translate-y-1 text-success font-bold transition-all shadow-xl group">
                 <Zap size={18} className="group-hover:scale-110 transition-transform" />
                 npm Package
               </a>
               {SHOW_SOURCE_LINKS ? (
                 <a href="https://github.com/Soham-Prajapati/soupz-stall" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-6 py-3.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:-translate-y-1 text-text-pri font-bold transition-all shadow-xl group">
                   <Github size={18} className="group-hover:rotate-12 transition-transform" />
                   GitHub Repo
                 </a>
               ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ BENTO BOX GRID ═══════════════════════════════════════════ */}
      <section className="py-24 px-8 md:px-12 relative z-10">
        <div className="max-w-[1500px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 auto-rows-[350px] md:auto-rows-[420px]">
            
            {/* Bento 1: Multi-Agent Orchestration (Row 1-2, Col 1-2) ------- */}
            <div className="md:col-span-2 md:row-span-2">
              <Reveal className="h-full">
                <BentoCard className="h-full p-0 flex flex-col overflow-hidden">
                  <div className="p-10 md:p-12 z-20">
                    <div className="w-12 h-12 rounded-[20px] bg-accent/10 border border-accent/20 flex items-center justify-center mb-6 shadow-inner">
                      <Layers size={24} className="text-accent" />
                    </div>
                    <h3 className="text-3xl font-black mb-4 tracking-tighter">Multi-Agent Orchestration.</h3>
                    <p className="text-lg text-text-sec max-w-md leading-relaxed font-medium tracking-tight">
                      Deploy a team of AI agents working in parallel. Route tasks, decompose complexity, and synthesize results in real-time.
                    </p>
                  </div>
                  <div className="mt-auto px-8 pb-0 md:px-16 relative group h-full flex flex-col justify-end pt-4">
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg-base to-transparent z-10 pointer-events-none" />
                    <div className="transform translate-y-4 group-hover:translate-y-0 transition-all duration-1000 w-full md:w-[96%] mx-auto z-20">
                      <AnimTerminal />
                    </div>
                  </div>
                </BentoCard>
              </Reveal>
            </div>

            {/* Bento 2: Secure & Local (Row 1, Col 3) -------------- */}
            <div className="md:col-span-1 md:row-span-1">
              <Reveal delay={150} className="h-full">
                <BentoCard className="h-full text-center items-center justify-center bg-gradient-to-br from-bg-surface/30 to-transparent relative overflow-hidden border-white/5">
                  <Lock size={96} className="text-accent/5 absolute -right-6 -bottom-6 rotate-12" />
                  <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(52,211,153,0.1)] relative z-10">
                    <Lock size={28} className="text-success" />
                  </div>
                  <h3 className="text-2xl font-black mb-3 tracking-tighter relative z-10">Hardened Privacy</h3>
                  <p className="text-text-sec font-medium max-w-xs relative z-10 text-sm">Your tokens, your code, your rules. Nothing is ever stored on our relays.</p>
                </BentoCard>
              </Reveal>
            </div>

            {/* Bento 3: Phone Mockup (Row 2-3, Col 3) ------------- */}
            <div className="md:col-span-1 md:row-span-2">
              <Reveal delay={300} className="h-full">
                 <BentoCard className="h-full p-0 flex flex-col overflow-hidden relative">
                  <div className="p-8 pb-0 text-left z-20">
                     <div className="w-12 h-12 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center mb-4 shadow-inner">
                      <Smartphone size={24} className="text-warning" />
                    </div>
                    <h3 className="text-2xl font-black mb-2 tracking-tighter">Mobile Brain.</h3>
                    <p className="text-text-sec text-sm max-w-[200px] font-medium tracking-tight">Full IDE power in the palm of your hand. Zero compromises.</p>
                  </div>
                  <div className="mt-auto w-full flex justify-center z-10 px-4 pt-8">
                    <div className="transform translate-y-12 group-hover:translate-y-8 transition-transform duration-700">
                      <PhoneMockup />
                    </div>
                  </div>
                </BentoCard>
              </Reveal>
            </div>

            {/* Bento 4: Vision + Image Upload (Row 3, Col 1) ----------------- */}
            <div className="md:col-span-1 md:row-span-1">
              <Reveal delay={0} className="h-full">
                <BentoCard glow className="h-full justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center mt-2">
                    <Search size={24} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black mb-2 tracking-tighter">Vision + Images.</h3>
                    <p className="text-text-sec font-medium text-sm tracking-tight">Upload screenshots and designs. Vision agents analyze, extract, and implement in seconds.</p>
                  </div>
                </BentoCard>
              </Reveal>
            </div>

            {/* Bento 6: Builder Mode (Row 3, Col 2) -------------- */}
            <div className="md:col-span-1 md:row-span-1">
              <Reveal delay={150} className="h-full">
                <BentoCard className="h-full justify-between bg-gradient-to-tr from-accent/5 to-transparent">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mt-2">
                    <Sparkles size={24} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black mb-2 tracking-tighter">Builder Mode.</h3>
                    <p className="text-text-sec font-medium text-sm tracking-tight">Chat + live preview. Design UIs with natural language, see changes in real-time.</p>
                  </div>
                </BentoCard>
              </Reveal>
            </div>

            {/* Bento 5: Free Agents + Collaboration (Row 4, Col 1-3) ----- */}
            <div className="md:col-span-3 md:row-span-1">
              <Reveal delay={150} className="h-full">
                <BentoCard className="h-full flex flex-col md:flex-row items-center gap-12 bg-bg-elevated/20">
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-3xl font-black mb-4 tracking-tighter">Free Agents + Real-time Relay.</h3>
                    <p className="text-lg text-text-sec font-medium max-w-lg tracking-tight leading-relaxed">
                      Work with free agents—no paid subscription required. Real-time collaboration via Supabase relay. Your code, your machine, your rules.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 flex-1">
                    {CLI_AGENTS.map((agent, i) => {
                      const Icon = agent.icon;
                      return (
                        <div key={agent.id} className="relative group/icon cursor-pointer animate-float" style={{ animationDelay: `${i * 250}ms` }}>
                          <div className="w-16 h-16 rounded-[20px] border border-white/5 bg-white/5 flex items-center justify-center shadow-lg group-hover/icon:scale-110 group-hover/icon:border-accent/40 group-hover/icon:bg-white/10 transition-all duration-500">
                            <Icon size={28} style={{ color: agent.color }} />
                          </div>
                          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/icon:opacity-100 transition-opacity text-[9px] font-black uppercase tracking-[0.2em] text-accent whitespace-nowrap">
                            {agent.name}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </BentoCard>
              </Reveal>
            </div>
            
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ══════════════════════════════════════════════════ */}
      <footer className="mt-32 border-t border-white/5 bg-bg-surface/30 backdrop-blur-3xl px-8 py-16 relative z-10">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center shadow-xl">
                <Terminal size={20} />
              </div>
              <span className="font-ui font-black text-2xl tracking-tighter">soupz</span>
            </div>
            <p className="text-text-faint font-bold text-xs tracking-widest uppercase mt-1">
              The Architecture of Intelligence.
            </p>
          </div>
          
          <div className="flex items-center gap-8 text-xs font-bold text-text-sec uppercase tracking-widest">
            <a href="#" className="hover:text-text-pri transition-colors">GitHub</a>
            <a href="#" className="hover:text-text-pri transition-colors">Twitter</a>
            <a href="#" className="hover:text-text-pri transition-colors">Discord</a>
          </div>

          <div className="text-text-faint text-[10px] font-mono">
            &copy; 2026 SOUPZ LABS. ALL RIGHTS RESERVED.
          </div>
        </div>
      </footer>
    </div>
  );
}
