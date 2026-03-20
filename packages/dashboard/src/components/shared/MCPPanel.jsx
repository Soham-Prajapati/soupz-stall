import { useState } from 'react';
import { Plus, Trash2, Plug, ChevronDown, ChevronUp } from 'lucide-react';

const MCP_KEY = 'soupz_mcp_servers';

function readMCP() {
  try { return JSON.parse(localStorage.getItem(MCP_KEY) || '[]'); } catch { return []; }
}

function saveMCP(servers) {
  localStorage.setItem(MCP_KEY, JSON.stringify(servers));
}

const EMPTY_FORM = { name: '', url: '', description: '' };

export default function MCPPanel() {
  const [servers,   setServers]   = useState(readMCP);
  const [adding,    setAdding]    = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [collapsed, setCollapsed] = useState(true);

  function addServer() {
    if (!form.name.trim() || !form.url.trim()) return;
    const newServers = [...servers, { id: Date.now(), ...form, status: 'unknown' }];
    setServers(newServers);
    saveMCP(newServers);
    setForm(EMPTY_FORM);
    setAdding(false);
  }

  function removeServer(id) {
    const next = servers.filter(s => s.id !== id);
    setServers(next);
    saveMCP(next);
  }

  function cancelAdding() {
    setAdding(false);
    setForm(EMPTY_FORM);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addServer();
    }
    if (e.key === 'Escape') cancelAdding();
  }

  return (
    <div className="border-t border-border-subtle">
      {/* Header / collapse toggle */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <Plug size={13} className="text-accent" />
          <span className="text-xs font-ui font-medium text-text-sec">MCP Servers</span>
          {servers.length > 0 && (
            <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-mono">
              {servers.length}
            </span>
          )}
        </div>
        {collapsed
          ? <ChevronDown size={12} className="text-text-faint" />
          : <ChevronUp   size={12} className="text-text-faint" />
        }
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-text-faint font-ui leading-relaxed">
            Connect MCP (Model Context Protocol) servers to give agents access to tools, databases, and APIs.
          </p>

          {/* Empty state */}
          {servers.length === 0 && !adding && (
            <div className="border border-dashed border-border-mid rounded-lg py-4 flex flex-col items-center gap-2 text-center">
              <Plug size={18} className="text-text-faint opacity-40" />
              <p className="text-[11px] text-text-faint">No MCP servers configured</p>
            </div>
          )}

          {/* Server list */}
          {servers.map(s => (
            <div
              key={s.id}
              className="flex items-start gap-2 bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-ui font-medium text-text-pri">{s.name}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-text-faint animate-pulse shrink-0" />
                </div>
                <p className="text-[10px] font-mono text-text-faint truncate">{s.url}</p>
                {s.description && (
                  <p className="text-[10px] text-text-faint mt-0.5">{s.description}</p>
                )}
              </div>
              <button
                onClick={() => removeServer(s.id)}
                className="text-text-faint hover:text-danger transition-colors mt-0.5 shrink-0"
                title="Remove server"
                aria-label={`Remove ${s.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {/* Add-server form */}
          {adding ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="Name (e.g. Filesystem)"
                className="w-full bg-bg-base border border-border-subtle rounded-md px-2.5 py-1.5 text-xs font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
              />
              <input
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="URL or command (e.g. http://localhost:3100)"
                className="w-full bg-bg-base border border-border-subtle rounded-md px-2.5 py-1.5 text-xs font-mono text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
              />
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="Description (optional)"
                className="w-full bg-bg-base border border-border-subtle rounded-md px-2.5 py-1.5 text-xs font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={addServer}
                  disabled={!form.name.trim() || !form.url.trim()}
                  className="flex-1 py-1.5 rounded-md bg-accent text-white text-xs font-ui font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Add Server
                </button>
                <button
                  onClick={cancelAdding}
                  className="px-3 py-1.5 rounded-md border border-border-subtle text-text-faint text-xs font-ui hover:text-text-sec transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-border-mid rounded-md text-xs font-ui text-text-faint hover:text-text-sec hover:border-border-strong transition-all"
            >
              <Plus size={12} />
              Add MCP Server
            </button>
          )}
        </div>
      )}
    </div>
  );
}
