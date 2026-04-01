import { BookOpen, Download, ExternalLink, GitBranch, Network, Rocket, Terminal } from 'lucide-react';

const DOWNLOADS = [
  { title: 'Quickstart Guide', href: '/docs/quickstart.md', file: 'quickstart.md', desc: 'Install, pair, and run your first prompt.' },
  { title: 'Architecture Guide', href: '/docs/architecture.md', file: 'architecture.md', desc: 'Daemon, dashboard, relay, and orchestration flow.' },
  { title: 'Contributing Guide', href: '/docs/contributing.md', file: 'contributing.md', desc: 'Development setup, quality gates, and PR checklist.' },
];

function Section({ title, children, icon: Icon }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface p-6 md:p-8">
      <div className="flex items-center gap-2 mb-4">
        {Icon ? <Icon size={16} className="text-accent" /> : null}
        <h2 className="text-lg md:text-xl font-semibold text-text-pri">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function DocsPage({ navigate }) {
  return (
    <div className="min-h-screen bg-bg-base text-text-pri pb-16">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg-base/90 backdrop-blur px-4 md:px-8 h-14 flex items-center">
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-accent" />
            <span className="font-semibold">Soupz Docs</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate?.('/dashboard')}
              className="px-3 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated"
            >
              Open Dashboard
            </button>
            <a
              href="https://github.com/Soham-Prajapati/soupz-stall"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs rounded-md border border-border-subtle bg-bg-surface hover:bg-bg-elevated inline-flex items-center gap-1"
            >
              GitHub <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 pt-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <section className="rounded-xl border border-accent/20 bg-accent/5 p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Build From Anywhere, Locally</h1>
            <p className="mt-3 text-sm md:text-base text-text-sec max-w-3xl">
              Soupz is a local-first AI orchestration cockpit. Run local CLI agents on your machine and control them from any browser.
              This docs hub is designed to be the single place for setup, architecture, and contribution.
            </p>
          </section>

          <Section title="Quick Start" icon={Rocket}>
            <ol className="text-sm text-text-sec space-y-2 list-decimal pl-5">
              <li>Install and run: <code className="font-mono text-accent">npx soupz-cockpit</code> (alias: <code className="font-mono text-accent">npx soupz</code>).</li>
              <li>Open the pairing link or scan the terminal QR code.</li>
              <li>Connect your phone or browser and select a provider.</li>
              <li>Send a prompt, inspect edits, run terminal commands, and commit.</li>
            </ol>
            <div className="mt-4 text-xs text-text-faint">
              If setup checks fail, open the Setup Wizard in-app and follow the provider hints.
            </div>
          </Section>

          <Section title="Documentation Downloads" icon={Download}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DOWNLOADS.map((item) => (
                <a
                  key={item.file}
                  href={item.href}
                  download={item.file}
                  className="rounded-lg border border-border-subtle bg-bg-base p-4 hover:bg-bg-elevated transition-colors"
                >
                  <div className="text-sm font-semibold text-text-pri">{item.title}</div>
                  <div className="mt-1 text-xs text-text-sec">{item.desc}</div>
                  <div className="mt-3 text-xs text-accent inline-flex items-center gap-1">
                    Download <Download size={12} />
                  </div>
                </a>
              ))}
            </div>
          </Section>

          <Section title="Architecture Flow" icon={Network}>
            <p className="text-sm text-text-sec mb-4">
              Core runtime path from prompt to output and file changes.
            </p>
            <div className="overflow-auto rounded-lg border border-border-subtle bg-bg-base p-4">
              <div className="min-w-[760px] grid grid-cols-5 gap-3 items-center text-xs">
                <div className="rounded-md border border-border-subtle bg-bg-surface p-3 text-center">Browser UI</div>
                <div className="text-center text-text-faint">-&gt;</div>
                <div className="rounded-md border border-border-subtle bg-bg-surface p-3 text-center">Local Daemon API</div>
                <div className="text-center text-text-faint">-&gt;</div>
                <div className="rounded-md border border-border-subtle bg-bg-surface p-3 text-center">CLI Agent Runner</div>

                <div className="rounded-md border border-border-subtle bg-bg-surface p-3 text-center">WebSocket Stream</div>
                <div className="text-center text-text-faint">&lt;-</div>
                <div className="rounded-md border border-border-subtle bg-bg-surface p-3 text-center">Order Lifecycle</div>
                <div className="text-center text-text-faint">&lt;-</div>
                <div className="rounded-md border border-border-subtle bg-bg-surface p-3 text-center">Provider Output</div>

                <div className="rounded-md border border-border-subtle bg-bg-surface p-3 text-center">File Tree + Git</div>
                <div className="text-center text-text-faint">&lt;-</div>
                <div className="rounded-md border border-border-subtle bg-bg-surface p-3 text-center">Filesystem/Git APIs</div>
                <div className="text-center text-text-faint">&lt;-</div>
                <div className="rounded-md border border-border-subtle bg-bg-surface p-3 text-center">Workspace Root</div>
              </div>
            </div>
          </Section>

          <Section title="Contributing" icon={GitBranch}>
            <ol className="text-sm text-text-sec space-y-2 list-decimal pl-5">
              <li>Fork and clone the repo.</li>
              <li>Run <code className="font-mono text-accent">npm run dev:web</code> for daemon + dashboard.</li>
              <li>For frontend changes, run <code className="font-mono text-accent">cd packages/dashboard && npm run build</code>.</li>
              <li>Run <code className="font-mono text-accent">npm test</code> at repo root before opening a PR.</li>
              <li>Open a PR with test output and a short risk note.</li>
            </ol>
          </Section>

          <Section title="Context Hub (Gemini Relay Pattern)" icon={Terminal}>
            <p className="text-sm text-text-sec">
              A practical first step is a shared context file in <code className="font-mono text-accent">.soupz/CONTEXT.md</code> plus a lightweight query/answer queue.
              Smaller-context agents post focused questions, and a Gemini lane resolves them with citations.
            </p>
            <div className="mt-3 text-xs text-text-faint">
              Realistic now: single shared context file + queue, explicit ownership, and freshness checks.
            </div>
            <div className="mt-1 text-xs text-text-faint">
              Not realistic today: fully autonomous 4-5 agent loop without strict guards, dedupe, and backpressure.
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
