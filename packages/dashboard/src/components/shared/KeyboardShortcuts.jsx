import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, Search, X } from 'lucide-react';
import { cn } from '../../lib/cn';

const SHORTCUTS = [
  { keys: 'Alt+1', action: 'Switch to Chat mode (browser-safe)', group: 'Navigation' },
  { keys: 'Alt+2', action: 'Switch to Code mode (browser-safe)', group: 'Navigation' },
  { keys: 'Alt+3', action: 'Switch to Build mode (browser-safe)', group: 'Navigation' },
  { keys: 'Cmd/Ctrl+Shift+1', action: 'Switch to Chat mode (fallback)', group: 'Navigation' },
  { keys: 'Cmd/Ctrl+Shift+2', action: 'Switch to Code mode (fallback)', group: 'Navigation' },
  { keys: 'Cmd/Ctrl+Shift+3', action: 'Switch to Build mode (fallback)', group: 'Navigation' },
  { keys: 'Cmd/Ctrl+K', action: 'Toggle command palette', group: 'Navigation' },
  { keys: 'Cmd/Ctrl+Shift+P', action: 'Toggle command palette', group: 'Navigation' },
  { keys: 'Cmd/Ctrl+O', action: 'Open folder picker', group: 'Workspace' },
  { keys: 'Cmd/Ctrl+/', action: 'Toggle shortcuts overlay', group: 'Help' },
  { keys: 'Cmd/Ctrl+Shift+K', action: 'Toggle shortcuts overlay', group: 'Help' },
  { keys: 'F1 (editor focus)', action: 'Editor command palette (Monaco)', group: 'Editor' },
  { keys: 'F2 (editor focus)', action: 'Rename symbol (Monaco)', group: 'Editor' },
  { keys: 'F12 (editor focus)', action: 'Go to definition (Monaco)', group: 'Editor' },
  { keys: 'Esc', action: 'Close dialogs and overlays', group: 'General' },
];

export default function KeyboardShortcuts({ open, onClose }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SHORTCUTS;
    return SHORTCUTS.filter(item => item.keys.toLowerCase().includes(q) || item.action.toLowerCase().includes(q) || item.group.toLowerCase().includes(q));
  }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-soft">
        <div className="h-12 px-4 border-b border-border-subtle flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-text-pri">
            <Keyboard size={14} className="text-accent" />
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-text-faint hover:text-text-pri hover:bg-bg-elevated transition-colors"
            aria-label="Close shortcuts"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 border-b border-border-subtle">
          <label className="h-9 px-3 rounded-lg border border-border-subtle bg-bg-base flex items-center gap-2">
            <Search size={13} className="text-text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shortcuts"
              className="flex-1 bg-transparent text-sm text-text-pri placeholder:text-text-faint outline-none"
              autoFocus
            />
          </label>
        </div>

        <div className="max-h-[55vh] overflow-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-text-faint">No shortcuts match your search.</div>
          ) : (
            <div className="p-3 space-y-2">
              {filtered.map((item) => (
                <div key={`${item.keys}-${item.action}`} className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-base flex items-center gap-3">
                  <span className="text-[11px] uppercase tracking-wide text-text-faint min-w-[74px]">{item.group}</span>
                  <span className="text-sm text-text-pri flex-1">{item.action}</span>
                  <kbd className={cn('px-2 py-1 rounded border border-border-subtle bg-bg-elevated text-[11px] font-mono text-text-sec')}>
                    {item.keys}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
