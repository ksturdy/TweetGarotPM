import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cashFlowReportApi, CashFlowProject, CashFlowMetrics } from '../../services/cashFlowReport';
import { getTenant } from '../../services/tenant';
import { teamsApi, Team } from '../../services/teams';
import { exportListToPdf } from '../../utils/listExportPdf';
import '../../styles/SalesPipeline.css';

const fmtCurrency = (v: number | undefined | null): string => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  const n = Number(v);
  if (n === 0) return '$0';
  return `$${Math.round(n).toLocaleString()}`;
};

const fmtPercent = (v: number | undefined | null): string => {
  if (v === undefined || v === null || isNaN(Number(v))) return '-';
  return `${Math.round(Number(v) * 100)}%`;
};

// Gradient definitions for KPI icon boxes
const KPI_STYLES = {
  blue:   { gradient: 'linear-gradient(135deg, #002356 0%, #004080 100%)', text: '#3b82f6' },
  purple: { gradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', text: '#8b5cf6' },
  amber:  { gradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', text: '#f59e0b' },
  green:  { gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', text: '#10b981' },
  cyan:   { gradient: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', text: '#06b6d4' },
  rose:   { gradient: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', text: '#f43f5e' },
  orange: { gradient: 'linear-gradient(135deg, #ea580c 0%, #F37B03 100%)', text: '#F37B03' },
};

interface KpiCardData {
  label: string;
  value: string;
  subValue?: string;
  style: { gradient: string; text: string };
  icon: React.ReactNode;
  hasBar?: boolean;
  barPct?: number;
}

const KpiCard: React.FC<{ card: KpiCardData }> = ({ card }) => (
  <div style={{
    background: '#ffffff',
    borderRadius: '12px',
    padding: '1rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
    border: '1px solid #e5e7eb',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default',
    position: 'relative',
    overflow: 'hidden',
  }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)';
    }}
  >
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
      background: card.style.gradient,
    }} />
    <div style={{
      width: '44px', height: '44px', borderRadius: '0.5rem',
      background: card.style.gradient,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {card.icon}
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.025em', marginBottom: '2px' }}>{card.label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#002356', lineHeight: 1.2 }}>
        {card.value}
        {card.subValue && (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: card.style.text, marginLeft: '6px' }}>
            ({card.subValue})
          </span>
        )}
      </div>
      {card.hasBar && (
        <div style={{ marginTop: '6px', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${card.barPct}%`,
            background: card.style.gradient,
            borderRadius: '2px',
            transition: 'width 0.5s ease',
          }} />
        </div>
      )}
    </div>
  </div>
);

const CashFlowReport: React.FC = () => {
  const navigate = useNavigate();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Open');
  const [pmFilter, setPmFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [marketFilter, setMarketFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['cashFlowReport'],
    queryFn: cashFlowReportApi.getData,
  });

  const { data: snapshotMetrics } = useQuery({
    queryKey: ['cashFlowMetrics'],
    queryFn: cashFlowReportApi.getMetrics,
  });

  const { data: tenant } = useQuery({
    queryKey: ['tenant'],
    queryFn: getTenant,
  });

  const { data: teamsResponse } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });
  const teams: Team[] = teamsResponse?.data?.data || [];

  const { data: teamMembersResponse } = useQuery({
    queryKey: ['teamMembers', teamFilter],
    queryFn: () => teamsApi.getMembers(Number(teamFilter)),
    enabled: teamFilter !== 'all',
  });
  const teamEmployeeIds: number[] = useMemo(() => {
    if (teamFilter === 'all' || !teamMembersResponse?.data?.data) return [];
    return teamMembersResponse.data.data.map((m: any) => Number(m.employee_id));
  }, [teamFilter, teamMembersResponse]);

  const logoUrl = tenant?.settings?.branding?.logo_url;

  // Preload logo as base64 data URL for PDF export
  const logoDataUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!logoUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        logoDataUrlRef.current = canvas.toDataURL('image/png');
      }
    };
    img.src = logoUrl;
  }, [logoUrl]);

  // Derive unique filter options from data
  const uniqueStatuses = useMemo(() =>
    [...new Set(projects.map(p => p.status).filter(Boolean))].sort(),
    [projects]
  );
  const uniquePMs = useMemo(() =>
    [...new Set(projects.map(p => p.manager_name).filter(Boolean))].sort() as string[],
    [projects]
  );
  const uniqueDepartments = useMemo(() =>
    [...new Set(projects.map(p => p.department_number).filter(Boolean))].sort() as string[],
    [projects]
  );
  const uniqueMarkets = useMemo(() =>
    [...new Set(projects.map(p => p.market).filter(Boolean))].sort() as string[],
    [projects]
  );

  // Filter
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (pmFilter !== 'all' && p.manager_name !== pmFilter) return false;
      if (departmentFilter !== 'all' && p.department_number !== departmentFilter) return false;
      if (marketFilter !== 'all' && p.market !== marketFilter) return false;
      if (teamFilter !== 'all' && teamEmployeeIds.length > 0 && !teamEmployeeIds.includes(Number(p.manager_id))) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          p.name?.toLowerCase().includes(term) ||
          p.number?.toLowerCase().includes(term) ||
          p.manager_name?.toLowerCase().includes(term) ||
          p.customer_name?.toLowerCase().includes(term) ||
          p.owner_name?.toLowerCase().includes(term) ||
          p.department_number?.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [projects, statusFilter, pmFilter, departmentFilter, marketFilter, teamFilter, teamEmployeeIds, searchTerm]);

  // Sort
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortColumn) {
        case 'number':
          aVal = a.number?.toLowerCase() ?? '';
          bVal = b.number?.toLowerCase() ?? '';
          break;
        case 'name':
          aVal = a.name?.toLowerCase() ?? '';
          bVal = b.name?.toLowerCase() ?? '';
          break;
        case 'manager':
          aVal = a.manager_name?.toLowerCase() ?? '';
          bVal = b.manager_name?.toLowerCase() ?? '';
          break;
        case 'contract_value':
          aVal = Number(a.contract_value) || 0;
          bVal = Number(b.contract_value) || 0;
          break;
        case 'earned_revenue':
          aVal = Number(a.earned_revenue) || 0;
          bVal = Number(b.earned_revenue) || 0;
          break;
        case 'billed_amount':
          aVal = Number(a.billed_amount) || 0;
          bVal = Number(b.billed_amount) || 0;
          break;
        case 'received_amount':
          aVal = Number(a.received_amount) || 0;
          bVal = Number(b.received_amount) || 0;
          break;
        case 'open_receivables':
          aVal = Number(a.open_receivables) || 0;
          bVal = Number(b.open_receivables) || 0;
          break;
        case 'cash_flow':
          aVal = Number(a.cash_flow) || 0;
          bVal = Number(b.cash_flow) || 0;
          break;
        case 'percent_complete':
          aVal = Number(a.percent_complete) || 0;
          bVal = Number(b.percent_complete) || 0;
          break;
        case 'gross_profit_percent':
          aVal = Number(a.gross_profit_percent) || 0;
          bVal = Number(b.gross_profit_percent) || 0;
          break;
        case 'backlog':
          aVal = Number(a.backlog) || 0;
          bVal = Number(b.backlog) || 0;
          break;
        case 'status':
          aVal = a.status ?? '';
          bVal = b.status ?? '';
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProjects, sortColumn, sortDirection]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const sum = (key: keyof CashFlowProject) =>
      filteredProjects.reduce((s, p) => s + (Number(p[key]) || 0), 0);

    const positiveCashFlowCount = filteredProjects.filter(p => Number(p.cash_flow) > 0).length;

    // Jobs >15% complete
    const jobsOver15 = filteredProjects.filter(p => (Number(p.percent_complete) || 0) > 0.15);
    const jobsOver15Positive = jobsOver15.filter(p => Number(p.cash_flow) > 0);

    // Average % complete when jobs first turned cash-flow positive (from weekly snapshots)
    const filteredProjectIds = new Set(filteredProjects.map(p => p.id));
    const snapshotPerProject = snapshotMetrics?.per_project?.filter(
      sp => filteredProjectIds.has(sp.project_id)
    ) || [];
    const avgPctWhenPositive = snapshotPerProject.length > 0
      ? snapshotPerProject.reduce((s, sp) => s + sp.percent_complete_at_positive, 0) / snapshotPerProject.length
      : 0;
    const projectsTurnedPositiveCount = snapshotPerProject.length;

    return {
      count: filteredProjects.length,
      totalContractValue: sum('contract_value'),
      totalEarnedRevenue: sum('earned_revenue'),
      totalBilled: sum('billed_amount'),
      totalReceived: sum('received_amount'),
      netCashPosition: sum('cash_flow'),
      positiveCashFlowCount,
      jobsOver15Count: jobsOver15.length,
      jobsOver15PositiveCount: jobsOver15Positive.length,
      avgPctWhenPositive,
      projectsTurnedPositiveCount,
    };
  }, [filteredProjects, snapshotMetrics]);

  // Footer totals
  const footerTotals = useMemo(() => {
    const sum = (key: keyof CashFlowProject) =>
      sortedProjects.reduce((s, p) => s + (Number(p[key]) || 0), 0);

    const totalCV = sum('contract_value');

    // Weighted GM%
    const gmNumerator = sortedProjects.reduce((s, p) => {
      const cv = Number(p.contract_value) || 0;
      const gm = Number(p.gross_profit_percent);
      if (!cv || isNaN(gm)) return s;
      return s + cv * gm;
    }, 0);
    const weightedGm = totalCV > 0 ? gmNumerator / totalCV : 0;

    // Weighted % Complete
    const pctNumerator = sortedProjects.reduce((s, p) => {
      const cv = Number(p.contract_value) || 0;
      const pct = Number(p.percent_complete);
      if (!cv || isNaN(pct)) return s;
      return s + cv * pct;
    }, 0);
    const pctDenominator = sortedProjects.reduce((s, p) => {
      const cv = Number(p.contract_value) || 0;
      const pct = Number(p.percent_complete);
      if (!cv || isNaN(pct)) return s;
      return s + cv;
    }, 0);
    const weightedPct = pctDenominator > 0 ? pctNumerator / pctDenominator : 0;

    return {
      contractValue: totalCV,
      earnedRevenue: sum('earned_revenue'),
      billedAmount: sum('billed_amount'),
      receivedAmount: sum('received_amount'),
      openReceivables: sum('open_receivables'),
      cashFlow: sum('cash_flow'),
      backlog: sum('backlog'),
      weightedGm,
      weightedPct,
    };
  }, [sortedProjects]);

  const handleExportPdf = () => {
    const filters: string[] = [];
    if (statusFilter !== 'all') filters.push(`Status: ${statusFilter}`);
    if (pmFilter !== 'all') filters.push(`PM: ${pmFilter}`);
    if (teamFilter !== 'all') {
      const teamName = teams.find(t => String(t.id) === teamFilter)?.name;
      if (teamName) filters.push(`Team: ${teamName}`);
    }
    if (departmentFilter !== 'all') filters.push(`Dept: ${departmentFilter}`);
    if (marketFilter !== 'all') filters.push(`Market: ${marketFilter}`);
    if (searchTerm) filters.push(`Search: "${searchTerm}"`);

    // Parse a currency string like "$1,234" or "-$5,678" to a number
    const parseCurrency = (s: string): number => {
      const cleaned = s.replace(/[$,]/g, '');
      return parseFloat(cleaned) || 0;
    };

    // Parse a percent string like "25%" to a decimal
    const parsePercent = (s: string): number => {
      return parseFloat(s.replace('%', '')) || 0;
    };

    exportListToPdf({
      title: 'Cash Flow Report',
      subtitle: filters.length > 0
        ? filters.join('  |  ')
        : `${sortedProjects.length} projects`,
      orientation: 'landscape',
      fileName: `CashFlow_${new Date().toISOString().slice(0, 10)}.pdf`,
      logoDataUrl: logoDataUrlRef.current || undefined,
      accentColor: [0, 35, 86],        // navy #002356
      headerFillColor: [0, 35, 86],     // navy header
      headerTextColor: [255, 255, 255],  // white text on navy
      columns: [
        { header: '#', key: 'number', width: 0.55 },
        { header: 'Project', key: 'name', width: 2.4 },
        { header: 'PM', key: 'manager', width: 1.3 },
        { header: 'Contract Value', key: 'contractValue', align: 'right', width: 0.95 },
        { header: 'Earned Rev', key: 'earnedRevenue', align: 'right', width: 0.9 },
        { header: 'Billed', key: 'billed', align: 'right', width: 0.9 },
        { header: 'Received', key: 'received', align: 'right', width: 0.9 },
        { header: 'Open AR', key: 'openAR', align: 'right', width: 0.8 },
        { header: 'Cash Flow', key: 'cashFlow', align: 'right', width: 0.9 },
        { header: '% Comp', key: 'pctComplete', align: 'right', width: 0.5 },
        { header: 'GM%', key: 'gm', align: 'right', width: 0.45 },
        { header: 'Backlog', key: 'backlog', align: 'right', width: 0.9 },
      ],
      rows: sortedProjects.map(p => ({
        number: p.number,
        name: p.name,
        manager: p.manager_name || 'Unassigned',
        contractValue: fmtCurrency(p.contract_value),
        earnedRevenue: fmtCurrency(p.earned_revenue),
        billed: fmtCurrency(p.billed_amount),
        received: fmtCurrency(p.received_amount),
        openAR: fmtCurrency(p.open_receivables),
        cashFlow: fmtCurrency(p.cash_flow),
        pctComplete: fmtPercent(p.percent_complete),
        gm: fmtPercent(p.gross_profit_percent),
        backlog: fmtCurrency(p.backlog),
      })),
      summaryRows: [
        { label: 'Projects', value: String(kpis.count), valueColor: [0, 35, 86] as [number, number, number] },
        { label: 'Contract Value', value: `$${(kpis.totalContractValue / 1e6).toFixed(1)}M`, valueColor: [59, 130, 246] as [number, number, number] },
        { label: 'Earned Revenue', value: `$${(kpis.totalEarnedRevenue / 1e6).toFixed(1)}M`, valueColor: [139, 92, 246] as [number, number, number] },
        { label: 'Total Billed', value: `$${(kpis.totalBilled / 1e6).toFixed(1)}M`, valueColor: [217, 119, 6] as [number, number, number] },
        { label: 'Total Received', value: `$${(kpis.totalReceived / 1e6).toFixed(1)}M`, valueColor: [5, 150, 105] as [number, number, number] },
        { label: 'Net Cash', value: `$${(kpis.netCashPosition / 1e6).toFixed(1)}M`, valueColor: (kpis.netCashPosition >= 0 ? [5, 150, 105] : [220, 38, 38]) as [number, number, number] },
        { label: 'CF+ Jobs', value: `${kpis.positiveCashFlowCount}/${kpis.count} (${positivePct}%)`, valueColor: (positivePct >= 50 ? [8, 145, 178] : [234, 88, 12]) as [number, number, number] },
        { label: 'CF+ >15% Comp', value: `${kpis.jobsOver15PositiveCount}/${kpis.jobsOver15Count} (${over15PositivePct}%)`, valueColor: (over15PositivePct >= 60 ? [5, 150, 105] : over15PositivePct >= 40 ? [217, 119, 6] : [225, 29, 72]) as [number, number, number] },
        { label: 'Avg % at CF+', value: `${avgPctPositiveDisplay}%`, valueColor: [124, 58, 237] as [number, number, number] },
      ],
      cellStyleFn: (columnKey, cellValue) => {
        if (cellValue === '-' || cellValue === '$0') return undefined;

        if (columnKey === 'cashFlow') {
          const n = parseCurrency(cellValue);
          if (n > 0) return { textColor: [5, 150, 105] };   // green
          if (n < 0) return { textColor: [220, 38, 38] };    // red
        }
        if (columnKey === 'gm') {
          const n = parsePercent(cellValue);
          if (n > 0) return { textColor: [5, 150, 105] };
          if (n < 0) return { textColor: [220, 38, 38] };
        }
        if (columnKey === 'openAR') {
          const n = parseCurrency(cellValue);
          if (n > 0) return { textColor: [217, 119, 6] };    // amber
        }
        return undefined;
      },
    });
  };

  const anyFilterActive = statusFilter !== 'all' || pmFilter !== 'all' || departmentFilter !== 'all' || marketFilter !== 'all' || teamFilter !== 'all' || !!searchTerm;

  const clearAllFilters = () => {
    setStatusFilter('all');
    setPmFilter('all');
    setDepartmentFilter('all');
    setMarketFilter('all');
    setTeamFilter('all');
    setSearchTerm('');
  };

  const sortIcon = (col: string) =>
    sortColumn === col ? (sortDirection === 'asc' ? ' \u2191' : ' \u2193') : ' \u2195';

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      'Open': '#10b981',
      'Soft-Closed': '#f59e0b',
      'Hard-Closed': '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  // Cash flow bar: shows ratio of received vs billed as a mini bar
  const getCashFlowBarColor = (cf: number | undefined | null): string => {
    const n = Number(cf) || 0;
    if (n > 0) return '#10b981';
    if (n < 0) return '#ef4444';
    return '#94a3b8';
  };

  const positivePct = kpis.count > 0
    ? Math.round((kpis.positiveCashFlowCount / kpis.count) * 100)
    : 0;

  const over15PositivePct = kpis.jobsOver15Count > 0
    ? Math.round((kpis.jobsOver15PositiveCount / kpis.jobsOver15Count) * 100)
    : 0;

  const avgPctPositiveDisplay = Math.round(kpis.avgPctWhenPositive * 100);

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div style={{
            width: '48px', height: '48px', margin: '0 auto 16px',
            borderRadius: '50%', border: '4px solid #e5e7eb',
            borderTopColor: '#3b82f6', animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading cash flow data...</div>
        </div>
      </div>
    );
  }

  // KPI card definitions
  const kpiCards = [
    {
      label: 'Projects',
      value: kpis.count.toLocaleString(),
      style: KPI_STYLES.blue,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      ),
    },
    {
      label: 'Contract Value',
      value: `$${(kpis.totalContractValue / 1e6).toFixed(1)}M`,
      style: KPI_STYLES.blue,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      ),
    },
    {
      label: 'Earned Revenue',
      value: `$${(kpis.totalEarnedRevenue / 1e6).toFixed(1)}M`,
      style: KPI_STYLES.purple,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
      ),
    },
    {
      label: 'Total Billed',
      value: `$${(kpis.totalBilled / 1e6).toFixed(1)}M`,
      style: KPI_STYLES.amber,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      ),
    },
    {
      label: 'Total Received',
      value: `$${(kpis.totalReceived / 1e6).toFixed(1)}M`,
      style: KPI_STYLES.green,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      ),
    },
    {
      label: 'Net Cash Position',
      value: `$${(kpis.netCashPosition / 1e6).toFixed(1)}M`,
      style: kpis.netCashPosition >= 0 ? KPI_STYLES.green : KPI_STYLES.rose,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      ),
    },
    {
      label: 'Positive Cash Flow',
      value: `${kpis.positiveCashFlowCount} / ${kpis.count}`,
      subValue: `${positivePct}%`,
      style: positivePct >= 50 ? KPI_STYLES.cyan : KPI_STYLES.orange,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
      ),
      hasBar: true,
      barPct: positivePct,
    },
    {
      label: 'CF+ Jobs >15% Comp',
      value: `${kpis.jobsOver15PositiveCount} / ${kpis.jobsOver15Count}`,
      subValue: `${over15PositivePct}%`,
      style: over15PositivePct >= 60 ? KPI_STYLES.green : over15PositivePct >= 40 ? KPI_STYLES.amber : KPI_STYLES.rose,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      ),
      hasBar: true,
      barPct: over15PositivePct,
    },
    {
      label: 'Avg % Comp at CF+',
      value: `${avgPctPositiveDisplay}%`,
      subValue: `${kpis.projectsTurnedPositiveCount} jobs`,
      style: KPI_STYLES.purple,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ),
    },
  ];

  return (
    <div className="sales-container">
      {/* Header with logo */}
      <div className="sales-page-header" style={{ position: 'relative' }}>
        <div className="sales-page-title">
          <div>
            <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Dashboard
            </Link>
            <h1 style={{
              background: 'linear-gradient(135deg, #002356, #004080)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Cash Flow Report</h1>
            <div className="sales-subtitle">Project billing, collections, and cash position</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="sales-btn sales-btn-secondary" onClick={handleExportPdf}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards - Row 1: Financial Summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '1rem',
        marginBottom: '0.75rem',
      }}>
        {kpiCards.slice(0, 5).map(card => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>

      {/* KPI Cards - Row 2: Cash Flow Analysis */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        marginBottom: '1.25rem',
      }}>
        {kpiCards.slice(5).map(card => (
          <KpiCard key={card.label} card={card} />
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '1rem',
        background: '#f8fafc',
        borderRadius: '8px',
        marginBottom: '1rem',
        alignItems: 'flex-end',
        border: '1px solid #e5e7eb',
      }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Search</label>
          <div className="sales-search-box" style={{ width: '100%' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div style={{ minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Status</label>
          <select className="form-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}>
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Project Manager</label>
          <input
            className="form-input"
            list="cf-pm-list"
            placeholder="All PMs"
            value={pmFilter === 'all' ? '' : pmFilter}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                setPmFilter('all');
              } else if (uniquePMs.includes(val)) {
                setPmFilter(val);
              } else {
                setPmFilter(val);
              }
            }}
            onBlur={(e) => {
              const val = e.target.value;
              if (!val) setPmFilter('all');
              else if (!uniquePMs.includes(val)) setPmFilter('all');
            }}
            style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}
          />
          <datalist id="cf-pm-list">
            {uniquePMs.map(pm => <option key={pm} value={pm} />)}
          </datalist>
        </div>
        <div style={{ minWidth: '150px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Team</label>
          <select className="form-input" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}>
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ minWidth: '140px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Department</label>
          <select className="form-input" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}>
            <option value="all">All Depts</option>
            {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ minWidth: '160px' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Market</label>
          <select className="form-input" value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', width: '100%' }}>
            <option value="all">All Markets</option>
            {uniqueMarkets.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {anyFilterActive && (
          <button className="sales-filter-btn" onClick={clearAllFilters} style={{ padding: '0.5rem 1rem', height: 'fit-content' }}>
            Clear All
          </button>
        )}
      </div>

      {/* Table */}
      <div className="sales-table-section" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Gradient accent bar at top of table section */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg, #002356, #3b82f6, #8b5cf6)',
        }} />
        <div className="sales-table-header" style={{ paddingTop: '0.75rem' }}>
          <div className="sales-table-title">
            Cash Flow Detail
            <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280', marginLeft: '0.5rem' }}>
              ({filteredProjects.length.toLocaleString()} of {projects.length.toLocaleString()})
            </span>
          </div>
        </div>
        <table className="sales-table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: '4.5%' }} />   {/* # */}
            <col style={{ width: '17%' }} />    {/* Project */}
            <col style={{ width: '10%' }} />    {/* PM */}
            <col style={{ width: '8.5%' }} />   {/* Contract Value */}
            <col style={{ width: '8%' }} />     {/* Earned Rev */}
            <col style={{ width: '7.5%' }} />   {/* Billed */}
            <col style={{ width: '7.5%' }} />   {/* Received */}
            <col style={{ width: '7%' }} />     {/* Open AR */}
            <col style={{ width: '8%' }} />     {/* Cash Flow */}
            <col style={{ width: '7.5%' }} />   {/* % Comp */}
            <col style={{ width: '4.5%' }} />   {/* GM% */}
            <col style={{ width: '7%' }} />     {/* Backlog */}
            <col style={{ width: '5%' }} />     {/* Status */}
          </colgroup>
          <thead>
            <tr>
              <th className="sales-sortable" onClick={() => handleSort('number')}>#{sortIcon('number')}</th>
              <th className="sales-sortable" onClick={() => handleSort('name')}>Project{sortIcon('name')}</th>
              <th className="sales-sortable" onClick={() => handleSort('manager')}>PM{sortIcon('manager')}</th>
              <th className="sales-sortable" onClick={() => handleSort('contract_value')} style={{ textAlign: 'right' }}>Contract Value{sortIcon('contract_value')}</th>
              <th className="sales-sortable" onClick={() => handleSort('earned_revenue')} style={{ textAlign: 'right' }}>Earned Rev{sortIcon('earned_revenue')}</th>
              <th className="sales-sortable" onClick={() => handleSort('billed_amount')} style={{ textAlign: 'right' }}>Billed{sortIcon('billed_amount')}</th>
              <th className="sales-sortable" onClick={() => handleSort('received_amount')} style={{ textAlign: 'right' }}>Received{sortIcon('received_amount')}</th>
              <th className="sales-sortable" onClick={() => handleSort('open_receivables')} style={{ textAlign: 'right' }}>Open AR{sortIcon('open_receivables')}</th>
              <th className="sales-sortable" onClick={() => handleSort('cash_flow')} style={{ textAlign: 'right' }}>Cash Flow{sortIcon('cash_flow')}</th>
              <th className="sales-sortable" onClick={() => handleSort('percent_complete')} style={{ textAlign: 'right' }}>% Comp{sortIcon('percent_complete')}</th>
              <th className="sales-sortable" onClick={() => handleSort('gross_profit_percent')} style={{ textAlign: 'right' }}>GM%{sortIcon('gross_profit_percent')}</th>
              <th className="sales-sortable" onClick={() => handleSort('backlog')} style={{ textAlign: 'right' }}>Backlog{sortIcon('backlog')}</th>
              <th className="sales-sortable" onClick={() => handleSort('status')}>Status{sortIcon('status')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.length > 0 ? (
              sortedProjects.map(p => {
                const cf = Number(p.cash_flow) || 0;
                const gm = Number(p.gross_profit_percent);
                const pctComplete = Number(p.percent_complete) || 0;
                const pctDisplay = Math.round(pctComplete * 100);

                return (
                  <tr key={p.id} onClick={() => navigate(`/projects/${p.id}`)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 500, color: '#475569' }}>{p.number}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.owner_name || p.customer_name || '-'}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: p.manager_name
                            ? `hsl(${[...p.manager_name].reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) % 360}, 60%, 55%)`
                            : '#94a3b8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.65rem', fontWeight: 700, color: 'white', flexShrink: 0,
                        }}>
                          {p.manager_name ? p.manager_name.split(' ').map(n => n[0]).join('') : '?'}
                        </div>
                        <span style={{ fontSize: '0.8125rem' }}>{p.manager_name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtCurrency(p.contract_value)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(p.earned_revenue)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(p.billed_amount)}</td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(p.received_amount)}</td>
                    <td style={{
                      textAlign: 'right',
                      color: Number(p.open_receivables) > 0 ? '#d97706' : undefined,
                    }}>
                      {fmtCurrency(p.open_receivables)}
                    </td>
                    {/* Cash Flow cell with color indicator */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: getCashFlowBarColor(p.cash_flow),
                          flexShrink: 0,
                        }} />
                        <span style={{
                          fontWeight: 600,
                          color: cf > 0 ? '#059669' : cf < 0 ? '#dc2626' : '#64748b',
                        }}>
                          {fmtCurrency(p.cash_flow)}
                        </span>
                      </div>
                    </td>
                    {/* % Complete with mini progress bar */}
                    <td style={{ textAlign: 'right' }}>
                      {p.percent_complete !== undefined && p.percent_complete !== null && !isNaN(pctComplete) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          <div style={{
                            flex: '0 0 40px', height: '6px', background: '#e5e7eb',
                            borderRadius: '3px', overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(pctDisplay, 100)}%`,
                              background: pctDisplay >= 100
                                ? 'linear-gradient(135deg, #059669, #10b981)'
                                : pctDisplay >= 75
                                  ? 'linear-gradient(135deg, #002356, #004080)'
                                  : pctDisplay >= 50
                                    ? 'linear-gradient(135deg, #3b82f6, #60a5fa)'
                                    : 'linear-gradient(135deg, #94a3b8, #cbd5e1)',
                              borderRadius: '3px',
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                          <span style={{ fontSize: '0.8125rem', color: '#475569', minWidth: '28px' }}>{pctDisplay}%</span>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      color: !isNaN(gm) ? (gm > 0 ? '#059669' : gm < 0 ? '#dc2626' : '#64748b') : '#94a3b8',
                    }}>
                      {fmtPercent(p.gross_profit_percent)}
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmtCurrency(p.backlog)}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '3px 10px', borderRadius: '9999px',
                        fontSize: '0.75rem', fontWeight: 600,
                        background: p.status === 'Open' ? 'rgba(16, 185, 129, 0.12)'
                          : p.status === 'Soft-Closed' ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(107, 114, 128, 0.12)',
                        color: getStatusColor(p.status),
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                        {p.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={13} style={{ textAlign: 'center', padding: '40px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No projects found</h3>
                  <p style={{ color: '#6b7280', fontSize: '14px' }}>
                    {searchTerm ? 'Try adjusting your search or filters' : 'No project data available'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
          {sortedProjects.length > 0 && (
            <tfoot>
              <tr style={{
                background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                fontWeight: 700,
                borderTop: '2px solid #cbd5e1',
                position: 'sticky',
                bottom: 0,
              }}>
                <td colSpan={3} style={{ textAlign: 'right', color: '#334155' }}>
                  Totals ({sortedProjects.length.toLocaleString()} project{sortedProjects.length !== 1 ? 's' : ''}):
                </td>
                <td style={{ textAlign: 'right', color: '#1e293b' }}>{fmtCurrency(footerTotals.contractValue)}</td>
                <td style={{ textAlign: 'right', color: '#1e293b' }}>{fmtCurrency(footerTotals.earnedRevenue)}</td>
                <td style={{ textAlign: 'right', color: '#1e293b' }}>{fmtCurrency(footerTotals.billedAmount)}</td>
                <td style={{ textAlign: 'right', color: '#1e293b' }}>{fmtCurrency(footerTotals.receivedAmount)}</td>
                <td style={{ textAlign: 'right', color: '#d97706' }}>{fmtCurrency(footerTotals.openReceivables)}</td>
                <td style={{
                  textAlign: 'right',
                  fontWeight: 700,
                  color: footerTotals.cashFlow >= 0 ? '#059669' : '#dc2626',
                }}>
                  {fmtCurrency(footerTotals.cashFlow)}
                </td>
                <td style={{ textAlign: 'right', color: '#334155' }}>{fmtPercent(footerTotals.weightedPct)}</td>
                <td style={{
                  textAlign: 'right',
                  color: footerTotals.weightedGm > 0 ? '#059669' : footerTotals.weightedGm < 0 ? '#dc2626' : '#334155',
                }}>
                  {fmtPercent(footerTotals.weightedGm)}
                </td>
                <td style={{ textAlign: 'right', color: '#1e293b' }}>{fmtCurrency(footerTotals.backlog)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default CashFlowReport;
