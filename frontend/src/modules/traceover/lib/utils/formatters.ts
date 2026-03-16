export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDimension(value: number, unit: string): string {
  if (unit === 'ft') {
    const feet = Math.floor(value);
    const inches = Math.round((value - feet) * 12);
    if (inches === 0) return `${feet}'-0"`;
    return `${feet}'-${inches}"`;
  }
  return `${value.toFixed(2)} ${unit}`;
}

export function formatArea(value: number, unit: string): string {
  return `${value.toFixed(2)} sq ${unit}`;
}

export function formatQuantity(value: number, unit: string): string {
  if (unit === 'ea') return `${value}`;
  return `${value.toFixed(1)} ${unit}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
