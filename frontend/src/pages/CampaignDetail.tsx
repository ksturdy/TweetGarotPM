import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { Opportunity as OpportunityType } from '../services/opportunities';
import OpportunityModal from '../components/opportunities/OpportunityModal';
import AssessmentScoring from '../components/assessments/AssessmentScoring';
import { assessmentsApi } from '../services/assessments';
import {
  getCampaign, updateCampaign,
  getCampaignCompanies, getCampaignWeeks, getCampaignTeam, getCampaignActivity,
  createCampaignCompany, updateCampaignCompanyStatus, updateCampaignCompanyAction, updateCampaignCompanyAssignment,
  addCampaignNote, getTeamEligibleEmployees, downloadCampaignReport, regenerateCampaignWeeks,
  addTeamMember, removeTeamMember, reassignCompanies,
  getCampaignCompanyAssessment, deleteCampaignCompany,
  CampaignCompany, CampaignWeek, CampaignTeamMember, CampaignActivityLog, TeamEligibleEmployee
} from '../services/campaigns';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import '../styles/SalesPipeline.css';

const statuses = [
  { key: 'prospect', label: 'Prospect', color: '#6b7280' },
  { key: 'no_interest', label: 'Contacted - No Interest', color: '#ef4444' },
  { key: 'follow_up', label: 'Contacted - Follow Up', color: '#f59e0b' },
  { key: 'new_opp', label: 'Contacted - New Opportunity', color: '#10b981' },
  { key: 'dead', label: 'Dead Lead', color: '#94a3b8' }
];

const actions = [
  { key: 'none', label: 'Select Action', color: '#6b7280' },
  { key: 'follow_30', label: 'Follow Up in 30 Days', color: '#3b82f6' },
  { key: 'opp_incoming', label: 'Opportunity Incoming', color: '#10b981' },
  { key: 'no_follow', label: 'No Follow Up Necessary', color: '#94a3b8' }
];

const estimateStatuses = [
  { key: 'draft', label: 'Draft', color: '#6b7280' },
  { key: 'pending', label: 'Pending Review', color: '#f59e0b' },
  { key: 'sent', label: 'Sent', color: '#3b82f6' },
  { key: 'accepted', label: 'Accepted', color: '#10b981' },
  { key: 'declined', label: 'Declined', color: '#ef4444' }
];


