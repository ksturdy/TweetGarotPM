import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { OpportunityActivity } from '../../services/opportunities';
import VoiceNoteButton from './VoiceNoteButton';
import '../../styles/ActivityTimeline.css';

interface ActivityTimelineProps {
  opportunityId: number;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ opportunityId }) => {
  const queryClient = useQueryClient();
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activity_type: 'note' as 'call' | 'meeting' | 'email' | 'note' | 'task' | 'voice_note',
    subject: '',
    notes: '',
    scheduled_at: ''
  });

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

  const handleSubmitActivity = (e: React.FormEvent) => {
    e.preventDefault();
    createActivityMutation.mutate(activityForm);
  };

  const handleVoiceNote = (transcript: string) => {
    setActivityForm(prev => ({
      ...prev,
      notes: prev.notes ? `${prev.notes}\n\n${transcript}` : transcript
    }));
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
            <div className="textarea-with-voice">
              <textarea
                value={activityForm.notes}
                onChange={(e) => setActivityForm(prev => ({
                  ...prev,
                  notes: e.target.value
                }))}
                rows={3}
                placeholder="Add details..."
              />
              <VoiceNoteButton onTranscript={handleVoiceNote} />
            </div>
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
          activities.map(activity => (
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
                  <span className="timeline-date">
                    {formatDateTime(activity.scheduled_at || activity.created_at)}
                  </span>
                </div>

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
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityTimeline;
