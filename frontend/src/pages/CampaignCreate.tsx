import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  createCampaign,
  addTeamMember,
  bulkCreateCampaignCompanies,
  generateCampaign,
  getTeamEligibleEmployees,
  TeamEligibleEmployee
} from '../services/campaigns';
import SearchableSelect from '../components/SearchableSelect';
import '../styles/SalesPipeline.css';

interface ProspectEntry {
  id: number;
  name: string;
  sector: string;
  address: string;
  phone: string;
  tier: 'A' | 'B' | 'C';
  score: number;
}

interface TeamMemberEntry {
  employeeId: number;
  name: string;
  email: string;
  jobTitle: string | null;
  role: 'owner' | 'member' | 'viewer';
}

export default function CampaignCreate() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Campaign Info
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Step 2: Team
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberEntry[]>([]);
  const [teamSearch, setTeamSearch] = useState('');

  // Step 3: Goals
  const [targetTouchpoints, setTargetTouchpoints] = useState(0);
  const [targetOpportunities, setTargetOpportunities] = useState(0);
  const [targetEstimates, setTargetEstimates] = useState(0);
  const [targetAwards, setTargetAwards] = useState(0);
  const [targetPipelineValue, setTargetPipelineValue] = useState(0);
  const [goalDescription, setGoalDescription] = useState('');

  // Step 4: Prospects
  const [prospects, setProspects] = useState<ProspectEntry[]>([]);
  const [nextProspectId, setNextProspectId] = useState(1);
  const [newProspect, setNewProspect] = useState<Omit<ProspectEntry, 'id'>>({
    name: '', sector: '', address: '', phone: '', tier: 'B', score: 70
  });
  const [csvText, setCsvText] = useState('');
  const [showCsvImport, setShowCsvImport] = useState(false);

  // Fetch all active employees from the employee directory via campaigns endpoint
  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['campaign-team-eligible'],
    queryFn: getTeamEligibleEmployees
  });

  const ownerOptions = employees.map(emp => ({
    value: emp.id.toString(),
    label: `${emp.first_name} ${emp.last_name}${emp.job_title ? ` - ${emp.job_title}` : ''}`
  }));

  // Filter team members by search
  const filteredEmployees = employees.filter(emp => {
    if (!teamSearch) return true;
    const search = teamSearch.toLowerCase();
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    return fullName.includes(search) ||
      (emp.job_title?.toLowerCase().includes(search)) ||
      (emp.department_name?.toLowerCase().includes(search)) ||
      emp.email.toLowerCase().includes(search);
  });

  const steps = [
    { num: 1, label: 'Campaign Info' },
    { num: 2, label: 'Team Setup' },
    { num: 3, label: 'Goals' },
    { num: 4, label: 'Prospects' },
    { num: 5, label: 'Review & Create' }
  ];

  const calculateWeeks = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return campaignName.trim() && startDate && endDate && new Date(endDate) > new Date(startDate);
      case 2: return ownerId !== null && teamMembers.length > 0;
      case 3: return true;
      case 4: return prospects.length > 0;
      case 5: return true;
      default: return false;
    }
  };

  // Handle owner change - ownerId is now employee.id
  useEffect(() => {
    if (ownerId !== null) {
      const emp = employees.find(e => e.id === ownerId);
      if (emp) {
        setTeamMembers(prev => {
          const withoutOldOwner = prev.filter(m => m.role !== 'owner');
          return [{
            employeeId: emp.id,
            name: `${emp.first_name} ${emp.last_name}`,
            email: emp.email,
            jobTitle: emp.job_title,
            role: 'owner' as const
          }, ...withoutOldOwner];
        });
      }
    }
  }, [ownerId, employees]);

  const toggleTeamMember = (emp: TeamEligibleEmployee) => {
    if (emp.id === ownerId) return; // Owner can't be toggled
    setTeamMembers(prev => {
      const existing = prev.find(m => m.employeeId === emp.id);
      if (existing) {
        return prev.filter(m => m.employeeId !== emp.id);
      } else {
        return [...prev, {
          employeeId: emp.id,
          name: `${emp.first_name} ${emp.last_name}`,
          email: emp.email,
          jobTitle: emp.job_title,
          role: 'member' as const
        }];
      }
    });
  };

  const addProspect = () => {
    if (!newProspect.name.trim()) return;
    setProspects(prev => [...prev, { ...newProspect, id: nextProspectId }]);
    setNextProspectId(prev => prev + 1);
    setNewProspect({ name: '', sector: '', address: '', phone: '', tier: 'B', score: 70 });
  };

  const removeProspect = (id: number) => {
    setProspects(prev => prev.filter(p => p.id !== id));
  };

  const parseCsvImport = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split('\n');
    const newProspects: ProspectEntry[] = [];
    for (const line of lines) {
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length >= 1 && parts[0].trim()) {
        newProspects.push({
          id: nextProspectId + newProspects.length,
          name: parts[0]?.trim() || '',
          sector: parts[1]?.trim() || '',
          address: parts[2]?.trim() || '',
          phone: parts[3]?.trim() || '',
          tier: (['A', 'B', 'C'].includes(parts[4]?.trim().toUpperCase()) ? parts[4].trim().toUpperCase() : 'B') as 'A' | 'B' | 'C',
          score: parseInt(parts[5]?.trim()) || 70
        });
      }
    }
    if (newProspects.length > 0) {
      setProspects(prev => [...prev, ...newProspects]);
      setNextProspectId(prev => prev + newProspects.length);
      setCsvText('');
      setShowCsvImport(false);
    }
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const campaign = await createCampaign({
        name: campaignName,
        description: campaignDescription,
        start_date: startDate,
        end_date: endDate,
        status: 'planning',
        owner_id: ownerId!,
        total_targets: prospects.length,
        target_touchpoints: targetTouchpoints,
        target_opportunities: targetOpportunities,
        target_estimates: targetEstimates,
        target_awards: targetAwards,
        target_pipeline_value: targetPipelineValue,
        goal_description: goalDescription
      } as any);

      for (const member of teamMembers) {
        await addTeamMember(campaign.id, member.employeeId, member.role);
      }

      if (prospects.length > 0) {
        await bulkCreateCampaignCompanies(campaign.id, prospects.map(p => ({
          name: p.name,
          sector: p.sector,
          address: p.address,
          phone: p.phone,
          tier: p.tier,
          score: p.score
        })));
      }

      await generateCampaign(campaign.id);
      navigate(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create campaign');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="sales-container" style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <h1 style={{ fontSize: '24px' }}>Create New Campaign</h1>
            <div className="sales-subtitle">Set up your sales campaign in a few steps</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="sales-btn sales-btn-secondary" onClick={() => navigate('/campaigns')}>
            Cancel
          </button>
        </div>
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '28px' }}>
        {steps.map(step => {
          const isActive = currentStep === step.num;
          const isCompleted = currentStep > step.num;
          return (
            <div
              key={step.num}
              onClick={() => step.num < currentStep && setCurrentStep(step.num)}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '12px 8px',
                borderRadius: '8px',
                background: isActive
                  ? 'var(--gradient-1)'
                  : isCompleted
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'var(--bg-dark)',
                color: isActive
                  ? '#fff'
                  : isCompleted
                    ? 'var(--accent-emerald)'
                    : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: step.num < currentStep ? 'pointer' : 'default',
                transition: 'all 0.2s',
                border: isActive ? 'none' : '1px solid var(--border)'
              }}
            >
              {isCompleted ? '\u2713 ' : ''}{step.num}. {step.label}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '12px',
          color: '#ef4444',
          marginBottom: '20px',
          fontSize: '13px',
          fontWeight: 500
        }}>
          {error}
        </div>
      )}

      {/* Step 1: Campaign Info */}
      {currentStep === 1 && (
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">Campaign Information</div>
              <div className="sales-chart-subtitle">Basic details about your sales campaign</div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Campaign Name *</label>
              <input
                type="text"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                style={inputStyle}
                placeholder="e.g., Phoenix Division - 6 Week Campaign"
              />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={campaignDescription}
                onChange={e => setCampaignDescription(e.target.value)}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                placeholder="Describe the campaign goals and target market..."
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Start Date *</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>End Date *</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
              </div>
            </div>
            {startDate && endDate && new Date(endDate) > new Date(startDate) && (
              <div style={{
                padding: '14px 18px',
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                borderRadius: '10px',
                fontSize: '13px',
                color: 'var(--accent-blue)',
                fontWeight: 500
              }}>
                Campaign Duration: <strong>{calculateWeeks()} weeks</strong> ({new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()})
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Team Setup */}
      {currentStep === 2 && (
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">Team Setup</div>
              <div className="sales-chart-subtitle">Select the campaign owner and team members</div>
            </div>
          </div>

          {employeesLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading employees...
            </div>
          ) : employees.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              No active employees found in the employee directory.
            </div>
          ) : (
            <>
              {/* Owner Selection */}
              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Campaign Owner *</label>
                <SearchableSelect
                  options={ownerOptions}
                  value={ownerId?.toString() || ''}
                  onChange={(val) => setOwnerId(val ? parseInt(val) : null)}
                  placeholder="Search and select owner..."
                  style={{ width: '100%' }}
                />
              </div>

              {/* Team Members */}
              <div>
                <label style={labelStyle}>Team Members</label>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', marginTop: 0 }}>
                  Select employees from the directory to participate in this campaign.
                </p>

                {/* Search box for team members */}
                <div className="sales-search-box" style={{ marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>&#128269;</span>
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    placeholder="Search team members..."
                  />
                </div>

                <div style={{ display: 'grid', gap: '6px', maxHeight: '360px', overflowY: 'auto', padding: '2px' }}>
                  {filteredEmployees.map(emp => {
                    const isOwner = emp.id === ownerId;
                    const isSelected = teamMembers.some(m => m.employeeId === emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => !isOwner && toggleTeamMember(emp)}
                        style={{
                          padding: '12px 16px',
                          background: isSelected
                            ? isOwner ? 'rgba(59, 130, 246, 0.06)' : 'rgba(16, 185, 129, 0.06)'
                            : 'var(--bg-dark)',
                          border: '1px solid ' + (isSelected
                            ? isOwner ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'
                            : 'var(--border)'),
                          borderRadius: '10px',
                          cursor: isOwner ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '6px',
                            border: '2px solid ' + (isSelected ? 'var(--accent-blue)' : 'var(--border)'),
                            background: isSelected ? 'var(--accent-blue)' : '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0
                          }}>
                            {isSelected && '\u2713'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                              {emp.first_name} {emp.last_name}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {emp.job_title || emp.email}{emp.department_name ? ` \u00b7 ${emp.department_name}` : ''}
                            </div>
                          </div>
                        </div>
                        {isOwner && (
                          <span className="sales-stage-badge opportunity-received" style={{ fontSize: '11px', padding: '3px 10px' }}>
                            Owner
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {filteredEmployees.length === 0 && teamSearch && (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No employees matching "{teamSearch}"
                    </div>
                  )}
                </div>
              </div>

              {teamMembers.length > 0 && (
                <div style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: 'var(--accent-blue)',
                  fontWeight: 500
                }}>
                  <strong>{teamMembers.length}</strong> team member{teamMembers.length !== 1 ? 's' : ''} selected
                  ({teamMembers.filter(m => m.role === 'owner').length} owner, {teamMembers.filter(m => m.role === 'member').length} members)
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Goals */}
      {currentStep === 3 && (
        <div className="sales-chart-card">
          <div className="sales-chart-header">
            <div>
              <div className="sales-chart-title">Campaign Goals</div>
              <div className="sales-chart-subtitle">Set targets for what this campaign should achieve</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Target Touchpoints</label>
              <input
                type="number"
                min="0"
                value={targetTouchpoints || ''}
                onChange={e => setTargetTouchpoints(parseInt(e.target.value) || 0)}
                style={inputStyle}
                placeholder="e.g., 40"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Number of prospects to contact</span>
            </div>
            <div>
              <label style={labelStyle}>Target Opportunities</label>
              <input
                type="number"
                min="0"
                value={targetOpportunities || ''}
                onChange={e => setTargetOpportunities(parseInt(e.target.value) || 0)}
                style={inputStyle}
                placeholder="e.g., 5"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>New opportunities to identify</span>
            </div>
            <div>
              <label style={labelStyle}>Target Estimates</label>
              <input
                type="number"
                min="0"
                value={targetEstimates || ''}
                onChange={e => setTargetEstimates(parseInt(e.target.value) || 0)}
                style={inputStyle}
                placeholder="e.g., 3"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Estimates to generate</span>
            </div>
            <div>
              <label style={labelStyle}>Target Awards</label>
              <input
                type="number"
                min="0"
                value={targetAwards || ''}
                onChange={e => setTargetAwards(parseInt(e.target.value) || 0)}
                style={inputStyle}
                placeholder="e.g., 1"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Projects to win</span>
            </div>
            <div>
              <label style={labelStyle}>Target Pipeline Value ($)</label>
              <input
                type="number"
                min="0"
                value={targetPipelineValue || ''}
                onChange={e => setTargetPipelineValue(parseInt(e.target.value) || 0)}
                style={inputStyle}
                placeholder="e.g., 500000"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Total pipeline value goal</span>
            </div>
          </div>
          <div style={{ marginTop: '20px' }}>
            <label style={labelStyle}>Goal Description</label>
            <textarea
              value={goalDescription}
              onChange={e => setGoalDescription(e.target.value)}
              style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
              placeholder="e.g., Contact 40 high-value prospects and generate 5+ new opportunities"
            />
          </div>
        </div>
      )}

      {/* Step 4: Prospects */}
      {currentStep === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Add prospect form */}
          <div className="sales-chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div className="sales-chart-title">Add Prospects</div>
                <div className="sales-chart-subtitle">Build your target list of companies</div>
              </div>
              <button
                className={`sales-btn ${showCsvImport ? 'sales-btn-secondary' : 'sales-btn-primary'}`}
                onClick={() => setShowCsvImport(!showCsvImport)}
              >
                {showCsvImport ? 'Manual Entry' : 'Import CSV / Paste'}
              </button>
            </div>

            {!showCsvImport ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Company Name *</label>
                    <input type="text" value={newProspect.name} onChange={e => setNewProspect({ ...newProspect, name: e.target.value })} style={inputStyle} placeholder="e.g., ABC Manufacturing" />
                  </div>
                  <div>
                    <label style={labelStyle}>Sector / Industry</label>
                    <input type="text" value={newProspect.sector} onChange={e => setNewProspect({ ...newProspect, sector: e.target.value })} style={inputStyle} placeholder="e.g., Food Processing" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Address</label>
                    <input type="text" value={newProspect.address} onChange={e => setNewProspect({ ...newProspect, address: e.target.value })} style={inputStyle} placeholder="e.g., 123 Main St, Phoenix, AZ" />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input type="text" value={newProspect.phone} onChange={e => setNewProspect({ ...newProspect, phone: e.target.value })} style={inputStyle} placeholder="(480) 555-0100" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>Tier</label>
                    <select value={newProspect.tier} onChange={e => setNewProspect({ ...newProspect, tier: e.target.value as 'A' | 'B' | 'C' })} style={inputStyle}>
                      <option value="A">A - High Priority</option>
                      <option value="B">B - Medium Priority</option>
                      <option value="C">C - Lower Priority</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Score (0-100)</label>
                    <input type="number" min="0" max="100" value={newProspect.score} onChange={e => setNewProspect({ ...newProspect, score: parseInt(e.target.value) || 70 })} style={inputStyle} />
                  </div>
                </div>
                <button
                  className="sales-btn sales-btn-primary"
                  onClick={addProspect}
                  disabled={!newProspect.name.trim()}
                  style={{ opacity: newProspect.name.trim() ? 1 : 0.5, width: 'fit-content' }}
                >
                  + Add Prospect
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                  Paste data with columns: <strong>Name, Sector, Address, Phone, Tier (A/B/C), Score (0-100)</strong><br />
                  Supports comma-separated or tab-separated values. One company per line.
                </p>
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  style={{ ...inputStyle, minHeight: '150px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                  placeholder={"SK Food Group,Food Processing,790 S. 75th Ave Tolleson AZ,206-935-8100,A,90\nMicrochip Technology,Semiconductor,2355 W. Chandler Blvd Chandler AZ,480-792-7200,A,88"}
                />
                <button
                  className="sales-btn sales-btn-primary"
                  onClick={parseCsvImport}
                  disabled={!csvText.trim()}
                  style={{ opacity: csvText.trim() ? 1 : 0.5, width: 'fit-content' }}
                >
                  Import {csvText.trim() ? `(${csvText.trim().split('\n').length} rows)` : ''}
                </button>
              </div>
            )}
          </div>

          {/* Prospects table */}
          <div className="sales-table-section">
            <div className="sales-table-header">
              <div className="sales-table-title">Prospects List ({prospects.length})</div>
            </div>
            {prospects.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No prospects added yet. Add them manually above or import from CSV.
              </div>
            ) : (
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Sector</th>
                    <th>Address</th>
                    <th>Phone</th>
                    <th style={{ textAlign: 'center' }}>Tier</th>
                    <th style={{ textAlign: 'center' }}>Score</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.sector}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.phone}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`sales-stage-badge ${p.tier === 'A' ? 'awarded' : p.tier === 'B' ? 'quoted' : 'lead'}`}>
                          {p.tier}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.score}</td>
                      <td>
                        <button
                          onClick={() => removeProspect(p.id)}
                          className="sales-action-btn"
                          style={{ color: 'var(--accent-rose)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          title="Remove"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Step 5: Review & Create */}
      {currentStep === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="sales-chart-card">
            <div className="sales-chart-header">
              <div>
                <div className="sales-chart-title">Review Campaign</div>
                <div className="sales-chart-subtitle">Verify your campaign details before creating</div>
              </div>
            </div>

            <div className="sales-kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '20px' }}>
              {/* Campaign Info */}
              <div className="sales-kpi-card blue">
                <div className="sales-kpi-label">Campaign</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{campaignName}</div>
                {campaignDescription && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{campaignDescription}</div>}
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()} ({calculateWeeks()} weeks)
                </div>
              </div>

              {/* Team */}
              <div className="sales-kpi-card green">
                <div className="sales-kpi-label">Team ({teamMembers.length})</div>
                {teamMembers.map(m => (
                  <div key={m.employeeId} style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {m.name}
                    {m.role === 'owner' && (
                      <span className="sales-stage-badge opportunity-received" style={{ fontSize: '10px', padding: '2px 8px' }}>Owner</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Goals */}
              <div className="sales-kpi-card amber">
                <div className="sales-kpi-label">Goals</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '13px', color: 'var(--text-primary)' }}>
                  <div>Touchpoints: <strong>{targetTouchpoints}</strong></div>
                  <div>Opportunities: <strong>{targetOpportunities}</strong></div>
                  <div>Estimates: <strong>{targetEstimates}</strong></div>
                  <div>Awards: <strong>{targetAwards}</strong></div>
                </div>
                {targetPipelineValue > 0 && (
                  <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-primary)' }}>
                    Pipeline: <strong>${targetPipelineValue.toLocaleString()}</strong>
                  </div>
                )}
              </div>

              {/* Prospects */}
              <div className="sales-kpi-card purple">
                <div className="sales-kpi-label">Prospects ({prospects.length})</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', fontSize: '13px', color: 'var(--text-primary)' }}>
                  <div>A-Tier: <strong>{prospects.filter(p => p.tier === 'A').length}</strong></div>
                  <div>B-Tier: <strong>{prospects.filter(p => p.tier === 'B').length}</strong></div>
                  <div>C-Tier: <strong>{prospects.filter(p => p.tier === 'C').length}</strong></div>
                </div>
                <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  ~{Math.ceil(prospects.length / Math.max(teamMembers.length, 1))} prospects per team member
                </div>
              </div>
            </div>

            <div style={{
              padding: '16px 20px',
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '12px',
              fontSize: '13px',
              color: 'var(--text-secondary)'
            }}>
              When you create this campaign, the system will automatically:
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.8' }}>
                <li>Generate <strong>{calculateWeeks()}</strong> weekly periods</li>
                <li>Distribute prospects across team members (A-tier first, then B-tier)</li>
                <li>Assign prospects to weeks based on priority</li>
                <li>Set up goal tracking on the campaign dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
        <button
          className="sales-btn sales-btn-secondary"
          onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
          style={{ visibility: currentStep > 1 ? 'visible' : 'hidden' }}
        >
          &larr; Back
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          {currentStep < 5 ? (
            <button
              className="sales-btn sales-btn-primary"
              onClick={() => canProceed() && setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
              style={{ opacity: canProceed() ? 1 : 0.5 }}
            >
              Next &rarr;
            </button>
          ) : (
            <button
              className="sales-btn sales-btn-primary"
              onClick={handleCreate}
              disabled={isSubmitting}
              style={{ opacity: isSubmitting ? 0.6 : 1, padding: '12px 28px', fontSize: '15px' }}
            >
              {isSubmitting ? 'Creating Campaign...' : 'Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared inline styles for form elements
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  marginBottom: '6px',
  color: 'var(--text-primary)',
  letterSpacing: '0.3px'
};

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  background: 'var(--bg-card)',
  width: '100%',
  color: 'var(--text-primary)',
  transition: 'border-color 0.2s'
};
