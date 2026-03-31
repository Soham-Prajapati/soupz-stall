import { useState, useEffect, useMemo } from 'react';
import {
  GitBranch, Plus, Minus, Check, Upload, RefreshCw, ChevronDown, ChevronRight,
  Sparkles, Loader2,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { fetchBranches, checkoutBranch } from '../../lib/daemon';

const STATUS_META = {
  M: { label: 'MOD', className: 'border-warning/40 text-warning bg-warning/10' },
  D: { label: 'DEL', className: 'border-danger/40 text-danger bg-danger/10' },
  A: { label: 'ADD', className: 'border-success/40 text-success bg-success/10' },
  U: { label: 'NEW', className: 'border-success/40 text-success bg-success/10' },
  '?': { label: 'NEW', className: 'border-success/40 text-success bg-success/10' },
};

export default function GitPanel({ daemon }) {
  const [status, setStatus]     = useState(null);
  const [diff, setDiff]         = useState('');
  const [message, setMessage]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [pushing, setPushing]   = useState(false);
  const [expandDiff, setExpandDiff] = useState(true);
  const [branch, setBranch]     = useState('main');
  const [branches, setBranches] = useState([]);
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [branchDropdown, setBranchDropdown] = useState(false);
  const [commitError, setCommitError] = useState('');
  const repoRoot = daemon?.rootPath || daemon?.getRootPath?.() || '';
  const diffSections = useMemo(() => parseDiffSections(diff), [diff]);
  const [activeDiffId, setActiveDiffId] = useState(null);
  useEffect(() => {
    if (diffSections.length > 0) {
      setActiveDiffId(diffSections[0].id);
    } else {
      setActiveDiffId(null);
    }
  }, [diffSections]);
  const fileStatusMap = useMemo(() => {
    const map = new Map();
    const collect = (list = []) => {
      list.forEach(item => {
        if (!item?.path) return;
        map.set(item.path, item.type || item.status || 'M');
      });
    };
    if (status?.staged) collect(status.staged);
    if (status?.unstaged) collect(status.unstaged);
    if (Array.isArray(status?.files)) collect(status.files);
    return map;
  }, [status]);

  const diffFiles = useMemo(() => {
    if (!diffSections.length) return [];
    return diffSections.map(section => {
      const cleanPath = section.file?.replace(/^a\//, '').replace(/^b\//, '') || section.file;
      const statusCode = fileStatusMap.get(cleanPath) || fileStatusMap.get(section.file) || null;
      return {
        ...section,
        file: cleanPath,
        status: statusCode,
      };
    });
  }, [diffSections, fileStatusMap]);

  const activeDiff = diffFiles.find((sec) => sec.id === activeDiffId) || diffFiles[0];

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [daemon, repoRoot]);

  async function refresh() {
    setLoading(true);
    try {
      const [s, d, br] = await Promise.all([
        daemon?.gitStatus?.(),
        daemon?.gitDiff?.(),
        fetchBranches(repoRoot),
      ]);
      setStatus(s);
      const diffText = typeof d === 'string' ? d : (d?.diff || d?.content || '');
      setDiff(diffText);
      setBranch(br?.current || s?.branch || 'main');
      setBranches(br?.branches || []);
    } catch { /* no daemon */ }
    setLoading(false);
  }

  async function switchBranch(newBranch) {
    if (newBranch === branch) {
      setBranchDropdown(false);
      return;
    }
    try {
      await checkoutBranch(newBranch, undefined, repoRoot);
      setBranch(newBranch);
      setBranchDropdown(false);
      refresh();
    } catch (err) {
      console.error('Failed to checkout branch:', err);
    }
  }

  async function stageAll() {
    if (!status?.unstaged?.length) return;
    const paths = status.unstaged.map(f => f.path);
    await daemon?.gitStage?.(paths);
    refresh();
  }

  async function commit() {
    if (!message.trim()) return;
    setLoading(true);
    setCommitError('');
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
    if (!daemon?.sendPrompt) {
      setCommitError('Daemon is offline — cannot contact agents.');
      return;
    }
    setGeneratingMsg(true);
    setCommitError('');
    try {
      // Get diff for context
      const diffResult = await daemon?.gitDiff?.() || {};
      const statusResult = await daemon?.gitStatus?.() || {};

      const diffText = diffResult.diff || diffResult.content || '';
      const changedFiles = (statusResult.files || [])
        .map(f => f.path || f)
        .filter(Boolean)
        .join(', ');

      const prompt = `Generate a concise git commit message (imperative mood, max 72 chars for subject line) for these changes:\n\nChanged files: ${changedFiles}\n\nDiff:\n${diffText.slice(0, 3000)}\n\nRespond with ONLY the commit message. No quotes, no explanation. Format: subject line, then optional blank line + bullet body.`;

      let result = '';
      const orderId = await daemon.sendPrompt({ prompt, agentId: 'auto', buildMode: 'quick' }, (chunk, done) => {
        if (done) {
          setMessage(prev => (result.trim() || prev || '').trim());
          return;
        }
        result += chunk;
        setMessage(result.trim());
      });
      if (!orderId && !result.trim()) {
        setCommitError('No response from agent. Try again or pick a different provider.');
      }
    } catch (err) {
      console.warn('Could not generate commit message:', err);
      setCommitError(err?.message || 'Failed to contact agent.');
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
  const hasChanges    = (stagedFiles?.length || 0) > 0 || (unstagedFiles?.length || 0) > 0;

  return (
    <div className="flex flex-col h-full bg-bg-surface text-text-sec font-ui text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle shrink-0">
        <GitBranch size={13} className="text-accent" />
        <div className="relative flex-1">
          <button
            onClick={() => setBranchDropdown(!branchDropdown)}
            className="flex items-center gap-1 text-text-pri font-medium text-xs hover:text-accent transition-colors"
          >
            {branch}
            <ChevronDown size={11} className={cn('transition-transform', branchDropdown && 'rotate-180')} />
          </button>
          {branchDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-bg-surface border border-border-subtle rounded shadow-lg z-10 max-h-60 overflow-y-auto w-48 sm:w-56 max-w-[80vw]">
              {branches.map(b => (
                <button
                  key={b}
                  onClick={() => switchBranch(b)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 sm:py-2 text-xs hover:bg-bg-elevated transition-colors min-h-[44px] sm:min-h-0',
                    b === branch ? 'text-accent font-medium bg-accent/5' : 'text-text-sec'
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 -mr-2 text-text-faint hover:text-text-pri transition-colors"
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
        {diffFiles.length > 0 && (
          <div className="border-t border-border-subtle">
            <button
              onClick={() => setExpandDiff(v => !v)}
              className="flex items-center gap-1.5 w-full px-3 py-3 sm:py-2 hover:bg-bg-elevated text-text-faint hover:text-text-pri transition-colors min-h-[44px] sm:min-h-0"
            >
              {expandDiff ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <span className="text-xs font-medium">Diff</span>
            </button>
            {expandDiff && (
              <div className="border-t border-border-subtle/60 flex flex-col sm:flex-row">
                <div className="sm:w-52 border-b sm:border-b-0 sm:border-r border-border-subtle/60 bg-bg-base/50 max-h-48 sm:max-h-64 overflow-y-auto">
                  {diffFiles.map(section => (
                    <button
                      key={section.id}
                      onClick={() => setActiveDiffId(section.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 text-[11px] text-left border-l-2 transition-colors',
                        section.id === activeDiff?.id
                          ? 'border-accent bg-accent/5 text-text-pri'
                          : 'border-transparent text-text-sec hover:text-text-pri'
                      )}
                    >
                      <span className="flex-1 truncate font-mono">{section.file}</span>
                      {section.status && (
                        <span className={cn(
                          'text-[9px] font-mono px-1.5 py-0.5 rounded border shrink-0',
                          STATUS_META[section.status]?.className || 'border-border-subtle text-text-faint'
                        )}>
                          {STATUS_META[section.status]?.label || section.status}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-auto max-h-72 sm:max-h-80 font-mono text-xs">
                  {(activeDiff?.lines || diff.split('\n')).map((line, i) => (
                    <div
                      key={`${activeDiff?.id || 'diff'}-${i}`}
                      className={cn(
                        'px-3 py-0.5 whitespace-pre flex gap-3 min-h-[18px]',
                        line.startsWith('+') && !line.startsWith('+++') ? 'diff-add' : '',
                        line.startsWith('-') && !line.startsWith('---') ? 'diff-del' : '',
                        line.startsWith('@@') ? 'diff-hunk' : '',
                      )}
                    >
                      <span className="w-10 text-right text-text-faint/70 select-none">{i + 1}</span>
                      <span className="flex-1">{line || ' '}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {diffFiles.length === 0 && (
          <div className="border-t border-border-subtle px-4 py-6 text-center">
            <p className="text-[11px] text-text-faint font-ui">Working tree clean — no diff to show.</p>
          </div>
        )}
      </div>

      {/* Commit area */}
      <div className="border-t border-border-subtle p-3 shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-text-faint">Commit message</span>
          <button
            onClick={generateCommitMessage}
            disabled={generatingMsg || !hasChanges || !daemon?.sendPrompt}
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
        {commitError && (
          <p className="text-[11px] text-danger font-ui">{commitError}</p>
        )}
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
        className="flex flex-wrap items-center gap-1.5 px-3 py-3 sm:py-2 cursor-pointer hover:bg-bg-elevated group min-h-[44px] sm:min-h-0"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span className="text-xs font-medium text-text-sec flex-1">{label}</span>
        {files.length > 0 && (
          <span className="text-text-faint text-xs">{files.length}</span>
        )}
        {onStageAll && (
          <button
            onClick={e => { e.stopPropagation(); onStageAll(); }}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 ml-auto px-2 py-1 rounded bg-accent/10 text-accent text-[10px] sm:text-xs hover:bg-accent/20 transition-all flex items-center gap-1 shrink-0 w-full sm:w-auto justify-center sm:justify-start mt-2 sm:mt-0"
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
            <div key={f.path} className="flex items-center gap-2 px-4 sm:px-7 py-2.5 sm:py-1 hover:bg-bg-elevated group/file min-h-[44px] sm:min-h-0 min-w-0">
              {icon}
              <span className="flex-1 truncate text-text-sec font-mono text-xs min-w-0">{f.path}</span>
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

function parseDiffSections(raw) {
  if (!raw) return [];
  const lines = raw.split('\n');
  const sections = [];
  let current = null;
  lines.forEach((line) => {
    if (line.startsWith('diff --git')) {
      if (current) sections.push(current);
      const match = line.match(/ b\/(.+)$/);
      const file = match ? match[1] : line;
      current = { id: `${sections.length}-${file}`, file, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  });
  if (current) sections.push(current);
  if (sections.length === 0) {
    return [{ id: 'combined', file: 'Changes', lines }];
  }
  return sections;
}
