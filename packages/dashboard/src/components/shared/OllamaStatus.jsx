import { useState, useRef, useEffect } from 'react';
import { Cpu, ChevronDown, GitBranch } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * SmartRoute (formerly OllamaStatus) — shows the active routing cascade.
 *
 * Props:
 *   useOllama {boolean}            — controlled state from parent (kept for API compat)
 *   onToggle  {(v: boolean)=>void} — kept for API compat, no longer exposed in UI
 */
export default function OllamaStatus({ useOllama, onToggle }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Badge button */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Smart routing: picks best available free AI to classify your prompt"
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-ui transition-all select-none',
          'bg-bg-elevated border-border-subtle hover:border-border-mid text-text-sec',
        )}
      >
        <Cpu size={11} className="text-accent" />
        <span className="hidden sm:inline">Auto routing</span>
        <ChevronDown size={9} className="text-text-faint hidden sm:inline" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 mt-1 w-72 bg-bg-elevated border border-border-mid rounded-xl shadow-soft z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle">
            <GitBranch size={13} className="text-accent" />
            <span className="text-xs font-ui font-medium text-text-pri">Smart Routing</span>
          </div>

          {/* Body */}
          <div className="px-3 py-2.5 space-y-2">
            <p className="text-[11px] text-text-sec font-ui leading-relaxed">
              Prompts are classified by the best available free model:
            </p>

            {/* Cascade list */}
            <ol className="space-y-1.5">
              {[
                { label: 'Copilot (gh)',  detail: 'gpt-5.1-codex-mini — free tier' },
                { label: 'Gemini CLI',    detail: 'Gemini 2.0 Flash — free tier'   },
                { label: 'Ollama',        detail: 'qwen2.5:0.5b — local, offline'  },
                { label: 'Keywords',      detail: 'local fallback, no model needed' },
              ].map((step, i) => (
                <li key={step.label} className="flex items-start gap-2">
                  <span className="text-[10px] font-ui text-text-faint w-3 shrink-0 mt-0.5">{i + 1}.</span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-ui font-medium text-text-pri">{step.label}</span>
                    <span className="text-[11px] font-ui text-text-faint"> — {step.detail}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
