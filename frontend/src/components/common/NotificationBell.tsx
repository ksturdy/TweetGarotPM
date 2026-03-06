import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { notificationsApi, Notification } from '../../services/notifications';
import './NotificationBell.css';

const ENTITY_ICONS: Record<string, string> = {
  rfi: 'RFI',
  field_issue: 'Issue',
  daily_report: 'Report',
  feedback: 'Feedback',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Poll for unread count every 15 seconds
  const { data: countData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then(r => r.data),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  // Fetch notifications when dropdown is open
  const { data: notifData } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationsApi.getAll({ limit: 15 }).then(r => r.data),
    enabled: open,
  });

  const markAsRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-list'] });
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const unreadCount = countData?.count || 0;
  const notifications = notifData?.notifications || [];

  function handleNotificationClick(n: Notification) {
    if (!n.read_at) {
      markAsRead.mutate(n.id);
    }
    if (n.link) {
      navigate(n.link);
    }
    setOpen(false);
  }

  return (
    <div className="notification-bell-wrapper" ref={dropdownRef}>
      <button
        className="notification-bell-btn"
        onClick={() => setOpen(!open)}
        title="Notifications"
      >
        {unreadCount > 0 ? (
          <NotificationsIcon fontSize="small" />
        ) : (
          <NotificationsNoneIcon fontSize="small" />
        )}
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="notification-mark-all"
                onClick={() => markAllAsRead.mutate()}
                title="Mark all as read"
              >
                <DoneAllIcon fontSize="small" />
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-dropdown-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">No notifications</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={`notification-item ${!n.read_at ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <span className={`notification-type-badge ${n.entity_type}`}>
                    {ENTITY_ICONS[n.entity_type] || n.entity_type}
                  </span>
                  <div className="notification-item-content">
                    <div className="notification-item-title">{n.title}</div>
                    {n.message && (
                      <div className="notification-item-message">{n.message}</div>
                    )}
                    <div className="notification-item-time">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read_at && <span className="notification-unread-dot" />}
                </button>
              ))
            )}
          </div>

          <div className="notification-dropdown-footer">
            <button
              className="notification-view-all"
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
