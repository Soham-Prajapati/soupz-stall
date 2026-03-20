import { useState, useMemo } from 'react';
import {
  Brain, Trash2, Search, ChevronDown, ChevronUp, AlertTriangle, X,
} from 'lucide-react';
import { cn } from '../../lib/cn';
import { getAllShards, deleteMemoryShard, clearAllMemory } from '../../lib/memory';

function formatAge(timestamp) {
  const diff = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function estimateStorageBytes(shards) {
  try {
    const raw = localStorage.getItem('soupz_memory_shards');
    return raw ? new Blob([raw]).size : 0;
  } catch {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MemoryPanel() {
  const [collapsed, setCollapsed]       = useState(true);
  const [shards, setShards]             = useState(() => getAllShards());
  const [searchQuery, setSearchQuery]   = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const storageUsed = useMemo(() => estimateStorageBytes(shards), [shards]);

  // Filter shards by keyword search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return shards;
    const q = searchQuery.toLowerCase().trim();
    return shards.filter(s =>
      s.summary.toLowerCase().includes(q) ||
      s.keywords.some(k => k.includes(q)) ||
      (s.category && s.category.includes(q))
    );
  }, [shards, searchQuery]);

  function handleDelete(id) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    deleteMemoryShard(id);
    setShards(getAllShards());
    setConfirmDeleteId(null);
  }

  function handleClearAll() {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    clearAllMemory();
    setShards([]);
    setConfirmClearAll(false);
  }

  function refresh() {
    setShards(getAllShards());
  }

  return (
    <div className="border-t border-border-subtle">
      {/* Header / collapse toggle */}
      <button
        onClick={() => { setCollapsed(v => !v); if (collapsed) refresh(); }}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain size={13} className="text-accent" />
          <span className="text-xs font-ui font-medium text-text-sec">Memory</span>
          {shards.length > 0 && (
            <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-mono">
              {shards.length}
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
            Conversation memories are automatically saved and used to provide context in future sessions.
          </p>

          {/* Stats row */}
          {shards.length > 0 && (
            <div className="flex items-center gap-3 text-[10px] font-mono text-text-faint">
              <span>{shards.length} shard{shards.length !== 1 ? 's' : ''}</span>
              <span className="text-border-mid">|</span>
              <span>{formatBytes(storageUsed)}</span>
            </div>
          )}

          {/* Search */}
          {shards.length > 0 && (
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter by keyword..."
                className="w-full bg-bg-base border border-border-subtle rounded-md pl-7 pr-2.5 py-1.5 text-xs font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-sec transition-colors"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {shards.length === 0 && (
            <div className="border border-dashed border-border-mid rounded-lg py-4 flex flex-col items-center gap-2 text-center">
              <Brain size={18} className="text-text-faint opacity-40" />
              <p className="text-[11px] text-text-faint">No memories yet</p>
              <p className="text-[10px] text-text-faint px-4">Memories are saved automatically after conversations end.</p>
            </div>
          )}

          {/* Shard list */}
          {filtered.length > 0 && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {filtered.map(shard => (
                <div
                  key={shard.id}
                  className="bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 group"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-ui text-text-pri leading-snug line-clamp-2">
                        {shard.summary || 'No summary'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {shard.keywords.slice(0, 5).map(kw => (
                          <span
                            key={kw}
                            className="text-[9px] font-mono bg-accent/8 text-accent/70 px-1.5 py-0.5 rounded"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-text-faint font-ui">
                        <span>{formatAge(shard.timestamp)}</span>
                        {shard.agentId && shard.agentId !== 'unknown' && (
                          <>
                            <span className="text-border-mid">·</span>
                            <span>{shard.agentId}</span>
                          </>
                        )}
                        {shard.category && shard.category !== 'general' && (
                          <>
                            <span className="text-border-mid">·</span>
                            <span>{shard.category}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(shard.id)}
                      className={cn(
                        'shrink-0 mt-0.5 transition-colors',
                        confirmDeleteId === shard.id
                          ? 'text-danger'
                          : 'text-text-faint opacity-0 group-hover:opacity-100 hover:text-danger',
                      )}
                      title={confirmDeleteId === shard.id ? 'Click again to confirm' : 'Delete shard'}
                    >
                      {confirmDeleteId === shard.id
                        ? <AlertTriangle size={12} />
                        : <Trash2 size={12} />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No results for search */}
          {shards.length > 0 && filtered.length === 0 && searchQuery && (
            <p className="text-[11px] text-text-faint font-ui text-center py-2">
              No shards match "{searchQuery}"
            </p>
          )}

          {/* Clear all */}
          {shards.length > 0 && (
            <button
              onClick={handleClearAll}
              className={cn(
                'w-full flex items-center justify-center gap-1.5 py-1.5 border rounded-md text-xs font-ui transition-all',
                confirmClearAll
                  ? 'border-danger/30 bg-danger/5 text-danger hover:bg-danger/10'
                  : 'border-dashed border-border-mid text-text-faint hover:text-text-sec hover:border-border-strong',
              )}
            >
              <Trash2 size={12} />
              {confirmClearAll ? 'Click again to confirm clear all' : 'Clear All Memory'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
