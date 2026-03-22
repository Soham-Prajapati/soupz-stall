import { useState, useMemo } from 'react';
import {
  Folder, FolderOpen, ChevronRight, ChevronDown,
  FileCode2, FileText, FileJson, Globe, Palette,
  Lock, GitBranch, Image, File, Search,
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

function getGitStatus(path, changedPaths = []) {
  const paths = Array.isArray(changedPaths) ? changedPaths : [];
  // porcelain uses 'M path', '?? path', etc.
  // We trim and check if the second part matches path
  const entry = paths.find(p => {
    const parts = p.match(/^(\S+\s+)(.*)$/);
    return parts && parts[2] === path;
  });

  if (!entry) return null;
  const status = entry.slice(0, 2);
  if (status.includes('M')) return { label: 'M', color: 'text-warning', bg: 'bg-warning/20' };
  if (status.includes('??')) return { label: 'U', color: 'text-success', bg: 'bg-success/20' };
  if (status.includes('A')) return { label: 'A', color: 'text-success', bg: 'bg-success/20' };
  return { label: 'M', color: 'text-warning', bg: 'bg-warning/20' };
}

function TreeNode({ node, depth = 0, changedPaths = [], onSelect, selectedPath, collapsedAll }) {
  const [open, setOpen] = useState(false);
  
  useMemo(() => {
    if (collapsedAll) setOpen(false);
  }, [collapsedAll]);

  const isDir = !!node.children;
  const Icon = isDir ? (open ? FolderOpen : Folder) : getFileIcon(node.name);
  const paths = Array.isArray(changedPaths) ? changedPaths : [];
  const gitStatus = !isDir ? getGitStatus(node.path, paths) : null;
  const isSelected = selectedPath === node.path;

  const hasModified = isDir && paths.some(p => {
    const parts = p.match(/^(\S+\s+)(.*)$/);
    return parts && parts[1].includes('M') && parts[2].startsWith(node.path);
  });
  const hasUntracked = isDir && !hasModified && paths.some(p => {
    const parts = p.match(/^(\S+\s+)(.*)$/);
    return parts && parts[1].includes('??') && parts[2].startsWith(node.path);
  });

  return (
    <div>
      <div
        onClick={() => isDir ? setOpen(v => !v) : onSelect?.(node)}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
        className={cn(
          'flex items-center gap-1.5 py-1 pr-2 cursor-pointer group select-none border-l-[2px] transition-all relative h-7',
          isSelected
            ? 'bg-bg-elevated text-text-pri border-accent font-medium'
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
        <Icon size={14} className={cn('shrink-0', isDir ? 'text-[#EAB308]/80' : (isSelected ? 'text-accent' : ''))} />
        <span className="text-[13px] font-ui truncate flex-1">{node.name}</span>
        
        {gitStatus && (
          <span className={cn("text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-sm shrink-0", gitStatus.color)}>
            {gitStatus.label}
          </span>
        )}
        {isDir && !open && (
          <div className="flex gap-1 absolute right-2 shrink-0">
            {hasModified && <div className="w-1.5 h-1.5 rounded-full bg-warning" />}
            {hasUntracked && <div className="w-1.5 h-1.5 rounded-full bg-success" />}
          </div>
        )}
      </div>
      {isDir && open && node.children && (
        <div className="">
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

export default function FileTree({ tree, changedPaths = [], onSelect, selectedPath, rootName = 'PROJECT', onCreateFile, onCreateFolder, onRefresh }) {
  const [collapsedAll, setCollapsedAll] = useState(0);
  const [creating, setCreating] = useState(null); // { type: 'file' | 'folder' }
  const [newName, setNewName] = useState('');

  function handleCreate(e) {
    if (e.key === 'Enter' && newName.trim()) {
      if (creating.type === 'file') onCreateFile?.(newName.trim());
      else onCreateFolder?.(newName.trim());
      setCreating(null);
      setNewName('');
    } else if (e.key === 'Escape') {
      setCreating(null);
      setNewName('');
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-base">
      {/* VS Code Style Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle group">
        <span className="text-[11px] font-ui font-bold text-text-pri uppercase tracking-widest truncate">
          {rootName}
        </span>
        <div className="flex items-center gap-0.5">
          <button 
            onClick={(e) => { e.stopPropagation(); setCreating({ type: 'file' }); }}
            className="p-1 hover:bg-white/10 rounded text-text-faint hover:text-text-pri transition-colors" 
            title="New File"
          >
            <FilePlus size={13} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setCreating({ type: 'folder' }); }}
            className="p-1 hover:bg-white/10 rounded text-text-faint hover:text-text-pri transition-colors" 
            title="New Folder"
          >
            <FolderPlus size={13} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onRefresh?.(); }}
            className="p-1 hover:bg-white/10 rounded text-text-faint hover:text-text-pri transition-colors" 
            title="Refresh Explorer"
          >
            <RotateCcw size={13} />
          </button>
          <button 
            onClick={() => setCollapsedAll(v => v + 1)}
            className="p-1 hover:bg-white/10 rounded text-text-faint hover:text-text-pri transition-colors" 
            title="Collapse All"
          >
            <MinusSquare size={13} />
          </button>
        </div>
      </div>

      {creating && (
        <div className="px-3 py-1.5 flex items-center gap-2 bg-accent/5 border-b border-accent/20">
          {creating.type === 'file' ? <FileCode2 size={12} className="text-accent" /> : <Folder size={12} className="text-warning" />}
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={handleCreate}
            onBlur={() => setCreating(null)}
            placeholder={`Enter ${creating.type} name...`}
            className="flex-1 bg-transparent text-xs font-ui text-text-pri outline-none"
          />
        </div>
      )}

      {/* Tree container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {(!tree || tree.length === 0) ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[11px] text-text-faint font-ui italic">No files in project</p>
          </div>
        ) : (
          tree.map(node => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              changedPaths={changedPaths}
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
