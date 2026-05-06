import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { employeeResumesApi, EmployeeResume } from '../../services/employeeResumes';
import '../../styles/SalesPipeline.css';
import './EmployeeResumeList.css';

const EmployeeResumeList: React.FC = () => {
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

  if (isLoading) {
    return <div className="loading">Loading employee resumes...</div>;
  }

  const filtersActive = !!searchTerm || activeFilter !== 'all';

  return (
    <div className="container" style={{ maxWidth: 'min(100%, 1800px)', padding: '0 1.5rem' }}>
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>📄 Employee Resumes</h1>
            <div className="sales-subtitle">
              {resumes.length} resume{resumes.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="sales-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/employee-resumes/import')}>
            📥 Import from Word
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/employee-resumes/create')}>
            + New Resume
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search</label>
            <input
              className="form-input"
              type="text"
              placeholder="Type to search name or title…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select
              className="form-input"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
          {filtersActive && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => { setSearchTerm(''); setActiveFilter('all'); }}
                style={{ width: '100%' }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty state or table */}
      {resumes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#1f2937' }}>
            {filtersActive ? 'No matching resumes' : 'No employee resumes yet'}
          </h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            {filtersActive
              ? 'Try clearing or adjusting your filters'
              : 'Create a resume from scratch or import existing Word documents to get started.'}
          </p>
          {!filtersActive && (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => navigate('/employee-resumes/import')}>
                📥 Import from Word
              </button>
              <button className="btn btn-primary" onClick={() => navigate('/employee-resumes/create')}>
                + New Resume
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="sales-table" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Job Title</th>
                  <th>Experience</th>
                  <th style={{ textAlign: 'center' }}>Certifications</th>
                  <th style={{ textAlign: 'center' }}>Version</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {resumes.map((resume: EmployeeResume) => (
                  <tr
                    key={resume.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/employee-resumes/${resume.id}`)}
                  >
                    <td style={{ fontWeight: 600, color: '#1f2937' }}>{resume.employee_name}</td>
                    <td>{resume.job_title || '—'}</td>
                    <td>{resume.years_experience ? `${resume.years_experience} years` : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {resume.certifications && resume.certifications.length > 0
                        ? resume.certifications.length
                        : '—'}
                    </td>
                    <td style={{ textAlign: 'center', color: '#6b7280' }}>v{resume.version_number}</td>
                    <td>
                      <span className={`status-badge ${resume.is_active ? 'active' : 'inactive'}`}>
                        {resume.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeResumeList;
