import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ExternalLink, Search, Loader2, RefreshCw, Compass, Command, ArrowRight, Hash, Link as LinkIcon } from 'lucide-react';
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

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugifyHeading(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function parseMarkdown(markdown = '') {
  const lines = String(markdown || '').split('\n');
  const html = [];
  const outline = [];
  let inCode = false;
  let codeLang = '';
  let codeLines = [];
  let listType = null;

  const closeList = () => {
    if (!listType) return;
    html.push(listType === 'ol' ? '</ol>' : '</ul>');
    listType = null;
  };

  const inline = (value) => escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');

  for (const rawLine of lines) {
    const line = String(rawLine || '');
    const trimmed = line.trim();

    if (inCode) {
      if (/^```/.test(trimmed)) {
        html.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCode = false;
        codeLang = '';
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (/^```/.test(trimmed)) {
      closeList();
      inCode = true;
      codeLang = trimmed.slice(3).trim();
      codeLines = [];
      continue;
    }

    if (!trimmed) {
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const title = heading[2].trim();
      const id = slugifyHeading(title);
      outline.push({ level, title, id });
      html.push(`<h${level} id="${id}">${inline(title)}</h${level}>`);
      continue;
    }

    const ul = trimmed.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      if (listType !== 'ul') {
        closeList();
        html.push('<ul>');
        listType = 'ul';
      }
      html.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    const ol = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (listType !== 'ol') {
        closeList();
        html.push('<ol>');
        listType = 'ol';
      }
      html.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    const blockquote = trimmed.match(/^>\s+(.+)$/);
    if (blockquote) {
      closeList();
      html.push(`<blockquote><p>${inline(blockquote[1])}</p></blockquote>`);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeList();
      html.push('<hr />');
      continue;
    }

    closeList();
    html.push(`<p>${inline(trimmed)}</p>`);
  }

  closeList();
  if (inCode) {
    html.push(`<pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }

  return { html: html.join('\n'), outline };
}

export default function DocsPage({ navigate, workspace }) {
  const searchInputRef = useRef(null);
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

  const renderedDoc = useMemo(() => parseMarkdown(content), [content]);

  const pageSummary = useMemo(() => {
    const headings = renderedDoc.outline.map((item) => item.title);
    return headings.length ? headings.slice(0, 3).join(' · ') : selectedDoc.desc;
  }, [renderedDoc.outline, selectedDoc.desc]);

  const loadDoc = async (path) => {
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      let text = await workspace?.readFile?.(path);
      if (typeof text !== 'string' || !text.trim()) {
        text = await workspace?.getGitFileVersion?.(path, 'HEAD');
      }
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
              onClick={() => searchInputRef.current?.focus()}
              className="px-3 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated inline-flex items-center gap-1"
              title="Search docs"
            >
              <Search size={12} /> Search
            </button>
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
          <aside className="lg:col-span-3 rounded-xl border border-border-subtle bg-bg-surface overflow-hidden h-fit">
            <div className="p-4 border-b border-border-subtle">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                <input
                  ref={searchInputRef}
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

          <section className="lg:col-span-6 rounded-xl border border-border-subtle bg-bg-surface overflow-hidden min-h-[70dvh]">
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
              <div className="rounded-lg border border-border-subtle bg-bg-base p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                  <Compass size={14} className="text-accent" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-text-faint mb-1">Reading Path</div>
                  <p className="text-sm text-text-sec leading-relaxed">{pageSummary}</p>
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
                <article
                  className={cn(
                    'docs-render prose prose-invert max-w-none rounded-lg border border-border-subtle bg-bg-base p-5 text-[13px] leading-7 text-text-sec overflow-auto max-h-[75dvh]',
                    '[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-text-pri [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:scroll-mt-24',
                    '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text-pri [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:scroll-mt-24',
                    '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-text-pri [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:scroll-mt-24',
                    '[&_p]:my-3 [&_a]:text-accent [&_a:hover]:text-accent-hover [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6',
                    '[&_li]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border-mid [&_blockquote]:pl-4 [&_blockquote]:text-text-faint',
                    '[&_pre]:my-4 [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border-subtle [&_pre]:bg-bg-elevated [&_pre]:p-4 [&_code]:rounded [&_code]:bg-bg-elevated [&_code]:px-1.5 [&_code]:py-0.5'
                  )}
                  dangerouslySetInnerHTML={{ __html: renderedDoc.html }}
                />
              )}
            </div>
          </section>

          <aside className="lg:col-span-3 rounded-xl border border-border-subtle bg-bg-surface overflow-hidden h-fit sticky top-[88px]">
            <div className="p-4 border-b border-border-subtle">
              <div className="text-[11px] uppercase tracking-wider text-text-faint mb-2 inline-flex items-center gap-1.5">
                <Hash size={12} /> On this page
              </div>
              <div className="space-y-1 max-h-[30dvh] overflow-y-auto pr-1">
                {renderedDoc.outline.length > 0 ? renderedDoc.outline.map((item) => (
                  <a
                    key={`${item.id}-${item.title}`}
                    href={`#${item.id}`}
                    className={cn(
                      'flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-bg-elevated transition-colors',
                      item.level === 1 ? 'text-text-pri font-medium' : item.level === 2 ? 'text-text-sec pl-3' : 'text-text-faint pl-6'
                    )}
                  >
                    <ArrowRight size={12} className="text-accent shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </a>
                )) : (
                  <div className="text-sm text-text-faint">No headings detected in this document.</div>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-lg border border-border-subtle bg-bg-base p-3 text-xs text-text-sec leading-relaxed">
                <div className="text-[11px] uppercase tracking-wider text-text-faint mb-2 inline-flex items-center gap-1.5">
                  <Search size={12} /> Move Around
                </div>
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5"><Command size={12} /> Use the search bar to jump across docs.</div>
                  <div className="inline-flex items-center gap-1.5"><LinkIcon size={12} /> Use the outline to jump inside this page.</div>
                  <div className="inline-flex items-center gap-1.5"><Compass size={12} /> Open source links when available.</div>
                </div>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => searchInputRef.current?.focus()}
                  className="px-3 py-2 rounded-md border border-border-subtle bg-bg-base hover:bg-bg-elevated text-sm text-text-pri inline-flex items-center justify-center gap-2"
                >
                  <Search size={13} /> Search docs
                </button>
                {SHOW_SOURCE_LINKS ? (
                  <a
                    href={toGitHubUrl(selectedDoc.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-md border border-border-subtle bg-bg-base hover:bg-bg-elevated text-sm text-text-pri inline-flex items-center justify-center gap-2"
                  >
                    Open source <ExternalLink size={13} />
                  </a>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
