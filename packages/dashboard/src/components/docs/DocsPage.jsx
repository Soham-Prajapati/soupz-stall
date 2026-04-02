import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ExternalLink, Search, Loader2, RefreshCw, Compass, Command } from 'lucide-react';
import { cn } from '../../lib/cn';

const REPO_WEB_BASE = 'https://github.com/Soham-Prajapati/soupz-stall/blob/main/';
const SHOW_SOURCE_LINKS = import.meta.env.VITE_SHOW_SOURCE_LINKS === 'true';

const DOC_INDEX = [
  {
    title: 'Production E2E Flow',
    path: 'docs/guides/PRODUCTION_E2E_USER_FLOW.md',
    category: 'Canonical',
    desc: 'First-run flow, pairing/auth, prompt transport, remote access, and launch checklist.',
  },
  {
    title: 'Runtime Behavior',
    path: 'docs/CURRENT_SYSTEM.md',
    category: 'Canonical',
    desc: 'Canonical runtime behavior and orchestration semantics.',
  },
  {
    title: 'Setup Guide',
    path: 'docs/SETUP.md',
    category: 'Canonical',
    desc: 'Install, pair, run, and troubleshoot the stack.',
  },
  {
    title: 'Runtime Changelog',
    path: 'docs/RUNTIME_CHANGELOG.md',
    category: 'Canonical',
    desc: 'Date-stamped production behavior changes.',
  },
  {
    title: 'Documentation Index',
    path: 'docs/README.md',
    category: 'Canonical',
    desc: 'Entry point to current and historical docs.',
  },
  {
    title: 'System Architecture',
    path: 'docs/architecture/SYSTEM_ARCHITECTURE.md',
    category: 'Architecture',
    desc: 'Current architecture across dashboard, daemon, and relay.',
  },
  {
    title: 'Project Overview',
    path: 'PROJECT_OVERVIEW.md',
    category: 'Project',
    desc: 'Broad project compendium and implementation snapshot.',
  },
  {
    title: 'Keyboard Parity',
    path: 'docs/guides/KEYBOARD_PARITY.md',
    category: 'Guides',
    desc: 'Cross-platform shortcut parity and rendering notes.',
  },
  {
    title: 'Overlay Stacking',
    path: 'docs/guides/OVERLAY_STACKING_CONVENTION.md',
    category: 'Guides',
    desc: 'Layering system and z-index conventions.',
  },
  {
    title: 'Owner Checklist',
    path: 'docs/guides/OWNER_ACTION_CHECKLIST.md',
    category: 'Guides',
    desc: 'Operational checklist for release and runtime health.',
  },
];

function toGitHubUrl(path) {
  return `${REPO_WEB_BASE}${path}`;
}

