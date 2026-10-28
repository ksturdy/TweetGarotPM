import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  feedbackService,
  Feedback,
  FeedbackVote,
  FeedbackComment,
  FeedbackFilters,
  FeedbackKPIs
} from '../services/feedback';
import { useAuth } from '../context/AuthContext';
import { attachmentsApi } from '../services/attachments';
import FeedbackList from '../components/feedback/FeedbackList';
import FeedbackForm from '../components/feedback/FeedbackForm';
import FeedbackDetail from '../components/feedback/FeedbackDetail';
import './FeedbackPage.css';

const ALL_STATUSES = ['submitted', 'read', 'under_review', 'in_progress', 'in_testing', 'completed', 'on_hold', 'rejected', 'future_enhancement'];
const DEFAULT_STATUSES = ALL_STATUSES.filter(s => s !== 'completed' && s !== 'future_enhancement');
const STORAGE_KEY = 'titan_feedback_default_statuses';
const SECOND_PANEL_KEY = 'titan_feedback_second_panel_statuses';
const DEFAULT_SECOND_PANEL = ['future_enhancement'];

const loadSavedSecondPanel = (): string[] => {
  try {
    const saved = localStorage.getItem(SECOND_PANEL_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SECOND_PANEL;
  } catch { return DEFAULT_SECOND_PANEL; }
};

const loadSavedDefaults = (): string[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_STATUSES;
  } catch { return DEFAULT_STATUSES; }
};

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  read: 'Read',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  in_testing: 'In Testing',
  completed: 'Completed',
  on_hold: 'On Hold',
  rejected: 'Rejected',
  future_enhancement: 'Future Enhancement',
};

const STATUS_COLORS: Record<string, string> = {
  submitted: '#6c757d',
  read: '#17a2b8',
  under_review: '#ffc107',
  in_progress: '#007bff',
  in_testing: '#8b5cf6',
  completed: '#28a745',
  on_hold: '#fd7e14',
  rejected: '#dc3545',
  future_enhancement: '#3f51b5',
};

const FeedbackPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(loadSavedDefaults);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<FeedbackFilters>(() => {
    const defaults = loadSavedDefaults();
    return {
      status: defaults.length === ALL_STATUSES.length ? undefined : defaults.join(','),
      sortBy: 'votes',
      order: 'desc',
    };
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftDefaults, setDraftDefaults] = useState<string[]>(loadSavedDefaults);
  const [secondPanelStatuses, setSecondPanelStatuses] = useState<string[]>(loadSavedSecondPanel);
  const [draftSecondPanel, setDraftSecondPanel] = useState<string[]>(loadSavedSecondPanel);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [userVotes, setUserVotes] = useState<Map<number, FeedbackVote | null>>(new Map());
  const [showForm, setShowForm] = useState(true);

  // Fetch KPIs
  const { data: kpis } = useQuery<FeedbackKPIs>({
    queryKey: ['feedback-kpis'],
    queryFn: () => feedbackService.getKPIs(),
  });

  // Fetch all feedback
  const { data: feedbackItems = [], isLoading } = useQuery({
    queryKey: ['feedback', filters],
    queryFn: () => feedbackService.getAll(filters)
  });

  // Fetch second panel items
  const { data: secondPanelItems = [] } = useQuery({
    queryKey: ['feedback-second-panel', secondPanelStatuses],
    queryFn: () => feedbackService.getAll({ status: secondPanelStatuses.join(','), sortBy: 'created', order: 'asc' }),
    enabled: secondPanelStatuses.length > 0,
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

  // Update comment mutation
  const updateCommentMutation = useMutation({
    mutationFn: ({ feedbackId, commentId, comment }: { feedbackId: number; commentId: number; comment: string }) =>
      feedbackService.updateComment(feedbackId, commentId, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-comments', selectedFeedback?.id] });
    }
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: ({ feedbackId, commentId }: { feedbackId: number; commentId: number }) =>
      feedbackService.deleteComment(feedbackId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-comments', selectedFeedback?.id] });
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
    }
  });

  // Follower query
  const { data: followersData } = useQuery({
    queryKey: ['feedback-followers', selectedFeedback?.id],
    queryFn: () => feedbackService.getFollowers(selectedFeedback!.id),
    enabled: !!selectedFeedback,
  });

  const toggleFollowMutation = useMutation({
    mutationFn: () => feedbackService.toggleFollow(selectedFeedback!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback-followers', selectedFeedback?.id] }),
  });

  const addFollowerMutation = useMutation({
    mutationFn: (userId: number) => feedbackService.addFollower(selectedFeedback!.id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback-followers', selectedFeedback?.id] }),
  });

  const removeFollowerMutation = useMutation({
    mutationFn: (userId: number) => feedbackService.removeFollower(selectedFeedback!.id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback-followers', selectedFeedback?.id] }),
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

  const handleUpdateComment = async (commentId: number, comment: string) => {
    if (selectedFeedback) {
      await updateCommentMutation.mutateAsync({
        feedbackId: selectedFeedback.id,
        commentId,
        comment
      });
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (selectedFeedback) {
      await deleteCommentMutation.mutateAsync({
        feedbackId: selectedFeedback.id,
        commentId
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

  // Close settings flyout on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleDraft = (status: string) => {
    setDraftDefaults(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleSecondPanelDraft = (status: string) => {
    setDraftSecondPanel(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const saveDefaults = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draftDefaults));
    localStorage.setItem(SECOND_PANEL_KEY, JSON.stringify(draftSecondPanel));
    setSelectedStatuses(draftDefaults);
    setSecondPanelStatuses(draftSecondPanel);
    setSettingsOpen(false);
  };

  const resetDefaults = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SECOND_PANEL_KEY);
    setDraftDefaults(DEFAULT_STATUSES);
    setSelectedStatuses(DEFAULT_STATUSES);
    setDraftSecondPanel(DEFAULT_SECOND_PANEL);
    setSecondPanelStatuses(DEFAULT_SECOND_PANEL);
    setSettingsOpen(false);
  };

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

        <div className="filter-group feedback-settings-group" ref={settingsRef}>
          <label>&nbsp;</label>
          <button
            type="button"
            className="feedback-settings-btn"
            onClick={() => { setDraftDefaults(loadSavedDefaults()); setSettingsOpen(p => !p); }}
            title="Default filter settings"
          >
            ⚙
          </button>
          {settingsOpen && (
            <div className="feedback-settings-flyout">
              <div className="feedback-settings-header">Default Status Filters</div>
              <div className="feedback-settings-body">
                <div className="feedback-settings-desc">
                  Statuses pre-selected in the main list each time you open this page.
                </div>
                {ALL_STATUSES.map(s => (
                  <label key={s} className="multi-select-option">
                    <input
                      type="checkbox"
                      checked={draftDefaults.includes(s)}
                      onChange={() => toggleDraft(s)}
                    />
                    <span>{STATUS_LABELS[s]}</span>
                  </label>
                ))}
              </div>
              <div className="feedback-settings-section-divider" />
              <div className="feedback-settings-header">Future Enhancements Panel</div>
              <div className="feedback-settings-body">
                <div className="feedback-settings-desc">
                  Statuses shown in the bottom panel. Default: Future Enhancement.
                </div>
                {ALL_STATUSES.map(s => (
                  <label key={s} className="multi-select-option">
                    <input
                      type="checkbox"
                      checked={draftSecondPanel.includes(s)}
                      onChange={() => toggleSecondPanelDraft(s)}
                    />
                    <span>{STATUS_LABELS[s]}</span>
                  </label>
                ))}
              </div>
              <div className="feedback-settings-footer">
                <button className="feedback-settings-save" onClick={saveDefaults}>Save as Default</button>
                <button className="feedback-settings-reset" onClick={resetDefaults}>Reset</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="feedback-kpi-bar">
        <div className="feedback-kpi-card">
          <div className="kpi-icon kpi-icon--blue">&#9776;</div>
          <div className="kpi-body">
            <div className="kpi-value">{feedbackItems.length}</div>
            <div className="kpi-label">Showing</div>
          </div>
        </div>
        <div className="feedback-kpi-card">
          <div className="kpi-icon kpi-icon--green">&#10003;</div>
          <div className="kpi-body">
            <div className="kpi-value">{kpis ? Number(kpis.completed_count).toLocaleString() : '—'}</div>
            <div className="kpi-label">Completed</div>
          </div>
        </div>
        <div className="feedback-kpi-card">
          <div className="kpi-icon kpi-icon--orange">&#9201;</div>
          <div className="kpi-body">
            <div className="kpi-value">
              {kpis?.avg_response_days != null ? `${kpis.avg_response_days}d` : '—'}
            </div>
            <div className="kpi-label">Avg. Response (30d)</div>
          </div>
        </div>
        <div className="feedback-kpi-card">
          <div className="kpi-icon kpi-icon--purple">&#9889;</div>
          <div className="kpi-body">
            <div className="kpi-value">
              {kpis?.avg_fix_days != null ? `${kpis.avg_fix_days}d` : '—'}
            </div>
            <div className="kpi-label">Avg. Fix Time (30d)</div>
          </div>
        </div>
      </div>

      <div className="feedback-content">
        <div className="feedback-left">
          <div className="feedback-main-list">
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
          {secondPanelStatuses.length > 0 && (
            <div className="feedback-second-panel">
              <div className="second-panel-header">
                <span className="second-panel-title">Future Enhancements</span>
                <span className="second-panel-count">{secondPanelItems.length}</span>
              </div>
              {secondPanelItems.length === 0 ? (
                <div className="second-panel-empty">No items</div>
              ) : (
                <table className="second-panel-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Title</th>
                      <th>Status</th>
                      <th>Module</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secondPanelItems.map(item => (
                      <tr
                        key={item.id}
                        onClick={() => handleSelectFeedback(item)}
                        className={selectedFeedback?.id === item.id ? 'selected' : ''}
                      >
                        <td className="sp-col-id">#{item.id}</td>
                        <td className="sp-col-title">{item.title}</td>
                        <td className="sp-col-status">
                          <span
                            className="sp-status-badge"
                            style={{ background: STATUS_COLORS[item.status] ?? '#6c757d' }}
                          >
                            {STATUS_LABELS[item.status] ?? item.status}
                          </span>
                        </td>
                        <td className="sp-col-module">{item.module || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="feedback-right">
          {showForm ? (
            <FeedbackForm onSubmit={async (data) => {
              const { files, watcherIds, ...feedbackData } = data;
              const created = await createFeedbackMutation.mutateAsync(feedbackData);
              if (files && files.length > 0 && created?.id) {
                for (const file of files) {
                  try {
                    await attachmentsApi.upload('feedback', created.id, file);
                  } catch (err) {
                    console.error('Failed to upload attachment:', file.name, err);
                  }
                }
              }
              if (watcherIds && watcherIds.length > 0 && created?.id) {
                for (const userId of watcherIds) {
                  try {
                    await feedbackService.addFollower(created.id, userId);
                  } catch (err) {
                    console.error('Failed to add watcher:', userId, err);
                  }
                }
              }
            }} />
          ) : selectedFeedback ? (
            <FeedbackDetail
              feedback={selectedFeedback}
              comments={comments}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              onUpdateStatus={isAdmin ? handleUpdateStatus : undefined}
              onClose={() => setSelectedFeedback(null)}
              followers={followersData?.followers}
              isFollowing={followersData?.isFollowing}
              onToggleFollow={async () => { await toggleFollowMutation.mutateAsync(); }}
              onAddFollower={async (userId) => { await addFollowerMutation.mutateAsync(userId); }}
              onRemoveFollower={async (userId) => { await removeFollowerMutation.mutateAsync(userId); }}
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
