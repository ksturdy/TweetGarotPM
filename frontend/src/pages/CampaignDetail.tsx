import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import opportunitiesService, { Opportunity as OpportunityType } from '../services/opportunities';
import OpportunityModal from '../components/opportunities/OpportunityModal';

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

const oppStages = [
  { key: 'qualification', label: 'Qualification', color: '#6b7280' },
  { key: 'discovery', label: 'Discovery', color: '#3b82f6' },
  { key: 'proposal', label: 'Proposal', color: '#f59e0b' },
  { key: 'negotiation', label: 'Negotiation', color: '#8b5cf6' },
  { key: 'closed_won', label: 'Closed Won', color: '#10b981' },
  { key: 'closed_lost', label: 'Closed Lost', color: '#ef4444' }
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

  // Fetch real opportunities from database filtered by campaign_id
  const { data: opportunities = [], isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useQuery({
    queryKey: ['campaign-opportunities', id],
    queryFn: async () => {
      const allOpportunities = await opportunitiesService.getAll();
      return allOpportunities.filter(opp => opp.campaign_id === parseInt(id || '0'));
    },
    enabled: !!id
  });
  const [tab, setTab] = useState('dashboard');
  const [selected, setSelected] = useState<any>(null);
  const [detailView, setDetailView] = useState<any>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [note, setNote] = useState('');
  const [currentWeek, setCurrentWeek] = useState(1);
  const [filter, setFilter] = useState({ team: 'all', status: 'all', tier: 'all' });
  const [isOpportunityModalOpen, setIsOpportunityModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityType | null>(null);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showNewEstimate, setShowNewEstimate] = useState(false);

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
    const byStatus: any = {}; statuses.forEach(s => byStatus[s.key] = data.filter((c: any) => c.status === s.key).length);
    const byAction: any = {}; actions.forEach(a => byAction[a.key] = data.filter((c: any) => c.action === a.key).length);
    const contacted = data.filter((c: any) => c.status !== 'prospect').length;
    const opps = opportunities.length;
    const totalOppValue = opportunities.reduce((sum: number, o: any) => sum + (o.estimated_value || 0), 0);
    return { byStatus, byAction, contacted, opportunities: opps, totalOppValue };
  }, [data, opportunities]);

  const filtered = useMemo(() => data.filter((c: any) =>
    (filter.team === 'all' || c.assignedTo === filter.team) &&
    (filter.status === 'all' || c.status === filter.status) &&
    (filter.tier === 'all' || c.tier === filter.tier)
  ), [data, filter]);

  const updateField = (id: number, field: string, value: string) => {
    setData((d: any) => d.map((c: any) => c.id === id ? {...c, [field]: value} : c));
    const co = data.find((c: any) => c.id === id);
    const label = field === 'status' ? statuses.find(s=>s.key===value)?.label : actions.find(a=>a.key===value)?.label;
    setLogs((l: any) => [{ id: Date.now(), cid: id, text: `${field === 'status' ? 'Status' : 'Action'} → ${label}`, time: new Date().toISOString(), name: co?.name }, ...l]);
  };

  const addNote = () => {
    if (!note.trim() || !selected) return;
    setLogs((l: any) => [{ id: Date.now(), cid: selected.id, text: note, time: new Date().toISOString(), name: selected.name }, ...l]);
    setNote('');
  };

  const handleAddCustomer = () => {
    if (!newCustomer.name.trim()) return;
    const newId = Math.max(...data.map((c: any) => c.id)) + 1;
    const customer = { ...newCustomer, id: newId, status: 'prospect', action: 'none' };
    setData([...data, customer]);
    setLogs((l: any) => [{ id: Date.now(), cid: newId, text: 'New prospect added', time: new Date().toISOString(), name: customer.name }, ...l]);
    setNewCustomer({ name: '', sector: '', address: '', phone: '', assignedTo: team[0], tier: 'B', score: 70, targetWeek: 1 });
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
  const input: React.CSSProperties = { padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px', outline: 'none', background: '#fff', width: '100%' };
  const btn: React.CSSProperties = { padding: '8px 16px', background: '#ea580c', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' };
  const btnSecondary: React.CSSProperties = { ...btn, background: '#f3f4f6', color: '#374151' };

  const weekData = weeks.find(w => w.num === currentWeek);

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
            <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #ea580c, #dc2626)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>P</div>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>Phoenix Division</h1>
              <p style={{ fontSize: '12px', color: '#64748b' }}>6-Week Campaign: Feb 2 - Mar 15, 2025</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {['dashboard', 'weekly', 'prospects', 'pipeline', 'goals'].map(t => (
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
                { label: 'Total Prospects', value: data.length, color: '#6366f1' },
                { label: 'Contacted', value: stats.contacted, color: '#3b82f6' },
                { label: 'New Opportunities', value: stats.opportunities, color: '#10b981' },
                { label: 'Pipeline Value', value: '$' + (stats.totalOppValue / 1000).toFixed(0) + 'K', color: '#8b5cf6' },
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
                  {logs.slice(0, 12).map((l: any) => (
                    <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '13px' }}>
                      <span style={{ fontWeight: 500 }}>{l.name}:</span> <span style={{ color: '#64748b' }}>{l.text}</span>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{new Date(l.time).toLocaleString()}</div>
                    </div>
                  ))}
                  {logs.length === 0 && <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>No activity yet</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'weekly' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ ...card, padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Select Week:</span>
              {weeks.map(w => (
                <button key={w.num} onClick={() => setCurrentWeek(w.num)} style={{ padding: '8px 14px', background: currentWeek === w.num ? '#ea580c' : '#f3f4f6', color: currentWeek === w.num ? '#fff' : '#64748b', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', fontSize: '12px' }}>
                  {w.label}
                </button>
              ))}
            </div>

            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Week {currentWeek}: {weekData?.label}</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Prospects scheduled for contact this week</p>

              {team.map(pm => {
                const pmProspects = data.filter((c: any) => c.assignedTo === pm && c.targetWeek === currentWeek);
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
              {data.filter((c: any) => c.targetWeek === currentWeek).length === 0 && (
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
                  {team.map(t => <option key={t} value={t}>{t}</option>)}
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
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Company</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Score</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Assigned</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Week</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Action</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c: any) => (
                        <tr key={c.id} onClick={() => setSelected(c)} style={{ borderTop: '1px solid #f3f4f6', cursor: 'pointer', background: selected?.id === c.id ? '#fef3c7' : '#fff' }}>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: 500 }}>{c.name}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.sector}</div>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <span style={{ background: c.tier === 'A' ? '#dcfce7' : '#fef9c3', color: c.tier === 'A' ? '#16a34a' : '#ca8a04', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>{c.tier}-{c.score}</span>
                          </td>
                          <td style={{ padding: '12px', color: '#64748b', fontSize: '12px' }}>{c.assignedTo}</td>
                          <td style={{ padding: '12px', fontSize: '12px' }}>{weeks.find(w=>w.num===c.targetWeek)?.label}</td>
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
                            <button onClick={(e) => { e.stopPropagation(); openDetail(c); }} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
                              View →
                            </button>
                          </td>
                        </tr>
                      ))}
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
                    {logs.filter((l: any) => l.cid === selected.id).map((l: any) => (
                      <div key={l.id} style={{ padding: '6px 8px', background: '#f9fafb', borderRadius: '4px', marginBottom: '4px', fontSize: '11px' }}>
                        {l.text}
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{new Date(l.time).toLocaleString()}</div>
                      </div>
                    ))}
                    {logs.filter((l: any) => l.cid === selected.id).length === 0 && <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>No history</div>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'pipeline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ ...card, padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Active Opportunities</h3>
              </div>
              {opportunitiesLoading ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>Loading opportunities...</div>
              ) : opportunities.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Opportunity</th>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Owner</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>Value</th>
                      <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>Stage</th>
                      <th style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>Priority</th>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600 }}>Est. Start</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((o: any) => {
                      return (
                        <tr key={o.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: 500 }}>{o.title}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{o.description || 'No description'}</div>
                          </td>
                          <td style={{ padding: '10px' }}>{o.owner || '-'}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>${(o.estimated_value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{ background: '#3b82f620', color: '#3b82f6', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>{o.stage_name || 'Unknown'}</span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <span style={{
                              background: o.priority === 'urgent' ? '#ef444420' : o.priority === 'high' ? '#f59e0b20' : o.priority === 'medium' ? '#3b82f620' : '#6b728020',
                              color: o.priority === 'urgent' ? '#ef4444' : o.priority === 'high' ? '#f59e0b' : o.priority === 'medium' ? '#3b82f6' : '#6b7280',
                              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, textTransform: 'capitalize'
                            }}>{o.priority || 'medium'}</span>
                          </td>
                          <td style={{ padding: '10px', fontSize: '12px' }}>{o.estimated_start_date || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px' }}>No opportunities yet. Create one to get started!</div>
              )}
            </div>

            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>By Status</h3>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
                {statuses.map(s => (
                  <div key={s.key} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ background: s.color, color: '#fff', padding: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '18px' }}>{stats.byStatus[s.key]}</div>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {statuses.filter(s => stats.byStatus[s.key] > 0).map(s => (
              <div key={s.key} style={{ ...card, padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: s.color }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.label}</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>({stats.byStatus[s.key]})</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {data.filter((c: any) => c.status === s.key).map((c: any) => (
                    <div key={c.id} onClick={() => openDetail(c)} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', fontSize: '12px' }}>
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>{c.assignedTo}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'goals' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Campaign Timeline: Feb 2 - Mar 15, 2025</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                {weeks.map(w => {
                  const weekProspects = data.filter((c: any) => c.targetWeek === w.num);
                  const contacted = weekProspects.filter((c: any) => c.status !== 'prospect').length;
                  return (
                    <div key={w.num} style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Week {w.num}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>{w.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: contacted === weekProspects.length ? '#16a34a' : '#ea580c' }}>{contacted}/{weekProspects.length}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>contacted</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ ...card, padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Success Criteria</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                {[
                  { text: '40 targets contacted', met: stats.contacted >= 40, current: stats.contacted, target: 40 },
                  { text: 'New opportunities identified', met: stats.opportunities >= 5, current: stats.opportunities, target: 5 },
                  { text: 'All weeks completed', met: data.filter((c: any) => c.status !== 'prospect').length === 40, current: data.filter((c: any) => c.status !== 'prospect').length, target: 40 }
                ].map((c, i) => (
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
              {team.map(pm => {
                const pmData = data.filter((c: any) => c.assignedTo === pm);
                const contacted = pmData.filter((c: any) => c.status !== 'prospect').length;
                const opps = pmData.filter((c: any) => c.status === 'new_opp').length;
                return (
                  <div key={pm} style={{ marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px' }}>{pm}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Assigned: {pmData.length} | Contacted: {contacted} | Opportunities: {opps}
                    </div>
                    <div style={{ background: '#e5e7eb', height: '6px', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ background: '#ea580c', height: '100%', width: `${(contacted / pmData.length) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                    {team.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>Target Week</label>
                  <select
                    value={newCustomer.targetWeek}
                    onChange={e => setNewCustomer({...newCustomer, targetWeek: parseInt(e.target.value)})}
                    style={input}
                  >
                    {weeks.map(w => <option key={w.num} value={w.num}>Week {w.num} ({w.label})</option>)}
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
    </div>
  );
}
