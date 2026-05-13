import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { OpportunityActivity } from '../../services/opportunities';
import { useAuth } from '../../context/AuthContext';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ConfirmModal from '../common/ConfirmModal';
import '../../styles/ActivityTimeline.css';

interface ActivityTimelineProps {
  opportunityId: number;
}

type ActivityForm = {
  subject: string;
  notes: string;
  scheduled_at: string;
};

// Trim "YYYY-MM-DDTHH:MM:SS..." to the format <input type="datetime-local"> wants.
const toLocalInput = (iso?: string | null): string => {
  if (!iso) return '';
  return iso.slice(0, 16);
};

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ opportunityId }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_type: 'note' as 'call' | 'meeting' | 'email' | 'note' | 'task' | 'voice_note',
    subject: '',
    notes: '',
    scheduled_at: ''
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ActivityForm>({ subject: '', notes: '', scheduled_at: '' });
  const [pendingDelete, setPendingDelete] = useState<OpportunityActivity | null>(null);

  // Fetch activities
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['opportunities', opportunityId, 'activities'],
    queryFn: () => opportunitiesService.getActivities(opportunityId)
  });

  // Create activity mutation
  const createActivityMutation = useMutation({
    mutationFn: (data: any) => opportunitiesService.createActivity(opportunityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setShowAddActivity(false);
      setActivityForm({
        activity_type: 'note',
        subject: '',
        notes: '',
        scheduled_at: ''
      });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save activity';
      alert(`Could not save activity: ${msg}`);
    }
  });

  // Complete activity mutation
  const completeActivityMutation = useMutation({
    mutationFn: (activityId: number) =>
      opportunitiesService.completeActivity(opportunityId, activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    }
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ activityId, data }: { activityId: number; data: Partial<OpportunityActivity> }) =>
      opportunitiesService.updateActivity(opportunityId, activityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setEditingId(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update activity';
      alert(`Could not update activity: ${msg}`);
    }
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (activityId: number) =>
      opportunitiesService.deleteActivity(opportunityId, activityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setPendingDelete(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || 'Failed to delete activity';
      alert(`Could not delete activity: ${msg}`);
    }
  });

  const startEdit = (activity: OpportunityActivity) => {
    setEditingId(activity.id);
    setEditForm({
      subject: activity.subject || '',
      notes: activity.notes || '',
      scheduled_at: toLocalInput(activity.scheduled_at),
    });
  };

  const handleSaveEdit = (activity: OpportunityActivity) => {
    updateActivityMutation.mutate({
      activityId: activity.id,
      data: {
        subject: editForm.subject,
        notes: editForm.notes,
        scheduled_at: editForm.scheduled_at || null as any,
      },
    });
  };

  const handleDelete = (activity: OpportunityActivity) => {
    setPendingDelete(activity);
  };

  const handleSubmitActivity = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...activityForm,
      scheduled_at: activityForm.scheduled_at || null,
    };
    createActivityMutation.mutate(payload);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return '📞';
      case 'meeting': return '📅';
      case 'email': return '✉️';
      case 'note': return '📝';
      case 'task': return '✓';
      case 'voice_note': return '🎤';
      default: return '📌';
    }
  };

  const getActivityClass = (activity: OpportunityActivity) => {
    if (activity.is_completed) return 'completed';
    if (activity.scheduled_at && new Date(activity.scheduled_at) < new Date()) return 'overdue';
    if (activity.activity_type === 'task') return 'pending';
    return 'logged';
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return <div className="timeline-loading">Loading activities...</div>;
  }

  return (
    <div className="activity-timeline">
      {/* Add Activity Button */}
      <button
        className="btn-add-activity"
        onClick={() => setShowAddActivity(!showAddActivity)}
      >
        <span>+</span> Add Activity
      </button>

      {/* Add Activity Form */}
      {showAddActivity && (
        <form className="add-activity-form" onSubmit={handleSubmitActivity}>
          <div className="form-group">
            <label>Activity Type</label>
            <select
              value={activityForm.activity_type}
              onChange={(e) => setActivityForm(prev => ({
                ...prev,
                activity_type: e.target.value as any
              }))}
            >
              <option value="note">Note</option>
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="email">Email</option>
              <option value="task">Task</option>
            </select>
          </div>

          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              value={activityForm.subject}
              onChange={(e) => setActivityForm(prev => ({
                ...prev,
                subject: e.target.value
              }))}
              placeholder="Brief description"
            />
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              value={activityForm.notes}
              onChange={(e) => setActivityForm(prev => ({
                ...prev,
                notes: e.target.value
              }))}
              rows={3}
              placeholder="Add details..."
            />
          </div>

          {(activityForm.activity_type === 'meeting' || activityForm.activity_type === 'task') && (
            <div className="form-group">
              <label>Schedule For</label>
              <input
                type="datetime-local"
                value={activityForm.scheduled_at}
                onChange={(e) => setActivityForm(prev => ({
                  ...prev,
                  scheduled_at: e.target.value
                }))}
              />
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={() => setShowAddActivity(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      <div className="timeline-list">
        {activities.length === 0 ? (
          <div className="timeline-empty">
            <p>No activities yet. Add your first activity above!</p>
          </div>
        ) : (
          activities.map(activity => {
            const canManage = user?.id === activity.created_by;
            const isEditing = editingId === activity.id;
            const isSchedulable = activity.activity_type === 'meeting' || activity.activity_type === 'task';

            return (
            <div
              key={activity.id}
              className={`timeline-item ${getActivityClass(activity)}`}
            >
              <div className="timeline-icon">
                {getActivityIcon(activity.activity_type)}
              </div>

              <div className="timeline-content">
                <div className="timeline-header">
                  <div className="timeline-title">
                    <strong>{activity.subject || activity.activity_type}</strong>
                    <span className="timeline-type">{activity.activity_type}</span>
                  </div>
                  <div className="timeline-header-right">
                    <span className="timeline-date">
                      {formatDateTime(activity.scheduled_at || activity.created_at)}
                    </span>
                    {canManage && !isEditing && (
                      <div className="timeline-actions">
                        <button onClick={() => startEdit(activity)} title="Edit" className="timeline-action-btn">
                          <EditIcon style={{ fontSize: 14 }} />
                        </button>
                        <button onClick={() => handleDelete(activity)} title="Delete" className="timeline-action-btn">
                          <DeleteIcon style={{ fontSize: 14 }} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="activity-edit-area">
                    <div className="form-group">
                      <label>Subject</label>
                      <input
                        type="text"
                        value={editForm.subject}
                        onChange={(e) => setEditForm(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Brief description"
                      />
                    </div>
                    <div className="form-group">
                      <label>Notes</label>
                      <textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        placeholder="Add details..."
                      />
                    </div>
                    {isSchedulable && (
                      <div className="form-group">
                        <label>Schedule For</label>
                        <input
                          type="datetime-local"
                          value={editForm.scheduled_at}
                          onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                        />
                      </div>
                    )}
                    <div className="form-actions">
                      <button type="button" onClick={() => setEditingId(null)} className="btn-secondary">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(activity)}
                        className="btn-primary"
                        disabled={updateActivityMutation.isPending}
                      >
                        {updateActivityMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {activity.notes && (
                      <p className="timeline-notes">{activity.notes}</p>
                    )}

                    {activity.voice_transcript && (
                      <div className="voice-transcript">
                        <span className="transcript-icon">🎤</span>
                        <p>{activity.voice_transcript}</p>
                      </div>
                    )}

                    <div className="timeline-footer">
                      <span className="timeline-author">
                        {activity.created_by_name || 'Unknown'}
                      </span>

                      {activity.activity_type === 'task' && !activity.is_completed && (
                        <button
                          className="btn-complete-task"
                          onClick={() => completeActivityMutation.mutate(activity.id)}
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete activity?"
        message={
          pendingDelete
            ? `This will permanently remove "${pendingDelete.subject || pendingDelete.activity_type}". This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="danger"
        isPending={deleteActivityMutation.isPending}
        onConfirm={() => pendingDelete && deleteActivityMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default ActivityTimeline;
