import { useState } from 'react';
import { Plus, Trash2, Plug, ChevronDown, ChevronUp, Zap, Database } from 'lucide-react';

const MCP_KEY = 'soupz_mcp_servers';

// Preset MCP servers for quick-add (verified package names)
const MCP_PRESETS = [
  {
    name: 'Google Stitch',
    url: 'npx @_davideast/stitch-mcp',
    description: 'AI-powered UI design from Google Labs. Generate mockups and production-ready HTML/CSS. Requires gcloud auth.',
    category: 'design',
  },
  {
    name: 'Nano Banana',
    url: 'npx nano-banana-mcp',
    description: 'Google DeepMind image generation via Gemini API. Create illustrations and design assets. Requires GEMINI_API_KEY.',
    category: 'design',
  },
  {
    name: 'Stitch Universal',
    url: 'npx stitch-mcp',
    description: 'Universal Stitch MCP for any editor. Tools: build_site, get_screen_code, get_screen_image.',
    category: 'design',
  },
  {
    name: 'Filesystem',
    url: 'npx @modelcontextprotocol/server-filesystem',
    description: 'Read, write, and manage files on your local machine.',
    category: 'tools',
  },
  {
    name: 'GitHub',
    url: 'npx @modelcontextprotocol/server-github',
    description: 'Access GitHub repos, issues, PRs, and code search.',
    category: 'tools',
  },
  {
    name: 'Playwright',
    url: 'npx @anthropic-ai/mcp-playwright',
    description: 'Browser automation for screenshots, testing, and web scraping.',
    category: 'tools',
  },
];

function readMCP() {
  try { return JSON.parse(localStorage.getItem(MCP_KEY) || '[]'); } catch { return []; }
}

function saveMCP(servers) {
  localStorage.setItem(MCP_KEY, JSON.stringify(servers));
}

const ENV_TEMPLATE = `# Daemon (server-side)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Dashboard (client-side)
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>`;

const EMPTY_FORM = { name: '', url: '', description: '' };

export default function MCPPanel() {
  const [servers,   setServers]   = useState(readMCP);
  const [adding,    setAdding]    = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [collapsed, setCollapsed] = useState(true);
  const [showPresets, setShowPresets] = useState(false);

  const [dbCollapsed, setDbCollapsed] = useState(true);
  const [envCopied, setEnvCopied] = useState(false);

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

  function addPreset(preset) {
    // Don't add duplicates
    if (servers.some(s => s.name === preset.name)) return;
    const newServers = [...servers, { id: Date.now(), name: preset.name, url: preset.url, description: preset.description, status: 'unknown' }];
    setServers(newServers);
    saveMCP(newServers);
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

  function validateServerCommand(url) {
    if (!url) return false;
    // Valid if: http URL, localhost, npx/npm command, or known executables
    return /^https?:\/\/|localhost|127\.0\.0\.1|^npx\s|^npm\s|^(node|python|ruby|go|cargo|java)/.test(url.trim());
  }

  async function copyEnvTemplate() {
    try {
      await navigator.clipboard.writeText(ENV_TEMPLATE);
      setEnvCopied(true);
      setTimeout(() => setEnvCopied(false), 2000);
    } catch {
      setEnvCopied(false);
    }
  }

  return (
    <div className="border-t border-border-subtle">
      {/* Database Config Section */}
      <button
        onClick={() => setDbCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors border-b border-border-subtle"
      >
        <div className="flex items-center gap-2">
          <Database size={13} className="text-accent" />
          <span className="text-xs font-ui font-medium text-text-sec">Database Setup (Env Only)</span>
        </div>
        {dbCollapsed
          ? <ChevronDown size={12} className="text-text-faint" />
          : <ChevronUp   size={12} className="text-text-faint" />
        }
      </button>

      {!dbCollapsed && (
        <div className="px-4 py-4 space-y-3 border-b border-border-subtle">
          <p className="text-[11px] text-text-faint font-ui leading-relaxed">
            Supabase keys should not be entered in browser settings. Configure them in your <span className="font-mono">.env</span> file and restart the daemon/web app.
          </p>

          <pre className="bg-bg-base border border-border-subtle rounded-md p-2.5 text-[10px] leading-relaxed text-text-sec font-mono overflow-x-auto">
{ENV_TEMPLATE}
          </pre>

          <div className="flex gap-2">
            <button
              onClick={copyEnvTemplate}
              className="flex-1 py-1.5 rounded-md border border-border-subtle text-text-sec text-xs font-ui hover:border-accent hover:text-accent transition-all"
            >
              {envCopied ? 'Copied' : 'Copy .env Template'}
            </button>
            <a
              href="/docs/quickstart.md"
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center py-1.5 rounded-md border border-border-subtle text-text-sec text-xs font-ui hover:border-accent hover:text-accent transition-all"
            >
              Open Setup Doc
            </a>
          </div>
        </div>
      )}

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

          {servers.length > 0 && (
            <p className="text-[11px] text-success/70 font-ui bg-success/5 border border-success/10 rounded-md px-2.5 py-1.5">
              {servers.length} server{servers.length > 1 ? 's' : ''} active — sent with each AI request
            </p>
          )}

          {/* Empty state */}
          {servers.length === 0 && !adding && (
            <div className="border border-dashed border-border-mid rounded-lg py-4 flex flex-col items-center gap-2 text-center">
              <Plug size={18} className="text-text-faint opacity-40" />
              <p className="text-[11px] text-text-faint">No MCP servers configured</p>
            </div>
          )}

          {/* Server list */}
          {servers.map(s => {
            const isValid = validateServerCommand(s.url);
            return (
              <div
                key={s.id}
                className="flex items-start gap-2 bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-ui font-medium text-text-pri">{s.name}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${isValid ? 'bg-success animate-pulse' : 'bg-text-faint opacity-40'}`}
                      title={isValid ? 'Command is valid' : 'Command format not recognized'}
                    />
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
            );
          })}

          {/* Quick-add presets */}
          {showPresets && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-text-faint font-ui uppercase tracking-wider font-medium">Quick Add</p>
              {MCP_PRESETS.filter(p => !servers.some(s => s.name === p.name)).map(preset => (
                <button
                  key={preset.name}
                  onClick={() => addPreset(preset)}
                  className="w-full flex items-start gap-2.5 bg-bg-base border border-border-subtle rounded-lg px-3 py-2 hover:border-accent/30 transition-all text-left group"
                >
                  <Zap size={12} className="text-accent mt-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-ui font-medium text-text-pri">{preset.name}</span>
                    <p className="text-[10px] text-text-faint mt-0.5 line-clamp-2">{preset.description}</p>
                  </div>
                  <Plus size={12} className="text-text-faint group-hover:text-accent shrink-0 mt-0.5 transition-colors" />
                </button>
              ))}
              {MCP_PRESETS.filter(p => !servers.some(s => s.name === p.name)).length === 0 && (
                <p className="text-[10px] text-text-faint text-center py-2">All presets already added</p>
              )}
            </div>
          )}

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
            <div className="flex gap-2">
              <button
                onClick={() => setAdding(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-border-mid rounded-md text-xs font-ui text-text-faint hover:text-text-sec hover:border-border-strong transition-all"
              >
                <Plus size={12} />
                Custom
              </button>
              <button
                onClick={() => setShowPresets(v => !v)}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-accent/30 rounded-md text-xs font-ui text-accent/70 hover:text-accent hover:border-accent/50 transition-all"
              >
                <Zap size={12} />
                {showPresets ? 'Hide Presets' : 'Browse Presets'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
