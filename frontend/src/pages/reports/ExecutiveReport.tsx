import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { executiveReportApi, ExecutiveReportCategory, ExecutiveReportItem } from '../../services/executiveReport';

// MUI Icons
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import InventoryIcon from '@mui/icons-material/Inventory';
import FlagIcon from '@mui/icons-material/Flag';
import DescriptionIcon from '@mui/icons-material/Description';
import EngineeringIcon from '@mui/icons-material/Engineering';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import RemoveIcon from '@mui/icons-material/Remove';
import FolderIcon from '@mui/icons-material/Folder';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PercentIcon from '@mui/icons-material/Percent';
import WorkIcon from '@mui/icons-material/Work';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AssessmentIcon from '@mui/icons-material/Assessment';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CalculateIcon from '@mui/icons-material/Calculate';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EmailIcon from '@mui/icons-material/Email';
import api from '../../services/api';

import './ExecutiveReport.css';

// Map icon string IDs to MUI components
const ICON_MAP: Record<string, React.ReactNode> = {
  trophy: <EmojiEventsIcon />,
  money: <AttachMoneyIcon />,
  trending_up: <TrendingUpIcon />,
  trending_down: <TrendingDownIcon />,
  swap_vert: <SwapVertIcon />,
  account_balance: <AccountBalanceIcon />,
  inventory: <InventoryIcon />,
  flag: <FlagIcon />,
  description: <DescriptionIcon />,
  engineering: <EngineeringIcon />,
  new_releases: <NewReleasesIcon />,
  local_fire_department: <LocalFireDepartmentIcon />,
  calculate: <CalculateIcon />,
};

// Format currency compactly: $1.2M, $450K, $1,234
const fmtCurrency = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  }
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

// Format percent (value is already a decimal like 0.15)
const fmtPercent = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

// Format number with commas
const fmtNumber = (value: number): string => {
  return Math.round(value).toLocaleString('en-US');
};

// Format value based on type
const formatValue = (value: number, formatType: string): string => {
  switch (formatType) {
    case 'currency': return fmtCurrency(value);
    case 'percent': return fmtPercent(value);
    case 'number': return fmtNumber(value);
    default: return String(value);
  }
};

// Format change based on type
const formatChange = (change: number, formatType: string): string => {
  const sign = change > 0 ? '+' : '';
  switch (formatType) {
    case 'currency': return `${sign}${fmtCurrency(change)}`;
    case 'percent': return `${sign}${(change * 100).toFixed(1)}pp`;
    case 'number': return `${sign}${fmtNumber(change)}`;
    default: return `${sign}${change}`;
  }
};

// Format date for display
const formatDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr + 'T12:00:00');
  return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
};

// Rank badge class
const getRankClass = (rank: number): string => {
  if (rank === 1) return 'er-rank-gold';
  if (rank === 2) return 'er-rank-silver';
  if (rank === 3) return 'er-rank-bronze';
  return 'er-rank-default';
};

