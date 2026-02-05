import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentsApi, Department, DepartmentInput } from '../../services/departments';
import { employeesApi } from '../../services/employees';
import '../../styles/SalesPipeline.css';

const DepartmentList: React.FC = () => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<DepartmentInput>({
    name: '',
    description: '',
    departmentNumber: '',
    managerId: undefined,
  });

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await departmentsApi.getAll();
      return response.data.data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response = await employeesApi.getAll({ employmentStatus: 'active' });
      return response.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: DepartmentInput) => departmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setIsAdding(false);
      setFormData({ name: '', description: '', departmentNumber: '', managerId: undefined });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: DepartmentInput }) => departmentsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setEditingId(null);
      setFormData({ name: '', description: '', departmentNumber: '', managerId: undefined });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => departmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to delete department';
      alert(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingId(dept.id);
    setFormData({
      name: dept.name,
      description: dept.description || '',
      departmentNumber: dept.department_number || '',
      managerId: dept.manager_id || undefined,
    });
    setIsAdding(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', description: '', managerId: undefined });
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="sales-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '64vh' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="sales-container">
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/hr" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px' }}>
              &larr; Back to HR Dashboard
            </Link>
            <h1>Departments</h1>
            <div className="sales-subtitle">View company departments</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <span style={{
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'rgba(99, 102, 241, 0.1)',
            borderRadius: '8px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Departments sync automatically from Vista
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="sales-kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="sales-kpi-card blue">
          <div className="sales-kpi-label">Total Departments</div>
          <div className="sales-kpi-value">{departments?.length || 0}</div>
        </div>
        <div className="sales-kpi-card green">
          <div className="sales-kpi-label">With Managers</div>
          <div className="sales-kpi-value">{departments?.filter(d => d.manager_id).length || 0}</div>
        </div>
        <div className="sales-kpi-card purple">
          <div className="sales-kpi-label">Total Employees</div>
          <div className="sales-kpi-value">{departments?.reduce((sum, d) => sum + (d.employee_count || 0), 0) || 0}</div>
        </div>
      </div>

      {/* Edit Form */}
      {editingId && (
        <div className="sales-chart-card" style={{ marginBottom: '20px' }}>
          <div className="sales-chart-header">
            <div className="sales-chart-title">Edit Department</div>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} required style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Department Number</label>
                <input type="text" placeholder="XX-XX" pattern="\d{2}-\d{2}" value={formData.departmentNumber} onChange={(e) => setFormData((prev) => ({ ...prev, departmentNumber: e.target.value }))} maxLength={5} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
                <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Format: XX-XX (e.g., 10-01)</small>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Description</label>
                <textarea rows={3} value={formData.description} onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Manager</label>
                <select value={formData.managerId || ''} onChange={(e) => setFormData((prev) => ({ ...prev, managerId: e.target.value ? Number(e.target.value) : undefined }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'white' }}>
                  <option value="">No manager assigned</option>
                  {employees?.map((employee) => (<option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}{employee.job_title && ` - ${employee.job_title}`}</option>))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <button type="button" className="sales-btn sales-btn-secondary" onClick={handleCancel}>Cancel</button>
              <button type="submit" className="sales-btn sales-btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}</button>
            </div>
            {(createMutation.isError || updateMutation.isError) && (<div style={{ color: 'var(--accent-rose)', marginTop: '16px', fontSize: '14px' }}>Error saving department. Please try again.</div>)}
          </form>
        </div>
      )}

      {/* Table */}
      <div className="sales-table-section">
        <div className="sales-table-header">
          <div className="sales-table-title">All Departments</div>
        </div>
        {departments?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🏢</div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No departments found</div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Department records sync automatically from Vista</p>
          </div>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department #</th>
                <th>Description</th>
                <th>Manager</th>
                <th>Employees</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments?.map((dept) => (
                <tr key={dept.id}>
                  <td>
                    <div className="sales-project-cell">
                      <div className="sales-project-icon" style={{ background: 'var(--gradient-1)', fontSize: '14px', color: 'white' }}>
                        {dept.name?.[0]}
                      </div>
                      <div className="sales-project-info">
                        <h4>{dept.name}</h4>
                      </div>
                    </div>
                  </td>
                  <td>{dept.department_number || '-'}</td>
                  <td>{dept.description || '-'}</td>
                  <td>{dept.manager_name || '-'}</td>
                  <td>
                    <span className="sales-stage-badge opportunity-received">{dept.employee_count || 0}</span>
                  </td>
                  <td>
                    <div className="sales-actions-cell">
                      <button className="sales-action-btn" onClick={() => handleEdit(dept)} title="Edit">✏️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default DepartmentList;
