import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  feedbackService,
  Feedback,
  FeedbackVote,
  FeedbackComment,
  FeedbackFilters
} from '../services/feedback';
import { useAuth } from '../context/AuthContext';
import FeedbackList from '../components/feedback/FeedbackList';
import FeedbackForm from '../components/feedback/FeedbackForm';
import FeedbackDetail from '../components/feedback/FeedbackDetail';
import './FeedbackPage.css';

const ALL_STATUSES = ['submitted', 'read', 'under_review', 'in_progress', 'completed', 'on_hold', 'rejected'];
const DEFAULT_STATUSES = ALL_STATUSES.filter(s => s !== 'completed');

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  read: 'Read',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
  rejected: 'Rejected',
};

const FeedbackPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<FeedbackFilters>({
    status: DEFAULT_STATUSES.join(','),
    sortBy: 'votes',
    order: 'desc'
  });
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [userVotes, setUserVotes] = useState<Map<number, FeedbackVote | null>>(new Map());
  const [showForm, setShowForm] = useState(true);

  // Fetch all feedback
  const { data: feedbackItems = [], isLoading } = useQuery({
    queryKey: ['feedback', filters],
    queryFn: () => feedbackService.getAll(filters)
  });

  // Fetch comments for selected feedback
  const { data: comments = [] } = useQuery({
    queryKey: ['feedback-comments', selectedFeedback?.id],
    queryFn: () => feedbackService.getComments(selectedFeedback!.id),
    enabled: !!selectedFeedback
  });

  // Fetch user votes for all feedback items
  useEffect(() => {
    const fetchVotes = async () => {
      const votesMap = new Map<number, FeedbackVote | null>();
      for (const feedback of feedbackItems) {
        try {
          const vote = await feedbackService.getUserVote(feedback.id);
          votesMap.set(feedback.id, vote);
        } catch (error) {
          votesMap.set(feedback.id, null);
        }
      }
      setUserVotes(votesMap);
    };

    if (feedbackItems.length > 0) {
      fetchVotes();
    }
  }, [feedbackItems]);

  // Create feedback mutation
  const createFeedbackMutation = useMutation({
    mutationFn: feedbackService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      setShowForm(false);
    }
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: ({ feedbackId, voteType }: { feedbackId: number; voteType: 'up' | 'down' }) =>
      feedbackService.vote(feedbackId, voteType),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      setUserVotes(prev => new Map(prev).set(variables.feedbackId, data));
    }
  });

  // Remove vote mutation
  const removeVoteMutation = useMutation({
    mutationFn: (feedbackId: number) => feedbackService.removeVote(feedbackId),
    onSuccess: (_, feedbackId) => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      setUserVotes(prev => new Map(prev).set(feedbackId, null));
    }
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: ({ feedbackId, comment }: { feedbackId: number; comment: string }) =>
      feedbackService.addComment(feedbackId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-comments', selectedFeedback?.id] });
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    }
  });

  // Update status mutation (admin only)
  const updateStatusMutation = useMutation({
    mutationFn: ({ feedbackId, status }: { feedbackId: number; status: string }) =>
      feedbackService.update(feedbackId, { status: status as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      if (selectedFeedback) {
        // Refresh the selected feedback
        feedbackService.getById(selectedFeedback.id).then(updated => {
          setSelectedFeedback(updated);
        });
      }
    }
  });

  const handleVote = (feedbackId: number, voteType: 'up' | 'down') => {
    voteMutation.mutate({ feedbackId, voteType });
  };

  const handleRemoveVote = (feedbackId: number) => {
    removeVoteMutation.mutate(feedbackId);
  };

  const handleSelectFeedback = (feedback: Feedback) => {
    setSelectedFeedback(feedback);
    setShowForm(false);
  };

  const handleAddComment = async (comment: string) => {
    if (selectedFeedback) {
      await addCommentMutation.mutateAsync({
        feedbackId: selectedFeedback.id,
        comment
      });
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (selectedFeedback) {
      await updateStatusMutation.mutateAsync({
        feedbackId: selectedFeedback.id,
        status
      });
    }
  };

  // Close status dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync selectedStatuses → filters.status
  useEffect(() => {
    if (selectedStatuses.length === ALL_STATUSES.length || selectedStatuses.length === 0) {
      setFilters(prev => ({ ...prev, status: undefined }));
    } else {
      setFilters(prev => ({ ...prev, status: selectedStatuses.join(',') }));
    }
  }, [selectedStatuses]);

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleAllStatuses = () => {
    setSelectedStatuses(prev =>
      prev.length === ALL_STATUSES.length ? [] : [...ALL_STATUSES]
    );
  };

  const handleFilterChange = (key: keyof FeedbackFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  const isAdmin = user?.role === 'admin';

  const statusButtonLabel = selectedStatuses.length === ALL_STATUSES.length
    ? 'All'
    : selectedStatuses.length === 0
    ? 'None'
    : selectedStatuses.length <= 2
    ? selectedStatuses.map(s => STATUS_LABELS[s]).join(', ')
    : `${selectedStatuses.length} selected`;

  return (
    <div className="feedback-page">
      <div className="feedback-header">
        <div className="feedback-header-content">
          <h1>Developer Feedback</h1>
          <p>Share your ideas and help us make Titan better together!</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowForm(true);
            setSelectedFeedback(null);
          }}
        >
          + New Feedback
        </button>
      </div>

      <div className="feedback-filters">
        <div className="filter-group" ref={statusDropdownRef}>
          <label>Status:</label>
          <div className="multi-select-container">
            <button
              type="button"
              className="multi-select-trigger form-control form-control-sm"
              onClick={() => setStatusDropdownOpen(prev => !prev)}
            >
              <span>{statusButtonLabel}</span>
              <span className="multi-select-arrow">&#9662;</span>
            </button>
            {statusDropdownOpen && (
              <div className="multi-select-dropdown">
                <label className="multi-select-option multi-select-all">
                  <input
                    type="checkbox"
                    checked={selectedStatuses.length === ALL_STATUSES.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedStatuses.length > 0 && selectedStatuses.length < ALL_STATUSES.length;
                    }}
                    onChange={toggleAllStatuses}
                  />
                  <span>Select All</span>
                </label>
                <div className="multi-select-divider" />
                {ALL_STATUSES.map(status => (
                  <label key={status} className="multi-select-option">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() => toggleStatus(status)}
                    />
                    <span>{STATUS_LABELS[status]}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label>Type:</label>
          <select
            value={filters.type || ''}
            onChange={(e) => handleFilterChange('type', e.target.value)}
            className="form-control form-control-sm"
          >
            <option value="">All</option>
            <option value="bug">Bug</option>
            <option value="enhancement">Enhancement</option>
            <option value="feature_request">Feature Request</option>
            <option value="improvement">Improvement</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Sort by:</label>
          <select
            value={filters.sortBy || 'votes'}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="form-control form-control-sm"
          >
            <option value="votes">Most Votes</option>
            <option value="created">Newest</option>
            <option value="updated">Recently Updated</option>
            <option value="status">Status</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Order:</label>
          <select
            value={filters.order || 'desc'}
            onChange={(e) => handleFilterChange('order', e.target.value)}
            className="form-control form-control-sm"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      <div className="feedback-content">
        <div className="feedback-left">
          {isLoading ? (
            <div className="loading">Loading feedback...</div>
          ) : (
            <FeedbackList
              feedbackItems={feedbackItems}
              userVotes={userVotes}
              onVote={handleVote}
              onRemoveVote={handleRemoveVote}
              onSelectFeedback={handleSelectFeedback}
              selectedFeedbackId={selectedFeedback?.id}
            />
          )}
        </div>

        <div className="feedback-right">
          {showForm ? (
            <FeedbackForm onSubmit={async (data) => {
              await createFeedbackMutation.mutateAsync(data);
            }} />
          ) : selectedFeedback ? (
            <FeedbackDetail
              feedback={selectedFeedback}
              comments={comments}
              onAddComment={handleAddComment}
              onUpdateStatus={isAdmin ? handleUpdateStatus : undefined}
              onClose={() => setSelectedFeedback(null)}
            />
          ) : (
            <div className="feedback-placeholder">
              <p>Select a feedback item to view details or create a new one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
