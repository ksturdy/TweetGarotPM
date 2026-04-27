import React from 'react';

export type KpiStatus = 'green' | 'yellow' | 'red' | 'neutral';

interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  status: KpiStatus;
  icon?: string;
  progressBar?: number; // 0-100
}

const STATUS_COLORS: Record<KpiStatus, { bg: string; accent: string; text: string }> = {
  green:   { bg: '#dcfce7', accent: '#10b981', text: '#065f46' },
  yellow:  { bg: '#fef3c7', accent: '#f59e0b', text: '#92400e' },
  red:     { bg: '#fee2e2', accent: '#ef4444', text: '#991b1b' },
  neutral: { bg: '#f1f5f9', accent: '#94a3b8', text: '#475569' },
};

const KpiCard: React.FC<KpiCardProps> = ({ label, value, subValue, status, icon, progressBar }) => {
  const colors = STATUS_COLORS[status];

  return (
    <div style={{
      background: colors.bg,
      borderRadius: '10px',
      padding: '0.75rem 0.85rem',
      position: 'relative',
      overflow: 'hidden',
      minHeight: '90px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>
      {/* Accent bar at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: colors.accent,
      }} />

      {/* Label row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        marginTop: '0.15rem',
      }}>
        {icon && <span style={{ fontSize: '0.85rem' }}>{icon}</span>}
        <span style={{
          fontSize: '0.6rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: colors.text,
          opacity: 0.8,
        }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: colors.text,
        lineHeight: 1.2,
        marginTop: '0.25rem',
      }}>
        {value}
      </div>

      {/* Progress bar */}
      {progressBar !== undefined && (
        <div style={{
          height: '4px',
          background: `${colors.accent}30`,
          borderRadius: '2px',
          marginTop: '0.35rem',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(Math.max(progressBar, 0), 100)}%`,
            background: colors.accent,
            borderRadius: '2px',
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}

      {/* Sub-value */}
      {subValue && (
        <div style={{
          fontSize: '0.65rem',
          color: colors.text,
          opacity: 0.7,
          marginTop: '0.2rem',
          lineHeight: 1.3,
        }}>
          {subValue}
        </div>
      )}
    </div>
  );
};

export default KpiCard;

/**
 * Determine KPI status by comparing actual vs goal.
 * higherIsBetter=true: actual >= goal is green (e.g., margin)
 * higherIsBetter=false: actual <= goal is green (e.g., labor rate)
 */
export function getKpiStatus(
  actual: number | null | undefined,
  goal: number | null | undefined,
  higherIsBetter: boolean = true,
  warningThreshold: number = 0.9,
): KpiStatus {
  if (actual == null || goal == null || goal === 0) return 'neutral';
  const ratio = actual / goal;
  if (higherIsBetter) {
    if (ratio >= 1.0) return 'green';
    if (ratio >= warningThreshold) return 'yellow';
    return 'red';
  } else {
    if (ratio <= 1.0) return 'green';
    if (ratio <= 1 + (1 - warningThreshold)) return 'yellow'; // e.g., within 110% of goal
    return 'red';
  }
}
