import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { vistaDataService } from '../../services/vistaData';
import {
  preJobChecklistApi,
  LaborTradeRow,
  MaterialItemRow,
  SubcontractItemRow,
  GenericItemRow,
  OtherContact,
  ProjectInfoData,
} from '../../services/preJobChecklist';
import { projectAssignmentsApi, ProjectAssignment } from '../../services/projectAssignments';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import api from '../../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtMoney = (n: number | null | undefined) =>
  n == null ? '—' : `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtHrs = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' hrs';

const MGMT_ROLES = [
  'Project Manager', 'Assistant PM', 'Project Coordinator',
  'Safety Manager', 'BIM Lead', 'BIM Manager', 'Project Engineer',
] as const;

const DEFAULT_LABOR_TRADES = (): LaborTradeRow[] =>
  ['Pipefitter', 'Sheet Metal', 'Plumber', 'BIM', 'Engineering', 'Overhead'].map(t => ({
    id: uid(), trade: t, goal_hours: undefined, target_rate: undefined, notes: '',
  }));

const DEFAULT_MATERIAL_ITEMS = (): MaterialItemRow[] =>
  ['Sheet Metal', 'Piping', 'Plumbing', 'Insulation', 'Controls/BAS'].map(d => ({
    id: uid(), description: d, budget: undefined, vendor: '', lead_time: '', notes: '',
  }));

interface EmpResult {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  title?: string | null;
  trade?: string | null;
}

// ── Titan prompt card ─────────────────────────────────────────────────────────
const TitanCard: React.FC<{ question: string; hint?: string }> = ({ question, hint }) => (
  <div style={{
    background: 'linear-gradient(135deg, #002356 0%, #003580 100%)',
    borderRadius: 12,
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: 'linear-gradient(135deg, #f97316, #ea580c)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, color: 'white', fontSize: '1rem', flexShrink: 0,
    }}>T</div>
    <div>
      <div style={{ color: '#93c5fd', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        Titan
      </div>
      <div style={{ color: 'white', fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 }}>{question}</div>
      {hint && <div style={{ color: '#93c5fd', fontSize: '0.8rem', marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  </div>
);

// ── Progress bar ──────────────────────────────────────────────────────────────
const STEPS = [
  'Key Dates', 'Project Team', 'Site Conditions', 'Scope & Bid',
  'Labor Plan', 'Material Plan', 'Subcontracts', 'Other Costs', 'Contacts', 'Summary',
];

const ProgressBar: React.FC<{ step: number }> = ({ step }) => (
  <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0.875rem 2rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: 900, margin: '0 auto' }}>
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done = step > num;
        const active = step === num;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done ? '#16a34a' : active ? '#002356' : '#e2e8f0',
                color: done || active ? 'white' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
              }}>
                {done ? '✓' : num}
              </div>
              <div style={{ fontSize: '0.65rem', color: active ? '#002356' : '#94a3b8', fontWeight: active ? 700 : 400, marginTop: 3, whiteSpace: 'nowrap', maxWidth: 70, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#16a34a' : '#e2e8f0', margin: '0 4px', marginBottom: 18 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  </div>
);

// ── Employee search hook ──────────────────────────────────────────────────────
const useEmpSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EmpResult[]>([]);
  const [selected, setSelected] = useState<EmpResult | null>(null);
  const [showDrop, setShowDrop] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setShowDrop(false); return; }
    api.get<EmpResult[]>(`/project-assignments/search-employees?q=${encodeURIComponent(query)}`)
      .then(r => { setResults(r.data); setShowDrop(true); })
      .catch(() => {});
  }, [query]);

  const select = (e: EmpResult) => { setSelected(e); setQuery(`${e.first_name} ${e.last_name}`); setShowDrop(false); };
  const reset = () => { setQuery(''); setSelected(null); setResults([]); setShowDrop(false); };
  const clearSel = () => setSelected(null);
  return { query, setQuery, results, selected, showDrop, setShowDrop, select, reset, clearSel };
};

// ── Vista context box ─────────────────────────────────────────────────────────
const VistaBox: React.FC<{ label: string; estCost?: number | null; jtdCost?: number | null; estHrs?: number | null; jtdHrs?: number | null }> =
  ({ label, estCost, jtdCost, estHrs, jtdHrs }) => (
    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#0369a1' }}>
      <strong style={{ color: '#0c4a6e' }}>Vista — {label}</strong>
      {(estCost != null || jtdCost != null) && (
        <span style={{ marginLeft: 12 }}>Estimated: {fmtMoney(estCost)} · JTD: {fmtMoney(jtdCost)}</span>
      )}
      {(estHrs != null || jtdHrs != null) && (
        <span style={{ marginLeft: 12 }}>Est Hours: {fmtHrs(estHrs)} · JTD Hours: {fmtHrs(jtdHrs)}</span>
      )}
    </div>
  );

// ── Inline table helpers ──────────────────────────────────────────────────────
const colStyle: React.CSSProperties = { padding: '0.4rem 0.5rem', fontSize: '0.8rem', border: '1px solid #e2e8f0', borderRadius: 4, width: '100%', boxSizing: 'border-box' };
const thStyle: React.CSSProperties = { padding: '0.4rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.4 };
const tdStyle: React.CSSProperties = { padding: '0.25rem 0.25rem' };

// ── Main wizard ───────────────────────────────────────────────────────────────
const PreJobWizard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useTitanFeedback();
  const qc = useQueryClient();

  const [step, setStep] = useState(0); // 0 = gate
  const [saving, setSaving] = useState(false);

  // ── Draft state per section ──────────────────────────────────────────────
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [specialConditions, setSpecialConditions] = useState('');
  const [bidScopeNotes, setBidScopeNotes] = useState('');
  const [laborApproach, setLaborApproach] = useState('');
  const [laborTrades, setLaborTrades] = useState<LaborTradeRow[]>(DEFAULT_LABOR_TRADES());
  const [materialApproach, setMaterialApproach] = useState('');
  const [materialItems, setMaterialItems] = useState<MaterialItemRow[]>(DEFAULT_MATERIAL_ITEMS());
  const [subApproach, setSubApproach] = useState('');
  const [subItems, setSubItems] = useState<SubcontractItemRow[]>([]);
  const [rentalApproach, setRentalApproach] = useState('');
  const [rentalItems, setRentalItems] = useState<GenericItemRow[]>([]);
  const [mepApproach, setMepApproach] = useState('');
  const [mepItems, setMepItems] = useState<GenericItemRow[]>([]);
  const [gcApproach, setGcApproach] = useState('');
  const [gcItems, setGcItems] = useState<GenericItemRow[]>([]);
  const [contacts, setContacts] = useState<OtherContact[]>([]);

  // ── Team step state ───────────────────────────────────────────────────────
  const empSearch = useEmpSearch();
  const [teamRole, setTeamRole] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) empSearch.setShowDrop(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: readiness, isLoading: readinessLoading } = useQuery({
    queryKey: ['pjc-readiness', projectId],
    queryFn: () => preJobChecklistApi.readiness(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(r => r.data),
    enabled: !!projectId,
  });

  const { data: contract } = useQuery({
    queryKey: ['vistaContract', projectId],
    queryFn: () => vistaDataService.getContractByProjectId(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: costSummary } = useQuery({
    queryKey: ['phaseCodeCostSummary', projectId],
    queryFn: () => vistaDataService.getPhaseCodeCostSummary(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: assignments = [] } = useQuery<ProjectAssignment[]>({
    queryKey: ['project-assignments', projectId],
    queryFn: () => projectAssignmentsApi.getByProject(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: checklist } = useQuery({
    queryKey: ['preJobChecklist', projectId],
    queryFn: () => preJobChecklistApi.get(Number(projectId)),
    enabled: !!projectId,
  });

  // Pre-populate drafts from existing checklist
  useEffect(() => {
    if (!checklist) return;
    const pi = checklist.project_info;
    if (pi.special_conditions) setSpecialConditions(pi.special_conditions);
    if (pi.bid_scope_notes) setBidScopeNotes(pi.bid_scope_notes);
    if (pi.other_contacts?.length) setContacts(pi.other_contacts);
    const lb = checklist.labor;
    if (lb.approach_notes) setLaborApproach(lb.approach_notes);
    if (lb.trades?.length) setLaborTrades(lb.trades);
    const mt = checklist.material;
    if (mt.approach_notes) setMaterialApproach(mt.approach_notes);
    if (mt.items?.length) setMaterialItems(mt.items);
    const sb = checklist.subcontracts;
    if (sb.approach_notes) setSubApproach(sb.approach_notes);
    if (sb.items?.length) setSubItems(sb.items);
    const rn = checklist.rental;
    if (rn.approach_notes) setRentalApproach(rn.approach_notes);
    if (rn.items?.length) setRentalItems(rn.items);
    const mp = checklist.mep_equipment;
    if (mp.approach_notes) setMepApproach(mp.approach_notes);
    if (mp.items?.length) setMepItems(mp.items);
    const gc = checklist.general_conditions;
    if (gc.approach_notes) setGcApproach(gc.approach_notes);
    if (gc.items?.length) setGcItems(gc.items);
  }, [checklist]);

  useEffect(() => {
    if (project) {
      if (!startDate && project.start_date) setStartDate(project.start_date.slice(0, 10));
      if (!endDate && project.end_date) setEndDate(project.end_date.slice(0, 10));
    }
  }, [project]);

  // ── Office team ───────────────────────────────────────────────────────────
  const officeAssignments = assignments.filter(a => a.role && (MGMT_ROLES as readonly string[]).includes(a.role));

  const addTeamMutation = useMutation({
    mutationFn: () => {
      if (!empSearch.selected || !teamRole) throw new Error('Select employee and role');
      return projectAssignmentsApi.addToProject(Number(projectId), {
        employeeId: empSearch.selected!.id,
        role: teamRole,
        status: 'active',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      empSearch.reset();
      setTeamRole('');
      toast.success('Team member added');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to add member'),
  });

  // ── Step save handlers ────────────────────────────────────────────────────
  const saveCurrentStep = async () => {
    const pid = Number(projectId);
    const existingPi = checklist?.project_info ?? {};

    switch (step) {
      case 1: // Dates
        await projectsApi.update(pid, { start_date: startDate || undefined, end_date: endDate || undefined });
        if (contract?.id && (startDate || endDate)) {
          await vistaDataService.updateProjectionOverrides(contract.id, {
            user_adjusted_start_date: startDate || undefined,
            user_adjusted_end_date: endDate || undefined,
          });
        }
        qc.invalidateQueries({ queryKey: ['project', projectId] });
        break;
      case 2: break; // team saves live per-add, nothing to save on continue
      case 3:
        await preJobChecklistApi.updateSection(pid, 'project_info', { ...existingPi, special_conditions: specialConditions });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 4:
        await preJobChecklistApi.updateSection(pid, 'project_info', { ...(checklist?.project_info ?? {}), bid_scope_notes: bidScopeNotes });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 5:
        await preJobChecklistApi.updateSection(pid, 'labor', { approach_notes: laborApproach, trades: laborTrades });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 6:
        await preJobChecklistApi.updateSection(pid, 'material', { approach_notes: materialApproach, items: materialItems });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 7:
        await preJobChecklistApi.updateSection(pid, 'subcontracts', { approach_notes: subApproach, items: subItems });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 8:
        await Promise.all([
          preJobChecklistApi.updateSection(pid, 'rental', { approach_notes: rentalApproach, items: rentalItems }),
          preJobChecklistApi.updateSection(pid, 'mep_equipment', { approach_notes: mepApproach, items: mepItems }),
          preJobChecklistApi.updateSection(pid, 'general_conditions', { approach_notes: gcApproach, items: gcItems }),
        ]);
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 9:
        await preJobChecklistApi.updateSection(pid, 'project_info', { ...(checklist?.project_info ?? {}), other_contacts: contacts });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
    }
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      await saveCurrentStep();
      setStep(s => s + 1);
      window.scrollTo(0, 0);
    } catch {
      toast.error('Failed to save — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => { setStep(s => Math.max(0, s - 1)); window.scrollTo(0, 0); };

  // ── Render helpers for generic item tables ────────────────────────────────
  const renderLaborTable = () => (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={thStyle}>Trade</th>
            <th style={thStyle}>Goal Hours</th>
            <th style={thStyle}>Target Rate ($/hr)</th>
            <th style={thStyle}>Notes</th>
            <th style={thStyle} />
          </tr>
        </thead>
        <tbody>
          {laborTrades.map((row, i) => (
            <tr key={row.id}>
              <td style={tdStyle}><input style={colStyle} value={row.trade} onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, trade: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} type="number" min={0} value={row.goal_hours ?? ''} onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, goal_hours: e.target.value ? Number(e.target.value) : undefined } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} type="number" min={0} value={row.target_rate ?? ''} onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, target_rate: e.target.value ? Number(e.target.value) : undefined } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={row.notes ?? ''} onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, notes: e.target.value } : r))} /></td>
              <td style={tdStyle}><button style={delBtn} onClick={() => setLaborTrades(lt => lt.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={addRowBtn} onClick={() => setLaborTrades(lt => [...lt, { id: uid(), trade: '', goal_hours: undefined, target_rate: undefined, notes: '' }])}>+ Add Trade</button>
    </div>
  );

  const renderMaterialTable = () => (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={thStyle}>Category</th>
            <th style={thStyle}>Budget</th>
            <th style={thStyle}>Key Vendor</th>
            <th style={thStyle}>Lead Time</th>
            <th style={thStyle}>Notes</th>
            <th style={thStyle} />
          </tr>
        </thead>
        <tbody>
          {materialItems.map((row, i) => (
            <tr key={row.id}>
              <td style={tdStyle}><input style={colStyle} value={row.description} onChange={e => setMaterialItems(m => m.map((r, j) => j === i ? { ...r, description: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} type="number" min={0} value={row.budget ?? ''} onChange={e => setMaterialItems(m => m.map((r, j) => j === i ? { ...r, budget: e.target.value ? Number(e.target.value) : undefined } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={row.vendor ?? ''} onChange={e => setMaterialItems(m => m.map((r, j) => j === i ? { ...r, vendor: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={row.lead_time ?? ''} onChange={e => setMaterialItems(m => m.map((r, j) => j === i ? { ...r, lead_time: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={row.notes ?? ''} onChange={e => setMaterialItems(m => m.map((r, j) => j === i ? { ...r, notes: e.target.value } : r))} /></td>
              <td style={tdStyle}><button style={delBtn} onClick={() => setMaterialItems(m => m.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={addRowBtn} onClick={() => setMaterialItems(m => [...m, { id: uid(), description: '', budget: undefined, vendor: '', lead_time: '', notes: '' }])}>+ Add Category</button>
    </div>
  );

  const renderSubTable = () => (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={thStyle}>Scope</th>
            <th style={thStyle}>Subcontractor</th>
            <th style={thStyle}>Budget</th>
            <th style={thStyle}>Notes</th>
            <th style={thStyle} />
          </tr>
        </thead>
        <tbody>
          {subItems.map((row, i) => (
            <tr key={row.id}>
              <td style={tdStyle}><input style={colStyle} value={row.scope ?? ''} onChange={e => setSubItems(s => s.map((r, j) => j === i ? { ...r, scope: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={row.subcontractor ?? ''} onChange={e => setSubItems(s => s.map((r, j) => j === i ? { ...r, subcontractor: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} type="number" min={0} value={row.budget ?? ''} onChange={e => setSubItems(s => s.map((r, j) => j === i ? { ...r, budget: e.target.value ? Number(e.target.value) : undefined } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={row.notes ?? ''} onChange={e => setSubItems(s => s.map((r, j) => j === i ? { ...r, notes: e.target.value } : r))} /></td>
              <td style={tdStyle}><button style={delBtn} onClick={() => setSubItems(s => s.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={addRowBtn} onClick={() => setSubItems(s => [...s, { id: uid(), description: '', scope: '', subcontractor: '', budget: undefined, notes: '' }])}>+ Add Subcontractor</button>
    </div>
  );

  const renderGenericTable = (
    items: GenericItemRow[],
    setItems: React.Dispatch<React.SetStateAction<GenericItemRow[]>>,
    addLabel: string,
  ) => (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={thStyle}>Description</th>
            <th style={thStyle}>Budget</th>
            <th style={thStyle}>Notes</th>
            <th style={thStyle} />
          </tr>
        </thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={row.id}>
              <td style={tdStyle}><input style={colStyle} value={row.description} onChange={e => setItems(it => it.map((r, j) => j === i ? { ...r, description: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} type="number" min={0} value={row.budget ?? ''} onChange={e => setItems(it => it.map((r, j) => j === i ? { ...r, budget: e.target.value ? Number(e.target.value) : undefined } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={row.notes ?? ''} onChange={e => setItems(it => it.map((r, j) => j === i ? { ...r, notes: e.target.value } : r))} /></td>
              <td style={tdStyle}><button style={delBtn} onClick={() => setItems(it => it.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={addRowBtn} onClick={() => setItems(it => [...it, { id: uid(), description: '', budget: undefined, notes: '' }])}>{addLabel}</button>
    </div>
  );

  const renderContactsTable = () => (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Phone</th>
            <th style={thStyle}>Email</th>
            <th style={thStyle} />
          </tr>
        </thead>
        <tbody>
          {contacts.map((c, i) => (
            <tr key={c.id}>
              <td style={tdStyle}><input style={colStyle} value={c.role} placeholder="GC Super, Architect…" onChange={e => setContacts(cs => cs.map((r, j) => j === i ? { ...r, role: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={c.name} onChange={e => setContacts(cs => cs.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={c.phone ?? ''} onChange={e => setContacts(cs => cs.map((r, j) => j === i ? { ...r, phone: e.target.value } : r))} /></td>
              <td style={tdStyle}><input style={colStyle} value={c.email ?? ''} onChange={e => setContacts(cs => cs.map((r, j) => j === i ? { ...r, email: e.target.value } : r))} /></td>
              <td style={tdStyle}><button style={delBtn} onClick={() => setContacts(cs => cs.filter((_, j) => j !== i))}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={addRowBtn} onClick={() => setContacts(cs => [...cs, { id: uid(), role: '', name: '', phone: '', email: '' }])}>+ Add Contact</button>
    </div>
  );

  // ── Step content ──────────────────────────────────────────────────────────
  const renderStepContent = () => {
    switch (step) {

      // GATE SCREEN
      case 0: {
        const vistaOk = readiness?.vistaLinked ?? false;
        const projOk = readiness?.hasProjection ?? false;
        return (
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: 8 }}>📋</div>
              <h2 style={{ color: '#002356', margin: 0 }}>Pre-Job Checklist Setup</h2>
              <p style={{ color: '#64748b', marginTop: 8 }}>
                Titan will guide you through the pre-job checklist for <strong>{project?.name ?? 'this project'}</strong>.
                Before we start, two things need to be in place.
              </p>
            </div>

            {readinessLoading ? (
              <p style={{ textAlign: 'center', color: '#94a3b8' }}>Checking prerequisites…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: '2rem' }}>
                <GateItem
                  done={vistaOk}
                  label="Vista estimate uploaded"
                  detail={vistaOk ? `Contract ${readiness?.vistaContractNumber ?? ''}` : 'The estimate needs to be uploaded to Vista and linked to this project.'}
                  actionLabel={vistaOk ? undefined : 'Go to Vista Data'}
                  actionHref={`/projects/${projectId}`}
                />
                <GateItem
                  done={projOk}
                  label="First projection completed"
                  detail={projOk ? 'At least one projection cycle on record.' : 'Complete the first projection before starting the pre-job checklist.'}
                  actionLabel={projOk ? undefined : 'Go to Projection Notes'}
                  actionHref={`/projects/${projectId}`}
                />
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <button
                disabled={!readiness?.ready}
                onClick={() => { setStep(1); window.scrollTo(0, 0); }}
                style={{
                  background: readiness?.ready ? 'linear-gradient(135deg, #002356, #003580)' : '#e2e8f0',
                  color: readiness?.ready ? 'white' : '#94a3b8',
                  border: 'none', borderRadius: 8, padding: '0.85rem 2rem',
                  fontSize: '1rem', fontWeight: 700, cursor: readiness?.ready ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                }}
              >
                {readiness?.ready ? 'Start Pre-Job Checklist →' : 'Prerequisites not met'}
              </button>
              {readiness?.ready && (
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 8 }}>
                  This will take about 10–15 minutes to complete all sections.
                </p>
              )}
            </div>
          </div>
        );
      }

      // STEP 1 — KEY DATES
      case 1:
        return (
          <div>
            <TitanCard
              question="Let's start with the timeline. When does this project kick off, and when do you expect to wrap up?"
              hint="These dates sync with the project record and Vista contract overrides."
            />
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={fieldLabel}>Project Start Date</label>
                <input type="date" style={fieldInput} value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={fieldLabel}>Estimated Completion</label>
                <input type="date" style={fieldInput} value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
        );

      // STEP 2 — PROJECT TEAM
      case 2:
        return (
          <div>
            <TitanCard
              question="Who's managing this project? Add your office and management team."
              hint="These go directly to active status. Field crew nominations are handled separately."
            />
            {officeAssignments.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Current Team
                </div>
                {officeAssignments.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: 6, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{[a.first_name, a.last_name].filter(Boolean).join(' ')}</span>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{a.role}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 10 }}>Add Team Member</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: 180, position: 'relative' }} ref={dropRef}>
                  <label style={fieldLabel}>Employee</label>
                  <input
                    type="text"
                    style={fieldInput}
                    placeholder="Search by name…"
                    value={empSearch.query}
                    onChange={e => { empSearch.setQuery(e.target.value); empSearch.clearSel(); }}
                    autoComplete="off"
                  />
                  {empSearch.showDrop && empSearch.results.length > 0 && !empSearch.selected && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                      {empSearch.results.map(e => (
                        <button key={e.id} onMouseDown={() => empSearch.select(e)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <strong>{e.first_name} {e.last_name}</strong>
                          {(e.title || e.trade) && <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: '0.75rem' }}>{[e.title, e.trade].filter(Boolean).join(' · ')}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={fieldLabel}>Role</label>
                  <select style={fieldInput} value={teamRole} onChange={e => setTeamRole(e.target.value)}>
                    <option value="">— select role —</option>
                    {MGMT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <button
                  disabled={!empSearch.selected || !teamRole || addTeamMutation.isPending}
                  onClick={() => addTeamMutation.mutate()}
                  style={{ padding: '0.55rem 1.25rem', background: '#002356', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: empSearch.selected && teamRole ? 1 : 0.45 }}
                >
                  {addTeamMutation.isPending ? 'Adding…' : '+ Add'}
                </button>
              </div>
            </div>
          </div>
        );

      // STEP 3 — SITE CONDITIONS
      case 3:
        return (
          <div>
            <TitanCard
              question="Any site-specific conditions or risks your team should know before mobilizing?"
              hint="Think: site access restrictions, phasing, union rules, confined spaces, permits, or anything unusual about this job site."
            />
            <textarea
              rows={7}
              style={{ ...fieldInput, resize: 'vertical' }}
              placeholder="Describe any site conditions, access requirements, safety concerns, or special procedures…"
              value={specialConditions}
              onChange={e => setSpecialConditions(e.target.value)}
            />
          </div>
        );

      // STEP 4 — SCOPE & BID NOTES
      case 4:
        return (
          <div>
            <TitanCard
              question="Walk me through the contract scope — what's included, what's explicitly excluded, and any important bid assumptions your team needs to know?"
              hint="Capture the key inclusions/exclusions from the bid, clarifications from the bid leveling, and anything that could affect field execution."
            />
            <textarea
              rows={8}
              style={{ ...fieldInput, resize: 'vertical' }}
              placeholder="Scope includes… | Exclusions… | Bid assumptions…"
              value={bidScopeNotes}
              onChange={e => setBidScopeNotes(e.target.value)}
            />
          </div>
        );

      // STEP 5 — LABOR PLAN
      case 5: {
        const lt = costSummary?.labor_totals;
        return (
          <div>
            <TitanCard
              question="What's your labor strategy for this job? Set your trade goals and target rates."
              hint="These goals guide your monthly projections and headcount planning."
            />
            {lt && <VistaBox label="Labor" estHrs={lt.est_hours} jtdHrs={lt.jtd_hours} estCost={lt.est_cost} jtdCost={lt.jtd_cost} />}
            <label style={fieldLabel}>Overall Labor Strategy</label>
            <textarea
              rows={3}
              style={{ ...fieldInput, resize: 'vertical', marginBottom: '1rem' }}
              placeholder="Describe your staffing approach, peak crew size, key milestones…"
              value={laborApproach}
              onChange={e => setLaborApproach(e.target.value)}
            />
            <label style={fieldLabel}>Trade Goals</label>
            {renderLaborTable()}
          </div>
        );
      }

      // STEP 6 — MATERIAL PLAN
      case 6: {
        const md = costSummary?.costs?.material;
        return (
          <div>
            <TitanCard
              question="How are you handling material procurement for this project?"
              hint="Identify your key material categories, budget targets, preferred vendors, and any long-lead items."
            />
            {md && <VistaBox label="Material" estCost={md.est_cost} jtdCost={md.jtd_cost} />}
            <label style={fieldLabel}>Procurement Strategy</label>
            <textarea
              rows={3}
              style={{ ...fieldInput, resize: 'vertical', marginBottom: '1rem' }}
              placeholder="Key procurement milestones, preferred vendors, buy-out strategy…"
              value={materialApproach}
              onChange={e => setMaterialApproach(e.target.value)}
            />
            <label style={fieldLabel}>Material Breakdown</label>
            {renderMaterialTable()}
          </div>
        );
      }

      // STEP 7 — SUBCONTRACTS
      case 7: {
        const sd = costSummary?.costs?.subcontracts;
        return (
          <div>
            <TitanCard
              question="Any subcontractors involved? Tell me about their scopes and who you're planning to use."
              hint="Include any subs already selected, as well as scopes still out for bid."
            />
            {sd && <VistaBox label="Subcontracts" estCost={sd.est_cost} jtdCost={sd.jtd_cost} />}
            <label style={fieldLabel}>Subcontract Strategy</label>
            <textarea
              rows={3}
              style={{ ...fieldInput, resize: 'vertical', marginBottom: '1rem' }}
              placeholder="Buy-out timeline, key subcontract risks, coordination requirements…"
              value={subApproach}
              onChange={e => setSubApproach(e.target.value)}
            />
            <label style={fieldLabel}>Subcontractors</label>
            {renderSubTable()}
          </div>
        );
      }

      // STEP 8 — OTHER COSTS
      case 8: {
        const rd = costSummary?.costs?.rentals;
        const mpd = costSummary?.costs?.mep_equipment;
        const gcd = costSummary?.costs?.general_conditions;
        return (
          <div>
            <TitanCard
              question="Quick check on the remaining cost buckets — rental equipment, MEP/owner-furnished equipment, and general conditions."
              hint="Skip any that don't apply. You can always add detail later in the full checklist."
            />
            <SectionDivider label="Rental Equipment" />
            {rd && <VistaBox label="Rental" estCost={rd.est_cost} jtdCost={rd.jtd_cost} />}
            <textarea rows={2} style={{ ...fieldInput, resize: 'vertical', marginBottom: 6 }} placeholder="Rental strategy or key items…" value={rentalApproach} onChange={e => setRentalApproach(e.target.value)} />
            {renderGenericTable(rentalItems, setRentalItems, '+ Add Equipment')}

            <SectionDivider label="MEP / Owner-Furnished Equipment" />
            {mpd && <VistaBox label="MEP Equipment" estCost={mpd.est_cost} jtdCost={mpd.jtd_cost} />}
            <textarea rows={2} style={{ ...fieldInput, resize: 'vertical', marginBottom: 6 }} placeholder="MEP procurement strategy, owner-supplied items…" value={mepApproach} onChange={e => setMepApproach(e.target.value)} />
            {renderGenericTable(mepItems, setMepItems, '+ Add Equipment')}

            <SectionDivider label="General Conditions" />
            {gcd && <VistaBox label="General Conditions" estCost={gcd.est_cost} jtdCost={gcd.jtd_cost} />}
            <textarea rows={2} style={{ ...fieldInput, resize: 'vertical', marginBottom: 6 }} placeholder="GC items strategy, trailer, dumpsters, temp utilities…" value={gcApproach} onChange={e => setGcApproach(e.target.value)} />
            {renderGenericTable(gcItems, setGcItems, '+ Add Item')}
          </div>
        );
      }

      // STEP 9 — OTHER CONTACTS
      case 9:
        return (
          <div>
            <TitanCard
              question="Anyone else who needs to be in the loop for this project?"
              hint="Think: GC superintendent, architect, owner representative, engineer of record, inspectors."
            />
            {renderContactsTable()}
          </div>
        );

      // STEP 10 — SUMMARY
      case 10:
        return (
          <div>
            <TitanCard
              question="You're all set! Here's a summary of what you've set up. Review it and then open the full checklist to refine any section."
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SummaryRow label="Dates" value={startDate && endDate ? `${startDate} → ${endDate}` : startDate || endDate || '—'} />
              <SummaryRow label="Office Team" value={officeAssignments.length > 0 ? officeAssignments.map(a => `${[a.first_name, a.last_name].filter(Boolean).join(' ')} (${a.role})`).join(', ') : 'None added'} />
              <SummaryRow label="Site Conditions" value={specialConditions || '—'} multiline />
              <SummaryRow label="Scope & Bid Notes" value={bidScopeNotes || '—'} multiline />
              <SummaryRow label="Labor Strategy" value={laborApproach || '—'} multiline />
              <SummaryRow label="Labor Trades" value={laborTrades.filter(t => t.trade).map(t => `${t.trade}${t.goal_hours ? ` (${t.goal_hours} hrs)` : ''}`).join(', ') || '—'} />
              <SummaryRow label="Material Strategy" value={materialApproach || '—'} multiline />
              <SummaryRow label="Subcontract Strategy" value={subApproach || '—'} multiline />
              <SummaryRow label="Other Contacts" value={contacts.length > 0 ? contacts.map(c => `${c.name} – ${c.role}`).join(', ') : 'None'} />
            </div>
            <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
              <button
                onClick={() => navigate(`/projects/${projectId}/pre-job-checklist`)}
                style={{ background: 'linear-gradient(135deg, #002356, #003580)', color: 'white', border: 'none', borderRadius: 10, padding: '1rem 2.5rem', fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Open Full Pre-Job Checklist →
              </button>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 8 }}>
                All sections have been saved. You can edit any section directly in the checklist.
              </p>
            </div>
          </div>
        );

      default: return null;
    }
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <Link to={`/projects/${projectId}/pre-job-checklist`} style={{ color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Back to Checklist
          </Link>
          <div style={{ fontWeight: 700, color: '#002356', fontSize: '1rem', marginTop: 2 }}>
            Pre-Job Checklist — Guided Setup
            {project?.name && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 8 }}>· {project.name}</span>}
          </div>
        </div>
        <Link to={`/projects/${projectId}/pre-job-checklist`} style={{ color: '#94a3b8', fontSize: '0.8rem', textDecoration: 'none' }}>
          Exit wizard
        </Link>
      </div>

      {/* Progress bar (hide on gate screen) */}
      {step > 0 && step < 11 && <ProgressBar step={step} />}

      {/* Content */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {renderStepContent()}
      </div>

      {/* Navigation (hide on gate and summary) */}
      {step > 0 && step < 10 && (
        <div style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={handleBack} style={navBtn('#f1f5f9', '#475569')}>← Back</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setStep(s => s + 1); window.scrollTo(0, 0); }} style={navBtn('#f1f5f9', '#94a3b8')}>
              Skip
            </button>
            <button onClick={handleContinue} disabled={saving} style={navBtn('#002356', 'white')}>
              {saving ? 'Saving…' : step === 9 ? 'Save & Review →' : 'Save & Continue →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Small helper components ───────────────────────────────────────────────────
const GateItem: React.FC<{ done: boolean; label: string; detail: string; actionLabel?: string; actionHref?: string }> =
  ({ done, label, detail, actionLabel, actionHref }) => (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'white', border: `1px solid ${done ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>{done ? '✅' : '⏳'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: done ? '#16a34a' : '#92400e', fontSize: '0.9rem' }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 3 }}>{detail}</div>
        {!done && actionLabel && actionHref && (
          <Link to={actionHref} style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', marginTop: 4, display: 'inline-block' }}>
            {actionLabel} →
          </Link>
        )}
      </div>
    </div>
  );

