import React from 'react';
import { Link } from 'react-router-dom';
import './MarketingList.css';

const MarketingList: React.FC = () => {
  const categories = [
    {
      name: 'Proposals',
      icon: '📝',
      path: '/proposals',
      desc: 'Sales proposals & pitches',
      color: '#3b82f6',
      ready: true,
    },
    {
      name: 'Branding',
      icon: '🎨',
      path: '/marketing/branding',
      desc: 'Logos, colors & style guides',
      color: '#8b5cf6',
      ready: false,
    },
    {
      name: 'Trade Shows',
      icon: '🎪',
      path: '/marketing/trade-shows',
      desc: 'Events, booths & conferences',
      color: '#ec4899',
      ready: false,
    },
    {
      name: 'Website',
      icon: '🌐',
      path: '/marketing/website',
      desc: 'Web content & updates',
      color: '#06b6d4',
      ready: false,
    },
    {
      name: 'Case Studies',
      icon: '📊',
      path: '/case-studies',
      desc: 'Success stories & testimonials',
      color: '#10b981',
      ready: true,
    },
    {
      name: 'Case Study Templates',
      icon: '📋',
      path: '/case-study-templates',
      desc: 'Layout templates for case studies',
      color: '#059669',
      ready: true,
    },
    {
      name: 'Service Offerings',
      icon: '🔧',
      path: '/settings/service-offerings',
      desc: 'Service catalog & capabilities',
      color: '#3b82f6',
      ready: true,
    },
    {
      name: 'Employee Resumes',
      icon: '👥',
      path: '/employee-resumes',
      desc: 'Team profiles for proposals',
      color: '#8b5cf6',
      ready: true,
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
      name: 'Social Media',
      icon: '📱',
      path: '/marketing/social-media',
      desc: 'Posts, campaigns & analytics',
      color: '#f59e0b',
      ready: false,
    },
    {
      name: 'Email Campaigns',
      icon: '📧',
      path: '/marketing/email-campaigns',
      desc: 'Newsletters & announcements',
      color: '#ef4444',
      ready: false,
    },
    {
      name: 'Print Materials',
      icon: '🖨️',
      path: '/marketing/print-materials',
      desc: 'Brochures, flyers & cards',
      color: '#6366f1',
      ready: false,
    },
    {
      name: 'Video Content',
      icon: '🎬',
      path: '/marketing/video-content',
      desc: 'Commercials, demos & tours',
      color: '#a855f7',
      ready: false,
    },
    {
      name: 'Swag & Merch',
      icon: '🎁',
      path: '/marketing/swag',
      desc: 'Branded gifts & giveaways',
      color: '#14b8a6',
      ready: false,
    },
    {
      name: 'Press Releases',
      icon: '📰',
      path: '/marketing/press-releases',
      desc: 'News & media announcements',
      color: '#64748b',
      ready: false,
    },
    {
      name: 'Customer Events',
      icon: '🎉',
      path: '/marketing/customer-events',
      desc: 'Open houses & appreciation',
      color: '#f97316',
      ready: false,
    },
    {
      name: 'Analytics',
      icon: '📈',
      path: '/marketing/analytics',
      desc: 'Performance metrics & ROI',
      color: '#0ea5e9',
      ready: false,
    },
    {
      name: 'Awards & Recognition',
      icon: '🏆',
      path: '/marketing/awards',
      desc: 'Industry awards & achievements',
      color: '#eab308',
      ready: false,
    },
    {
      name: 'Partnerships',
      icon: '🤝',
      path: '/marketing/partnerships',
      desc: 'Strategic alliances & collabs',
      color: '#84cc16',
      ready: false,
    },
    {
      name: 'Sponsorships',
      icon: '🎯',
      path: '/marketing/sponsorships',
      desc: 'Community & event sponsorships',
      color: '#22c55e',
      ready: false,
    },
  ];

  return (
    <div className="marketing-page">
      <div className="page-header">
        <div>
          <Link to="/" className="breadcrumb-link">&larr; Back to Dashboard</Link>
          <h1 className="page-title">Marketing</h1>
          <p className="page-subtitle">Manage all your marketing initiatives and content</p>
        </div>
      </div>

      <div className="marketing-grid">
        {categories.map((category) => (
          <Link
            key={category.name}
            to={category.path}
            className={`marketing-category-card ${!category.ready ? 'disabled' : ''}`}
            style={{ '--category-color': category.color } as React.CSSProperties}
            onClick={(e) => !category.ready && e.preventDefault()}
          >
            {!category.ready && <span className="coming-soon-badge">Coming Soon</span>}
            {category.ready && <span className="in-dev-badge">In Development</span>}
            <div className="category-icon-wrapper">
              <div className="category-icon">{category.icon}</div>
            </div>
            <div className="category-content">
              <h3 className="category-name">{category.name}</h3>
              <p className="category-desc">{category.desc}</p>
            </div>
            <div className="category-arrow">→</div>
          </Link>
        ))}
      </div>

      <div className="marketing-stats">
        <div className="stat-card card">
          <div className="stat-icon">🎯</div>
          <div>
            <div className="stat-value">19</div>
            <div className="stat-label">Active Categories</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">🚀</div>
          <div>
            <div className="stat-value">Coming Soon</div>
            <div className="stat-label">Campaign Tracking</div>
          </div>
        </div>
        <div className="stat-card card">
          <div className="stat-icon">💡</div>
          <div>
            <div className="stat-value">Unlimited</div>
            <div className="stat-label">Creative Ideas</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingList;
