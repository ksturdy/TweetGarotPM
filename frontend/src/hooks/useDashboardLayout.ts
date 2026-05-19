import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardLayoutApi, DashboardSettings } from '../services/dashboardLayout';
import { DashboardLayout, ViewScope } from '../components/dashboard/types';
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

  const { data: saved, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => dashboardLayoutApi.get(),
  });

  const layout: DashboardLayout = saved?.layout
    ? reconcileWithRegistry(saved.layout)
    : defaultLayout;

  const defaultViewScope: ViewScope | null = saved?.defaultViewScope ?? null;
  const isCustomized = !!saved?.layout;

  const saveMutation = useMutation({
    mutationFn: ({ layout: nextLayout, defaultViewScope: nextScope }: { layout: DashboardLayout; defaultViewScope: ViewScope | null }) =>
      dashboardLayoutApi.save(nextLayout, nextScope),
    onSuccess: (next) => {
      queryClient.setQueryData(QUERY_KEY, next);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => dashboardLayoutApi.reset(),
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEY, { layout: null, defaultViewScope: null } as DashboardSettings);
    },
  });

  return {
    layout,
    defaultViewScope,
    isLoading,
    isCustomized,
    save: saveMutation.mutate,
    reset: resetMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
