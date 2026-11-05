import React, { useState } from 'react';
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

function formatSyncTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SyncFolderButton({ projectId, projectName }: Props) {
  const { sync, changeFolder, state, progress, supported, hasHandle, lastSynced, autoInterval, setAutoInterval } =
    useLocalSync(projectId, projectName);
  const [showErrors, setShowErrors] = useState(false);

  if (!supported) return null;

  const isActive  = state === 'syncing';
  const isDone    = state === 'done';
  const isError   = state === 'error';
  const hasErrors = isDone && progress && progress.errors.length > 0;

  const borderColor = isError ? '#ef4444' : isDone ? '#10b981' : '#d1d5db';
  const textColor   = isError ? '#ef4444' : isDone ? '#10b981' : '#6b7280';

  const subText = isActive && progress?.current
    ? progress.current
    : (() => {
        const parts: string[] = [];
        if (lastSynced) parts.push(`Last synced: ${formatSyncTime(lastSynced)}`);
        if (autoInterval > 0) parts.push('auto-syncs while this tab is open');
        return parts.join(' · ');
      })();

  return (
    // position:relative + display:inline-block keeps the sub-row from affecting
    // the parent flex alignment with the Set Goals button
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>

        {/* Main sync button */}
        <button
          onClick={isActive ? undefined : sync}
          disabled={isActive}
          title="Download all project attachments to a local folder"
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

        {/* Error indicator — only shown when sync finished with errors */}
        {hasErrors && progress && (
          <button
            onClick={() => setShowErrors((v) => !v)}
            title="Show sync errors"
            style={{
              background: 'none',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              padding: '0.22rem 0.45rem',
              fontSize: '0.7rem',
              color: '#f59e0b',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ⚠ {progress.errors.length} error{progress.errors.length > 1 ? 's' : ''}
          </button>
        )}

        {/* Change folder */}
        {hasHandle && (
          <button
            onClick={changeFolder}
            disabled={isActive}
            title="Change sync folder"
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '0.22rem 0.45rem',
              fontSize: '0.78rem',
              color: '#6b7280',
              cursor: isActive ? 'default' : 'pointer',
              lineHeight: 1,
            }}
          >
            📁
          </button>
        )}

        {/* Auto-sync interval */}
        <select
          value={autoInterval}
          onChange={(e) => setAutoInterval(Number(e.target.value))}
          disabled={!hasHandle}
          title={hasHandle ? 'Auto-sync interval (tab must stay open)' : 'Sync once manually first to enable auto-sync'}
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
      </div>

      {/* Sub-row: last synced / auto note / current file — absolutely positioned so it
          doesn't add height to the flex row, keeping Set Goals vertically aligned */}
      {subText && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.15rem',
          fontSize: '0.65rem',
          color: '#94a3b8',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {subText}
        </div>
      )}

      {/* Error list dropdown */}
      {showErrors && progress && progress.errors.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '1.4rem',
          background: '#1e293b',
          border: '1px solid #f59e0b40',
          borderRadius: '6px',
          padding: '0.5rem 0.75rem',
          zIndex: 100,
          minWidth: '260px',
          maxWidth: '360px',
        }}>
          <div style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600, marginBottom: '0.4rem' }}>
            Files that failed to download
          </div>
          {progress.errors.map((e, i) => (
            <div key={i} style={{
              fontSize: '0.68rem',
              color: '#94a3b8',
              padding: '0.2rem 0',
              borderTop: i > 0 ? '1px solid #334155' : 'none',
              wordBreak: 'break-word',
            }}>
              {e}
            </div>
          ))}
          <button
            onClick={() => setShowErrors(false)}
            style={{
              marginTop: '0.5rem',
              background: 'none',
              border: 'none',
              fontSize: '0.65rem',
              color: '#64748b',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
