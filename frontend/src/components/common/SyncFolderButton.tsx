import React from 'react';
import { useLocalSync, SyncState } from '../../hooks/useLocalSync';

interface Props {
  projectId: number;
  projectName: string;
}

const LABELS: Record<SyncState, string> = {
  idle: 'Sync to Folder',
  syncing: 'Syncing…',
  done: 'Synced',
  error: 'Sync Failed',
};

const INTERVAL_OPTIONS = [
  { value: 0,  label: 'Auto: Off' },
  { value: 15, label: 'Auto: 15m' },
  { value: 30, label: 'Auto: 30m' },
  { value: 60, label: 'Auto: 1h'  },
];

export default function SyncFolderButton({ projectId, projectName }: Props) {
  const { sync, state, progress, supported, hasHandle, autoInterval, setAutoInterval } =
    useLocalSync(projectId, projectName);

  if (!supported) return null;

  const isActive = state === 'syncing';
  const isDone   = state === 'done';
  const isError  = state === 'error';

  const borderColor = isError ? '#ef4444' : isDone ? '#10b981' : '#d1d5db';
  const textColor   = isError ? '#ef4444' : isDone ? '#10b981' : '#6b7280';

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      <button
        onClick={isActive ? undefined : sync}
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

      <select
        value={autoInterval}
        onChange={(e) => setAutoInterval(Number(e.target.value))}
        disabled={!hasHandle}
        title={hasHandle ? 'Auto-sync interval' : 'Sync once manually first to enable auto-sync'}
        style={{
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '0.7rem',
          color: hasHandle ? '#6b7280' : '#94a3b8',
          padding: '0.22rem 0.4rem',
          background: 'none',
          cursor: hasHandle ? 'pointer' : 'default',
        }}
      >
        {INTERVAL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

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
