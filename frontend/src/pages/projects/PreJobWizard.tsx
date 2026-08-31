import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { vistaDataService, PhaseCodeDetailRow } from '../../services/vistaData';
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
import { ASSIGNMENT_TRADES } from '../../services/labor';
import { scheduleSegmentsService, SegmentCosts, SegmentsResponse, SEGMENT_DEFINITIONS } from '../../services/scheduleSegments';
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

const FIELD_ROLES = [
  'Superintendent', 'Foreman', 'Journeyman',
  'Apprentice 5', 'Apprentice 4', 'Apprentice 3', 'Apprentice 2', 'Apprentice 1',
  'Pre-Apprentice', 'Helper',
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
  'Key Dates', 'Schedule', 'Office Team', 'Field Team', 'Orientation', 'Site Conditions', 'Scope & Bid',
  'Labor Plan', 'Material Plan', 'Subcontracts', 'Other Costs', 'Contacts', 'Summary',
];

const ProgressBar: React.FC<{ step: number; onStepClick: (n: number) => void }> = ({ step, onStepClick }) => (
  <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0.875rem 2rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: 900, margin: '0 auto' }}>
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done = step > num;
        const active = step === num;
        const clickable = done;
        return (
          <React.Fragment key={label}>
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, cursor: clickable ? 'pointer' : 'default' }}
              onClick={() => clickable && onStepClick(num)}
              title={clickable ? `Go to ${label}` : undefined}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done ? '#16a34a' : active ? '#002356' : '#e2e8f0',
                color: done || active ? 'white' : '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                transition: 'opacity 0.15s',
                opacity: clickable ? 1 : undefined,
              }}>
                {done ? '✓' : num}
              </div>
              <div style={{ fontSize: '0.65rem', color: active ? '#002356' : done ? '#16a34a' : '#94a3b8', fontWeight: active || done ? 700 : 400, marginTop: 3, whiteSpace: 'nowrap', maxWidth: 70, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

  const [step, setStepRaw] = useState(0); // 0 = gate
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState(false);

  const wizardKey = `pjc_wizard_step_${projectId}`;
  const setStep = (val: number | ((s: number) => number)) => {
    setStepRaw(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (next > 0) localStorage.setItem(wizardKey, String(next));
      else localStorage.removeItem(wizardKey);
      return next;
    });
  };

  // ── Draft state per section ──────────────────────────────────────────────
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [schedulingMode, setSchedulingMode] = useState<'summary' | 'cost_type' | 'phase'>('cost_type');
  const [segmentDates, setSegmentDates] = useState<Record<string, { start: string; end: string }>>({});
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

  // ── Labor step mode toggles ───────────────────────────────────────────────
  const [hoursMode, setHoursMode] = useState<'absolute' | 'pct_savings'>('absolute');
  const [rateMode, setRateMode] = useState<'absolute' | 'pct_below'>('absolute');

  // ── Orientation step state ────────────────────────────────────────────────
  const [badgeRequired, setBadgeRequired] = useState(false);
  const [orientationRequired, setOrientationRequired] = useState(false);
  const [safetyTrainingRequired, setSafetyTrainingRequired] = useState(false);
  const [orientationLink, setOrientationLink] = useState('');
  const [orientationContactName, setOrientationContactName] = useState('');
  const [orientationContactPhone, setOrientationContactPhone] = useState('');
  const [orientationContactEmail, setOrientationContactEmail] = useState('');
  const [directions, setDirections] = useState('');
  const [parkingNotes, setParkingNotes] = useState('');
  const [siteMapUploading, setSiteMapUploading] = useState(false);
  const [siteMapFilename, setSiteMapFilename] = useState('');
  const [siteMapAttachmentId, setSiteMapAttachmentId] = useState<number | null>(null);
  const siteMapInputRef = useRef<HTMLInputElement>(null);

  // ── Team step state ───────────────────────────────────────────────────────
  const empSearch = useEmpSearch();
  const [teamRole, setTeamRole] = useState('');
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Field team nomination state ───────────────────────────────────────────
  const fieldEmpSearch = useEmpSearch();
  const [fieldRole, setFieldRole] = useState('');
  const [fieldTrade, setFieldTrade] = useState('');
  const [fieldNotes, setFieldNotes] = useState('');
  const fieldDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) empSearch.setShowDrop(false);
      if (fieldDropRef.current && !fieldDropRef.current.contains(e.target as Node)) fieldEmpSearch.setShowDrop(false);
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

  // Restore saved step once prerequisites are confirmed
  useEffect(() => {
    if (!readiness?.ready) return;
    const saved = parseInt(localStorage.getItem(wizardKey) ?? '', 10);
    if (saved > 0 && saved <= STEPS.length) setStep(saved);
  }, [readiness?.ready]);

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

  const { data: phaseCodeDetail = [] } = useQuery<PhaseCodeDetailRow[]>({
    queryKey: ['phaseCodeDetail', projectId],
    queryFn: () => vistaDataService.getPhaseCodeDetail(Number(projectId)),
    enabled: !!projectId && !!readiness?.vistaLinked,
  });

  const { data: segmentCosts = [] } = useQuery<SegmentCosts[]>({
    queryKey: ['segmentCosts', projectId],
    queryFn: () => scheduleSegmentsService.getCosts(Number(projectId)),
    enabled: !!projectId,
  });

  const { data: segmentsData } = useQuery<SegmentsResponse>({
    queryKey: ['scheduleSegments', projectId],
    queryFn: () => scheduleSegmentsService.getSegments(Number(projectId)),
    enabled: !!projectId,
  });

  const noEstCost = phaseCodeDetail.filter(p => !p.est_cost || p.est_cost === 0).length;
  const noProjectedCost = phaseCodeDetail.filter(p => !p.projected_cost || p.projected_cost === 0).length;
  const withEstCost = phaseCodeDetail.length - noEstCost;
  const withProjectedCost = phaseCodeDetail.length - noProjectedCost;
  const hasPhaseCodeWarnings = noEstCost > 0 || noProjectedCost > 0;

  // Pre-populate drafts from existing checklist
  useEffect(() => {
    if (!checklist) return;
    const pi = checklist.project_info;
    if (pi.special_conditions) setSpecialConditions(pi.special_conditions);
    if (pi.bid_scope_notes) setBidScopeNotes(pi.bid_scope_notes);
    if (pi.other_contacts?.length) setContacts(pi.other_contacts);
    const lb = checklist.labor;
    if (lb.approach_notes) setLaborApproach(lb.approach_notes);
    if (lb.trades?.length) {
      setLaborTrades(lb.trades);
      if (lb.trades.some((t: LaborTradeRow) => t.hours_pct_savings != null)) setHoursMode('pct_savings');
      if (lb.trades.some((t: LaborTradeRow) => t.rate_pct_below != null)) setRateMode('pct_below');
    }
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
    const or = checklist.orientation;
    if (or.badge_required !== undefined) setBadgeRequired(or.badge_required);
    if (or.orientation_required !== undefined) setOrientationRequired(or.orientation_required);
    if (or.safety_training_required !== undefined) setSafetyTrainingRequired(or.safety_training_required);
    if (or.orientation_link) setOrientationLink(or.orientation_link);
    if (or.contact_name) setOrientationContactName(or.contact_name);
    if (or.contact_phone) setOrientationContactPhone(or.contact_phone);
    if (or.contact_email) setOrientationContactEmail(or.contact_email);
    if (or.directions) setDirections(or.directions);
    if (or.parking_notes) setParkingNotes(or.parking_notes);
    if (or.site_map_attachment_id) setSiteMapAttachmentId(or.site_map_attachment_id);
    if (or.site_map_filename) setSiteMapFilename(or.site_map_filename);
  }, [checklist]);

  // Pre-populate segment dates from existing schedule segments
  useEffect(() => {
    if (!segmentsData?.segments.length) return;
    const dates: Record<string, { start: string; end: string }> = {};
    for (const seg of segmentsData.segments) {
      if (seg.start_date || seg.end_date) {
        dates[seg.segment_key] = { start: seg.start_date?.slice(0, 10) ?? '', end: seg.end_date?.slice(0, 10) ?? '' };
      }
    }
    if (Object.keys(dates).length > 0) setSegmentDates(dates);
  }, [segmentsData]);

  // Pre-populate labor trades from Vista segment data when no saved trades exist
  useEffect(() => {
    if (!segmentCosts.length || checklist === undefined) return;
    if (checklist?.labor?.trades?.length) return;
    const rows: LaborTradeRow[] = SEGMENT_DEFINITIONS
      .filter(s => s.isLabor)
      .flatMap(s => {
        const c = segmentCosts.find(x => x.segment_key === s.key);
        if (!c?.est_hours) return [];
        const estRate = c.est_cost && c.est_hours > 0 ? Math.round(c.est_cost / c.est_hours) : undefined;
        return [{ id: uid(), trade: s.label, segment_key: s.key, est_hours: c.est_hours, est_rate: estRate, notes: '' }];
      });
    if (rows.length > 0) setLaborTrades(rows);
  }, [segmentCosts, checklist]);

  useEffect(() => {
    if (project) {
      const s = project.effective_start_date ?? project.start_date;
      const e = project.effective_end_date ?? project.end_date;
      if (!startDate && s) setStartDate(s.slice(0, 10));
      if (!endDate && e) setEndDate(e.slice(0, 10));
      if (project.scheduling_mode) setSchedulingMode(project.scheduling_mode);
    }
  }, [project]);

  // ── Office team ───────────────────────────────────────────────────────────
  const officeAssignments = assignments.filter(a => a.role && (MGMT_ROLES as readonly string[]).includes(a.role));
  const fieldNominations = assignments.filter(a => a.role && (FIELD_ROLES as readonly string[]).includes(a.role));

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

  const nominateFieldMutation = useMutation({
    mutationFn: () => {
      if (!fieldEmpSearch.selected || !fieldRole) throw new Error('Select employee and role');
      return projectAssignmentsApi.addToProject(Number(projectId), {
        employeeId: fieldEmpSearch.selected!.id,
        role: fieldRole,
        trade: fieldTrade || undefined,
        notes: fieldNotes || undefined,
        status: 'planned',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      fieldEmpSearch.reset();
      setFieldRole('');
      setFieldTrade('');
      setFieldNotes('');
      toast.success('Field nomination submitted — pending labor coordinator approval');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to submit nomination'),
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
      case 2:
        await api.patch(`/projects/${pid}/summary-dates`, { scheduling_mode: schedulingMode });
        if (schedulingMode === 'cost_type') {
          await Promise.all(
            Object.entries(segmentDates)
              .filter(([, d]) => d.start || d.end)
              .map(([key, d]) => scheduleSegmentsService.updateSegment(pid, key, {
                start_date: d.start || null,
                end_date: d.end || null,
              }))
          );
          qc.invalidateQueries({ queryKey: ['scheduleSegments', projectId] });
        }
        qc.invalidateQueries({ queryKey: ['project', projectId] });
        break;
      case 3: break; // office team saves live per-add
      case 4: break; // field nominations save live per-submit
      case 5:
        await preJobChecklistApi.updateSection(pid, 'orientation', {
          badge_required: badgeRequired,
          orientation_required: orientationRequired,
          safety_training_required: safetyTrainingRequired,
          orientation_link: orientationLink || undefined,
          contact_name: orientationContactName || undefined,
          contact_phone: orientationContactPhone || undefined,
          contact_email: orientationContactEmail || undefined,
          directions: directions || undefined,
          parking_notes: parkingNotes || undefined,
          site_map_attachment_id: siteMapAttachmentId || undefined,
          site_map_filename: siteMapFilename || undefined,
        });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 6:
        await preJobChecklistApi.updateSection(pid, 'project_info', { ...existingPi, special_conditions: specialConditions });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 7:
        await preJobChecklistApi.updateSection(pid, 'project_info', { ...(checklist?.project_info ?? {}), bid_scope_notes: bidScopeNotes });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 8: {
        const tradesToSave = laborTrades.map(row => {
          const goalHrs = (hoursMode === 'pct_savings' && row.est_hours && row.hours_pct_savings != null)
            ? Math.round(row.est_hours * (1 - row.hours_pct_savings / 100))
            : row.goal_hours;
          const tgtRate = (rateMode === 'pct_below' && row.est_rate && row.rate_pct_below != null)
            ? Math.round(row.est_rate * (1 - row.rate_pct_below / 100))
            : row.target_rate;
          return { ...row, goal_hours: goalHrs, target_rate: tgtRate };
        });
        await preJobChecklistApi.updateSection(pid, 'labor', { approach_notes: laborApproach, trades: tradesToSave });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      }
      case 9:
        await preJobChecklistApi.updateSection(pid, 'material', { approach_notes: materialApproach, items: materialItems });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 10:
        await preJobChecklistApi.updateSection(pid, 'subcontracts', { approach_notes: subApproach, items: subItems });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 11:
        await Promise.all([
          preJobChecklistApi.updateSection(pid, 'rental', { approach_notes: rentalApproach, items: rentalItems }),
          preJobChecklistApi.updateSection(pid, 'mep_equipment', { approach_notes: mepApproach, items: mepItems }),
          preJobChecklistApi.updateSection(pid, 'general_conditions', { approach_notes: gcApproach, items: gcItems }),
        ]);
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
      case 12:
        await preJobChecklistApi.updateSection(pid, 'project_info', { ...(checklist?.project_info ?? {}), other_contacts: contacts });
        qc.invalidateQueries({ queryKey: ['preJobChecklist', projectId] });
        break;
    }
  };

  const handleContinue = async () => {
    if (step === 1 && (!startDate || !endDate)) {
      setDateError(true);
      return;
    }
    setDateError(false);
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
  const renderLaborTable = () => {
    const modePill = (active: boolean): React.CSSProperties => ({
      padding: '1px 6px', borderRadius: 4, border: 'none', cursor: 'pointer',
      fontSize: '0.62rem', fontWeight: 700, lineHeight: '16px',
      background: active ? '#002356' : '#e2e8f0',
      color: active ? 'white' : '#64748b',
    });
    const estCell: React.CSSProperties = { ...tdStyle, background: '#eff6ff', textAlign: 'right', paddingRight: 8, fontWeight: 600, color: '#1d4ed8', fontSize: '0.8rem', whiteSpace: 'nowrap' };
    return (
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: 680 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={thStyle}>Trade</th>
              <th style={{ ...thStyle, background: '#eff6ff', color: '#1d4ed8', textAlign: 'right' }}>Est Hrs</th>
              <th style={{ ...thStyle, background: '#eff6ff', color: '#1d4ed8', textAlign: 'right' }}>Avg Est $/Hr</th>
              <th style={thStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button style={modePill(hoursMode === 'absolute')} onClick={() => setHoursMode('absolute')}>Goal Hrs</button>
                  <button style={modePill(hoursMode === 'pct_savings')} onClick={() => setHoursMode('pct_savings')}>% Savings</button>
                </div>
              </th>
              <th style={thStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button style={modePill(rateMode === 'absolute')} onClick={() => setRateMode('absolute')}>Target $/Hr</button>
                  <button style={modePill(rateMode === 'pct_below')} onClick={() => setRateMode('pct_below')}>% Below</button>
                </div>
              </th>
              <th style={thStyle}>Notes</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {laborTrades.map((row, i) => {
              const computedGoalHrs = (hoursMode === 'pct_savings' && row.est_hours && row.hours_pct_savings != null)
                ? Math.round(row.est_hours * (1 - row.hours_pct_savings / 100))
                : null;
              const computedRate = (rateMode === 'pct_below' && row.est_rate && row.rate_pct_below != null)
                ? Math.round(row.est_rate * (1 - row.rate_pct_below / 100))
                : null;
              return (
                <tr key={row.id}>
                  <td style={tdStyle}><input style={colStyle} value={row.trade} onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, trade: e.target.value } : r))} /></td>
                  <td style={estCell}>{row.est_hours ? row.est_hours.toLocaleString() : '—'}</td>
                  <td style={estCell}>{row.est_rate ? `$${row.est_rate}` : '—'}</td>
                  <td style={tdStyle}>
                    {hoursMode === 'absolute' ? (
                      <input style={colStyle} type="number" min={0}
                        value={row.goal_hours ?? ''}
                        onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, goal_hours: e.target.value ? Number(e.target.value) : undefined } : r))} />
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <input style={{ ...colStyle, width: 56 }} type="number" min={0} max={100} step={0.5}
                            value={row.hours_pct_savings ?? ''}
                            onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, hours_pct_savings: e.target.value ? Number(e.target.value) : undefined } : r))} />
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>%</span>
                        </div>
                        {computedGoalHrs != null && <div style={{ color: '#059669', fontSize: '0.68rem', marginTop: 2 }}>= {computedGoalHrs.toLocaleString()} hrs</div>}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {rateMode === 'absolute' ? (
                      <input style={colStyle} type="number" min={0}
                        value={row.target_rate ?? ''}
                        onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, target_rate: e.target.value ? Number(e.target.value) : undefined } : r))} />
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <input style={{ ...colStyle, width: 56 }} type="number" min={0} max={100} step={0.5}
                            value={row.rate_pct_below ?? ''}
                            onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, rate_pct_below: e.target.value ? Number(e.target.value) : undefined } : r))} />
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>%</span>
                        </div>
                        {computedRate != null && <div style={{ color: '#059669', fontSize: '0.68rem', marginTop: 2 }}>= ${computedRate}/hr</div>}
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}><input style={colStyle} value={row.notes ?? ''} onChange={e => setLaborTrades(lt => lt.map((r, j) => j === i ? { ...r, notes: e.target.value } : r))} /></td>
                  <td style={tdStyle}><button style={delBtn} onClick={() => setLaborTrades(lt => lt.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button style={addRowBtn} onClick={() => setLaborTrades(lt => [...lt, { id: uid(), trade: '', notes: '' }])}>+ Add Trade</button>
      </div>
    );
  };

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
                  detail={vistaOk
                    ? `Contract ${readiness?.vistaContractNumber ?? ''} — estimate on file.`
                    : 'The estimate needs to be uploaded to Vista with a non-zero contract amount and linked to this project.'}
                  actionLabel={undefined}
                  actionHref={undefined}
                />
                <GateItem
                  done={projOk}
                  label="First Vista projection completed"
                  detail={projOk ? 'Projected costs are on file from Vista.' : 'The PM needs to complete the first projection in Vista so projected costs are populated before starting the pre-job checklist.'}
                  actionLabel={undefined}
                  actionHref={undefined}
                />
              </div>
            )}

            {/* Phase code advisory — shown whenever Vista is linked */}
            {readiness?.vistaLinked && phaseCodeDetail.length > 0 && (
              <div style={{
                background: hasPhaseCodeWarnings ? '#fffbeb' : '#f0fdf4',
                border: `1px solid ${hasPhaseCodeWarnings ? '#fde68a' : '#bbf7d0'}`,
                borderRadius: 10, padding: '1rem 1.25rem', marginBottom: '1.5rem',
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: hasPhaseCodeWarnings ? '#92400e' : '#166534', marginBottom: 6 }}>
                  {hasPhaseCodeWarnings ? '⚠️ Phase Code Gaps Detected' : '✅ Phase Codes Look Good'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.6 }}>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: 8 }}>
                    <span><strong style={{ color: '#002356' }}>{phaseCodeDetail.length}</strong> phase codes</span>
                    <span><strong style={{ color: withEstCost === phaseCodeDetail.length ? '#166534' : '#b45309' }}>{withEstCost}</strong> with estimated cost</span>
                    <span><strong style={{ color: withProjectedCost === phaseCodeDetail.length ? '#166534' : '#b45309' }}>{withProjectedCost}</strong> with projected cost</span>
                  </div>
                  {noEstCost > 0 && (
                    <div style={{ color: '#b45309' }}>
                      {noEstCost} phase code{noEstCost !== 1 ? 's have' : ' has'} no estimated cost — these won't show up in labor or material budgets.
                    </div>
                  )}
                  {noProjectedCost > 0 && (
                    <div style={{ color: '#b45309', marginTop: 4 }}>
                      {noProjectedCost} phase code{noProjectedCost !== 1 ? 's have' : ' has'} no projected cost — the first Vista projection may not cover all codes yet.
                    </div>
                  )}
                  {!hasPhaseCodeWarnings && (
                    <div style={{ color: '#166534' }}>All phase codes have estimated and projected costs.</div>
                  )}
                </div>
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
      case 1: {
        const datesAlreadySet = !!(startDate && endDate);
        return (
          <div>
            <TitanCard
              question={datesAlreadySet
                ? "Your project dates are already on file. Review and confirm before continuing."
                : "Let's start with the timeline. When does this project kick off, and when do you expect to wrap up?"}
              hint={datesAlreadySet
                ? "These dates were pulled from the project schedule. Update them here if anything has changed — changes sync to the project record and Vista."
                : "These dates sync with the project record and Vista contract overrides."}
            />
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={fieldLabel}>Project Start Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="date"
                  style={{ ...fieldInput, borderColor: dateError && !startDate ? '#ef4444' : undefined }}
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); if (e.target.value) setDateError(false); }}
                />
                {dateError && !startDate && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>Start date is required.</div>}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={fieldLabel}>Estimated Completion <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="date"
                  style={{ ...fieldInput, borderColor: dateError && !endDate ? '#ef4444' : undefined }}
                  value={endDate}
                  onChange={e => { setEndDate(e.target.value); if (e.target.value) setDateError(false); }}
                />
                {dateError && !endDate && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>End date is required.</div>}
              </div>
            </div>
          </div>
        );
      }

      // STEP 2 — SCHEDULE MODE
      case 2: {
        const modeCard = (
          mode: 'summary' | 'cost_type' | 'phase',
          title: string,
          badge: string | null,
          badgeColor: string,
          description: string,
        ) => {
          const selected = schedulingMode === mode;
          return (
            <div
              onClick={() => setSchedulingMode(mode)}
              style={{
                border: `2px solid ${selected ? '#002356' : '#e2e8f0'}`,
                borderRadius: 10, padding: '0.85rem 1.1rem', marginBottom: 8,
                background: selected ? '#eff6ff' : 'white', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${selected ? '#002356' : '#cbd5e1'}`,
                  background: selected ? '#002356' : 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }} />}
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{title}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 4 }}>— {description}</span>
                {badge && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap', background: badgeColor === 'green' ? '#dcfce7' : '#fef9c3', color: badgeColor === 'green' ? '#166534' : '#92400e' }}>
                    {badge}
                  </span>
                )}
              </div>
            </div>
          );
        };

        // Segments with estimated costs — only show relevant ones
        const activeSegKeys = new Set(
          segmentCosts.filter(c => (c.est_hours ?? 0) > 0 || (c.est_cost ?? 0) > 0).map(c => c.segment_key)
        );
        const relevantSegs = SEGMENT_DEFINITIONS.filter(s => activeSegKeys.has(s.key));

        const setSegDate = (key: string, field: 'start' | 'end', val: string) =>
          setSegmentDates(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));

        const fillAllFromProject = () => {
          const filled: Record<string, { start: string; end: string }> = {};
          relevantSegs.forEach(s => { filled[s.key] = { start: startDate, end: endDate }; });
          setSegmentDates(filled);
        };

        return (
          <div>
            <TitanCard
              question="How do you want to schedule this project? This choice drives how your revenue and labor forecasts are broken out."
              hint="Pick the mode that fits this job's complexity. You can always change it later on the Schedule tab."
            />

            {/* Mode selector */}
            {modeCard('summary', 'Summary', 'Small / single-trade jobs', 'yellow', 'One date window for the whole project')}
            {modeCard('cost_type', 'Cost Type', '⭐ Recommended for most projects', 'green', 'Separate date window per trade and cost type')}
            {modeCard('phase', 'Phase', 'Build later', 'yellow', 'Per-phase-code windows — best set up after project start')}

            <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 20, paddingTop: 20 }}>

              {/* SUMMARY: dates already set */}
              {schedulingMode === 'summary' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '1rem 1.25rem' }}>
                  <div style={{ fontWeight: 700, color: '#166534', marginBottom: 4 }}>✓ You're all set for Summary scheduling</div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                    Your project window <strong>{startDate || '—'}</strong> → <strong>{endDate || '—'}</strong> (set in Step 1) is all Titan needs.
                    Revenue and labor will be distributed evenly across this window.
                    {(!startDate || !endDate) && <span style={{ color: '#b45309' }}> Go back to Step 1 to set your project dates first.</span>}
                  </div>
                </div>
              )}

              {/* COST TYPE: per-trade date table */}
              {schedulingMode === 'cost_type' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Set dates per trade and cost type</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>Only trades with estimated costs are shown. Tip: start with project dates and adjust per trade.</div>
                    </div>
                    {startDate && endDate && (
                      <button
                        onClick={fillAllFromProject}
                        style={{ padding: '0.4rem 0.9rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        Fill all from project dates
                      </button>
                    )}
                  </div>

                  {relevantSegs.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '1rem', background: '#f8fafc', borderRadius: 8 }}>
                      No Vista estimated costs found yet. Dates can be set on the Schedule tab once Vista data is uploaded.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={thStyle}>Trade / Cost Type</th>
                            <th style={{ ...thStyle, background: '#eff6ff', color: '#1d4ed8' }}>Est Hrs / Cost</th>
                            <th style={thStyle}>Start Date</th>
                            <th style={thStyle}>End Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relevantSegs.map(seg => {
                            const costs = segmentCosts.find(c => c.segment_key === seg.key);
                            const ref = seg.isLabor
                              ? (costs?.est_hours ? `${costs.est_hours.toLocaleString()} hrs` : '—')
                              : (costs?.est_cost ? `$${Math.round(costs.est_cost).toLocaleString()}` : '—');
                            const d = segmentDates[seg.key] ?? { start: '', end: '' };
                            return (
                              <tr key={seg.key}>
                                <td style={{ ...tdStyle, fontWeight: 600, paddingLeft: 4 }}>{seg.label}</td>
                                <td style={{ ...tdStyle, background: '#eff6ff', color: '#1d4ed8', textAlign: 'right', paddingRight: 8, fontWeight: 600 }}>{ref}</td>
                                <td style={tdStyle}>
                                  <input type="date" style={colStyle} value={d.start}
                                    onChange={e => setSegDate(seg.key, 'start', e.target.value)} />
                                </td>
                                <td style={tdStyle}>
                                  <input type="date" style={colStyle} value={d.end}
                                    onChange={e => setSegDate(seg.key, 'end', e.target.value)} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* PHASE: advisory */}
              {schedulingMode === 'phase' && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '1rem 1.25rem' }}>
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 6 }}>⚠️ Phase scheduling is best built after project start</div>
                  <div style={{ fontSize: '0.85rem', color: '#78350f', lineHeight: 1.7 }}>
                    Phase mode gives you maximum forecasting precision — every Vista phase code gets its own start and end date.
                    However, it requires your phase codes to be fully built out and active in Vista before it's useful.
                  </div>
                  <ul style={{ fontSize: '0.82rem', color: '#78350f', lineHeight: 1.8, margin: '8px 0 0 0', paddingLeft: 20 }}>
                    <li>We'll save your Phase mode selection now.</li>
                    <li>Once the project is underway and your phase schedule is established, go to the <strong>Schedule → Phase</strong> tab to set individual phase dates.</li>
                    <li>For large jobs with many phase codes, this can take 30–60 minutes — plan accordingly.</li>
                  </ul>
                </div>
              )}

            </div>
          </div>
        );
      }

      // STEP 3 — PROJECT TEAM
      case 3:
        return (
          <div>
            <TitanCard
              question={officeAssignments.length > 0
                ? "Your office team is already set up. Review the roster or add anyone who's missing."
                : "Who's managing this project? Add your office and management team."}
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

      // STEP 4 — FIELD TEAM NOMINATIONS
      case 4: {
        const STATUS_LABEL: Record<string, string> = {
          planned: 'Pending Approval',
          active: 'Active',
          declined: 'Declined',
        };
        return (
          <div>
            <TitanCard
              question={fieldNominations.length > 0
                ? "Field nominations are already in place. Review or add more below."
                : "Who are you nominating for the field crew on this project?"}
              hint="Field nominations go to the Labor Coordinator for approval. You can add as many as needed — they'll appear in the Nominations board."
            />

            {/* Existing nominations list */}
            {fieldNominations.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Submitted Nominations
                </div>
                {fieldNominations.map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>{[a.first_name, a.last_name].filter(Boolean).join(' ')}</span>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{a.role}{a.trade ? ` · ${a.trade}` : ''}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                      background: a.status === 'active' ? '#dcfce7' : a.status === 'declined' ? '#fee2e2' : '#fef9c3',
                      color: a.status === 'active' ? '#166534' : a.status === 'declined' ? '#991b1b' : '#92400e',
                    }}>
                      {STATUS_LABEL[a.status ?? 'planned'] ?? a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Nomination form */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 10 }}>
                Field nominations are sent to the Labor Coordinator for approval before becoming active.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 2, minWidth: 180, position: 'relative' }} ref={fieldDropRef}>
                  <label style={fieldLabel}>Employee</label>
                  <input
                    type="text"
                    style={fieldInput}
                    placeholder="Search by name…"
                    value={fieldEmpSearch.query}
                    onChange={e => { fieldEmpSearch.setQuery(e.target.value); fieldEmpSearch.clearSel(); }}
                    autoComplete="off"
                  />
                  {fieldEmpSearch.showDrop && fieldEmpSearch.results.length > 0 && !fieldEmpSearch.selected && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 50, maxHeight: 200, overflowY: 'auto' }}>
                      {fieldEmpSearch.results.map(e => (
                        <button key={e.id} onMouseDown={() => fieldEmpSearch.select(e)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <strong>{e.first_name} {e.last_name}</strong>
                          {(e.title || e.trade) && <span style={{ color: '#94a3b8', marginLeft: 6, fontSize: '0.75rem' }}>{[e.title, e.trade].filter(Boolean).join(' · ')}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={fieldLabel}>Role</label>
                  <select style={fieldInput} value={fieldRole} onChange={e => setFieldRole(e.target.value)}>
                    <option value="">— select —</option>
                    {FIELD_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 130 }}>
                  <label style={fieldLabel}>Trade</label>
                  <select style={fieldInput} value={fieldTrade} onChange={e => setFieldTrade(e.target.value)}>
                    <option value="">— select —</option>
                    {([...ASSIGNMENT_TRADES] as string[]).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={fieldLabel}>Notes (optional)</label>
                <input
                  type="text"
                  style={fieldInput}
                  placeholder="Start date, phase, special skills…"
                  value={fieldNotes}
                  onChange={e => setFieldNotes(e.target.value)}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  disabled={!fieldEmpSearch.selected || !fieldRole || nominateFieldMutation.isPending}
                  onClick={() => nominateFieldMutation.mutate()}
                  style={{ padding: '0.55rem 1.5rem', background: '#002356', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', opacity: fieldEmpSearch.selected && fieldRole ? 1 : 0.45 }}
                >
                  {nominateFieldMutation.isPending ? 'Submitting…' : 'Submit for Approval →'}
                </button>
              </div>
            </div>
          </div>
        );
      }

      // STEP 5 — ORIENTATION
      case 5: {
        const toggleStyle = (active: boolean): React.CSSProperties => ({
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem',
          borderRadius: 8, border: `2px solid ${active ? '#002356' : '#e2e8f0'}`,
          background: active ? '#eff6ff' : 'white', cursor: 'pointer',
          fontWeight: 600, fontSize: '0.85rem', color: active ? '#002356' : '#64748b',
          userSelect: 'none', transition: 'all 0.15s',
        });
        return (
          <div>
            <TitanCard
              question="What does your crew need to get on site? Set up site access, orientation, and how to get there."
              hint="This info goes straight to your field team so they're ready before day one."
            />

            {/* Site Security */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Site Security & Access
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={toggleStyle(badgeRequired)} onClick={() => setBadgeRequired(v => !v)}>
                  <span>{badgeRequired ? '✓' : '○'}</span> Badge Required
                </label>
                <label style={toggleStyle(orientationRequired)} onClick={() => setOrientationRequired(v => !v)}>
                  <span>{orientationRequired ? '✓' : '○'}</span> Site Orientation Required
                </label>
                <label style={toggleStyle(safetyTrainingRequired)} onClick={() => setSafetyTrainingRequired(v => !v)}>
                  <span>{safetyTrainingRequired ? '✓' : '○'}</span> Safety Training Required
                </label>
              </div>
            </div>

            {/* Orientation contact & link */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Orientation Contact
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={fieldLabel}>Name</label>
                  <input type="text" style={fieldInput} placeholder="Contact name" value={orientationContactName} onChange={e => setOrientationContactName(e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={fieldLabel}>Phone</label>
                  <input type="tel" style={fieldInput} placeholder="(xxx) xxx-xxxx" value={orientationContactPhone} onChange={e => setOrientationContactPhone(e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={fieldLabel}>Email</label>
                  <input type="email" style={fieldInput} placeholder="email@example.com" value={orientationContactEmail} onChange={e => setOrientationContactEmail(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <label style={fieldLabel}>Orientation Link (ISN, Avetta, online training portal, etc.)</label>
                <input type="url" style={fieldInput} placeholder="https://…" value={orientationLink} onChange={e => setOrientationLink(e.target.value)} />
              </div>
            </div>

            {/* Directions & Parking */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Getting There
              </div>
              <label style={fieldLabel}>Directions to Jobsite</label>
              <textarea rows={4} style={{ ...fieldInput, resize: 'vertical', marginBottom: '0.75rem' }} placeholder="Gate entrance, turn-by-turn notes, truck route restrictions…" value={directions} onChange={e => setDirections(e.target.value)} />
              <label style={fieldLabel}>Parking Notes</label>
              <input type="text" style={fieldInput} placeholder="Crew parking location, permit required, laydown yard…" value={parkingNotes} onChange={e => setParkingNotes(e.target.value)} />
            </div>

            {/* Site Map Upload */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                Site Map
              </div>
              <input ref={siteMapInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" style={{ display: 'none' }} onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setSiteMapUploading(true);
                try {
                  const form = new FormData();
                  form.append('file', file);
                  const { data } = await api.post(`/attachments/project/${projectId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
                  setSiteMapAttachmentId(data.id);
                  setSiteMapFilename(data.original_name ?? file.name);
                } catch {
                  toast.error('Failed to upload site map — try again.');
                } finally {
                  setSiteMapUploading(false);
                  if (siteMapInputRef.current) siteMapInputRef.current.value = '';
                }
              }} />
              {siteMapFilename ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                  <span style={{ fontSize: '1.1rem' }}>🗺</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>{siteMapFilename}</span>
                  <button onClick={() => { setSiteMapAttachmentId(null); setSiteMapFilename(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
              ) : (
                <button
                  onClick={() => siteMapInputRef.current?.click()}
                  disabled={siteMapUploading}
                  style={{ padding: '0.6rem 1.25rem', background: 'white', border: '2px dashed #cbd5e1', borderRadius: 8, color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {siteMapUploading ? 'Uploading…' : '+ Upload Site Map'}
                </button>
              )}
            </div>
          </div>
        );
      }

      // STEP 6 — SITE CONDITIONS
      case 6:
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

      // STEP 7 — SCOPE & BID NOTES
      case 7:
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

      // STEP 8 — LABOR PLAN
      case 8: {
        const lt = costSummary?.labor_totals;
        return (
          <div>
            <TitanCard
              question="What's your labor strategy for this job? Set your trade goals and target rates."
              hint="These goals guide your monthly projections and headcount planning."
            />
            {lt && <VistaBox label="Labor" estHrs={lt.est_hours} jtdHrs={lt.jtd_hours} estCost={lt.est_cost} jtdCost={lt.jtd_cost} />}
            {hasPhaseCodeWarnings && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e' }}>
                <strong>⚠️ Heads up:</strong>
                {noEstCost > 0 && <span> {noEstCost} phase code{noEstCost !== 1 ? 's are' : ' is'} missing estimated cost.</span>}
                {noProjectedCost > 0 && <span> {noProjectedCost} phase code{noProjectedCost !== 1 ? 's are' : ' is'} missing projected cost.</span>}
                {' '}These gaps may make the labor budget totals above incomplete.
              </div>
            )}
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

      // STEP 9 — MATERIAL PLAN
      case 9: {
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

      // STEP 10 — SUBCONTRACTS
      case 10: {
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

      // STEP 11 — OTHER COSTS
      case 11: {
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

      // STEP 12 — OTHER CONTACTS
      case 12:
        return (
          <div>
            <TitanCard
              question="Anyone else who needs to be in the loop for this project?"
              hint="Think: GC superintendent, architect, owner representative, engineer of record, inspectors."
            />
            {renderContactsTable()}
          </div>
        );

      // STEP 13 — SUMMARY
      case 13:
        return (
          <div>
            <TitanCard
              question="You're all set! Here's a summary of what you've set up. Review it and then open the full checklist to refine any section."
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SummaryRow label="Dates" value={startDate && endDate ? `${startDate} → ${endDate}` : startDate || endDate || '—'} />
              <SummaryRow label="Schedule Mode" value={schedulingMode === 'cost_type' ? 'Cost Type' : schedulingMode === 'phase' ? 'Phase' : 'Summary'} />
              <SummaryRow label="Office Team" value={officeAssignments.length > 0 ? officeAssignments.map(a => `${[a.first_name, a.last_name].filter(Boolean).join(' ')} (${a.role})`).join(', ') : 'None added'} />
              <SummaryRow label="Field Nominations" value={fieldNominations.length > 0 ? `${fieldNominations.length} nomination${fieldNominations.length !== 1 ? 's' : ''} submitted — pending coordinator approval` : 'None submitted'} />
              <SummaryRow label="Orientation" value={[
                badgeRequired ? 'Badge required' : null,
                orientationRequired ? 'Orientation required' : null,
                safetyTrainingRequired ? 'Safety training required' : null,
                orientationContactName ? `Contact: ${orientationContactName}` : null,
                orientationLink ? 'Link on file' : null,
                siteMapFilename ? `Site map: ${siteMapFilename}` : null,
              ].filter(Boolean).join(' · ') || '—'} />
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
                onClick={() => { localStorage.removeItem(wizardKey); navigate(`/projects/${projectId}/pre-job-checklist`); }}
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
      {step > 0 && step < 14 && <ProgressBar step={step} onStepClick={n => { setStep(n); window.scrollTo(0, 0); }} />}

      {/* Content */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {renderStepContent()}
      </div>

      {/* Navigation (hide on gate and summary) */}
      {step > 0 && step < 13 && (
        <div style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={handleBack} style={navBtn('#f1f5f9', '#475569')}>← Back</button>
          <div style={{ display: 'flex', gap: 10 }}>
            {step !== 1 && (
              <button onClick={() => { setStep(s => s + 1); window.scrollTo(0, 0); }} style={navBtn('#f1f5f9', '#94a3b8')}>
                Skip
              </button>
            )}
            <button onClick={handleContinue} disabled={saving} style={navBtn('#002356', 'white')}>
              {saving ? 'Saving…' : step === 12 ? 'Save & Review →' : 'Save & Continue →'}
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
        {!done && !actionHref && (
          <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 4, fontStyle: 'italic' }}>
            This is completed in Vista, not Titan.
          </div>
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
