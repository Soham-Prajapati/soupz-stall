import { useState } from 'react';
import {
  Folder, FolderOpen, ChevronRight, ChevronDown,
  FileCode2, FileText, FileJson, Globe, Palette,
  Lock, GitBranch, Image, File, Search, FolderOpen as FolderOpenIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';

const EXT_ICONS = {
  js: FileCode2, ts: FileCode2, jsx: FileCode2, tsx: FileCode2,
  md: FileText, txt: FileText, rst: FileText,
  json: FileJson, jsonc: FileJson,
  html: Globe, htm: Globe,
  css: Palette, scss: Palette, sass: Palette, less: Palette,
  env: Lock,
  gitignore: GitBranch,
  svg: Image, png: Image, jpg: Image, jpeg: Image, gif: Image, webp: Image, ico: Image,
};

function getFileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  const base = name.toLowerCase();
  if (base === '.gitignore' || base === '.gitattributes') return GitBranch;
  if (base.startsWith('.env')) return Lock;
  return EXT_ICONS[ext] || File;
}

function TreeNode({ node, depth = 0, changedPaths = new Set(), onSelect, selectedPath }) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = !!node.children;
  const Icon = isDir ? (open ? FolderOpen : Folder) : getFileIcon(node.name);
  const isChanged = changedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <div
        onClick={() => isDir ? setOpen(v => !v) : onSelect?.(node)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={cn(
          'flex items-center gap-1.5 py-1 pr-2 rounded-sm cursor-pointer group select-none',
          isSelected
            ? 'bg-accent/15 text-text-pri'
            : 'text-text-sec hover:bg-bg-elevated hover:text-text-pri',
        )}
      >
        {isDir && (
          <span className="text-text-faint w-3 shrink-0">
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </span>
        )}
        {!isDir && <span className="w-3 shrink-0" />}
        <Icon size={13} className={cn('shrink-0', isDir ? 'text-warning' : 'text-text-sec')} />
        <span className="text-xs font-ui truncate flex-1">{node.name}</span>
        {isChanged && (
          <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" title="Modified" />
        )}
      </div>
      {isDir && open && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              changedPaths={changedPaths}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ tree, changedPaths = [], onSelect, selectedPath }) {
  const [search, setSearch] = useState('');
  const changedSet = new Set(changedPaths);

  function filterTree(nodes, q) {
    if (!q) return nodes;
    return nodes.reduce((acc, node) => {
      if (node.children) {
        const filtered = filterTree(node.children, q);
        if (filtered.length) acc.push({ ...node, children: filtered });
      } else if (node.name.toLowerCase().includes(q.toLowerCase())) {
        acc.push(node);
      }
      return acc;
    }, []);
  }

  const displayTree = search && tree ? filterTree(tree, search) : tree;

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      {/* Search */}
      <div className="px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files…"
            className="w-full pl-7 pr-3 py-1.5 bg-bg-elevated border border-border-subtle rounded text-xs font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1.5 min-h-0">
        {!tree || !displayTree?.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-faint px-4">
            <FolderOpenIcon size={28} className="opacity-40" />
            <p className="text-xs font-ui text-center">
              {search ? 'No files match your search' : 'Open a folder to browse files'}
            </p>
          </div>
        ) : (
          displayTree.map(node => (
            <TreeNode
              key={node.path}
              node={node}
              changedPaths={changedSet}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))
        )}
      </div>
    </div>
  );
}
