import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectCostModelApi,
  CostModelData,
  EquipmentInput,
  AiScanResult,
  AiEquipmentResult,
  EquipmentTypeInfo,
} from '../../services/projectCostModel';
import { projectsApi } from '../../services/projects';
import { drawingsApi, Drawing } from '../../services/drawings';

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

interface EquipmentRow {
  equipment_type: string;
  equipment_label: string;
  count: number;
  is_custom: boolean;
  notes: string;
  source: 'manual' | 'ai_scan';
  ai_confidence: number | null;
  dbId?: number;
}

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

    if (meta) {
      setTotalSqft(meta.total_sqft ? String(meta.total_sqft) : '');
      setBuildingType(meta.building_type || '');
      setProjectType(meta.project_type || '');
      setNotes(meta.notes || '');
    }

    // Build rows: start with all standard types, overlay saved data
    const rows: EquipmentRow[] = [];
    const savedMap = new Map(equipment.map(e => [e.equipment_type, e]));

    // HVAC standard types
    for (const t of standardTypes.hvac) {
      const saved = savedMap.get(t.type);
      rows.push({
        equipment_type: t.type,
        equipment_label: t.label,
        count: saved?.count ?? 0,
        is_custom: false,
        notes: saved?.notes ?? '',
        source: (saved?.source as 'manual' | 'ai_scan') ?? 'manual',
        ai_confidence: saved?.ai_confidence ?? null,
        dbId: saved?.id,
      });
    }

    // Plumbing standard types
    for (const t of standardTypes.plumbing) {
      const saved = savedMap.get(t.type);
      rows.push({
        equipment_type: t.type,
        equipment_label: t.label,
        count: saved?.count ?? 0,
        is_custom: false,
        notes: saved?.notes ?? '',
        source: (saved?.source as 'manual' | 'ai_scan') ?? 'manual',
        ai_confidence: saved?.ai_confidence ?? null,
        dbId: saved?.id,
      });
    }

    // Custom types (saved but not in standard list)
    const standardKeys = new Set([
      ...standardTypes.hvac.map(t => t.type),
      ...standardTypes.plumbing.map(t => t.type),
    ]);
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

      // Only send rows with count > 0 or that have notes or were previously saved
      const items: EquipmentInput[] = equipmentRows
        .filter(r => r.count > 0 || r.notes || r.dbId)
        .map(r => ({
          equipment_type: r.equipment_type,
          equipment_label: r.equipment_label,
          count: r.count,
          is_custom: r.is_custom,
          notes: r.notes || null,
          source: r.source,
          ai_confidence: r.ai_confidence,
        }));

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
      // Default all to accepted
      const accepted: Record<string, boolean> = {};
      for (const eq of result.equipment) {
        accepted[eq.type] = true;
      }
      setScanAccepted(accepted);
    },
  });

  // Derived data
  const hvacTypes = useMemo(() => costModelData?.standardTypes?.hvac || [], [costModelData]);
  const plumbingTypes = useMemo(() => costModelData?.standardTypes?.plumbing || [], [costModelData]);

  const hvacRows = useMemo(
    () => equipmentRows.filter(r => !r.is_custom && hvacTypes.some(t => t.type === r.equipment_type)),
    [equipmentRows, hvacTypes]
  );
  const plumbingRows = useMemo(
    () => equipmentRows.filter(r => !r.is_custom && plumbingTypes.some(t => t.type === r.equipment_type)),
    [equipmentRows, plumbingTypes]
  );
  const customRows = useMemo(
    () => equipmentRows.filter(r => r.is_custom),
    [equipmentRows]
  );

  const totalEquipment = useMemo(
    () => equipmentRows.reduce((sum, r) => sum + r.count, 0),
    [equipmentRows]
  );

  // Handlers
  const updateEquipmentCount = (equipmentType: string, count: number) => {
    setEquipmentRows(prev =>
      prev.map(r =>
        r.equipment_type === equipmentType
          ? { ...r, count: Math.max(0, count), source: 'manual', ai_confidence: null }
          : r
      )
    );
    setHasChanges(true);
  };

  const updateEquipmentNotes = (equipmentType: string, notes: string) => {
    setEquipmentRows(prev =>
      prev.map(r => (r.equipment_type === equipmentType ? { ...r, notes } : r))
    );
    setHasChanges(true);
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
          updated[idx] = {
            ...updated[idx],
            count: aiEq.count,
            source: 'ai_scan',
            ai_confidence: aiEq.confidence,
          };
        } else if (aiEq.is_custom) {
          updated.push({
            equipment_type: aiEq.type,
            equipment_label: aiEq.label,
            count: aiEq.count,
            is_custom: true,
            notes: aiEq.evidence || '',
            source: 'ai_scan',
            ai_confidence: aiEq.confidence,
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

  return (
    <div style={{ padding: '0 1.5rem 2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to={`/projects/${projectId}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Back to Project
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>
            Cost Model {project?.name ? `— ${project.name}` : ''}
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowScanDialog(true)}
            >
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
          <div style={{ color: '#16a34a', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Changes saved successfully.
          </div>
        )}
        {saveMutation.isError && (
          <div style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Error saving changes. Please try again.
          </div>
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
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{totalSqft ? Number(totalSqft).toLocaleString() : '—'}</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Building Type</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{buildingType || '—'}</div>
        </div>
        <div>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project Type</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{projectType || '—'}</div>
        </div>
      </div>

      {/* Metadata Card */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Project Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Total Square Footage</label>
            <input
              type="number"
              className="form-input"
              value={totalSqft}
              onChange={(e) => { setTotalSqft(e.target.value); setHasChanges(true); }}
              placeholder="e.g., 150000"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Building Type</label>
            <select
              className="form-input"
              value={buildingType}
              onChange={(e) => { setBuildingType(e.target.value); setHasChanges(true); }}
            >
              <option value="">Select...</option>
              {BUILDING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Project Type</label>
            <select
              className="form-input"
              value={projectType}
              onChange={(e) => { setProjectType(e.target.value); setHasChanges(true); }}
            >
              <option value="">Select...</option>
              {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setHasChanges(true); }}
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </div>

      {/* HVAC Equipment */}
      <EquipmentSection
        title="HVAC Equipment"
        rows={hvacRows}
        onCountChange={updateEquipmentCount}
        onNotesChange={updateEquipmentNotes}
      />

      {/* Plumbing Equipment */}
      <EquipmentSection
        title="Plumbing Equipment"
        rows={plumbingRows}
        onCountChange={updateEquipmentCount}
        onNotesChange={updateEquipmentNotes}
      />

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
              <input
                type="text"
                className="form-input"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g., Mini Split Systems"
              />
            </div>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="form-label">Count</label>
              <input
                type="number"
                className="form-input"
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                min={0}
              />
            </div>
            <button className="btn btn-primary" onClick={addCustomEquipment} style={{ height: '38px' }}>
              Add
            </button>
          </div>
        )}

        {customRows.length === 0 && !showAddCustom ? (
          <p style={{ color: '#9ca3af', margin: 0, fontStyle: 'italic' }}>No custom equipment types added.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase' }}>Equipment</th>
                <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', width: '100px' }}>Count</th>
                <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', width: '100px' }}>Source</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase' }}>Notes</th>
                <th style={{ width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {customRows.map(row => (
                <tr key={row.equipment_type} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 500 }}>{row.equipment_label}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <input
                      type="number"
                      value={row.count}
                      onChange={(e) => updateEquipmentCount(row.equipment_type, Number(e.target.value))}
                      min={0}
                      style={{ width: '70px', textAlign: 'center', padding: '0.25rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <SourceBadge source={row.source} confidence={row.ai_confidence} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateEquipmentNotes(row.equipment_type, e.target.value)}
                      placeholder="Notes..."
                      style={{ width: '100%', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.85rem' }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <button
                      onClick={() => removeCustomEquipment(row.equipment_type)}
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1rem' }}
                      title="Remove"
                    >
                      X
                    </button>
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
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '1.5rem', width: '700px',
            maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            {!scanResult ? (
              <>
                <h3 style={{ marginTop: 0 }}>Scan Drawings with AI</h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  Select PDF drawings to scan for equipment schedules. The AI will analyze the text and identify equipment counts.
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
                          <tr
                            key={d.id}
                            onClick={() => toggleDrawingSelection(d.id)}
                            style={{
                              borderBottom: '1px solid #f3f4f6',
                              cursor: 'pointer',
                              background: selectedDrawingIds.includes(d.id) ? '#eff6ff' : undefined,
                            }}
                          >
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedDrawingIds.includes(d.id)}
                                onChange={() => toggleDrawingSelection(d.id)}
                              />
                            </td>
                            <td style={{ padding: '0.5rem', fontWeight: 500 }}>{d.drawing_number}</td>
                            <td style={{ padding: '0.5rem' }}>{d.title}</td>
                            <td style={{ padding: '0.5rem' }}>{d.discipline || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => { setShowScanDialog(false); setSelectedDrawingIds([]); }}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={selectedDrawingIds.length === 0 || scanMutation.isPending}
                    onClick={() => scanMutation.mutate()}
                  >
                    {scanMutation.isPending ? 'Scanning...' : `Scan ${selectedDrawingIds.length} Drawing${selectedDrawingIds.length !== 1 ? 's' : ''}`}
                  </button>
                </div>

                {scanMutation.isPending && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                      AI is analyzing the drawings for equipment schedules...
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                      This may take a moment depending on the number and size of drawings.
                    </div>
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

                {/* Scan status */}
                <div style={{ marginBottom: '1rem' }}>
                  {scanResult.scannedDrawings.map(d => (
                    <span key={d.drawingId} style={{
                      display: 'inline-block', padding: '0.25rem 0.5rem', marginRight: '0.5rem', marginBottom: '0.25rem',
                      fontSize: '0.75rem', borderRadius: '4px',
                      background: d.success ? '#dcfce7' : '#fef2f2',
                      color: d.success ? '#166534' : '#dc2626',
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
                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', width: '80px' }}>AI Count</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', width: '100px' }}>Current</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', width: '100px' }}>Confidence</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanResult.equipment.map(eq => {
                        const existing = equipmentRows.find(r => r.equipment_type === eq.type);
                        return (
                          <tr key={eq.type} style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={!!scanAccepted[eq.type]}
                                onChange={() => setScanAccepted(prev => ({ ...prev, [eq.type]: !prev[eq.type] }))}
                              />
                            </td>
                            <td style={{ padding: '0.5rem', fontWeight: 500 }}>
                              {eq.label}
                              {eq.is_custom && (
                                <span style={{ fontSize: '0.7rem', color: '#8b5cf6', marginLeft: '0.5rem', background: '#f5f3ff', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>
                                  Custom
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, color: '#2563eb' }}>{eq.count}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center', color: '#6b7280' }}>{existing?.count ?? '—'}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <ConfidenceBadge confidence={eq.confidence} />
                            </td>
                            <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>{eq.evidence}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button className="btn btn-secondary" onClick={() => { setScanResult(null); setShowScanDialog(false); setSelectedDrawingIds([]); }}>
                    Discard
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={applyScanResults}
                    disabled={scanResult.equipment.length === 0 || !Object.values(scanAccepted).some(v => v)}
                  >
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

interface EquipmentSectionProps {
  title: string;
  rows: EquipmentRow[];
  onCountChange: (type: string, count: number) => void;
  onNotesChange: (type: string, notes: string) => void;
}

const EquipmentSection: React.FC<EquipmentSectionProps> = ({ title, rows, onCountChange, onNotesChange }) => {
  const [collapsed, setCollapsed] = useState(false);
  const activeCount = rows.filter(r => r.count > 0).length;
  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsed ? 0 : '1rem' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <h3 style={{ margin: 0 }}>
          {collapsed ? '>' : 'v'} {title}
          <span style={{ fontWeight: 400, fontSize: '0.875rem', color: '#6b7280', marginLeft: '0.75rem' }}>
            {activeCount} types, {totalCount} total
          </span>
        </h3>
      </div>

      {!collapsed && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase' }}>Equipment</th>
              <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', width: '100px' }}>Count</th>
              <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', width: '100px' }}>Source</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                key={row.equipment_type}
                style={{
                  borderBottom: '1px solid #f3f4f6',
                  background: row.count > 0 ? '#f0fdf4' : undefined,
                }}
              >
                <td style={{ padding: '0.5rem', fontWeight: row.count > 0 ? 500 : 400, color: row.count > 0 ? '#111827' : '#9ca3af' }}>
                  {row.equipment_label}
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                  <input
                    type="number"
                    value={row.count}
                    onChange={(e) => onCountChange(row.equipment_type, Number(e.target.value))}
                    min={0}
                    style={{
                      width: '70px', textAlign: 'center', padding: '0.25rem',
                      border: '1px solid #d1d5db', borderRadius: '4px',
                      fontWeight: row.count > 0 ? 600 : 400,
                    }}
                  />
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                  {(row.source === 'ai_scan' || row.dbId) && row.count > 0 && (
                    <SourceBadge source={row.source} confidence={row.ai_confidence} />
                  )}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input
                    type="text"
                    value={row.notes}
                    onChange={(e) => onNotesChange(row.equipment_type, e.target.value)}
                    placeholder="Notes..."
                    style={{
                      width: '100%', padding: '0.25rem 0.5rem',
                      border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.85rem',
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const SourceBadge: React.FC<{ source: string; confidence: number | null }> = ({ source, confidence }) => {
  if (source === 'ai_scan') {
    return (
      <span style={{
        display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '4px',
        fontSize: '0.7rem', fontWeight: 500,
        background: '#dbeafe', color: '#1e40af',
      }}>
        AI {confidence != null ? `${Math.round(confidence * 100)}%` : ''}
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-block', padding: '0.125rem 0.5rem', borderRadius: '4px',
      fontSize: '0.7rem', fontWeight: 500,
      background: '#f3f4f6', color: '#6b7280',
    }}>
      Manual
    </span>
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
