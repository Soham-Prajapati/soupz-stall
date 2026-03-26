import { useState, useEffect, useRef } from 'react';
import { Terminal, CheckCircle, XCircle, ArrowRight, RefreshCw, QrCode, Keyboard } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '../../lib/cn';
import { supabase } from '../../lib/supabase';

// Connect to daemon - can be localhost or an IP from Supabase pairing table
const LOCAL_DAEMON_PORT = 7533;

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

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/$/, '');
  }

  // Accept both raw IP/host and host:port strings.
  if (trimmed.includes(':')) {
    return `http://${trimmed}`;
  }

  return `http://${trimmed}:${fallbackPort}`;
}

function resolveRemoteCandidates(pairingRow) {
  const port = pairingRow?.port || LOCAL_DAEMON_PORT;
  const rawTargets = Array.isArray(pairingRow?.lan_ips) ? pairingRow.lan_ips : [];
  const normalized = rawTargets
    .map((target) => normalizeBaseUrl(target, port))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function normalizePairingPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const token = payload.token || payload.sessionToken || null;
  if (!token) return null;
  return {
    ...payload,
    token,
    success: payload.success !== false,
  };
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
    if (res.ok && normalized?.token) {
      return { ok: true, data: normalized, baseUrl: baseUrl || window.location.origin };
    }
  }

  return { ok: false, data: lastData };
}

