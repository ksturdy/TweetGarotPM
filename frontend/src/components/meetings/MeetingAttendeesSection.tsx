import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, MeetingAttendee } from '../../services/meetings';
import { usersApi } from '../../services/users';
import { contactsApi } from '../../services/contacts';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonIcon from '@mui/icons-material/Person';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';
import SearchableSelect from '../SearchableSelect';

interface Props {
  meetingId: number;
  projectId: number;
  attendees: MeetingAttendee[];
  readonly?: boolean;
}

const initials = (name: string | null) => {
  if (!name) return '?';
  return name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
};

const displayName = (a: MeetingAttendee) =>
  a.user_name || a.contact_name || a.name || 'Unknown';

const displayCompany = (a: MeetingAttendee) =>
  a.contact_company || a.company || '';

const MeetingAttendeesSection: React.FC<Props> = ({ meetingId, projectId, attendees, readonly }) => {
  const { toast } = useTitanFeedback();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });

  const [addMode, setAddMode] = useState<'internal' | 'external' | null>(null);
  const [addKey, setAddKey] = useState(0);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [extName, setExtName] = useState('');
  const [extCompany, setExtCompany] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then(r => r.data),
    enabled: addMode === 'internal',
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-project', projectId],
    queryFn: () => contactsApi.getByProject(projectId).then(r => r.data),
    enabled: addMode === 'external',
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<MeetingAttendee>) => meetingsApi.addAttendee(meetingId, data),
    onSuccess: (_, vars) => {
      invalidate();
      // If adding an internal user, stay in mode with a fresh dropdown
      if ((vars as any).user_id) {
        setAddKey(k => k + 1);
      } else {
        setAddMode(null);
        setSelectedContactId('');
        setExtName('');
        setExtCompany('');
      }
    },
    onError: () => toast.error('Failed to add attendee.'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, attended }: { id: number; attended: boolean }) =>
      meetingsApi.updateAttendee(meetingId, id, { attended }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => meetingsApi.removeAttendee(meetingId, id),
    onSuccess: () => { invalidate(); toast.success('Attendee removed.'); },
    onError: () => toast.error('Failed to remove attendee.'),
  });

  // Auto-submit when a user is selected from the dropdown
  const handleUserSelect = (userId: string) => {
    if (!userId) return;
    const user = users.find(u => String(u.id) === userId);
    addMutation.mutate({
      user_id: Number(userId),
      name: user ? `${user.first_name} ${user.last_name}` : '',
    } as any);
  };

  const handleAddExternal = () => {
    if (selectedContactId) {
      const contact = contacts.find(c => String(c.id) === selectedContactId);
      addMutation.mutate({
        contact_id: Number(selectedContactId),
        name: contact ? `${contact.first_name} ${contact.last_name}` : extName,
        company: extCompany,
      } as any);
    } else if (extName) {
      addMutation.mutate({ name: extName, company: extCompany } as any);
    }
  };

  const existingUserIds = new Set(attendees.filter(a => a.user_id).map(a => String(a.user_id)));

  return (
    <div>
      {attendees.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 14, margin: '0 0 12px' }}>No attendees added yet.</p>
      )}

      {attendees.map(a => (
        <div key={a.id} className="attendee-row">
          <div className="attendee-avatar">{initials(displayName(a))}</div>
          <div className="attendee-info">
            <div className="attendee-name">{displayName(a)}</div>
            {displayCompany(a) && <div className="attendee-sub">{displayCompany(a)}</div>}
            {a.user_email && <div className="attendee-sub">{a.user_email}</div>}
          </div>
          {!readonly && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#6b7280', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={a.attended}
                  onChange={e => toggleMutation.mutate({ id: a.id, attended: e.target.checked })}
                />
                Attended
              </label>
              <button className="btn-icon btn-icon-danger" title="Remove"
                onClick={() => removeMutation.mutate(a.id)}>
                <DeleteIcon style={{ fontSize: 15 }} />
              </button>
            </>
          )}
          {readonly && (
            <span style={{
              fontSize: 12, padding: '2px 8px', borderRadius: 10,
              background: a.attended ? '#d1fae5' : '#f3f4f6',
              color: a.attended ? '#059669' : '#9ca3af',
            }}>
              {a.attended ? 'Attended' : 'Invited'}
            </span>
          )}
        </div>
      ))}

      {!readonly && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {addMode === null && (
            <>
              <button className="add-item-row" onClick={() => setAddMode('internal')}>
                <AddIcon style={{ fontSize: 16 }} /> Add Team Member
              </button>
              <button className="add-item-row" style={{ marginLeft: 16 }} onClick={() => setAddMode('external')}>
                <PersonIcon style={{ fontSize: 16 }} /> Add External Contact
              </button>
            </>
          )}

          {addMode === 'internal' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
              <SearchableSelect
                key={addKey}
                options={users.filter(u => !existingUserIds.has(String(u.id))).map(u => ({
                  value: u.id,
                  label: `${u.first_name} ${u.last_name}`,
                }))}
                value=""
                onChange={handleUserSelect}
                placeholder="— Type to search team members —"
                style={{ flex: 1 }}
                autoOpen
                disabled={addMutation.isPending}
              />
              <button className="sales-btn sales-btn-secondary" onClick={() => { setAddMode(null); setAddKey(0); }}>Done</button>
            </div>
          )}

          {addMode === 'external' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <SearchableSelect
                  options={contacts.map((c: any) => ({
                    value: c.id,
                    label: `${c.first_name} ${c.last_name}${c.company_name ? ` (${c.company_name})` : ''}`,
                  }))}
                  value={selectedContactId}
                  onChange={setSelectedContactId}
                  placeholder="— Select project contact —"
                  style={{ flex: 1 }}
                />
              </div>
              {!selectedContactId && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" placeholder="Name" value={extName} onChange={e => setExtName(e.target.value)} style={{ flex: 1 }} />
                  <input className="form-input" placeholder="Company" value={extCompany} onChange={e => setExtCompany(e.target.value)} style={{ flex: 1 }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="sales-btn sales-btn-primary" onClick={handleAddExternal} disabled={(!selectedContactId && !extName) || addMutation.isPending}>Add</button>
                <button className="sales-btn sales-btn-secondary" onClick={() => { setAddMode(null); setSelectedContactId(''); setExtName(''); setExtCompany(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MeetingAttendeesSection;
