import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { Opportunity as OpportunityType } from '../services/opportunities';
import OpportunityModal from '../components/opportunities/OpportunityModal';
import AssessmentScoring from '../components/assessments/AssessmentScoring';
import { assessmentsApi } from '../services/assessments';
import {
  getCampaign, updateCampaign,
  getCampaignCompanies, getCampaignWeeks, getCampaignTeam, getCampaignActivity,
  createCampaignCompany, updateCampaignCompanyStatus, updateCampaignCompanyAction,
  addCampaignNote, getTeamEligibleEmployees, downloadCampaignReport, regenerateCampaignWeeks,
  addTeamMember, removeTeamMember, reassignCompanies,
  CampaignCompany, CampaignWeek, CampaignTeamMember, CampaignActivityLog, TeamEligibleEmployee
} from '../services/campaigns';
import SearchableSelect from '../components/SearchableSelect';
import '../styles/SalesPipeline.css';

const weeks = [
  { num: 1, start: 'Feb 2', end: 'Feb 8', label: 'Feb 2 - 8' },
  { num: 2, start: 'Feb 9', end: 'Feb 15', label: 'Feb 9 - 15' },
  { num: 3, start: 'Feb 16', end: 'Feb 22', label: 'Feb 16 - 22' },
  { num: 4, start: 'Feb 23', end: 'Mar 1', label: 'Feb 23 - Mar 1' },
  { num: 5, start: 'Mar 2', end: 'Mar 8', label: 'Mar 2 - 8' },
  { num: 6, start: 'Mar 9', end: 'Mar 15', label: 'Mar 9 - 15' }
];