export default function DocsPage({ navigate, workspace }) {
  const [query, setQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState(DOC_INDEX[0].path);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DOC_INDEX;
    return DOC_INDEX.filter((doc) => (
      doc.title.toLowerCase().includes(q)
      || doc.path.toLowerCase().includes(q)
      || doc.desc.toLowerCase().includes(q)
      || doc.category.toLowerCase().includes(q)
    ));
  }, [query]);

  const selectedDoc = useMemo(
    () => DOC_INDEX.find((doc) => doc.path === selectedPath) || DOC_INDEX[0],
    [selectedPath],
  );

  const loadDoc = async (path) => {
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      const text = await workspace?.readFile?.(path);
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('Document content unavailable from workspace API.');
      }
      setContent(text);
    } catch (err) {
      setContent('');
      setError(err?.message || 'Unable to load document');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoc(selectedDoc.path);
  }, [selectedDoc.path]);

  return (
    <div className="min-h-[100dvh] min-h-screen bg-bg-base text-text-pri pb-10">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg-base/90 backdrop-blur px-4 md:px-8 h-[calc(56px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen size={16} className="text-accent" />
            <span className="font-semibold truncate">Soupz Docs</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate?.('/dashboard')}
              className="px-3 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated"
            >
              Open Dashboard
            </button>
            {SHOW_SOURCE_LINKS ? (
              <a
                href="https://github.com/Soham-Prajapati/soupz-stall"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated inline-flex items-center gap-1"
              >
                GitHub <ExternalLink size={12} />
              </a>
            ) : (
              <span className="px-3 py-1.5 text-[11px] rounded-md border border-border-subtle bg-bg-surface text-text-faint">
                Private repository
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 pt-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          <aside className="lg:col-span-4 xl:col-span-3 rounded-xl border border-border-subtle bg-bg-surface overflow-hidden h-fit">
            <div className="p-4 border-b border-border-subtle">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find docs..."
                  className="w-full pl-8 pr-3 py-2 rounded-md bg-bg-elevated border border-border-subtle text-sm text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="max-h-[65dvh] overflow-auto">
              {filteredDocs.length === 0 ? (
                <div className="p-4 text-sm text-text-faint">No matching docs.</div>
              ) : (
                filteredDocs.map((doc) => (
                  <button
                    key={doc.path}
                    type="button"
                    onClick={() => setSelectedPath(doc.path)}
                    className={cn(
                      'w-full text-left p-3 border-b border-border-subtle/60 transition-colors',
                      selectedDoc.path === doc.path
                        ? 'bg-accent/10 text-text-pri'
                        : 'hover:bg-bg-elevated text-text-sec',
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">{doc.category}</div>
                    <div className="text-sm font-semibold">{doc.title}</div>
                    <div className="text-xs text-text-faint mt-1 line-clamp-2">{doc.desc}</div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="lg:col-span-8 xl:col-span-9 rounded-xl border border-border-subtle bg-bg-surface overflow-hidden min-h-[70dvh]">
            <div className="px-4 py-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-base font-semibold truncate">{selectedDoc.title}</h1>
                <p className="text-xs text-text-faint truncate">{selectedDoc.path}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadDoc(selectedDoc.path)}
                  className="px-2.5 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-base hover:bg-bg-elevated inline-flex items-center gap-1"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
                {SHOW_SOURCE_LINKS ? (
                  <a
                    href={toGitHubUrl(selectedDoc.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-base hover:bg-bg-elevated inline-flex items-center gap-1"
                  >
                    Open Source <ExternalLink size={12} />
                  </a>
                ) : null}
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="rounded-lg border border-border-subtle bg-bg-base p-3">
                <div className="text-[11px] uppercase tracking-wider text-text-faint mb-2 inline-flex items-center gap-1.5">
                  <Compass size={12} /> Search Scopes
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-text-sec">
                  <div className="rounded border border-border-subtle bg-bg-surface px-2 py-1.5">Sidebar Search: workspace text search across files.</div>
                  <div className="rounded border border-border-subtle bg-bg-surface px-2 py-1.5">Editor Find: in-file search for current editor only.</div>
                  <div className="rounded border border-border-subtle bg-bg-surface px-2 py-1.5 inline-flex items-center gap-1.5"><Command size={12} /> Command Palette: actions, files, and commands.</div>
                </div>
              </div>

              {loading ? (
                <div className="rounded-lg border border-border-subtle bg-bg-base p-8 flex items-center justify-center gap-2 text-text-faint">
                  <Loader2 size={14} className="animate-spin" />
                  Loading document...
                </div>
              ) : error ? (
                <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning space-y-2">
                  <div>{error}</div>
                  {SHOW_SOURCE_LINKS ? (
                    <div className="text-xs">
                      You can still open this document directly in GitHub:
                      {' '}
                      <a className="underline" href={toGitHubUrl(selectedDoc.path)} target="_blank" rel="noreferrer">
                        {selectedDoc.path}
                      </a>
                    </div>
                  ) : (
                    <div className="text-xs text-text-faint">Document unavailable through current workspace connection.</div>
                  )}
                </div>
              ) : (
                <pre className="rounded-lg border border-border-subtle bg-bg-base p-4 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-text-sec overflow-auto max-h-[70dvh]">
                  {content}
                </pre>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
