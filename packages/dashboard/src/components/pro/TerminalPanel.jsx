import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal, X, ChevronUp, ChevronDown, Trash2,
} from 'lucide-react';
import { cn } from '../../lib/cn';

const DAEMON_WS_URL = (import.meta.env.VITE_DAEMON_URL || 'http://localhost:7533').replace(/^http/, 'ws');

export default function TerminalPanel({ daemon, onClose }) {
  const [minimized, setMinimized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [terminalId, setTerminalId] = useState(null);
  const outputRef = useRef(null);
  const wsRef = useRef(null);
  const inputBufferRef = useRef('');

  // Connect to daemon WS and create a real terminal
  useEffect(() => {
    const token = localStorage.getItem('soupz_daemon_token');
    const isLocal = DAEMON_WS_URL.includes('localhost') || DAEMON_WS_URL.includes('127.0.0.1');
    if (!token && !isLocal) return;

    const ws = new WebSocket(DAEMON_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate first (daemon will auto-approve localhost)
      ws.send(JSON.stringify({ type: 'auth', token: token || 'local-dev', clientType: 'terminal' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'auth_success') {
          // Auth successful — create terminal
          ws.send(JSON.stringify({
            type: 'create_terminal',
            cols: 80,
            rows: 24,
            cwd: undefined, // use daemon cwd
          }));
        }

        if (msg.type === 'terminal_created') {
          setTerminalId(msg.terminalId);
          setConnected(true);
        }

        if (msg.type === 'output' && outputRef.current) {
          // Append raw terminal output
          appendOutput(msg.data);
        }

        if (msg.type === 'exit') {
          appendOutput('\r\n[Process exited]\r\n');
          setConnected(false);
        }

        if (msg.type === 'auth_failed') {
          appendOutput('[Auth failed — re-pair your device]\r\n');
        }

        if (msg.type === 'error') {
          appendOutput(`[Error: ${msg.message}]\r\n`);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => {
      appendOutput('[WebSocket error — is the daemon running?]\r\n');
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  // Append text to the terminal output div
  const appendOutput = useCallback((text) => {
    if (!outputRef.current) return;
    // Convert ANSI sequences to minimal HTML (strip complex ones, keep colors basic)
    const cleaned = stripAnsi(text);
    const node = document.createTextNode(cleaned);
    outputRef.current.appendChild(node);
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, []);

  // Send keystrokes to the real PTY
  function handleKeyDown(e) {
    if (!wsRef.current || wsRef.current.readyState !== 1 || !terminalId) return;

    // Map keyboard events to terminal input
    let data = '';

    if (e.key === 'Enter') {
      data = '\r';
    } else if (e.key === 'Backspace') {
      data = '\x7f';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      data = '\t';
    } else if (e.key === 'ArrowUp') {
      data = '\x1b[A';
    } else if (e.key === 'ArrowDown') {
      data = '\x1b[B';
    } else if (e.key === 'ArrowRight') {
      data = '\x1b[C';
    } else if (e.key === 'ArrowLeft') {
      data = '\x1b[D';
    } else if (e.key === 'Escape') {
      data = '\x1b';
    } else if (e.ctrlKey && e.key === 'c') {
      data = '\x03';
    } else if (e.ctrlKey && e.key === 'd') {
      data = '\x04';
    } else if (e.ctrlKey && e.key === 'l') {
      data = '\x0c'; // clear
    } else if (e.ctrlKey && e.key === 'z') {
      data = '\x1a';
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      data = e.key;
    }

    if (data) {
      e.preventDefault();
      wsRef.current.send(JSON.stringify({
        type: 'input',
        terminalId,
        data,
      }));
    }
  }

  function clearTerminal() {
    if (outputRef.current) {
      outputRef.current.textContent = '';
    }
    // Also send Ctrl+L to the PTY
    if (wsRef.current?.readyState === 1 && terminalId) {
      wsRef.current.send(JSON.stringify({ type: 'input', terminalId, data: '\x0c' }));
    }
  }

  // Focus the terminal area for keyboard input
  function focusTerminal() {
    outputRef.current?.focus();
  }

  if (minimized) {
    return (
      <div className="h-8 bg-bg-surface border-t border-border-subtle flex items-center px-3 gap-2">
        <Terminal size={12} className="text-text-faint" />
        <span className="text-[11px] text-text-faint font-ui">Terminal</span>
        {connected && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
        <div className="flex-1" />
        <button onClick={() => setMinimized(false)} className="text-text-faint hover:text-text-sec transition-colors" title="Maximize">
          <ChevronUp size={12} />
        </button>
        <button onClick={onClose} className="text-text-faint hover:text-text-sec transition-colors" title="Close">
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
        {connected ? (
          <span className="flex items-center gap-1 text-[10px] font-mono text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success" /> PTY
          </span>
        ) : (
          <span className="text-[10px] font-mono text-text-faint">connecting...</span>
        )}
        <div className="flex-1" />
        <button onClick={clearTerminal} className="text-text-faint hover:text-text-sec transition-colors" title="Clear">
          <Trash2 size={11} />
        </button>
        <button onClick={() => setMinimized(true)} className="text-text-faint hover:text-text-sec transition-colors" title="Minimize">
          <ChevronDown size={12} />
        </button>
        <button onClick={onClose} className="text-text-faint hover:text-text-sec transition-colors" title="Close">
          <X size={12} />
        </button>
      </div>

      {/* Terminal output — real PTY output goes here */}
      <div
        ref={outputRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={focusTerminal}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs text-text-sec leading-relaxed whitespace-pre-wrap min-h-0 focus:outline-none cursor-text"
        style={{ caretColor: 'var(--accent)' }}
      >
        {!connected && !localStorage.getItem('soupz_daemon_token') && !DAEMON_WS_URL.includes('localhost') && (
          <span className="text-text-faint italic">Not connected — run npx soupz and pair your device first.</span>
        )}
      </div>
    </div>
  );
}

// Strip ANSI escape sequences for plain text display
// A full xterm.js integration would be better, but this works for basic use
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '')
            .replace(/\x1b[()][A-Z0-9]/g, '');
}
