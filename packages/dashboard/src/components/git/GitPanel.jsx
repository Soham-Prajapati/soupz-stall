import { useState, useEffect } from 'react';
import {
  GitBranch, Plus, Minus, Check, Upload, RefreshCw, ChevronDown, ChevronRight,
  Sparkles, Loader2,
} from 'lucide-react';
import { cn } from '../../lib/cn';

export default function GitPanel({ daemon }) {
  const [status, setStatus]     = useState(null);
  const [diff, setDiff]         = useState('');
  const [message, setMessage]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [staged, setStaged]     = useState(new Set());
  const [pushing, setPushing]   = useState(false);
  const [expandDiff, setExpandDiff] = useState(true);
  const [branch, setBranch]     = useState('main');
  const [generatingMsg, setGeneratingMsg] = useState(false);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [daemon]);

  async function refresh() {
    setLoading(true);
    try {
      const [s, d] = await Promise.all([
        daemon?.gitStatus?.(),
        daemon?.gitDiff?.(),
      ]);
      setStatus(s);
      setDiff(d || '');
      setBranch(s?.branch || 'main');
    } catch { /* no daemon */ }
    setLoading(false);
  }

  async function stageAll() {
    if (!status?.unstaged?.length) return;
    const paths = status.unstaged.map(f => f.path);
    await daemon?.gitStage?.(paths);
    setStaged(new Set(paths));
    refresh();
  }

  async function commit() {
    if (!message.trim()) return;
    setLoading(true);
    try {
      // Append Soupz co-author tag (like Claude Code / Copilot do)
      const coAuthor = '\n\nCo-Authored-By: Soupz <agent@soupz.vercel.app>';
      const fullMsg = message.trim().includes('Co-Authored-By:')
        ? message.trim()
        : message.trim() + coAuthor;
      await daemon?.gitCommit?.(fullMsg);
      setMessage('');
      refresh();
    } catch { /* no daemon */ }
    setLoading(false);
  }

  async function generateCommitMessage() {
    if (generatingMsg) return;
    setGeneratingMsg(true);
    try {
      // Get diff for context
      const diff = await daemon?.gitDiff?.() || {};
      const status = await daemon?.gitStatus?.() || {};

      const diffText = diff.diff || diff.content || '';
      const changedFiles = status.files?.map(f => f.path || f).join(', ') || '';

      const prompt = `Generate a concise git commit message (imperative mood, max 72 chars for subject line) for these changes:\n\nChanged files: ${changedFiles}\n\nDiff:\n${diffText.slice(0, 3000)}\n\nRespond with ONLY the commit message. No quotes, no explanation. Format: subject line, then optional blank line + bullet body.`;

      let result = '';
      if (daemon?.sendPrompt) {
        await daemon.sendPrompt({ prompt, agentId: 'auto', buildMode: 'quick' }, (chunk, done) => {
          result += chunk;
          if (!done) setMessage(result.trim());
        });
      }
      setMessage(result.trim() || message);
    } catch (err) {
      console.warn('Could not generate commit message:', err);
    } finally {
      setGeneratingMsg(false);
    }
  }

  async function push() {
    setPushing(true);
    try { await daemon?.gitPush?.(); } catch { /* no daemon */ }
    setPushing(false);
    refresh();
  }

  const unstagedFiles = status?.unstaged || [];
  const stagedFiles   = status?.staged   || [];

  return (
    <div className="flex flex-col h-full bg-bg-surface text-text-sec font-ui text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle shrink-0">
        <GitBranch size={13} className="text-accent" />
        <span className="text-text-pri font-medium text-xs">{branch}</span>
        <button
          onClick={refresh}
          disabled={loading}
          className="ml-auto p-2 -mr-2 text-text-faint hover:text-text-pri transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Staged */}
        <FileSection
          label="Staged"
          files={stagedFiles}
          icon={<Check size={11} className="text-success" />}
          onStageAll={null}
          emptyLabel="No staged changes"
        />

        {/* Unstaged */}
        <FileSection
          label="Changes"
          files={unstagedFiles}
          icon={<Minus size={11} className="text-warning" />}
          onStageAll={unstagedFiles.length ? stageAll : null}
          emptyLabel="Working tree clean"
        />

        {/* Diff viewer */}
        {diff && (
          <div className="border-t border-border-subtle">
            <button
              onClick={() => setExpandDiff(v => !v)}
              className="flex items-center gap-1.5 w-full px-3 py-2 hover:bg-bg-elevated text-text-faint hover:text-text-pri transition-colors"
            >
              {expandDiff ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span className="text-xs font-medium">Diff</span>
            </button>
            {expandDiff && (
              <div className="overflow-x-auto max-h-64 font-mono text-xs">
                {diff.split('\n').map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      'px-3 py-0.5 whitespace-pre',
                      line.startsWith('+') && !line.startsWith('+++') ? 'diff-add' : '',
                      line.startsWith('-') && !line.startsWith('---') ? 'diff-del' : '',
                      line.startsWith('@@') ? 'diff-hunk' : '',
                    )}
                  >
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Commit area */}
      <div className="border-t border-border-subtle p-3 shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-text-faint">Commit message</span>
          <button
            onClick={generateCommitMessage}
            disabled={generatingMsg || staged.length === 0}
            title="Generate commit message with AI"
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-ui text-text-faint hover:text-accent hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {generatingMsg ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            <span>Generate</span>
          </button>
        </div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Commit message…"
          rows={2}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit(); }}
          className="w-full bg-bg-elevated border border-border-subtle rounded p-2 text-xs font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors resize-none"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={commit}
            disabled={!message.trim() || loading}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 rounded text-xs font-medium transition-all',
              message.trim()
                ? 'bg-accent hover:bg-accent-hover text-white'
                : 'bg-bg-elevated text-text-faint cursor-not-allowed',
            )}
          >
            {loading ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
            Commit
          </button>
          <button
            onClick={push}
            disabled={pushing}
            className="flex items-center justify-center gap-1.5 px-4 py-2 sm:py-1.5 rounded text-xs font-medium bg-bg-elevated hover:bg-bg-overlay border border-border-subtle text-text-sec hover:text-text-pri transition-all disabled:opacity-50"
            title="Push"
          >
            {pushing ? <RefreshCw size={11} className="animate-spin" /> : <Upload size={11} />}
            Push
          </button>
        </div>
      </div>
    </div>
  );
}

