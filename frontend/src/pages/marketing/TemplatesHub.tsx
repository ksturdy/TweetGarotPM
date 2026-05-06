import React from 'react';
import { Link } from 'react-router-dom';
import './MarketingList.css';
import '../../styles/SalesPipeline.css';

interface TemplateCategory {
  name: string;
  icon: string;
  path: string;
  desc: string;
  color: string;
  ready: boolean;
  inDev?: boolean;
}

const TemplatesHub: React.FC = () => {
  const templates: TemplateCategory[] = [
    {
      name: 'Case Study Templates',
      icon: '📋',
      path: '/case-study-templates',
      desc: 'Layout templates for case studies',
      color: '#059669',
      ready: true,
      inDev: false,
    },
    {
      name: 'Proposal Templates',
      icon: '📄',
      path: '/proposal-templates',
      desc: 'Reusable proposal templates',
      color: '#06b6d4',
      ready: true,
    },
    {
      name: 'Resume Templates',
      icon: '📑',
      path: '/resume-templates',
      desc: 'Layout templates for employee resumes',
      color: '#8b5cf6',
      ready: true,
      inDev: false,
    },
    {
      name: 'Sell Sheet Templates',
      icon: '📰',
      path: '/sell-sheet-templates',
      desc: 'Layout templates for sell sheets',
      color: '#f59e0b',
      ready: false,
    },
    {
      name: 'Org Chart Templates',
      icon: '🏗️',
      path: '/org-chart-templates',
      desc: 'Layout templates for project org charts',
      color: '#7c3aed',
      ready: false,
    },
    {
      name: 'Email Templates',
      icon: '📧',
      path: '/email-templates',
      desc: 'Reusable email & newsletter templates',
      color: '#ef4444',
      ready: false,
    },
  ];

  return (
    <div className="marketing-page">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>🗂️ Templates</h1>
            <div className="sales-subtitle">Reusable layouts for case studies, proposals, resumes & more</div>
          </div>
        </div>
      </div>

      <div className="marketing-grid">
        {templates.map((tpl) => (
          <Link
            key={tpl.name}
            to={tpl.path}
            className={`marketing-category-card ${!tpl.ready ? 'disabled' : ''}`}
            style={{ '--category-color': tpl.color } as React.CSSProperties}
            onClick={(e) => !tpl.ready && e.preventDefault()}
          >
            <div className="category-icon-wrapper">
              <div className="category-icon">{tpl.icon}</div>
            </div>
            <div className="category-content">
              <h3 className="category-name">{tpl.name}</h3>
              <p className="category-desc">{tpl.desc}</p>
              {!tpl.ready && <span className="coming-soon-badge">Coming Soon</span>}
              {tpl.ready && tpl.inDev !== false && (
                <span className="in-dev-badge">In Development</span>
              )}
            </div>
            <div className="category-arrow">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default TemplatesHub;
