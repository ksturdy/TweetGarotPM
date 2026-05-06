import { ActivityItem } from '../../services/dashboard';

export const getMarketIcon = (market?: string): string => {
  const marketIcons: { [key: string]: string } = {
    'Healthcare': '🏥',
    'Education': '🏫',
    'Commercial': '🏢',
    'Industrial': '🏭',
    'Retail': '🏬',
    'Government': '🏛️',
    'Hospitality': '🏨',
    'Data Center': '💾',
  };
  return marketIcons[market || ''] || '🏢';
};

export const getMarketGradient = (market?: string): string => {
  const marketGradients: { [key: string]: string } = {
    'Healthcare': 'linear-gradient(135deg, #10b981, #06b6d4)',
    'Education': 'linear-gradient(135deg, #f59e0b, #f43f5e)',
    'Commercial': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    'Industrial': 'linear-gradient(135deg, #06b6d4, #10b981)',
    'Retail': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
    'Government': 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    'Hospitality': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
    'Data Center': 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
  };
  return marketGradients[market || ''] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
};

export const getStatusColor = (status: string): string => {
  const colors: { [key: string]: string } = {
    'Open': '#10b981', 'Soft-Closed': '#f59e0b', 'Hard-Closed': '#6b7280',
    active: '#10b981', on_hold: '#f59e0b', completed: '#3b82f6', cancelled: '#ef4444',
  };
  return colors[status] || '#6b7280';
};

export const getProjectIcon = (status: string): string => {
  const icons: { [key: string]: string } = {
    'Open': '🏗️', 'Soft-Closed': '📋', 'Hard-Closed': '✅',
    active: '🏗️', on_hold: '⏸️', completed: '✅', cancelled: '❌',
  };
  return icons[status] || '📋';
};

export const getProjectGradient = (status: string): string => {
  const gradients: { [key: string]: string } = {
    'Open': 'linear-gradient(135deg, #10b981, #06b6d4)',
    'Soft-Closed': 'linear-gradient(135deg, #f59e0b, #f97316)',
    'Hard-Closed': 'linear-gradient(135deg, #6b7280, #4b5563)',
    active: 'linear-gradient(135deg, #10b981, #06b6d4)',
    on_hold: 'linear-gradient(135deg, #f59e0b, #f43f5e)',
    completed: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    cancelled: 'linear-gradient(135deg, #ef4444, #dc2626)',
  };
  return gradients[status] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
};

export const getManagerInitials = (name?: string): string => {
  if (!name) return 'UN';
  return name.split(' ').map(n => n[0]).join('');
};

export const getManagerColor = (name: string): string => {
  const colors = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

export const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
};

export const getActivityIcon = (type: string): string => {
  const icons: Record<string, string> = {
    project: '📁', opportunity: '🤝', estimate: '🧮',
    rfi: '❓', submittal: '📋', change_order: '📝', daily_report: '📊',
  };
  return icons[type] || '📌';
};

export const getActivityLabel = (type: string): string => {
  const labels: Record<string, string> = {
    project: 'Project', opportunity: 'Opportunity', estimate: 'Estimate',
    rfi: 'RFI', submittal: 'Submittal', change_order: 'Change Order', daily_report: 'Daily Report',
  };
  return labels[type] || type;
};

export const getActivityPath = (item: ActivityItem): string => {
  switch (item.type) {
    case 'project': return `/projects/${item.entityId}`;
    case 'opportunity': return '/sales';
    case 'estimate': return `/estimating/estimates/${item.entityId}`;
    case 'rfi': return item.parentId ? `/projects/${item.parentId}/rfis/${item.entityId}` : '#';
    case 'submittal': return item.parentId ? `/projects/${item.parentId}/submittals/${item.entityId}` : '#';
    case 'change_order': return item.parentId ? `/projects/${item.parentId}/change-orders/${item.entityId}` : '#';
    case 'daily_report': return item.parentId ? `/projects/${item.parentId}/daily-reports/${item.entityId}` : '#';
    default: return '#';
  }
};
