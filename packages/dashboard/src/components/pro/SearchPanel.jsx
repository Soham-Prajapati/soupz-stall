import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FileCode2, CaseSensitive, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Flatten a nested file tree into a list of leaf nodes (files only).
 */
function flattenTree(nodes, out = []) {
  if (!nodes) return out;
  for (const node of nodes) {
    if (node.children) {
      flattenTree(node.children, out);
    } else {
      out.push(node);
    }
  }
  return out;
}

/**
 * SearchPanel — full-text search across workspace files.
 * Fetches file contents from the daemon and searches client-side.
 */
export default function SearchPanel({ daemon, fileTree, onOpenFile }) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState([]); // [{ file, matches: [{ line, lineNum, col }] }]
  const [totalCount, setTotalCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const abortRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q, cs) => {
    // Cancel any in-flight search
    if (abortRef.current) abortRef.current.abort = true;

    if (!q || q.length < 2) {
      setResults([]);
      setTotalCount(0);
      setSearching(false);
      return;
    }

    const files = flattenTree(fileTree);
    if (!files.length) {
      setResults([]);
      setTotalCount(0);
      setSearching(false);
      return;
    }

    const controller = { abort: false };
    abortRef.current = controller;
    setSearching(true);

    const searchQuery = cs ? q : q.toLowerCase();
    const fileResults = [];
    let count = 0;

    // Search files in batches to keep UI responsive
    const BATCH = 10;
    for (let i = 0; i < files.length; i += BATCH) {
      if (controller.abort) return;

      const batch = files.slice(i, i + BATCH);
      const contents = await Promise.all(
        batch.map(async (f) => {
          try {
            const data = await daemon?.readFile?.(f.path);
            // readFile may return { content: '...' } or a string
            const text = typeof data === 'string' ? data : data?.content ?? '';
            return { file: f, text };
          } catch {
            return { file: f, text: '' };
          }
        })
      );

      for (const { file, text } of contents) {
        if (controller.abort) return;
        if (!text) continue;

        const lines = text.split('\n');
        const matches = [];

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx];
          const compareLine = cs ? line : line.toLowerCase();
          let col = compareLine.indexOf(searchQuery);
          while (col !== -1) {
            matches.push({
              lineNum: lineIdx + 1,
              col: col + 1,
              text: line.trimStart(),
              matchStart: col - (line.length - line.trimStart().length),
              raw: line,
            });
            col = compareLine.indexOf(searchQuery, col + 1);
          }
        }

        if (matches.length > 0) {
          fileResults.push({ file, matches });
          count += matches.length;
        }
      }
    }

    if (!controller.abort) {
      setResults(fileResults);
      setTotalCount(count);
      setSearching(false);
    }
  }, [daemon, fileTree]);

  // Debounced search trigger
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query, caseSensitive);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, caseSensitive, doSearch]);

  function handleResultClick(file, lineNum) {
    onOpenFile?.({ ...file, lineNum });
  }

  function highlightMatch(text, q, cs) {
    if (!q) return text;
    const flags = cs ? 'g' : 'gi';
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, flags));
    return parts.map((part, i) => {
      const isMatch = cs ? part === q : part.toLowerCase() === q.toLowerCase();
      return isMatch ? (
        <mark key={i} className="bg-accent/30 text-text-pri rounded-sm px-0.5">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      );
    });
  }

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      {/* Search input */}
      <div className="px-3 py-2 border-b border-border-subtle shrink-0 space-y-2">
        <div className="relative flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search in files..."
              className="w-full pl-7 pr-7 py-1.5 bg-bg-elevated border border-border-subtle rounded text-xs font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-sec"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setCaseSensitive(v => !v)}
            title={caseSensitive ? 'Case sensitive (on)' : 'Case sensitive (off)'}
            className={cn(
              'w-7 h-7 rounded flex items-center justify-center transition-all shrink-0',
              caseSensitive
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'text-text-faint hover:text-text-sec hover:bg-bg-elevated border border-transparent',
            )}
          >
            <CaseSensitive size={14} />
          </button>
        </div>

        {/* Result count */}
        {(query.length >= 2 || searching) && (
          <div className="flex items-center gap-1.5 text-[11px] font-ui text-text-faint">
            {searching ? (
              <>
                <Loader2 size={10} className="animate-spin" />
                <span>Searching...</span>
              </>
            ) : (
              <span>
                {totalCount} {totalCount === 1 ? 'result' : 'results'} in {results.length} {results.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {!query || query.length < 2 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-faint px-4">
            <Search size={28} className="opacity-40" />
            <p className="text-xs font-ui text-center">
              Type at least 2 characters to search across files
            </p>
          </div>
        ) : results.length === 0 && !searching ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-faint px-4">
            <Search size={28} className="opacity-40" />
            <p className="text-xs font-ui text-center">
              No results found
            </p>
          </div>
        ) : (
          results.map(({ file, matches }) => (
            <FileResultGroup
              key={file.path}
              file={file}
              matches={matches}
              query={query}
              caseSensitive={caseSensitive}
              highlightMatch={highlightMatch}
              onClick={handleResultClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FileResultGroup({ file, matches, query, caseSensitive, highlightMatch, onClick }) {
  const [collapsed, setCollapsed] = useState(false);
  const filename = file.name;
  const dir = file.path.split('/').slice(0, -1).join('/');

  return (
    <div className="mb-0.5">
      {/* File header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-1 hover:bg-bg-elevated transition-colors group"
      >
        <FileCode2 size={12} className="text-text-sec shrink-0" />
        <span className="text-xs font-ui text-text-pri truncate">{filename}</span>
        {dir && (
          <span className="text-[10px] font-ui text-text-faint truncate ml-1">{dir}</span>
        )}
        <span className="ml-auto text-[10px] font-ui text-text-faint bg-bg-elevated px-1.5 py-0.5 rounded shrink-0">
          {matches.length}
        </span>
      </button>

      {/* Match lines */}
      {!collapsed && (
        <div>
          {matches.slice(0, 50).map((m, i) => (
            <button
              key={`${m.lineNum}-${m.col}-${i}`}
              onClick={() => onClick(file, m.lineNum)}
              className="w-full flex items-start gap-2 pl-7 pr-3 py-0.5 hover:bg-bg-elevated/70 transition-colors text-left"
            >
              <span className="text-[10px] font-mono text-text-faint w-6 text-right shrink-0 pt-px">
                {m.lineNum}
              </span>
              <span className="text-xs font-mono text-text-sec truncate flex-1">
                {highlightMatch(m.text, query, caseSensitive)}
              </span>
            </button>
          ))}
          {matches.length > 50 && (
            <div className="pl-7 pr-3 py-1">
              <span className="text-[10px] font-ui text-text-faint">
                ...and {matches.length - 50} more matches
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
