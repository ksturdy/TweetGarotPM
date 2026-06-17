import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectCostModelApi,
  EquipmentInput,
  AiScanResult,
  SectionColumn,
  WebLookupResult,
} from '../../services/projectCostModel';
import { projectsApi } from '../../services/projects';
import { customersApi } from '../../services/customers';
import { drawingsApi } from '../../services/drawings';
import { costDatabaseService } from '../../services/costDatabase';

// Section visual config
const SECTION_UI: Record<string, { label: string; color: string; bg: string }> = {
  major_equipment: { label: 'Major Equipment', color: '#1e40af', bg: '#eff6ff' },
  terminal_units: { label: 'Terminal & Zone Units', color: '#7c3aed', bg: '#f5f3ff' },
  ventilation: { label: 'Ventilation & Exhaust', color: '#059669', bg: '#ecfdf5' },
  piping: { label: 'Piping & Accessories', color: '#d97706', bg: '#fffbeb' },
};
const SECTION_ORDER = ['major_equipment', 'terminal_units', 'ventilation', 'piping'];

const BUILDING_TYPES = [
  'Athletic Facility', 'Hospital', 'Medical Office', 'Office', 'Data Center', 'Laboratory',
  'Manufacturing', 'Warehouse', 'K-12 School', 'University', 'Dormitory',
  'Hotel', 'Retail', 'Restaurant', 'Church', 'Government', 'Courthouse',
  'Prison', 'Military', 'Airport', 'Parking Garage', 'Mixed Use', 'Other',
];

const PROJECT_TYPES = [
  'New Construction', 'Renovation', 'Expansion', 'Tenant Improvement',
  'Design-Build', 'Design-Assist', 'Plan & Spec', 'Other',
];

const BID_TYPES = [
  'GC Bid', 'Negotiated', 'Design-Build', 'Design-Assist', 'CM at Risk', 'Public Bid', 'Other',
];

// Equipment row state — specs stored as spec_N keyed strings
interface EquipmentRow {
  equipment_type: string;
  equipment_label: string;
  count: number;
  is_custom: boolean;
  notes: string;
  source: 'manual' | 'ai_scan';
  ai_confidence: number | null;
  dbId?: number;
  section: string; // which section this row belongs to
  activeSlots: (number | null)[]; // from the equipment type definition
  // Spec values stored by slot: spec_1..spec_5
  specs: Record<string, string>; // e.g. { spec_1: '10000', spec_2: '120' }
  weight_lbs: string;
}

// Helper: get spec value from a DB row by slot number
const getDbSpec = (saved: any, slot: number): string => {
  const v = saved?.[`spec_${slot}_value`];
  return v != null ? String(v) : '';
};

