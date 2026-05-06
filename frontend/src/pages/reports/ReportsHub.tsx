import React from 'react';
import { Link } from 'react-router-dom';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupsIcon from '@mui/icons-material/Groups';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import '../marketing/MarketingList.css';
import '../../styles/SalesPipeline.css';

const reports = [
  {
    name: 'Weekly Sales',
    Icon: TrendingUpIcon,
    path: '/reports/weekly-sales',
    desc: 'Weekly opportunity activity and pipeline changes by location',
    color: '#f97316',
    bg: '#fff7ed',
  },
  {
    name: 'Executive Report',
    Icon: AssessmentIcon,
    path: '/reports/executive-report',
    desc: 'Company-wide financial snapshot with KPIs and project rankings',
    color: '#3b82f6',
    bg: '#eff6ff',
  },
  {
    name: 'Backlog Fit Analysis',
    Icon: ShowChartIcon,
    path: '/reports/backlog-fit',
    desc: 'Backlog vs. pipeline capacity gap analysis',
    color: '#8b5cf6',
    bg: '#f5f3ff',
  },
  {
    name: 'Cash Flow',
    Icon: AccountBalanceIcon,
    path: '/reports/cash-flow',
    desc: 'Project billing, collections, and cash position',
    color: '#10b981',
    bg: '#ecfdf5',
  },
  {
    name: 'Buyout Metric',
    Icon: ShoppingCartIcon,
    path: '/reports/buyout-metric',
    desc: 'Project buyout status by cost type',
    color: '#f59e0b',
    bg: '#fffbeb',
  },
  {
    name: 'Labor Forecast',
    Icon: GroupsIcon,
    path: '/projects/labor-forecast',
    desc: 'Projected labor hours and headcount across active projects',
    color: '#ec4899',
    bg: '#fdf2f8',
  },
  {
    name: 'Revenue Forecast',
    Icon: AttachMoneyIcon,
    path: '/projects/projected-revenue',
    desc: 'Projected revenue recognition across active projects',
    color: '#14b8a6',
    bg: '#f0fdfa',
  },
  {
    name: 'Scheduled Reports',
    Icon: ScheduleIcon,
    path: '/reports/scheduled',
    desc: 'Automated report delivery and email schedules',
    color: '#06b6d4',
    bg: '#ecfeff',
  },
];

const ReportsHub: React.FC = () => {
  return (
    <div className="marketing-page">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Dashboard
            </Link>
            <h1>Reports</h1>
            <div className="sales-subtitle">Analytics, insights, and scheduled report delivery</div>
          </div>
        </div>
      </div>

      <div className="marketing-grid">
        {reports.map((report) => (
          <Link
            key={report.name}
            to={report.path}
            className="marketing-category-card"
            style={{ '--category-color': report.color } as React.CSSProperties}
          >
            <div className="category-icon-wrapper" style={{ background: report.bg }}>
              <div className="category-icon">
                <report.Icon style={{ fontSize: '2rem', color: report.color }} />
              </div>
            </div>
            <div className="category-content">
              <h3 className="category-name">{report.name}</h3>
              <p className="category-desc">{report.desc}</p>
            </div>
            <div className="category-arrow">&rarr;</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ReportsHub;
