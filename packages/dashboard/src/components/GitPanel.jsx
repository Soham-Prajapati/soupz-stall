import { useState } from 'react';

const STATUS_COLORS = {
  M: '#f59e0b',  // Modified
  A: '#10b981',  // Added
  D: '#ef4444',  // Deleted
  R: '#8b5cf6',  // Renamed
  '?': '#71717a', // Untracked
};

const STATUS_LABELS = {
  M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', '?': 'Untracked',
};

function DiffLine({ line }) {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return <div style={{ color: '#10b981', background: '#10b98110', padding: '0 12px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}>{line}</div>;
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return <div style={{ color: '#ef4444', background: '#ef444410', padding: '0 12px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}>{line}</div>;
  }
  if (line.startsWith('@@')) {
    return <div style={{ color: '#3b82f6', padding: '4px 12px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6', background: '#3b82f610' }}>{line}</div>;
  }
  return <div style={{ color: '#71717a', padding: '0 12px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6' }}>{line}</div>;
}

export default function GitPanel({ status = [], onStage, onCommit, onPush, commitMessage, setCommitMessage, activeDiff }) {
  const [pushing, setPushing] = useState(false);
  const [committing, setCommitting] = useState(false);

  const staged = status.filter(f => f.staged);
  const unstaged = status.filter(f => !f.staged);

  async function handlePush() {
    setPushing(true);
    await onPush();
    setPushing(false);
  }

  async function handleCommit() {
    if (!commitMessage.trim()) return;
    setCommitting(true);
    await onCommit(commitMessage);
    setCommitting(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source Control</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={handlePush} disabled={pushing || staged.length === 0} style={btnStyle('#3b82f6', pushing || staged.length === 0)}>
            {pushing ? '...' : '↑ Push'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Staged Changes */}
        {staged.length > 0 && (
          <div style={{ padding: '8px 16px 0' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#52525b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
              Staged ({staged.length})
            </div>
            {staged.map(file => (
              <FileStatusRow key={file.path} file={file} onStage={onStage} isStaged={true} />
            ))}
          </div>
        )}

        {/* Unstaged Changes */}
        {unstaged.length > 0 && (
          <div style={{ padding: '8px 16px 0' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#52525b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.05em' }}>
              Changes ({unstaged.length})
              <button onClick={() => unstaged.forEach(f => onStage(f.path, true))} style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '10px' }}>Stage All</button>
            </div>
            {unstaged.map(file => (
              <FileStatusRow key={file.path} file={file} onStage={onStage} isStaged={false} />
            ))}
          </div>
        )}

        {status.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#52525b', fontSize: '13px' }}>
            No changes
          </div>
        )}

        {/* Diff View */}
        {activeDiff && (
          <div style={{ margin: '12px 16px', background: '#09090b', borderRadius: '8px', border: '1px solid #27272a', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #27272a', fontSize: '12px', color: '#a1a1aa', fontFamily: 'monospace' }}>{activeDiff.path}</div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {activeDiff.lines?.map((line, i) => <DiffLine key={i} line={line} />)}
            </div>
          </div>
        )}
      </div>

      {/* Commit box */}
      {staged.length > 0 && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #27272a' }}>
          <textarea
            placeholder="Commit message..."
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            style={{ width: '100%', background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', padding: '10px', color: '#fafafa', fontSize: '13px', resize: 'none', outline: 'none', height: '64px', boxSizing: 'border-box' }}
          />
          <button
            onClick={handleCommit}
            disabled={committing || !commitMessage.trim()}
            style={{ ...btnStyle('#10b981', committing || !commitMessage.trim()), width: '100%', marginTop: '8px' }}
          >
            {committing ? 'Committing...' : 'Commit'}
          </button>
        </div>
      )}
    </div>
  );
}

function FileStatusRow({ file, onStage, isStaged }) {
  const color = STATUS_COLORS[file.status] || '#71717a';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', cursor: 'pointer' }}
      onClick={() => onStage(file.path, !isStaged)}>
      <span style={{ fontSize: '10px', fontWeight: '700', color, minWidth: '12px' }}>{file.status}</span>
      <span style={{ flex: 1, fontSize: '12px', color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.path}</span>
      <span style={{ fontSize: '10px', color: isStaged ? '#10b981' : '#52525b' }}>{isStaged ? '●' : '○'}</span>
    </div>
  );
}

function btnStyle(color, disabled) {
  return {
    background: disabled ? '#27272a' : color,
    color: disabled ? '#52525b' : '#fff',
    border: 'none', borderRadius: '6px', padding: '6px 12px',
    fontSize: '12px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
