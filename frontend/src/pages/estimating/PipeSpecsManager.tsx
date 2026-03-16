import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { pipeSpecsApi, type PipeSpec } from '../../services/pipeSpecs';

const JOINT_METHOD_LABELS: Record<string, string> = {
  BW: 'Butt Weld',
  GRV: 'Grooved',
  THD: 'Threaded',
  CU: 'Copper Solder',
};

const headerStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  borderBottom: '2px solid #e5e7eb',
  whiteSpace: 'nowrap',
};

const cellStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  borderBottom: '1px solid #f3f4f6',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
};

const selectInputStyle: React.CSSProperties = {
  ...inputStyle,
  backgroundColor: '#fff',
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  backgroundColor: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '6px 12px',
  backgroundColor: '#fff',
  color: '#374151',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};

interface SpecFormData {
  name: string;
  joint_method: string;
  material: string;
  schedule: string;
  stock_pipe_length: number;
  joint_type: string;
  pipe_material: string;
  is_default: boolean;
}

const emptyForm: SpecFormData = {
  name: '',
  joint_method: 'BW',
  material: 'carbon_steel',
  schedule: 'STD',
  stock_pipe_length: 21,
  joint_type: 'welded',
  pipe_material: 'carbon_steel',
  is_default: false,
};

const PipeSpecsManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SpecFormData>(emptyForm);
  const [duplicateName, setDuplicateName] = useState('');

  // Fetch all specs
  const { data: specs = [], isLoading } = useQuery({
    queryKey: ['pipeSpecs'],
    queryFn: () => pipeSpecsApi.getAll().then((r) => r.data),
  });

  // Fetch expanded spec with rates
  const { data: expandedSpec } = useQuery({
    queryKey: ['pipeSpec', expandedId],
    queryFn: () => (expandedId ? pipeSpecsApi.getById(expandedId).then((r) => r.data) : null),
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PipeSpec>) => pipeSpecsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeSpecs'] });
      setShowCreate(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PipeSpec> }) => pipeSpecsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeSpecs'] });
      queryClient.invalidateQueries({ queryKey: ['pipeSpec'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => pipeSpecsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeSpecs'] });
      if (expandedId) setExpandedId(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => pipeSpecsApi.duplicate(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeSpecs'] });
      setDuplicateName('');
    },
  });

  const handleCreate = () => {
    createMutation.mutate(form as any);
  };

  const handleUpdate = () => {
    if (editingId === null) return;
    updateMutation.mutate({ id: editingId, data: form as any });
  };

  const startEdit = (spec: PipeSpec) => {
    setEditingId(spec.id);
    setForm({
      name: spec.name,
      joint_method: spec.joint_method,
      material: spec.material,
      schedule: spec.schedule,
      stock_pipe_length: spec.stock_pipe_length,
      joint_type: spec.joint_type,
      pipe_material: spec.pipe_material,
      is_default: spec.is_default,
    });
  };

  const renderForm = (onSubmit: () => void, submitLabel: string) => (
    <div style={{ padding: 16, backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Name</label>
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. BW Carbon Steel Sch 40" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Joint Method</label>
          <select style={selectInputStyle} value={form.joint_method} onChange={(e) => setForm({ ...form, joint_method: e.target.value })}>
            <option value="BW">Butt Weld (BW)</option>
            <option value="GRV">Grooved (GRV)</option>
            <option value="THD">Threaded (THD)</option>
            <option value="CU">Copper Solder (CU)</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Material</label>
          <select style={selectInputStyle} value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })}>
            <option value="carbon_steel">Carbon Steel</option>
            <option value="stainless_steel">Stainless Steel</option>
            <option value="copper">Copper</option>
            <option value="pvc">PVC</option>
            <option value="cpvc">CPVC</option>
            <option value="cast_iron">Cast Iron</option>
            <option value="ductile_iron">Ductile Iron</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Schedule</label>
          <select style={selectInputStyle} value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })}>
            <option value="STD">Standard Weight</option>
            <option value="XH">Extra Heavy</option>
            <option value="SCH_10">Schedule 10</option>
            <option value="SCH_40">Schedule 40</option>
            <option value="SCH_80">Schedule 80</option>
            <option value="TYPE_K">Type K</option>
            <option value="TYPE_L">Type L</option>
            <option value="TYPE_M">Type M</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Stock Pipe Length (ft)</label>
          <input style={inputStyle} type="number" value={form.stock_pipe_length} onChange={(e) => setForm({ ...form, stock_pipe_length: Number(e.target.value) })} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Default Spec</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', marginTop: 6 }}>
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            Use as default
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnPrimary} onClick={onSubmit} disabled={!form.name.trim()}>
          {submitLabel}
        </button>
        <button style={btnSecondary} onClick={() => { setShowCreate(false); setEditingId(null); setForm(emptyForm); }}>
          Cancel
        </button>
      </div>
    </div>
  );

  const renderRateTable = (title: string, columns: string[], rows: any[], keyFn: (r: any) => string) => {
    if (!rows || rows.length === 0) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{title}</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col} style={{ ...headerStyle, fontSize: 11, padding: '6px 10px' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={keyFn(row)}>
                  {columns.map((col) => {
                    const key = col.toLowerCase().replace(/ /g, '_');
                    const val = row[key];
                    return (
                      <td key={col} style={{ ...cellStyle, padding: '4px 10px', fontSize: 12 }}>
                        {typeof val === 'number' ? val.toFixed(4) : val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Pipe Specs</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            Manage pipe specifications and productivity rates for traceover takeoffs.
          </p>
        </div>
        <button style={btnPrimary} onClick={() => { setShowCreate(true); setForm(emptyForm); }}>
          <AddIcon style={{ fontSize: 18 }} /> New Pipe Spec
        </button>
      </div>

      {showCreate && renderForm(handleCreate, 'Create Pipe Spec')}

      {isLoading ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading...</p>
      ) : specs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No pipe specs yet</p>
          <p style={{ fontSize: 13 }}>Create your first pipe spec to define productivity rates.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ ...headerStyle, width: 32 }} />
                <th style={headerStyle}>Name</th>
                <th style={headerStyle}>Joint Method</th>
                <th style={headerStyle}>Material</th>
                <th style={headerStyle}>Schedule</th>
                <th style={headerStyle}>Stock Length</th>
                <th style={{ ...headerStyle, width: 60 }}>Default</th>
                <th style={{ ...headerStyle, width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {specs.map((spec) => (
                <React.Fragment key={spec.id}>
                  {editingId === spec.id ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 0 }}>
                        {renderForm(handleUpdate, 'Save Changes')}
                      </td>
                    </tr>
                  ) : (
                    <>
                      <tr
                        style={{ cursor: 'pointer', backgroundColor: expandedId === spec.id ? '#eff6ff' : undefined }}
                        onClick={() => setExpandedId(expandedId === spec.id ? null : spec.id)}
                      >
                        <td style={cellStyle}>
                          {expandedId === spec.id ? (
                            <ExpandLessIcon style={{ fontSize: 18, color: '#6b7280' }} />
                          ) : (
                            <ExpandMoreIcon style={{ fontSize: 18, color: '#6b7280' }} />
                          )}
                        </td>
                        <td style={{ ...cellStyle, fontWeight: 500 }}>{spec.name}</td>
                        <td style={cellStyle}>{JOINT_METHOD_LABELS[spec.joint_method] || spec.joint_method}</td>
                        <td style={cellStyle}>{spec.material?.replace(/_/g, ' ')}</td>
                        <td style={cellStyle}>{spec.schedule?.replace(/_/g, ' ')}</td>
                        <td style={cellStyle}>{spec.stock_pipe_length} ft</td>
                        <td style={cellStyle}>
                          {spec.is_default && (
                            <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, backgroundColor: '#f0fdf4', color: '#166534' }}>Yes</span>
                          )}
                        </td>
                        <td style={cellStyle}>
                          <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              title="Edit"
                              onClick={() => startEdit(spec)}
                              style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
                            >
                              <EditIcon style={{ fontSize: 16 }} />
                            </button>
                            <button
                              title="Duplicate"
                              onClick={() => {
                                const name = prompt('Name for the duplicate:', `${spec.name} (Copy)`);
                                if (name) duplicateMutation.mutate({ id: spec.id, name });
                              }}
                              style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
                            >
                              <ContentCopyIcon style={{ fontSize: 16 }} />
                            </button>
                            <button
                              title="Delete"
                              onClick={() => {
                                if (window.confirm(`Delete "${spec.name}"?`)) deleteMutation.mutate(spec.id);
                              }}
                              style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                            >
                              <DeleteIcon style={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedId === spec.id && expandedSpec && (
                        <tr>
                          <td colSpan={8} style={{ padding: '12px 24px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            {renderRateTable(
                              'Pipe Rates (hours/foot)',
                              ['Pipe Size', 'Hours Per Foot'],
                              expandedSpec.pipe_rates ?? [],
                              (r) => r.pipe_size,
                            )}
                            {renderRateTable(
                              'Fitting Rates (hours/unit)',
                              ['Fitting Type', 'Pipe Size', 'Hours Per Unit'],
                              expandedSpec.fitting_rates ?? [],
                              (r) => `${r.fitting_type}-${r.pipe_size}`,
                            )}
                            {renderRateTable(
                              'Reducing Rates',
                              ['Fitting Type', 'Main Size', 'Reducing Size', 'Hours Per Unit'],
                              expandedSpec.reducing_rates ?? [],
                              (r) => `${r.fitting_type}-${r.main_size}-${r.reducing_size}`,
                            )}
                            {renderRateTable(
                              'Reducing Tee Rates',
                              ['Main Size', 'Branch Size', 'Hours Per Unit'],
                              expandedSpec.reducing_tee_rates ?? [],
                              (r) => `${r.main_size}-${r.branch_size}`,
                            )}
                            {renderRateTable(
                              'Cross Reducing Rates',
                              ['Main Size', 'Reducing Size', 'Hours Per Unit'],
                              expandedSpec.cross_reducing_rates ?? [],
                              (r) => `${r.main_size}-${r.reducing_size}`,
                            )}
                            {(!expandedSpec.pipe_rates || expandedSpec.pipe_rates.length === 0) &&
                             (!expandedSpec.fitting_rates || expandedSpec.fitting_rates.length === 0) && (
                              <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                                No rates configured for this pipe spec. Rates are populated from the seed migration.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PipeSpecsManager;