export default function ConnectPage({ getParam, navigate }) {
  const urlCode = getParam?.('code') || '';
  const [digits, setDigits] = useState(urlCode.replace(/-/g, '').slice(0, 8).split('').concat(Array(8).fill('')).slice(0, 8));
  const [status, setStatus]   = useState('idle'); // idle | loading | success | error
  const [machine, setMachine] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [connectMode, setConnectMode] = useState(urlCode ? 'qr' : 'code'); // code | qr
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const inputRefs = useRef([]);

  const code = digits.join('');
  const isComplete = code.length === 8 && digits.every(d => d !== '');

  useEffect(() => {
    setIsMobileDevice(isProbablyMobileDevice());
  }, []);

  useEffect(() => {
    if (urlCode) {
      const clean = urlCode.replace(/-/g, '').slice(0, 8);
      setDigits(clean.padEnd(8, '').split(''));
      if (clean.length === 8) {
        // Auto-connect only on mobile-sized devices where the user likely arrived via QR scan.
        // Keep desktop on the QR tab so the laptop screen remains scannable.
        if (isProbablyMobileDevice()) handleConnect(clean);
        else setConnectMode('qr');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // If page opens without ?code, try reading the currently active daemon pairing snapshot
    // from the same origin (works for tunneled local dev and local dashboard).
    if (urlCode) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/pair/current', { signal: AbortSignal.timeout(1200) });
        const data = await parseJsonSafe(res);
        const currentCode = (data?.code || '').toString().replace(/\D/g, '').slice(0, 8);
        if (cancelled || currentCode.length !== 8) return;
        setDigits(currentCode.split(''));
        setConnectMode('qr');
      } catch {
        // Ignore: this endpoint may not exist on deployed frontend origins.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urlCode]);

  async function handleConnect(overrideCode) {
    const c = overrideCode || code;
    if (c.length !== 8) return;
    setStatus('loading');
    setErrorMsg('');

    // 1. Try same-origin proxy first (works for local/tunneled web dashboards)
    try {
      const proxied = await tryPairAgainstBase(null, c, 2200);
      if (proxied.ok) {
        finishConnect(proxied.data, proxied.baseUrl);
        return;
      }
    } catch { /* not available on this origin */ }

    // 2. Try remembered daemon URL from previous successful session
    try {
      const remembered = localStorage.getItem('soupz_daemon_url');
      if (remembered) {
        const rememberedResult = await tryPairAgainstBase(remembered, c, 2200);
        if (rememberedResult.ok) {
          finishConnect(rememberedResult.data, rememberedResult.baseUrl);
          return;
        }
      }
    } catch { /* continue */ }

    // 3. Try localhost daemon (fast path on same machine)
    try {
      const localUrl = `http://localhost:${LOCAL_DAEMON_PORT}`;
      const localResult = await tryPairAgainstBase(localUrl, c, 1500);
      if (localResult.ok) {
        finishConnect(localResult.data, localUrl);
        return;
      }
    } catch { /* not local */ }

    // 4. Try Supabase pairing table (remote pairing via internet)
    try {
      if (!supabase) {
        throw new Error('Could not pair via proxy/local endpoints, and remote pairing is unavailable because Supabase is not configured for this build.');
      }

      const { data, error } = await supabase
        .from('soupz_pairing')
        .select('*')
        .eq('code', c)
        .single();

      if (error || !data) throw new Error('Invalid pairing code');
      if (new Date(data.expires_at) < new Date()) throw new Error('Code expired');

      // Try direct connection first via discovered LAN/tunnel targets.
      // lan_ips may contain raw LAN IPs and optional tunnel base URLs.
      const candidates = resolveRemoteCandidates(data);
      for (const baseUrl of candidates) {
        try {
          const remoteResult = await tryPairAgainstBase(baseUrl, c, 2500);
          if (remoteResult.ok) {
            finishConnect(remoteResult.data, baseUrl);
            return;
          }
        } catch { /* try next IP */ }
      }

      // If we can't reach any local IP, we will use the relay path
      // (The token from Supabase allows us to identify the session)
      finishConnect(data, null);
    } catch (err) {
      setErrorMsg(err.message || 'Could not connect — make sure npx soupz is running');
      setStatus('error');
    }
  }

  function finishConnect(data, url) {
    setMachine(data);
    setStatus('success');
    if (data.token) localStorage.setItem('soupz_daemon_token', data.token);
    if (data.hostname) localStorage.setItem('soupz_hostname', data.hostname);
    if (url) localStorage.setItem('soupz_daemon_url', url);
    else localStorage.removeItem('soupz_daemon_url'); // fallback to relay

    setTimeout(() => navigate('/dashboard'), 1200);
  }

  function onDigitChange(idx, val) {
    const char = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = char;
    setDigits(next);
    if (char && idx < 7) inputRefs.current[idx + 1]?.focus();
  }

  function onKeyDown(idx, e) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'Enter' && isComplete) handleConnect();
  }

  function onPaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 8);
    const next = pasted.split('').concat(Array(8).fill('')).slice(0, 8);
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 7)]?.focus();
    if (pasted.length === 8) handleConnect(pasted);
  }

  function reset() {
    setDigits(Array(8).fill(''));
    setStatus('idle');
    setErrorMsg('');
    inputRefs.current[0]?.focus();
  }

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
      <div className="w-full max-w-sm bg-bg-surface border border-border-subtle rounded-xl p-8 shadow-soft">
        {status === 'success' ? (
          <SuccessState machine={machine} />
        ) : (
          <>
            <h1 className="text-text-pri font-ui text-xl font-semibold mb-1.5">Connect your machine</h1>
            <p className="text-text-sec text-sm mb-4 leading-relaxed">
              Run{' '}
              <code className="font-mono text-accent text-xs bg-bg-elevated px-1.5 py-0.5 rounded">
                npx soupz
              </code>
              {' '}in your terminal, then connect below.
            </p>

            {/* Mode tabs: Code / QR */}
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
              <QRConnectMode code={code} onManual={() => setConnectMode('code')} isMobileDevice={isMobileDevice} />
            ) : (
            <>
            {/* Code input: 4+4 groups */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 justify-center max-w-full">
              <div className="flex gap-1 sm:gap-1.5">
                {[0,1,2,3].map(i => (
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
              <span className="text-text-faint text-lg font-bold mx-0.5">–</span>
              <div className="flex gap-1 sm:gap-1.5">
                {[4,5,6,7].map(i => (
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

            {/* Error */}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-danger text-sm mb-4 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                <XCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Connect button */}
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
              {status === 'loading' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <>Connect <ArrowRight size={14} /></>
              )}
            </button>

            {/* Retry */}
            {status === 'error' && (
              <button onClick={reset} className="mt-3 w-full text-center text-text-sec hover:text-text-pri text-xs transition-colors py-1">
                Try a different code
              </button>
            )}

            {/* Instructions */}
            <div className="mt-7 pt-5 border-t border-border-subtle">
              <p className="text-text-faint text-xs font-ui mb-3 uppercase tracking-wider">How to get a code</p>
              <ol className="space-y-2">
                {[
                  'Open Terminal on your Mac/Linux/Windows machine',
                  'Run: npx soupz',
                  'For phone login: scan the QR shown on your laptop screen',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-text-sec text-sm">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-bg-elevated border border-border-subtle text-text-faint text-xs flex items-center justify-center font-mono">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-lg border border-border-subtle bg-bg-base p-3">
                <p className="text-text-sec text-xs leading-relaxed">
                  Different network (not same Wi-Fi)? Start a tunnel to your daemon and set
                  {' '}
                  <code className="font-mono text-[11px] bg-bg-elevated px-1 py-0.5 rounded">SOUPZ_TUNNEL_URL</code>
                  {' '}
                  before running
                  {' '}
                  <code className="font-mono text-[11px] bg-bg-elevated px-1 py-0.5 rounded">npx soupz</code>
                  .
                </p>
              </div>
            </div>
            </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
      <p className="text-text-faint text-xs">Redirecting you to the dashboard…</p>
    </div>
  );
}

function QRConnectMode({ code, onManual, isMobileDevice }) {
  // Generate the connect URL that the QR code will encode
  const connectUrl = code.length === 8
    ? `${window.location.origin}/connect?code=${code}`
    : null;

  if (isMobileDevice) {
    return (
      <div className="text-center py-6">
        <QrCode size={32} className="text-text-faint mx-auto mb-3 opacity-30" />
        <p className="text-text-pri text-sm font-ui mb-1">Use this phone to scan laptop QR</p>
        <p className="text-text-sec text-xs font-ui leading-relaxed">
          Open this connect page on your laptop, keep the QR visible there,
          then scan it with your phone camera.
        </p>
        <button
          onClick={onManual}
          className="mt-3 text-accent hover:text-accent-hover text-xs font-ui transition-colors"
        >
          Enter code manually instead
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {connectUrl ? (
        <>
          <div className="bg-white p-3 rounded-xl">
            <QRCodeSVG
              value={connectUrl}
              size={180}
              level="M"
              bgColor="#ffffff"
              fgColor="#0F0F13"
            />
          </div>
          <p className="text-text-sec text-xs font-ui text-center leading-relaxed">
            Scan this QR code with your phone camera<br />
            to open the same pairing code instantly
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
          <button
            onClick={onManual}
            className="mt-3 text-accent hover:text-accent-hover text-xs font-ui transition-colors"
          >
            Enter code manually
          </button>
        </div>
      )}
    </div>
  );
}

import { forwardRef } from 'react';

const DigitInput = forwardRef(function DigitInput({ value, onChange, onKeyDown, onPaste, hasError }, ref) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      maxLength={1}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
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
