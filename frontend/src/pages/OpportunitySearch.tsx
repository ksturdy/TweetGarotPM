import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitySearchService, { SearchCriteria, GeneratedLead, SearchSummary } from '../services/opportunitySearch';
import opportunitiesService from '../services/opportunities';
import '../styles/SalesPipeline.css';
import '../styles/OpportunitySearch.css';

const MARKET_OPTIONS = [
  'Healthcare', 'Education', 'Commercial', 'Industrial',
  'Retail', 'Government', 'Hospitality', 'Data Center'
];

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

function mapLeadToOpportunity(lead: GeneratedLead) {
  const contactBlock = [
    '',
    '---',
    `Contact: ${lead.contact_name}, ${lead.contact_title}`,
    `Email: ${lead.contact_email} | Phone: ${lead.contact_phone}`,
    `AI Confidence: ${lead.confidence.charAt(0).toUpperCase() + lead.confidence.slice(1)} | Timeline: ${lead.timeline}`,
    `Reasoning: ${lead.reasoning}`,
    lead.info_url ? `More Info: ${lead.info_url}` : '',
  ].filter(Boolean).join('\n');

  return {
    title: lead.project_name,
    description: (lead.project_description + contactBlock),
    estimated_value: lead.estimated_value,
    construction_type: lead.construction_type,
    market: lead.market_sector,
    location: lead.location,
    owner: lead.company_name,
    general_contractor: lead.general_contractor || '',
    estimated_start_date: lead.estimated_start_date || '',
    source: 'ai_search',
    stage_id: 1,
    priority: 'medium' as const,
  };
}

const OpportunitySearch: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const searchMutation = useMutation({
    mutationFn: (criteria: SearchCriteria) => opportunitySearchService.search(criteria),
    onSuccess: (data) => {
      setLeads(data.leads);
      setSummary(data.summary);
      setSelectedLeads(new Set());
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to search for opportunities. Please try again.');
      setLeads([]);
      setSummary(null);
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

    for (const lead of selected) {
      try {
        await opportunitiesService.create(mapLeadToOpportunity(lead));
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
            <label htmlFor="min_value">Min Project Value</label>
            <div className="input-prefix">
              <span>$</span>
              <input
                type="number"
                id="min_value"
                name="min_value"
                placeholder="e.g., 500000"
                value={formData.min_value || ''}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="opp-search-form-group">
            <label htmlFor="max_value">Max Project Value</label>
            <div className="input-prefix">
              <span>$</span>
              <input
                type="number"
                id="max_value"
                name="max_value"
                placeholder="e.g., 5000000"
                value={formData.max_value || ''}
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
          <h3>Searching for opportunities...</h3>
          <p>AI is analyzing market data and generating leads. This may take 15-30 seconds.</p>
        </div>
      )}

      {/* Results */}
      {!searchMutation.isPending && leads.length > 0 && (
        <div>
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
                      <div className="opp-search-lead-company">{lead.company_name}</div>
                      <h3 className="opp-search-lead-project">{lead.project_name}</h3>
                    </div>
                    <div className="opp-search-lead-meta">
                      <span className="opp-search-lead-value">{formatCurrency(lead.estimated_value)}</span>
                      <span className={`opp-search-confidence-badge ${lead.confidence}`}>
                        {lead.confidence}
                      </span>
                    </div>
                  </div>

                  <div className="opp-search-lead-description">{lead.project_description}</div>

                  <div className="opp-search-lead-tags">
                    <span className="opp-search-tag market">{lead.market_sector}</span>
                    <span className="opp-search-tag construction">{lead.construction_type}</span>
                    <span className="opp-search-tag location">{lead.location}</span>
                    <span className="opp-search-tag timeline">{lead.timeline}</span>
                    {lead.estimated_start_date && (
                      <span className="opp-search-tag start-date">
                        Start: {new Date(lead.estimated_start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    {lead.general_contractor && (
                      <span className="opp-search-tag gc">GC: {lead.general_contractor}</span>
                    )}
                  </div>

                  <div className="opp-search-lead-contact">
                    <div className="opp-search-contact-item">
                      <strong>{lead.contact_name}</strong> &middot; {lead.contact_title}
                    </div>
                    <div className="opp-search-contact-item">{lead.contact_email}</div>
                    <div className="opp-search-contact-item">{lead.contact_phone}</div>
                  </div>

                  <div className="opp-search-lead-reasoning">{lead.reasoning}</div>

                  {lead.info_url && (
                    <div className="opp-search-lead-link">
                      <a href={lead.info_url} target="_blank" rel="noopener noreferrer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        More Information
                      </a>
                    </div>
                  )}
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
    </div>
  );
};

export default OpportunitySearch;
