import { useState, useMemo } from 'react';
import {
  Folder, FolderOpen, ChevronRight, ChevronDown,
  FileCode2, FileText, FileJson, Globe, Palette,
  Lock, GitBranch, Image, File, Search, FolderOpen as FolderOpenIcon,
  FilePlus, FolderPlus, RotateCcw, MinusSquare
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

function getGitStatus(path, changedPaths) {
  // changedPaths is an array of relative paths from git status --porcelain
  // Examples: 'M src/App.jsx', '?? newfile.js'
  const entry = changedPaths.find(p => p.slice(3) === path || p === path);
  if (!entry) return null;
  if (entry.startsWith('M')) return { label: 'M', color: 'text-warning', bg: 'bg-warning/20' };
  if (entry.startsWith('??')) return { label: 'U', color: 'text-success', bg: 'bg-success/20' };
  if (entry.startsWith('A')) return { label: 'A', color: 'text-success', bg: 'bg-success/20' };
  return { label: 'M', color: 'text-warning', bg: 'bg-warning/20' };
}

function TreeNode({ node, depth = 0, changedPaths = [], onSelect, selectedPath, collapsedAll }) {
  // Start collapsed by default (open: false)
  const [open, setOpen] = useState(false);
  
  useMemo(() => {
    if (collapsedAll) setOpen(false);
  }, [collapsedAll]);

  const isDir = !!node.children;
  const Icon = isDir ? (open ? FolderOpen : Folder) : getFileIcon(node.name);
  const gitStatus = !isDir ? getGitStatus(node.path, changedPaths) : null;
  const isSelected = selectedPath === node.path;

  // For folders, check if any child has changes to show a dot
  const hasChildChanges = isDir && changedPaths.some(p => p.includes(node.path));

  return (
    <div>
      <div
        onClick={() => isDir ? setOpen(v => !v) : onSelect?.(node)}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        className={cn(
          'flex items-center gap-1.5 py-1 pr-2 cursor-pointer group select-none border-l-2 transition-all relative',
          isSelected
            ? 'bg-accent/10 text-accent border-accent font-medium'
            : cn('text-text-sec border-transparent hover:bg-bg-elevated hover:text-text-pri', gitStatus?.color)
        )}
      >
        <div className="w-4 flex items-center justify-center shrink-0">
          {isDir && (
            <span className="text-text-faint group-hover:text-text-sec">
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          )}
        </div>
        <Icon size={14} className={cn('shrink-0', isDir ? 'text-warning/80' : (isSelected ? 'text-accent' : ''))} />
        <span className="text-[13px] font-ui truncate flex-1">{node.name}</span>
        
        {gitStatus && (
          <span className={cn("text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-sm shrink-0", gitStatus.color)}>
            {gitStatus.label}
          </span>
        )}
        {hasChildChanges && !open && (
          <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0 absolute right-2" />
        )}
      </div>
      {isDir && open && node.children && (
        <div className="animate-fade-up">
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              changedPaths={changedPaths}
              onSelect={onSelect}
              selectedPath={selectedPath}
              collapsedAll={collapsedAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ tree, changedPaths = [], onSelect, selectedPath, rootName = 'PROJECT' }) {
  const [search, setSearch] = useState('');
  const [collapsedAll, setCollapsedAll] = useState(0);

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
      {/* VS Code Style Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle group/header">
        <span className="text-[11px] font-ui font-bold text-text-pri uppercase tracking-widest truncate">
          {rootName}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity">
          <button className="p-1 hover:bg-bg-elevated rounded text-text-faint hover:text-text-pri transition-colors" title="New File">
            <FilePlus size={13} />
          </button>
          <button className="p-1 hover:bg-bg-elevated rounded text-text-faint hover:text-text-pri transition-colors" title="New Folder">
            <FolderPlus size={13} />
          </button>
          <button 
            onClick={() => setCollapsedAll(v => v + 1)}
            className="p-1 hover:bg-bg-elevated rounded text-text-faint hover:text-text-pri transition-colors" 
            title="Collapse All"
          >
            <MinusSquare size={13} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files…"
            className="w-full pl-7 pr-3 py-1 bg-bg-base border border-border-subtle rounded text-[13px] font-ui text-text-pri placeholder:text-text-faint focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {!tree || !displayTree?.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-faint px-4">
            <FolderOpenIcon size={28} className="opacity-20" />
            <p className="text-[13px] font-ui text-center opacity-60">
              {search ? 'No files match' : 'Empty workspace'}
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
              collapsedAll={collapsedAll}
            />
          ))
        )}
      </div>
    </div>
  );
}
