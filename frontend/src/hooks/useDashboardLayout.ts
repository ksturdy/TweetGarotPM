import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardLayoutApi } from '../services/dashboardLayout';
import { DashboardLayout } from '../components/dashboard/types';
import { defaultLayout } from '../components/dashboard/defaultLayout';
import { widgetRegistry } from '../components/dashboard/widgetRegistry';

const QUERY_KEY = ['dashboard-layout'];

const reconcileWithRegistry = (layout: DashboardLayout): DashboardLayout => {
  const known = layout.filter(item => widgetRegistry[item.id]);
  const knownIds = new Set(known.map(item => item.id));

  const missing = defaultLayout.filter(item => !knownIds.has(item.id));
  const lockedMissing = missing.filter(item => widgetRegistry[item.id]?.locked);
  const optionalMissing = missing
    .filter(item => !widgetRegistry[item.id]?.locked)
    .map(item => ({ ...item, visible: false }));

  return [...known, ...lockedMissing, ...optionalMissing];
};

export function useDashboardLayout() {
  const queryClient = useQueryClient();

  const { data: savedLayout, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => dashboardLayoutApi.get(),
  });

  const layout: DashboardLayout = Array.isArray(savedLayout)
    ? reconcileWithRegistry(savedLayout)
    : defaultLayout;

  const isCustomized = Array.isArray(savedLayout);

  const saveMutation = useMutation({
    mutationFn: (next: DashboardLayout) => dashboardLayoutApi.save(next),
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, saved);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => dashboardLayoutApi.reset(),
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEY, null);
    },
  });

  return {
    layout,
    isLoading,
    isCustomized,
    save: saveMutation.mutate,
    reset: resetMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
