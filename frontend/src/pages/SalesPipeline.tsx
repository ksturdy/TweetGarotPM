import React, { useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useQuery } from '@tanstack/react-query';
import OpportunityModal from '../components/opportunities/OpportunityModal';
import opportunitiesService, { Opportunity as OpportunityType } from '../services/opportunities';
import '../styles/SalesPipeline.css';

// Register ChartJS components (excluding datalabels globally)
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SalesOpportunity {
  id: number;
  date: string;
  name: string;
  description: string;
  value: number;
  stage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won';
  stageName: string;
  probability: number | string;
  salesperson: {
    name: string;
    initials: string;
    color: string;
  };
  owner: string;
  icon: string;
  iconGradient: string;
}

const SalesPipeline: React.FC = () => {
  const [view, setView] = useState<'table' | 'board'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityType | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch real opportunities from API
  const { data: apiOpportunities = [], isLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: () => opportunitiesService.getAll()
  });

  // Fetch pipeline trend data
  const { data: trendData = [], isLoading: isTrendLoading } = useQuery({
    queryKey: ['opportunities-trend'],
    queryFn: () => opportunitiesService.getTrend(7)
  });

  // Helper function to get market icon
  const getMarketIcon = (market?: string): string => {
    const marketIcons: { [key: string]: string } = {
      'Healthcare': '🏥',
      'Education': '🏫',
      'Commercial': '🏢',
      'Industrial': '🏭',
      'Retail': '🏬',
      'Government': '🏛️',
      'Hospitality': '🏨',
      'Data Center': '💾'
    };
    return marketIcons[market || ''] || '🏢';
  };

  // Helper function to get market gradient
  const getMarketGradient = (market?: string): string => {
    const marketGradients: { [key: string]: string } = {
      'Healthcare': 'linear-gradient(135deg, #10b981, #06b6d4)',
      'Education': 'linear-gradient(135deg, #f59e0b, #f43f5e)',
      'Commercial': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      'Industrial': 'linear-gradient(135deg, #06b6d4, #10b981)',
      'Retail': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
      'Government': 'linear-gradient(135deg, #8b5cf6, #ec4899)',
      'Hospitality': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
      'Data Center': 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
    };
    return marketGradients[market || ''] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
  };

  // Helper function to get salesperson color based on name
  const getSalespersonColor = (name: string): string => {
    const colors = [
      '#8b5cf6', // purple
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // orange
      '#ef4444', // red
      '#06b6d4', // cyan
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // dark orange
      '#6366f1'  // indigo
    ];

    // Generate consistent color based on name hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Map API opportunities to display format
  const mapApiToDisplay = (opp: OpportunityType): SalesOpportunity => {
    const salespersonName = opp.assigned_to_name || 'Unassigned';

    // Use the actual stage_name from the database, or default to 'lead'
    const stageKey = (opp.stage_name || 'Lead').toLowerCase().replace(/\s+/g, '-') as 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won';

    return {
      id: opp.id,
      date: new Date(opp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      name: opp.title,
      description: opp.description || '',
      value: opp.estimated_value || 0,
      stage: stageKey,
      stageName: opp.stage_name || 'Lead',
      probability: opp.probability || opp.stage_probability || 0,
      salesperson: {
        name: salespersonName,
        initials: opp.assigned_to_name ? opp.assigned_to_name.split(' ').map(n => n[0]).join('') : 'U',
        color: getSalespersonColor(salespersonName)
      },
      owner: opp.owner || '',
      icon: getMarketIcon(opp.market),
      iconGradient: getMarketGradient(opp.market)
    };
  };

  const opportunities: SalesOpportunity[] = apiOpportunities.map(mapApiToDisplay);

  // Fallback sample data for demo purposes (only used if no real data exists)
  const sampleOpportunities: SalesOpportunity[] = [
    {
      id: 1,
      date: 'Jan 15, 2026',
      name: 'Phoenix Sky Harbor Terminal 4',
      description: 'HVAC & Plumbing - New Construction',
      value: 2100000,
      stage: 'qualified',
      stageName: 'Opportunity Received',
      probability: 'Medium',
      salesperson: { name: 'Kevin Walsh', initials: 'KW', color: '#8b5cf6' },
      owner: 'City of Phoenix',
      icon: '🏢',
      iconGradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
    },
    {
      id: 2,
      date: 'Jan 12, 2026',
      name: 'Banner Health Data Center',
      description: 'Process Piping - Tenant Improvement',
      value: 1850000,
      stage: 'proposal',
      stageName: 'Quoted',
      probability: 'Medium',
      salesperson: { name: 'Tom Henderson', initials: 'TH', color: '#f59e0b' },
      owner: 'Banner Health',
      icon: '🏥',
      iconGradient: 'linear-gradient(135deg, #10b981, #06b6d4)'
    },
    {
      id: 3,
      date: 'Jan 10, 2026',
      name: 'Chandler Unified School District',
      description: 'HVAC Retrofit - K-12 Education',
      value: 1450000,
      stage: 'negotiation',
      stageName: 'Quoted',
      probability: 'High',
      salesperson: { name: 'Kevin Walsh', initials: 'KW', color: '#8b5cf6' },
      owner: 'Chandler USD',
      icon: '🏫',
      iconGradient: 'linear-gradient(135deg, #f59e0b, #f43f5e)'
    },
    {
      id: 4,
      date: 'Jan 8, 2026',
      name: 'ASU Research Building',
      description: 'Full MEP - Higher Education',
      value: 1200000,
      stage: 'proposal',
      stageName: 'Quoted',
      probability: 'Medium',
      salesperson: { name: 'Jake Davis', initials: 'JD', color: '#10b981' },
      owner: 'Arizona State University',
      icon: '🏛',
      iconGradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)'
    },
    {
      id: 5,
      date: 'Jan 5, 2026',
      name: 'Tempe Marketplace Phase 2',
      description: 'Plumbing - Retail Development',
      value: 890000,
      stage: 'qualified',
      stageName: 'Opportunity Received',
      probability: 'Low',
      salesperson: { name: 'Mike Reynolds', initials: 'MR', color: '#3b82f6' },
      owner: 'Vestar Development',
      icon: '🏬',
      iconGradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)'
    },
    {
      id: 6,
      date: 'Jan 3, 2026',
      name: 'Scottsdale Quarter Expansion',
      description: 'HVAC - Mixed Use Development',
      value: 780000,
      stage: 'negotiation',
      stageName: 'Quoted',
      probability: 'High',
      salesperson: { name: 'Mike Reynolds', initials: 'MR', color: '#3b82f6' },
      owner: 'Macerich Company',
      icon: '🏢',
      iconGradient: 'linear-gradient(135deg, #10b981, #06b6d4)'
    },
    {
      id: 7,
      date: 'Dec 28, 2025',
      name: 'Dignity Health Clinic - Gilbert',
      description: 'Medical Gas & Plumbing - Healthcare',
      value: 520000,
      stage: 'won',
      stageName: 'Awarded',
      probability: 'High',
      salesperson: { name: 'Tom Henderson', initials: 'TH', color: '#f59e0b' },
      owner: 'Dignity Health',
      icon: '🏥',
      iconGradient: 'linear-gradient(135deg, #f43f5e, #f59e0b)'
    },
    {
      id: 8,
      date: 'Dec 22, 2025',
      name: 'Mesa Community College - Science',
      description: 'Lab Piping - Higher Education',
      value: 420000,
      stage: 'lead',
      stageName: 'Lead',
      probability: 'Low',
      salesperson: { name: 'Mike Reynolds', initials: 'MR', color: '#3b82f6' },
      owner: 'Maricopa Community Colleges',
      icon: '🏫',
      iconGradient: 'linear-gradient(135deg, #8b5cf6, #3b82f6)'
    },
    {
      id: 9,
      date: 'Dec 18, 2025',
      name: 'Intel Ocotillo Campus - Bldg 4',
      description: 'Process Piping - Industrial',
      value: 3200000,
      stage: 'lead',
      stageName: 'Lead',
      probability: 'Low',
      salesperson: { name: 'Kevin Walsh', initials: 'KW', color: '#8b5cf6' },
      owner: 'Intel Corporation',
      icon: '🏭',
      iconGradient: 'linear-gradient(135deg, #06b6d4, #10b981)'
    },
    {
      id: 10,
      date: 'Dec 15, 2025',
      name: 'Mesa School District - HVAC',
      description: 'HVAC Replacement - K-12',
      value: 340000,
      stage: 'won',
      stageName: 'Awarded',
      probability: 'High',
      salesperson: { name: 'Jake Davis', initials: 'JD', color: '#10b981' },
      owner: 'Mesa Public Schools',
      icon: '🏫',
      iconGradient: 'linear-gradient(135deg, #10b981, #3b82f6)'
    }
  ];

  // Group by market sector based on description keywords
  const getMarketSector = (description: string): string => {
    const desc = description.toLowerCase();
    if (desc.includes('healthcare') || desc.includes('hospital') || desc.includes('medical') || desc.includes('health') || desc.includes('clinic')) return 'Healthcare';
    if (desc.includes('education') || desc.includes('school') || desc.includes('college') || desc.includes('university') || desc.includes('k-12')) return 'Education';
    if (desc.includes('industrial') || desc.includes('manufacturing') || desc.includes('process')) return 'Industrial';
    if (desc.includes('retail') || desc.includes('marketplace')) return 'Retail';
    return 'Commercial';
  };

  const marketData = opportunities.reduce((acc, opp) => {
    const sector = getMarketSector(opp.description);
    if (!acc[sector]) {
      acc[sector] = { count: 0, value: 0 };
    }
    acc[sector].count += 1;
    acc[sector].value += opp.value;
    return acc;
  }, {} as { [key: string]: { count: number; value: number } });

  const marketSectors = Object.keys(marketData).sort((a, b) => marketData[b].value - marketData[a].value);

  // Helper to convert probability to percentage
  const getProbabilityPercent = (probability: number | string): number => {
    if (typeof probability === 'number') return probability;
    if (probability === 'Low') return 33;
    if (probability === 'Medium') return 66;
    if (probability === 'High') return 100;
    return 0;
  };

  // Calculate KPIs
  const totalPipeline = opportunities.reduce((sum, opp) => sum + opp.value, 0);
  const weightedPipeline = opportunities.reduce((sum, opp) => sum + (opp.value * getProbabilityPercent(opp.probability) / 100), 0);
  const activeOpportunities = opportunities.filter(opp => opp.stage !== 'won').length;
  const wonOpportunities = opportunities.filter(opp => opp.stage === 'won').length;
  const totalClosedValue = opportunities.reduce((sum, opp) => sum + opp.value, 0);
  const winRate = totalClosedValue > 0 ? (wonOpportunities / opportunities.length) * 100 : 0;

  // Group by stage for funnel
  const stageData = {
    lead: opportunities.filter(o => o.stage === 'lead'),
    qualified: opportunities.filter(o => o.stage === 'qualified'),
    proposal: opportunities.filter(o => o.stage === 'proposal'),
    negotiation: opportunities.filter(o => o.stage === 'negotiation'),
    won: opportunities.filter(o => o.stage === 'won')
  };

  const stageValues = {
    lead: stageData.lead.reduce((sum, o) => sum + o.value, 0),
    qualified: stageData.qualified.reduce((sum, o) => sum + o.value, 0),
    proposal: stageData.proposal.reduce((sum, o) => sum + o.value, 0),
    negotiation: stageData.negotiation.reduce((sum, o) => sum + o.value, 0),
    won: stageData.won.reduce((sum, o) => sum + o.value, 0)
  };

  const maxStageValue = Math.max(...Object.values(stageValues));

  // Chart data - use real trend data from API
  const trendChartData = {
    labels: trendData.map(d => d.month_label),
    datasets: [
      {
        label: 'Pipeline Value',
        data: trendData.map(d => d.pipeline_value / 1000000), // Convert to millions
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      }
    ]
  };

  const getSectorColor = (sector: string): string => {
    const colors: { [key: string]: string } = {
      'Healthcare': '#10b981',
      'Education': '#3b82f6',
      'Commercial': '#8b5cf6',
      'Industrial': '#f59e0b',
      'Retail': '#06b6d4'
    };
    return colors[sector] || '#6b7280';
  };

  const marketChartData = {
    labels: marketSectors,
    datasets: [
      {
        data: marketSectors.map(sector => marketData[sector].value),
        backgroundColor: marketSectors.map(sector => getSectorColor(sector)),
        borderWidth: 2,
        borderColor: '#ffffff'
      }
    ]
  };

  const doughnutOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: function(context: any) {
            const sector = context.label;
            const value = formatCurrency(context.parsed);
            const count = marketData[sector].count;
            return `${sector}: ${value} (${count} opportunities)`;
          }
        }
      },
      datalabels: {
        display: true,
        color: function(context: any) {
          return getSectorColor(context.chart.data.labels[context.dataIndex]);
        },
        font: {
          size: 11,
          weight: 'bold'
        },
        formatter: function(value: number, context: any) {
          const sector = context.chart.data.labels[context.dataIndex];
          const count = marketData[sector].count;
          const formattedValue = formatCurrency(value);
          return `${sector}\nQty: ${count}\n${formattedValue}`;
        },
        anchor: 'end',
        align: 'end',
        offset: 15,
        textAlign: 'center'
      }
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };


  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const getStageColor = (stage: string) => {
    const colors: { [key: string]: string } = {
      lead: '#8b5cf6',
      qualified: '#06b6d4',
      proposal: '#3b82f6',
      negotiation: '#f59e0b',
      won: '#10b981'
    };
    return colors[stage] || '#6b7280';
  };

  // Filter opportunities based on search term
  const filteredOpportunities = opportunities.filter(opp =>
    opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.salesperson.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort opportunities
  const sortedOpportunities = [...filteredOpportunities].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'date':
        aValue = new Date(a.date).getTime();
        bValue = new Date(b.date).getTime();
        break;
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'owner':
        aValue = a.owner.toLowerCase();
        bValue = b.owner.toLowerCase();
        break;
      case 'value':
        aValue = a.value;
        bValue = b.value;
        break;
      case 'stage':
        aValue = a.stage;
        bValue = b.stage;
        break;
      case 'salesperson':
        aValue = a.salesperson.name.toLowerCase();
        bValue = b.salesperson.name.toLowerCase();
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOpportunity(null);
  };

  const handleSaveOpportunity = () => {
    setIsModalOpen(false);
    setSelectedOpportunity(null);
    // The modal already handles invalidating the query cache
    // Data will be automatically refreshed
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Loading opportunities...</div>
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
            <h1>📊 Sales Pipeline</h1>
            <div className="sales-subtitle">Track opportunities from lead to close</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <div className="sales-view-toggle">
            <button
              className={view === 'table' ? 'active' : ''}
              onClick={() => setView('table')}
            >
              📋 Table
            </button>
            <button
              className={view === 'board' ? 'active' : ''}
              onClick={() => setView('board')}
            >
              📌 Board
            </button>
          </div>
          <button className="sales-btn sales-btn-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button className="sales-btn sales-btn-primary" onClick={() => {
            setSelectedOpportunity(null);
            setIsModalOpen(true);
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Opportunity
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid">
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Pipeline Value</div>
          <div className="sales-kpi-value">{formatCurrency(totalPipeline)}</div>
          <div className="sales-kpi-trend up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            </svg>
            +12.5% from last month
          </div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">Weighted Pipeline</div>
          <div className="sales-kpi-value">{formatCurrency(weightedPipeline)}</div>
          <div className="sales-kpi-trend up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            </svg>
            +8.3% from last month
          </div>
        </div>
        <div className="sales-kpi-card amber">
          <div className="sales-kpi-label">Active Opportunities</div>
          <div className="sales-kpi-value">{activeOpportunities}</div>
          <div className="sales-kpi-trend up">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            </svg>
            +5 new this week
          </div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Win Rate (YTD)</div>
          <div className="sales-kpi-value">{winRate.toFixed(0)}%</div>
          <div className="sales-kpi-trend down">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>
            </svg>
            -2.1% from last quarter
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="sales-charts-grid">
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">Pipeline Trend</div>
              <div className="sales-chart-subtitle">Monthly pipeline value over time</div>
            </div>
          </div>
          <div className="sales-chart-container">
            <Line data={trendChartData} options={chartOptions} />
          </div>
        </div>
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">Stage Funnel</div>
              <div className="sales-chart-subtitle">Opportunities by stage</div>
            </div>
          </div>
          <div className="sales-chart-container">
            <div className="sales-funnel-container">
              <div className="sales-funnel-stage">
                <div className="sales-funnel-label">Lead</div>
                <div className="sales-funnel-bar-container">
                  <div
                    className="sales-funnel-bar"
                    style={{
                      width: `${(stageValues.lead / maxStageValue) * 100}%`,
                      background: '#8b5cf6'
                    }}
                  >
                    {stageData.lead.length}
                  </div>
                </div>
                <div className="sales-funnel-value" style={{ color: '#8b5cf6' }}>
                  {formatCurrency(stageValues.lead)}
                </div>
              </div>
              <div className="sales-funnel-stage">
                <div className="sales-funnel-label">Qualified</div>
                <div className="sales-funnel-bar-container">
                  <div
                    className="sales-funnel-bar"
                    style={{
                      width: `${(stageValues.qualified / maxStageValue) * 100}%`,
                      background: '#06b6d4'
                    }}
                  >
                    {stageData.qualified.length}
                  </div>
                </div>
                <div className="sales-funnel-value" style={{ color: '#06b6d4' }}>
                  {formatCurrency(stageValues.qualified)}
                </div>
              </div>
              <div className="sales-funnel-stage">
                <div className="sales-funnel-label">Proposal</div>
                <div className="sales-funnel-bar-container">
                  <div
                    className="sales-funnel-bar"
                    style={{
                      width: `${(stageValues.proposal / maxStageValue) * 100}%`,
                      background: '#3b82f6'
                    }}
                  >
                    {stageData.proposal.length}
                  </div>
                </div>
                <div className="sales-funnel-value" style={{ color: '#3b82f6' }}>
                  {formatCurrency(stageValues.proposal)}
                </div>
              </div>
              <div className="sales-funnel-stage">
                <div className="sales-funnel-label">Negotiation</div>
                <div className="sales-funnel-bar-container">
                  <div
                    className="sales-funnel-bar"
                    style={{
                      width: `${(stageValues.negotiation / maxStageValue) * 100}%`,
                      background: '#f59e0b'
                    }}
                  >
                    {stageData.negotiation.length}
                  </div>
                </div>
                <div className="sales-funnel-value" style={{ color: '#f59e0b' }}>
                  {formatCurrency(stageValues.negotiation)}
                </div>
              </div>
              <div className="sales-funnel-stage">
                <div className="sales-funnel-label">Won</div>
                <div className="sales-funnel-bar-container">
                  <div
                    className="sales-funnel-bar"
                    style={{
                      width: `${(stageValues.won / maxStageValue) * 100}%`,
                      background: '#10b981'
                    }}
                  >
                    {stageData.won.length}
                  </div>
                </div>
                <div className="sales-funnel-value" style={{ color: '#10b981' }}>
                  {formatCurrency(stageValues.won)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">By Market</div>
              <div className="sales-chart-subtitle">Pipeline by sector</div>
            </div>
          </div>
          <div className="sales-chart-container">
            <div className="sales-market-chart-full">
              {/* @ts-ignore */}
              <Doughnut data={marketChartData} options={doughnutOptions} plugins={[ChartDataLabels]} />
            </div>
          </div>
        </div>
      </div>

      {/* Board View */}
      {view === 'board' && (
        <div className="sales-pipeline-board">
          {(['lead', 'qualified', 'proposal', 'negotiation', 'won'] as const).map((stage) => (
            <div key={stage} className="sales-pipeline-column">
              <div className="sales-column-header">
                <div>
                  <div className="sales-column-title" style={{ color: getStageColor(stage) }}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </div>
                  <div className="sales-column-total">{formatCurrency(stageValues[stage])}</div>
                </div>
                <div className="sales-column-count">{stageData[stage].length}</div>
              </div>
              {stageData[stage].slice(0, 2).map((opp) => (
                <div key={opp.id} className="sales-opportunity-card">
                  <div className="sales-opp-name">{opp.name}</div>
                  <div className="sales-opp-value">{formatCurrency(opp.value)}</div>
                  <div className="sales-opp-meta">
                    <span className="sales-opp-date">{opp.date}</span>
                    <div
                      className="sales-opp-avatar"
                      style={{ background: opp.salesperson.color }}
                    >
                      {opp.salesperson.initials}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {view === 'table' && (
        <div className="sales-table-section">
          <div className="sales-table-header">
            <div className="sales-table-title">All Opportunities</div>
            <div className="sales-table-controls">
              <div className="sales-search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search opportunities..."
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
                <th className="sales-sortable" onClick={() => handleSort('date')}>
                  Date <span className="sales-sort-icon">{sortColumn === 'date' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th className="sales-sortable" onClick={() => handleSort('name')}>
                  Project / Opportunity <span className="sales-sort-icon">{sortColumn === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th className="sales-sortable" onClick={() => handleSort('owner')}>
                  Owner <span className="sales-sort-icon">{sortColumn === 'owner' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th className="sales-sortable" onClick={() => handleSort('value')}>
                  Value <span className="sales-sort-icon">{sortColumn === 'value' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th className="sales-sortable" onClick={() => handleSort('stage')}>
                  Stage <span className="sales-sort-icon">{sortColumn === 'stage' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th>Probability</th>
                <th className="sales-sortable" onClick={() => handleSort('salesperson')}>
                  Salesperson <span className="sales-sort-icon">{sortColumn === 'salesperson' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedOpportunities.map((opp) => (
                <tr
                  key={opp.id}
                  onClick={() => {
                    // Find the actual API opportunity
                    const apiOpp = apiOpportunities.find(a => a.id === opp.id);
                    if (apiOpp) {
                      setSelectedOpportunity(apiOpp);
                      setIsModalOpen(true);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{opp.date}</td>
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: opp.iconGradient }}>
                        {opp.icon}
                      </div>
                      <div className="sales-project-info">
                        <h4>{opp.name}</h4>
                        <span>{opp.description}</span>
                      </div>
                    </div>
                  </td>
                  <td>{opp.owner || '-'}</td>
                  <td className="sales-value-cell">{formatCurrency(opp.value)}</td>
                  <td>
                    <span className={`sales-stage-badge ${opp.stage}`}>
                      <span className="sales-stage-dot"></span>
                      {opp.stageName}
                    </span>
                  </td>
                  <td>
                    {opp.probability ? (
                      <span className={`sales-probability-badge ${typeof opp.probability === 'string' ? opp.probability.toLowerCase() : ''}`}>
                        <span className="sales-probability-dot"></span>
                        {opp.probability}
                      </span>
                    ) : (
                      <span>-</span>
                    )}
                  </td>
                  <td>
                    <div className="sales-salesperson-cell">
                      <div
                        className="sales-salesperson-avatar"
                        style={{ background: opp.salesperson.color }}
                      >
                        {opp.salesperson.initials}
                      </div>
                      {opp.salesperson.name}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Opportunity Modal */}
      {isModalOpen && (
        <OpportunityModal
          opportunity={selectedOpportunity}
          onClose={handleCloseModal}
          onSave={handleSaveOpportunity}
        />
      )}
    </div>
  );
};

export default SalesPipeline;
