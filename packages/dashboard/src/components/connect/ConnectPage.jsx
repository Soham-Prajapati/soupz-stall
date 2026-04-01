import { useState, useEffect, useRef, forwardRef } from 'react';
import { Terminal, CheckCircle, XCircle, ArrowRight, RefreshCw, QrCode, Keyboard, Shield, ArrowLeft } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../../lib/cn';
import { supabase } from '../../lib/supabase';
import { checkDaemonHealth } from '../../lib/daemon';

const LOCAL_DAEMON_PORT = 7533;
const CODE_TTL_MS = 300_000; // 5 minutes

function isProbablyMobileDevice() {
  if (typeof window === 'undefined') return false;
  const ua = (window.navigator?.userAgent || '').toLowerCase();
  const isMobileUA = /android|iphone|ipad|ipod|mobile/.test(ua);
  const isSmallViewport = window.matchMedia?.('(max-width: 768px)')?.matches;
  return Boolean(isMobileUA || isSmallViewport);
}

function normalizeBaseUrl(target, fallbackPort) {
  if (!target || typeof target !== 'string') return null;
  const trimmed = target.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed.replace(/\/$/, '');
  if (trimmed.includes(':')) return `http://${trimmed}`;
  return `http://${trimmed}:${fallbackPort}`;
}

function resolveRemoteCandidates(pairingRow) {
  const port = pairingRow?.port || LOCAL_DAEMON_PORT;
  const rawTargets = Array.isArray(pairingRow?.lan_ips) ? pairingRow.lan_ips : [];
  const normalized = rawTargets.map((target) => normalizeBaseUrl(target, port)).filter(Boolean);
  return Array.from(new Set(normalized));
}

async function parseJsonSafe(response) {
  try { return await response.json(); } catch { return null; }
}

function normalizePairingPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const token = payload.token || payload.sessionToken || null;
  if (!token) return null;
  return { ...payload, token, success: payload.success !== false };
}

async function tryPairAgainstBase(baseUrl, code, timeoutMs = 2000) {
  const base = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  const endpoints = [
    base ? `${base}/api/pair` : '/api/pair',
    base ? `${base}/pair/validate` : '/pair/validate',
  ];
  let lastData = null;
  for (const target of endpoints) {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await parseJsonSafe(res);
    lastData = data;
    const normalized = normalizePairingPayload(data);
    if (res.ok && normalized?.token) return { ok: true, data: normalized, baseUrl: baseUrl || window.location.origin };
  }
  return { ok: false, data: lastData };
}

// ── Apple-style countdown ring ───────────────────────────────────────────────