const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '1.5rem 0 0.75rem' }}>
    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#002356', whiteSpace: 'nowrap' }}>{label}</div>
    <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
  </div>
);

const SummaryRow: React.FC<{ label: string; value: string; multiline?: boolean }> = ({ label, value, multiline }) => (
  <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem 1rem' }}>
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: '0.85rem', color: '#1e293b', whiteSpace: multiline ? 'pre-wrap' : 'normal', wordBreak: 'break-word' }}>{value}</div>
  </div>
);

// ── Style constants ───────────────────────────────────────────────────────────
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4,
};

const fieldInput: React.CSSProperties = {
  display: 'block', width: '100%', padding: '0.55rem 0.75rem',
  border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box', marginBottom: 4,
  fontFamily: 'inherit',
};

const navBtn = (bg: string, color: string): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 8,
  padding: '0.65rem 1.5rem', fontSize: '0.9rem', fontWeight: 700,
  cursor: 'pointer',
});

const addRowBtn: React.CSSProperties = {
  marginTop: 8, background: 'none', border: '1px dashed #cbd5e1',
  borderRadius: 6, padding: '0.35rem 0.9rem', fontSize: '0.8rem',
  color: '#64748b', cursor: 'pointer', fontWeight: 600,
};

const delBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer',
  fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.4rem',
};

export default PreJobWizard;
