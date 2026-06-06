import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { OVERLAY_Z } from '../../lib/overlayZ.js';

const TOAST_EVENT = 'soupz_toast';

export function pushToast(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
}

function normalizeToast(detail = {}) {
  return {
    id: detail.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: detail.type || 'info',
    title: detail.title || 'Notification',
    message: detail.message || '',
    duration: typeof detail.duration === 'number' ? detail.duration : 5000,
  };
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const onToast = (event) => {
      const next = normalizeToast(event?.detail || {});
      setToasts(prev => [...prev, next].slice(-4));
      const timer = setTimeout(() => removeToast(next.id), Math.max(1200, next.duration));
      timersRef.current.set(next.id, timer);
    };

    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      for (const timer of timersRef.current.values()) clearTimeout(timer);
      timersRef.current.clear();
    };
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-14 right-3 flex flex-col gap-2 w-[320px] max-w-[calc(100vw-24px)] pointer-events-none" style={{ zIndex: OVERLAY_Z.toast }}>
      {toasts.map((toast) => {
        const tone = toast.type;
        const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? XCircle : tone === 'warning' ? AlertTriangle : Info;
        return (
          <div
            key={toast.id}
            className={cn(
              'toast-enter pointer-events-auto rounded-lg border bg-bg-surface p-3 shadow-soft',
              tone === 'success' && 'border-success/30',
              tone === 'error' && 'border-danger/40',
              tone === 'warning' && 'border-warning/35',
              tone === 'info' && 'border-accent/30',
            )}
          >
            <div className="flex items-start gap-2">
              <Icon
                size={15}
                className={cn(
                  'mt-0.5 shrink-0',
                  tone === 'success' && 'text-success',
                  tone === 'error' && 'text-danger',
                  tone === 'warning' && 'text-warning',
                  tone === 'info' && 'text-accent',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-text-pri">{toast.title}</div>
                {toast.message ? <div className="mt-0.5 text-xs text-text-sec">{toast.message}</div> : null}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-[10px] text-text-faint hover:text-text-pri transition-colors"
                aria-label="Dismiss notification"
              >
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
