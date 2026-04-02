import { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, Loader2 } from 'lucide-react';
import { ShareCodeView } from '../connect/ConnectPage.jsx';
import * as daemonApi from '../../lib/daemon.js';
import { OVERLAY_Z } from '../../lib/overlayZ.js';

const LOCAL_DAEMON_PORT = 7533;
const DEFAULT_TTL = 300_000;

export default function PairingCodeModal({ onClose, machineName }) {
  const [code, setCode] = useState('');
  const [remainingMs, setRemainingMs] = useState(DEFAULT_TTL);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCode = useCallback(async () => {
    setLoading(true);
    setError('');
    const daemonUrl = typeof daemonApi.getDaemonUrl === 'function'
      ? daemonApi.getDaemonUrl()
      : localStorage.getItem('soupz_daemon_url')
        || `http://localhost:${LOCAL_DAEMON_PORT}`;
    const sources = Array.from(new Set([
      daemonUrl,
      localStorage.getItem('soupz_daemon_url'),
      `http://localhost:${LOCAL_DAEMON_PORT}`,
    ].filter(Boolean)));

    for (const base of sources) {
      try {
        const endpoint = `${base.replace(/\/$/, '')}/pair/current`;
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(1500) });
        if (!res.ok) continue;
        const data = await res.json();
        const raw = (data?.code || '').toString().replace(/[^A-Z0-9]/gi, '').slice(0, 9);
        if (raw.length === 9) {
          setCode(raw);
          const ttl = (data?.expiresIn || 300) * 1000;
          setExpiresAt(Date.now() + ttl);
          setRemainingMs(ttl);
          setLoading(false);
          return;
        }
      } catch {
        /* try next source */
      }
    }
    setLoading(false);
    setError('Unable to fetch a pairing code. Ensure the daemon is running.');
  }, []);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    setRemainingMs(Math.max(0, expiresAt - Date.now()));
    const interval = setInterval(() => {
      setRemainingMs(prev => {
        const next = expiresAt - Date.now();
        return next <= 0 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (!code || remainingMs > 0) return undefined;
    const timer = setTimeout(() => { fetchCode(); }, 1500);
    return () => clearTimeout(timer);
  }, [code, remainingMs, fetchCode]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4" style={{ zIndex: OVERLAY_Z.modal }}>
      <div className="w-full max-w-md bg-bg-surface border border-border-subtle rounded-2xl shadow-2xl p-5 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-text-faint hover:text-text-sec"
          aria-label="Close pairing modal"
        >
          <X size={16} />
        </button>
        <div className="mb-4">
          <h2 className="text-text-pri text-lg font-ui font-semibold">Share pairing code</h2>
          <p className="text-text-faint text-xs">
            {machineName ? `Connected to ${machineName}` : 'Share this code to pair another device.'}
          </p>
        </div>
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3 text-text-faint">
            <Loader2 size={20} className="animate-spin" />
            <p className="text-xs">Fetching pairing code…</p>
          </div>
        ) : error ? (
          <div className="py-10 text-center text-text-faint text-sm">
            <p className="mb-4">{error}</p>
            <button
              onClick={fetchCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border-subtle hover:border-border-mid"
            >
              <RefreshCw size={12} /> Try again
            </button>
          </div>
        ) : (
          <>
            <ShareCodeView
              code={code}
              isComplete={code.length === 9}
              remainingMs={remainingMs}
            />
            <div className="mt-4 flex items-center justify-between text-[11px] text-text-faint">
              <button
                onClick={fetchCode}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border-subtle hover:text-text-pri hover:border-border-mid"
              >
                <RefreshCw size={11} /> Refresh code
              </button>
              <span>Codes rotate automatically</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
