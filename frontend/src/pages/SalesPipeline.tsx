import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { useQuery } from '@tanstack/react-query';
import OpportunityModal from '../components/opportunities/OpportunityModal';
import opportunitiesService, { Opportunity as OpportunityType } from '../services/opportunities';
import { officeLocationsApi } from '../services/officeLocations';
import { usersApi } from '../services/users';
import { employeesApi } from '../services/employees';
import '../styles/SalesPipeline.css';

// Register ChartJS components (excluding datalabels globally)
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  facilityLocationName: string;
  company: string;
  market: string;
  icon: string;
  iconGradient: string;
}

const SalesPipeline: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<'table' | 'board'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityType | null>(null);
  const [sortColumn, setSortColumn] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedOfficeLocation, setSelectedOfficeLocation] = useState<string>('all');
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('all');

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

  // Fetch pipeline stages
  const { data: pipelineStages = [], isLoading: isStagesLoading } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => opportunitiesService.getStages()
  });

  // Fetch office locations
  const { data: officeLocationsData } = useQuery({
    queryKey: ['office-locations'],
    queryFn: async () => {
      const response = await officeLocationsApi.getAll();
      return response.data?.data || [];
    }
  });
  const officeLocations = Array.isArray(officeLocationsData) ? officeLocationsData : [];

  // Fetch employees to get office location mapping
  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response = await employeesApi.getAll();
      return response.data?.data || [];
    }
  });
  const employees = Array.isArray(employeesData) ? employeesData : [];

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
      value: Number(opp.estimated_value) || 0,
      stage: stageKey,
      stageName: opp.stage_name || 'Lead',
      probability: opp.probability || opp.stage_probability || 0,
      salesperson: {
        name: salespersonName,
        initials: opp.assigned_to_name ? opp.assigned_to_name.split(' ').map(n => n[0]).join('') : 'U',
        color: getSalespersonColor(salespersonName)
      },
      facilityLocationName: opp.facility_customer_id ? (opp.facility_customer_name || '') : (opp.facility_name || ''),
      company: opp.customer_id ? (opp.customer_name || '') : (opp.owner || ''),
      market: opp.market || '',
      icon: getMarketIcon(opp.market),
      iconGradient: getMarketGradient(opp.market)
    };
  };

  const opportunities: SalesOpportunity[] = apiOpportunities.map(mapApiToDisplay);

  // Handle deep link from dashboard - open opportunity modal if ID is passed in state
  useEffect(() => {
    const state = location.state as { selectedOpportunityId?: number } | null;
    if (state?.selectedOpportunityId && apiOpportunities.length > 0) {
      const apiOpp = apiOpportunities.find(a => a.id === state.selectedOpportunityId);
      if (apiOpp) {
        setSelectedOpportunity(apiOpp);
        setIsModalOpen(true);
      }
      // Clear the state so refreshing doesn't reopen
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, apiOpportunities, navigate, location.pathname]);

  // Get unique salespeople from opportunities
  const salespeople = useMemo(() => {
    const uniqueSalespeople = new Set<string>();
    apiOpportunities.forEach(opp => {
      if (opp.assigned_to_name) {
        uniqueSalespeople.add(opp.assigned_to_name);
      }
    });
    return Array.from(uniqueSalespeople).sort();
  }, [apiOpportunities]);

  // Create a mapping of salespeople to their office locations (from employees data)
  const salespersonToOffice = useMemo(() => {
    const mapping: Record<string, number | null> = {};
    if (employees && Array.isArray(employees)) {
      employees.forEach((emp: any) => {
        const fullName = `${emp.first_name} ${emp.last_name}`;
        mapping[fullName] = emp.office_location_id;
      });
    }
    return mapping;
  }, [employees]);

  // Filter opportunities based on selected filters
  const filteredApiOpportunities = useMemo(() => {
    return apiOpportunities.filter(opp => {
      // Filter by salesperson
      if (selectedSalesperson !== 'all' && opp.assigned_to_name !== selectedSalesperson) {
        return false;
      }

      // Filter by office location
      if (selectedOfficeLocation !== 'all') {
        const officeId = parseInt(selectedOfficeLocation);

        // If filtering by office, check if this opportunity's salesperson belongs to that office
        if (opp.assigned_to_name) {
          const salespersonOfficeId = salespersonToOffice[opp.assigned_to_name];
          if (salespersonOfficeId !== officeId) {
            return false;
          }
        } else {
          // If no salesperson assigned, exclude from office filter
          return false;
        }
      }

      return true;
    });
  }, [apiOpportunities, selectedSalesperson, selectedOfficeLocation, salespersonToOffice]);

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
      facilityLocationName: 'Terminal 4',
      company: 'City of Phoenix',
      market: 'Commercial',
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
      facilityLocationName: 'Data Center',
      company: 'Banner Health',
      market: 'Healthcare',
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
      facilityLocationName: 'District Office',
      company: 'Chandler USD',
      market: 'Education',
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
      facilityLocationName: 'Research Building',
      company: 'Arizona State University',
      market: 'Education',
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
      facilityLocationName: 'Phase 2 Building',
      company: 'Vestar Development',
      market: 'Retail',
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
      facilityLocationName: 'Expansion Wing',
      company: 'Macerich Company',
      market: 'Commercial',
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
      facilityLocationName: 'Gilbert Clinic',
      company: 'Dignity Health',
      market: 'Healthcare',
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
      facilityLocationName: 'Science Building',
      company: 'Maricopa Community Colleges',
      market: 'Education',
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
      facilityLocationName: 'Building 4',
      company: 'Intel Corporation',
      market: 'Industrial',
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
      facilityLocationName: 'District Facilities',
      company: 'Mesa Public Schools',
      market: 'Education',
      icon: '🏫',
      iconGradient: 'linear-gradient(135deg, #10b981, #3b82f6)'
    }
  ];

  // Group by market sector using the market field from FILTERED API opportunities
  const marketData = filteredApiOpportunities.reduce((acc, opp) => {
    // Use the market field directly, or skip if not set
    const sector = opp.market;
    if (!sector) return acc;

    if (!acc[sector]) {
      acc[sector] = { count: 0, value: 0 };
    }
    acc[sector].count += 1;
    acc[sector].value += Number(opp.estimated_value) || 0;
    return acc;
  }, {} as { [key: string]: { count: number; value: number } });

  const marketSectors = Object.keys(marketData).sort((a, b) => marketData[b].value - marketData[a].value);

  // Helper to convert probability to percentage
  const getProbabilityPercent = (probability: number | string): number => {
    if (typeof probability === 'number') return probability;
    if (probability === 'Low') return 15;
    if (probability === 'Medium') return 40;
    if (probability === 'High') return 80;
    return 0;
  };

  // Calculate KPIs from FILTERED opportunities
  const filteredOpportunities = filteredApiOpportunities.map(mapApiToDisplay);
  const totalPipeline = filteredOpportunities.reduce((sum, opp) => sum + opp.value, 0);
  const weightedPipeline = filteredOpportunities.reduce((sum, opp) => sum + (opp.value * getProbabilityPercent(opp.probability) / 100), 0);
  const activeOpportunities = filteredOpportunities.filter(opp => opp.stage !== 'won').length;
  const wonOpportunities = filteredOpportunities.filter(opp => opp.stage === 'won').length;
  const totalClosedValue = filteredOpportunities.reduce((sum, opp) => sum + opp.value, 0);
  const winRate = totalClosedValue > 0 && filteredOpportunities.length > 0 ? (wonOpportunities / filteredOpportunities.length) * 100 : 0;

  // Group opportunities by stage for funnel (using stage_name from FILTERED API)
  // Only include active stages, exclude "Lost" and "Passed" from funnel display
  const activeStages = pipelineStages
    .filter(stage => stage.name !== 'Lost' && stage.name !== 'Passed')
    .sort((a, b) => a.display_order - b.display_order);

  const stageDataMap = activeStages.reduce((acc, stage) => {
    const oppsForStage = filteredApiOpportunities.filter(o => o.stage_name === stage.name);
    acc[stage.name] = {
      opportunities: oppsForStage,
      count: oppsForStage.length,
      value: oppsForStage.reduce((sum, o) => sum + (Number(o.estimated_value) || 0), 0),
      color: stage.color
    };
    return acc;
  }, {} as { [key: string]: { opportunities: OpportunityType[], count: number, value: number, color: string } });

  const maxStageValue = Math.max(...Object.values(stageDataMap).map(s => s.value), 1);

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

  // Market bar chart data
  const marketBarChartData = {
    labels: marketSectors,
    datasets: [
      {
        label: 'Pipeline Value',
        data: marketSectors.map(sector => marketData[sector].value),
        backgroundColor: marketSectors.map(sector => getSectorColor(sector)),
        borderRadius: 6,
        barThickness: 40
      }
    ]
  };

  const marketBarChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: function(context: any) {
            const sector = context.label;
            const value = formatCurrency(context.parsed.y);
            const count = marketData[sector]?.count || 0;
            return `${sector}: ${value} (${count} opportunities)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value);
          }
        }
      },
      x: {
        grid: {
          display: false
        }
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

  // Filter opportunities based on search term (on top of filter selections)
  const searchFilteredOpportunities = filteredOpportunities.filter(opp =>
    opp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.salesperson.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.facilityLocationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opp.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort opportunities
  const sortedOpportunities = [...searchFilteredOpportunities].sort((a, b) => {
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
      case 'facilityLocationName':
        aValue = a.facilityLocationName.toLowerCase();
        bValue = b.facilityLocationName.toLowerCase();
        break;
      case 'company':
        aValue = a.company.toLowerCase();
        bValue = b.company.toLowerCase();
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
            <Link to="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Dashboard
            </Link>
            <h1>💼 Sales Pipeline</h1>
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
          <button className="sales-btn sales-btn-secondary" onClick={() => navigate('/campaigns')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Campaigns
          </button>
          <button className="sales-btn sales-btn-secondary" onClick={() => navigate('/sales/opportunity-search')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <path d="M8 11h6M11 8v6"/>
            </svg>
            Opportunity Search
          </button>
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
              {activeStages.map(stage => {
                const stageData = stageDataMap[stage.name] || { count: 0, value: 0, color: stage.color };
                const widthPercent = maxStageValue > 0 ? (stageData.value / maxStageValue) * 100 : 0;

                return (
                  <div key={stage.id} className="sales-funnel-stage">
                    <div className="sales-funnel-label">{stage.name}</div>
                    <div className="sales-funnel-bar-container">
                      <div
                        className="sales-funnel-bar"
                        style={{
                          width: `${widthPercent}%`,
                          background: stageData.color
                        }}
                      >
                        {stageData.count}
                      </div>
                    </div>
                    <div className="sales-funnel-value" style={{ color: stageData.color }}>
                      {formatCurrency(stageData.value)}
                    </div>
                  </div>
                );
              })}
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
            <Bar data={marketBarChartData} options={marketBarChartOptions} />
          </div>
        </div>
      </div>

      {/* Board View */}
      {view === 'board' && (
        <div className="sales-pipeline-board">
          {activeStages.map((stage) => {
            const stageInfo = stageDataMap[stage.name] || { opportunities: [], count: 0, value: 0, color: stage.color };
            const displayOpps = stageInfo.opportunities.slice(0, 2).map(mapApiToDisplay);

            return (
              <div key={stage.id} className="sales-pipeline-column">
                <div className="sales-column-header">
                  <div>
                    <div className="sales-column-title" style={{ color: stageInfo.color }}>
                      {stage.name}
                    </div>
                    <div className="sales-column-total">{formatCurrency(stageInfo.value)}</div>
                  </div>
                  <div className="sales-column-count">{stageInfo.count}</div>
                </div>
                {displayOpps.map((opp) => (
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
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === 'table' && (
        <div className="sales-table-section">
          <div className="sales-table-header">
            <div className="sales-table-title">All Opportunities</div>
            <div className="sales-table-controls">
              <select
                value={selectedOfficeLocation}
                onChange={(e) => setSelectedOfficeLocation(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  minWidth: '150px',
                  marginRight: '8px'
                }}
              >
                <option value="all">All Offices</option>
                {officeLocations.map((office: any) => (
                  <option key={office.id} value={office.id}>{office.name}</option>
                ))}
              </select>
              <select
                value={selectedSalesperson}
                onChange={(e) => setSelectedSalesperson(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  minWidth: '150px',
                  marginRight: '8px'
                }}
              >
                <option value="all">All Salespeople</option>
                {salespeople.map((person) => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
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
                <th className="sales-sortable" onClick={() => handleSort('company')}>
                  Company <span className="sales-sort-icon">{sortColumn === 'company' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th className="sales-sortable" onClick={() => handleSort('facilityLocationName')}>
                  Facility/Location Name <span className="sales-sort-icon">{sortColumn === 'facilityLocationName' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
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
                  <td>{opp.company || '-'}</td>
                  <td>{opp.facilityLocationName || '-'}</td>
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
                        {typeof opp.probability === 'string'
                          ? `${opp.probability} (${getProbabilityPercent(opp.probability)}%)`
                          : `${opp.probability}%`
                        }
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
