interface ProgressBarProps {
  value: number; // 0–100
  color?: string;
  height?: number;
}

export default function ProgressBar({ value, color = '#3b82f6', height = 6 }: ProgressBarProps) {
  return (
    <div
      style={{
        width: '100%',
        height,
        backgroundColor: '#1f3450',
        borderRadius: height / 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: height / 2,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
