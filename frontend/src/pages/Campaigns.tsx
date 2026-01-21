import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getCampaigns, Campaign } from '../services/campaigns';
import { format } from 'date-fns';
import OpportunityModal from '../components/opportunities/OpportunityModal';
import { Opportunity } from '../services/opportunities';
import '../styles/SalesPipeline.css';

const Campaigns: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('start_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);

  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: getCampaigns
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const getStatusColor = (status: string): string => {
    const colors: { [key: string]: string } = {
      planning: '#8b5cf6',
      active: '#10b981',
      completed: '#3b82f6',
      archived: '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getCampaignIcon = (status: string): string => {
    const icons: { [key: string]: string } = {
      planning: '📋',
      active: '🎯',
      completed: '✅',
      archived: '📦'
    };
    return icons[status] || '📋';
  };

  const getCampaignGradient = (status: string): string => {
    const gradients: { [key: string]: string } = {
      planning: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
      active: 'linear-gradient(135deg, #10b981, #06b6d4)',
      completed: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      archived: 'linear-gradient(135deg, #6b7280, #9ca3af)'
    };
    return gradients[status] || 'linear-gradient(135deg, #8b5cf6, #ec4899)';
  };

  const getOwnerInitials = (name?: string): string => {
    if (!name) return 'UN';
    return name.split(' ').map(n => n[0]).join('');
  };

  const getOwnerColor = (name: string): string => {
    const colors = [
      '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Filter campaigns based on search term
  const filteredCampaigns = (campaigns || []).filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (campaign.description && campaign.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (campaign.owner_name && campaign.owner_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort campaigns
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'start_date':
        aValue = new Date(a.start_date).getTime();
        bValue = new Date(b.start_date).getTime();
        break;
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'owner':
        aValue = (a.owner_name || '').toLowerCase();
        bValue = (b.owner_name || '').toLowerCase();
        break;
      case 'value':
        aValue = a.total_opportunity_value || 0;
        bValue = b.total_opportunity_value || 0;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'targets':
        aValue = a.total_targets || 0;
        bValue = b.total_targets || 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Handle sort column click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleCloseOpportunityModal = () => {
    setIsOpportunityModalOpen(false);
    setSelectedOpportunity(null);
  };

  const handleSaveOpportunity = () => {
    setIsOpportunityModalOpen(false);
    setSelectedOpportunity(null);
  };

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading campaigns...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sales-container">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading campaigns: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1>🎯 Sales Campaigns</h1>
            <div className="sales-subtitle">Manage and track your sales campaigns and outreach efforts</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="sales-btn sales-btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button
            className="sales-btn sales-btn-secondary"
            onClick={() => setIsOpportunityModalOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Opportunity
          </button>
          <button
            className="sales-btn sales-btn-primary"
            onClick={() => navigate('/campaigns/new')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Campaign
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Campaigns</div>
          <div className="sales-table-controls">
            <div className="sales-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="sales-filter-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filter
            </button>
          </div>
        </div>
        <table className="sales-table">
          <thead>
            <tr>
              <th className="sales-sortable" onClick={() => handleSort('start_date')}>
                Date <span className="sales-sort-icon">{sortColumn === 'start_date' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('name')}>
                Campaign <span className="sales-sort-icon">{sortColumn === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('owner')}>
                Owner <span className="sales-sort-icon">{sortColumn === 'owner' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('targets')}>
                Targets <span className="sales-sort-icon">{sortColumn === 'targets' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('value')}>
                Value <span className="sales-sort-icon">{sortColumn === 'value' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th className="sales-sortable" onClick={() => handleSort('status')}>
                Status <span className="sales-sort-icon">{sortColumn === 'status' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
              </th>
              <th>Progress</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {sortedCampaigns.length > 0 ? (
              sortedCampaigns.map((campaign: Campaign) => {
                const progressPercent = campaign.total_targets
                  ? Math.round((campaign.contacted_count / campaign.total_targets) * 100)
                  : 0;

                return (
                  <tr
                    key={campaign.id}
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{format(new Date(campaign.start_date), 'MMM d, yyyy')}</td>
                    <td>
                      <div className="sales-project-cell">
                        <div className="sales-project-icon" style={{ background: getCampaignGradient(campaign.status) }}>
                          {getCampaignIcon(campaign.status)}
                        </div>
                        <div className="sales-project-info">
                          <h4>{campaign.name}</h4>
                          <span>{campaign.description || 'No description'}</span>
                        </div>
                      </div>
                    </td>
                    <td>{campaign.owner_name || '-'}</td>
                    <td>{campaign.total_targets || 0}</td>
                    <td className="sales-value-cell">{formatCurrency(campaign.total_opportunity_value || 0)}</td>
                    <td>
                      <span className={`sales-stage-badge ${campaign.status}`}>
                        <span className="sales-stage-dot" style={{ background: getStatusColor(campaign.status) }}></span>
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <span className={`sales-probability-badge ${progressPercent >= 75 ? 'high' : progressPercent >= 40 ? 'medium' : 'low'}`}>
                        <span className="sales-probability-dot"></span>
                        {progressPercent}%
                      </span>
                    </td>
                    <td>
                      <div className="sales-salesperson-cell">
                        <div
                          className="sales-salesperson-avatar"
                          style={{ background: getOwnerColor(campaign.owner_name || 'Unassigned') }}
                        >
                          {getOwnerInitials(campaign.owner_name)}
                        </div>
                        {campaign.owner_name || 'Unassigned'}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px' }}>
                  <div>
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      style={{ margin: '0 auto 16px', opacity: 0.4 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No campaigns found</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                      {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first sales campaign'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Opportunity Modal */}
      {isOpportunityModalOpen && (
        <OpportunityModal
          opportunity={selectedOpportunity}
          onClose={handleCloseOpportunityModal}
          onSave={handleSaveOpportunity}
        />
      )}
    </div>
  );
};

export default Campaigns;
