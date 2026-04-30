import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectCostModelApi,
  EquipmentInput,
  AiScanResult,
  SectionColumn,
} from '../../services/projectCostModel';
import { projectsApi } from '../../services/projects';
import { drawingsApi } from '../../services/drawings';

// Section visual config
const SECTION_UI: Record<string, { label: string; color: string; bg: string }> = {
  major_equipment: { label: 'Major Equipment', color: '#1e40af', bg: '#eff6ff' },
  terminal_units: { label: 'Terminal & Zone Units', color: '#7c3aed', bg: '#f5f3ff' },
  ventilation: { label: 'Ventilation & Exhaust', color: '#059669', bg: '#ecfdf5' },
  piping: { label: 'Piping & Accessories', color: '#d97706', bg: '#fffbeb' },
};
const SECTION_ORDER = ['major_equipment', 'terminal_units', 'ventilation', 'piping'];

const BUILDING_TYPES = [
  'Hospital', 'Medical Office', 'Office', 'Data Center', 'Laboratory',
  'Manufacturing', 'Warehouse', 'K-12 School', 'University', 'Dormitory',
  'Hotel', 'Retail', 'Restaurant', 'Church', 'Government', 'Courthouse',
  'Prison', 'Military', 'Airport', 'Parking Garage', 'Mixed Use', 'Other',
];

const PROJECT_TYPES = [
  'New Construction', 'Renovation', 'Expansion', 'Tenant Improvement',
  'Design-Build', 'Design-Assist', 'Plan & Spec', 'Other',
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
  const [notes, setNotes] = useState<string>('');
  const [equipmentRows, setEquipmentRows] = useState<EquipmentRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Custom equipment form
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customCount, setCustomCount] = useState<string>('0');

  // AI scan state
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<number[]>([]);
  const [scanResult, setScanResult] = useState<AiScanResult | null>(null);
  const [scanAccepted, setScanAccepted] = useState<Record<string, boolean>>({});

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

  // Initialize form from loaded data
  useEffect(() => {
    if (!costModelData) return;

    const { meta, equipment, standardTypes } = costModelData;
    const { equipment: sections, columns } = standardTypes;

    if (meta) {
      setTotalSqft(meta.total_sqft ? String(meta.total_sqft) : '');
      setBuildingType(meta.building_type || '');
      setProjectType(meta.project_type || '');
      setNotes(meta.notes || '');
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
        notes: notes || null,
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
      </div>

      {/* Metadata Card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Project Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Total Square Footage</label>
            <input type="number" className="form-input" value={totalSqft}
              onChange={(e) => { setTotalSqft(e.target.value); setHasChanges(true); }} placeholder="e.g., 150000" />
          </div>
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
            <label className="form-label">Notes</label>
            <input type="text" className="form-input" value={notes}
              onChange={(e) => { setNotes(e.target.value); setHasChanges(true); }} placeholder="Additional notes..." />
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
