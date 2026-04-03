import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Files, GitBranch, Settings, Terminal, Layers, Code2,
  Moon, Package, RotateCcw, PanelRightOpen, PanelRightClose,
  Mic, Volume2, Sparkles, BrainCircuit, Github, Zap,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { OVERLAY_Z } from '../../lib/overlayZ.js';

const ACTIONS = [
  { id: 'toggle-mode',      label: 'Toggle Chat/IDE Mode',   icon: Layers,          shortcut: 'Cmd+1/2',  group: 'General' },
  { id: 'toggle-sidebar',   label: 'Toggle Sidebar',         icon: Files,           shortcut: '',         group: 'View' },
  { id: 'toggle-chat',      label: 'Toggle Chat Panel',      icon: PanelRightOpen,  shortcut: '',         group: 'View' },
  { id: 'toggle-terminal',  label: 'Toggle Terminal',         icon: Terminal,        shortcut: '',         group: 'View' },
  { id: 'open-settings',    label: 'Open Settings',           icon: Settings,        shortcut: '',         group: 'View' },
  { id: 'open-git',         label: 'Open Source Control',     icon: GitBranch,       shortcut: '',         group: 'View' },
  { id: 'open-extensions',  label: 'Open Extensions',         icon: Package,         shortcut: '',         group: 'View' },
  { id: 'clear-chat',       label: 'Clear Chat History',      icon: RotateCcw,       shortcut: '',         group: 'Chat' },
  { id: 'voice-input',      label: 'Start Voice Input',       icon: Mic,             shortcut: '',         group: 'Chat' },
  { id: 'tts-toggle',       label: 'Toggle TTS Engine',       icon: Volume2,         shortcut: '',         group: 'Chat' },
  { id: 'agent-gemini',     label: 'Switch to Gemini',        icon: Sparkles,        shortcut: '',         group: 'Agents' },
  { id: 'agent-codex',      label: 'Switch to Codex',         icon: Code2,           shortcut: '',         group: 'Agents' },
  { id: 'agent-claude',     label: 'Switch to Claude Code',   icon: BrainCircuit,    shortcut: '',         group: 'Agents' },
  { id: 'agent-copilot',    label: 'Switch to Copilot',       icon: Github,          shortcut: '',         group: 'Agents' },
  { id: 'theme-dark',       label: 'Theme: Dark',             icon: Moon,            shortcut: '',         group: 'Theme' },
  { id: 'theme-light',      label: 'Theme: Light',            icon: Moon,            shortcut: '',         group: 'Theme' },
  { id: 'theme-dracula',    label: 'Theme: Dracula',          icon: Moon,            shortcut: '',         group: 'Theme' },
  { id: 'theme-nord',       label: 'Theme: Nord',             icon: Moon,            shortcut: '',         group: 'Theme' },
  { id: 'theme-catppuccin', label: 'Theme: Catppuccin',       icon: Moon,            shortcut: '',         group: 'Theme' },
  { id: 'theme-tokyo-night',label: 'Theme: Tokyo Night',      icon: Moon,            shortcut: '',         group: 'Theme' },
  { id: 'theme-rose-pine',  label: 'Theme: Rose Pine',        icon: Moon,            shortcut: '',         group: 'Theme' },
  { id: 'theme-monokai',    label: 'Theme: Monokai',          icon: Moon,            shortcut: '',         group: 'Theme' },
];

export default function CommandPalette({ open, onClose, onAction }) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return ACTIONS;
    const lower = query.toLowerCase();
    return ACTIONS.filter(a =>
      a.label.toLowerCase().includes(lower) ||
      a.group.toLowerCase().includes(lower) ||
      a.id.includes(lower)
    );
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIdx];
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        onAction(filtered[selectedIdx].id);
        onClose();
      }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-start justify-center pt-[15vh]" style={{ zIndex: OVERLAY_Z.commandPalette }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-bg-elevated border border-border-mid rounded-xl shadow-soft overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle">
          <Search size={14} className="text-text-faint shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm font-ui text-text-pri placeholder:text-text-faint focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-text-faint bg-bg-overlay px-1.5 py-0.5 rounded border border-border-subtle">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-text-faint text-xs font-ui">No matching commands</p>
            </div>
          ) : (
            filtered.map((action, i) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => { onAction(action.id); onClose(); }}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                    i === selectedIdx ? 'bg-accent/10 text-text-pri' : 'text-text-sec hover:bg-bg-overlay',
                  )}
                >
                  <Icon size={14} className={i === selectedIdx ? 'text-accent' : 'text-text-faint'} />
                  <span className="flex-1 text-sm font-ui">{action.label}</span>
                  {action.shortcut && (
                    <kbd className="text-[10px] font-mono text-text-faint">{action.shortcut}</kbd>
                  )}
                  <span className="text-[10px] font-ui text-text-faint">{action.group}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
