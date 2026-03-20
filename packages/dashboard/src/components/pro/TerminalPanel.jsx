import { useState, useRef, useEffect } from 'react';
import {
  Terminal, X, ChevronUp, ChevronDown, Plus, Trash2,
  Loader2, CornerDownLeft,
} from 'lucide-react';
import { cn } from '../../lib/cn';

const HISTORY_KEY = 'soupz_terminal_history';

function readHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

export default function TerminalPanel({ daemon, onClose }) {
  const [lines, setLines] = useState([
    { type: 'system', text: 'Soupz Terminal — Connected to workspace' },
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [history] = useState(() => readHistory());
  const [histIdx, setHistIdx] = useState(-1);
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [minimized]);

  async function runCommand() {
    const cmd = input.trim();
    if (!cmd || running) return;

    setInput('');
    setLines(prev => [...prev, { type: 'input', text: `$ ${cmd}` }]);
    setRunning(true);

    // Save to history
    const newHistory = [cmd, ...history.filter(h => h !== cmd)].slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    setHistIdx(-1);

    try {
      if (daemon?.sendPrompt) {
        // Use the daemon's agent prompt to run shell commands
        // Wrap it as a direct command execution
        let output = '';
        await daemon.sendPrompt(
          { prompt: `Run this shell command and show the output. Only output the raw result, no explanation: \`${cmd}\``, agentId: 'gemini', buildMode: 'quick' },
          (chunk) => {
            output += chunk;
            setLines(prev => {
              const last = prev[prev.length - 1];
              if (last?.type === 'output') {
                return [...prev.slice(0, -1), { type: 'output', text: output }];
              }
              return [...prev, { type: 'output', text: output }];
            });
          }
        );
      } else {
        setLines(prev => [...prev, { type: 'error', text: 'Not connected to workspace. Run npx soupz first.' }]);
      }
    } catch (err) {
      setLines(prev => [...prev, { type: 'error', text: `Error: ${err.message}` }]);
    } finally {
      setRunning(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(histIdx + 1, history.length - 1);
      if (history[newIdx]) {
        setHistIdx(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(histIdx - 1, -1);
      setHistIdx(newIdx);
      setInput(newIdx >= 0 ? history[newIdx] : '');
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([{ type: 'system', text: 'Terminal cleared' }]);
    }
  }

  if (minimized) {
    return (
      <div className="h-8 bg-bg-surface border-t border-border-subtle flex items-center px-3 gap-2">
        <Terminal size={12} className="text-text-faint" />
        <span className="text-[11px] text-text-faint font-ui">Terminal</span>
        <div className="flex-1" />
        <button
          onClick={() => setMinimized(false)}
          className="text-text-faint hover:text-text-sec transition-colors"
          title="Maximize"
        >
          <ChevronUp size={12} />
        </button>
        <button
          onClick={onClose}
          className="text-text-faint hover:text-text-sec transition-colors"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg-base border-t border-border-subtle">
      {/* Header */}
      <div className="h-8 bg-bg-surface border-b border-border-subtle flex items-center px-3 gap-2 shrink-0">
        <Terminal size={12} className="text-text-faint" />
        <span className="text-[11px] text-text-sec font-ui font-medium">Terminal</span>
        <div className="flex-1" />
        <button
          onClick={() => setLines([{ type: 'system', text: 'Terminal cleared' }])}
          className="text-text-faint hover:text-text-sec transition-colors"
          title="Clear (Ctrl+L)"
        >
          <Trash2 size={11} />
        </button>
        <button
          onClick={() => setMinimized(true)}
          className="text-text-faint hover:text-text-sec transition-colors"
          title="Minimize"
        >
          <ChevronDown size={12} />
        </button>
        <button
          onClick={onClose}
          className="text-text-faint hover:text-text-sec transition-colors"
          title="Close"
        >
          <X size={12} />
        </button>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs min-h-0">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'leading-relaxed whitespace-pre-wrap',
              line.type === 'input' ? 'text-accent font-medium' :
              line.type === 'error' ? 'text-danger' :
              line.type === 'system' ? 'text-text-faint italic' :
              'text-text-sec',
            )}
          >
            {line.text}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-1.5 text-text-faint">
            <Loader2 size={10} className="animate-spin" />
            <span>Running...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border-subtle bg-bg-surface shrink-0">
        <span className="text-accent text-xs font-mono">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          disabled={running}
          className="flex-1 bg-transparent text-xs font-mono text-text-pri placeholder:text-text-faint focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={runCommand}
          disabled={!input.trim() || running}
          className="text-text-faint hover:text-accent transition-colors disabled:opacity-30"
          title="Run (Enter)"
        >
          <CornerDownLeft size={12} />
        </button>
      </div>
    </div>
  );
}
