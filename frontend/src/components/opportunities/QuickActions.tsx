import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { Opportunity } from '../../services/opportunities';
import '../../styles/QuickActions.css';

interface QuickActionsProps {
  opportunity: Opportunity;
  onUpdate: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({ opportunity, onUpdate }) => {
  const queryClient = useQueryClient();
  const [showCallModal, setShowCallModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [emailSubject, setEmailSubject] = useState('');

  // Quick log activity mutation
  const logActivityMutation = useMutation({
    mutationFn: (data: any) => opportunitiesService.createActivity(opportunity.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      onUpdate();
    }
  });

  const handleCall = () => {
    if (opportunity.client_phone) {
      // Open phone dialer
      window.location.href = `tel:${opportunity.client_phone}`;
      setShowCallModal(true);
    }
  };

  const handleEmail = () => {
    if (opportunity.client_email) {
      // Open email client
      window.location.href = `mailto:${opportunity.client_email}`;
      setShowEmailModal(true);
    }
  };

  const handleLogCall = () => {
    if (!callNotes.trim()) return;

    logActivityMutation.mutate({
      activity_type: 'call',
      subject: 'Phone call',
      notes: callNotes,
      completed_at: new Date().toISOString(),
      is_completed: true
    });

    setCallNotes('');
    setShowCallModal(false);
  };

  const handleLogEmail = () => {
    if (!emailSubject.trim()) return;

    logActivityMutation.mutate({
      activity_type: 'email',
      subject: emailSubject,
      completed_at: new Date().toISOString(),
      is_completed: true
    });

    setEmailSubject('');
    setShowEmailModal(false);
  };

  const handleScheduleMeeting = () => {
    // Could integrate with calendar APIs
    logActivityMutation.mutate({
      activity_type: 'meeting',
      subject: 'Meeting scheduled',
      scheduled_at: new Date().toISOString()
    });
  };

  const handleQuickNote = () => {
    const note = prompt('Quick note:');
    if (note && note.trim()) {
      logActivityMutation.mutate({
        activity_type: 'note',
        notes: note.trim(),
        completed_at: new Date().toISOString(),
        is_completed: true
      });
    }
  };

  return (
    <>
      <div className="quick-actions">
        <button
          className="quick-action-btn call"
          onClick={handleCall}
          disabled={!opportunity.client_phone}
          title="Call client"
        >
          <span className="action-icon">📞</span>
          <span className="action-label">Call</span>
        </button>

        <button
          className="quick-action-btn email"
          onClick={handleEmail}
          disabled={!opportunity.client_email}
          title="Email client"
        >
          <span className="action-icon">✉️</span>
          <span className="action-label">Email</span>
        </button>

        <button
          className="quick-action-btn meeting"
          onClick={handleScheduleMeeting}
          title="Schedule meeting"
        >
          <span className="action-icon">📅</span>
          <span className="action-label">Meeting</span>
        </button>

        <button
          className="quick-action-btn note"
          onClick={handleQuickNote}
          title="Add quick note"
        >
          <span className="action-icon">📝</span>
          <span className="action-label">Note</span>
        </button>
      </div>

      {/* Call Log Modal */}
      {showCallModal && (
        <div className="activity-log-modal">
          <div className="log-modal-content">
            <h3>Log Call</h3>
            <textarea
              placeholder="How did the call go? Any next steps?"
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="log-modal-actions">
              <button onClick={() => setShowCallModal(false)} className="btn-secondary">
                Skip
              </button>
              <button onClick={handleLogCall} className="btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Log Modal */}
      {showEmailModal && (
        <div className="activity-log-modal">
          <div className="log-modal-content">
            <h3>Log Email</h3>
            <input
              type="text"
              placeholder="Email subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              autoFocus
            />
            <div className="log-modal-actions">
              <button onClick={() => setShowEmailModal(false)} className="btn-secondary">
                Skip
              </button>
              <button onClick={handleLogEmail} className="btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QuickActions;
