import { useState, useEffect, useRef } from 'react';
import { Terminal, CheckCircle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/cn';

const PAIRING_API = 'http://localhost:7070';

export default function ConnectPage({ getParam, navigate }) {
  const urlCode = getParam?.('code') || '';
  const [digits, setDigits] = useState(urlCode.replace(/-/g, '').slice(0, 8).split('').concat(Array(8).fill('')).slice(0, 8));
  const [status, setStatus]   = useState('idle'); // idle | loading | success | error
  const [machine, setMachine] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRefs = useRef([]);

  const code = digits.join('');
  const isComplete = code.length === 8 && digits.every(d => d !== '');

  useEffect(() => {
    if (urlCode) {
      const clean = urlCode.replace(/-/g, '').slice(0, 8);
      setDigits(clean.padEnd(8, '').split(''));
      if (clean.length === 8) handleConnect(clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect(overrideCode) {
    const c = overrideCode || code;
    if (c.length !== 8) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${PAIRING_API}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMachine(data);
        setStatus('success');
        // Store token for daemon comms
        if (data.token) localStorage.setItem('soupz_daemon_token', data.token);
        if (data.hostname) localStorage.setItem('soupz_hostname', data.hostname);
        setTimeout(() => navigate('/'), 1800);
      } else {
        setErrorMsg(data.error || 'Invalid pairing code');
        setStatus('error');
      }
    } catch {
      setErrorMsg('Could not connect — make sure npx soupz is running');
      setStatus('error');
    }
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
            <p className="text-text-sec text-sm mb-7 leading-relaxed">
              Enter the 8-digit code shown in your terminal after running{' '}
              <code className="font-mono text-accent text-xs bg-bg-elevated px-1.5 py-0.5 rounded">
                npx soupz
              </code>
            </p>

            {/* Code input: 4+4 groups */}
            <div className="flex items-center gap-3 mb-6 justify-center">
              <div className="flex gap-1.5">
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
              <span className="text-text-faint text-lg">–</span>
              <div className="flex gap-1.5">
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
                  'A pairing code will appear — enter it above',
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
        'w-10 h-12 rounded-md text-center font-mono text-lg font-medium caret-accent',
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