export function CountdownRing({ remainingMs, totalMs = CODE_TTL_MS, size = 120 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs));
  const offset = circumference * (1 - progress);
  const isLow = remainingMs < 60_000;
  const isExpired = remainingMs <= 0;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background ring */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        strokeWidth={3}
        className="stroke-border-subtle"
      />
      {/* Progress ring */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={cn(
          'transition-[stroke-dashoffset] duration-1000 ease-linear',
          isExpired ? 'stroke-border-subtle' : isLow ? 'stroke-danger' : 'stroke-accent',
        )}
      />
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ConnectPage({ getParam, navigate }) {
  const urlCode = getParam?.('code') || '';
  const [digits, setDigits] = useState(urlCode.replace(/-/g, '').slice(0, 9).split('').concat(Array(9).fill('')).slice(0, 9));
  const [status, setStatus] = useState('idle');
  const [machine, setMachine] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [connectMode, setConnectMode] = useState(urlCode ? 'share' : 'code'); // code | qr | share
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [alreadyConnected, setAlreadyConnected] = useState(null); // { hostname } | null
  const inputRefs = useRef([]);

  // Countdown state
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + CODE_TTL_MS);
  const [remainingMs, setRemainingMs] = useState(CODE_TTL_MS);

  const code = digits.join('');
  const isComplete = code.length === 9 && digits.every(d => d !== '');

  // Detect mobile
  useEffect(() => { setIsMobileDevice(isProbablyMobileDevice()); }, []);

  // Check if already connected
  useEffect(() => {
    const token = localStorage.getItem('soupz_daemon_token');
    const hostname = localStorage.getItem('soupz_hostname');
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const online = await checkDaemonHealth();
        if (!cancelled && online) setAlreadyConnected({ hostname: hostname || 'Unknown' });
      } catch { /* not connected */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // URL code auto-fill and auto-connect (mobile or remote deep-link)
  useEffect(() => {
    if (!urlCode) return;
    const clean = urlCode.replace(/-/g, '').slice(0, 9);
    const digitsArray = clean.padEnd(9, ' ').split('').map(ch => (ch.trim() || ''));
    setDigits(digitsArray);
    const remoteHint = typeof window !== 'undefined' && window.sessionStorage?.getItem('soupz_auto_remote_hint') === '1';
    if (remoteHint && typeof window !== 'undefined') {
      window.sessionStorage.removeItem('soupz_auto_remote_hint');
    }
    if (clean.length === 9) {
      if (remoteHint || isProbablyMobileDevice()) handleConnect(clean);
      else setConnectMode('share');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If no URL code, try fetching the current active code from daemon
  useEffect(() => {
    if (urlCode) return;
    if (connectMode === 'share') return;
    fetchCurrentCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  // Countdown ticker
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, expiresAt - Date.now());
      setRemainingMs(remaining);
      if (remaining <= 0) {
        // Auto-refresh code
        fetchCurrentCode();
      }
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  async function fetchCurrentCode() {
    // Try same-origin first, then stored daemon URL
    const urls = [
      '',
      localStorage.getItem('soupz_daemon_url'),
      `http://localhost:${LOCAL_DAEMON_PORT}`,
    ].filter(Boolean);

    for (const base of urls) {
      try {
        const endpoint = base ? `${base}/pair/current` : '/pair/current';
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(1500) });
        const data = await parseJsonSafe(res);
        const currentCode = (data?.code || '').toString().replace(/[^A-Z0-9]/gi, '').slice(0, 9);
        if (currentCode.length === 9) {
          setDigits(currentCode.split(''));
          const ttl = (data?.expiresIn || 300) * 1000;
          setExpiresAt(Date.now() + ttl);
          setRemainingMs(ttl);
          if (!isProbablyMobileDevice()) setConnectMode('share');
          return;
        }
      } catch { /* try next */ }
    }
  }

  async function handleConnect(overrideCode) {
    const c = overrideCode || code;
    if (c.length !== 9) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const proxied = await tryPairAgainstBase(null, c, 2200);
      if (proxied.ok) { finishConnect(proxied.data, proxied.baseUrl); return; }
    } catch {}

    try {
      const remembered = localStorage.getItem('soupz_daemon_url');
      if (remembered) {
        const result = await tryPairAgainstBase(remembered, c, 2200);
        if (result.ok) { finishConnect(result.data, result.baseUrl); return; }
      }
    } catch {}

    try {
      const localUrl = `http://localhost:${LOCAL_DAEMON_PORT}`;
      const result = await tryPairAgainstBase(localUrl, c, 1500);
      if (result.ok) { finishConnect(result.data, localUrl); return; }
    } catch {}

    try {
      if (!supabase) throw new Error('Remote pairing unavailable (Supabase not configured).');
      const { data, error } = await supabase.from('soupz_pairing').select('*').eq('code', c).single();
      if (error || !data) throw new Error('Invalid pairing code');
      if (new Date(data.expires_at) < new Date()) throw new Error('Code expired');

      const candidates = resolveRemoteCandidates(data);
      for (const baseUrl of candidates) {
        try {
          const result = await tryPairAgainstBase(baseUrl, c, 2500);
          if (result.ok) { finishConnect(result.data, baseUrl); return; }
        } catch {}
      }
      finishConnect(data, null);
    } catch (err) {
      setErrorMsg(err.message || 'Could not connect. Make sure npx soupz is running.');
      setStatus('error');
    }
  }

  function finishConnect(data, url) {
    setMachine(data);
    setStatus('success');
    if (data.token) {
      localStorage.setItem('soupz_daemon_token', data.token);
      sessionStorage.setItem('soupz_daemon_token', data.token);
    }
    if (data.hostname) localStorage.setItem('soupz_hostname', data.hostname);
    if (url) localStorage.setItem('soupz_daemon_url', url);
    else localStorage.removeItem('soupz_daemon_url');
    setTimeout(() => navigate('/dashboard'), 1200);
  }

  function onDigitChange(idx, val) {
    const char = val.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    if (char && idx < 8) inputRefs.current[idx + 1]?.focus();
  }

  function onKeyDown(idx, e) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === 'Enter' && isComplete) handleConnect();
  }

  function onPaste(e) {
    e.preventDefault();
    const raw = (e.clipboardData || window.clipboardData)?.getData('text') || '';
    const pasted = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 9);
    const next = pasted.split('').concat(Array(9).fill('')).slice(0, 9);
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 8)]?.focus();
    if (pasted.length === 9) handleConnect(pasted);
  }

  function reset() {
    setDigits(Array(9).fill(''));
    setStatus('idle');
    setErrorMsg('');
    inputRefs.current[0]?.focus();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const showShareCode = () => {
    fetchCurrentCode();
    setConnectMode('share');
  };

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <Terminal size={16} className="text-white" />
        </div>
        <span className="text-text-pri font-ui font-semibold text-lg tracking-tight">Soupz</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-bg-surface border border-border-subtle rounded-xl p-5 sm:p-8 shadow-soft">
        {status === 'success' ? (
          <SuccessState machine={machine} />
        ) : connectMode === 'share' ? (
          // Desktop "Share this code" view (auto-opened from npx soupz)
          <ShareCodeView
            code={code}
            isComplete={isComplete}
            remainingMs={remainingMs}
            onEnterManually={() => setConnectMode('code')}
          />
        ) : alreadyConnected ? (
          <AlreadyConnectedState
            hostname={alreadyConnected.hostname}
            onDashboard={() => navigate('/dashboard')}
            onNewConnection={() => { setAlreadyConnected(null); setConnectMode('code'); }}
            onShowCode={showShareCode}
          />
        ) : (
          <>
            <h1 className="text-text-pri font-ui text-xl font-semibold mb-1.5">Connect your machine</h1>
            <p className="text-text-sec text-sm mb-4 leading-relaxed">
              Run{' '}
              <code className="font-mono text-accent text-xs bg-bg-elevated px-1.5 py-0.5 rounded">npx soupz</code>
              {' '}in your terminal, then connect below.
            </p>

            {/* Mode tabs */}
            <div className="flex items-center gap-1 bg-bg-base rounded-md p-0.5 border border-border-subtle mb-5">
              <button
                onClick={() => setConnectMode('code')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-ui font-medium transition-all',
                  connectMode === 'code'
                    ? 'bg-bg-elevated text-text-pri border border-border-subtle'
                    : 'text-text-faint hover:text-text-sec',
                )}
              >
                <Keyboard size={12} />
                Enter Code
              </button>
              <button
                onClick={() => setConnectMode('qr')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-ui font-medium transition-all',
                  connectMode === 'qr'
                    ? 'bg-bg-elevated text-text-pri border border-border-subtle'
                    : 'text-text-faint hover:text-text-sec',
                )}
              >
                <QrCode size={12} />
                Scan QR
              </button>
            </div>

            {connectMode === 'qr' ? (
              <QRConnectMode code={code} remainingMs={remainingMs} onManual={() => setConnectMode('code')} isMobileDevice={isMobileDevice} />
            ) : (
            <>
              {/* Code input: 3 groups of 3 for 9 chars */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 justify-center max-w-full">
                <div className="flex gap-1 sm:gap-1.5">
                  {[0,1,2].map(i => (
                    <DigitInput
                      key={i}
                      ref={el => inputRefs.current[i] = el}
                      value={digits[i]}
                      onChange={v => onDigitChange(i, v)}
                      onKeyDown={e => onKeyDown(i, e)}
                      onPaste={onPaste}
                      hasError={status === 'error'}
                    />
                  ))}
                </div>
                <span className="text-text-faint text-lg font-bold mx-0.5">-</span>
                <div className="flex gap-1 sm:gap-1.5">
                  {[3,4,5].map(i => (
                    <DigitInput
                      key={i}
                      ref={el => inputRefs.current[i] = el}
                      value={digits[i]}
                      onChange={v => onDigitChange(i, v)}
                      onKeyDown={e => onKeyDown(i, e)}
                      onPaste={onPaste}
                      hasError={status === 'error'}
                    />
                  ))}
                </div>
                <span className="text-text-faint text-lg font-bold mx-0.5">-</span>
                <div className="flex gap-1 sm:gap-1.5">
                  {[6,7,8].map(i => (
                    <DigitInput
                      key={i}
                      ref={el => inputRefs.current[i] = el}
                      value={digits[i]}
                      onChange={v => onDigitChange(i, v)}
                      onKeyDown={e => onKeyDown(i, e)}
                      onPaste={onPaste}
                      hasError={status === 'error'}
                    />
                  ))}
                </div>
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-2 text-danger text-sm mb-4 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                  <XCircle size={14} className="shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                onClick={() => handleConnect()}
                disabled={!isComplete || status === 'loading'}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium font-ui transition-all',
                  isComplete && status !== 'loading'
                    ? 'bg-accent hover:bg-accent-hover text-white cursor-pointer'
                    : 'bg-bg-elevated text-text-faint cursor-not-allowed',
                )}
              >
                {status === 'loading' ? <RefreshCw size={14} className="animate-spin" /> : <>Connect <ArrowRight size={14} /></>}
              </button>

              {status === 'error' && (
                <button onClick={reset} className="mt-3 w-full text-center text-text-sec hover:text-text-pri text-xs transition-colors py-1">
                  Try a different code
                </button>
              )}

              {/* Security note */}
              <div className="mt-5 flex items-start gap-2 px-3 py-2.5 rounded-lg border border-border-subtle bg-bg-base">
                <Shield size={12} className="text-text-faint shrink-0 mt-0.5" />
                <p className="text-[11px] text-text-faint leading-relaxed">
                  Each code is single-use and expires in 5 minutes. Your code stays private to your machine.
                </p>
              </div>

              {/* Instructions */}
              <div className="mt-5 pt-5 border-t border-border-subtle">
                <p className="text-text-faint text-xs font-ui mb-3 uppercase tracking-wider">How to get a code</p>
                <ol className="space-y-2">
                  {[
                    'Open Terminal on your machine',
                    'Run: npx soupz',
                    'Scan the terminal QR or enter the 9-character code above',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-text-sec text-sm">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-bg-elevated border border-border-subtle text-text-faint text-xs flex items-center justify-center font-mono">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SuccessState({ machine }) {
  return (
    <div className="text-center py-2">
      <div className="w-12 h-12 rounded-full bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={22} className="text-success" />
      </div>
      <h2 className="text-text-pri font-ui font-semibold text-lg mb-1">Connected!</h2>
      {machine?.hostname && (
        <p className="text-text-sec text-sm mb-4">
          Linked to <span className="text-text-pri font-mono text-xs bg-bg-elevated px-1.5 py-0.5 rounded">{machine.hostname}</span>
        </p>
      )}
      <p className="text-text-faint text-xs">Redirecting to dashboard...</p>
    </div>
  );
}

function AlreadyConnectedState({ hostname, onDashboard, onNewConnection, onShowCode }) {
  return (
    <div className="text-center py-2">
      <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
        <Terminal size={22} className="text-accent" />
      </div>
      <h2 className="text-text-pri font-ui font-semibold text-lg mb-1">Already connected</h2>
      <p className="text-text-sec text-sm mb-6">
        Linked to <span className="text-text-pri font-mono text-xs bg-bg-elevated px-1.5 py-0.5 rounded">{hostname}</span>
      </p>
      <button
        onClick={onDashboard}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium font-ui bg-accent hover:bg-accent-hover text-white transition-all mb-3"
      >
        Go to Dashboard <ArrowRight size={14} />
      </button>
      <button
        onClick={onShowCode}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium font-ui border border-border-subtle text-text-sec hover:text-text-pri hover:border-border-mid transition-all mb-3"
      >
        Show current pairing code
      </button>
      <button
        onClick={onNewConnection}
        className="text-text-sec hover:text-text-pri text-xs transition-colors"
      >
        Connect a different machine
      </button>
    </div>
  );
}

export function ShareCodeView({ code, isComplete, remainingMs, onEnterManually }) {
  const connectUrl = isComplete ? `${window.location.origin}/code?code=${code}` : null;

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <h2 className="text-text-pri font-ui font-semibold text-lg">Share this code</h2>
      <p className="text-text-sec text-xs text-center leading-relaxed -mt-3">
        Scan the QR or enter the code on your phone
      </p>

      {/* Countdown ring with code inside */}
      <div className="relative flex items-center justify-center">
        <CountdownRing remainingMs={remainingMs} size={140} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isComplete ? (
            <span className="font-mono text-xl font-bold text-text-pri tracking-widest">
              {code.slice(0, 4)}-{code.slice(4)}
            </span>
          ) : (
            <span className="text-text-faint text-sm">Waiting...</span>
          )}
        </div>
      </div>

      {/* QR code */}
      {connectUrl && (
        <div className="bg-white p-3 rounded-xl">
          <QRCodeSVG value={connectUrl} size={160} level="M" bgColor="#ffffff" fgColor="#0F0F13" />
        </div>
      )}

      {/* Security note */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-border-subtle bg-bg-base w-full">
        <Shield size={12} className="text-text-faint shrink-0 mt-0.5" />
        <p className="text-[11px] text-text-faint leading-relaxed">
          Single-use code. Expires when the ring empties, then auto-refreshes.
        </p>
      </div>

      {onEnterManually && (
        <button
          onClick={onEnterManually}
          className="text-text-sec hover:text-text-pri text-xs transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft size={11} /> Enter code manually instead
        </button>
      )}
    </div>
  );
}

function QRConnectMode({ code, remainingMs, onManual, isMobileDevice }) {
  const connectUrl = code.length === 9 ? `${window.location.origin}/code?code=${code}` : null;

  if (isMobileDevice) {
    return (
      <div className="text-center py-6">
        <QrCode size={32} className="text-text-faint mx-auto mb-3 opacity-30" />
        <p className="text-text-pri text-sm font-ui mb-1">Use this phone to scan laptop QR</p>
        <p className="text-text-sec text-xs font-ui leading-relaxed">
          Open this connect page on your laptop, keep the QR visible there,
          then scan it with your phone camera.
        </p>
        <button onClick={onManual} className="mt-3 text-accent hover:text-accent-hover text-xs font-ui transition-colors">
          Enter code manually instead
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {connectUrl ? (
        <>
          {/* Countdown ring around QR */}
          <div className="relative flex items-center justify-center">
            <CountdownRing remainingMs={remainingMs} size={Math.min(210, typeof window !== 'undefined' ? window.innerWidth - 140 : 210)} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white p-2 sm:p-2.5 rounded-xl">
                <QRCodeSVG value={connectUrl} size={Math.min(160, typeof window !== 'undefined' ? window.innerWidth - 200 : 160)} level="M" bgColor="#ffffff" fgColor="#0F0F13" />
              </div>
            </div>
          </div>
          <p className="text-text-sec text-xs font-ui text-center leading-relaxed">
            Scan this QR code with your phone camera
          </p>
          <div className="flex items-center gap-2 text-text-faint text-[11px] font-mono bg-bg-elevated px-3 py-1.5 rounded-md border border-border-subtle">
            Code: {code.slice(0, 4)}-{code.slice(4)}
          </div>
        </>
      ) : (
        <div className="text-center py-6">
          <QrCode size={32} className="text-text-faint mx-auto mb-3 opacity-30" />
          <p className="text-text-sec text-sm font-ui mb-1">No code available yet</p>
          <p className="text-text-faint text-xs font-ui">
            Run <code className="font-mono text-accent bg-bg-elevated px-1 rounded">npx soupz</code> first,
            then enter the code manually to generate a QR.
          </p>
          <button onClick={onManual} className="mt-3 text-accent hover:text-accent-hover text-xs font-ui transition-colors">
            Enter code manually
          </button>
        </div>
      )}
    </div>
  );
}

const DigitInput = forwardRef(function DigitInput({ value, onChange, onKeyDown, onPaste, hasError }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="text"
      maxLength={1}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      autoCapitalize="characters"
      autoCorrect="off"
      spellCheck="false"
      className={cn(
        'w-8 h-10 sm:w-10 sm:h-12 rounded-md text-center font-mono text-base sm:text-lg font-medium caret-accent',
        'bg-bg-elevated border transition-all outline-none',
        hasError
          ? 'border-danger/50 text-danger'
          : value
            ? 'border-accent text-text-pri shadow-accent'
            : 'border-border-subtle text-text-pri focus:border-accent',
      )}
    />
  );
});
