import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { employeeResumesApi, EmployeeResume } from '../../services/employeeResumes';
import '../../styles/SalesPipeline.css';
import './EmployeeResumeList.css';

const EmployeeResumeList: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Fetch employee resumes
  const { data: resumes = [], isLoading } = useQuery({
    queryKey: ['employeeResumes', activeFilter, searchTerm],
    queryFn: async () => {
      const filters: any = {};
      if (activeFilter !== 'all') {
        filters.is_active = activeFilter === 'active';
      }
      if (searchTerm) {
        filters.search = searchTerm;
      }
      const response = await employeeResumesApi.getAll(filters);
      return response.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => employeeResumesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeResumes'] });
    },
  });

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await employeeResumesApi.download(id);
      const resume = resumes.find((r: EmployeeResume) => r.id === id);
      if (resume && resume.resume_file_name) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', resume.resume_file_name);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    },
  });

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete the resume for "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleDownload = (id: number) => {
    downloadMutation.mutate(id);
  };

  if (isLoading) {
    return <div className="loading">Loading employee resumes...</div>;
  }

  return (
    <div className="employee-resume-list">
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/hr" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to HR
            </Link>
            <h1>📄 Employee Resumes</h1>
            <div className="sales-subtitle">Manage employee resume profiles</div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn" onClick={() => navigate('/employee-resumes/create')}>
            + New Resume
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          className="input search-input"
          placeholder="Search by name or title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="input"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Resume Table */}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Job Title</th>
              <th>Experience</th>
              <th>Certifications</th>
              <th>Resume File</th>
              <th>Version</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {resumes.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                  No employee resumes found. Create one to get started.
                </td>
              </tr>
            ) : (
              resumes.map((resume: EmployeeResume) => (
                <tr key={resume.id}>
                  <td>
                    <strong>{resume.employee_name}</strong>
                  </td>
                  <td>{resume.job_title}</td>
                  <td>
                    {resume.years_experience ? `${resume.years_experience} years` : '—'}
                  </td>
                  <td>
                    {resume.certifications && resume.certifications.length > 0
                      ? `${resume.certifications.length} cert${resume.certifications.length === 1 ? '' : 's'}`
                      : '—'}
                  </td>
                  <td>
                    {resume.resume_file_name ? (
                      <button
                        className="link-button"
                        onClick={() => handleDownload(resume.id)}
                        title="Download resume"
                      >
                        📄 {resume.resume_file_name}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>v{resume.version_number}</td>
                  <td>
                    <span className={`status-badge ${resume.is_active ? 'active' : 'inactive'}`}>
                      {resume.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => navigate(`/employee-resumes/${resume.id}`)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDelete(resume.id, resume.employee_name)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeResumeList;
