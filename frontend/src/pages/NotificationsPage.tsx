import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { notificationsApi, Notification } from '../services/notifications';
import './NotificationsPage.css';

const ENTITY_LABELS: Record<string, string> = {
  rfi: 'RFI',
  field_issue: 'Field Issue',
  daily_report: 'Daily Report',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-page'],
    queryFn: () => notificationsApi.getAll({ limit: 100 }).then(r => r.data),
  });

  const markAsRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  function handleClick(n: Notification) {
    if (!n.read_at) {
      markAsRead.mutate(n.id);
    }
    if (n.link) {
      navigate(n.link);
    }
  }

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <div className="notifications-page">
      <div className="notifications-page-header">
        <h1>Notifications</h1>
        {unreadCount > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => markAllAsRead.mutate()}>
            <DoneAllIcon fontSize="small" />
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="notifications-loading">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="notifications-empty">
          <p>No notifications yet.</p>
          <p className="text-muted">You'll see notifications here when field team members submit RFIs, issues, or daily reports on your projects.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notifications-list-item ${!n.read_at ? 'unread' : ''}`}
              onClick={() => handleClick(n)}
            >
              <span className={`notif-type-tag ${n.entity_type}`}>
                {ENTITY_LABELS[n.entity_type] || n.entity_type}
              </span>
              <div className="notif-content">
                <div className="notif-title">{n.title}</div>
                {n.message && <div className="notif-message">{n.message}</div>}
              </div>
              <div className="notif-meta">
                <span className="notif-date">{formatDate(n.created_at)}</span>
                {!n.read_at && <span className="notif-dot" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