const initCompanies = [
  { id: 1, name: "SK Food Group", sector: "Food Processing", score: 90, tier: "A", assignedTo: "Brian Smith", address: "790 S. 75th Ave, Tolleson, AZ 85353", phone: "(206) 935-8100", status: "prospect", action: "none", targetWeek: 1 },
  { id: 2, name: "United Dairymen of Arizona", sector: "Dairy Processing", score: 90, tier: "A", assignedTo: "Brian Smith", address: "2008 S. Hardy Dr, Tempe, AZ 85282", phone: "(480) 966-7211", status: "prospect", action: "none", targetWeek: 2 },
  { id: 3, name: "Microchip Technology", sector: "Semiconductor", score: 88, tier: "A", assignedTo: "Brian Smith", address: "2355 W. Chandler Blvd, Chandler, AZ 85224", phone: "(480) 792-7200", status: "prospect", action: "none", targetWeek: 1 },
  { id: 4, name: "Shamrock Foods", sector: "Dairy/Food", score: 88, tier: "A", assignedTo: "Brian Smith", address: "2540 N. 29th Ave, Phoenix, AZ 85009", phone: "(602) 233-6400", status: "prospect", action: "none", targetWeek: 2 },
  { id: 5, name: "Northrop Grumman SMF", sector: "Satellite Mfg", score: 88, tier: "A", assignedTo: "Cory Wile", address: "1575 N. Voyager Ave, Gilbert, AZ 85234", phone: "(480) 425-6000", status: "prospect", action: "none", targetWeek: 1 },
  { id: 6, name: "Footprint LLC", sector: "Sustainable Packaging", score: 87, tier: "A", assignedTo: "Brian Wohlers", address: "250 E. Germann Rd, Gilbert, AZ 85297", phone: "(480) 456-9000", status: "prospect", action: "none", targetWeek: 1 },
  { id: 7, name: "Swire Coca-Cola", sector: "Beverage Bottling", score: 86, tier: "A", assignedTo: "Cory Wile", address: "1850 E. University Dr, Tempe, AZ 85281", phone: "(480) 775-7000", status: "prospect", action: "none", targetWeek: 2 },
  { id: 8, name: "Stryker Sustainability", sector: "Medical Device", score: 85, tier: "A", assignedTo: "Brian Wohlers", address: "2681 S. Alma School Rd, Chandler, AZ 85286", phone: "(480) 792-1450", status: "prospect", action: "none", targetWeek: 1 },
  { id: 9, name: "Boeing Mesa", sector: "Aerospace Mfg", score: 85, tier: "A", assignedTo: "Cory Wile", address: "5000 E. McDowell Rd, Mesa, AZ 85215", phone: "(480) 891-3000", status: "prospect", action: "none", targetWeek: 1 },
  { id: 10, name: "Benchmark Electronics", sector: "Electronics", score: 85, tier: "A", assignedTo: "Brian Wohlers", address: "3201 S. 38th St, Tempe, AZ 85282", phone: "(480) 634-5700", status: "prospect", action: "none", targetWeek: 1 },
  { id: 11, name: "Honeywell Aerospace HQ", sector: "Aerospace", score: 84, tier: "A", assignedTo: "Brian Smith", address: "1944 E. Sky Harbor Circle, Phoenix, AZ 85034", phone: "(602) 365-3099", status: "prospect", action: "none", targetWeek: 3 },
  { id: 12, name: "SanTan Brewing", sector: "Beverage Production", score: 82, tier: "A", assignedTo: "Cory Wile", address: "495 E. Warner Rd, Chandler, AZ 85225", phone: "(480) 534-7041", status: "prospect", action: "none", targetWeek: 2 },
  { id: 13, name: "XNRGY Climate Solutions", sector: "HVAC Mfg", score: 82, tier: "A", assignedTo: "Cory Wile", address: "8501 E. Raintree Dr, Mesa, AZ 85212", phone: "(480) 830-0800", status: "prospect", action: "none", targetWeek: 2 },
  { id: 14, name: "Meyer Burger", sector: "Solar Mfg", score: 82, tier: "A", assignedTo: "Brian Wohlers", address: "16701 W. Commerce Dr, Goodyear, AZ 85338", phone: "(623) 386-7700", status: "prospect", action: "none", targetWeek: 2 },
  { id: 15, name: "Amkor Technology", sector: "Semiconductor", score: 82, tier: "A", assignedTo: "Brian Wohlers", address: "2045 E. Innovation Circle, Tempe, AZ 85284", phone: "(480) 821-5000", status: "prospect", action: "none", targetWeek: 2 },
  { id: 16, name: "First Solar", sector: "Solar Mfg", score: 80, tier: "A", assignedTo: "Cory Wile", address: "350 W. Washington St #600, Tempe, AZ 85281", phone: "(602) 414-9300", status: "prospect", action: "none", targetWeek: 2 },
  { id: 17, name: "Precision Aerospace", sector: "Aerospace", score: 80, tier: "A", assignedTo: "Cory Wile", address: "4020 E. Cotton Center Blvd, Phoenix, AZ 85040", phone: "(602) 243-1500", status: "prospect", action: "none", targetWeek: 2 },
  { id: 18, name: "Capistrano's Bakery", sector: "Bakery Mfg", score: 78, tier: "B", assignedTo: "Cory Wile", address: "2635 S. 24th St, Phoenix, AZ 85034", phone: "(480) 968-0468", status: "prospect", action: "none", targetWeek: 3 },
  { id: 19, name: "Honeywell (Tempe)", sector: "Aerospace", score: 78, tier: "B", assignedTo: "Brian Wohlers", address: "1300 W. Warner Rd, Tempe, AZ 85284", phone: "(480) 592-3000", status: "prospect", action: "none", targetWeek: 3 },
  { id: 20, name: "Edwards Vacuum", sector: "Semiconductor Equip", score: 78, tier: "B", assignedTo: "Brian Wohlers", address: "301 S. Roosevelt Ave, Chandler, AZ 85226", phone: "(480) 961-4000", status: "prospect", action: "none", targetWeek: 2 },
  { id: 21, name: "AZ Wilderness Brewing", sector: "Brewery", score: 77, tier: "B", assignedTo: "Cory Wile", address: "721 N. Arizona Ave, Gilbert, AZ 85233", phone: "(480) 284-9863", status: "prospect", action: "none", targetWeek: 3 },
  { id: 22, name: "Liberty Paper Products", sector: "Paper Products", score: 76, tier: "B", assignedTo: "Brian Wohlers", address: "2701 E. Chambers St, Phoenix, AZ 85040", phone: "(602) 276-2891", status: "prospect", action: "none", targetWeek: 3 },
  { id: 23, name: "JX Nippon Mining", sector: "Electronics Materials", score: 76, tier: "B", assignedTo: "Brian Wohlers", address: "1235 S. Power Rd, Mesa, AZ 85206", phone: "(480) 832-9950", status: "prospect", action: "none", targetWeek: 3 },
  { id: 24, name: "Arizona Foods Group", sector: "Food Mfg", score: 76, tier: "B", assignedTo: "Cory Wile", address: "2111 W. Camelback Rd, Phoenix, AZ 85015", phone: "(602) 242-0808", status: "prospect", action: "none", targetWeek: 4 },
  { id: 25, name: "General Dynamics C4", sector: "Defense", score: 75, tier: "B", assignedTo: "Brian Wohlers", address: "8220 E. Roosevelt St, Scottsdale, AZ 85257", phone: "(480) 441-4000", status: "prospect", action: "none", targetWeek: 3 },
  { id: 26, name: "Phoenix Defense", sector: "Aerospace", score: 75, tier: "B", assignedTo: "Cory Wile", address: "1455 N. Greenfield Rd, Gilbert, AZ 85234", phone: "(480) 503-7600", status: "prospect", action: "none", targetWeek: 3 },
  { id: 27, name: "Cytec Engineered", sector: "Composites", score: 75, tier: "B", assignedTo: "Cory Wile", address: "1300 E. University Dr, Tempe, AZ 85281", phone: "(480) 730-2000", status: "prospect", action: "none", targetWeek: 3 },
  { id: 28, name: "Stern Produce", sector: "Food Distribution", score: 75, tier: "B", assignedTo: "Cory Wile", address: "2640 S. 19th Ave, Phoenix, AZ 85009", phone: "(602) 253-3328", status: "prospect", action: "none", targetWeek: 4 },
  { id: 29, name: "Lineage Logistics", sector: "Cold Storage", score: 74, tier: "B", assignedTo: "Brian Wohlers", address: "17651 W. Yuma Rd, Waddell, AZ 85355", phone: "(623) 535-8600", status: "prospect", action: "none", targetWeek: 4 },
  { id: 30, name: "Romac Industries", sector: "Pipeline Mfg", score: 74, tier: "B", assignedTo: "Cory Wile", address: "1501 N. Litchfield Rd, Goodyear, AZ 85338", phone: "(623) 932-3777", status: "prospect", action: "none", targetWeek: 4 },
  { id: 31, name: "Modern Industries", sector: "Aerospace", score: 74, tier: "B", assignedTo: "Brian Wohlers", address: "4302 E. Elwood St, Phoenix, AZ 85040", phone: "(602) 268-7773", status: "prospect", action: "none", targetWeek: 4 },
  { id: 32, name: "Innovia Manufacturing", sector: "Metal Fabrication", score: 74, tier: "B", assignedTo: "Cory Wile", address: "4330 W. Chandler Blvd, Chandler, AZ 85226", phone: "(480) 785-4400", status: "prospect", action: "none", targetWeek: 3 },
  { id: 33, name: "Danzeisen Dairy", sector: "Dairy Processing", score: 73, tier: "B", assignedTo: "Cory Wile", address: "3625 W. Dobbins Rd, Laveen, AZ 85339", phone: "(602) 237-3565", status: "prospect", action: "none", targetWeek: 4 },
  { id: 34, name: "Verigon Electronics", sector: "Contract Mfg", score: 72, tier: "B", assignedTo: "Brian Wohlers", address: "2133 W. University Dr, Tempe, AZ 85281", phone: "(480) 921-0600", status: "prospect", action: "none", targetWeek: 4 },
  { id: 35, name: "GTI Energy", sector: "Manufacturing", score: 72, tier: "B", assignedTo: "Cory Wile", address: "16920 W. Roosevelt St, Goodyear, AZ 85338", phone: "(623) 932-0600", status: "prospect", action: "none", targetWeek: 5 },
  { id: 36, name: "Arcadia Cold Storage", sector: "Cold Storage", score: 72, tier: "B", assignedTo: "Cory Wile", address: "14450 W. Olive Ave, El Mirage, AZ 85335", phone: "(623) 935-3400", status: "prospect", action: "none", targetWeek: 4 },
  { id: 37, name: "TurbineAero", sector: "Aerospace MRO", score: 72, tier: "B", assignedTo: "Brian Wohlers", address: "1651 E. Northrop Blvd, Chandler, AZ 85286", phone: "(480) 659-7800", status: "prospect", action: "none", targetWeek: 5 },
  { id: 38, name: "Huss Brewing", sector: "Brewery", score: 72, tier: "B", assignedTo: "Brian Wohlers", address: "100 E. Camelback Rd, Tempe, AZ 85281", phone: "(480) 264-4844", status: "prospect", action: "none", targetWeek: 5 },
  { id: 39, name: "La Canasta Mexican", sector: "Food Mfg", score: 71, tier: "B", assignedTo: "Cory Wile", address: "3715 W. McDowell Rd, Phoenix, AZ 85009", phone: "(602) 269-9210", status: "prospect", action: "none", targetWeek: 5 },
  { id: 40, name: "Sub-Zero Group", sector: "Appliance Mfg", score: 70, tier: "B", assignedTo: "Brian Wohlers", address: "16651 W. Yuma Rd, Goodyear, AZ 85338", phone: "(623) 935-6800", status: "prospect", action: "none", targetWeek: 5 }
];

