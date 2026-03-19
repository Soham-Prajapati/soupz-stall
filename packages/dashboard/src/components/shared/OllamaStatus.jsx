import { useState, useEffect, useRef } from 'react';
import { Cpu, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/cn';

const OLLAMA_TAGS_URL = 'http://localhost:11434/api/tags';
const STORAGE_KEY = 'soupz_use_ollama';
const REFRESH_INTERVAL_MS = 30_000;

/**
 * OllamaStatus — compact status badge showing whether Ollama is reachable.
 *
 * Props:
 *   useOllama {boolean}          — controlled state from parent
 *   onToggle  {(v: boolean)=>void} — called when user toggles the checkbox
 */
export default function OllamaStatus({ useOllama, onToggle }) {
  const [online, setOnline] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Check Ollama reachability
  async function checkStatus() {
    try {
      const res = await fetch(OLLAMA_TAGS_URL, {
        signal: AbortSignal.timeout(2000),
      });
      setOnline(res.ok);
    } catch {
      setOnline(false);
    }
  }

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [open]);

  function handleToggle(e) {
    const next = e.target.checked;
    localStorage.setItem(STORAGE_KEY, String(next));
    onToggle?.(next);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Badge button */}
      <button
        onClick={() => setOpen(v => !v)}
        title={online ? 'Ollama active' : 'Ollama offline'}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-ui transition-all select-none',
          'bg-bg-elevated border-border-subtle hover:border-border-mid',
          online ? 'text-text-sec' : 'text-text-faint',
        )}
      >
        <Cpu size={11} className={online ? 'text-success' : 'text-text-faint'} />
        {/* Full label on sm+, icon-only on xs */}
        <span className="hidden sm:inline">
          Ollama
        </span>
        {/* Status dot */}
        <span
          className={cn(
            'inline-block w-1.5 h-1.5 rounded-full shrink-0',
            online ? 'bg-success' : 'bg-text-faint',
          )}
        />
        <ChevronDown size={9} className="text-text-faint hidden sm:inline" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-bg-elevated border border-border-mid rounded-xl shadow-soft z-50 overflow-hidden">
          {/* Status header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle">
            <Cpu size={13} className={online ? 'text-success' : 'text-text-faint'} />
            <span className="text-xs font-ui font-medium text-text-pri">
              Ollama: {online ? 'active' : 'offline'}
            </span>
            <span
              className={cn(
                'ml-auto inline-block w-2 h-2 rounded-full',
                online ? 'bg-success' : 'bg-text-faint',
              )}
            />
          </div>

          {/* Body */}
          <div className="px-3 py-2.5 space-y-2.5">
            {online ? (
              <p className="text-[11px] text-text-sec font-ui leading-relaxed">
                Using <span className="font-mono text-accent">qwen2.5:0.5b</span> for
                on-device agent routing.
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] text-text-sec font-ui leading-relaxed">
                  Install Ollama for free on-device routing. No API key needed.
                </p>
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 font-ui transition-colors"
                >
                  <ExternalLink size={10} />
                  ollama.com
                </a>
              </div>
            )}

            {/* Toggle */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={useOllama}
                onChange={handleToggle}
                className="w-3.5 h-3.5 rounded border-border-mid accent-accent cursor-pointer"
              />
              <span className="text-[11px] font-ui text-text-sec group-hover:text-text-pri transition-colors">
                Use Ollama for agent routing
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
