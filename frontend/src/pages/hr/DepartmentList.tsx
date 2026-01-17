import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentsApi, Department, DepartmentInput } from '../../services/departments';
import { employeesApi } from '../../services/employees';

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
    return <div className="loading">Loading...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/hr">&larr; Back to HR Dashboard</Link>
      </div>

      <div className="section-header" style={{ marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Departments</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            setIsAdding(true);
            setEditingId(null);
            setFormData({ name: '', description: '', departmentNumber: '', managerId: undefined });
          }}
        >
          Add Department
        </button>
      </div>

      {(isAdding || editingId) && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit Department' : 'New Department'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Department Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="XX-XX"
                pattern="\d{2}-\d{2}"
                value={formData.departmentNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, departmentNumber: e.target.value }))}
                maxLength={5}
              />
              <small style={{ color: 'var(--secondary)', fontSize: '0.875rem' }}>
                Format: XX-XX (e.g., 10-01)
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Manager</label>
              <select
                className="form-input"
                value={formData.managerId || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, managerId: e.target.value ? Number(e.target.value) : undefined }))}
              >
                <option value="">No manager assigned</option>
                {employees?.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name}
                    {employee.job_title && ` - ${employee.job_title}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <div className="error-message" style={{ marginTop: '1rem' }}>
                Error saving department. Please try again.
              </div>
            )}
          </form>
        </div>
      )}

      <div className="card">
        <table className="table">
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
                <td style={{ fontWeight: 500 }}>{dept.name}</td>
                <td>{dept.department_number || '-'}</td>
                <td>{dept.description || '-'}</td>
                <td>{dept.manager_name || '-'}</td>
                <td>{dept.employee_count || 0}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleEdit(dept)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(dept.id, dept.name)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {departments?.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--secondary)' }}>
                  No departments found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DepartmentList;
