import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  projectSystemsApi,
  pipingServicesApi,
  type ProjectSystem,
  type PipingService,
  SERVICE_CATEGORY_PRESETS,
} from '../../services/pipingServices';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

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

interface Props {
  takeoffId: number;
}

interface SystemFormData {
  name: string;
  abbreviation: string;
  color: string;
  piping_service_id: number | null;
}

const emptyForm: SystemFormData = {
  name: '',
  abbreviation: '',
  color: '#3b82f6',
  piping_service_id: null,
};

const ProjectSystemsPanel: React.FC<Props> = ({ takeoffId }) => {
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SystemFormData>(emptyForm);

  const { data: systems = [], isLoading } = useQuery({
    queryKey: ['projectSystems', takeoffId],
    queryFn: () => projectSystemsApi.getByTakeoff(takeoffId).then((r) => r.data),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['pipingServices'],
    queryFn: () => pipingServicesApi.getAll().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<ProjectSystem>) => projectSystemsApi.create(takeoffId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectSystems', takeoffId] });
      setShowCreate(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ systemId, data }: { systemId: number; data: Partial<ProjectSystem> }) =>
      projectSystemsApi.update(takeoffId, systemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectSystems', takeoffId] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (systemId: number) => projectSystemsApi.delete(takeoffId, systemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projectSystems', takeoffId] }),
  });

  const applyServicePreset = (serviceId: string) => {
    const sid = serviceId ? Number(serviceId) : null;
    setForm({ ...form, piping_service_id: sid });
    if (sid) {
      const svc = services.find((s) => s.id === sid);
      if (svc) {
        setForm({
          ...form,
          piping_service_id: sid,
          name: form.name || svc.name,
          abbreviation: form.abbreviation || svc.abbreviation,
          color: svc.color,
        });
      }
    }
  };

  const startEdit = (sys: ProjectSystem) => {
    setEditingId(sys.id);
    setForm({
      name: sys.name,
      abbreviation: sys.abbreviation,
      color: sys.color,
      piping_service_id: sys.piping_service_id,
    });
  };

  const getServiceName = (serviceId: number | null) => {
    if (!serviceId) return null;
    const svc = services.find((s) => s.id === serviceId);
    return svc ? svc.name : `Service #${serviceId}`;
  };

  const renderForm = (onSubmit: () => void, submitLabel: string) => (
    <div style={{ padding: 16, backgroundColor: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>
            Piping Service
          </label>
          <select
            style={selectInputStyle}
            value={form.piping_service_id ?? ''}
            onChange={(e) => applyServicePreset(e.target.value)}
          >
            <option value="">None</option>
            {services.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.abbreviation ? `${svc.abbreviation} — ${svc.name}` : svc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Name</label>
          <input
            style={inputStyle}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Heating Water Supply"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Abbreviation</label>
          <input
            style={inputStyle}
            value={form.abbreviation}
            onChange={(e) => setForm({ ...form, abbreviation: e.target.value })}
            placeholder="HWS"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Color</label>
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            style={{ width: '100%', height: 32, border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', padding: 0 }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnPrimary} onClick={onSubmit} disabled={!form.name.trim()}>
          {submitLabel}
        </button>
        <button
          style={btnSecondary}
          onClick={() => { setShowCreate(false); setEditingId(null); setForm(emptyForm); }}
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>Project Systems</h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            Systems are per-takeoff instances linked to piping services. They appear in the traceover workspace System dropdown.
          </p>
        </div>
        <button style={btnPrimary} onClick={() => { setShowCreate(true); setForm(emptyForm); }}>
          <AddIcon style={{ fontSize: 18 }} /> Add System
        </button>
      </div>

      {showCreate && renderForm(() => createMutation.mutate(form as any), 'Create System')}

      {isLoading ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading...</p>
      ) : systems.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '40px 20px', background: '#fff',
          borderRadius: 12, border: '1px solid #e5e7eb', color: '#9ca3af',
        }}>
          <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No systems configured</p>
          <p style={{ fontSize: 13 }}>
            Add systems to this takeoff so they appear in the traceover workspace config panel.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ ...headerStyle, width: 40 }}>Color</th>
                <th style={headerStyle}>Name</th>
                <th style={headerStyle}>Abbr</th>
                <th style={headerStyle}>Piping Service</th>
                <th style={headerStyle}>Category</th>
                <th style={{ ...headerStyle, width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {systems.map((sys) => {
                if (editingId === sys.id) {
                  return (
                    <tr key={sys.id}>
                      <td colSpan={6} style={{ padding: 0 }}>
                        {renderForm(
                          () => updateMutation.mutate({ systemId: sys.id, data: form as any }),
                          'Save',
                        )}
                      </td>
                    </tr>
                  );
                }
                const svcName = sys.service_name || getServiceName(sys.piping_service_id);
                const category = sys.service_category
                  ? SERVICE_CATEGORY_PRESETS[sys.service_category]?.name ?? sys.service_category
                  : null;
                return (
                  <tr key={sys.id}>
                    <td style={cellStyle}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: sys.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                    </td>
                    <td style={{ ...cellStyle, fontWeight: 500 }}>{sys.name}</td>
                    <td style={cellStyle}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                        backgroundColor: `${sys.color}20`, color: sys.color,
                      }}>
                        {sys.abbreviation}
                      </span>
                    </td>
                    <td style={cellStyle}>{svcName || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={cellStyle}>{category || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          title="Edit"
                          onClick={() => startEdit(sys)}
                          style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
                        >
                          <EditIcon style={{ fontSize: 16 }} />
                        </button>
                        <button
                          title="Delete"
                          onClick={async () => {
                            const ok = await confirm({ message: `Delete system "${sys.name}"?`, danger: true }); if (ok) deleteMutation.mutate(sys.id);
                          }}
                          style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                        >
                          <DeleteIcon style={{ fontSize: 16 }} />
                        </button>
                      </div>
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

export default ProjectSystemsPanel;
