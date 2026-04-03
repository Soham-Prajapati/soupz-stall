import { useState, useEffect, useMemo } from 'react';
import {
  GitBranch, Plus, Minus, Check, Upload, RefreshCw, ChevronDown, ChevronRight,
  Sparkles, Loader2,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { fetchBranches, checkoutBranch, getGitLog } from '../../lib/daemon';

const STATUS_META = {
  M: { label: 'MOD', className: 'border-warning/40 text-warning bg-warning/10' },
  D: { label: 'DEL', className: 'border-danger/40 text-danger bg-danger/10' },
  A: { label: 'ADD', className: 'border-success/40 text-success bg-success/10' },
  U: { label: 'NEW', className: 'border-success/40 text-success bg-success/10' },
  '?': { label: 'NEW', className: 'border-success/40 text-success bg-success/10' },
};

function resolveCoAuthorIdentity() {
  return 'Soupz <agent@soupz.vercel.app>';
}

function normalizeGitPath(path = '') {
  const cleaned = String(path || '').trim();
  if (!cleaned) return '';
  if (cleaned.includes('->')) {
    const parts = cleaned.split('->');
    return parts[parts.length - 1].trim();
  }
  return cleaned;
}

function dedupeFiles(files = []) {
  const map = new Map();
  files.forEach((item) => {
    const normalizedPath = normalizeGitPath(item?.path);
    if (!normalizedPath) return;
    map.set(normalizedPath, {
      ...item,
      path: normalizedPath,
      type: item?.type || item?.status || 'M',
    });
  });
  return Array.from(map.values());
}

export default function GitPanel({ daemon, onOpenFile, onCompareFile, compact = false }) {
  const [status, setStatus]     = useState(null);
  const [diff, setDiff]         = useState('');
  const [recentCommits, setRecentCommits] = useState([]);
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
        const normalizedPath = normalizeGitPath(item.path);
        if (!normalizedPath) return;
        const statusType = item.type || item.status || 'M';
        map.set(normalizedPath, statusType);
      });
    };
    if (status?.staged) collect(status.staged);
    if (status?.unstaged) collect(status.unstaged);
    if (Array.isArray(status?.files)) collect(status.files);
    return map;
  }, [status]);

  const stagedFiles = useMemo(() => dedupeFiles(status?.staged || []), [status?.staged]);
  const unstagedFiles = useMemo(() => dedupeFiles(status?.unstaged || []), [status?.unstaged]);

  const totalChangedFiles = useMemo(() => {
    const seen = new Set();
    stagedFiles.forEach(file => seen.add(file.path));
    unstagedFiles.forEach(file => seen.add(file.path));
    return seen.size;
  }, [stagedFiles, unstagedFiles]);

  const diffFiles = useMemo(() => {
    if (!diffSections.length) return [];
    return diffSections.map(section => {
      const cleanPath = section.file?.replace(/^a\//, '').replace(/^b\//, '') || section.file;
      const normalizedPath = normalizeGitPath(cleanPath);
      const statusCode = fileStatusMap.get(normalizedPath) || fileStatusMap.get(cleanPath) || fileStatusMap.get(section.file) || null;
      return {
        ...section,
        file: normalizedPath || cleanPath,
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

  useEffect(() => {
    if (compact) setExpandDiff(false);
  }, [compact]);

  async function refresh() {
    setLoading(true);
    try {
      const [s, d, br, log] = await Promise.all([
        daemon?.gitStatus?.(),
        daemon?.gitDiff?.(),
        fetchBranches(repoRoot),
        getGitLog(repoRoot, undefined, 6),
      ]);
      setStatus(s);
      const diffText = typeof d === 'string' ? d : (d?.diff || d?.content || '');
      setDiff(diffText);
      setBranch(br?.current || s?.branch || 'main');
      setBranches(br?.branches || []);
      setRecentCommits(Array.isArray(log?.commits) ? log.commits : []);
      setCommitError('');
    } catch {
      setCommitError('Unable to load git data for this workspace. Open a git repo folder and refresh.');
    }
    setLoading(false);
  }

  function buildLocalCommitSuggestion(statusResult = {}, diffText = '') {
    const files = dedupeFiles([
      ...(statusResult?.staged || []),
      ...(statusResult?.unstaged || []),
      ...(statusResult?.files || []),
    ]);

    if (!files.length) return 'chore: update project files';

    const primary = files[0];
    const remaining = files.length - 1;
    const noun = remaining > 0 ? `${primary.path} +${remaining}` : primary.path;

    if (/test|spec/i.test(noun) || /\n[+-].*test/i.test(diffText)) {
      return `test: update ${noun}`;
    }
    if (/readme|docs?|\.md$/i.test(noun)) {
      return `docs: update ${noun}`;
    }
    if (/fix|bug|error/i.test(diffText)) {
      return `fix: update ${noun}`;
    }
    return `feat: update ${noun}`;
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
    if (!unstagedFiles.length) return;
    const paths = unstagedFiles.map(f => f.path);
    await daemon?.gitStage?.(paths);
    refresh();
  }

  async function commit() {
    if (!message.trim()) return;
    setLoading(true);
    setCommitError('');
    try {
      const coAuthorIdentity = resolveCoAuthorIdentity();
      const coAuthor = `\n\nCo-Authored-By: ${coAuthorIdentity}`;
      const fullMsg = message.trim().includes('Co-Authored-By:')
        ? message.trim()
        : message.trim() + coAuthor;
      await daemon?.gitCommit?.(fullMsg);
      window.dispatchEvent(new CustomEvent('soupz_complete_onboarding_item', { detail: { id: 'commit' } }));
      setMessage('');
      refresh();
    } catch { /* no daemon */ }
    setLoading(false);
  }

  async function generateCommitMessage() {
    if (generatingMsg) return;
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

      // Local fallback always available.
      const localDraft = buildLocalCommitSuggestion(statusResult, diffText);

      if (!daemon?.sendPrompt) {
        setMessage(localDraft);
        setCommitError('AI generator unavailable. Inserted a local draft message.');
        return;
      }

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
        setMessage(localDraft);
        setCommitError('No AI response. Inserted a local draft message.');
      }
    } catch (err) {
      console.warn('Could not generate commit message:', err);
      try {
        const diffResult = await daemon?.gitDiff?.() || {};
        const statusResult = await daemon?.gitStatus?.() || {};
        const diffText = diffResult.diff || diffResult.content || '';
        setMessage(buildLocalCommitSuggestion(statusResult, diffText));
      } catch { /* ignore secondary failure */ }
      setCommitError(err?.message || 'AI generation failed. Inserted a local draft message.');
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

  const hasChanges    = (stagedFiles?.length || 0) > 0 || (unstagedFiles?.length || 0) > 0;

  return (
    <div className="flex flex-col h-full bg-bg-surface text-text-sec font-ui text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-subtle shrink-0">
        <GitBranch size={13} className="text-accent" />
        {compact ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <select
              value={branch}
              onChange={(e) => switchBranch(e.target.value)}
              className="min-w-0 flex-1 bg-bg-elevated border border-border-subtle rounded px-2 py-1.5 text-xs text-text-pri"
            >
              {(branches.length ? branches : [branch]).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <span className="text-[10px] text-text-faint shrink-0">{totalChangedFiles}</span>
          </div>
        ) : (
          <div className="relative flex-1">
            <button
              onClick={() => setBranchDropdown(!branchDropdown)}
              className="flex items-center gap-1 text-text-pri font-medium text-xs hover:text-accent transition-colors"
            >
              {branch}
              <span className="text-[10px] text-text-faint">({totalChangedFiles})</span>
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
        )}
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
          compact={compact}
          label="Staged"
          files={stagedFiles}
          icon={<Check size={11} className="text-success" />}
          onFileOpen={onOpenFile}
          onFileCompare={onCompareFile}
          onStageAll={null}
          emptyLabel="No staged changes"
        />

        {/* Unstaged */}
        <FileSection
          compact={compact}
          label="Changes"
          files={unstagedFiles}
          icon={<Minus size={11} className="text-warning" />}
          onFileOpen={onOpenFile}
          onFileCompare={onCompareFile}
          onStageAll={unstagedFiles.length ? stageAll : null}
          emptyLabel="Working tree clean"
        />

        <div className="border-t border-border-subtle px-3 py-2.5 text-[11px] text-text-faint">
          Diff view opens in the center editor when you click a changed file.
        </div>

        {recentCommits.length > 0 && (
          <div className="border-t border-border-subtle">
            <div className="px-3 py-2 text-[11px] font-medium text-text-faint">Recent commits</div>
            <div className="max-h-40 overflow-y-auto">
              {recentCommits.map((commit) => (
                <div key={commit.hash} className="px-3 py-2 border-t border-border-subtle/50">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono text-text-faint">{String(commit.hash || '').slice(0, 7)}</span>
                    <span className="truncate text-text-pri">{commit.message}</span>
                  </div>
                  <div className="text-[10px] text-text-faint mt-0.5 truncate">{commit.author}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Commit area */}
      <div className="border-t border-border-subtle p-3 shrink-0 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-text-faint">Commit message</span>
          <button
            onClick={generateCommitMessage}
            disabled={generatingMsg || !hasChanges}
            title="Generate commit message with AI"
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-ui text-text-faint hover:text-accent hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {generatingMsg ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            <span>Generate</span>
          </button>
        </div>
        <p className="text-[10px] text-text-faint">Commit uses your local git author plus: Co-Authored-By: Soupz.</p>
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

function FileSection({ compact = false, label, files, icon, onStageAll, emptyLabel, onFileOpen, onFileCompare }) {
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
            <Plus size={10} /> {compact ? 'Stage' : 'Stage all'}
          </button>
        )}
      </div>
      {open && (
        files.length === 0 ? (
          <p className="px-7 pb-2 text-text-faint text-xs">{emptyLabel}</p>
        ) : (
          files.map(f => (
            <button
              key={f.path}
              type="button"
              onClick={() => {
                if (typeof onFileCompare === 'function') {
                  onFileCompare(f.path);
                } else {
                  onFileOpen?.(f.path);
                }
              }}
              className="w-full flex items-center gap-2 px-4 sm:px-7 py-2.5 sm:py-1 hover:bg-bg-elevated group/file min-h-[44px] sm:min-h-0 min-w-0 text-left"
            >
              {icon}
              <span className="flex-1 truncate text-text-sec font-mono text-xs min-w-0">{f.path}</span>
              <span className={cn(
                'text-xs font-mono',
                f.type === 'M' ? 'text-warning' : f.type === 'D' ? 'text-danger' : 'text-success',
              )}>
                {f.type}
              </span>
            </button>
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
