import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  pipingServicesApi,
  type PipingService,
  type ServiceSizeRule,
  SERVICE_CATEGORY_PRESETS,
} from '../../services/pipingServices';
import { pipeSpecsApi, type PipeSpec } from '../../services/pipeSpecs';

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

const categoryOptions = Object.entries(SERVICE_CATEGORY_PRESETS).map(([key, val]) => ({
  value: key,
  label: val.name,
}));

interface ServiceFormData {
  name: string;
  abbreviation: string;
  color: string;
  service_category: string;
  default_pipe_spec_id: number | null;
}

const emptyForm: ServiceFormData = {
  name: '',
  abbreviation: '',
  color: '#3b82f6',
  service_category: 'other',
  default_pipe_spec_id: null,
};

const PipingServicesManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceFormData>(emptyForm);

  // Size rule form
  const [newRuleMaxSize, setNewRuleMaxSize] = useState('');
  const [newRuleSpecId, setNewRuleSpecId] = useState<number | null>(null);

  // Fetch services
  const { data: services = [], isLoading } = useQuery({
    queryKey: ['pipingServices'],
    queryFn: () => pipingServicesApi.getAll().then((r) => r.data),
  });

  // Fetch pipe specs for dropdowns
  const { data: pipeSpecs = [] } = useQuery({
    queryKey: ['pipeSpecs'],
    queryFn: () => pipeSpecsApi.getAll().then((r) => r.data),
  });

  // Fetch expanded service with size rules
  const { data: expandedService } = useQuery({
    queryKey: ['pipingService', expandedId],
    queryFn: () => (expandedId ? pipingServicesApi.getById(expandedId).then((r) => r.data) : null),
    enabled: !!expandedId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PipingService>) => pipingServicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipingServices'] });
      setShowCreate(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PipingService> }) => pipingServicesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipingServices'] });
      queryClient.invalidateQueries({ queryKey: ['pipingService'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => pipingServicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipingServices'] });
      if (expandedId) setExpandedId(null);
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: ({ serviceId, rule }: { serviceId: number; rule: { max_size_inches: number; pipe_spec_id: number } }) =>
      pipingServicesApi.addSizeRule(serviceId, rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipingService', expandedId] });
      setNewRuleMaxSize('');
      setNewRuleSpecId(null);
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: ({ serviceId, ruleId }: { serviceId: number; ruleId: number }) =>
      pipingServicesApi.deleteSizeRule(serviceId, ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipingService', expandedId] });
    },
  });

  const handleCreate = () => {
    createMutation.mutate(form as any);
  };

  const handleUpdate = () => {
    if (editingId === null) return;
    updateMutation.mutate({ id: editingId, data: form as any });
  };

  const startEdit = (svc: PipingService) => {
    setEditingId(svc.id);
    setForm({
      name: svc.name,
      abbreviation: svc.abbreviation,
      color: svc.color,
      service_category: svc.service_category,
      default_pipe_spec_id: svc.default_pipe_spec_id,
    });
  };

  const applyPreset = (category: string) => {
    const preset = SERVICE_CATEGORY_PRESETS[category];
    if (preset) {
      setForm({
        ...form,
        service_category: category,
        name: form.name || preset.name,
        abbreviation: form.abbreviation || preset.abbreviation,
        color: preset.color,
      });
    } else {
      setForm({ ...form, service_category: category });
    }
  };

  const renderForm = (onSubmit: () => void, submitLabel: string) => (
    <div style={{ padding: 16, backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Service Category</label>
          <select
            style={selectInputStyle}
            value={form.service_category}
            onChange={(e) => applyPreset(e.target.value)}
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Name</label>
          <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Heating Water" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Abbreviation</label>
          <input style={inputStyle} value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} placeholder="e.g. HW" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Color</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={form.color}
              onChange={(e) => setForm({ ...form, color: e.target.value })}
              style={{ width: 36, height: 32, border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', padding: 0 }}
            />
            <span style={{ fontSize: 12, color: '#6b7280' }}>{form.color}</span>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Default Pipe Spec</label>
          <select
            style={selectInputStyle}
            value={form.default_pipe_spec_id ?? ''}
            onChange={(e) => setForm({ ...form, default_pipe_spec_id: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">None</option>
            {pipeSpecs.map((spec) => (
              <option key={spec.id} value={spec.id}>{spec.name}</option>
            ))}
          </select>
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

  const getSpecName = (specId: number) => {
    return pipeSpecs.find((s) => s.id === specId)?.name ?? `Spec #${specId}`;
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>Piping Services</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            Configure piping service types (HW, CHW, etc.) and their size-based spec rules.
          </p>
        </div>
        <button style={btnPrimary} onClick={() => { setShowCreate(true); setForm(emptyForm); }}>
          <AddIcon style={{ fontSize: 18 }} /> New Service
        </button>
      </div>

      {showCreate && renderForm(handleCreate, 'Create Service')}

      {isLoading ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading...</p>
      ) : services.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No piping services yet</p>
          <p style={{ fontSize: 13 }}>Create service types to define pipe spec rules by size.</p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={headerStyle}>Color</th>
                <th style={headerStyle}>Name</th>
                <th style={headerStyle}>Abbr</th>
                <th style={headerStyle}>Category</th>
                <th style={headerStyle}>Default Spec</th>
                <th style={headerStyle}>Size Rules</th>
                <th style={{ ...headerStyle, width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <React.Fragment key={svc.id}>
                  {editingId === svc.id ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        {renderForm(handleUpdate, 'Save Changes')}
                      </td>
                    </tr>
                  ) : (
                    <>
                      <tr
                        style={{ cursor: 'pointer', backgroundColor: expandedId === svc.id ? '#eff6ff' : undefined }}
                        onClick={() => setExpandedId(expandedId === svc.id ? null : svc.id)}
                      >
                        <td style={cellStyle}>
                          <div style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: svc.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                        </td>
                        <td style={{ ...cellStyle, fontWeight: 500 }}>{svc.name}</td>
                        <td style={cellStyle}>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, backgroundColor: `${svc.color}20`, color: svc.color }}>
                            {svc.abbreviation}
                          </span>
                        </td>
                        <td style={cellStyle}>{SERVICE_CATEGORY_PRESETS[svc.service_category]?.name ?? svc.service_category}</td>
                        <td style={cellStyle}>
                          {svc.default_pipe_spec_id ? getSpecName(svc.default_pipe_spec_id) : <span style={{ color: '#9ca3af' }}>None</span>}
                        </td>
                        <td style={cellStyle}>
                          {svc.size_rules?.length ?? 0} rules
                        </td>
                        <td style={cellStyle}>
                          <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              title="Edit"
                              onClick={() => startEdit(svc)}
                              style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
                            >
                              <EditIcon style={{ fontSize: 16 }} />
                            </button>
                            <button
                              title="Delete"
                              onClick={() => {
                                if (window.confirm(`Delete "${svc.name}"?`)) deleteMutation.mutate(svc.id);
                              }}
                              style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                            >
                              <DeleteIcon style={{ fontSize: 16 }} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedId === svc.id && expandedService && (
                        <tr>
                          <td colSpan={7} style={{ padding: '16px 24px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                              Size Rules
                              <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8 }}>
                                (pipes up to X inches use a specific spec)
                              </span>
                            </h4>

                            {expandedService.size_rules && expandedService.size_rules.length > 0 ? (
                              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                                <thead>
                                  <tr>
                                    <th style={{ ...headerStyle, fontSize: 11, padding: '6px 10px' }}>Max Size (inches)</th>
                                    <th style={{ ...headerStyle, fontSize: 11, padding: '6px 10px' }}>Pipe Spec</th>
                                    <th style={{ ...headerStyle, fontSize: 11, padding: '6px 10px', width: 60 }} />
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedService.size_rules.map((rule: ServiceSizeRule) => (
                                    <tr key={rule.id}>
                                      <td style={{ ...cellStyle, padding: '4px 10px', fontSize: 12 }}>
                                        &le; {rule.max_size_inches}"
                                      </td>
                                      <td style={{ ...cellStyle, padding: '4px 10px', fontSize: 12 }}>
                                        {rule.pipe_spec_name ?? getSpecName(rule.pipe_spec_id)}
                                      </td>
                                      <td style={{ ...cellStyle, padding: '4px 10px' }}>
                                        <button
                                          onClick={() => deleteRuleMutation.mutate({ serviceId: svc.id, ruleId: rule.id })}
                                          style={{ padding: 2, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                          title="Remove rule"
                                        >
                                          <DeleteIcon style={{ fontSize: 14 }} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginBottom: 12 }}>
                                No size rules — the default pipe spec will be used for all sizes.
                              </p>
                            )}

                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 2 }}>Max Size (inches)</label>
                                <input
                                  type="number"
                                  step="0.25"
                                  value={newRuleMaxSize}
                                  onChange={(e) => setNewRuleMaxSize(e.target.value)}
                                  placeholder="e.g. 2"
                                  style={{ ...inputStyle, width: 120 }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 2 }}>Pipe Spec</label>
                                <select
                                  style={{ ...selectInputStyle, width: 250 }}
                                  value={newRuleSpecId ?? ''}
                                  onChange={(e) => setNewRuleSpecId(e.target.value ? Number(e.target.value) : null)}
                                >
                                  <option value="">Select spec...</option>
                                  {pipeSpecs.map((spec) => (
                                    <option key={spec.id} value={spec.id}>{spec.name}</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12 }}
                                disabled={!newRuleMaxSize || !newRuleSpecId}
                                onClick={() => {
                                  if (newRuleSpecId && newRuleMaxSize) {
                                    addRuleMutation.mutate({
                                      serviceId: svc.id,
                                      rule: { max_size_inches: Number(newRuleMaxSize), pipe_spec_id: newRuleSpecId },
                                    });
                                  }
                                }}
                              >
                                <AddIcon style={{ fontSize: 14 }} /> Add Rule
                              </button>
                            </div>
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

export default PipingServicesManager;