export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contacts, setContacts] = useState<any[]>([]);
  const [estimates, setEstimates] = useState<any[]>([]);
  const [deletingProspect, setDeletingProspect] = useState<any>(null);

  // Fetch pipeline stages from database
  const { data: pipelineStages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => opportunitiesService.getStages()
  });

  // Fetch real opportunities from database filtered by campaign_id
  const { data: opportunities = [], isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useQuery({
    queryKey: ['campaign-opportunities', id],
    queryFn: async () => {
      const allOpportunities = await opportunitiesService.getAll();
      return allOpportunities.filter(opp => opp.campaign_id === parseInt(id || '0'));
    },
    enabled: !!id
  });

  // Database queries for non-legacy campaigns
  const campaignId = parseInt(id || '0');
  const queryClient = useQueryClient();

  const { data: dbCampaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => getCampaign(campaignId),
    enabled: campaignId > 0
  });

  const { data: dbCompanies = [] } = useQuery({
    queryKey: ['campaign-companies', campaignId],
    queryFn: () => getCampaignCompanies(campaignId),
    enabled: campaignId > 0
  });

  const { data: dbWeeks = [] } = useQuery({
    queryKey: ['campaign-weeks', campaignId],
    queryFn: () => getCampaignWeeks(campaignId),
    enabled: campaignId > 0
  });

  const { data: dbTeam = [] } = useQuery({
    queryKey: ['campaign-team', campaignId],
    queryFn: () => getCampaignTeam(campaignId),
    enabled: campaignId > 0
  });

  const { data: dbActivity = [] } = useQuery({
    queryKey: ['campaign-activity', campaignId],
    queryFn: () => getCampaignActivity(campaignId, 100),
    enabled: campaignId > 0
  });

  // Fetch assessments for all campaign companies to show TG Cust. Score
  const { data: assessmentsMap = {} } = useQuery({
    queryKey: ['campaign-assessments', id],
    queryFn: async () => {
      const map: Record<number, number> = {};
      const cid = parseInt(id || '0');
      const companies = dbCompanies;
      for (const company of companies) {
        try {
          const assessment = await getCampaignCompanyAssessment(cid, company.id);
          if (assessment) {
            map[company.id] = assessment.total_score;
          }
        } catch (error) {
          // Company doesn't have an assessment yet
        }
      }
      return map;
    },
    enabled: !!id && dbCompanies.length > 0,
    staleTime: 30000,
  });

  // Unified data accessors
  const activeData = useMemo(() => {
    return dbCompanies.map((c: CampaignCompany) => ({
      id: c.id, name: c.name, sector: c.sector || '', score: c.score, tier: c.tier,
      assignedTo: c.assigned_to_name || 'Unassigned', assigned_to_id: c.assigned_to_id,
      address: c.address || '', phone: c.phone || '',
      status: c.status, action: c.next_action, targetWeek: c.target_week,
      source: c.source || 'seed'
    }));
  }, [dbCompanies]);

  const activeWeeks = useMemo(() => {
    return dbWeeks.map((w: CampaignWeek) => ({
      num: w.week_number,
      start: new Date(w.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      end: new Date(w.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      label: w.label || `Week ${w.week_number}`
    }));
  }, [dbWeeks]);

  // DB mutations
  const statusMutation = useMutation({
    mutationFn: ({ companyId, status }: { companyId: number; status: string }) =>
      updateCampaignCompanyStatus(campaignId, companyId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-activity', campaignId] });
    }
  });

  const actionMutation = useMutation({
    mutationFn: ({ companyId, action }: { companyId: number; action: string }) =>
      updateCampaignCompanyAction(campaignId, companyId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-activity', campaignId] });
    }
  });

  const assignMutation = useMutation({
    mutationFn: ({ companyId, assignedToId }: { companyId: number; assignedToId: number }) =>
      updateCampaignCompanyAssignment(campaignId, companyId, assignedToId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-activity', campaignId] });
    }
  });

  const addProspectMutation = useMutation({
    mutationFn: (prospectData: any) => createCampaignCompany(campaignId, prospectData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
    },
    onError: (error: any) => {
      console.error('Failed to add prospect:', error);
      alert(error.response?.data?.error || 'Failed to add prospect');
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: ({ companyId, note }: { companyId: number; note: string }) =>
      addCampaignNote(campaignId, companyId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-activity', campaignId] });
    }
  });

  const updateCampaignMutation = useMutation({
    mutationFn: (data: any) => updateCampaign(campaignId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-team', campaignId] });
    }
  });

  const deleteProspectMutation = useMutation({
    mutationFn: (companyId: number) => deleteCampaignCompany(campaignId, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-activity', campaignId] });
      setDeletingProspect(null);
      setDetailView(null);
      setSelected(null);
    }
  });

  // Check if current user is the campaign owner
  const isOwner = useMemo(() => {
    if (!user || !dbTeam.length) return false;
    return dbTeam.some((t: CampaignTeamMember) => t.role === 'owner' && t.user_id === user.id);
  }, [user, dbTeam]);

  // Fetch employees for team management (all campaigns)
  const { data: editEmployees = [] } = useQuery({
    queryKey: ['campaign-team-eligible'],
    queryFn: getTeamEligibleEmployees
  });

  // Edit form state (separate from activeCampaignInfo to avoid mutating display data)
  const [editForm, setEditForm] = useState<any>(null);

  const openEditModal = () => {
    setEditForm({
      name: dbCampaign?.name || '',
      description: dbCampaign?.description || '',
      startDate: dbCampaign?.start_date?.slice(0, 10) || '',
      endDate: dbCampaign?.end_date?.slice(0, 10) || '',
      goal: dbCampaign?.goal_description || '',
      targetValue: dbCampaign?.target_pipeline_value || 0,
      status: dbCampaign?.status || 'planning',
      ownerId: dbCampaign?.owner_id || null,
      targetTouchpoints: dbCampaign?.target_touchpoints || 0,
      targetOpportunities: dbCampaign?.target_opportunities || 0,
      targetEstimates: dbCampaign?.target_estimates || 0,
      targetAwards: dbCampaign?.target_awards || 0,
    });
    setShowEditCampaign(true);
  };

  const saveEditCampaign = async (andRegenerateWeeks = false) => {
    const ef = editForm;
    if (!ef) return;

    try {
      await updateCampaignMutation.mutateAsync({
        name: ef.name,
        description: ef.description,
        start_date: ef.startDate,
        end_date: ef.endDate,
        status: ef.status || 'planning',
        owner_id: ef.ownerId || undefined,
        goal_description: ef.goal,
        target_pipeline_value: ef.targetValue,
        target_touchpoints: ef.targetTouchpoints || 0,
        target_opportunities: ef.targetOpportunities || 0,
        target_estimates: ef.targetEstimates || 0,
        target_awards: ef.targetAwards || 0,
      });

      if (andRegenerateWeeks) {
        await regenerateCampaignWeeks(campaignId);
        queryClient.invalidateQueries({ queryKey: ['campaign-weeks', campaignId] });
        queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
      }

      setShowEditCampaign(false);
      setEditForm(null);
    } catch (err) {
      console.error('Failed to update campaign:', err);
    }
  };

  // Team management handlers
  const handleAddTeamMember = async (emp: TeamEligibleEmployee) => {
    try {
      setTeamLoading(true);
      await addTeamMember(campaignId, emp.id, 'member');
      queryClient.invalidateQueries({ queryKey: ['campaign-team', campaignId] });
    } catch (err) {
      console.error('Failed to add team member:', err);
    } finally {
      setTeamLoading(false);
    }
    setTeamSearch('');
  };

  const handleRemoveTeamMember = async () => {
    if (!removingMember) return;
    const { name, employeeId } = removingMember;
    const targetName = reassignTo;

    if (employeeId) {
      try {
        setTeamLoading(true);
        const reassignMember = dbTeam.find((t: CampaignTeamMember) => t.name === targetName);
        const reassignEmployeeId = reassignMember?.employee_id
          || editEmployees.find(e => `${e.first_name} ${e.last_name}` === targetName)?.id;
        if (reassignEmployeeId) {
          await reassignCompanies(campaignId, employeeId, reassignEmployeeId);
        }
        await removeTeamMember(campaignId, employeeId);
        queryClient.invalidateQueries({ queryKey: ['campaign-team', campaignId] });
        queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
      } catch (err) {
        console.error('Failed to remove team member:', err);
      } finally {
        setTeamLoading(false);
      }
    }
    setRemovingMember(null);
    setReassignTo('');
    setShowManageTeam(false);
  };

  const getCompanyCountForMember = (memberName: string) => {
    return activeData.filter((c: any) => c.assignedTo === memberName).length;
  };

  // Transfer prospects between team members
  const [transferCounts, setTransferCounts] = useState<Record<string, number>>({});
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});
  const [transferMessage, setTransferMessage] = useState('');

  // Target prospect counts per team member for redistribution
  const [memberTargetCounts, setMemberTargetCounts] = useState<Record<number, number>>({});
  const [redistributing, setRedistributing] = useState(false);

  // Initialize target counts from DB when team loads
  useEffect(() => {
    if (dbTeam.length > 0) {
      const counts: Record<number, number> = {};
      dbTeam.forEach((t: CampaignTeamMember) => {
        counts[t.employee_id] = t.target_count || 0;
      });
      setMemberTargetCounts(counts);
    }
  }, [dbTeam]);

  const handleRedistribute = async () => {
    setRedistributing(true);
    try {
      const result = await regenerateCampaignWeeks(campaignId, memberTargetCounts);
      queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-weeks', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-team', campaignId] });
      setTransferMessage(`Redistributed ${result.companies} prospects across ${result.weeks} weeks`);
    } catch (err: any) {
      setTransferMessage(`Error: ${err?.response?.data?.error || err?.message || 'Redistribution failed'}`);
    } finally {
      setRedistributing(false);
    }
  };

  const handleTransferProspects = async (fromName: string) => {
    const count = transferCounts[fromName] || 0;
    const toName = transferTargets[fromName] || '';
    if (!count || !toName || count <= 0) return;
    setTransferMessage('');

    const memberProspects = activeData
      .filter((c: any) => c.assignedTo === fromName)
      .sort((a: any, b: any) => {
        // Transfer lowest-priority first: C before B before A, then lowest score first
        const tierOrder: Record<string, number> = { 'C': 0, 'B': 1, 'A': 2 };
        const tierDiff = (tierOrder[a.tier] || 0) - (tierOrder[b.tier] || 0);
        if (tierDiff !== 0) return tierDiff;
        return (a.score || 0) - (b.score || 0);
      });

    const toTransfer = memberProspects.slice(0, count);
    const transferIds = toTransfer.map((c: any) => c.id);

    if (dbCompanies.length > 0) {
      // DB campaign: call API to reassign specific companies
      try {
        // Get fromEmployeeId directly from the companies being transferred (more reliable than dbTeam lookup)
        const fromCompany = dbCompanies.find((c: CampaignCompany) => transferIds.includes(c.id));
        const fromEmployeeId = fromCompany?.assigned_to_id;
        // Get toEmployeeId from dbTeam or editEmployees
        const toMember = dbTeam.find((t: CampaignTeamMember) => t.name === toName);
        const toEmployeeId = toMember?.employee_id
          || editEmployees.find(e => `${e.first_name} ${e.last_name}` === toName)?.id;
        if (!fromEmployeeId || !toEmployeeId) {
          setTransferMessage(`Error: Could not find employee IDs (from: ${fromEmployeeId}, to: ${toEmployeeId})`);
          return;
        }
        const result = await reassignCompanies(campaignId, fromEmployeeId, toEmployeeId, transferIds);
        queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
        setTransferMessage(`Transferred ${result.count} prospect${result.count !== 1 ? 's' : ''} from ${fromName} to ${toName}`);
      } catch (err: any) {
        setTransferMessage(`Error: ${err?.response?.data?.error || err?.message || 'Transfer failed'}`);
      }
    }
    // Clear the transfer inputs for this member
    setTransferCounts(prev => ({ ...prev, [fromName]: 0 }));
    setTransferTargets(prev => ({ ...prev, [fromName]: '' }));
  };

  // Regenerate weekly plan: redistribute targetWeek values evenly across weeks
  const [regenMessage, setRegenMessage] = useState('');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const handleRegenerateWeeks = () => {
    if (activeWeeks.length === 0) return;
    setShowRegenConfirm(true);
  };
  const executeRegenerateWeeks = async () => {
    setShowRegenConfirm(false);
    try {
      const result = await regenerateCampaignWeeks(campaignId);
      queryClient.invalidateQueries({ queryKey: ['campaign-weeks', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
      setRegenMessage(`Redistributed ${result.companies} prospects across ${result.weeks} weeks`);
    } catch (err) {
      console.error('Failed to regenerate weeks:', err);
    }
  };

  const [tab, setTab] = useState('dashboard');
  const [selected, setSelected] = useState<any>(null);
  const [detailView, setDetailView] = useState<any>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [note, setNote] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [filter, setFilter] = useState({ team: 'all', status: 'all', tier: 'all' });
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityType | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewEstimate, setShowNewEstimate] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentCustomer, setAssessmentCustomer] = useState<any>(null);
  const [showEditCampaign, setShowEditCampaign] = useState(false);
  const [showManageTeam, setShowManageTeam] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [teamSearch, setTeamSearch] = useState('');
  const [removingMember, setRemovingMember] = useState<{ name: string; employeeId: number | null } | null>(null);
  const [reassignTo, setReassignTo] = useState<string>('');
  const [teamLoading, setTeamLoading] = useState(false);

  const activeCampaignInfo = useMemo(() => {
    if (dbCampaign) {
      return {
        name: dbCampaign.name || '',
        description: dbCampaign.description || '',
        startDate: dbCampaign.start_date || '',
        endDate: dbCampaign.end_date || '',
        goal: dbCampaign.goal_description || '',
        targetValue: dbCampaign.target_pipeline_value || 0,
        assignedTeam: dbTeam.map((t: CampaignTeamMember) => t.name),
        status: dbCampaign.status || 'planning',
        owner: dbCampaign.owner_name || ''
      };
    }
    return { name: '', description: '', startDate: '', endDate: '', goal: '', targetValue: 0, assignedTeam: [] as string[], status: 'planning', owner: '' };
  }, [dbCampaign, dbTeam]);

  const activeLogs = useMemo(() => {
    return dbActivity.map((l: CampaignActivityLog) => ({
      id: l.id, cid: l.campaign_company_id, text: l.description,
      time: l.created_at, name: l.company_name || '', user: l.user_name || ''
    }));
  }, [dbActivity]);

  const activeTeam = useMemo(() => {
    return dbTeam.map((t: CampaignTeamMember) => t.name);
  }, [dbTeam]);

  // Detect orphaned prospects (assigned to someone not on the active team)
  const orphanedProspects = useMemo(() => {
    return activeData.filter((c: any) => c.assignedTo && !activeTeam.includes(c.assignedTo));
  }, [activeData, activeTeam]);

  const orphanedNames = useMemo(() => {
    const names = new Set(orphanedProspects.map((c: any) => c.assignedTo));
    return Array.from(names) as string[];
  }, [orphanedProspects]);

  const [orphanReassignTo, setOrphanReassignTo] = useState('');

  const handleReassignOrphans = async () => {
    if (!orphanReassignTo || orphanedProspects.length === 0) return;
    if (dbCompanies.length > 0) {
      // DB campaign: reassign each orphaned employee's prospects to the target
      try {
        const toMember = dbTeam.find((t: CampaignTeamMember) => t.name === orphanReassignTo);
        const toEmployeeId = toMember?.employee_id
          || editEmployees.find(e => `${e.first_name} ${e.last_name}` === orphanReassignTo)?.id;
        if (!toEmployeeId) return;

        // Group orphaned companies by their assigned_to_id
        const orphanedByEmployee: Record<number, number[]> = {};
        for (const prospect of orphanedProspects) {
          const dbCompany = dbCompanies.find((c: CampaignCompany) => c.id === prospect.id);
          if (dbCompany?.assigned_to_id) {
            if (!orphanedByEmployee[dbCompany.assigned_to_id]) orphanedByEmployee[dbCompany.assigned_to_id] = [];
            orphanedByEmployee[dbCompany.assigned_to_id].push(dbCompany.id);
          }
        }

        for (const [fromId, companyIds] of Object.entries(orphanedByEmployee)) {
          await reassignCompanies(campaignId, Number(fromId), toEmployeeId, companyIds);
        }
        queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
      } catch (err) {
        console.error('Failed to reassign orphaned prospects:', err);
      }
    }
    setOrphanReassignTo('');
  };

  const [newCustomer, setNewCustomer] = useState<{ name: string; sector: string; address: string; phone: string; assignedTo: string; assignedToId: number | null; tier: string; score: number; targetWeek: number }>({ name: '', sector: '', address: '', phone: '', assignedTo: '', assignedToId: null, tier: 'B', score: 70, targetWeek: 1 });
  const [newContact, setNewContact] = useState({ companyId: '', name: '', title: '', email: '', phone: '', isPrimary: false });
  const [newEstimate, setNewEstimate] = useState({ companyId: '', oppId: '', name: '', amount: '', status: 'draft' });

  const sectors = useMemo(() => {
    return [...new Set(activeData.map((c: any) => c.sector).filter(Boolean))].sort();
  }, [activeData]);

  const stats = useMemo(() => {
    const byStatus: any = {}; statuses.forEach(s => byStatus[s.key] = activeData.filter((c: any) => c.status === s.key).length);
    const byAction: any = {}; actions.forEach(a => byAction[a.key] = activeData.filter((c: any) => c.action === a.key).length);
    const contacted = activeData.filter((c: any) => c.status !== 'prospect').length;
    const opps = opportunities.length;
    const totalOppValue = opportunities.reduce((sum: number, o: any) => sum + (parseFloat(o.estimated_value) || 0), 0);
    return { byStatus, byAction, contacted, opportunities: opps, totalOppValue };
  }, [activeData, opportunities]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filtered = useMemo(() => {
    let filteredData = activeData.filter((c: any) =>
      (filter.team === 'all' || c.assignedTo === filter.team) &&
      (filter.status === 'all' || c.status === filter.status) &&
      (filter.tier === 'all' || c.tier === filter.tier)
    );

    // Apply sorting
    if (sortConfig) {
      filteredData.sort((a: any, b: any) => {
        let aValue, bValue;

        switch (sortConfig.key) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'prospectScore':
            aValue = a.score;
            bValue = b.score;
            break;
          case 'tgScore':
            aValue = assessmentsMap[a.id] || 0;
            bValue = assessmentsMap[b.id] || 0;
            break;
          case 'assigned':
            aValue = a.assignedTo.toLowerCase();
            bValue = b.assignedTo.toLowerCase();
            break;
          case 'week':
            aValue = a.targetWeek;
            bValue = b.targetWeek;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filteredData;
  }, [activeData, filter, sortConfig, assessmentsMap]);

  const updateField = (companyId: number, field: string, value: string) => {
    if (field === 'status') {
      statusMutation.mutate({ companyId, status: value });
    } else if (field === 'action') {
      actionMutation.mutate({ companyId, action: value });
    } else if (field === 'assignedTo') {
      assignMutation.mutate({ companyId, assignedToId: parseInt(value) });
    }
  };

  const addNote = () => {
    if (!note.trim() || !selected) return;
    addNoteMutation.mutate({ companyId: selected.id, note: note.trim() });
    setNote('');
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name.trim()) return;
    addProspectMutation.mutate({
      name: newCustomer.name,
      sector: newCustomer.sector,
      address: newCustomer.address,
      phone: newCustomer.phone,
      tier: newCustomer.tier,
      score: newCustomer.score,
      target_week: newCustomer.targetWeek,
      assigned_to_id: newCustomer.assignedToId
    });
    setNewCustomer({ name: '', sector: '', address: '', phone: '', assignedTo: '', assignedToId: null, tier: 'B', score: 70, targetWeek: 1 });
    setShowNewCustomer(false);
  };

  const handleCloseOpportunityModal = () => {
    setIsOpportunityModalOpen(false);
    setSelectedOpportunity(null);
  };

  const handleSaveOpportunity = async () => {
    setIsOpportunityModalOpen(false);
    setSelectedOpportunity(null);
    // Refetch opportunities to get updated list
    await refetchOpportunities();
  };

  const handleAddContact = () => {
    if (!newContact.name.trim() || !newContact.companyId) return;
    const newId = contacts.length > 0 ? Math.max(...contacts.map((c: any) => c.id)) + 1 : 1;
    const contact = { ...newContact, id: newId, companyId: parseInt(newContact.companyId) };
    setContacts([...contacts, contact]);
    setNewContact({ companyId: '', name: '', title: '', email: '', phone: '', isPrimary: false });
    setShowNewContact(false);
  };

  const handleAddEstimate = () => {
    if (!newEstimate.name.trim() || !newEstimate.companyId) return;
    const newId = estimates.length > 0 ? Math.max(...estimates.map((e: any) => e.id)) + 1 : 1;
    const estNum = `EST-2025-${String(newId).padStart(3, '0')}`;
    const est = { ...newEstimate, id: newId, number: estNum, companyId: parseInt(newEstimate.companyId), oppId: newEstimate.oppId ? parseInt(newEstimate.oppId) : null, amount: parseFloat(newEstimate.amount) || 0, sentDate: null, validUntil: null };
    setEstimates([...estimates, est]);
    setNewEstimate({ companyId: '', oppId: '', name: '', amount: '', status: 'draft' });
    setShowNewEstimate(false);
  };

  const openDetail = (company: any) => {
    setDetailView(company);
    setDetailTab('overview');
  };

  const card: React.CSSProperties = { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e5e5e5' };
  const input: React.CSSProperties = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', background: '#fff', width: '100%', fontFamily: 'inherit' };
  const btn: React.CSSProperties = { padding: '8px 16px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' };
  const btnSecondary: React.CSSProperties = { ...btn, background: '#f3f4f6', color: '#374151' };

  const weekData = activeWeeks.find((w: any) => w.num === currentWeek);

  const getCompanyContacts = (companyId: number) => contacts.filter((c: any) => c.companyId === companyId);
  const getCompanyOpportunities = (companyId: number) => opportunities.filter((o: any) => o.companyId === companyId);
  const getCompanyEstimates = (companyId: number) => estimates.filter((e: any) => e.companyId === companyId);
  const getCompanyLogs = (companyId: number) => activeLogs.filter((l: any) => l.cid === companyId);

  const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
  const modal: React.CSSProperties = { background: '#fff', borderRadius: '16px', maxWidth: '600px', width: '95%', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
  const detailModal: React.CSSProperties = { ...modal, maxWidth: '900px' };

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/campaigns" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Campaigns
            </Link>
            <h1>📣 {activeCampaignInfo.name}</h1>
            <div className="sales-subtitle">
              {activeCampaignInfo.startDate ? new Date(activeCampaignInfo.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} - {activeCampaignInfo.endDate ? new Date(activeCampaignInfo.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button
            className="sales-btn sales-btn-secondary"
            onClick={openEditModal}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          <button
            className="sales-btn sales-btn-secondary"
            onClick={() => { setShowManageTeam(true); setTeamSearch(''); setRemovingMember(null); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Team
          </button>
          <button
            className="sales-btn sales-btn-secondary"
            onClick={async () => {
              setDownloadingReport(true);
              try {
                await downloadCampaignReport(campaignId, activeCampaignInfo.name || 'Campaign');
              } catch (err: any) {
                console.error('Report generation error:', err);
                alert(err?.message || 'Failed to generate report. Please try again.');
              } finally {
                setDownloadingReport(false);
              }
            }}
            disabled={downloadingReport}
            style={downloadingReport ? { opacity: 0.7, cursor: 'wait' } : undefined}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            {downloadingReport ? 'Generating...' : 'Report'}
          </button>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {['dashboard', 'weekly', 'prospects', 'opportunities', 'goals'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? '#ea580c' : 'transparent', color: tab === t ? '#fff' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '13px' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <button className="sales-btn sales-btn-primary" onClick={() => setShowNewCustomer(true)}>
            <span style={{ fontSize: '16px' }}>+</span> New Prospect
          </button>
          <button className="sales-btn sales-btn-secondary" onClick={() => setIsOpportunityModalOpen(true)}>
            <span style={{ fontSize: '16px' }}>+</span> New Opportunity
          </button>
        </div>
      </div>

      <main style={{ padding: '12px 0' }}>

        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              {(() => {
                const originalCount = activeData.filter((c: any) => c.source === 'seed').length;
                const addedCount = activeData.filter((c: any) => c.source === 'manual').length;
                return [
                  { label: 'Total Prospects', value: activeData.length, color: '#6366f1', sub: addedCount > 0 ? `${originalCount} original + ${addedCount} added` : undefined },
                  { label: 'Contacted', value: stats.contacted, color: '#3b82f6' },
                  { label: 'New Opportunities', value: stats.opportunities, color: '#10b981' },
                  { label: 'Opportunities Value', value: '$' + stats.totalOppValue.toLocaleString('en-US'), color: '#8b5cf6' },
                  { label: 'Follow Up Needed', value: stats.byStatus.follow_up || 0, color: '#f59e0b' },
                  ...(addedCount > 0 ? [{ label: 'Prospects Added', value: addedCount, color: '#06b6d4', sub: 'Discovered during campaign' }] : [])
                ];
              })().map((k: any, i: number) => (
                <div key={i} style={{ ...card, padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{k.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: k.color }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{k.sub}</div>}
                </div>
              ))}
            </div>

            {/* Row 1: Status Breakdown (narrow) + Recent Activity (wide) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
              <div style={{ ...card, padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>Status Breakdown</h3>
                {statuses.map(s => {
                  const count = stats.byStatus[s.key] || 0;
                  const pct = activeData.length > 0 ? Math.round((count / activeData.length) * 100) : 0;
                  return (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '13px' }}>{s.label}</span>
                      <span style={{ fontWeight: 600, color: s.color, minWidth: '24px', textAlign: 'right' }}>{count}</span>
                      <div style={{ width: '60px', height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: s.color, borderRadius: '3px', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
                {/* Action breakdown */}
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '20px 0 12px', color: '#374151' }}>Next Actions</h3>
                {actions.filter(a => a.key !== 'none').map(a => {
                  const count = stats.byAction[a.key] || 0;
                  return (
                    <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '13px' }}>{a.label}</span>
                      <span style={{ fontWeight: 600, color: a.color }}>{count}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ ...card, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>Recent Activity</h3>
                <div style={{ flex: 1, maxHeight: '420px', overflow: 'auto' }}>
                  {activeLogs.slice(0, 25).map((l: any) => (
                    <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                      {l.name && <span style={{ fontWeight: 500, color: '#2563eb' }}>{l.name}: </span>}<span style={{ color: '#374151' }}>{l.text}</span>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>{l.user && <span>{l.user} &middot; </span>}{new Date(l.time).toLocaleString()}</div>
                    </div>
                  ))}
                  {activeLogs.length === 0 && <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No activity yet</div>}
                </div>
              </div>
            </div>

            {/* Row 2: Upcoming Follow-Ups + Team Leaderboard */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Upcoming Follow-Ups */}
              <div style={{ ...card, padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>Upcoming Follow-Ups</h3>
                <div style={{ maxHeight: '280px', overflow: 'auto' }}>
                  {(() => {
                    const followUps = activeData.filter((c: any) => c.action === 'follow_30' || c.status === 'follow_up');
                    if (followUps.length === 0) return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No follow-ups pending</div>;
                    return followUps.slice(0, 10).map((c: any) => (
                      <div key={c.id} onClick={() => openDetail(c)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 8px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', borderRadius: '6px', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#d97706' }}>{c.name?.charAt(0) || '?'}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '13px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.assignedTo} &middot; {c.sector || 'No sector'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: statuses.find(s => s.key === c.status)?.color === '#f59e0b' ? '#fef3c7' : '#f0fdf4', color: statuses.find(s => s.key === c.status)?.color || '#64748b', fontWeight: 500 }}>
                            {statuses.find(s => s.key === c.status)?.label || c.status}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {actions.find(a => a.key === c.action)?.label || ''}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Team Leaderboard */}
              <div style={{ ...card, padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>Team Leaderboard</h3>
                <div style={{ maxHeight: '280px', overflow: 'auto' }}>
                  {(() => {
                    const hasManualProspects = activeData.some((c: any) => c.source === 'manual');
                    const teamStats = activeTeam.map((name: string) => {
                      const prospects = activeData.filter((c: any) => c.assignedTo === name);
                      const contacted = prospects.filter((c: any) => c.status !== 'prospect').length;
                      const opps = prospects.filter((c: any) => c.status === 'new_opp').length;
                      const followUps = prospects.filter((c: any) => c.status === 'follow_up').length;
                      const added = prospects.filter((c: any) => c.source === 'manual').length;
                      const addedContacted = prospects.filter((c: any) => c.source === 'manual' && c.status !== 'prospect').length;
                      return { name, total: prospects.length, contacted, opps, followUps, added, addedContacted };
                    }).sort((a, b) => b.contacted - a.contacted);
                    if (teamStats.length === 0) return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No team members assigned</div>;
                    return (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '8px 6px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Member</th>
                            <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Assigned</th>
                            <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Contacted</th>
                            <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Opps</th>
                            <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Follow Up</th>
                            {hasManualProspects && <th style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600, color: '#06b6d4', fontSize: '11px', textTransform: 'uppercase' }}>Added</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {teamStats.map((t, i) => {
                            const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
                            const avatarColor = colors[i % colors.length];
                            return (
                              <tr key={t.name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '10px 6px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: '11px', flexShrink: 0 }}>
                                      {t.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                    <span style={{ fontWeight: 500 }}>{t.name}</span>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 6px', textAlign: 'center', color: '#64748b' }}>{t.total}</td>
                                <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                  <span style={{ fontWeight: 600, color: t.contacted > 0 ? '#3b82f6' : '#cbd5e1' }}>{t.contacted}</span>
                                  {t.total > 0 && <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>({Math.round((t.contacted / t.total) * 100)}%)</span>}
                                </td>
                                <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                  <span style={{ fontWeight: 600, color: t.opps > 0 ? '#10b981' : '#cbd5e1' }}>{t.opps}</span>
                                </td>
                                <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                  <span style={{ fontWeight: 600, color: t.followUps > 0 ? '#f59e0b' : '#cbd5e1' }}>{t.followUps}</span>
                                </td>
                                {hasManualProspects && (
                                  <td style={{ padding: '10px 6px', textAlign: 'center' }}>
                                    {t.added > 0 ? (
                                      <div>
                                        <span style={{ fontWeight: 600, color: '#06b6d4' }}>+{t.added}</span>
                                        <div style={{ fontSize: '10px', color: t.addedContacted === t.added ? '#10b981' : '#94a3b8' }}>
                                          {t.addedContacted}/{t.added} contacted
                                        </div>
                                      </div>
                                    ) : <span style={{ color: '#cbd5e1' }}>-</span>}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Row 3: Top Opportunities Pipeline */}
            {opportunities.length > 0 && (
              <div style={{ ...card, padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Top Opportunities</h3>
                  <button onClick={() => setTab('opportunities')} style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>View All →</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Opportunity</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Customer</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Value</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Stage</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Priority</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Salesperson</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...opportunities].sort((a: any, b: any) => (parseFloat(b.estimated_value) || 0) - (parseFloat(a.estimated_value) || 0)).slice(0, 5).map((o: any) => {
                      const priorityColors: Record<string, { bg: string; text: string }> = {
                        urgent: { bg: '#fef2f2', text: '#dc2626' },
                        high: { bg: '#fff7ed', text: '#ea580c' },
                        medium: { bg: '#fefce8', text: '#ca8a04' },
                        low: { bg: '#f0fdf4', text: '#16a34a' }
                      };
                      const pc = priorityColors[o.priority] || priorityColors.medium;
                      return (
                        <tr key={o.id} onClick={() => { setSelectedOpportunity(o); setIsOpportunityModalOpen(true); }} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: 500, color: '#1e293b' }}>{o.title}</div>
                          </td>
                          <td style={{ padding: '10px', color: '#64748b' }}>{o.customer_name || o.owner || '-'}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>${Math.round(parseFloat(o.estimated_value) || 0).toLocaleString('en-US')}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', background: o.stage_color ? `${o.stage_color}18` : '#f3f4f6', color: o.stage_color || '#64748b', fontWeight: 500 }}>
                              {o.stage_name || 'Unknown'}
                            </span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', background: pc.bg, color: pc.text, fontWeight: 500, textTransform: 'capitalize' }}>
                              {o.priority}
                            </span>
                          </td>
                          <td style={{ padding: '10px', color: '#64748b' }}>{o.assigned_to_name || 'Unassigned'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'weekly' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ ...card, padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Select Week:</span>
              {activeWeeks.map((w: any) => {
                const weekCount = activeData.filter((c: any) => c.targetWeek === w.num).length;
                return (
                  <button key={w.num} onClick={() => setCurrentWeek(w.num)} style={{ padding: '8px 14px', background: currentWeek === w.num ? '#ea580c' : '#f3f4f6', color: currentWeek === w.num ? '#fff' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <span>{w.label}</span>
                    <span style={{ fontSize: '10px', opacity: 0.8 }}>{weekCount} prospect{weekCount !== 1 ? 's' : ''}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Week {currentWeek}: {weekData?.label}
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#64748b', marginLeft: '12px' }}>
                  ({activeData.filter((c: any) => c.targetWeek === currentWeek).length} prospects)
                </span>
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Prospects scheduled for contact this week</p>

              {activeTeam.map((pm: string) => {
                const pmProspects = activeData.filter((c: any) => c.assignedTo === pm && c.targetWeek === currentWeek);
                if (pmProspects.length === 0) return null;
                return (
                  <div key={pm} style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 12px', background: '#f9fafb', borderRadius: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{pm}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>({pmProspects.length} prospects)</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#fafafa' }}>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Company</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Sector</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>Score</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Phone</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pmProspects.map((c: any) => (
                          <tr key={c.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '10px' }}>
                              <div style={{ fontWeight: 500, color: '#2563eb', cursor: 'pointer' }} onClick={() => openDetail(c)}>{c.name}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.address}</div>
                            </td>
                            <td style={{ padding: '10px', color: '#64748b' }}>{c.sector}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ background: c.tier === 'A' ? '#dcfce7' : '#fef9c3', color: c.tier === 'A' ? '#16a34a' : '#ca8a04', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>{c.tier}-{c.score}</span>
                            </td>
                            <td style={{ padding: '10px' }}><a href={'tel:'+c.phone} style={{ color: '#2563eb', textDecoration: 'none' }}>{c.phone}</a></td>
                            <td style={{ padding: '10px' }}>
                              <select value={c.status} onChange={e => updateField(c.id, 'status', e.target.value)} style={{ ...input, fontSize: '11px', color: statuses.find(s=>s.key===c.status)?.color, width: 'auto' }}>
                                {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <select value={c.action} onChange={e => updateField(c.id, 'action', e.target.value)} style={{ ...input, fontSize: '11px', color: actions.find(a=>a.key===c.action)?.color, width: 'auto' }}>
                                {actions.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {/* Render prospects not matching any team member (unassigned or team not set up) */}
              {(() => {
                const unmatchedProspects = activeData.filter((c: any) =>
                  c.targetWeek === currentWeek && !activeTeam.includes(c.assignedTo)
                );
                if (unmatchedProspects.length === 0) return null;
                return (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 12px', background: '#fef3c7', borderRadius: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{activeTeam.length === 0 ? 'All Prospects' : 'Unassigned / Other'}</span>
                      <span style={{ fontSize: '12px', color: '#92400e' }}>({unmatchedProspects.length} prospects)</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#fafafa' }}>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Company</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Sector</th>
                          <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>Score</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Assigned To</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                          <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmatchedProspects.map((c: any) => (
                          <tr key={c.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '10px' }}>
                              <div style={{ fontWeight: 500, color: '#2563eb', cursor: 'pointer' }} onClick={() => openDetail(c)}>{c.name}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.address}</div>
                            </td>
                            <td style={{ padding: '10px', color: '#64748b' }}>{c.sector}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <span style={{ background: c.tier === 'A' ? '#dcfce7' : '#fef9c3', color: c.tier === 'A' ? '#16a34a' : '#ca8a04', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>{c.tier}-{c.score}</span>
                            </td>
                            <td style={{ padding: '10px', color: '#64748b' }}>{c.assignedTo}</td>
                            <td style={{ padding: '10px' }}>
                              <select value={c.status} onChange={e => updateField(c.id, 'status', e.target.value)} style={{ ...input, fontSize: '11px', color: statuses.find(s=>s.key===c.status)?.color, width: 'auto' }}>
                                {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '10px' }}>
                              <select value={c.action} onChange={e => updateField(c.id, 'action', e.target.value)} style={{ ...input, fontSize: '11px', color: actions.find(a=>a.key===c.action)?.color, width: 'auto' }}>
                                {actions.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              {activeData.filter((c: any) => c.targetWeek === currentWeek).length === 0 && (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>No prospects scheduled for this week</div>
              )}
            </div>
          </div>
        )}

        {tab === 'prospects' && (
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...card, padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={filter.team} onChange={e => setFilter({...filter, team: e.target.value})} style={{...input, width: 'auto'}}>
                  <option value="all">All Team</option>
                  {activeTeam.map((t: string) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})} style={{...input, width: 'auto'}}>
                  <option value="all">All Status</option>
                  {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <select value={filter.tier} onChange={e => setFilter({...filter, tier: e.target.value})} style={{...input, width: 'auto'}}>
                  <option value="all">All Tiers</option>
                  <option value="A">A-Tier</option>
                  <option value="B">B-Tier</option>
                </select>
                <span style={{ fontSize: '13px', color: '#64748b' }}>{filtered.length} prospects</span>
              </div>

              <div style={{ ...card, overflow: 'hidden' }}>
                <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                      <tr>
                        <th
                          style={{ padding: '12px', textAlign: 'left', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('name')}
                        >
                          Company {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                        </th>
                        <th
                          style={{ padding: '12px', textAlign: 'center', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('prospectScore')}
                        >
                          Prospect Score {sortConfig?.key === 'prospectScore' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                        </th>
                        <th
                          style={{ padding: '12px', textAlign: 'center', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('tgScore')}
                        >
                          TG Cust. Score {sortConfig?.key === 'tgScore' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                        </th>
                        <th
                          style={{ padding: '12px', textAlign: 'left', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('assigned')}
                        >
                          Assigned {sortConfig?.key === 'assigned' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                        </th>
                        <th
                          style={{ padding: '12px', textAlign: 'left', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('week')}
                        >
                          Week {sortConfig?.key === 'week' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                        </th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Action</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c: any) => {
                        const tgScore = assessmentsMap[c.id];
                        const getTierFromScore = (score: number) => {
                          if (score >= 85) return 'A';
                          if (score >= 70) return 'B';
                          if (score >= 50) return 'C';
                          return null;
                        };
                        const tgTier = tgScore ? getTierFromScore(tgScore) : null;

                        return (
                          <tr key={c.id} onClick={() => setSelected(c)} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.id === c.id ? '#fef3c7' : '#fff' }}>
                            <td style={{ padding: '12px' }}>
                              <div style={{ fontWeight: 500 }}>{c.name}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.sector}</div>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              <span style={{ background: c.tier === 'A' ? '#dcfce7' : '#fef9c3', color: c.tier === 'A' ? '#16a34a' : '#ca8a04', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>{c.tier}-{c.score}</span>
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {tgScore ? (
                                <span style={{
                                  background: tgTier === 'A' ? '#dcfce7' : tgTier === 'B' ? '#dbeafe' : '#fef9c3',
                                  color: tgTier === 'A' ? '#16a34a' : tgTier === 'B' ? '#2563eb' : '#ca8a04',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  fontSize: '11px'
                                }}>
                                  {tgTier}-{tgScore}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '12px', fontSize: '12px' }}>
                              <select value={c.assigned_to_id || ''} onClick={e => e.stopPropagation()} onChange={e => updateField(c.id, 'assignedTo', e.target.value)} style={{ ...input, fontSize: '11px', padding: '4px 6px', width: 'auto', color: '#374151' }}>
                                {dbTeam.map((t: CampaignTeamMember) => <option key={t.employee_id} value={t.employee_id}>{t.name}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '12px', fontSize: '12px' }}>{activeWeeks.find((w: any)=>w.num===c.targetWeek)?.label}</td>
                          <td style={{ padding: '12px' }}>
                            <select value={c.status} onClick={e => e.stopPropagation()} onChange={e => updateField(c.id, 'status', e.target.value)} style={{ ...input, fontSize: '11px', padding: '4px 6px', width: 'auto' }}>
                              {statuses.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <select value={c.action} onClick={e => e.stopPropagation()} onChange={e => updateField(c.id, 'action', e.target.value)} style={{ ...input, fontSize: '11px', padding: '4px 6px', width: 'auto' }}>
                              {actions.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button onClick={(e) => { e.stopPropagation(); setAssessmentCustomer(c); setShowAssessment(true); }} style={{ background: '#fef3c7', color: '#f59e0b', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
                                Score
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); openDetail(c); }} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
                                View →
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {selected && (
              <div style={{ ...card, width: '300px', padding: '20px', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600 }}>{selected.name}</h3>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
                  <div>{selected.sector}</div>
                  <div style={{ marginTop: '6px' }}>{selected.address}</div>
                  <a href={'tel:'+selected.phone} style={{ color: '#2563eb', fontWeight: 600, fontSize: '15px', display: 'block', marginTop: '8px' }}>{selected.phone}</a>
                </div>

                <button onClick={() => openDetail(selected)} style={{ ...btn, width: '100%', marginBottom: '16px', fontSize: '12px' }}>View Full Details →</button>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Log Conversation</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Enter notes..." style={{ ...input, minHeight: '60px', resize: 'vertical' }} />
                  <button onClick={addNote} style={{ ...btn, marginTop: '8px', width: '100%', fontSize: '13px' }}>Add Note</button>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>History</label>
                  <div style={{ maxHeight: '140px', overflow: 'auto' }}>
                    {activeLogs.filter((l: any) => l.cid === selected.id).map((l: any) => (
                      <div key={l.id} style={{ padding: '6px 8px', background: '#f9fafb', borderRadius: '4px', marginBottom: '4px', fontSize: '11px' }}>
                        {l.text}
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{new Date(l.time).toLocaleString()}</div>
                      </div>
                    ))}
                    {activeLogs.filter((l: any) => l.cid === selected.id).length === 0 && <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>No history</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'opportunities' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Opportunity Metrics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ ...card, padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Opportunities</div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: '#6366f1' }}>{opportunities.length}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Active in pipeline</div>
              </div>
              <div style={{ ...card, padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Value</div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: '#10b981' }}>${Math.round(stats.totalOppValue).toLocaleString('en-US')}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Opportunities Value</div>
              </div>
              <div style={{ ...card, padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Average Value</div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: '#8b5cf6' }}>
                  ${opportunities.length > 0 ? Math.round(stats.totalOppValue / opportunities.length).toLocaleString('en-US', { maximumFractionDigits: 0 }) : 0}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Per opportunity</div>
              </div>
              <div style={{ ...card, padding: '20px' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>High Priority</div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: '#f59e0b' }}>
                  {opportunities.filter((o: any) => o.priority === 'high' || o.priority === 'urgent').length}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Urgent + High</div>
              </div>
            </div>

            {/* Opportunities Table */}
            <div className="sales-table-section">
              <div className="sales-table-header">
                <h2 className="sales-table-title">All Opportunities</h2>
              </div>
              {opportunitiesLoading ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Loading opportunities...</div>
              ) : opportunities.length > 0 ? (
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th style={{ width: '10%' }}>Date</th>
                      <th style={{ width: '24%' }}>Opportunity / Owner</th>
                      <th style={{ width: '14%' }}>General Contractor</th>
                      <th style={{ width: '10%' }}>Market</th>
                      <th style={{ width: '10%' }}>Value</th>
                      <th style={{ width: '10%' }}>Stage</th>
                      <th style={{ width: '10%' }}>Probability</th>
                      <th style={{ width: '12%' }}>Salesperson</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((o: any) => {
                      const stageClass = (o.stage_name || 'lead').toLowerCase().replace(/\s+/g, '-');
                      const probabilityClass = (o.probability || 'medium').toLowerCase();
                      const getProbabilityPercent = (prob: string) => {
                        const map: Record<string, number> = { low: 25, medium: 50, high: 75 };
                        return map[prob.toLowerCase()] || 50;
                      };
                      const getInitials = (name: string) => {
                        if (!name) return '??';
                        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                      };
                      const getAvatarColor = (name: string) => {
                        const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
                        const index = name ? name.charCodeAt(0) % colors.length : 0;
                        return colors[index];
                      };
                      const formatDate = (dateStr: string) => {
                        if (!dateStr) return '-';
                        const date = new Date(dateStr);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      };
                      const iconGradients = [
                        'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        'linear-gradient(135deg, #10b981, #06b6d4)',
                        'linear-gradient(135deg, #f59e0b, #f43f5e)',
                        'linear-gradient(135deg, #8b5cf6, #ec4899)'
                      ];
                      const iconGradient = iconGradients[o.id % iconGradients.length];
                      const icon = o.title ? o.title.charAt(0).toUpperCase() : '?';
                      const salespersonName = o.assigned_to_name || 'Unassigned';

                      return (
                        <tr
                          key={o.id}
                          onClick={() => { setSelectedOpportunity(o); setIsOpportunityModalOpen(true); }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>{formatDate(o.created_at)}</td>
                          <td>
                            <div className="sales-project-cell">
                              <div className="sales-project-icon" style={{ background: iconGradient }}>
                                {icon}
                              </div>
                              <div className="sales-project-info">
                                <h4>{o.title}</h4>
                                <span>{o.customer_name || o.owner || 'No owner'}</span>
                              </div>
                            </div>
                          </td>
                          <td>{o.gc_customer_name || o.general_contractor || '-'}</td>
                          <td>{o.market || '-'}</td>
                          <td className="sales-value-cell">${Math.round(o.estimated_value || 0).toLocaleString('en-US')}</td>
                          <td>
                            <span className={`sales-stage-badge ${stageClass}`}>
                              <span className="sales-stage-dot"></span>
                              {o.stage_name || 'Unknown'}
                            </span>
                          </td>
                          <td>
                            {o.probability || o.stage_probability ? (
                              <span className={`sales-probability-badge ${probabilityClass}`}>
                                <span className="sales-probability-dot"></span>
                                {o.probability || o.stage_probability} ({getProbabilityPercent(o.probability || o.stage_probability || 'medium')}%)
                              </span>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                          <td>
                            <div className="sales-salesperson-cell">
                              <div
                                className="sales-salesperson-avatar"
                                style={{ background: getAvatarColor(salespersonName) }}
                              >
                                {getInitials(salespersonName)}
                              </div>
                              {salespersonName}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>No opportunities yet. Create one to get started!</div>
              )}
            </div>
          </div>
        )}

        {tab === 'goals' && (() => {
          const goalTouchpoints = dbCampaign?.target_touchpoints || activeData.length;
          const goalOpportunities = dbCampaign?.target_opportunities || 0;
          const goalEstimates = dbCampaign?.target_estimates || 0;
          const goalAwards = dbCampaign?.target_awards || 0;
          const estimateCount = 0;
          const awardCount = 0;
          const originalCount = activeData.filter((c: any) => c.source === 'seed').length;
          const addedCount = activeData.filter((c: any) => c.source === 'manual').length;
          const timelineLabel = activeCampaignInfo.startDate && activeCampaignInfo.endDate
            ? `${new Date(activeCampaignInfo.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(activeCampaignInfo.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            : '';

          const goalCriteria = [
            { text: `${goalTouchpoints} targets contacted`, met: stats.contacted >= goalTouchpoints, current: stats.contacted, target: goalTouchpoints },
            { text: 'Opportunities identified', met: stats.opportunities >= goalOpportunities, current: stats.opportunities, target: goalOpportunities },
            { text: 'New prospects discovered', met: addedCount > 0, current: addedCount, target: addedCount > 0 ? addedCount : '-' as any, isBonus: true },
            { text: 'Estimates generated', met: estimateCount >= goalEstimates, current: estimateCount, target: goalEstimates },
            { text: 'Awards won', met: awardCount >= goalAwards, current: awardCount, target: goalAwards }
          ];

          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Prospect Source Summary */}
            {addedCount > 0 && (
              <div style={{ ...card, padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', background: 'linear-gradient(135deg, #ecfeff, #f0f9ff)', border: '1px solid #a5f3fc' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#06b6d4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>+{addedCount}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0e7490' }}>
                    {addedCount} New Prospect{addedCount !== 1 ? 's' : ''} Discovered During Campaign
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Started with {originalCount} original targets, team identified {addedCount} additional prospect{addedCount !== 1 ? 's' : ''} through outreach
                  </div>
                </div>
              </div>
            )}

            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Campaign Timeline: {timelineLabel}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(activeWeeks.length, 8)}, 1fr)`, gap: '8px' }}>
                {activeWeeks.map((w: any) => {
                  const weekProspects = activeData.filter((c: any) => c.targetWeek === w.num);
                  const contacted = weekProspects.filter((c: any) => c.status !== 'prospect').length;
                  const addedInWeek = weekProspects.filter((c: any) => c.source === 'manual').length;
                  return (
                    <div key={w.num} style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Week {w.num}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{w.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: weekProspects.length > 0 && contacted === weekProspects.length ? '#16a34a' : '#ea580c' }}>{contacted}/{weekProspects.length}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>contacted</div>
                      {addedInWeek > 0 && <div style={{ fontSize: '10px', color: '#06b6d4', marginTop: '4px', fontWeight: 600 }}>+{addedInWeek} added</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Success Criteria</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {goalCriteria.map((c: any, i: number) => (
                  <div key={i} style={{ padding: '14px', background: c.met ? (c.isBonus ? '#ecfeff' : '#dcfce7') : '#f9fafb', borderRadius: '8px', border: '1px solid ' + (c.met ? (c.isBonus ? '#a5f3fc' : '#bbf7d0') : '#e5e7eb') }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: c.met ? (c.isBonus ? '#06b6d4' : '#16a34a') : '#d1d5db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{c.met ? '✓' : ''}</div>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{c.text}</span>
                      {c.isBonus && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: '#06b6d4', color: '#fff', fontWeight: 600 }}>BONUS</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{c.current}{c.isBonus ? ' found' : ` / ${c.target}`}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Team Progress</h3>
              {activeTeam.map((pm: string) => {
                const pmData = activeData.filter((c: any) => c.assignedTo === pm);
                const contacted = pmData.filter((c: any) => c.status !== 'prospect').length;
                const opps = pmData.filter((c: any) => c.status === 'new_opp').length;
                const pmAdded = pmData.filter((c: any) => c.source === 'manual').length;
                return (
                  <div key={pm} style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>{pm}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Assigned: {pmData.length} | Contacted: {contacted} | Opportunities: {opps}
                      {pmAdded > 0 && <span style={{ color: '#06b6d4', fontWeight: 600 }}> | +{pmAdded} added</span>}
                    </div>
                    <div style={{ background: '#e5e7eb', height: '6px', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ background: '#ea580c', height: '100%', width: `${pmData.length > 0 ? (contacted / pmData.length) * 100 : 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })()}
      </main>

      {/* New Prospect Modal */}
      {showNewCustomer && (
        <div style={modalOverlay} onClick={() => setShowNewCustomer(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Add New Prospect</h2>
            </div>
            <div style={{ padding: '24px', maxHeight: 'calc(90vh - 150px)', overflow: 'auto' }}>
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Company Name *</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                    style={input}
                    placeholder="e.g., ABC Manufacturing"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Sector</label>
                  <input
                    type="text"
                    value={newCustomer.sector}
                    onChange={e => setNewCustomer({...newCustomer, sector: e.target.value})}
                    style={input}
                    placeholder="e.g., Food Processing"
                    list="sectors-list"
                  />
                  <datalist id="sectors-list">
                    {sectors.map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Address</label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                    style={input}
                    placeholder="e.g., 123 Main St, Phoenix, AZ 85001"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Phone</label>
                  <input
                    type="text"
                    value={newCustomer.phone}
                    onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    style={input}
                    placeholder="e.g., (480) 555-1234"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Tier</label>
                    <select
                      value={newCustomer.tier}
                      onChange={e => setNewCustomer({...newCustomer, tier: e.target.value})}
                      style={input}
                    >
                      <option value="A">A-Tier</option>
                      <option value="B">B-Tier</option>
                      <option value="C">C-Tier</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Score (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newCustomer.score}
                      onChange={e => setNewCustomer({...newCustomer, score: parseInt(e.target.value) || 0})}
                      style={input}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Assigned To</label>
                  <select
                    value={newCustomer.assignedToId?.toString() || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const member = dbTeam.find((t: CampaignTeamMember) => t.employee_id?.toString() === val);
                      setNewCustomer({...newCustomer, assignedTo: member?.name || '', assignedToId: member ? member.employee_id : null});
                    }}
                    style={input}
                  >
                    {dbTeam.map((t: CampaignTeamMember) => (
                      <option key={t.employee_id} value={t.employee_id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Target Week</label>
                  <select
                    value={newCustomer.targetWeek}
                    onChange={e => setNewCustomer({...newCustomer, targetWeek: parseInt(e.target.value)})}
                    style={input}
                  >
                    {activeWeeks.map((w: any) => <option key={w.num} value={w.num}>Week {w.num} ({w.label})</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewCustomer(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleAddCustomer} style={btn} disabled={!newCustomer.name.trim()}>Add Prospect</button>
            </div>
          </div>
        </div>
      )}

      {/* Opportunity Modal */}
      {isOpportunityModalOpen && (
        <OpportunityModal
          opportunity={selectedOpportunity}
          onClose={handleCloseOpportunityModal}
          onSave={handleSaveOpportunity}
          defaultCampaignId={parseInt(id || '0')}
        />
      )}

      {/* Prospect Detail Modal */}
      {detailView && (
        <div style={modalOverlay} onClick={() => { setDetailView(null); setDetailTab('overview'); }}>
          <div style={{ ...detailModal, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{detailView.name}</h2>
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{detailView.sector}</span>
                  <span style={{ background: detailView.tier === 'A' ? '#dcfce7' : '#fef9c3', color: detailView.tier === 'A' ? '#16a34a' : '#ca8a04', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>{detailView.tier}-{detailView.score}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Assigned: <strong>{detailView.assignedTo}</strong></span>
                </div>
              </div>
              <button onClick={() => { setDetailView(null); setDetailTab('overview'); }} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
              {['overview', 'contacts', 'activity'].map(t => (
                <button key={t} onClick={() => setDetailTab(t)} style={{
                  padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: detailTab === t ? 600 : 400,
                  color: detailTab === t ? '#ea580c' : '#64748b',
                  borderBottom: detailTab === t ? '2px solid #ea580c' : '2px solid transparent',
                }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>

            <div style={{ padding: '24px', overflow: 'auto', flex: 1 }}>
              {detailTab === 'overview' && (
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Address</div>
                      <div style={{ fontSize: '13px', color: '#1e293b' }}>{detailView.address || 'N/A'}</div>
                    </div>
                    <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Phone</div>
                      <a href={'tel:' + detailView.phone} style={{ fontSize: '15px', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>{detailView.phone || 'N/A'}</a>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Status</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{statuses.find(s => s.key === detailView.status)?.label || detailView.status}</div>
                    </div>
                    <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Next Action</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{actions.find(a => a.key === detailView.action)?.label || detailView.action}</div>
                    </div>
                    <div style={{ padding: '16px', background: '#f9fafb', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>Target Week</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{activeWeeks.find((w: any) => w.num === detailView.targetWeek)?.label || `Week ${detailView.targetWeek}`}</div>
                    </div>
                  </div>
                  {assessmentsMap[detailView.id] && (
                    <div style={{ padding: '16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase', marginBottom: '6px' }}>TG Customer Score</div>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b' }}>{assessmentsMap[detailView.id]}/100</div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                    <button onClick={() => { setAssessmentCustomer(detailView); setShowAssessment(true); }} style={{ ...btn, fontSize: '13px' }}>Score Prospect</button>
                    {isOwner && (
                      <button onClick={() => setDeletingProspect(detailView)} style={{ ...btn, fontSize: '13px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>Delete Prospect</button>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'contacts' && (
                <div>
                  {(() => {
                    const companyContacts = getCompanyContacts(detailView.id);
                    return companyContacts.length > 0 ? (
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {companyContacts.map((ct: any) => (
                          <div key={ct.id} style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>{ct.name}</div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>{ct.title}</div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '12px' }}>
                              {ct.email && <div><a href={'mailto:' + ct.email} style={{ color: '#2563eb' }}>{ct.email}</a></div>}
                              {ct.phone && <div><a href={'tel:' + ct.phone} style={{ color: '#2563eb' }}>{ct.phone}</a></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '13px' }}>
                        No contacts added yet
                      </div>
                    );
                  })()}
                </div>
              )}

              {detailTab === 'activity' && (
                <div>
                  {/* Quick note entry */}
                  <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && note.trim()) { setSelected(detailView); addNote(); } }}
                      placeholder="Add a note..."
                      style={{ ...input, flex: 1 }}
                    />
                    <button onClick={() => { setSelected(detailView); addNote(); }} disabled={!note.trim()} style={{ ...btn, fontSize: '13px', opacity: note.trim() ? 1 : 0.5 }}>Add</button>
                  </div>
                  {(() => {
                    const companyLogs = getCompanyLogs(detailView.id);
                    return companyLogs.length > 0 ? (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {companyLogs.map((l: any) => (
                          <div key={l.id} style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px' }}>
                            <div style={{ color: '#1e293b' }}>{l.text || l.description}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{new Date(l.time || l.created_at).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '13px' }}>
                        No activity yet
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assessment Scoring Modal */}
      {/* Delete Prospect Confirmation */}
      {deletingProspect && (
        <div style={modalOverlay} onClick={() => setDeletingProspect(null)}>
          <div style={{ ...modal, maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>Delete Prospect?</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                Are you sure you want to delete <strong>{deletingProspect.name}</strong>? This will also remove all associated contacts, opportunities, and activity logs. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setDeletingProspect(null)} style={{ ...btn, background: '#f1f5f9', color: '#475569' }}>Cancel</button>
                <button
                  onClick={() => deleteProspectMutation.mutate(deletingProspect.id)}
                  disabled={deleteProspectMutation.isPending}
                  style={{ ...btn, background: '#dc2626', color: '#fff' }}
                >{deleteProspectMutation.isPending ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssessment && assessmentCustomer && (
        <AssessmentScoring
          customerId={assessmentCustomer.id}
          customerName={assessmentCustomer.name}
          campaignId={campaignId}
          campaignCompanyId={assessmentCustomer.id}
          onClose={() => {
            setShowAssessment(false);
            setAssessmentCustomer(null);
          }}
        />
      )}

      {/* Manage Team Modal */}
      {showManageTeam && (
        <div style={modalOverlay} onClick={() => { setShowManageTeam(false); setRemovingMember(null); }}>
          <div style={{ ...modal, maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Manage Team</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Add or remove team members and reassign their prospects</p>
            </div>
            <div style={{ padding: '24px', maxHeight: 'calc(90vh - 200px)', overflow: 'auto' }}>
              {/* Orphaned Assignments Warning */}
              {orphanedProspects.length > 0 && (
                <div style={{ marginBottom: '20px', padding: '16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
                    {orphanedProspects.length} prospect{orphanedProspects.length !== 1 ? 's' : ''} assigned to removed team member{orphanedNames.length !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '12px', color: '#78716c', marginBottom: '12px' }}>
                    {orphanedNames.map(name => (
                      <span key={name} style={{ display: 'inline-block', padding: '2px 8px', background: '#fef3c7', borderRadius: '4px', marginRight: '6px', marginBottom: '4px' }}>
                        {name} ({activeData.filter((c: any) => c.assignedTo === name).length})
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', whiteSpace: 'nowrap' }}>Reassign all to:</label>
                    <select
                      value={orphanReassignTo}
                      onChange={e => setOrphanReassignTo(e.target.value)}
                      style={input}
                    >
                      <option value="">Select team member...</option>
                      {activeTeam.map((m: string) => <option key={m} value={m}>{m} ({getCompanyCountForMember(m)} current)</option>)}
                    </select>
                    <button
                      onClick={handleReassignOrphans}
                      disabled={!orphanReassignTo}
                      style={{ ...btn, fontSize: '12px', padding: '8px 14px', whiteSpace: 'nowrap', opacity: orphanReassignTo ? 1 : 0.5 }}
                    >
                      Reassign
                    </button>
                  </div>
                </div>
              )}

              {/* Transfer feedback */}
              {transferMessage && (
                <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
                  background: transferMessage.startsWith('Error') ? '#fef2f2' : '#f0fdf4',
                  color: transferMessage.startsWith('Error') ? '#dc2626' : '#16a34a',
                  border: `1px solid ${transferMessage.startsWith('Error') ? '#fecaca' : '#bbf7d0'}`
                }}>
                  {transferMessage}
                </div>
              )}

              {/* Current Team */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>Current Team ({activeTeam.length})</label>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {activeTeam.map((memberName: string) => {
                    const companyCount = getCompanyCountForMember(memberName);
                    const isOwner = dbTeam.find((t: CampaignTeamMember) => t.name === memberName)?.role === 'owner';
                    const dbMember = dbTeam.find((t: CampaignTeamMember) => t.name === memberName) || null;
                    const otherMembers = activeTeam.filter((m: string) => m !== memberName);
                    const transferCount = transferCounts[memberName] || 0;
                    const transferTarget = transferTargets[memberName] || '';
                    return (
                      <div key={memberName} style={{
                        padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '50%',
                              background: isOwner ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'linear-gradient(135deg, #10b981, #059669)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontWeight: 600, fontSize: '14px'
                            }}>
                              {memberName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                                {memberName}
                                {isOwner && <span style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 8px', background: '#dbeafe', color: '#1d4ed8', borderRadius: '10px', fontWeight: 600 }}>OWNER</span>}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {companyCount} prospect{companyCount !== 1 ? 's' : ''} assigned
                                {dbMember?.job_title && ` · ${dbMember.job_title}`}
                              </div>
                            </div>
                          </div>
                          {!isOwner && (
                            <button
                              onClick={() => {
                                const empId = dbMember?.employee_id || null;
                                setRemovingMember({ name: memberName, employeeId: empId });
                                const remaining = activeTeam.filter((m: string) => m !== memberName);
                                setReassignTo(remaining[0] || '');
                              }}
                              style={{
                                padding: '6px 12px', background: '#fef2f2', color: '#dc2626',
                                border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px',
                                fontWeight: 500, cursor: 'pointer'
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {/* Transfer controls */}
                        {companyCount > 0 && otherMembers.length > 0 && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>Transfer</span>
                            <input
                              type="number"
                              min={1}
                              max={companyCount}
                              value={transferCount || ''}
                              onChange={e => setTransferCounts(prev => ({ ...prev, [memberName]: Math.min(parseInt(e.target.value) || 0, companyCount) }))}
                              placeholder="#"
                              style={{ ...input, width: '60px', padding: '4px 8px', fontSize: '12px', textAlign: 'center' as const }}
                            />
                            <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>to</span>
                            <select
                              value={transferTarget}
                              onChange={e => setTransferTargets(prev => ({ ...prev, [memberName]: e.target.value }))}
                              style={{ ...input, width: 'auto', minWidth: '140px', padding: '4px 8px', fontSize: '12px' }}
                            >
                              <option value="">Select...</option>
                              {otherMembers.map((m: string) => (
                                <option key={m} value={m}>{m} ({getCompanyCountForMember(m)})</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleTransferProspects(memberName)}
                              disabled={!transferCount || !transferTarget}
                              style={{
                                padding: '4px 10px', background: transferCount && transferTarget ? '#ea580c' : '#e5e7eb',
                                color: transferCount && transferTarget ? '#fff' : '#9ca3af',
                                border: 'none', borderRadius: '5px', fontSize: '12px',
                                fontWeight: 600, cursor: transferCount && transferTarget ? 'pointer' : 'default',
                                whiteSpace: 'nowrap' as const
                              }}
                            >
                              Transfer
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Redistribute Prospects */}
              {activeTeam.length > 0 && (
                <div style={{ marginBottom: '24px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#0369a1', marginBottom: '4px' }}>Redistribute Prospects</div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                    Set how many prospects each member should get. The owner gets the highest-scoring prospects first.
                  </p>
                  <div style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                    {dbTeam.map((member: CampaignTeamMember) => (
                      <div key={member.employee_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151', minWidth: '140px' }}>
                          {member.name}
                          {member.role === 'owner' && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#1d4ed8' }}>(owner)</span>}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={activeData.length}
                          value={memberTargetCounts[member.employee_id] || ''}
                          onChange={e => setMemberTargetCounts(prev => ({ ...prev, [member.employee_id]: parseInt(e.target.value) || 0 }))}
                          style={{ ...input, width: '70px', padding: '4px 8px', fontSize: '13px', textAlign: 'center' as const }}
                          placeholder="0"
                        />
                        <span style={{ fontSize: '12px', color: '#64748b' }}>prospects</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={handleRedistribute}
                      disabled={redistributing}
                      style={{ ...btn, fontSize: '13px', padding: '8px 16px', opacity: redistributing ? 0.6 : 1 }}
                    >
                      {redistributing ? 'Redistributing...' : 'Redistribute & Regenerate Weeks'}
                    </button>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Total: {Object.values(memberTargetCounts).reduce((sum, c) => sum + c, 0)} / {activeData.length} prospects
                    </span>
                  </div>
                </div>
              )}

              {/* Remove Confirmation */}
              {removingMember && (
                <div style={{ marginBottom: '24px', padding: '16px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626', marginBottom: '12px' }}>
                    Remove {removingMember.name}?
                  </div>
                  {getCompanyCountForMember(removingMember.name) > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                        Reassign {getCompanyCountForMember(removingMember.name)} prospect{getCompanyCountForMember(removingMember.name) !== 1 ? 's' : ''} to:
                      </label>
                      <select
                        value={reassignTo}
                        onChange={e => setReassignTo(e.target.value)}
                        style={input}
                      >
                        {activeTeam
                          .filter((m: string) => m !== removingMember.name)
                          .map((m: string) => <option key={m} value={m}>{m}</option>)
                        }
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleRemoveTeamMember}
                      disabled={teamLoading}
                      style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px', opacity: teamLoading ? 0.6 : 1 }}
                    >
                      {teamLoading ? 'Removing...' : 'Confirm Remove'}
                    </button>
                    <button
                      onClick={() => setRemovingMember(null)}
                      style={btnSecondary}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Add Team Member */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>Add Team Member</label>
                <div style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    placeholder="Search employees by name or title..."
                    style={input}
                  />
                </div>
                {teamSearch.length >= 2 && (
                  <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    {editEmployees
                      .filter(emp => {
                        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                        const search = teamSearch.toLowerCase();
                        return (fullName.includes(search) || (emp.job_title || '').toLowerCase().includes(search));
                      })
                      .filter(emp => {
                        const empName = `${emp.first_name} ${emp.last_name}`;
                        return !activeTeam.includes(empName);
                      })
                      .map(emp => (
                        <div
                          key={emp.id}
                          onClick={() => handleAddTeamMember(emp)}
                          style={{
                            padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                            borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%', background: '#e5e7eb',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 600, color: '#374151'
                          }}>
                            {emp.first_name[0]}{emp.last_name[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{emp.first_name} {emp.last_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{emp.job_title || 'No title'}{emp.email ? ` · ${emp.email}` : ''}</div>
                          </div>
                          <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#10b981', fontWeight: 500 }}>+ Add</div>
                        </div>
                      ))
                    }
                    {editEmployees
                      .filter(emp => {
                        const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
                        const search = teamSearch.toLowerCase();
                        return (fullName.includes(search) || (emp.job_title || '').toLowerCase().includes(search));
                      })
                      .filter(emp => {
                        const empName = `${emp.first_name} ${emp.last_name}`;
                        return !activeTeam.includes(empName);
                      }).length === 0 && (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        No matching employees found
                      </div>
                    )}
                  </div>
                )}
                {teamSearch.length > 0 && teamSearch.length < 2 && (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Type at least 2 characters to search...</div>
                )}
              </div>

              {/* Regeneration Success Message */}
              {regenMessage && (
                <div style={{ marginTop: '16px', padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#166534', marginBottom: '8px' }}>
                    Weekly plan regenerated successfully
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803d', whiteSpace: 'pre-line', fontFamily: 'monospace' }}>
                    {regenMessage}
                  </div>
                  <button
                    onClick={() => setRegenMessage('')}
                    style={{ marginTop: '8px', padding: '4px 10px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={handleRegenerateWeeks}
                title="Redistribute prospects across weeks by tier and score (A-tier first)"
                style={{ ...btnSecondary, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                Regenerate Weeks
              </button>
              <button onClick={() => { setShowManageTeam(false); setRemovingMember(null); setRegenMessage(''); }} style={btn}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Weeks Confirmation Modal */}
      {showRegenConfirm && (
        <div style={modalOverlay} onClick={() => setShowRegenConfirm(false)}>
          <div style={{ ...modal, maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                  &#x1F504;
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Regenerate Weekly Plan</h3>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#374151', lineHeight: 1.5 }}>
                Redistribute all <strong>{activeData.length} prospects</strong> across <strong>{activeWeeks.length} weeks</strong>?
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
                A-tier and high-score prospects will be assigned to earlier weeks. Each team member's prospects will be spread evenly.
              </p>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowRegenConfirm(false)} style={btnSecondary}>Cancel</button>
              <button onClick={executeRegenerateWeeks} style={btn}>Regenerate</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {showEditCampaign && (() => {
        const ef = editForm;
        if (!ef) return null;
        const setEf = (updates: any) => {
          setEditForm({ ...editForm, ...updates });
        };
        const ownerOptions = editEmployees.map(emp => ({
          value: emp.id.toString(),
          label: `${emp.first_name} ${emp.last_name}${emp.job_title ? ` - ${emp.job_title}` : ''}`
        }));
        return (
        <div style={modalOverlay} onClick={() => { setShowEditCampaign(false); setEditForm(null); }}>
          <div style={{ ...modal, maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Edit Campaign</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Update campaign details and settings</p>
            </div>
            <div style={{ padding: '24px', maxHeight: 'calc(90vh - 200px)', overflow: 'auto' }}>
              <div style={{ display: 'grid', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Campaign Name *</label>
                  <input type="text" value={ef.name} onChange={e => setEf({ name: e.target.value })} style={input} placeholder="e.g., Phoenix Division Q1" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Description</label>
                  <textarea value={ef.description} onChange={e => setEf({ description: e.target.value })} style={{ ...input, minHeight: '80px', resize: 'vertical' }} placeholder="Describe the campaign objectives and scope..." />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Start Date</label>
                    <input type="date" value={ef.startDate} onChange={e => setEf({ startDate: e.target.value })} style={input} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>End Date</label>
                    <input type="date" value={ef.endDate} onChange={e => setEf({ endDate: e.target.value })} style={input} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Campaign Goal</label>
                  <textarea value={ef.goal} onChange={e => setEf({ goal: e.target.value })} style={{ ...input, minHeight: '60px', resize: 'vertical' }} placeholder="What is the primary objective of this campaign?" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Target Pipeline Value ($)</label>
                    <input type="number" value={ef.targetValue} onChange={e => setEf({ targetValue: parseInt(e.target.value) || 0 })} style={input} placeholder="e.g., 500000" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Status</label>
                    <select value={ef.status} onChange={e => setEf({ status: e.target.value })} style={input}>
                      <option value="planning">Planning</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Campaign Owner</label>
                  <SearchableSelect
                    options={ownerOptions}
                    value={ef.ownerId?.toString() || ''}
                    onChange={(val) => setEf({ ownerId: val ? parseInt(val) : null })}
                    placeholder="Search and select owner..."
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Target Touchpoints</label>
                    <input type="number" min="0" value={ef.targetTouchpoints || ''} onChange={e => setEf({ targetTouchpoints: parseInt(e.target.value) || 0 })} style={input} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Target Opportunities</label>
                    <input type="number" min="0" value={ef.targetOpportunities || ''} onChange={e => setEf({ targetOpportunities: parseInt(e.target.value) || 0 })} style={input} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Target Estimates</label>
                    <input type="number" min="0" value={ef.targetEstimates || ''} onChange={e => setEf({ targetEstimates: parseInt(e.target.value) || 0 })} style={input} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Target Awards</label>
                    <input type="number" min="0" value={ef.targetAwards || ''} onChange={e => setEf({ targetAwards: parseInt(e.target.value) || 0 })} style={input} />
                  </div>
                </div>

                {/* Campaign Summary */}
                <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '16px', marginTop: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>Campaign Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Duration</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                        {ef.startDate && ef.endDate ? Math.ceil((new Date(ef.endDate).getTime() - new Date(ef.startDate).getTime()) / (1000 * 60 * 60 * 24 * 7)) : 0} weeks
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Prospects</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{activeData.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Target Value</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#10b981' }}>${(ef.targetValue || 0).toLocaleString('en-US')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowEditCampaign(false); setEditForm(null); }} style={btnSecondary}>Cancel</button>
              <button
                onClick={() => saveEditCampaign(true)}
                disabled={updateCampaignMutation.isPending}
                style={{ ...btnSecondary, border: '1px solid #ea580c', color: '#ea580c', opacity: updateCampaignMutation.isPending ? 0.6 : 1 }}
                title="Save changes and regenerate weekly schedule based on new dates"
              >
                {updateCampaignMutation.isPending ? 'Saving...' : 'Save & Regenerate Weeks'}
              </button>
              <button
                onClick={() => saveEditCampaign(false)}
                disabled={updateCampaignMutation.isPending}
                style={{ ...btn, opacity: updateCampaignMutation.isPending ? 0.6 : 1 }}
              >
                {updateCampaignMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