const ProjectCostModel: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Form state
  const [totalSqft, setTotalSqft] = useState<string>('');
  const [buildingType, setBuildingType] = useState<string>('');
  const [projectType, setProjectType] = useState<string>('');
  const [bidType, setBidType] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [market, setMarket] = useState<string>('');
  const [generalContractor, setGeneralContractor] = useState<string>('');
  const [equipmentRows, setEquipmentRows] = useState<EquipmentRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const SCOPE_OPTIONS = ['Plumbing', 'Sheet Metal', 'Piping', 'BAS'] as const;

  const toggleScope = (scope: string) => {
    setScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
    setHasChanges(true);
  };

  // Custom equipment form
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customCount, setCustomCount] = useState<string>('0');

  // AI scan state
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<number[]>([]);
  const [scanResult, setScanResult] = useState<AiScanResult | null>(null);
  const [scanAccepted, setScanAccepted] = useState<Record<string, boolean>>({});

  // Web lookup state
  const [showWebLookupDialog, setShowWebLookupDialog] = useState(false);
  const [webLookupResult, setWebLookupResult] = useState<WebLookupResult | null>(null);
  const [webLookupAccepted, setWebLookupAccepted] = useState<Record<string, boolean>>({});
  const [webLookupEdits, setWebLookupEdits] = useState<Record<string, string>>({});
  // Customer matches found for owner/architect from web lookup
  type CustomerMatch = { id: number; name: string } | null | 'loading' | 'not_found';
  const [ownerMatch, setOwnerMatch] = useState<CustomerMatch>(null);
  const [architectMatch, setArchitectMatch] = useState<CustomerMatch>(null);

  // Queries
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then((r: any) => r.data),
  });

  const { data: costModelData, isLoading } = useQuery({
    queryKey: ['cost-model', projectId],
    queryFn: () => projectCostModelApi.get(Number(projectId)),
  });

  const { data: drawingsData } = useQuery({
    queryKey: ['drawings', projectId, 'cost-model-scan'],
    queryFn: () => drawingsApi.getByProject(Number(projectId), { is_latest: true }).then(r => r.data.data),
    enabled: showScanDialog,
  });

  const { data: vistaFilterOpts } = useQuery({
    queryKey: ['costDb', 'filters'],
    queryFn: () => costDatabaseService.getFilters(),
  });

  // Initialize form from loaded data
  useEffect(() => {
    if (!costModelData) return;

    const { meta, equipment, standardTypes } = costModelData;
    const { equipment: sections, columns } = standardTypes;

    if (meta) {
      setTotalSqft(meta.total_sqft ? String(meta.total_sqft) : '');
      setBuildingType(meta.building_type || '');
      setProjectType(meta.project_type || '');
      setBidType(meta.bid_type || '');
      setNotes(meta.notes || '');
      setScopes(Array.isArray(meta.scopes) ? meta.scopes : []);
      setMarket(meta.market || '');
      setGeneralContractor(meta.general_contractor || '');
    }

    const rows: EquipmentRow[] = [];
    const savedMap = new Map(equipment.map(e => [e.equipment_type, e]));

    for (const secKey of SECTION_ORDER) {
      const types = sections[secKey] || [];
      const secCols = columns[secKey] || [];
      for (const t of types) {
        const saved = savedMap.get(t.type);
        const specs: Record<string, string> = {};
        for (const col of secCols) {
          specs[`spec_${col.slot}`] = getDbSpec(saved, col.slot);
        }
        rows.push({
          equipment_type: t.type,
          equipment_label: t.label,
          count: saved?.count ?? 0,
          is_custom: false,
          notes: saved?.notes ?? '',
          source: (saved?.source as 'manual' | 'ai_scan') ?? 'manual',
          ai_confidence: saved?.ai_confidence ?? null,
          dbId: saved?.id,
          section: secKey,
          activeSlots: t.slots,
          specs,
          weight_lbs: saved?.weight_lbs != null ? String(saved.weight_lbs) : '',
        });
      }
    }

    // Custom types
    const standardKeys = new Set(
      SECTION_ORDER.flatMap(secKey => (sections[secKey] || []).map(t => t.type))
    );
    for (const e of equipment) {
      if (!standardKeys.has(e.equipment_type)) {
        rows.push({
          equipment_type: e.equipment_type,
          equipment_label: e.equipment_label,
          count: e.count,
          is_custom: true,
          notes: e.notes ?? '',
          source: e.source as 'manual' | 'ai_scan',
          ai_confidence: e.ai_confidence,
          dbId: e.id,
          section: 'custom',
          activeSlots: [],
          specs: {
            spec_1: getDbSpec(e, 1),
            spec_2: getDbSpec(e, 2),
          },
          weight_lbs: e.weight_lbs != null ? String(e.weight_lbs) : '',
        });
      }
    }

    setEquipmentRows(rows);
    setHasChanges(false);
  }, [costModelData]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      await projectCostModelApi.updateMeta(Number(projectId), {
        total_sqft: totalSqft ? Number(totalSqft) : null,
        building_type: buildingType || null,
        project_type: projectType || null,
        bid_type: bidType || null,
        notes: notes || null,
        scopes,
        market: market || null,
        general_contractor: generalContractor || null,
      });

      const secCols = costModelData?.standardTypes?.columns || {};

      // Only send rows with data
      const hasSpecData = (r: EquipmentRow) => Object.values(r.specs).some(v => v !== '');
      const items: EquipmentInput[] = equipmentRows
        .filter(r => r.count > 0 || r.notes || hasSpecData(r) || r.weight_lbs || r.dbId)
        .map(r => {
          // Look up section columns to get labels/units for each spec slot
          const cols = secCols[r.section] || [];
          const colMap = new Map(cols.map((c: SectionColumn) => [c.slot, c]));

          const input: EquipmentInput = {
            equipment_type: r.equipment_type,
            equipment_label: r.equipment_label,
            count: r.count,
            is_custom: r.is_custom,
            notes: r.notes || null,
            source: r.source,
            ai_confidence: r.ai_confidence,
            weight_lbs: r.weight_lbs ? Number(r.weight_lbs) : null,
          };

          // Map spec slots 1-5
          for (let s = 1; s <= 5; s++) {
            const val = r.specs[`spec_${s}`];
            const col = colMap.get(s);
            (input as any)[`spec_${s}_value`] = val ? Number(val) : null;
            (input as any)[`spec_${s}_label`] = col?.label ?? null;
            (input as any)[`spec_${s}_unit`] = col?.unit ?? null;
          }

          return input;
        });

      if (items.length > 0) {
        await projectCostModelApi.updateEquipment(Number(projectId), items);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-model', projectId] });
      setHasChanges(false);
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => projectCostModelApi.scanDrawings(Number(projectId), selectedDrawingIds),
    onSuccess: (result) => {
      setScanResult(result);
      const accepted: Record<string, boolean> = {};
      for (const eq of result.equipment) {
        accepted[eq.type] = true;
      }
      setScanAccepted(accepted);
    },
  });

  const webLookupMutation = useMutation({
    mutationFn: () => projectCostModelApi.webLookup(Number(projectId)),
    onSuccess: ({ result }) => {
      setWebLookupResult(result);
      // Pre-accept any fields that would fill in a currently-blank value
      const accepted: Record<string, boolean> = {};
      if (result.found) {
        if (result.general_contractor && !generalContractor) accepted.general_contractor = true;
        if (result.sqft && !totalSqft) accepted.sqft = true;
        if (result.building_type && !buildingType) accepted.building_type = true;
        if (result.project_type && !projectType) accepted.project_type = true;
        if (result.description && !notes) accepted.description = true;
      }
      setWebLookupAccepted(accepted);
      setWebLookupEdits({});
      setOwnerMatch(null);
      setArchitectMatch(null);
      if (result.found) {
        if (result.owner) {
          setOwnerMatch('loading');
          customersApi.search(result.owner).then(results => {
            setOwnerMatch(results.length > 0 ? { id: results[0].id, name: results[0].name } : 'not_found');
          }).catch(() => setOwnerMatch('not_found'));
        }
        if (result.architect) {
          setArchitectMatch('loading');
          customersApi.search(result.architect).then(results => {
            setArchitectMatch(results.length > 0 ? { id: results[0].id, name: results[0].name } : 'not_found');
          }).catch(() => setArchitectMatch('not_found'));
        }
      }
    },
  });

  // Derived data
  const sectionRows = useMemo(() => {
    const result: Record<string, EquipmentRow[]> = {};
    for (const secKey of SECTION_ORDER) {
      result[secKey] = equipmentRows.filter(r => r.section === secKey);
    }
    return result;
  }, [equipmentRows]);

  const customRows = useMemo(
    () => equipmentRows.filter(r => r.is_custom),
    [equipmentRows]
  );

  const totalEquipment = useMemo(
    () => equipmentRows.reduce((sum, r) => sum + r.count, 0),
    [equipmentRows]
  );

  // Handlers
  const updateRow = (equipmentType: string, updates: Partial<EquipmentRow>) => {
    setEquipmentRows(prev =>
      prev.map(r => r.equipment_type === equipmentType ? { ...r, ...updates } : r)
    );
    setHasChanges(true);
  };

  const updateSpec = (equipmentType: string, slot: number, value: string) => {
    setEquipmentRows(prev =>
      prev.map(r => r.equipment_type === equipmentType
        ? { ...r, specs: { ...r.specs, [`spec_${slot}`]: value } }
        : r
      )
    );
    setHasChanges(true);
  };

  const updateEquipmentCount = (equipmentType: string, count: number) => {
    updateRow(equipmentType, { count: Math.max(0, count), source: 'manual', ai_confidence: null });
  };

  const addCustomEquipment = () => {
    if (!customLabel.trim()) return;
    const typeKey = 'custom_' + customLabel.trim().toLowerCase().replace(/\s+/g, '_');
    if (equipmentRows.some(r => r.equipment_type === typeKey)) return;

    setEquipmentRows(prev => [
      ...prev,
      {
        equipment_type: typeKey,
        equipment_label: customLabel.trim(),
        count: Number(customCount) || 0,
        is_custom: true,
        notes: '',
        source: 'manual',
        ai_confidence: null,
        section: 'custom',
        activeSlots: [],
        specs: {},
        weight_lbs: '',
      },
    ]);
    setCustomLabel('');
    setCustomCount('0');
    setShowAddCustom(false);
    setHasChanges(true);
  };

  const removeCustomEquipment = async (equipmentType: string) => {
    const row = equipmentRows.find(r => r.equipment_type === equipmentType);
    if (row?.dbId) {
      await projectCostModelApi.deleteEquipment(Number(projectId), row.dbId);
      queryClient.invalidateQueries({ queryKey: ['cost-model', projectId] });
    }
    setEquipmentRows(prev => prev.filter(r => r.equipment_type !== equipmentType));
    setHasChanges(true);
  };

  const wlVal = (key: string, fallback: string | null | undefined) =>
    webLookupEdits[key] !== undefined ? webLookupEdits[key] : (fallback ?? '');

  const linkCustomerToProject = async (field: 'ownerCustomerId' | 'architectCustomerId', customerId: number) => {
    await projectsApi.update(Number(projectId), { [field]: customerId });
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
  };

  const handleAddProspect = async (name: string, field: 'ownerCustomerId' | 'architectCustomerId') => {
    const customer = await customersApi.quickCreate(name);
    await linkCustomerToProject(field, customer.id);
  };

  const applyWebLookupResults = () => {
    if (!webLookupResult) return;
    if (webLookupAccepted.sqft) {
      const v = wlVal('sqft', webLookupResult.sqft != null ? String(webLookupResult.sqft) : null);
      if (v) setTotalSqft(v.replace(/[^\d]/g, ''));
    }
    if (webLookupAccepted.building_type) {
      const v = wlVal('building_type', webLookupResult.building_type);
      if (v) {
        const match = BUILDING_TYPES.find(t => t.toLowerCase() === v.toLowerCase());
        setBuildingType(match || v);
      }
    }
    if (webLookupAccepted.project_type) {
      const v = wlVal('project_type', webLookupResult.project_type);
      if (v) {
        const match = PROJECT_TYPES.find(t => t.toLowerCase() === v.toLowerCase());
        setProjectType(match || v);
      }
    }
    if (webLookupAccepted.description) {
      const v = wlVal('description', webLookupResult.description);
      if (v) setNotes(v);
    }
    if (webLookupAccepted.general_contractor) {
      const v = wlVal('general_contractor', webLookupResult.general_contractor);
      if (v) setGeneralContractor(v);
    }
    setHasChanges(true);
    setShowWebLookupDialog(false);
    setWebLookupResult(null);
  };

  const toggleDrawingSelection = (drawingId: number) => {
    setSelectedDrawingIds(prev =>
      prev.includes(drawingId) ? prev.filter(id => id !== drawingId) : [...prev, drawingId]
    );
  };

  const applyScanResults = () => {
    if (!scanResult) return;

    const accepted = scanResult.equipment.filter(eq => scanAccepted[eq.type]);

    setEquipmentRows(prev => {
      const updated = [...prev];
      for (const aiEq of accepted) {
        const idx = updated.findIndex(r => r.equipment_type === aiEq.type);
        if (idx >= 0) {
          const newSpecs = { ...updated[idx].specs };
          if (aiEq.specs) {
            for (const [k, v] of Object.entries(aiEq.specs)) {
              if (v != null) newSpecs[k] = String(v);
            }
          }
          updated[idx] = {
            ...updated[idx],
            count: aiEq.count,
            source: 'ai_scan',
            ai_confidence: aiEq.confidence,
            specs: newSpecs,
            ...(aiEq.weight_lbs != null ? { weight_lbs: String(aiEq.weight_lbs) } : {}),
          };
        } else if (aiEq.is_custom) {
          const specs: Record<string, string> = {};
          if (aiEq.specs) {
            for (const [k, v] of Object.entries(aiEq.specs)) {
              if (v != null) specs[k] = String(v);
            }
          }
          updated.push({
            equipment_type: aiEq.type,
            equipment_label: aiEq.label,
            count: aiEq.count,
            is_custom: true,
            notes: aiEq.evidence || '',
            source: 'ai_scan',
            ai_confidence: aiEq.confidence,
            section: 'custom',
            activeSlots: [],
            specs,
            weight_lbs: aiEq.weight_lbs != null ? String(aiEq.weight_lbs) : '',
          });
        }
      }
      return updated;
    });

    setScanResult(null);
    setShowScanDialog(false);
    setSelectedDrawingIds([]);
    setHasChanges(true);
  };

  if (isLoading) return <div style={{ padding: '2rem' }}>Loading cost model...</div>;

  const pdfDrawings = (drawingsData || []).filter(d => d.file_type === 'application/pdf');
  const sectionColumns = costModelData?.standardTypes?.columns || {};

  return (
    <div style={{ padding: '0 1.5rem 2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to={`/projects/${projectId}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: '0.875rem' }}>
          &larr; Back to Project
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>
            Cost Model {project?.name ? `\u2014 ${project.name}` : ''}
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => { setShowWebLookupDialog(true); setWebLookupResult(null); webLookupMutation.reset(); }}
              disabled={webLookupMutation.isPending}
            >
              {webLookupMutation.isPending ? 'Searching...' : 'Search Web'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowScanDialog(true)}>
              Scan Drawings with AI
            </button>
            <button
              className="btn btn-primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasChanges}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        {saveMutation.isSuccess && !hasChanges && (
          <div style={{ color: '#16a34a', fontSize: '0.875rem', marginTop: '0.5rem' }}>Changes saved successfully.</div>
        )}
        {saveMutation.isError && (
          <div style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>Error saving changes. Please try again.</div>
        )}
      </div>

      {/* Summary bar */}
      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Equipment</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{totalEquipment}</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Square Footage</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{totalSqft ? Number(totalSqft).toLocaleString() : '\u2014'}</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Building Type</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{buildingType || '\u2014'}</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project Type</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{projectType || '\u2014'}</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bid Type</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{bidType || '\u2014'}</div>
        </div>
      </div>

      {/* Metadata Card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Project Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Total Square Footage</label>
            <input type="text" inputMode="numeric" className="form-input"
              value={totalSqft ? Number(totalSqft).toLocaleString('en-US') : ''}
              onChange={(e) => { setTotalSqft(e.target.value.replace(/[^\d]/g, '')); setHasChanges(true); }}
              placeholder="e.g., 150,000" />
          </div>
          {(() => {
            const vistaMarket = project?.market || '';
            const isOverride = !!market && !!vistaMarket && market !== vistaMarket;
            return (
              <div className="form-group">
                <label className="form-label">Market</label>
                <select
                  className="form-input"
                  value={market}
                  onChange={(e) => { setMarket(e.target.value); setHasChanges(true); }}
                  style={isOverride ? { background: '#fffbeb', borderColor: '#f59e0b' } : undefined}
                >
                  <option value="">{vistaMarket ? `From project: ${vistaMarket}` : 'Select...'}</option>
                  {(vistaFilterOpts?.markets || []).map((m: string) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {isOverride && (
                  <div style={{ fontSize: '0.7rem', color: '#92400e', marginTop: '0.2rem' }}>
                    Vista: {vistaMarket}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="form-group">
            <label className="form-label">Building Type</label>
            <select className="form-input" value={buildingType}
              onChange={(e) => { setBuildingType(e.target.value); setHasChanges(true); }}>
              <option value="">Select...</option>
              {BUILDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Project Type</label>
            <select className="form-input" value={projectType}
              onChange={(e) => { setProjectType(e.target.value); setHasChanges(true); }}>
              <option value="">Select...</option>
              {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Bid Type</label>
            <select className="form-input" value={bidType}
              onChange={(e) => { setBidType(e.target.value); setHasChanges(true); }}>
              <option value="">Select...</option>
              {BID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Owner</label>
            <div className="form-input" style={{ background: '#f9fafb', color: project?.owner_name ? '#111827' : '#9ca3af', cursor: 'default' }}>
              {project?.owner_name || 'Set in Project Details'}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Architect</label>
            <div className="form-input" style={{ background: '#f9fafb', color: project?.architect_name ? '#111827' : '#9ca3af', cursor: 'default' }}>
              {project?.architect_name || 'Set in Project Details'}
            </div>
          </div>
          {(() => {
            const vistaGC = project?.customer_name || '';
            const isGCOverride = !!generalContractor && !!vistaGC && generalContractor !== vistaGC;
            return (
              <div className="form-group">
                <label className="form-label">General Contractor</label>
                <input type="text" className="form-input" value={generalContractor}
                  onChange={(e) => { setGeneralContractor(e.target.value); setHasChanges(true); }}
                  placeholder={vistaGC || 'General contractor'}
                  style={isGCOverride ? { background: '#fffbeb', borderColor: '#f59e0b' } : undefined}
                />
                {isGCOverride && (
                  <div style={{ fontSize: '0.7rem', color: '#92400e', marginTop: '0.2rem' }}>
                    Vista: {vistaGC}
                  </div>
                )}
                {!generalContractor && vistaGC && (
                  <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.2rem' }}>
                    From project: {vistaGC}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Scope of Work</label>
            <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '0.35rem', flexWrap: 'wrap' }}>
              {SCOPE_OPTIONS.map(scope => (
                <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 400 }}>
                  <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                  {scope}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notes</label>
            <textarea className="form-input" value={notes} rows={3}
              onChange={(e) => { setNotes(e.target.value); setHasChanges(true); }}
              placeholder="Additional notes..."
              style={{ resize: 'vertical', minHeight: '72px' }} />
          </div>
        </div>
      </div>

      {/* Equipment Sections */}
      {SECTION_ORDER.map(secKey => {
        const ui = SECTION_UI[secKey];
        const cols = (sectionColumns[secKey] || []) as SectionColumn[];
        return (
          <EquipmentSection
            key={secKey}
            title={ui.label}
            color={ui.color}
            bg={ui.bg}
            columns={cols}
            rows={sectionRows[secKey] || []}
            onCountChange={updateEquipmentCount}
            onSpecChange={updateSpec}
            onUpdate={updateRow}
          />
        );
      })}

      {/* Custom Equipment */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Custom Equipment</h3>
          <button className="btn btn-secondary" onClick={() => setShowAddCustom(!showAddCustom)} style={{ fontSize: '0.85rem' }}>
            {showAddCustom ? 'Cancel' : '+ Add Custom Type'}
          </button>
        </div>

        {showAddCustom && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
              <label className="form-label">Equipment Name</label>
              <input type="text" className="form-input" value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g., Mini Split Systems" />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Count</label>
              <input type="number" className="form-input" value={customCount}
                onChange={(e) => setCustomCount(e.target.value)} min={0} />
            </div>
            <button className="btn btn-primary" onClick={addCustomEquipment} style={{ height: '38px' }}>Add</button>
          </div>
        )}

        {customRows.length === 0 && !showAddCustom ? (
          <p style={{ color: '#9ca3af', margin: 0, fontStyle: 'italic' }}>No custom equipment types added.</p>
        ) : customRows.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <TH>Equipment</TH>
                <TH w="80px" center>Count</TH>
                <TH>Notes</TH>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {customRows.map(row => (
                <tr key={row.equipment_type} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.4rem', fontWeight: 500, fontSize: '0.85rem' }}>{row.equipment_label}</td>
                  <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                    <NumInput value={row.count} onChange={v => updateEquipmentCount(row.equipment_type, v)} w="65px" />
                  </td>
                  <td style={{ padding: '0.4rem' }}>
                    <input type="text" value={row.notes}
                      onChange={(e) => updateRow(row.equipment_type, { notes: e.target.value })}
                      placeholder="Notes..."
                      style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.8rem' }} />
                  </td>
                  <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                    <button onClick={() => removeCustomEquipment(row.equipment_type)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.9rem' }} title="Remove">X</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Web Lookup Dialog */}
      {showWebLookupDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '1.5rem', width: '560px',
            maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {!webLookupResult ? (
              <>
                <h3 style={{ marginTop: 0 }}>Search Web for Project Details</h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Titan will search the internet for <strong>{project?.name}</strong> and try to find its square footage, building type, and other details.
                </p>
                {webLookupMutation.isPending && (
                  <div style={{ padding: '1.5rem', background: '#f0f9ff', borderRadius: '8px', textAlign: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
                    <div style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: 500 }}>Searching the web...</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>This may take 15–30 seconds.</div>
                  </div>
                )}
                {webLookupMutation.isError && (
                  <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Search failed. Please try again.
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => { setShowWebLookupDialog(false); webLookupMutation.reset(); }}>Cancel</button>
                  <button className="btn btn-primary" disabled={webLookupMutation.isPending} onClick={() => webLookupMutation.mutate()}>
                    {webLookupMutation.isPending ? 'Searching...' : 'Search Now'}
                  </button>
                </div>
              </>
            ) : !webLookupResult.found ? (
              <>
                <h3 style={{ marginTop: 0 }}>No Results Found</h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>{webLookupResult.reason || 'Could not find this project online.'}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => { setShowWebLookupDialog(false); setWebLookupResult(null); }}>Close</button>
                  <button className="btn btn-primary" onClick={() => { setWebLookupResult(null); webLookupMutation.mutate(); }}>Try Again</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>Project Found</h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Select the fields you want to apply to this cost model.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  {webLookupResult.sqft && (
                    <WebLookupField
                      label="Square Footage"
                      value={webLookupResult.sqft.toLocaleString() + ' SF'}
                      editedValue={webLookupEdits.sqft}
                      current={totalSqft ? Number(totalSqft).toLocaleString() + ' SF' : null}
                      accepted={!!webLookupAccepted.sqft}
                      onToggle={() => setWebLookupAccepted(prev => ({ ...prev, sqft: !prev.sqft }))}
                      onValueChange={v => setWebLookupEdits(prev => ({ ...prev, sqft: v }))}
                    />
                  )}
                  {webLookupResult.building_type && (
                    <WebLookupField
                      label="Building Type"
                      value={webLookupResult.building_type}
                      editedValue={webLookupEdits.building_type}
                      current={buildingType || null}
                      accepted={!!webLookupAccepted.building_type}
                      onToggle={() => setWebLookupAccepted(prev => ({ ...prev, building_type: !prev.building_type }))}
                      onValueChange={v => setWebLookupEdits(prev => ({ ...prev, building_type: v }))}
                    />
                  )}
                  {webLookupResult.project_type && (
                    <WebLookupField
                      label="Project Scope"
                      value={webLookupResult.project_type}
                      editedValue={webLookupEdits.project_type}
                      current={projectType || null}
                      accepted={!!webLookupAccepted.project_type}
                      onToggle={() => setWebLookupAccepted(prev => ({ ...prev, project_type: !prev.project_type }))}
                      onValueChange={v => setWebLookupEdits(prev => ({ ...prev, project_type: v }))}
                    />
                  )}
                  {webLookupResult.description && (
                    <WebLookupField
                      label="Notes / Description"
                      value={webLookupResult.description}
                      editedValue={webLookupEdits.description}
                      current={notes || null}
                      accepted={!!webLookupAccepted.description}
                      onToggle={() => setWebLookupAccepted(prev => ({ ...prev, description: !prev.description }))}
                      onValueChange={v => setWebLookupEdits(prev => ({ ...prev, description: v }))}
                    />
                  )}
                  {webLookupResult.general_contractor && (
                    <WebLookupField
                      label="General Contractor"
                      value={webLookupResult.general_contractor}
                      editedValue={webLookupEdits.general_contractor}
                      current={generalContractor || null}
                      accepted={!!webLookupAccepted.general_contractor}
                      onToggle={() => setWebLookupAccepted(prev => ({ ...prev, general_contractor: !prev.general_contractor }))}
                      onValueChange={v => setWebLookupEdits(prev => ({ ...prev, general_contractor: v }))}
                    />
                  )}
                </div>

                {/* Owner / Architect customer linking */}
                {(webLookupResult.owner || webLookupResult.architect) && (
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#475569' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>Link to Titan Customers</div>
                    {webLookupResult.owner && (() => {
                      const alreadyLinked = !!project?.owner_name;
                      return (
                        <div style={{ marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 600 }}>Owner: </span>{webLookupResult.owner}
                          {alreadyLinked ? (
                            <span style={{ color: '#16a34a', marginLeft: '0.5rem' }}>✓ Linked: {project?.owner_name}</span>
                          ) : ownerMatch === 'loading' ? (
                            <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>Searching...</span>
                          ) : ownerMatch === 'not_found' ? (
                            <button className="btn btn-secondary" style={{ marginLeft: '0.5rem', padding: '0.1rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleAddProspect(webLookupResult.owner!, 'ownerCustomerId')}>
                              + Add as Prospect
                            </button>
                          ) : ownerMatch ? (
                            <span>
                              <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>Match: {ownerMatch.name}</span>
                              <button className="btn btn-primary" style={{ marginLeft: '0.5rem', padding: '0.1rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => linkCustomerToProject('ownerCustomerId', (ownerMatch as any).id)}>
                                Link
                              </button>
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}
                    {webLookupResult.architect && (() => {
                      const alreadyLinked = !!project?.architect_name;
                      return (
                        <div>
                          <span style={{ fontWeight: 600 }}>Architect: </span>{webLookupResult.architect}
                          {alreadyLinked ? (
                            <span style={{ color: '#16a34a', marginLeft: '0.5rem' }}>✓ Linked: {project?.architect_name}</span>
                          ) : architectMatch === 'loading' ? (
                            <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>Searching...</span>
                          ) : architectMatch === 'not_found' ? (
                            <button className="btn btn-secondary" style={{ marginLeft: '0.5rem', padding: '0.1rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleAddProspect(webLookupResult.architect!, 'architectCustomerId')}>
                              + Add as Prospect
                            </button>
                          ) : architectMatch ? (
                            <span>
                              <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>Match: {architectMatch.name}</span>
                              <button className="btn btn-primary" style={{ marginLeft: '0.5rem', padding: '0.1rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => linkCustomerToProject('architectCustomerId', (architectMatch as any).id)}>
                                Link
                              </button>
                            </span>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Info-only fields (location + year) */}
                {(webLookupResult.location || webLookupResult.year) && (
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#475569' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>Additional Info</div>
                    {webLookupResult.location && <div><strong>Location:</strong> {webLookupResult.location}</div>}
                    {webLookupResult.year && <div><strong>Year:</strong> {webLookupResult.year}</div>}
                  </div>
                )}

                {webLookupResult.sources && webLookupResult.sources.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem' }}>
                    Source{webLookupResult.sources.length > 1 ? 's' : ''}: {webLookupResult.sources.slice(0, 2).map((s, i) => (
                      <a key={i} href={s} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', marginRight: '0.5rem', wordBreak: 'break-all' }}>{s}</a>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => { setShowWebLookupDialog(false); setWebLookupResult(null); }}>Discard</button>
                  <button
                    className="btn btn-primary"
                    disabled={!Object.values(webLookupAccepted).some(v => v)}
                    onClick={applyWebLookupResults}
                  >
                    Apply Selected ({Object.values(webLookupAccepted).filter(v => v).length})
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* AI Scan Drawing Dialog */}
      {showScanDialog && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '1.5rem', width: '900px',
            maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {!scanResult ? (
              <>
                <h3 style={{ marginTop: 0 }}>Scan Drawings with AI</h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  Select PDF drawings to scan for equipment schedules. The AI will analyze the text and identify equipment counts and specs.
                </p>

                {pdfDrawings.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                    No PDF drawings found for this project. Upload drawings in the Drawings tab first.
                  </p>
                ) : (
                  <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '1rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb', position: 'sticky', top: 0, background: 'white' }}>
                          <th style={{ padding: '0.5rem', width: '40px' }}></th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>Drawing #</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>Title</th>
                          <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>Discipline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdfDrawings.map(d => (
                          <tr key={d.id} onClick={() => toggleDrawingSelection(d.id)}
                            style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: selectedDrawingIds.includes(d.id) ? '#eff6ff' : undefined }}>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <input type="checkbox" checked={selectedDrawingIds.includes(d.id)} onChange={() => toggleDrawingSelection(d.id)} />
                            </td>
                            <td style={{ padding: '0.5rem', fontWeight: 500 }}>{d.drawing_number}</td>
                            <td style={{ padding: '0.5rem' }}>{d.title}</td>
                            <td style={{ padding: '0.5rem' }}>{d.discipline || '\u2014'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => { setShowScanDialog(false); setSelectedDrawingIds([]); }}>Cancel</button>
                  <button className="btn btn-primary" disabled={selectedDrawingIds.length === 0 || scanMutation.isPending}
                    onClick={() => scanMutation.mutate()}>
                    {scanMutation.isPending ? 'Scanning...' : `Scan ${selectedDrawingIds.length} Drawing${selectedDrawingIds.length !== 1 ? 's' : ''}`}
                  </button>
                </div>

                {scanMutation.isPending && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>AI is analyzing the drawings for equipment schedules...</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>This may take a moment depending on the number and size of drawings.</div>
                  </div>
                )}

                {scanMutation.isError && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '0.875rem' }}>
                    Error scanning drawings. Please try again.
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>AI Scan Results</h3>

                <div style={{ marginBottom: '1rem' }}>
                  {scanResult.scannedDrawings.map(d => (
                    <span key={d.drawingId} style={{
                      display: 'inline-block', padding: '0.25rem 0.5rem', marginRight: '0.5rem', marginBottom: '0.25rem',
                      fontSize: '0.75rem', borderRadius: '4px',
                      background: d.success ? '#dcfce7' : '#fef2f2', color: d.success ? '#166534' : '#dc2626',
                    }}>
                      {d.drawingNumber}: {d.success ? 'Scanned' : d.error || 'Failed'}
                    </span>
                  ))}
                </div>

                {scanResult.notes && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.875rem', color: '#475569' }}>
                    {scanResult.notes}
                  </div>
                )}

                {scanResult.equipment.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No equipment detected in the selected drawings.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '0.5rem', width: '40px' }}></th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>Equipment</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', width: '70px' }}>Count</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', width: '80px' }}>Confidence</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResult.equipment.map(eq => (
                        <tr key={eq.type} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <input type="checkbox" checked={!!scanAccepted[eq.type]}
                              onChange={() => setScanAccepted(prev => ({ ...prev, [eq.type]: !prev[eq.type] }))} />
                          </td>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>
                            {eq.label}
                            {eq.is_custom && (
                              <span style={{ fontSize: '0.7rem', color: '#8b5cf6', marginLeft: '0.5rem', background: '#f5f3ff', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>Custom</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, color: '#2563eb' }}>{eq.count}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <ConfidenceBadge confidence={eq.confidence} />
                          </td>
                          <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>{eq.evidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => { setScanResult(null); setShowScanDialog(false); setSelectedDrawingIds([]); }}>Discard</button>
                  <button className="btn btn-primary" onClick={applyScanResults}
                    disabled={scanResult.equipment.length === 0 || !Object.values(scanAccepted).some(v => v)}>
                    Apply Selected ({Object.values(scanAccepted).filter(v => v).length})
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────

const thStyle = (opts?: { center?: boolean; w?: string }): React.CSSProperties => ({
  textAlign: opts?.center ? 'center' : 'left',
  padding: '0.4rem 0.5rem',
  fontSize: '0.75rem',
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  width: opts?.w,
  whiteSpace: 'nowrap',
});

const TH: React.FC<{ children: React.ReactNode; center?: boolean; w?: string }> = ({ children, center, w }) => (
  <th style={thStyle({ center, w })}>{children}</th>
);

const inputStyle = (w: string): React.CSSProperties => ({
  width: w, textAlign: 'center', padding: '0.2rem 0.25rem',
  border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.8rem',
});

const NumInput: React.FC<{ value: number; onChange: (v: number) => void; w?: string }> = ({ value, onChange, w = '65px' }) => (
  <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} min={0} style={inputStyle(w)} />
);

const SpecInput: React.FC<{ value: string; unit: string; onChange: (v: string) => void; disabled?: boolean }> = ({ value, unit, onChange, disabled }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
    {disabled ? (
      <span style={{ color: '#d1d5db', fontSize: '0.8rem' }}>&mdash;</span>
    ) : (
      <>
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          placeholder="" style={{ ...inputStyle('60px'), textAlign: 'right' }} />
        {unit && <span style={{ fontSize: '0.65rem', color: '#9ca3af', minWidth: '24px', textAlign: 'left' }}>{unit}</span>}
      </>
    )}
  </div>
);

interface EquipmentSectionProps {
  title: string;
  color: string;
  bg: string;
  columns: SectionColumn[];
  rows: EquipmentRow[];
  onCountChange: (type: string, count: number) => void;
  onSpecChange: (type: string, slot: number, value: string) => void;
  onUpdate: (type: string, updates: Partial<EquipmentRow>) => void;
}

const EquipmentSection: React.FC<EquipmentSectionProps> = ({ title, color, bg, columns, rows, onCountChange, onSpecChange, onUpdate }) => {
  const [collapsed, setCollapsed] = useState(false);
  const activeCount = rows.filter(r => r.count > 0).length;
  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div style={{ marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Colored schedule header */}
      <div onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.6rem 1rem', cursor: 'pointer', background: color, color: 'white',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        </div>
        <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
          {activeCount} type{activeCount !== 1 ? 's' : ''} &middot; {totalCount} total
        </span>
      </div>

      {!collapsed && (
        <div style={{ overflowX: 'auto', background: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: bg }}>
                <TH>Equipment</TH>
                <TH w="70px" center>Count</TH>
                {columns.map(col => (
                  <TH key={col.slot} w="100px" center>{col.label}</TH>
                ))}
                <TH w="80px" center>Weight</TH>
                <TH>Notes</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const hasData = row.count > 0 || Object.values(row.specs).some(v => v !== '');
                return (
                  <tr key={row.equipment_type} style={{ borderBottom: '1px solid #f3f4f6', background: hasData ? bg : undefined }}>
                    <td style={{ padding: '0.4rem 0.5rem 0.4rem 1rem', fontWeight: hasData ? 500 : 400, color: hasData ? '#111827' : '#9ca3af', fontSize: '0.85rem' }}>
                      {row.equipment_label}
                    </td>
                    <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                      <NumInput value={row.count} onChange={v => onCountChange(row.equipment_type, v)} />
                    </td>
                    {columns.map((col, colIdx) => {
                      // Check if this equipment type uses this column slot
                      const slotActive = row.activeSlots[colIdx] != null;
                      return (
                        <td key={col.slot} style={{ padding: '0.4rem', textAlign: 'center' }}>
                          <SpecInput
                            value={row.specs[`spec_${col.slot}`] || ''}
                            unit={col.unit}
                            disabled={!slotActive}
                            onChange={v => onSpecChange(row.equipment_type, col.slot, v)}
                          />
                        </td>
                      );
                    })}
                    <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                      <SpecInput value={row.weight_lbs} unit="lbs" onChange={v => onUpdate(row.equipment_type, { weight_lbs: v })} />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input type="text" value={row.notes}
                        onChange={(e) => onUpdate(row.equipment_type, { notes: e.target.value })}
                        placeholder="Notes..."
                        style={{ width: '100%', padding: '0.2rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.8rem' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const WebLookupField: React.FC<{
  label: string;
  value: string;
  editedValue?: string;
  current: string | null;
  accepted: boolean;
  onToggle: () => void;
  onValueChange?: (v: string) => void;
}> = ({ label, value, editedValue, current, accepted, onToggle, onValueChange }) => {
  const displayValue = editedValue !== undefined ? editedValue : value;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem',
        borderRadius: '8px', border: '1px solid',
        borderColor: accepted ? '#6366f1' : '#e5e7eb',
        background: accepted ? '#eef2ff' : '#fafafa',
      }}
    >
      <input type="checkbox" checked={accepted} onChange={onToggle} style={{ marginTop: '2px', flexShrink: 0, cursor: 'pointer' }} />
      <div style={{ flex: 1, minWidth: 0, cursor: !accepted ? 'pointer' : 'default' }} onClick={!accepted ? onToggle : undefined}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '4px', cursor: !accepted ? 'pointer' : 'default' }}>{label}</div>
        {accepted && onValueChange ? (
          <input
            type="text"
            value={displayValue}
            onChange={e => onValueChange(e.target.value)}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', fontWeight: 600, fontSize: '0.9rem', color: '#111827',
              border: '1px solid #a5b4fc', borderRadius: '4px', padding: '0.25rem 0.5rem',
              background: 'white', boxSizing: 'border-box',
            }}
          />
        ) : (
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', cursor: 'pointer' }} onClick={onToggle}>{displayValue}</div>
        )}
        {current && current !== value && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '4px' }}>Current: {current}</div>
        )}
      </div>
    </div>
  );
};

const ConfidenceBadge: React.FC<{ confidence: number }> = ({ confidence }) => {
  const pct = Math.round(confidence * 100);
  let bg = '#dcfce7';
  let color = '#166534';
  if (pct < 70) { bg = '#fef9c3'; color = '#854d0e'; }
  if (pct < 50) { bg = '#fef2f2'; color = '#dc2626'; }

  return (
    <span style={{
      display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '4px',
      fontSize: '0.75rem', fontWeight: 500, background: bg, color,
    }}>
      {pct}%
    </span>
  );
};

export default ProjectCostModel;
