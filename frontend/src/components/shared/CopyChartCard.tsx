import React, { useState, useRef } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import html2canvas from 'html2canvas';

interface CopyChartCardProps {
  title: React.ReactNode;
  height: number | string;
  flex?: number | string;
  cardStyle?: React.CSSProperties;
  titleStyle?: React.CSSProperties;
  children: React.ReactNode;
}

export function CopyChartCard({ title, height, flex = 1, cardStyle, titleStyle, children }: CopyChartCardProps) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleCopy = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        ignoreElements: (el) => el === btnRef.current,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {
      /* silent */
    }
  };

  return (
    <div
      ref={cardRef}
      style={{ flex, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.875rem', ...cardStyle }}
    >
      <div
        style={{
          fontSize: '0.68rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          ...titleStyle,
        }}
      >
        <span style={{ flex: 1 }}>{title}</span>
        <button
          ref={btnRef}
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy chart'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: copied ? '#10b981' : '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: 3 }}
        >
          {copied
            ? <CheckIcon style={{ fontSize: '0.8rem' }} />
            : <ContentCopyIcon style={{ fontSize: '0.8rem' }} />}
        </button>
      </div>
      <div style={{ height, position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}
