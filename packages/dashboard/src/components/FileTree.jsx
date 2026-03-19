import { useState } from 'react';

const FILE_ICONS = {
  js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️', css: '🎨', html: '🌐',
  json: '📋', md: '📝', py: '🐍', sh: '⚙️', env: '🔑', gitignore: '🚫',
  svg: '🖼️', png: '🖼️', jpg: '🖼️', default: '📄',
};

function getIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

function FileNode({ node, depth = 0, selectedFile, onFileSelect, changedFiles = [] }) {
  const [open, setOpen] = useState(depth < 2);
  const isDir = node.type === 'directory';
  const isSelected = !isDir && selectedFile === node.path;
  const isChanged = changedFiles.includes(node.path);

  return (
    <div>
      <div
        onClick={() => isDir ? setOpen(!open) : onFileSelect(node)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: `4px 8px 4px ${12 + depth * 14}px`,
          cursor: 'pointer', borderRadius: '4px', fontSize: '13px',
          color: isSelected ? '#fafafa' : isChanged ? '#f59e0b' : '#a1a1aa',
          background: isSelected ? '#27272a' : 'transparent',
          userSelect: 'none',
        }}
      >
        {isDir ? (
          <span style={{ fontSize: '10px', color: '#52525b' }}>{open ? '▾' : '▸'}</span>
        ) : null}
        <span>{isDir ? (open ? '📂' : '📁') : getIcon(node.name)}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        {isChanged && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />}
      </div>
      {isDir && open && node.children?.map(child => (
        <FileNode
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedFile={selectedFile}
          onFileSelect={onFileSelect}
          changedFiles={changedFiles}
        />
      ))}
    </div>
  );
}

export default function FileTree({ tree, selectedFile, onFileSelect, changedFiles = [] }) {
  if (!tree) {
    return (
      <div style={{ padding: '20px', color: '#52525b', fontSize: '13px', textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📁</div>
        <p>Open a folder to start</p>
        <button
          onClick={() => onFileSelect({ action: 'open-folder' })}
          style={{ marginTop: '12px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: '6px', padding: '8px 16px', color: '#fafafa', cursor: 'pointer', fontSize: '12px' }}
        >
          Open Folder
        </button>
      </div>
    );
  }

  return (
    <div style={{ overflowY: 'auto', flex: 1 }}>
      {tree.children?.map(node => (
        <FileNode
          key={node.path}
          node={node}
          selectedFile={selectedFile}
          onFileSelect={onFileSelect}
          changedFiles={changedFiles}
        />
      ))}
    </div>
  );
}