const initContacts = [
  { id: 1, companyId: 1, name: "Michael Chen", title: "Plant Manager", email: "mchen@skfood.com", phone: "(206) 935-8101", isPrimary: true },
  { id: 2, companyId: 1, name: "Sarah Johnson", title: "Operations Director", email: "sjohnson@skfood.com", phone: "(206) 935-8102", isPrimary: false },
  { id: 3, companyId: 2, name: "Robert Garcia", title: "Facilities Manager", email: "rgarcia@uda.com", phone: "(480) 966-7212", isPrimary: true },
  { id: 4, companyId: 3, name: "Jennifer Lee", title: "VP Operations", email: "jlee@microchip.com", phone: "(480) 792-7201", isPrimary: true },
  { id: 5, companyId: 3, name: "David Miller", title: "Procurement Manager", email: "dmiller@microchip.com", phone: "(480) 792-7203", isPrimary: false },
  { id: 6, companyId: 4, name: "Amanda White", title: "Plant Director", email: "awhite@shamrock.com", phone: "(602) 233-6401", isPrimary: true },
  { id: 7, companyId: 5, name: "James Wilson", title: "Facilities Director", email: "jwilson@ngc.com", phone: "(480) 425-6001", isPrimary: true },
  { id: 8, companyId: 6, name: "Lisa Anderson", title: "Operations Manager", email: "landerson@footprint.com", phone: "(480) 456-9001", isPrimary: true },
  { id: 9, companyId: 7, name: "Thomas Brown", title: "Maintenance Director", email: "tbrown@swirecc.com", phone: "(480) 775-7001", isPrimary: true },
  { id: 10, companyId: 8, name: "Emily Davis", title: "Engineering Manager", email: "edavis@stryker.com", phone: "(480) 792-1451", isPrimary: true }
];


