import React from 'react';

interface PresenceDotProps {
  status: 'online' | 'away' | 'offline';
  size?: number;
}

const COLORS: Record<string, string> = {
  online: '#22c55e',
  away: '#f59e0b',
  offline: '#9ca3af',
};

const PresenceDot: React.FC<PresenceDotProps> = ({ status, size = 8 }) => (
  <span
    style={{
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: COLORS[status] || COLORS.offline,
      flexShrink: 0,
    }}
    title={status.charAt(0).toUpperCase() + status.slice(1)}
  />
);

export default PresenceDot;
