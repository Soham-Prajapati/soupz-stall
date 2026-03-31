import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, ChevronUp, ChevronDown, Trash2, Plus, Eraser
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useThemeVars } from '../../hooks/useThemeVars';
import { getDaemonWsUrl } from '../../lib/daemon';

export default function TerminalPanel({ daemon, onClose, maximized, onMaximize, variant = 'default' }) {
  const [connected, setConnected] = useState(false);
  const [terminalId, setTerminalId] = useState(null);
  const [terminalTabs, setTerminalTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [daemonWsUrl, setDaemonWsUrl] = useState(() => getDaemonWsUrl());
  const themeVars = useThemeVars(['--bg-base', '--bg-surface', '--text-pri', '--accent', '--accent-hover']);
  const terminalRef = useRef(null); // The div for xterm
  const xtermRef = useRef(null);    // The Terminal instance
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const bufferRef = useRef(new Map());
  const activeTabRef = useRef(null);
  const terminalIdRef = useRef(null);
  const [killing, setKilling] = useState(false);

  const isMobileVariant = variant === 'mobile';

  const buildTermTheme = useCallback(() => ({
    background: themeVars['--bg-surface'] || '#0C0C0F',
    foreground: themeVars['--text-pri'] || '#E5E7EB',
    cursor: themeVars['--accent'] || '#6366F1',
    selectionBackground: `${themeVars['--accent'] || '#6366F1'}33`,
  }), [themeVars]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    terminalIdRef.current = terminalId;
  }, [terminalId]);

  // Initialize XTerm
  useEffect(() => {
    const term = new Terminal({
      cursorBlinking: true,
      fontSize: isMobileVariant ? 14 : 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      theme: buildTermTheme(),
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
  }, [buildTermTheme, isMobileVariant]);

  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    const theme = buildTermTheme();
    if (typeof term.setOption === 'function') {
      term.setOption('theme', theme);
      term.setOption('fontSize', isMobileVariant ? 14 : 13);
      try {
        term.refresh(0, term.rows - 1);
      } catch {
        // term may be mid-disposal; ignore
      }
    }
  }, [buildTermTheme, isMobileVariant]);

  const subscribeToTerminal = useCallback((id) => {
    if (!id || wsRef.current?.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: 'subscribe', terminalId: id }));
  }, []);

  const activateTab = useCallback((id) => {
    if (!id) return;
    setActiveTab(id);
    setTerminalId(id);
    if (xtermRef.current) {
      xtermRef.current.clear();
      const buffer = bufferRef.current.get(id) || '';
      if (buffer) xtermRef.current.write(buffer);
    }
    subscribeToTerminal(id);
  }, [subscribeToTerminal]);

  // Connect to daemon WS
  useEffect(() => {
    const targetWsUrl = daemonWsUrl;
    if (!targetWsUrl) return;
    const token = localStorage.getItem('soupz_daemon_token');
    const isLocal = targetWsUrl.includes('localhost') || targetWsUrl.includes('127.0.0.1');
    if (!token && !isLocal) return;

    const ws = new WebSocket(targetWsUrl);
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
          setTerminalTabs(prev => Array.from(new Set([...prev, msg.terminalId])));
          setTerminalId(msg.terminalId);
          setActiveTab(msg.terminalId);
          bufferRef.current.set(msg.terminalId, '');
          setConnected(true);
          subscribeToTerminal(msg.terminalId);
        }

        if (msg.type === 'history') {
          bufferRef.current.set(msg.terminalId, msg.data || '');
          if (msg.terminalId === activeTabRef.current && xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.write(msg.data || '');
          }
        }

        if (msg.type === 'output') {
          const existing = bufferRef.current.get(msg.terminalId) || '';
          bufferRef.current.set(msg.terminalId, existing + msg.data);
          if (msg.terminalId === activeTabRef.current && xtermRef.current) {
            xtermRef.current.write(msg.data);
          }
        }

        if (msg.type === 'exit') {
          bufferRef.current.set(msg.terminalId, `${bufferRef.current.get(msg.terminalId) || ''}\r\n[Process exited]\r\n`);
          if (msg.terminalId === activeTabRef.current) {
            xtermRef.current?.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
          }
          if (msg.terminalId === terminalIdRef.current) {
            setConnected(false);
          }
          setTerminalTabs(prev => prev.filter(id => id !== msg.terminalId));
          if (activeTabRef.current === msg.terminalId) {
            const remaining = Array.from(bufferRef.current.keys()).filter(key => key !== msg.terminalId);
            const fallback = remaining[0] || null;
            if (fallback) {
              activateTab(fallback);
            } else {
              setActiveTab(null);
              setTerminalId(null);
              xtermRef.current?.clear();
            }
          }
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => xtermRef.current?.write('\r\n\x1b[31m[WebSocket connection error]\x1b[0m\r\n');
    ws.onclose = () => setConnected(false);

    return () => ws.close();
  }, [activateTab, subscribeToTerminal, daemonWsUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!daemon?.listTerminals) return;
      try {
        const list = await daemon.listTerminals();
        if (cancelled || !Array.isArray(list) || list.length === 0) return;
        const ids = list.map(item => item.id).filter(Boolean);
        if (ids.length === 0) return;
        setTerminalTabs(prev => Array.from(new Set([...prev, ...ids])));
        setActiveTab((current) => current || ids[0]);
        setTerminalId((current) => current || ids[0]);
        if (wsRef.current?.readyState === 1) {
          ids.forEach(id => {
            bufferRef.current.set(id, bufferRef.current.get(id) || '');
            subscribeToTerminal(id);
          });
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [daemon, subscribeToTerminal]);

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

  const spawnNewTerminal = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== 1 || !xtermRef.current) return;
    wsRef.current.send(JSON.stringify({
      type: 'create_terminal',
      cols: xtermRef.current.cols || 80,
      rows: xtermRef.current.rows || 24,
    }));
    setConnected(false);
  }, []);

  const handleKillTab = useCallback(async (id) => {
    const target = id || activeTabRef.current;
    if (!target) return;
    setKilling(true);
    try {
      await daemon?.killTerminal?.(target);
    } catch (err) {
      console.warn('Failed to kill terminal', err);
    } finally {
      setKilling(false);
      bufferRef.current.delete(target);
      setTerminalTabs(prev => prev.filter(tabId => tabId !== target));
      if (activeTabRef.current === target) {
        const fallback = bufferRef.current.size ? Array.from(bufferRef.current.keys())[0] : null;
        if (fallback) {
          activateTab(fallback);
        } else {
          setActiveTab(null);
          setTerminalId(null);
          xtermRef.current?.clear();
        }
      }
    }
  }, [activateTab, daemon]);

  useEffect(() => {
    const updateUrl = () => setDaemonWsUrl(getDaemonWsUrl());
    updateUrl();
    if (typeof window !== 'undefined') {
      const handleStorage = (event) => {
        if (event.key && event.key !== 'soupz_daemon_url') return;
        updateUrl();
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const nextUrl = getDaemonWsUrl();
    if (nextUrl !== daemonWsUrl) {
      setDaemonWsUrl(nextUrl);
    }
  }, [daemon?.machine, daemon?.rootPath, daemon?.online]);

  return (
    <div className="h-full flex flex-col bg-bg-surface border-t border-border-subtle relative">
      {/* Header Tabs */}
      <div className={cn('flex items-center gap-3 shrink-0 bg-bg-surface border-b border-border-subtle/20', isMobileVariant ? 'h-11 px-3' : 'h-9 px-2 sm:px-4')}>
        <div className="flex items-center gap-1 h-full overflow-x-auto">
          {terminalTabs.length === 0 && (
            <span className="text-[11px] text-text-faint">No terminals yet</span>
          )}
          {terminalTabs.map(id => (
            <button
              key={id}
              onClick={() => activateTab(id)}
              className={cn(
                'px-2 py-1 rounded text-[11px] font-mono transition-colors border relative flex items-center gap-1',
                activeTab === id
                  ? 'border-accent text-text-pri bg-accent/10'
                  : 'border-transparent text-text-faint hover:text-text-pri hover:border-border-subtle'
              )}
            >
              <span>{`TTY ${id}`}</span>
              <button
                className="text-text-faint hover:text-text-pri transition-colors"
                onClick={(e) => { e.stopPropagation(); handleKillTab(id); }}
                title="Close terminal"
              >
                <X size={10} />
              </button>
            </button>
          ))}
          <button className="text-text-faint hover:text-text-pri transition-colors mt-0.5" title="New Terminal" onClick={spawnNewTerminal}>
            <Plus size={14} />
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
          <button
            onClick={() => handleKillTab()}
            disabled={!activeTab || killing}
            className={cn('p-1 rounded transition-colors', killing ? 'text-danger/60' : 'text-text-faint hover:text-danger hover:bg-danger/10', !activeTab && 'opacity-40 cursor-not-allowed')}
            title="Kill terminal session"
          >
            <Trash2 size={13} className={killing ? 'animate-spin' : ''} />
          </button>
          <button onClick={clearTerminal} className="p-1 text-text-faint hover:text-text-pri hover:bg-text-pri/10 rounded transition-colors" title="Clear buffer">
            <Eraser size={13} />
          </button>
          <div className="w-px h-3 bg-border-subtle mx-1" />
          <button onClick={onMaximize} className="p-1 text-text-faint hover:text-text-pri hover:bg-text-pri/10 rounded transition-colors" title={maximized ? "Restore" : "Maximize"}>
            {maximized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button onClick={onClose} className="p-1 text-text-faint hover:text-text-pri hover:bg-text-pri/10 rounded transition-colors" title="Close Panel">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div 
        ref={terminalRef} 
        className={cn('flex-1 overflow-hidden px-4 py-2', isMobileVariant && 'px-2 pb-3')}
        style={{ minHeight: 0, backgroundColor: 'transparent' }}
      />
    </div>
  );
}
