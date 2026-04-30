import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgChartsApi, OrgChartMember } from '../../services/orgCharts';
import ContactOrgChart, { OrgChartPerson } from '../../components/customers/ContactOrgChart';
import OrgChartMemberModal from '../../components/modals/OrgChartMemberModal';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import '../CustomerDetail.css';

const OrgChartDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm } = useTitanFeedback();
  const [editingMember, setEditingMember] = useState<OrgChartMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [layout, setLayout] = useState<'vertical' | 'horizontal' | 'compact'>('vertical');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: chart, isLoading } = useQuery({
    queryKey: ['org-chart', id],
    queryFn: () => orgChartsApi.getById(parseInt(id!)),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; project_id?: number }) =>
      orgChartsApi.update(parseInt(id!), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-chart', id] });
      setIsEditingInfo(false);
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: (memberId: number) =>
      orgChartsApi.deleteMember(parseInt(id!), memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-chart', id] });
      queryClient.invalidateQueries({ queryKey: ['org-chart-members', parseInt(id!)] });
    },
  });

  const handleEditInfo = () => {
    if (chart) {
      setEditName(chart.name);
      setEditDescription(chart.description || '');
      setIsEditingInfo(true);
    }
  };

  const handleSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    updateMutation.mutate({
      name: editName,
      description: editDescription,
      project_id: chart?.project_id
    });
  };

  const handlePersonEdit = (person: OrgChartPerson) => {
    const member = chart?.members?.find(m => m.id === person.id);
    if (member) {
      setEditingMember(member);
    }
  };

  const handleDeleteMember = async (member: OrgChartMember) => {
    const confirmed = await confirm({
      message: `Remove ${member.first_name} ${member.last_name} from the org chart?`,
      title: 'Remove Member',
      danger: true
    });
    if (confirmed) {
      deleteMemberMutation.mutate(member.id);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading org chart...</div>
      </div>
    );
  }

  if (!chart) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Org chart not found</div>
      </div>
    );
  }

  const members: OrgChartPerson[] = (chart.members || []).map(m => ({
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    title: m.title,
    email: m.email,
    phone: m.phone,
    reports_to: m.reports_to,
  }));

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%', height: '100vh', overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => navigate('/org-charts')}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            &larr; Back
          </button>
          <div>
            {isEditingInfo ? (
              <form onSubmit={handleSaveInfo} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    border: '2px solid #3b82f6',
                    borderRadius: '6px',
                    padding: '0.25rem 0.5rem',
                    outline: 'none'
                  }}
                  autoFocus
                  required
                />
                <button
                  type="submit"
                  style={{
                    padding: '0.375rem 0.75rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingInfo(false)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <h1
                  style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, cursor: 'pointer' }}
                  onClick={handleEditInfo}
                  title="Click to edit"
                >
                  {chart.name}
                </h1>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                  {chart.project_name && <span style={{ color: '#7c3aed', fontWeight: 500 }}>{chart.project_name} &middot; </span>}
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                  {chart.description && <span> &middot; {chart.description}</span>}
                </p>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Layout Selector */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>Layout:</span>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '6px' }}>
              {(['vertical', 'horizontal', 'compact'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayout(l)}
                  style={{
                    padding: '0.375rem 0.75rem',
                    background: layout === l ? 'white' : 'transparent',
                    color: layout === l ? '#3b82f6' : '#6b7280',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: layout === l ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {l === 'vertical' ? '\u2193 Vertical' : l === 'horizontal' ? '\u2192 Horizontal' : '\u229E Compact'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowAddMember(true)}
            style={{
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            + Add Member
          </button>
        </div>
      </div>

      {/* Members Table (compact view) */}
      {members.length > 0 && (
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>Team Members</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {(chart.members || []).map((m: OrgChartMember) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.85rem'
                }}
              >
                <span style={{ fontWeight: 600, color: '#1f2937' }}>
                  {m.first_name} {m.last_name}
                </span>
                {m.title && <span style={{ color: '#6b7280' }}>({m.title})</span>}
                <button
                  onClick={() => setEditingMember(m)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    padding: '0 0.25rem',
                    fontSize: '0.8rem'
                  }}
                  title="Edit member"
                >
                  &#9998;
                </button>
                <button
                  onClick={() => handleDeleteMember(m)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    padding: '0 0.25rem',
                    fontSize: '0.8rem'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                  title="Remove member"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org Chart Visualization */}
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        minHeight: 'calc(100vh - 300px)'
      }}>
        {members.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#128101;</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              No members yet
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>
              Add team members to build your project org chart
            </p>
            <button
              onClick={() => setShowAddMember(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Add Your First Member
            </button>
          </div>
        ) : (
          <ContactOrgChart
            contacts={members}
            onContactEdit={handlePersonEdit}
            layout={layout}
            showReportsCount={false}
          />
        )}
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <OrgChartMemberModal
          orgChartId={parseInt(id!)}
          orgChartName={chart.name}
          onClose={() => setShowAddMember(false)}
        />
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <OrgChartMemberModal
          orgChartId={parseInt(id!)}
          orgChartName={chart.name}
          member={editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
};

export default OrgChartDetail;
