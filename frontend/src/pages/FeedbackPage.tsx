import React, { useState, useEffect } from 'react';
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

const FeedbackPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FeedbackFilters>({
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

  const handleFilterChange = (key: keyof FeedbackFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  const isAdmin = user?.role === 'admin';

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
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="form-control form-control-sm"
          >
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="read">Read</option>
            <option value="under_review">Under Review</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="rejected">Rejected</option>
          </select>
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
