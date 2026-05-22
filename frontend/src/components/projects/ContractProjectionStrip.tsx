import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, addMonths, startOfMonth } from 'date-fns';
import { vistaDataService, VPContract } from '../../services/vistaData';
import { ContourType, contourOptions, getContourMultipliers, getDefaultContour, ContourVisual } from '../../utils/contours';

const parseNum = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

const fmtCompact = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0 || isNaN(value)) return '-';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const defaultDurationForValue = (contractValue: number): number => {
  if (contractValue < 500_000) return 3;
  if (contractValue < 2_000_000) return 6;
  if (contractValue < 5_000_000) return 8;
  if (contractValue < 10_000_000) return 12;
  return 24;
};

interface Props {
  contract: VPContract;
}

const ContractProjectionStrip: React.FC<Props> = ({ contract }) => {
  const queryClient = useQueryClient();

  const [startMonths, setStartMonths] = useState<number | null>(contract.user_adjusted_start_months ?? null);
  const [endMonths, setEndMonths] = useState<number | null>(contract.user_adjusted_end_months ?? null);
  const [contourOverride, setContourOverride] = useState<ContourType | null>(
    (contract.user_selected_contour as ContourType) ?? null
  );

  useEffect(() => {
    setStartMonths(contract.user_adjusted_start_months ?? null);
    setEndMonths(contract.user_adjusted_end_months ?? null);
    setContourOverride((contract.user_selected_contour as ContourType) ?? null);
  }, [contract.id, contract.user_adjusted_start_months, contract.user_adjusted_end_months, contract.user_selected_contour]);

  const save = useCallback(async (overrides: {
    user_adjusted_start_months?: number | null;
    user_adjusted_end_months?: number | null;
    user_selected_contour?: string | null;
  }) => {
    try {
      await vistaDataService.updateProjectionOverrides(contract.id, overrides);
      // Bilateral sync: refresh both the single-contract cache (this page)
      // and the all-contracts cache (Projected Revenue page).
      queryClient.invalidateQueries({ queryKey: ['vpContract'] });
      queryClient.invalidateQueries({ queryKey: ['vpContracts'] });
    } catch (err) {
      console.error('Failed to save projection override:', err);
    }
  }, [contract.id, queryClient]);

  const columns = useMemo(() => {
    const cols: { key: string; label: string; isYear: boolean }[] = [];
    const now = startOfMonth(new Date());
    const twelveMonthsOut = addMonths(now, 11);
    for (let i = 0; i < 12; i++) {
      const date = addMonths(now, i);
      cols.push({ key: format(date, 'yyyy-MM'), label: format(date, 'MMM yy'), isYear: false });
    }
    const currentYear = now.getFullYear();
    const maxYear = currentYear + 3;
    for (let year = currentYear; year <= maxYear; year++) {
      const lastMonthOfYear = new Date(year, 11, 1);
      if (lastMonthOfYear > twelveMonthsOut) {
        cols.push({ key: String(year), label: String(year), isYear: true });
      }
    }
    return cols;
  }, []);

  const projection = useMemo(() => {
    const now = startOfMonth(new Date());
    const earnedRevenue = parseNum(contract.earned_revenue);
    const projectedRevenue = parseNum(contract.projected_revenue);
    const backlog = parseNum(contract.backlog);
    const contractValue = parseNum(contract.contract_amount) || projectedRevenue;
    const startOffset = startMonths ?? 0;

    let remainingMonths = 0;
    if (backlog > 0) {
      if (endMonths != null) {
        const endMonthsFromNow = Math.max(1, Math.min(36, endMonths));
        remainingMonths = Math.max(1, endMonthsFromNow - startOffset);
      } else {
        const totalDuration = defaultDurationForValue(contractValue);
        const pctComplete = projectedRevenue > 0 ? earnedRevenue / projectedRevenue : 0;
        const monthsRemaining = Math.ceil(totalDuration * (1 - pctComplete));
        remainingMonths = Math.max(1, Math.min(36, monthsRemaining));
      }
    }

    const pctCompletePct = projectedRevenue > 0 ? (earnedRevenue / projectedRevenue) * 100 : 0;
    const autoContour = getDefaultContour(pctCompletePct);
    const contour: ContourType = contourOverride || autoContour;
    const isAutoContour = !contourOverride;

    const monthlyRevenue = new Map<string, number>();
    if (backlog > 0 && remainingMonths > 0) {
      const multipliers = getContourMultipliers(remainingMonths, contour);
      const baseMonthly = backlog / remainingMonths;
      const twelveMonthsOut = addMonths(now, 11);
      for (let i = 0; i < remainingMonths; i++) {
        const monthDate = addMonths(now, startOffset + i);
        const monthKey = format(monthDate, 'yyyy-MM');
        const yearKey = String(monthDate.getFullYear());
        const monthRevenue = baseMonthly * multipliers[i];
        monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + monthRevenue);
        if (monthDate > twelveMonthsOut) {
          monthlyRevenue.set(yearKey, (monthlyRevenue.get(yearKey) || 0) + monthRevenue);
        }
      }
    }

    return {
      startOffset,
      remainingMonths,
      contour,
      isAutoContour,
      pctComplete: pctCompletePct,
      monthlyRevenue,
      backlog,
    };
  }, [contract.earned_revenue, contract.projected_revenue, contract.backlog, contract.contract_amount,
      startMonths, endMonths, contourOverride]);

  const backlog = projection.backlog;
  const startOffset = projection.startOffset;
  const remainingMonths = projection.remainingMonths;

  const cellStyle: React.CSSProperties = {
    padding: '0.4rem 0.5rem',
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontSize: '0.75rem',
  };
  const headerCellStyle: React.CSSProperties = {
    padding: '0.4rem 0.5rem',
    textAlign: 'right',
    borderBottom: '2px solid #e2e8f0',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#475569',
    whiteSpace: 'nowrap',
    background: '#f8fafc',
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: '0.75rem' }}>
      <div style={{
        padding: '0.4rem 0.75rem',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase' }}>
          Projected Revenue
        </span>
        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
          Synced with Projected Revenue report
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, textAlign: 'right', minWidth: '70px' }}>Backlog</th>
            <th style={{ ...headerCellStyle, textAlign: 'right', minWidth: '60px' }}>% Comp</th>
            <th style={{ ...headerCellStyle, textAlign: 'center', minWidth: '70px' }}>Start</th>
            <th style={{ ...headerCellStyle, textAlign: 'center', minWidth: '70px' }}>End</th>
            <th style={{ ...headerCellStyle, textAlign: 'center', minWidth: '90px' }}>Contour</th>
            {columns.map(col => (
              <th
                key={col.key}
                style={{
                  ...headerCellStyle,
                  minWidth: col.isYear ? '70px' : '60px',
                  background: col.isYear ? '#f1f5f9' : '#f8fafc',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, fontWeight: 600 }}>{fmtCompact(backlog)}</td>
            <td style={{ ...cellStyle, color: '#64748b' }}>
              {projection.pctComplete > 0 ? `${projection.pctComplete.toFixed(0)}%` : '-'}
            </td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>
              {backlog > 0 ? (
                <select
                  value={startOffset}
                  onChange={(e) => {
                    const newStart = parseInt(e.target.value);
                    setStartMonths(newStart);
                    const currentEnd = startOffset + remainingMonths;
                    if (newStart >= currentEnd) {
                      const newEnd = newStart + 1;
                      setEndMonths(newEnd);
                      save({ user_adjusted_start_months: newStart, user_adjusted_end_months: newEnd });
                    } else {
                      save({ user_adjusted_start_months: newStart });
                    }
                  }}
                  style={{
                    padding: '0.15rem 0.25rem',
                    fontSize: '0.65rem',
                    border: startMonths != null ? '1px solid #16a34a' : '1px solid #e2e8f0',
                    borderRadius: '3px',
                    background: startMonths != null ? '#dcfce7' : 'transparent',
                    color: startMonths != null ? '#15803d' : '#64748b',
                    cursor: 'pointer',
                    width: '70px',
                  }}
                  title="Click to adjust start date"
                >
                  {Array.from({ length: 36 }, (_, i) => i).map(months => {
                    const startDate = addMonths(startOfMonth(new Date()), months);
                    return <option key={months} value={months}>{format(startDate, 'MMM yy')}</option>;
                  })}
                </select>
              ) : '-'}
            </td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>
              {backlog > 0 ? (
                <select
                  value={startOffset + remainingMonths}
                  onChange={(e) => {
                    const newEndMonths = parseInt(e.target.value);
                    setEndMonths(newEndMonths);
                    save({ user_adjusted_end_months: newEndMonths });
                  }}
                  style={{
                    padding: '0.15rem 0.25rem',
                    fontSize: '0.65rem',
                    border: endMonths != null ? '1px solid #16a34a' : '1px solid #e2e8f0',
                    borderRadius: '3px',
                    background: endMonths != null ? '#dcfce7' : 'transparent',
                    color: endMonths != null ? '#15803d' : '#64748b',
                    cursor: 'pointer',
                    width: '70px',
                  }}
                  title="Click to adjust end date"
                >
                  {Array.from({ length: 36 }, (_, i) => i + 1).filter(m => m > startOffset).map(months => {
                    const endDate = addMonths(startOfMonth(new Date()), months);
                    return <option key={months} value={months}>{format(endDate, 'MMM yy')}</option>;
                  })}
                </select>
              ) : '-'}
            </td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>
              {backlog > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                  <ContourVisual contour={projection.contour} />
                  <select
                    value={projection.contour}
                    onChange={(e) => {
                      const newContour = e.target.value as ContourType;
                      setContourOverride(newContour);
                      save({ user_selected_contour: newContour });
                    }}
                    style={{
                      padding: '0.15rem 0.25rem',
                      fontSize: '0.65rem',
                      border: projection.isAutoContour ? '1px dashed #94a3b8' : '1px solid #16a34a',
                      borderRadius: '3px',
                      background: projection.isAutoContour ? '#f8fafc' : '#dcfce7',
                      cursor: 'pointer',
                      width: '80px',
                      color: projection.isAutoContour ? '#64748b' : '#15803d',
                      fontStyle: projection.isAutoContour ? 'italic' : 'normal',
                    }}
                    title={projection.isAutoContour
                      ? `Auto-selected based on ${projection.pctComplete.toFixed(0)}% complete. Click to override.`
                      : 'User-selected contour. Click to change.'}
                  >
                    {contourOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ) : '-'}
            </td>
            {columns.map(col => {
              const value = projection.monthlyRevenue.get(col.key) || 0;
              return (
                <td
                  key={col.key}
                  style={{
                    ...cellStyle,
                    color: value > 0 ? '#1e293b' : '#cbd5e1',
                    background: col.isYear ? '#fafafa' : 'transparent',
                  }}
                >
                  {value > 0 ? fmtCompact(value) : '-'}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default ContractProjectionStrip;
