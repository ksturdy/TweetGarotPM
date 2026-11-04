import React from 'react';
import { useLocalSync, SyncState } from '../../hooks/useLocalSync';

interface Props {
  projectId: number;
  projectName: string;
}

const LABELS: Record<SyncState, string> = {
  idle: 'Sync to Folder',
  syncing: 'Syncing…',
  done: 'Sync Complete',
  error: 'Sync Failed',
};

export default function SyncFolderButton({ projectId, projectName }: Props) {
  const { sync, reset, state, progress, supported } = useLocalSync(projectId, projectName);

  if (!supported) return null;

  const isActive = state === 'syncing';
  const isDone = state === 'done';
  const isError = state === 'error';

  const borderColor = isError ? '#ef4444' : isDone ? '#10b981' : '#d1d5db';
  const textColor = isError ? '#ef4444' : isDone ? '#10b981' : '#6b7280';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={isDone || isError ? reset : sync}
        disabled={isActive}
        title={
          isDone && progress
            ? `${progress.completed - progress.skipped} downloaded, ${progress.skipped} already up to date${progress.errors.length ? `, ${progress.errors.length} error(s)` : ''}`
            : 'Download all project attachments to a local folder'
        }
        style={{
          background: 'none',
          border: `1px solid ${borderColor}`,
          padding: '0.25rem 0.65rem',
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: textColor,
          cursor: isActive ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          opacity: isActive ? 0.7 : 1,
          transition: 'border-color 0.15s, color 0.15s',
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>
          {isActive ? '⟳' : isDone ? '✓' : isError ? '✕' : '⤓'}
        </span>
        {LABELS[state]}
        {isActive && progress && progress.total > 0 && (
          <span style={{ color: '#94a3b8' }}>
            ({progress.completed}/{progress.total})
          </span>
        )}
      </button>

      {isActive && progress && progress.current && (
        <div style={{
          position: 'absolute',
          top: '110%',
          right: 0,
          background: '#1e293b',
          color: '#94a3b8',
          fontSize: '0.7rem',
          padding: '0.25rem 0.5rem',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          zIndex: 50,
          maxWidth: '220px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {progress.current}
        </div>
      )}
    </div>
  );
}
