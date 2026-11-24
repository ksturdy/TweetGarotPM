import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { safetyTeamApi } from '../../services/safetyTeamMembers';
import type { SafetyTeamMember } from '../../services/safetyTeamMembers';
import { usersApi } from '../../services/users';
import type { User } from '../../services/users';
import ConfirmModal from '../../components/common/ConfirmModal';
import SearchableSelect from '../../components/SearchableSelect';

const COLOR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#ef4444', // red
  '#eab308', // yellow
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f43f5e', // rose
];

const SafetyTeamSetup: React.FC = () => {
  const qc = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [confirmRemove, setConfirmRemove] = useState<SafetyTeamMember | null>(null);

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['safety-team-members'],
    queryFn: () => safetyTeamApi.getAll().then(r => r.data),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const memberUserIds = new Set(members.map(m => m.user_id));
  const availableUsers = (allUsers as User[])
    .filter(u => u.is_active && !memberUserIds.has(u.id))
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));

  const addMut = useMutation({
    mutationFn: (userId: number) => safetyTeamApi.add(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['safety-team-members'] });
      setSelectedUserId('');
    },
  });

  const removeMut = useMutation({
    mutationFn: (userId: number) => safetyTeamApi.remove(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['safety-team-members'] });
      setConfirmRemove(null);
    },
  });

  const colorMut = useMutation({
    mutationFn: ({ userId, color }: { userId: number; color: string }) =>
      safetyTeamApi.updateColor(userId, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['safety-team-members'] }),
  });

  const initials = (m: SafetyTeamMember) =>
    `${m.first_name[0] ?? ''}${m.last_name[0] ?? ''}`.toUpperCase();

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <Link to="/safety/calendar" style={{ fontSize: '12px', color: '#6b7280', textDecoration: 'none', display: 'block', marginBottom: '6px' }}>
          ← Safety Calendar
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #002356 0%, #1d4ed8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
          }}>
            🛡
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111827' }}>Safety Team</h1>
            <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Manage who appears on the safety calendar</p>
          </div>
        </div>
      </div>

      {/* Add member */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '20px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Add Member
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <SearchableSelect
            options={availableUsers.map(u => ({
              value: u.id,
              label: `${u.first_name} ${u.last_name}`,
              searchText: `${u.first_name} ${u.last_name} ${u.email}`,
            }))}
            value={selectedUserId}
            onChange={setSelectedUserId}
            placeholder="Search for a user…"
            style={{ flex: 1 }}
          />
          <button
            disabled={!selectedUserId || addMut.isPending}
            onClick={() => selectedUserId && addMut.mutate(Number(selectedUserId))}
            style={{
              padding: '8px 20px',
              borderRadius: '7px',
              border: 'none',
              background: selectedUserId ? 'linear-gradient(135deg, #002356 0%, #1d4ed8 100%)' : '#e5e7eb',
              color: selectedUserId ? '#fff' : '#9ca3af',
              fontWeight: 700,
              fontSize: '13px',
              cursor: selectedUserId ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            {addMut.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Member list */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', fontSize: '13px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Team Members ({members.length})
        </div>

        {loadingMembers ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
            No safety team members yet. Add someone above.
          </div>
        ) : (
          members.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 20px',
                borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: m.color ?? '#6b7280',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700,
              }}>
                {initials(m)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{m.full_name}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{m.email}</div>
                {/* Color swatches */}
                <div style={{ display: 'flex', gap: '5px', marginTop: '7px', flexWrap: 'wrap' }}>
                  {COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      title={c}
                      onClick={() => colorMut.mutate({ userId: m.user_id, color: c })}
                      style={{
                        width: '18px', height: '18px',
                        borderRadius: '50%',
                        background: c,
                        border: m.color === c ? '2px solid #111827' : '2px solid transparent',
                        cursor: 'pointer',
                        outline: m.color === c ? '2px solid #fff' : 'none',
                        outlineOffset: '-3px',
                        padding: 0,
                      }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={() => setConfirmRemove(m)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #fca5a5',
                  background: '#fff',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={confirmRemove !== null}
        title="Remove Team Member"
        message={`Remove ${confirmRemove?.full_name} from the safety team? They will no longer appear as a filter on the calendar.`}
        confirmLabel="Remove"
        variant="danger"
        isPending={removeMut.isPending}
        onConfirm={() => confirmRemove && removeMut.mutate(confirmRemove.user_id)}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
};

export default SafetyTeamSetup;