const initEstimates = [
  { id: 1, companyId: 3, oppId: 2, number: "EST-2025-001", name: "Cleanroom HVAC - Phase 1", amount: 275000, status: "sent", sentDate: "2025-02-01", validUntil: "2025-03-01" },
  { id: 2, companyId: 3, oppId: 2, number: "EST-2025-002", name: "Cleanroom HVAC - Full Scope", amount: 450000, status: "pending", sentDate: null, validUntil: null },
  { id: 3, companyId: 5, oppId: 3, number: "EST-2025-003", name: "Testing Chamber Controls", amount: 280000, status: "sent", sentDate: "2025-01-28", validUntil: "2025-02-28" },
  { id: 4, companyId: 1, oppId: 1, number: "EST-2025-004", name: "Freezer System - Budget", amount: 95000, status: "draft", sentDate: null, validUntil: null }
];

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

const team = ['Brian Smith', 'Brian Wohlers', 'Cory Wile'];
const sectors = [...new Set(initCompanies.map(c => c.sector))].sort();

const save = (k: string, v: any) => { try { localStorage.setItem('phx3_' + k, JSON.stringify(v)); } catch(e){} };
const load = (k: string, d: any) => { try { const v = localStorage.getItem('phx3_' + k); return v ? JSON.parse(v) : d; } catch(e) { return d; } };

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(() => load('data', initCompanies));
  const [contacts, setContacts] = useState(() => load('contacts', initContacts));
  const [estimates, setEstimates] = useState(() => load('estimates', initEstimates));
  const [logs, setLogs] = useState<any[]>(() => load('logs', []));

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

  // Fetch assessments for all customers to show TG Cust. Score
  const { data: assessmentsMap = {} } = useQuery({
    queryKey: ['campaign-assessments', id],
    queryFn: async () => {
      const map: Record<number, number> = {};
      // Fetch assessment for each customer
      for (const company of data) {
        try {
          const response = await assessmentsApi.getCurrent(company.id);
          if (response.data) {
            map[company.id] = response.data.total_score;
          }
        } catch (error) {
          // Customer doesn't have an assessment yet
        }
      }
      return map;
    },
    enabled: !!id && data.length > 0,
    staleTime: 30000, // Cache for 30 seconds
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

  // Determine if this is the legacy Phoenix campaign (localStorage-based) or a DB campaign
  const isLegacyPhoenix = useMemo(() => {
    try {
      const saved = localStorage.getItem('phx3_data');
      return saved !== null && (dbCampaign?.name?.includes('Phoenix') || !dbCampaign);
    } catch { return false; }
  }, [dbCampaign]);

  // Unified data accessors
  const activeData = useMemo(() => {
    if (dbCompanies.length > 0) {
      return dbCompanies.map((c: CampaignCompany) => ({
        id: c.id, name: c.name, sector: c.sector || '', score: c.score, tier: c.tier,
        assignedTo: c.assigned_to_name || 'Unassigned', address: c.address || '', phone: c.phone || '',
        status: c.status, action: c.next_action, targetWeek: c.target_week
      }));
    }
    if (isLegacyPhoenix) return data;
    return [];
  }, [isLegacyPhoenix, data, dbCompanies]);

  const activeWeeks = useMemo(() => {
    if (dbWeeks.length > 0) {
      return dbWeeks.map((w: CampaignWeek) => ({
        num: w.week_number,
        start: new Date(w.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        end: new Date(w.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        label: w.label || `Week ${w.week_number}`
      }));
    }
    if (isLegacyPhoenix) return weeks;
    return [];
  }, [isLegacyPhoenix, dbWeeks]);

  // DB mutations for non-legacy campaigns
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

  const addProspectMutation = useMutation({
    mutationFn: (prospectData: any) => createCampaignCompany(campaignId, prospectData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-companies', campaignId] });
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

  // Fetch employees for team management (all campaigns)
  const { data: editEmployees = [] } = useQuery({
    queryKey: ['campaign-team-eligible'],
    queryFn: getTeamEligibleEmployees
  });

  // Edit form state (separate from activeCampaignInfo to avoid mutating display data)
  const [editForm, setEditForm] = useState<any>(null);

  const openEditModal = () => {
    if (isLegacyPhoenix) {
      // Legacy: edit campaignInfo directly
      setShowEditCampaign(true);
    } else {
      // DB campaign: populate edit form from DB data
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
    }
  };

  const saveEditCampaign = async (andRegenerateWeeks = false) => {
    const ef = isLegacyPhoenix ? campaignInfo : editForm;
    if (!ef) return;

    try {
      // Always persist to DB (campaign ID from URL)
      await updateCampaignMutation.mutateAsync({
        name: ef.name,
        description: ef.description,
        start_date: isLegacyPhoenix ? ef.startDate : ef.startDate,
        end_date: isLegacyPhoenix ? ef.endDate : ef.endDate,
        status: ef.status || 'planning',
        owner_id: isLegacyPhoenix ? undefined : ef.ownerId,
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
    const empName = `${emp.first_name} ${emp.last_name}`;
    if (isLegacyPhoenix) {
      // Legacy: add name to assignedTeam and save
      const currentTeam = campaignInfo.assignedTeam || [];
      if (!currentTeam.includes(empName)) {
        setCampaignInfo({ ...campaignInfo, assignedTeam: [...currentTeam, empName] });
      }
    } else {
      // DB campaign: call API
      try {
        setTeamLoading(true);
        await addTeamMember(campaignId, emp.id, 'member');
        queryClient.invalidateQueries({ queryKey: ['campaign-team', campaignId] });
      } catch (err) {
        console.error('Failed to add team member:', err);
      } finally {
        setTeamLoading(false);
      }
    }
    setTeamSearch('');
  };

  const handleRemoveTeamMember = async () => {
    if (!removingMember) return;
    const { name, employeeId } = removingMember;
    const targetName = reassignTo;

    if (isLegacyPhoenix) {
      // Legacy: reassign companies to new person, then remove from team
      if (targetName) {
        setData((d: any) => d.map((c: any) =>
          c.assignedTo === name ? { ...c, assignedTo: targetName } : c
        ));
      }
      // Use functional updater to avoid stale closure
      setCampaignInfo((prev: any) => ({
        ...prev,
        assignedTeam: (prev.assignedTeam || []).filter((m: string) => m !== name)
      }));
    } else if (employeeId) {
      // DB campaign: reassign then remove
      try {
        setTeamLoading(true);
        // Find the employee_id for the reassign target (check dbTeam first, then editEmployees)
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

  const handleTransferProspects = (fromName: string) => {
    const count = transferCounts[fromName] || 0;
    const toName = transferTargets[fromName] || '';
    if (!count || !toName || count <= 0) return;

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
    const transferIds = new Set(toTransfer.map((c: any) => c.id));

    if (isLegacyPhoenix) {
      setData((d: any) => d.map((c: any) =>
        transferIds.has(c.id) ? { ...c, assignedTo: toName } : c
      ));
    }
    // Clear the transfer inputs for this member
    setTransferCounts(prev => ({ ...prev, [fromName]: 0 }));
    setTransferTargets(prev => ({ ...prev, [fromName]: '' }));
  };

  // Regenerate weekly plan: redistribute targetWeek values evenly across weeks
  const [regenMessage, setRegenMessage] = useState('');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const handleRegenerateWeeks = () => {
    const totalWeeks = isLegacyPhoenix ? weeks.length : activeWeeks.length;
    if (totalWeeks === 0) return;
    setShowRegenConfirm(true);
  };
  const executeRegenerateWeeks = () => {
    setShowRegenConfirm(false);
    const totalWeeks = isLegacyPhoenix ? weeks.length : activeWeeks.length;
    if (isLegacyPhoenix) {
      // Group prospects by team member, then distribute each member's prospects evenly across weeks
      const currentData = [...data];
      const byMember: Record<string, any[]> = {};
      currentData.forEach((c: any) => {
        const member = c.assignedTo || 'Unassigned';
        if (!byMember[member]) byMember[member] = [];
        byMember[member].push(c);
      });

      const weekAssignments: Record<number, number> = {};

      // For each team member, sort their prospects by tier/score and spread across weeks
      Object.values(byMember).forEach(memberProspects => {
        memberProspects.sort((a: any, b: any) => {
          const tierOrder: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2 };
          const tierDiff = (tierOrder[a.tier] || 1) - (tierOrder[b.tier] || 1);
          if (tierDiff !== 0) return tierDiff;
          return (b.score || 0) - (a.score || 0);
        });

        const perWeek = Math.ceil(memberProspects.length / totalWeeks);
        memberProspects.forEach((c: any, i: number) => {
          weekAssignments[c.id] = Math.min(Math.floor(i / perWeek) + 1, totalWeeks);
        });
      });

      // Build summary before updating - show per-member breakdown
      const memberSummaries = Object.entries(byMember).map(([name, prospects]) => {
        const weekBreakdown = Array.from({ length: totalWeeks }, (_, i) => {
          const count = prospects.filter((c: any) => weekAssignments[c.id] === i + 1).length;
          return count;
        });
        return `${name}: ${weekBreakdown.join(' / ')} (${prospects.length} total)`;
      });
      const weekLabels = weeks.map(w => `Wk${w.num}`).join(' / ');
      const summary = `Distribution by ${weekLabels}:\n\n${memberSummaries.join('\n')}`;

      setData((d: any) => d.map((c: any) => ({
        ...c,
        targetWeek: weekAssignments[c.id] !== undefined ? weekAssignments[c.id] : c.targetWeek
      })));

      setRegenMessage(summary);
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

  // Campaign info state
  const [campaignInfo, setCampaignInfo] = useState(() => load('campaignInfo', {
    name: 'Phoenix Division',
    description: '6-Week Sales Campaign targeting industrial and manufacturing prospects in the Phoenix metropolitan area.',
    startDate: '2025-02-02',
    endDate: '2025-03-15',
    goal: 'Contact 40 high-value prospects and generate 5+ new opportunities',
    targetValue: 500000,
    assignedTeam: ['Brian Smith', 'Brian Wohlers', 'Cory Wile'],
    status: 'active',
    owner: 'Brian Smith'
  }));

  useEffect(() => {
    save('campaignInfo', campaignInfo);
  }, [campaignInfo]);

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
    if (isLegacyPhoenix) return campaignInfo;
    return { name: '', description: '', startDate: '', endDate: '', goal: '', targetValue: 0, assignedTeam: [] as string[], status: 'planning', owner: '' };
  }, [isLegacyPhoenix, campaignInfo, dbCampaign, dbTeam]);

  const activeLogs = useMemo(() => {
    if (dbActivity.length > 0) {
      return dbActivity.map((l: CampaignActivityLog) => ({
        id: l.id, cid: l.campaign_company_id, text: l.description,
        time: l.created_at, name: l.company_name || l.user_name || ''
      }));
    }
    if (isLegacyPhoenix) return logs;
    return [];
  }, [isLegacyPhoenix, logs, dbActivity]);

  const activeTeam = useMemo(() => {
    if (dbTeam.length > 0) return dbTeam.map((t: CampaignTeamMember) => t.name);
    if (isLegacyPhoenix) return campaignInfo.assignedTeam || team;
    return [];
  }, [isLegacyPhoenix, dbTeam, campaignInfo.assignedTeam]);

  // Detect orphaned prospects (assigned to someone not on the active team)
  const orphanedProspects = useMemo(() => {
    return activeData.filter((c: any) => c.assignedTo && !activeTeam.includes(c.assignedTo));
  }, [activeData, activeTeam]);

  const orphanedNames = useMemo(() => {
    const names = new Set(orphanedProspects.map((c: any) => c.assignedTo));
    return Array.from(names) as string[];
  }, [orphanedProspects]);

  const [orphanReassignTo, setOrphanReassignTo] = useState('');

  const handleReassignOrphans = () => {
    if (!orphanReassignTo || orphanedProspects.length === 0) return;
    if (isLegacyPhoenix) {
      setData((d: any) => d.map((c: any) =>
        c.assignedTo && !activeTeam.includes(c.assignedTo)
          ? { ...c, assignedTo: orphanReassignTo }
          : c
      ));
    }
    // DB campaigns would handle this via the reassign API per orphaned name
    setOrphanReassignTo('');
  };

  const [newCustomer, setNewCustomer] = useState({ name: '', sector: '', address: '', phone: '', assignedTo: team[0], tier: 'B', score: 70, targetWeek: 1 });
  const [newContact, setNewContact] = useState({ companyId: '', name: '', title: '', email: '', phone: '', isPrimary: false });
  const [newEstimate, setNewEstimate] = useState({ companyId: '', oppId: '', name: '', amount: '', status: 'draft' });

  useEffect(() => {
    save('data', data);
    save('logs', logs);
    save('contacts', contacts);
    save('estimates', estimates);
  }, [data, logs, contacts, estimates]);

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
    if (isLegacyPhoenix) {
      setData((d: any) => d.map((c: any) => c.id === companyId ? {...c, [field]: value} : c));
      const co = data.find((c: any) => c.id === companyId);
      const label = field === 'status' ? statuses.find(s=>s.key===value)?.label : actions.find(a=>a.key===value)?.label;
      setLogs((l: any) => [{ id: Date.now(), cid: companyId, text: `${field === 'status' ? 'Status' : 'Action'} → ${label}`, time: new Date().toISOString(), name: co?.name }, ...l]);
    } else {
      if (field === 'status') {
        statusMutation.mutate({ companyId, status: value });
      } else if (field === 'action') {
        actionMutation.mutate({ companyId, action: value });
      }
    }
  };

  const addNote = () => {
    if (!note.trim() || !selected) return;
    if (isLegacyPhoenix) {
      setLogs((l: any) => [{ id: Date.now(), cid: selected.id, text: note, time: new Date().toISOString(), name: selected.name }, ...l]);
    } else {
      addNoteMutation.mutate({ companyId: selected.id, note: note.trim() });
    }
    setNote('');
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name.trim()) return;
    if (isLegacyPhoenix) {
      const newId = Math.max(...data.map((c: any) => c.id)) + 1;
      const customer = { ...newCustomer, id: newId, status: 'prospect', action: 'none' };
      setData([...data, customer]);
      setLogs((l: any) => [{ id: Date.now(), cid: newId, text: 'New prospect added', time: new Date().toISOString(), name: customer.name }, ...l]);
    } else {
      addProspectMutation.mutate({
        name: newCustomer.name,
        sector: newCustomer.sector,
        address: newCustomer.address,
        phone: newCustomer.phone,
        tier: newCustomer.tier,
        score: newCustomer.score,
        target_week: newCustomer.targetWeek
      });
    }
    setNewCustomer({ name: '', sector: '', address: '', phone: '', assignedTo: activeTeam[0] || '', tier: 'B', score: 70, targetWeek: 1 });
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
  const getCompanyLogs = (companyId: number) => logs.filter((l: any) => l.cid === companyId);

  const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
  const modal: React.CSSProperties = { background: '#fff', borderRadius: '16px', maxWidth: '600px', width: '95%', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };
  const detailModal: React.CSSProperties = { ...modal, maxWidth: '900px' };

  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e5e5e5', padding: '12px 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/campaigns')}
              style={{ padding: '8px', background: '#f3f4f6', color: '#64748b', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Back to Campaigns"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #ea580c, #dc2626)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>{activeCampaignInfo.name.charAt(0) || '?'}</div>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{activeCampaignInfo.name}</h1>
              <p style={{ fontSize: '12px', color: '#64748b' }}>
                {activeCampaignInfo.startDate ? new Date(activeCampaignInfo.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} - {activeCampaignInfo.endDate ? new Date(activeCampaignInfo.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
              </p>
            </div>
            <button
              onClick={openEditModal}
              style={{ marginLeft: '8px', padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
            <button
              onClick={() => { setShowManageTeam(true); setTeamSearch(''); setRemovingMember(null); }}
              style={{ padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
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
              onClick={async () => {
                setDownloadingReport(true);
                try {
                  await downloadCampaignReport(campaignId, activeCampaignInfo.name || 'Campaign');
                } catch (err) {
                  alert('Failed to generate report. Please try again.');
                } finally {
                  setDownloadingReport(false);
                }
              }}
              disabled={downloadingReport}
              style={{ padding: '6px 12px', background: downloadingReport ? '#e5e7eb' : '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: downloadingReport ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', opacity: downloadingReport ? 0.7 : 1 }}
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
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {['dashboard', 'weekly', 'prospects', 'opportunities', 'goals'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? '#ea580c' : 'transparent', color: tab === t ? '#fff' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '13px' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            <div style={{ width: '1px', height: '24px', background: '#e5e7eb', margin: '0 8px' }} />
            <button onClick={() => setShowNewCustomer(true)} style={{ ...btn, fontSize: '12px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '16px' }}>+</span> New Prospect
            </button>
            <button onClick={() => setIsOpportunityModalOpen(true)} style={{ ...btnSecondary, fontSize: '12px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '16px' }}>+</span> New Opportunity
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>

        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Total Prospects', value: activeData.length, color: '#6366f1' },
                { label: 'Contacted', value: stats.contacted, color: '#3b82f6' },
                { label: 'New Opportunities', value: stats.opportunities, color: '#10b981' },
                { label: 'Opportunities Value', value: '$' + stats.totalOppValue.toLocaleString('en-US'), color: '#8b5cf6' },
                { label: 'Follow Up Needed', value: stats.byStatus.follow_up || 0, color: '#f59e0b' }
              ].map((k, i) => (
                <div key={i} style={{ ...card, padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>{k.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ ...card, padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>Status Breakdown</h3>
                {statuses.map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                    <span style={{ flex: 1, fontSize: '13px' }}>{s.label}</span>
                    <span style={{ fontWeight: 600, color: s.color }}>{stats.byStatus[s.key]}</span>
                  </div>
                ))}
              </div>

              <div style={{ ...card, padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: '#374151' }}>Recent Activity</h3>
                <div style={{ maxHeight: '220px', overflow: 'auto' }}>
                  {activeLogs.slice(0, 12).map((l: any) => (
                    <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                      <span style={{ fontWeight: 500 }}>{l.name}:</span> <span style={{ color: '#64748b' }}>{l.text}</span>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{new Date(l.time).toLocaleString()}</div>
                    </div>
                  ))}
                  {activeLogs.length === 0 && <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No activity yet</div>}
                </div>
              </div>
            </div>
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
                          Company {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          style={{ padding: '12px', textAlign: 'center', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('prospectScore')}
                        >
                          Prospect Score {sortConfig?.key === 'prospectScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          style={{ padding: '12px', textAlign: 'center', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('tgScore')}
                        >
                          TG Cust. Score {sortConfig?.key === 'tgScore' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          style={{ padding: '12px', textAlign: 'left', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('assigned')}
                        >
                          Assigned {sortConfig?.key === 'assigned' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          style={{ padding: '12px', textAlign: 'left', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                          onClick={() => handleSort('week')}
                        >
                          Week {sortConfig?.key === 'week' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
                            <td style={{ padding: '12px', color: '#64748b', fontSize: '12px' }}>{c.assignedTo}</td>
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
                      <th>Date</th>
                      <th>Project / Opportunity</th>
                      <th>Owner</th>
                      <th>Market</th>
                      <th>Value</th>
                      <th>Stage</th>
                      <th>Probability</th>
                      <th>Salesperson</th>
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
                      const salespersonName = o.assigned_to_name || o.owner || 'Unassigned';

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
                                <span>{o.description || 'No description'}</span>
                              </div>
                            </div>
                          </td>
                          <td>{o.owner || '-'}</td>
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
          const goalTouchpoints = isLegacyPhoenix ? 40 : (dbCampaign?.target_touchpoints || activeData.length);
          const goalOpportunities = isLegacyPhoenix ? 5 : (dbCampaign?.target_opportunities || 0);
          const goalEstimates = isLegacyPhoenix ? 3 : (dbCampaign?.target_estimates || 0);
          const goalAwards = isLegacyPhoenix ? 1 : (dbCampaign?.target_awards || 0);
          const estimateCount = isLegacyPhoenix ? estimates.filter((e: any) => e.status === 'sent' || e.status === 'accepted').length : 0;
          const awardCount = isLegacyPhoenix ? estimates.filter((e: any) => e.status === 'accepted').length : 0;
          const timelineLabel = activeCampaignInfo.startDate && activeCampaignInfo.endDate
            ? `${new Date(activeCampaignInfo.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(activeCampaignInfo.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            : '';

          const goalCriteria = [
            { text: `${goalTouchpoints} targets contacted`, met: stats.contacted >= goalTouchpoints, current: stats.contacted, target: goalTouchpoints },
            { text: 'Opportunities identified', met: stats.opportunities >= goalOpportunities, current: stats.opportunities, target: goalOpportunities },
            { text: 'Estimates generated', met: estimateCount >= goalEstimates, current: estimateCount, target: goalEstimates },
            { text: 'Awards won', met: awardCount >= goalAwards, current: awardCount, target: goalAwards }
          ];

          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Campaign Timeline: {timelineLabel}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(activeWeeks.length, 8)}, 1fr)`, gap: '8px' }}>
                {activeWeeks.map((w: any) => {
                  const weekProspects = activeData.filter((c: any) => c.targetWeek === w.num);
                  const contacted = weekProspects.filter((c: any) => c.status !== 'prospect').length;
                  return (
                    <div key={w.num} style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Week {w.num}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{w.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: weekProspects.length > 0 && contacted === weekProspects.length ? '#16a34a' : '#ea580c' }}>{contacted}/{weekProspects.length}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>contacted</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Success Criteria</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {goalCriteria.map((c, i) => (
                  <div key={i} style={{ padding: '14px', background: c.met ? '#dcfce7' : '#f9fafb', borderRadius: '8px', border: '1px solid ' + (c.met ? '#bbf7d0' : '#e5e7eb') }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: c.met ? '#16a34a' : '#d1d5db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>{c.met ? '✓' : ''}</div>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{c.text}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{c.current} / {c.target}</div>
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
                return (
                  <div key={pm} style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>{pm}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Assigned: {pmData.length} | Contacted: {contacted} | Opportunities: {opps}
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
                    value={newCustomer.assignedTo}
                    onChange={e => setNewCustomer({...newCustomer, assignedTo: e.target.value})}
                    style={input}
                  >
                    {activeTeam.map((t: string) => <option key={t} value={t}>{t}</option>)}
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

      {/* Assessment Scoring Modal */}
      {showAssessment && assessmentCustomer && (
        <AssessmentScoring
          customerId={assessmentCustomer.id}
          customerName={assessmentCustomer.name}
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

              {/* Current Team */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: '#374151' }}>Current Team ({activeTeam.length})</label>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {activeTeam.map((memberName: string) => {
                    const companyCount = getCompanyCountForMember(memberName);
                    const isOwner = isLegacyPhoenix
                      ? memberName === campaignInfo.owner
                      : dbTeam.find((t: CampaignTeamMember) => t.name === memberName)?.role === 'owner';
                    const dbMember = !isLegacyPhoenix ? dbTeam.find((t: CampaignTeamMember) => t.name === memberName) : null;
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
                Redistribute all <strong>{activeData.length} prospects</strong> across <strong>{isLegacyPhoenix ? weeks.length : activeWeeks.length} weeks</strong>?
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
        const ef = isLegacyPhoenix ? campaignInfo : editForm;
        if (!ef) return null;
        const setEf = (updates: any) => {
          if (isLegacyPhoenix) setCampaignInfo({ ...campaignInfo, ...updates });
          else setEditForm({ ...editForm, ...updates });
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

                {/* Owner - SearchableSelect for DB campaigns, plain select for legacy */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Campaign Owner</label>
                  {isLegacyPhoenix ? (
                    <SearchableSelect
                      options={ownerOptions}
                      value={editEmployees.find(e => `${e.first_name} ${e.last_name}` === ef.owner)?.id.toString() || ''}
                      onChange={(val) => {
                        const emp = editEmployees.find(e => e.id.toString() === val);
                        if (emp) setEf({ owner: `${emp.first_name} ${emp.last_name}` });
                      }}
                      placeholder="Search and select owner..."
                      style={{ width: '100%' }}
                    />
                  ) : (
                    <SearchableSelect
                      options={ownerOptions}
                      value={ef.ownerId?.toString() || ''}
                      onChange={(val) => setEf({ ownerId: val ? parseInt(val) : null })}
                      placeholder="Search and select owner..."
                      style={{ width: '100%' }}
                    />
                  )}
                </div>

                {!isLegacyPhoenix && (
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
                )}

                {isLegacyPhoenix && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Assigned Team Members</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {editEmployees.map(emp => {
                        const fullName = `${emp.first_name} ${emp.last_name}`;
                        const isChecked = ef.assignedTeam?.includes(fullName);
                        return (
                          <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: isChecked ? '#dbeafe' : '#f3f4f6', borderRadius: '6px', cursor: 'pointer', border: isChecked ? '1px solid #3b82f6' : '1px solid #e5e7eb' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) setEf({ assignedTeam: [...(ef.assignedTeam || []), fullName] });
                                else setEf({ assignedTeam: (ef.assignedTeam || []).filter((m: string) => m !== fullName) });
                              }}
                              style={{ accentColor: '#3b82f6' }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>{fullName}</span>
                            {emp.job_title && <span style={{ fontSize: '11px', color: '#64748b' }}>- {emp.job_title}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

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
