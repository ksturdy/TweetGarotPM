import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import opportunitySearchService, { SearchCriteria, GeneratedLead, SearchSummary, SavedSearchListItem } from '../services/opportunitySearch';
import recurringSearchesService, { RecurringSearch } from '../services/recurringSearches';
import opportunitiesService from '../services/opportunities';
import '../styles/SalesPipeline.css';
import { useTitanFeedback } from '../context/TitanFeedbackContext';
import '../styles/OpportunitySearch.css';

import { MARKET_VALUES as MARKET_OPTIONS } from '../constants/markets';

const CONSTRUCTION_TYPE_OPTIONS = [
  'New Construction', 'Renovation', 'Tenant Improvement',
  'Addition', 'Retrofit', 'Service/Maintenance'
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumberWithCommas(value: string | number | undefined): string {
  if (value === undefined || value === '') return '';
  const num = typeof value === 'string' ? value.replace(/[^0-9]/g, '') : String(value);
  if (!num) return '';
  return Number(num).toLocaleString('en-US');
}

function parseFormattedNumber(formatted: string): number | undefined {
  const digits = formatted.replace(/[^0-9]/g, '');
  if (!digits) return undefined;
  return Number(digits);
}

function mapLeadToOpportunity(lead: GeneratedLead, stageId?: number) {
  const contactLine = lead.contact_name
    ? `Contact: ${lead.contact_name}, ${lead.contact_title}`
    : `Look for: ${lead.contact_title} (needs research)`;
  const emailPhone = [
    lead.contact_email ? `Email: ${lead.contact_email}` : null,
    lead.contact_phone ? `Phone: ${lead.contact_phone}` : null,
  ].filter(Boolean).join(' | ');

  const details = [
    '',
    '---',
    lead.mechanical_scope ? `Mechanical Scope: ${lead.mechanical_scope}` : '',
    lead.square_footage && lead.square_footage !== 'N/A' ? `Square Footage: ${lead.square_footage}` : '',
    '',
    contactLine,
    emailPhone || 'Contact details need research',
    '',
    `AI Confidence: ${lead.confidence} - ${lead.confidence_explanation || ''}`,
    `Verification: ${lead.verification_status}`,
    `Timeline: ${lead.timeline}`,
    lead.intelligence_source ? `Source: ${lead.intelligence_source}` : '',
    lead.source_url ? `Source URL: ${lead.source_url}` : '',
    lead.next_steps ? `Next Steps: ${lead.next_steps}` : '',
  ].filter(Boolean).join('\n');

  return {
    title: lead.project_name,
    description: (lead.project_description + details),
    estimated_value: lead.estimated_value,
    construction_type: lead.construction_type,
    market: lead.market_sector,
    location: lead.location,
    owner: lead.company_name,
    general_contractor: lead.general_contractor || undefined,
    estimated_start_date: lead.estimated_start_date || undefined,
    source: 'ai_search',
    ...(stageId ? { stage_id: stageId } : {}),
    priority: 'medium' as const,
  };
}

function generateSearchName(criteria: SearchCriteria): string {
  const parts: string[] = [];
  if (criteria.market_sector) parts.push(criteria.market_sector);
  if (criteria.construction_type) parts.push(criteria.construction_type);
  if (criteria.location) parts.push(criteria.location);
  if (criteria.keywords) parts.push(criteria.keywords.split(',')[0].trim());
  if (parts.length === 0) parts.push('General Search');
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${parts.join(' - ')} (${date})`;
}

const OpportunitySearch: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();

  const [formData, setFormData] = useState<SearchCriteria>({
    market_sector: '',
    location: '',
    construction_type: '',
    min_value: undefined,
    max_value: undefined,
    keywords: '',
    additional_criteria: '',
  });

  const [leads, setLeads] = useState<GeneratedLead[]>([]);
  const [summary, setSummary] = useState<SearchSummary | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [converting, setConverting] = useState(false);
  const [viewingSavedId, setViewingSavedId] = useState<number | null>(null);
  const [lastCriteria, setLastCriteria] = useState<SearchCriteria | null>(null);
  const [selectedSavedSearches, setSelectedSavedSearches] = useState<Set<number>>(new Set());
  const [viewingRecurringId, setViewingRecurringId] = useState<number | null>(null);
  const [viewingRecurringName, setViewingRecurringName] = useState<string>('');
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [recurringDialogMode, setRecurringDialogMode] = useState<'create' | 'edit'>('create');
  const [recurringDialogData, setRecurringDialogData] = useState<{ id?: number; savedSearchId?: number; name: string; description: string }>({ name: '', description: '' });
  const [shouldAutoSave, setShouldAutoSave] = useState(true);

  const savedSearchesQuery = useQuery({
    queryKey: ['saved-opportunity-searches'],
    queryFn: () => opportunitySearchService.getSavedSearches(),
  });

  const deleteSavedMutation = useMutation({
    mutationFn: (id: number) => opportunitySearchService.deleteSavedSearch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-opportunity-searches'] });
      setSuccessMessage('Search deleted.');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => opportunitySearchService.deleteSavedSearches(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-opportunity-searches'] });
      setSelectedSavedSearches(new Set());
      setSuccessMessage('Selected searches removed.');
    },
  });

  const saveAsRecurringMutation = useMutation({
    mutationFn: async (data: { savedSearchId: number; name: string; description: string }) => {
      // Create the recurring search with custom name/description
      const recurring = await recurringSearchesService.createFromSaved(data.savedSearchId, {
        name: data.name,
        description: data.description,
      });
      // Delete the saved search so it moves from Recent to Recurring
      await opportunitySearchService.deleteSavedSearch(data.savedSearchId);
      return recurring;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-searches'] });
      queryClient.invalidateQueries({ queryKey: ['saved-opportunity-searches'] });
      setRecurringDialogOpen(false);
      setSuccessMessage('Search moved to recurring! You can now schedule it.');
    },
  });

  const updateRecurringMutation = useMutation({
    mutationFn: (data: { id: number; name?: string; description?: string; criteria?: SearchCriteria }) =>
      recurringSearchesService.update(data.id, {
        name: data.name,
        description: data.description,
        criteria: data.criteria,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-searches'] });
      setRecurringDialogOpen(false);
      setSuccessMessage('Recurring search updated.');
    },
  });

  const recurringSearchesQuery = useQuery({
    queryKey: ['recurring-searches'],
    queryFn: () => recurringSearchesService.getAll(),
  });

  const toggleRecurringMutation = useMutation({
    mutationFn: (id: number) => recurringSearchesService.toggleActive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-searches'] });
      setSuccessMessage('Recurring search status updated.');
    },
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: (id: number) => recurringSearchesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-searches'] });
      setSuccessMessage('Recurring search deleted.');
    },
  });

  const handleViewRecurring = (recurringSearch: RecurringSearch) => {
    // Load the criteria into the form
    setFormData({
      market_sector: recurringSearch.criteria.market_sector || '',
      location: recurringSearch.criteria.location || '',
      construction_type: recurringSearch.criteria.construction_type || '',
      min_value: recurringSearch.criteria.min_value,
      max_value: recurringSearch.criteria.max_value,
      keywords: recurringSearch.criteria.keywords || '',
      additional_criteria: recurringSearch.criteria.additional_criteria || '',
    });

    setLastCriteria(recurringSearch.criteria);
    setViewingSavedId(null);
    setViewingRecurringId(recurringSearch.id);
    setViewingRecurringName(recurringSearch.name);
    setError('');

    // Load the last saved results (if they exist)
    if (recurringSearch.last_results && recurringSearch.last_results.length > 0) {
      setLeads(recurringSearch.last_results);
      setSummary({
        total_leads: recurringSearch.last_result_count,
        total_estimated_value: recurringSearch.last_result_value,
        market_breakdown: {},
        search_criteria_used: '',
      });
      setSuccessMessage(`Loaded results from ${new Date(recurringSearch.last_run_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Click "Rerun" for fresh results.`);
    } else {
      setLeads([]);
      setSummary(null);
      setSuccessMessage('No results yet for this recurring search. Click "Rerun" to execute the search.');
    }

    // Scroll to top to show the form and results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRerunRecurring = async (recurringSearch: RecurringSearch) => {
    // Load the criteria and run a fresh search
    setFormData({
      market_sector: recurringSearch.criteria.market_sector || '',
      location: recurringSearch.criteria.location || '',
      construction_type: recurringSearch.criteria.construction_type || '',
      min_value: recurringSearch.criteria.min_value,
      max_value: recurringSearch.criteria.max_value,
      keywords: recurringSearch.criteria.keywords || '',
      additional_criteria: recurringSearch.criteria.additional_criteria || '',
    });

    setLastCriteria(recurringSearch.criteria);
    setViewingSavedId(null);
    setViewingRecurringId(recurringSearch.id);
    setViewingRecurringName(recurringSearch.name);
    setSuccessMessage(`Re-running search: "${recurringSearch.name}"...`);

    // Disable auto-save for this search since it's a recurring search rerun
    setShouldAutoSave(false);
    searchMutation.mutate(recurringSearch.criteria);
  };

  const handleLoadSaved = async (id: number) => {
    try {
      const saved = await opportunitySearchService.getSavedSearch(id);
      setLeads(saved.results);
      setSummary(saved.summary);
      if (saved.criteria) {
        setFormData({
          market_sector: saved.criteria.market_sector || '',
          location: saved.criteria.location || '',
          construction_type: saved.criteria.construction_type || '',
          min_value: saved.criteria.min_value,
          max_value: saved.criteria.max_value,
          keywords: saved.criteria.keywords || '',
          additional_criteria: saved.criteria.additional_criteria || '',
        });
      }
      setLastCriteria(saved.criteria);
      setViewingSavedId(id);
      setSelectedLeads(new Set());
      setError('');
      setSuccessMessage(`Loaded search: "${saved.name}"`);
    } catch (err) {
      setError('Failed to load search.');
    }
  };

  const searchMutation = useMutation({
    mutationFn: (criteria: SearchCriteria) => opportunitySearchService.search(criteria),
    onSuccess: async (data, criteria) => {
      setLeads(data.leads);
      setSummary(data.summary);
      setSelectedLeads(new Set());
      setError('');

      // If we're viewing a recurring search, update it with the new results
      if (viewingRecurringId) {
        try {
          await recurringSearchesService.updateResults(viewingRecurringId, {
            resultCount: data.leads.length,
            resultValue: data.summary.total_estimated_value,
            results: data.leads,
          });
          queryClient.invalidateQueries({ queryKey: ['recurring-searches'] });
          setSuccessMessage(`Search completed! Found ${data.leads.length} leads.`);
        } catch (err) {
          console.error('Failed to update recurring search results:', err);
        }
      }
      // Auto-save the search (only if shouldAutoSave is true)
      else if (shouldAutoSave && data.leads.length > 0) {
        try {
          const autoName = generateSearchName(criteria);
          await opportunitySearchService.saveSearch({
            name: autoName,
            criteria,
            results: data.leads,
            summary: data.summary,
          });
          queryClient.invalidateQueries({ queryKey: ['saved-opportunity-searches'] });
        } catch (err) {
          console.error('Failed to auto-save search:', err);
        }
      }

      // Reset shouldAutoSave back to true
      setShouldAutoSave(true);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to search for opportunities. Please try again.');
      setLeads([]);
      setSummary(null);

      // Reset shouldAutoSave back to true even on error
      setShouldAutoSave(true);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'min_value' || name === 'max_value') {
      setFormData(prev => ({ ...prev, [name]: parseFormattedNumber(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setError('');

    const criteria: SearchCriteria = {};
    if (formData.market_sector) criteria.market_sector = formData.market_sector;
    if (formData.location) criteria.location = formData.location;
    if (formData.construction_type) criteria.construction_type = formData.construction_type;
    if (formData.min_value) criteria.min_value = Number(formData.min_value);
    if (formData.max_value) criteria.max_value = Number(formData.max_value);
    if (formData.keywords) criteria.keywords = formData.keywords;
    if (formData.additional_criteria) criteria.additional_criteria = formData.additional_criteria;

    if (Object.keys(criteria).length === 0) {
      setError('Please enter at least one search criteria.');
      return;
    }

    setLastCriteria(criteria);
    setViewingSavedId(null);
    searchMutation.mutate(criteria);
  };

  const handleClear = () => {
    setFormData({
      market_sector: '',
      location: '',
      construction_type: '',
      min_value: undefined,
      max_value: undefined,
      keywords: '',
      additional_criteria: '',
    });
    setLeads([]);
    setSummary(null);
    setSelectedLeads(new Set());
    setError('');
    setSuccessMessage('');
    setViewingSavedId(null);
    setViewingRecurringId(null);
    setViewingRecurringName('');
  };

  const toggleLead = (id: number) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((_, i) => i)));
    }
  };

  const handleAddToPipeline = async () => {
    const selected = leads.filter((_, idx) => selectedLeads.has(idx));
    if (selected.length === 0) return;

    setConverting(true);
    let successCount = 0;

    // Fetch the first pipeline stage for this tenant
    let firstStageId: number | undefined;
    try {
      const stages = await opportunitiesService.getStages();
      if (stages.length > 0) {
        firstStageId = stages[0].id;
      }
    } catch (err) {
      console.error('Failed to fetch pipeline stages:', err);
    }

    for (const lead of selected) {
      try {
        await opportunitiesService.create(mapLeadToOpportunity(lead, firstStageId));
        successCount++;
      } catch (err) {
        console.error('Failed to create opportunity from lead:', lead.project_name, err);
      }
    }

    setConverting(false);
    queryClient.invalidateQueries({ queryKey: ['opportunities'] });

    if (successCount === selected.length) {
      setSuccessMessage(`Successfully added ${successCount} opportunities to the pipeline.`);
    } else {
      setSuccessMessage(`Added ${successCount} of ${selected.length} opportunities. Some failed to create.`);
    }
    setSelectedLeads(new Set());
  };

  return (
    <div className="opp-search-container">
      {/* Header */}
      <div className="opp-search-header">
        <Link to="/sales" className="opp-search-back">&larr; Back to Sales Pipeline</Link>
        <h1>Opportunity Search</h1>
        <div className="opp-search-subtitle">AI-powered lead generation for your sales pipeline</div>
      </div>

      {/* Search Form */}
      <form className="opp-search-form-card" onSubmit={handleSearch}>
        <h3 className="opp-search-form-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Search Criteria
        </h3>

        {/* Viewing Recurring Search Banner */}
        {viewingRecurringId && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '16px 20px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                  Viewing Recurring Search: {viewingRecurringName}
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  Edit the criteria below and click "Search with AI" to run, or close to return to the list
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setViewingRecurringId(null);
                setViewingRecurringName('');
                handleClear();
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
            >
              Close
            </button>
          </div>
        )}

        <div className="opp-search-form-grid">
          <div className="opp-search-form-group">
            <label htmlFor="market_sector">Market Sector</label>
            <select id="market_sector" name="market_sector" value={formData.market_sector || ''} onChange={handleChange}>
              <option value="">All Markets</option>
              {MARKET_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="opp-search-form-group">
            <label htmlFor="construction_type">Construction Type</label>
            <select id="construction_type" name="construction_type" value={formData.construction_type || ''} onChange={handleChange}>
              <option value="">All Types</option>
              {CONSTRUCTION_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="opp-search-form-grid-3">
          <div className="opp-search-form-group">
            <label htmlFor="location">Location / Region</label>
            <input
              type="text"
              id="location"
              name="location"
              placeholder="e.g., Phoenix, AZ metro area"
              value={formData.location || ''}
              onChange={handleChange}
            />
          </div>
          <div className="opp-search-form-group">
            <label htmlFor="min_value">Min Mechanical Value</label>
            <div className="input-prefix">
              <span>$</span>
              <input
                type="text"
                id="min_value"
                name="min_value"
                placeholder="e.g., 500,000"
                value={formatNumberWithCommas(formData.min_value)}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="opp-search-form-group">
            <label htmlFor="max_value">Max Mechanical Value</label>
            <div className="input-prefix">
              <span>$</span>
              <input
                type="text"
                id="max_value"
                name="max_value"
                placeholder="e.g., 5,000,000"
                value={formatNumberWithCommas(formData.max_value)}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="opp-search-form-full">
          <div className="opp-search-form-group">
            <label htmlFor="keywords">Keywords</label>
            <input
              type="text"
              id="keywords"
              name="keywords"
              placeholder="e.g., hospital expansion, medical office, chiller replacement"
              value={formData.keywords || ''}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="opp-search-form-full">
          <div className="opp-search-form-group">
            <label htmlFor="additional_criteria">Additional Criteria</label>
            <textarea
              id="additional_criteria"
              name="additional_criteria"
              placeholder="Any additional context for your search, e.g., 'Looking for projects breaking ground in Q3 2026' or 'Focus on owner-direct opportunities'"
              value={formData.additional_criteria || ''}
              onChange={handleChange}
              rows={2}
            />
          </div>
        </div>

        <div className="opp-search-form-actions">
          <button type="submit" className="sales-btn sales-btn-primary" disabled={searchMutation.isPending}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            {searchMutation.isPending ? 'Searching...' : 'Search with AI'}
          </button>
          {viewingRecurringId && (
            <button
              type="button"
              className="sales-btn sales-btn-primary"
              onClick={() => {
                const criteria: SearchCriteria = {};
                if (formData.market_sector) criteria.market_sector = formData.market_sector;
                if (formData.location) criteria.location = formData.location;
                if (formData.construction_type) criteria.construction_type = formData.construction_type;
                if (formData.min_value) criteria.min_value = Number(formData.min_value);
                if (formData.max_value) criteria.max_value = Number(formData.max_value);
                if (formData.keywords) criteria.keywords = formData.keywords;
                if (formData.additional_criteria) criteria.additional_criteria = formData.additional_criteria;

                updateRecurringMutation.mutate({
                  id: viewingRecurringId,
                  criteria,
                });
              }}
              disabled={updateRecurringMutation.isPending}
              style={{ background: '#059669', borderColor: '#059669' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              {updateRecurringMutation.isPending ? 'Saving...' : 'Save Criteria'}
            </button>
          )}
          <button type="button" className="sales-btn sales-btn-secondary" onClick={handleClear}>
            Clear
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="opp-search-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      )}

      {/* Success */}
      {successMessage && (
        <div className="opp-search-success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          {successMessage}
          <button
            className="sales-btn sales-btn-secondary"
            style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '13px' }}
            onClick={() => navigate('/sales')}
          >
            View Pipeline
          </button>
        </div>
      )}

      {/* Loading */}
      {searchMutation.isPending && (
        <div className="opp-search-loading">
          <div className="opp-search-spinner" />
          <h3>Searching the web for real projects...</h3>
          <p>AI is searching news articles, press releases, permit filings, and bid postings. This may take 30-60 seconds.</p>
        </div>
      )}

      {/* No Results */}
      {!searchMutation.isPending && searchMutation.isSuccess && leads.length === 0 && (
        <div className="opp-search-error" style={{ borderLeftColor: '#f59e0b', background: '#fffbeb' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          No projects found matching your criteria. Try broadening your search — use a wider location, different market sector, or fewer filters.
        </div>
      )}

      {/* Recent Searches */}
      {!searchMutation.isPending && (
        <div className="opp-search-saved-section">
          <h3 className="opp-search-saved-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            Recent Searches
          </h3>

          {savedSearchesQuery.isLoading && (
            <p className="opp-search-saved-loading">Loading recent searches...</p>
          )}

          {savedSearchesQuery.data && savedSearchesQuery.data.length === 0 && (
            <p className="opp-search-saved-empty">No recent searches yet. Run a search and it will appear here automatically.</p>
          )}

          {savedSearchesQuery.data && savedSearchesQuery.data.length > 0 && (
            <>
              {selectedSavedSearches.size > 0 && (
                <div className="opp-search-saved-bulk-actions">
                  <span>{selectedSavedSearches.size} selected</span>
                  <button
                    className="opp-saved-delete-btn"
                    disabled={bulkDeleteMutation.isPending}
                    onClick={async () => {
                      const ok = await confirm({ message: `Delete ${selectedSavedSearches.size} search${selectedSavedSearches.size > 1 ? 'es' : ''}?`, danger: true });
                      if (ok) {
                        const ids = Array.from(selectedSavedSearches);
                        if (viewingSavedId && ids.includes(viewingSavedId)) {
                          setViewingSavedId(null);
                          setLeads([]);
                          setSummary(null);
                        }
                        bulkDeleteMutation.mutate(ids);
                      }
                    }}
                  >
                    {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete Selected'}
                  </button>
                </div>
              )}
              <table className="opp-search-saved-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        checked={savedSearchesQuery.data.length > 0 && selectedSavedSearches.size === savedSearchesQuery.data.length}
                        onChange={() => {
                          if (selectedSavedSearches.size === savedSearchesQuery.data!.length) {
                            setSelectedSavedSearches(new Set());
                          } else {
                            setSelectedSavedSearches(new Set(savedSearchesQuery.data!.map((s: SavedSearchListItem) => s.id)));
                          }
                        }}
                      />
                    </th>
                    <th>Name</th>
                    <th>Date</th>
                    <th>User</th>
                    <th>Leads</th>
                    <th>Est. Value</th>
                    <th>Market</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {savedSearchesQuery.data.map((item: SavedSearchListItem) => (
                    <tr
                      key={item.id}
                      className={`${viewingSavedId === item.id ? 'active' : ''} ${selectedSavedSearches.has(item.id) ? 'selected' : ''}`}
                      onClick={() => handleLoadSaved(item.id)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedSavedSearches.has(item.id)}
                          onChange={() => {
                            setSelectedSavedSearches(prev => {
                              const next = new Set(prev);
                              if (next.has(item.id)) {
                                next.delete(item.id);
                              } else {
                                next.add(item.id);
                              }
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="opp-saved-name">{item.name}</td>
                      <td>{new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}</td>
                      <td>{item.created_by_name || '-'}</td>
                      <td>{item.lead_count}</td>
                      <td>{formatCurrency(Number(item.total_estimated_value))}</td>
                      <td>
                        <span className="opp-search-tag market">
                          {item.criteria?.market_sector || 'All'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="opp-saved-view-btn"
                          onClick={(e) => { e.stopPropagation(); handleLoadSaved(item.id); }}
                          title="View results"
                        >
                          View
                        </button>
                        <button
                          className="opp-saved-view-btn"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await opportunitySearchService.downloadPdf(item.id);
                              setSuccessMessage('PDF downloaded successfully');
                            } catch (err: any) {
                              console.error('PDF download error:', err);

                              // Handle blob error responses
                              let errorMsg = 'Unknown error';
                              if (err.response?.data instanceof Blob) {
                                try {
                                  const text = await err.response.data.text();
                                  const json = JSON.parse(text);
                                  errorMsg = json.error || json.message || text;
                                } catch {
                                  errorMsg = 'Server error (could not parse response)';
                                }
                              } else {
                                errorMsg = err.response?.data?.error || err.message;
                              }
                              setError(`PDF download failed: ${errorMsg}`);
                            }
                          }}
                          title="Download PDF"
                        >
                          PDF
                        </button>
                        <button
                          className="opp-saved-view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRecurringDialogMode('create');
                            setRecurringDialogData({
                              savedSearchId: item.id,
                              name: item.name,
                              description: '',
                            });
                            setRecurringDialogOpen(true);
                          }}
                          title="Save as recurring search for scheduling"
                        >
                          Recurring
                        </button>
                        <button
                          className="opp-saved-delete-btn"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const ok = await confirm({ message: 'Delete this search?', danger: true });
                            if (ok) {
                              deleteSavedMutation.mutate(item.id);
                              if (viewingSavedId === item.id) {
                                setViewingSavedId(null);
                                setLeads([]);
                                setSummary(null);
                              }
                            }
                          }}
                          title="Delete"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* Recurring Searches */}
      {!searchMutation.isPending && (
        <div className="opp-search-saved-section">
          <h3 className="opp-search-saved-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Recurring Searches
          </h3>

          {recurringSearchesQuery.isLoading && (
            <p className="opp-search-saved-loading">Loading recurring searches...</p>
          )}

          {recurringSearchesQuery.data && recurringSearchesQuery.data.length === 0 && (
            <p className="opp-search-saved-empty">No recurring searches yet. Click "Recurring" on a recent search to add it here for scheduling.</p>
          )}

          {recurringSearchesQuery.data && recurringSearchesQuery.data.length > 0 && (
            <table className="opp-search-saved-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Created</th>
                  <th>User</th>
                  <th>Last Run</th>
                  <th>Last Results</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recurringSearchesQuery.data.map((item: RecurringSearch) => (
                  <tr key={item.id}>
                    <td className="opp-saved-name">{item.name}</td>
                    <td>{item.description || '-'}</td>
                    <td>{new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}</td>
                    <td>{item.created_by_name || '-'}</td>
                    <td>{item.last_run_at
                      ? new Date(item.last_run_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })
                      : 'Never'
                    }</td>
                    <td>
                      {item.last_run_at && item.last_result_count > 0
                        ? `${item.last_result_count} leads · ${formatCurrency(item.last_result_value)}`
                        : '-'
                      }
                    </td>
                    <td>
                      <span className={`opp-search-tag ${item.is_active ? 'market' : 'construction'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="opp-saved-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewRecurring(item);
                        }}
                        title="View and edit search criteria"
                      >
                        View
                      </button>
                      <button
                        className="opp-saved-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRecurringDialogMode('edit');
                          setRecurringDialogData({
                            id: item.id,
                            name: item.name,
                            description: item.description || '',
                          });
                          setRecurringDialogOpen(true);
                        }}
                        title="Edit name and description"
                      >
                        Edit
                      </button>
                      <button
                        className="opp-saved-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRerunRecurring(item);
                        }}
                        title="Re-run search and view fresh results"
                        disabled={searchMutation.isPending}
                      >
                        {searchMutation.isPending ? 'Running...' : 'Rerun'}
                      </button>
                      <button
                        className="opp-saved-view-btn"
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await recurringSearchesService.downloadPdf(item.id);
                            setSuccessMessage('PDF downloaded successfully');
                          } catch (err: any) {
                            console.error('Recurring PDF download error:', err);

                            // Handle blob error responses
                            let errorMsg = 'Unknown error';
                            if (err.response?.data instanceof Blob) {
                              try {
                                const text = await err.response.data.text();
                                const json = JSON.parse(text);
                                errorMsg = json.error || json.message || text;
                              } catch {
                                errorMsg = 'Server error (could not parse response)';
                              }
                            } else {
                              errorMsg = err.response?.data?.error || err.message;
                            }
                            setError(`PDF generation failed: ${errorMsg}. Note: This runs a fresh AI search which may take 30-60 seconds.`);
                          }
                        }}
                        title="Download PDF (runs fresh search)"
                      >
                        PDF
                      </button>
                      <button
                        className="opp-saved-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRecurringMutation.mutate(item.id);
                        }}
                        title={item.is_active ? 'Deactivate' : 'Activate'}
                        disabled={toggleRecurringMutation.isPending}
                      >
                        {item.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="opp-saved-delete-btn"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({ message: 'Delete this recurring search?', danger: true });
                          if (ok) {
                            deleteRecurringMutation.mutate(item.id);
                          }
                        }}
                        title="Delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Results */}
      {!searchMutation.isPending && leads.length > 0 && (
        <div>
          {/* Verification warning banner */}
          <div className="opp-search-verification-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <strong>Web-Sourced Projects — Verify Before Acting</strong>
              <p>These projects were found via web search of news articles, press releases, and public filings. Source links are provided where available. Contact information, project values, and timelines should still be independently verified before outreach.</p>
            </div>
          </div>

          <div className="opp-search-results-header">
            <div className="opp-search-results-summary">
              <h2>Results</h2>
              <div className="opp-search-stat">
                <strong>{leads.length}</strong> leads found
              </div>
              {summary && (
                <div className="opp-search-stat">
                  Total value: <strong>{formatCurrency(summary.total_estimated_value)}</strong>
                </div>
              )}
            </div>
            <div className="opp-search-results-actions">
              <label className="opp-search-select-all">
                <input
                  type="checkbox"
                  checked={selectedLeads.size === leads.length && leads.length > 0}
                  onChange={toggleSelectAll}
                />
                Select All
              </label>
              {(viewingSavedId || viewingRecurringId) && (
                <button
                  className="sales-btn sales-btn-secondary"
                  onClick={async () => {
                    try {
                      if (viewingSavedId) {
                        await opportunitySearchService.downloadPdf(viewingSavedId);
                      } else if (viewingRecurringId) {
                        await recurringSearchesService.downloadPdf(viewingRecurringId);
                      }
                      setSuccessMessage('PDF downloaded successfully');
                    } catch (err: any) {
                      console.error('PDF export error:', err);

                      // Handle blob error responses
                      let errorMsg = 'Unknown error';
                      if (err.response?.data instanceof Blob) {
                        try {
                          const text = await err.response.data.text();
                          const json = JSON.parse(text);
                          errorMsg = json.error || json.message || text;
                        } catch {
                          errorMsg = 'Server error (could not parse response)';
                        }
                      } else {
                        errorMsg = err.response?.data?.error || err.message;
                      }
                      setError(`PDF export failed: ${errorMsg}`);
                    }
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export PDF
                </button>
              )}
              <button
                className="sales-btn sales-btn-primary"
                disabled={selectedLeads.size === 0 || converting}
                onClick={handleAddToPipeline}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add {selectedLeads.size > 0 ? `${selectedLeads.size} ` : ''}to Pipeline
              </button>
            </div>
          </div>

          <div className="opp-search-leads-grid">
            {leads.map((lead, idx) => (
              <div
                key={lead.id || idx}
                className={`opp-search-lead-card ${selectedLeads.has(idx) ? 'selected' : ''}`}
              >
                <div className="opp-search-lead-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedLeads.has(idx)}
                    onChange={() => toggleLead(idx)}
                  />
                </div>
                <div className="opp-search-lead-content">
                  <div className="opp-search-lead-header">
                    <div className="opp-search-lead-title-group">
                      <div className="opp-search-lead-company">
                        {lead.company_name}
                        <span className={`opp-search-verification-badge ${lead.verification_status}`}>
                          {lead.verification_status === 'verifiable' ? 'Verifiable' :
                           lead.verification_status === 'suspect' ? 'Suspect' : 'Unverified'}
                        </span>
                      </div>
                      <h3 className="opp-search-lead-project">{lead.project_name}</h3>
                    </div>
                    <div className="opp-search-lead-meta">
                      <div className="opp-search-lead-values">
                        <span className="opp-search-lead-value">
                          {formatCurrency(lead.estimated_value)}
                          {lead.value_is_estimated && <span className="opp-search-est-marker" title="AI estimate — not from published source">~</span>}
                          <span className="opp-search-lead-value-label">Est. Mechanical Value</span>
                        </span>
                        {lead.estimated_total_project_value && (
                          <span className="opp-search-lead-total-value">
                            Total Project: {formatCurrency(lead.estimated_total_project_value)}
                          </span>
                        )}
                      </div>
                      <span className={`opp-search-confidence-badge ${lead.confidence}`}>
                        {lead.confidence}
                      </span>
                    </div>
                  </div>

                  <div className="opp-search-lead-description">{lead.project_description}</div>

                  {/* Tags row */}
                  <div className="opp-search-lead-tags">
                    <span className="opp-search-tag market">{lead.market_sector}</span>
                    <span className="opp-search-tag construction">{lead.construction_type}</span>
                    {lead.project_phase && (
                      <span className="opp-search-tag phase">{lead.project_phase}</span>
                    )}
                    <span className="opp-search-tag location">{lead.location}</span>
                    <span className="opp-search-tag timeline">{lead.timeline}</span>
                    {lead.estimated_start_date && (
                      <span className="opp-search-tag start-date">
                        Start: {new Date(lead.estimated_start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    {lead.square_footage && lead.square_footage !== 'N/A' && (
                      <span className="opp-search-tag sqft">{lead.square_footage}</span>
                    )}
                    {lead.general_contractor && (
                      <span className="opp-search-tag gc">GC: {lead.general_contractor}</span>
                    )}
                  </div>

                  {/* Mechanical Scope */}
                  {lead.mechanical_scope && (
                    <div className="opp-search-lead-section">
                      <div className="opp-search-section-label">Mechanical Scope</div>
                      <div className="opp-search-section-text">{lead.mechanical_scope}</div>
                    </div>
                  )}

                  {/* Intelligence Source */}
                  {lead.intelligence_source && (
                    <div className="opp-search-lead-section source">
                      <div className="opp-search-section-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                        </svg>
                        Intelligence Source
                      </div>
                      <div className="opp-search-section-text">{lead.intelligence_source}</div>
                      {lead.source_url && (
                        <a className="opp-search-source-link" href={lead.source_url} target="_blank" rel="noopener noreferrer">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          View Source
                        </a>
                      )}
                    </div>
                  )}

                  {/* Confidence explanation */}
                  {lead.confidence_explanation && (
                    <div className="opp-search-lead-confidence-detail">
                      <strong>Confidence ({lead.confidence}):</strong> {lead.confidence_explanation}
                    </div>
                  )}

                  {/* Contact & Next Steps row */}
                  <div className="opp-search-lead-bottom">
                    <div className="opp-search-lead-contact">
                      <div className="opp-search-section-label">Contact</div>
                      {lead.contact_name ? (
                        <div className="opp-search-contact-item">
                          <strong>{lead.contact_name}</strong> &middot; {lead.contact_title}
                        </div>
                      ) : (
                        <div className="opp-search-contact-item">
                          Look for: <strong>{lead.contact_title}</strong>
                          <span className="opp-search-needs-research"> (needs research)</span>
                        </div>
                      )}
                      {lead.contact_email && (
                        <div className="opp-search-contact-item">{lead.contact_email}</div>
                      )}
                      {lead.contact_phone && (
                        <div className="opp-search-contact-item">{lead.contact_phone}</div>
                      )}
                      {!lead.contact_name && !lead.contact_email && !lead.contact_phone && (
                        <div className="opp-search-contact-item opp-search-contact-unknown">
                          Contact details not available — research needed
                        </div>
                      )}
                    </div>
                    {lead.next_steps && (
                      <div className="opp-search-lead-next-steps">
                        <div className="opp-search-section-label">Recommended Next Steps</div>
                        <div className="opp-search-section-text">{lead.next_steps}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Converting overlay */}
      {converting && (
        <div className="opp-search-converting">
          <div className="opp-search-converting-card">
            <div className="opp-search-spinner" />
            <h3>Adding to Pipeline...</h3>
            <p>Creating opportunities from selected leads.</p>
          </div>
        </div>
      )}

      {/* Recurring Search Name/Edit Dialog */}
      {recurringDialogOpen && (
        <div className="opp-search-converting">
          <div className="opp-search-save-dialog">
            <h3>{recurringDialogMode === 'create' ? 'Save as Recurring Search' : 'Edit Recurring Search'}</h3>
            <p>{recurringDialogMode === 'create' ? 'Give this search a name and description for scheduling.' : 'Update the name and description for this recurring search.'}</p>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Name
            </label>
            <input
              type="text"
              placeholder="e.g., Green Bay Data Centers"
              value={recurringDialogData.name}
              onChange={(e) => setRecurringDialogData(prev => ({ ...prev, name: e.target.value }))}
              autoFocus
            />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', marginTop: '12px' }}>
              Description (Optional)
            </label>
            <textarea
              placeholder="e.g., Weekly search for data center projects in Green Bay area"
              value={recurringDialogData.description}
              onChange={(e) => setRecurringDialogData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />

            <div className="opp-search-save-dialog-actions">
              <button
                className="sales-btn sales-btn-secondary"
                onClick={() => {
                  setRecurringDialogOpen(false);
                  setRecurringDialogData({ name: '', description: '' });
                }}
              >
                Cancel
              </button>
              <button
                className="sales-btn sales-btn-primary"
                onClick={() => {
                  if (!recurringDialogData.name.trim()) {
                    setError('Please enter a name for the recurring search');
                    return;
                  }
                  if (recurringDialogMode === 'create' && recurringDialogData.savedSearchId) {
                    saveAsRecurringMutation.mutate({
                      savedSearchId: recurringDialogData.savedSearchId,
                      name: recurringDialogData.name.trim(),
                      description: recurringDialogData.description.trim(),
                    });
                  } else if (recurringDialogMode === 'edit' && recurringDialogData.id) {
                    updateRecurringMutation.mutate({
                      id: recurringDialogData.id,
                      name: recurringDialogData.name.trim(),
                      description: recurringDialogData.description.trim(),
                    });
                  }
                }}
                disabled={saveAsRecurringMutation.isPending || updateRecurringMutation.isPending}
              >
                {saveAsRecurringMutation.isPending || updateRecurringMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OpportunitySearch;
