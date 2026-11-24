import React from 'react';

interface Props {
  isOpen: boolean;
  mode: 'edit' | 'delete';
  isPending?: boolean;
  onJustThis: () => void;
  onThisAndFuture: () => void;
  onAll: () => void;
  onCancel: () => void;
}

const FREQ_LABEL: Record<string, string> = {
  weekly: 'weekly',
  biweekly: 'every 2 weeks',
  monthly: 'monthly',
};

export const SeriesScopeModal: React.FC<Props> = ({
  isOpen, mode, isPending, onJustThis, onThisAndFuture, onAll, onCancel,
}) => {
  if (!isOpen) return null;

  const isDelete = mode === 'delete';
  const accentColor = isDelete ? '#dc2626' : '#002356';
  const actionWord = isDelete ? 'Delete' : 'Update';

  const btnBase: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '13px',
    fontWeight: 600,
    cursor: isPending ? 'not-allowed' : 'pointer',
    opacity: isPending ? 0.6 : 1,
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '100%',
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1100 }}
        onClick={onCancel}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1101,
        background: '#fff',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        width: '360px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, #002356 0%, #004080 100%)`,
          borderBottom: `3px solid ${isDelete ? '#dc2626' : '#f97316'}`,
          padding: '16px 20px',
          color: '#fff',
        }}>
          <div style={{ fontSize: '11px', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>
            Recurring Visit
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>
            {isDelete ? 'Delete recurring visit' : 'Edit recurring visit'}
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280' }}>
            This visit is part of a repeating series. What would you like to {isDelete ? 'delete' : 'change'}?
          </p>

          {/* Just this */}
          <button
            disabled={isPending}
            onClick={onJustThis}
            style={{ ...btnBase, background: '#f9fafb', border: '1px solid #e5e7eb', color: '#374151' }}
          >
            <span style={{ fontWeight: 700 }}>Just this visit</span>
            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>Only this occurrence is affected</span>
          </button>

          {/* This and future */}
          <button
            disabled={isPending}
            onClick={onThisAndFuture}
            style={{ ...btnBase, background: isDelete ? '#fef2f2' : '#eff6ff', border: `1px solid ${isDelete ? '#fca5a5' : '#93c5fd'}`, color: isDelete ? '#dc2626' : '#1d4ed8' }}
          >
            <span style={{ fontWeight: 700 }}>This and following visits</span>
            <span style={{ fontSize: '11px', color: isDelete ? '#fca5a5' : '#93c5fd', fontWeight: 400 }}>
              {isDelete ? 'Deletes' : 'Updates'} this visit and all future occurrences
            </span>
          </button>

          {/* All */}
          <button
            disabled={isPending}
            onClick={onAll}
            style={{ ...btnBase, background: isDelete ? '#fee2e2' : '#fff7ed', border: `1px solid ${isDelete ? '#f87171' : '#fb923c'}`, color: isDelete ? '#b91c1c' : '#c2410c' }}
          >
            <span style={{ fontWeight: 700 }}>All visits in the series</span>
            <span style={{ fontSize: '11px', color: isDelete ? '#f87171' : '#fb923c', fontWeight: 400 }}>
              {isDelete ? 'Removes' : 'Applies change to'} every occurrence in this series
            </span>
          </button>

          <button
            onClick={onCancel}
            style={{ marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};
