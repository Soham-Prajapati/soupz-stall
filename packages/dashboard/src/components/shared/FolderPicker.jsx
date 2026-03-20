import { useState, useEffect } from 'react';
import {
  Folder, FolderOpen, ChevronLeft, GitBranch, X, Loader2,
  ArrowRight, Home,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { listDirectories } from '../../lib/daemon';

export default function FolderPicker({ open, onClose, onSelect }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  async function loadDir(path) {
    setLoading(true);
    setError(null);
    try {
      const result = await listDirectories(path);
      if (result) {
        setData(result);
      } else {
        setError('Could not load directories. Is the daemon running?');
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (open) loadDir();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-bg-elevated border border-border-mid rounded-xl overflow-hidden z-10">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          <FolderOpen size={16} className="text-accent" />
          <span className="text-sm font-ui font-medium text-text-pri flex-1">Open Folder</span>
          <button onClick={onClose} className="text-text-faint hover:text-text-sec transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Current path */}
        {data && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-bg-surface">
            <button
              onClick={() => loadDir(data.parent)}
              className="text-text-faint hover:text-text-sec transition-colors"
              title="Go up"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => loadDir()}
              className="text-text-faint hover:text-text-sec transition-colors"
              title="Home"
            >
              <Home size={12} />
            </button>
            <span className="text-xs font-mono text-text-sec truncate flex-1">{data.current}</span>
            {data.isGitRepo && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-success border border-success/20 rounded px-1.5 py-0.5">
                <GitBranch size={9} /> git
              </span>
            )}
          </div>
        )}

        {/* Directory list */}
        <div className="max-h-[320px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="text-text-faint animate-spin" />
            </div>
          )}

          {error && (
            <div className="p-4 text-center">
              <p className="text-xs text-danger font-ui">{error}</p>
            </div>
          )}

          {data && !loading && data.dirs.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-xs text-text-faint font-ui">No subdirectories</p>
            </div>
          )}

          {data && !loading && data.dirs.map(dir => (
            <div
              key={dir.path}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-overlay transition-colors cursor-pointer group border-b border-border-subtle last:border-0"
            >
              <button
                onClick={() => loadDir(dir.path)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <Folder size={14} className="text-warning shrink-0" />
                <span className="text-xs font-ui text-text-pri truncate">{dir.name}</span>
                {dir.isGitRepo && (
                  <span className="flex items-center gap-0.5 text-[9px] font-mono text-success/70 shrink-0">
                    <GitBranch size={8} />
                  </span>
                )}
              </button>
              <button
                onClick={() => { onSelect(dir.path); onClose(); }}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-ui text-accent px-2 py-1 rounded border border-accent/20 hover:bg-accent/10 transition-all shrink-0"
              >
                Open <ArrowRight size={9} />
              </button>
            </div>
          ))}
        </div>

        {/* Footer — open current folder */}
        {data && (
          <div className="px-4 py-3 border-t border-border-subtle bg-bg-surface">
            <button
              onClick={() => { onSelect(data.current); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-ui font-medium transition-all"
            >
              <FolderOpen size={13} />
              Open this folder
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
