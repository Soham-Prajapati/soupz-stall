import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useThemeVars } from '../../hooks/useThemeVars';
import { getDaemonWsUrl } from '../../lib/daemon';

export default function TerminalPage() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [validating, setValidating] = useState(true);

  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const terminalIdRef = useRef(null);

  const themeVars = useThemeVars(['--bg-base', '--bg-surface', '--text-pri', '--accent', '--accent-hover']);

  const buildTermTheme = useCallback(() => ({
    background: '#000000', // Black background for full screen as requested
    foreground: themeVars['--text-pri'] || '#E5E7EB',
    cursor: themeVars['--accent'] || '#6366F1',
    selectionBackground: `${themeVars['--accent'] || '#6366F1'}33`,
  }), [themeVars]);

  // 1. Read token and remote from URL params
  const getParam = useCallback((key) => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get(key);
  }, []);

  const token = getParam('token');
  const remote = getParam('remote');

  // 2. Validate Token
  useEffect(() => {
    let active = true;

    async function validateToken() {
      if (!token) {
        if (active) setError('Missing terminal token in URL');
        setValidating(false);
        return;
      }

      // Build target base URL from remote or use default daemon URL logic
      let baseUrl = 'http://localhost:7533';
      if (remote) {
        baseUrl = remote.startsWith('http') ? remote : `http://${remote}`;
      } else if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('soupz_daemon_url') || sessionStorage.getItem('soupz_daemon_url_session');
        if (stored) baseUrl = stored;
      }

      try {
        const res = await fetch(`${baseUrl}/api/terminal/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        
        if (!active) return;

        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setValidating(false);
          } else {
            setError('Invalid or expired terminal session');
            setValidating(false);
          }
        } else {
          setError('Invalid or expired terminal session');
          setValidating(false);
        }
      } catch (err) {
        if (active) {
          setError('Failed to reach daemon for validation');
          setValidating(false);
        }
      }
    }

    validateToken();
    return () => { active = false; };
  }, [token, remote]);

  // 3 & 4 & 5. Setup Xterm and WebSocket connection
  useEffect(() => {
    if (validating || error || !token) return;

    // Initialize Xterm
    const term = new Terminal({
      cursorBlinking: true,
      fontSize: 14,
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
      try {
        fitAddon.fit();
      } catch { /* ignore */ }
    }

    // Input to WebSocket
    term.onData(data => {
      if (wsRef.current?.readyState === 1 && terminalIdRef.current) {
        wsRef.current.send(JSON.stringify({ type: 'input', terminalId: terminalIdRef.current, data }));
      }
    });

    // Build WS URL
    let targetWsUrl = getDaemonWsUrl();
    if (remote) {
      targetWsUrl = remote.startsWith('http') ? remote.replace(/^http/, 'ws') : `ws://${remote}`;
    }

    if (!targetWsUrl) {
      setError('Unable to resolve daemon WebSocket URL');
      return;
    }

    const ws = new WebSocket(targetWsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate the WS connection itself (using the regular session token if available, or local-dev)
      const daemonToken = localStorage.getItem('soupz_daemon_token') || 'local-dev';
      ws.send(JSON.stringify({ type: 'auth', token: daemonToken, clientType: 'terminal' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Once authenticated, send create_terminal including the terminalToken
        if (msg.type === 'auth_success') {
          ws.send(JSON.stringify({
            type: 'create_terminal',
            terminalToken: token, // Binding PTY to our REST token
            cols: xtermRef.current?.cols || 80,
            rows: xtermRef.current?.rows || 24,
          }));
        }

        if (msg.type === 'terminal_created') {
          terminalIdRef.current = msg.terminalId;
          setConnected(true);
          // Auto-subscribe to receive output
          ws.send(JSON.stringify({ type: 'subscribe', terminalId: msg.terminalId }));
        }

        if (msg.type === 'history') {
          if (xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.write(msg.data || '');
          }
        }

        if (msg.type === 'output') {
          if (xtermRef.current) {
            xtermRef.current.write(msg.data);
          }
        }

        if (msg.type === 'exit') {
          xtermRef.current?.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
          setConnected(false);
          terminalIdRef.current = null;
        }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      xtermRef.current?.write('\r\n\x1b[31m[WebSocket connection error]\x1b[0m\r\n');
      setConnected(false);
    };

    ws.onclose = () => setConnected(false);

    return () => {
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      ws.close();
    };
  }, [validating, error, token, remote, buildTermTheme]);

  // Update theme dynamically if needed
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;
    const theme = buildTermTheme();
    if (typeof term.setOption === 'function') {
      term.setOption('theme', theme);
      try {
        term.refresh(0, term.rows - 1);
      } catch { /* ignore */ }
    }
  }, [buildTermTheme]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      fitAddonRef.current?.fit();
      if (wsRef.current?.readyState === 1 && terminalIdRef.current && xtermRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'resize_terminal',
          terminalId: terminalIdRef.current,
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
  }, [validating, error]);

  if (validating) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white/60 font-mono text-sm">
        Validating session...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-red-500 font-mono text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden">
      {/* Full screen terminal container */}
      <div 
        ref={terminalRef} 
        className="flex-1 overflow-hidden px-4 py-2"
        style={{ minHeight: 0, backgroundColor: 'transparent' }}
      />
      
      {/* 8. Thin status bar at bottom */}
      <div className="flex items-center px-4 shrink-0 bg-neutral-950 border-t border-neutral-900 h-6">
        {connected ? (
          <span className="text-[10px] text-green-500 font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> connected
          </span>
        ) : (
          <span className="text-[10px] text-neutral-500 font-mono">
            connecting...
          </span>
        )}
      </div>
    </div>
  );
}