// KPI summary card config
const KPI_CARDS = [
  { key: 'totalProjects', label: 'Total Projects', icon: <FolderIcon />, gradient: 'linear-gradient(135deg, #002356 0%, #004080 100%)', format: 'count' },
  { key: 'totalContractValue', label: 'Contract Value', icon: <MonetizationOnIcon />, gradient: 'linear-gradient(135deg, #F37B03 0%, #ff9500 100%)', format: 'currency' },
  { key: 'totalGrossProfit', label: 'Gross Profit', icon: <ShowChartIcon />, gradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', format: 'currency' },
  { key: 'avgGrossMarginPct', label: 'Avg GP%', icon: <PercentIcon />, gradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', format: 'percent' },
  { key: 'totalBacklog', label: 'Backlog', icon: <WorkIcon />, gradient: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)', format: 'currency' },
  { key: 'totalEarnedRevenue', label: 'Earned Revenue', icon: <ReceiptLongIcon />, gradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', format: 'currency' },
] as const;

const RankItem: React.FC<{ item: ExecutiveReportItem; formatType: string; hasPrevious: boolean }> = ({ item, formatType, hasPrevious }) => {
  const changeClass = item.change > 0 ? 'er-change-up' : item.change < 0 ? 'er-change-down' : 'er-change-flat';
  const ChangeIcon = item.change > 0 ? ArrowUpwardIcon : item.change < 0 ? ArrowDownwardIcon : RemoveIcon;

  return (
    <li className="er-rank-item">
      <div className={`er-rank-badge ${getRankClass(item.rank)}`}>
        {item.rank}
      </div>
      <div className="er-project-info">
        <div className="er-project-name">{item.projectName}</div>
        <div className="er-project-meta">
          {item.projectNumber}{item.managerName ? ` \u00B7 ${item.managerName}` : ''}
        </div>
      </div>
      <div className="er-value-col">
        <div className="er-value">{formatValue(item.value, formatType)}</div>
        {hasPrevious && item.previousValue !== null && (
          <div className={`er-change ${changeClass}`}>
            <ChangeIcon style={{ fontSize: '0.75rem' }} />
            {formatChange(item.change, formatType)}
          </div>
        )}
      </div>
    </li>
  );
};

const CategoryCard: React.FC<{ category: ExecutiveReportCategory; hasPrevious: boolean }> = ({ category, hasPrevious }) => {
  const icon = ICON_MAP[category.icon] || <EmojiEventsIcon />;

  return (
    <div className="er-category-card">
      <div className="er-card-header">
        <div className="er-card-accent" style={{ background: category.color }} />
        <div className="er-card-icon" style={{ background: category.color }}>
          {icon}
        </div>
        <div className="er-card-titles">
          <h3 className="er-card-title">{category.title}</h3>
          <p className="er-card-subtitle">{category.subtitle}</p>
        </div>
      </div>
      {category.items.length > 0 ? (
        <ul className="er-rank-list">
          {category.items.map((item) => (
            <RankItem
              key={item.projectId}
              item={item}
              formatType={category.formatType}
              hasPrevious={hasPrevious}
            />
          ))}
        </ul>
      ) : (
        <div className="er-card-empty">No projects qualify for this category</div>
      )}
    </div>
  );
};

const ExecutiveReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['executive-report', selectedDate],
    queryFn: () => executiveReportApi.getReport(selectedDate).then(res => res.data),
  });

  const handleDownloadPdf = async () => {
    try {
      setPdfLoading(true);
      const params = selectedDate ? `?snapshotDate=${selectedDate}` : '';
      const response = await api.get(`/executive-report/pdf-download${params}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = selectedDate || report?.reportDate || new Date().toISOString().split('T')[0];
      link.download = `Executive-Report-${dateStr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEmailDraft = () => {
    const token = localStorage.getItem('token');
    const params = selectedDate ? `&snapshotDate=${selectedDate}` : '';
    const url = `${api.defaults.baseURL}/executive-report/email-draft?token=${token}${params}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="executive-report">
        <div className="er-loading">Loading executive report...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="executive-report">
        <div className="er-header">
          <div className="er-header-left">
            <h1>Executive Report</h1>
            <p>Weekly Top 10 Performance Snapshot</p>
          </div>
        </div>
        <div className="er-empty-state">
          <AssessmentIcon />
          <h2>No Data Available</h2>
          <p>Unable to load report data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const { summary, categories, availableDates, previousDate, reportDate } = report;
  const hasPrevious = !!previousDate;
  const hasSnapshots = !!reportDate;

  const formatKpiValue = (key: string, value: number): string => {
    const card = KPI_CARDS.find(c => c.key === key);
    if (!card) return String(value);
    switch (card.format) {
      case 'currency': return fmtCurrency(value);
      case 'percent': return fmtPercent(value);
      case 'count': return value.toLocaleString('en-US');
      default: return String(value);
    }
  };

  return (
    <div className="executive-report">
      {/* Header */}
      <div className="er-header">
        <div className="er-header-left">
          <h1>Executive Report</h1>
          <p>Weekly Top 10 Performance Snapshot</p>
        </div>
        <div className="er-header-actions">
          {availableDates.length > 0 && (
            <div className="er-date-picker">
              <label>Report Week:</label>
              <select
                value={selectedDate || report.reportDate || ''}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {formatDateLabel(date)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            className="er-btn er-btn-pdf"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
          >
            <PictureAsPdfIcon style={{ fontSize: '1.125rem' }} />
            {pdfLoading ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            className="er-btn er-btn-email"
            onClick={handleEmailDraft}
          >
            <EmailIcon style={{ fontSize: '1.125rem' }} />
            Email Draft
          </button>
        </div>
      </div>

      {/* KPI Summary Row - only show when snapshot data exists */}
      {hasSnapshots && summary && (
        <div className="er-kpi-grid">
          {KPI_CARDS.map((card) => (
            <div key={card.key} className="er-kpi-card">
              <div className="er-kpi-icon" style={{ background: card.gradient }}>
                {card.icon}
              </div>
              <div className="er-kpi-content">
                <div className="er-kpi-value">
                  {formatKpiValue(card.key, (summary as any)[card.key])}
                </div>
                <div className="er-kpi-label">{card.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Cards Grid */}
      <div className="er-categories-grid">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            hasPrevious={hasPrevious}
          />
        ))}
      </div>
    </div>
  );
};

export default ExecutiveReport;