function FileSection({ label, files, icon, onStageAll, emptyLabel }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-border-subtle last:border-0">
      <div
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-2 cursor-pointer hover:bg-bg-elevated group"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="text-xs font-medium text-text-sec flex-1">{label}</span>
        {files.length > 0 && (
          <span className="text-text-faint text-xs">{files.length}</span>
        )}
        {onStageAll && (
          <button
            onClick={e => { e.stopPropagation(); onStageAll(); }}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 ml-1 px-2 py-1 rounded bg-accent/10 text-accent text-[10px] sm:text-xs hover:bg-accent/20 transition-all flex items-center gap-1 shrink-0"
          >
            <Plus size={10} /> Stage all
          </button>
        )}
      </div>
      {open && (
        files.length === 0 ? (
          <p className="px-7 pb-2 text-text-faint text-xs">{emptyLabel}</p>
        ) : (
          files.map(f => (
            <div key={f.path} className="flex items-center gap-2 px-4 sm:px-7 py-1 sm:py-0.5 hover:bg-bg-elevated group/file">
              {icon}
              <span className="flex-1 truncate text-text-sec font-mono text-xs">{f.path}</span>
              <span className={cn(
                'text-xs font-mono',
                f.type === 'M' ? 'text-warning' : f.type === 'D' ? 'text-danger' : 'text-success',
              )}>
                {f.type}
              </span>
            </div>
          ))
        )
      )}
    </div>
  );
}
