import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal as TerminalIcon, X, ChevronUp, ChevronDown, Trash2, Plus, SplitSquareHorizontal
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const DAEMON_WS_URL = (import.meta.env.VITE_DAEMON_URL || 'http://localhost:7533').replace(/^http/, 'ws');

export default function TerminalPanel({ daemon, onClose, maximized, onMaximize }) {
  const [connected, setConnected] = useState(false);
  const [terminalId, setTerminalId] = useState(null);
  
  const terminalRef = useRef(null); // The div for xterm
  const xtermRef = useRef(null);    // The Terminal instance
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);

  // Initialize XTerm
  useEffect(() => {
    const term = new Terminal({
      cursorBlinking: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: {
        background: 'transparent',
        foreground: '#CCCCCC',
        cursor: '#007ACC',
        selectionBackground: 'rgba(0, 122, 204, 0.3)',
      },
      allowProposedApi: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    if (terminalRef.current) {
      term.open(terminalRef.current);
      fitAddon.fit();
    }

    // Handle input
    term.onData(data => {
      if (wsRef.current?.readyState === 1 && terminalId) {
        wsRef.current.send(JSON.stringify({ type: 'input', terminalId, data }));
      }
    });

    return () => {
      term.dispose();
    };
  }, [terminalId]);

  // Connect to daemon WS
  useEffect(() => {
    const token = localStorage.getItem('soupz_daemon_token');
    const isLocal = DAEMON_WS_URL.includes('localhost') || DAEMON_WS_URL.includes('127.0.0.1');
    if (!token && !isLocal) return;

    const ws = new WebSocket(DAEMON_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token: token || 'local-dev', clientType: 'terminal' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'auth_success') {
          ws.send(JSON.stringify({
            type: 'create_terminal',
            cols: xtermRef.current?.cols || 80,
            rows: xtermRef.current?.rows || 24,
          }));
        }

        if (msg.type === 'terminal_created') {
          setTerminalId(msg.terminalId);
          setConnected(true);
        }

        if (msg.type === 'output' && xtermRef.current) {
          xtermRef.current.write(msg.data);
        }

        if (msg.type === 'exit') {
          xtermRef.current?.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
          setConnected(false);
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => xtermRef.current?.write('\r\n\x1b[31m[WebSocket connection error]\x1b[0m\r\n');
    ws.onclose = () => setConnected(false);

    return () => ws.close();
  }, []);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      fitAddonRef.current?.fit();
      if (wsRef.current?.readyState === 1 && terminalId && xtermRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'resize_terminal',
          terminalId,
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows
        }));
      }
    };
    window.addEventListener('resize', handleResize);
    const timeout = setTimeout(handleResize, 100); // initial fit
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, [terminalId]);

  function clearTerminal() {
    xtermRef.current?.clear();
    if (wsRef.current?.readyState === 1 && terminalId) {
      wsRef.current.send(JSON.stringify({ type: 'input', terminalId, data: '\x0c' }));
    }
  }

  return (
    <div className="h-full flex flex-col bg-bg-surface border-t border-border-subtle relative">
      {/* Header Tabs */}
      <div className="h-9 flex items-center px-4 gap-6 shrink-0 bg-bg-surface border-b border-border-subtle/20">
        <div className="flex items-center gap-6 h-full">
          <button className="text-[11px] font-ui uppercase tracking-wide h-full flex items-center border-b-[1px] transition-colors text-[#E7E7E7] border-accent font-medium">
            TERMINAL
          </button>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-1">
          {connected ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono text-success bg-success/10 mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> zsh
            </span>
          ) : (
            <span className="text-[10px] font-mono text-text-faint mr-2">connecting...</span>
          )}
          <button onClick={clearTerminal} className="p-1 text-text-faint hover:text-text-pri hover:bg-white/10 rounded transition-colors" title="Clear Terminal">
            <Trash2 size={13} />
          </button>
          <div className="w-px h-3 bg-border-subtle mx-1" />
          <button onClick={onMaximize} className="p-1 text-text-faint hover:text-text-pri hover:bg-white/10 rounded transition-colors" title={maximized ? "Restore" : "Maximize"}>
            {maximized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button onClick={onClose} className="p-1 text-text-faint hover:text-text-pri hover:bg-white/10 rounded transition-colors" title="Close Panel">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div 
        ref={terminalRef} 
        className="flex-1 overflow-hidden px-4 py-2"
        style={{ minHeight: 0, backgroundColor: 'transparent' }}
      />
    </div>
  );
}
