import React from 'react';
import {
  Wheat, Stethoscope, Factory, Warehouse, Newspaper, Mountain, GraduationCap,
  Building2, Briefcase, Zap, BedDouble, Church, Shield, Truck,
  RadioTower, TreePine, Recycle, Construction, Droplets, Home,
  Building, ShoppingBag, Landmark, Server, HardHat, ClipboardList,
  CircleCheck, CirclePause, CircleX, FileText,
  type LucideIcon,
} from 'lucide-react';

const marketIconMap: { [key: string]: LucideIcon } = {
  'MFG-Food': Wheat,
  'Health Care': Stethoscope,
  'MFG-Other': Warehouse,
  'MFG-Paper': Newspaper,
  'Amusement/Recreation': Mountain,
  'Educational': GraduationCap,
  'Manufacturing': Factory,
  'Commercial': Building2,
  'Office': Briefcase,
  'Power': Zap,
  'Lodging': BedDouble,
  'Religious': Church,
  'Public Safety': Shield,
  'Transportation': Truck,
  'Communication': RadioTower,
  'Conservation/Development': TreePine,
  'Sewage/Waste Disposal': Recycle,
  'Highway/Street': Construction,
  'Water Supply': Droplets,
  'Residential': Home,
  // Legacy mappings
  'Healthcare': Stethoscope,
  'Education': GraduationCap,
  'Industrial': Factory,
  'Retail': ShoppingBag,
  'Government': Landmark,
  'Hospitality': BedDouble,
  'Data Center': Server,
  'Hotel': BedDouble,
  'Multi-Family': Home,
};

const statusIconMap: { [key: string]: LucideIcon } = {
  'Open': HardHat,
  'Soft-Closed': ClipboardList,
  'Hard-Closed': CircleCheck,
  active: HardHat,
  on_hold: CirclePause,
  completed: CircleCheck,
  cancelled: CircleX,
};

const marketGradientMap: { [key: string]: string } = {
  'MFG-Food': 'linear-gradient(135deg, #f97316, #eab308)',
  'Health Care': 'linear-gradient(135deg, #10b981, #06b6d4)',
  'MFG-Other': 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'MFG-Paper': 'linear-gradient(135deg, #64748b, #94a3b8)',
  'Amusement/Recreation': 'linear-gradient(135deg, #ec4899, #f43f5e)',
  'Educational': 'linear-gradient(135deg, #f59e0b, #f97316)',
  'Manufacturing': 'linear-gradient(135deg, #6366f1, #3b82f6)',
  'Commercial': 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  'Office': 'linear-gradient(135deg, #3b82f6, #06b6d4)',
  'Power': 'linear-gradient(135deg, #eab308, #f59e0b)',
  'Lodging': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
  'Religious': 'linear-gradient(135deg, #8b5cf6, #a855f7)',
  'Public Safety': 'linear-gradient(135deg, #ef4444, #f97316)',
  'Transportation': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  'Communication': 'linear-gradient(135deg, #14b8a6, #06b6d4)',
  'Conservation/Development': 'linear-gradient(135deg, #22c55e, #10b981)',
  'Sewage/Waste Disposal': 'linear-gradient(135deg, #84cc16, #22c55e)',
  'Highway/Street': 'linear-gradient(135deg, #64748b, #475569)',
  'Water Supply': 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
  'Residential': 'linear-gradient(135deg, #a855f7, #ec4899)',
  // Legacy mappings
  'Healthcare': 'linear-gradient(135deg, #10b981, #06b6d4)',
  'Education': 'linear-gradient(135deg, #f59e0b, #f43f5e)',
  'Industrial': 'linear-gradient(135deg, #06b6d4, #10b981)',
  'Retail': 'linear-gradient(135deg, #06b6d4, #3b82f6)',
  'Government': 'linear-gradient(135deg, #8b5cf6, #ec4899)',
  'Hospitality': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
  'Data Center': 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
  'Hotel': 'linear-gradient(135deg, #f43f5e, #f59e0b)',
  'Multi-Family': 'linear-gradient(135deg, #10b981, #3b82f6)',
};

export const getMarketGradient = (market?: string): string =>
  marketGradientMap[market || ''] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';

const projectGradientMap: { [key: string]: string } = {
  'Open': 'linear-gradient(135deg, #10b981, #06b6d4)',
  'Soft-Closed': 'linear-gradient(135deg, #f59e0b, #f97316)',
  'Hard-Closed': 'linear-gradient(135deg, #6b7280, #4b5563)',
  active: 'linear-gradient(135deg, #10b981, #06b6d4)',
  on_hold: 'linear-gradient(135deg, #f59e0b, #f43f5e)',
  completed: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  cancelled: 'linear-gradient(135deg, #ef4444, #dc2626)',
};

export const getProjectGradient = (status?: string): string =>
  projectGradientMap[status || ''] || 'linear-gradient(135deg, #3b82f6, #8b5cf6)';

export const resolveMarketKey = (market?: string): string | undefined => {
  if (!market) return undefined;
  if (marketIconMap[market]) return market;
  const lower = market.toLowerCase();
  for (const key of Object.keys(marketIconMap)) {
    if (lower.includes(key.toLowerCase())) return key;
  }
  return undefined;
};

export const renderMarketIcon = (market?: string, size: number = 16) => {
  const Icon = marketIconMap[market || ''] || Building;
  return <Icon size={size} color="white" strokeWidth={2} />;
};

export const renderProjectIcon = (status?: string, size: number = 16) => {
  const Icon = statusIconMap[status || ''] || FileText;
  return <Icon size={size} color="white" strokeWidth={2} />;
};
