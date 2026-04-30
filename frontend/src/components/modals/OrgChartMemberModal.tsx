import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgChartsApi, OrgChartMember } from '../../services/orgCharts';
import './Modal.css';

interface OrgChartMemberModalProps {
  orgChartId: number;
  orgChartName: string;
  member?: OrgChartMember | null;
  onClose: () => void;
}

const OrgChartMemberModal: React.FC<OrgChartMemberModalProps> = ({ orgChartId, orgChartName, member, onClose }) => {
  const queryClient = useQueryClient();
  const isEditMode = !!member;

  const [formData, setFormData] = useState({
    first_name: member?.first_name || '',
    last_name: member?.last_name || '',
    title: member?.title || '',
    email: member?.email || '',
    phone: member?.phone || '',
    reports_to: member?.reports_to || null as number | null,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSearchTerm('');
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const { data: allMembers = [] } = useQuery({
    queryKey: ['org-chart-members', orgChartId],
    queryFn: () => orgChartsApi.getMembers(orgChartId),
  });

  const saveMember = useMutation({
    mutationFn: async (data: any) => {
      if (isEditMode && member) {
        return orgChartsApi.updateMember(orgChartId, member.id, data);
      } else {
        return orgChartsApi.createMember(orgChartId, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-chart', String(orgChartId)] });
      queryClient.invalidateQueries({ queryKey: ['org-chart-members', orgChartId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMember.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let processedValue: any = value;

    if (name === 'reports_to') {
      processedValue = value === '' ? null : parseInt(value, 10);
    } else if (value === '') {
      processedValue = null;
    }

    setFormData({ ...formData, [name]: processedValue });
  };

  const availableManagers = allMembers.filter((m: OrgChartMember) => m.id !== member?.id);

  const filteredManagers = availableManagers.filter((mgr: OrgChartMember) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${mgr.first_name} ${mgr.last_name}`.toLowerCase();
    const title = (mgr.title || '').toLowerCase();
    return fullName.includes(searchLower) || title.includes(searchLower);
  });

  const selectedManager = formData.reports_to
    ? availableManagers.find((m: OrgChartMember) => m.id === formData.reports_to)
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Member' : 'Add Member'}</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-subtitle">
          {isEditMode ? 'Editing member in' : 'Adding new member to'} <strong>{orgChartName}</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">First Name *</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Last Name *</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="title">Project Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Project Manager, Safety Director"
              />
            </div>

            {/* Reports To searchable dropdown */}
            <div className="form-group" style={{ position: 'relative' }} ref={dropdownRef}>
              <label htmlFor="reports_to">Reports To</label>
              <div
                style={{
                  position: 'relative',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  cursor: 'pointer',
                  background: 'white',
                  transition: 'all 0.2s'
                }}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                {selectedManager ? (
                  <div>
                    {selectedManager.first_name} {selectedManager.last_name}
                    {selectedManager.title && <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>({selectedManager.title})</span>}
                  </div>
                ) : (
                  <div style={{ color: '#9ca3af' }}>None (Top Level)</div>
                )}
              </div>

              {showDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '300px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      padding: '0.75rem',
                      border: 'none',
                      borderBottom: '1px solid #e5e7eb',
                      outline: 'none',
                      fontSize: '0.95rem'
                    }}
                    autoFocus
                  />
                  <div style={{ overflowY: 'auto', maxHeight: '240px' }}>
                    <div
                      style={{
                        padding: '0.75rem',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderBottom: '1px solid #f3f4f6',
                        background: !formData.reports_to ? '#f3f4f6' : 'transparent'
                      }}
                      onClick={() => {
                        setFormData({ ...formData, reports_to: null });
                        setShowDropdown(false);
                        setSearchTerm('');
                      }}
                      onMouseEnter={(e) => !formData.reports_to && (e.currentTarget.style.background = '#e5e7eb')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = !formData.reports_to ? '#f3f4f6' : 'transparent')}
                    >
                      <strong>None (Top Level)</strong>
                    </div>
                    {filteredManagers.length === 0 ? (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                        No members found
                      </div>
                    ) : (
                      filteredManagers.map((mgr: OrgChartMember) => (
                        <div
                          key={mgr.id}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            borderBottom: '1px solid #f3f4f6',
                            background: formData.reports_to === mgr.id ? '#f3f4f6' : 'transparent'
                          }}
                          onClick={() => {
                            setFormData({ ...formData, reports_to: mgr.id });
                            setShowDropdown(false);
                            setSearchTerm('');
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#e5e7eb')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = formData.reports_to === mgr.id ? '#f3f4f6' : 'transparent')}
                        >
                          <div style={{ fontWeight: 600 }}>
                            {mgr.first_name} {mgr.last_name}
                          </div>
                          {mgr.title && (
                            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                              {mgr.title}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@email.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saveMember.isPending}
            >
              {saveMember.isPending ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Member')}
            </button>
          </div>

          {saveMember.isError && (
            <div className="error-message">
              {isEditMode ? 'Failed to update member.' : 'Failed to add member.'} Please try again.
              <div style={{ marginTop: '0.5rem', fontSize: '0.9em' }}>
                {(saveMember.error as any)?.response?.data?.error ||
                 (saveMember.error instanceof Error ? saveMember.error.message : 'Unknown error')}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default OrgChartMemberModal;
