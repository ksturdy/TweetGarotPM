import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { employeesApi } from '../services/employees';
import { teamsApi } from '../services/teams';
import { projectsApi } from '../services/projects';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import html2canvas from 'html2canvas';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ViewScope, DashboardColumn, DashboardLayout, WidgetLayoutItem } from '../components/dashboard/types';
import { getWidget } from '../components/dashboard/widgetRegistry';
import { getGreeting } from '../components/dashboard/utils';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import CustomizeDashboardDrawer from '../components/dashboard/CustomizeDashboardDrawer';
import './Dashboard.css';
import '../styles/SalesPipeline.css';

const SortableWidget: React.FC<{
  id: string;
  onDismiss: () => void;
  children: React.ReactNode;
}> = ({ id, onDismiss, children }) => {
  const [copied, setCopied] = useState(false);
  const [confirmingDismiss, setConfirmingDismiss] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const setRefs = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node);
    cardRef.current = node;
  }, [setNodeRef]);

  const handleCopy = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        ignoreElements: (el) => el === copyBtnRef.current || el.classList.contains('widget-controls'),
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch (err) {
      console.error('Failed to copy widget', err);
    }
  };

  return (
    <div
      ref={setRefs}
      style={{
        // Don't transform the placeholder — DragOverlay handles the visual
        transform: isDragging ? undefined : CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
      className={`sortable-widget-wrapper${isDragging ? ' is-dragging' : ''}`}
    >
      <div className="widget-controls">
        <span
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="widget-drag-handle"
          title="Drag to reorder"
        >
          ⠿
        </span>
        <button
          ref={copyBtnRef}
          className="widget-copy-btn"
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy as image'}
          type="button"
        >
          {copied
            ? <CheckIcon style={{ fontSize: '0.875rem' }} />
            : <ContentCopyIcon style={{ fontSize: '0.875rem' }} />}
        </button>
        <button
          className="widget-dismiss-btn"
          onClick={onDismiss}
          title="Remove from dashboard"
          type="button"
        >
          <CloseIcon style={{ fontSize: '0.875rem' }} />
        </button>
      </div>
      {children}
    </div>
  );
};

const DroppableColumn: React.FC<{ id: string; className: string; children: React.ReactNode }> = ({ id, className, children }) => {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className={className}>{children}</div>;
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [viewScope, setViewScope] = useState<ViewScope>('my');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liveLayout, setLiveLayout] = useState<DashboardLayout | null>(null);
  const { layout, defaultViewScope, isLoading: layoutLoading, save, reset, isSaving } = useDashboardLayout();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
  }, []);

  useEffect(() => {
    if (scopeInitialized || layoutLoading) return;
    if (defaultViewScope) setViewScope(defaultViewScope);
    setScopeInitialized(true);
  }, [defaultViewScope, scopeInitialized, layoutLoading]);

  const { data: currentEmployeeResponse } = useQuery({
    queryKey: ['current-employee', user?.id],
    queryFn: () => user?.id ? employeesApi.getByUserId(user.id).then(res => res.data) : Promise.resolve(null),
    enabled: !!user?.id,
  });
  const currentEmployeeId = currentEmployeeResponse?.data?.id;

  const { data: teamMemberIdsResponse } = useQuery({
    queryKey: ['my-team-member-ids'],
    queryFn: () => teamsApi.getMyTeamMemberIds(),
    enabled: !!user?.id,
  });
  const teamMemberEmployeeIds = teamMemberIdsResponse?.data?.data?.employeeIds || [];
  const teamMemberUserIds = teamMemberIdsResponse?.data?.data?.userIds || [];
  const teamMemberNames = teamMemberIdsResponse?.data?.data?.names || [];

  const { isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((res) => res.data),
  });

  const widgetProps = {
    viewScope,
    currentEmployeeId,
    currentUserId: user?.id,
    currentUserName: user ? `${user.firstName} ${user.lastName}` : '',
    teamMemberEmployeeIds,
    teamMemberUserIds,
    teamMemberNames,
  };

  const displayLayout = useMemo(() => liveLayout ?? layout, [liveLayout, layout]);

  const widgetsByColumn = useMemo(() => {
    const grouped: Record<DashboardColumn, WidgetLayoutItem[]> = {
      kpi: [], left: [], center: [], right: [], activity: [],
    };
    displayLayout
      .filter(item => item.visible)
      .forEach(item => {
        grouped[item.column].push(item);
      });
    (Object.keys(grouped) as DashboardColumn[]).forEach(col => {
      grouped[col].sort((a, b) => a.order - b.order);
    });
    return grouped;
  }, [displayLayout]);

  const DROPPABLE_COLUMNS: DashboardColumn[] = ['left', 'center', 'right', 'activity'];

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setLiveLayout(layout);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !liveLayout) return;

    const dragId = active.id as string;
    const overId = over.id as string;
    if (dragId === overId) return;

    const isOverColumn = DROPPABLE_COLUMNS.includes(overId as DashboardColumn);
    const activeItem = liveLayout.find(i => i.id === dragId);
    if (!activeItem) return;

    const overItem = isOverColumn ? null : liveLayout.find(i => i.id === overId);
    const targetColumn: DashboardColumn = isOverColumn
      ? overId as DashboardColumn
      : (overItem?.column ?? activeItem.column);

    if (targetColumn === activeItem.column) {
      // Same column — update order
      const colItems = liveLayout
        .filter(i => i.column === targetColumn && i.visible)
        .sort((a, b) => a.order - b.order);
      const oldIdx = colItems.findIndex(i => i.id === dragId);
      const newIdx = colItems.findIndex(i => i.id === overId);
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return;
      const reordered = arrayMove(colItems, oldIdx, newIdx).map((item, idx) => ({ ...item, order: idx }));
      setLiveLayout(prev => prev ? prev.map(item => reordered.find(r => r.id === item.id) ?? item) : prev);
    } else {
      // Cross-column — move item
      const targetItems = liveLayout
        .filter(i => i.column === targetColumn && i.visible && i.id !== dragId)
        .sort((a, b) => a.order - b.order);
      let insertAt = isOverColumn ? targetItems.length : targetItems.findIndex(i => i.id === overId);
      if (insertAt === -1) insertAt = targetItems.length;

      const newTargetItems = [
        ...targetItems.slice(0, insertAt),
        { ...activeItem, column: targetColumn },
        ...targetItems.slice(insertAt),
      ].map((item, idx) => ({ ...item, order: idx }));

      const oldColItems = liveLayout
        .filter(i => i.column === activeItem.column && i.visible && i.id !== dragId)
        .map((item, idx) => ({ ...item, order: idx }));

      setLiveLayout(prev => {
        if (!prev) return prev;
        return prev.map(item => {
          const inNew = newTargetItems.find(r => r.id === item.id);
          if (inNew) return inNew;
          const inOld = oldColItems.find(r => r.id === item.id);
          if (inOld) return inOld;
          return item;
        });
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    if (!liveLayout) return;
    if (event.over) {
      save({ layout: liveLayout, defaultViewScope });
    }
    setLiveLayout(null);
  };

  const handleDismiss = (widgetId: string) => {
    const nextLayout: DashboardLayout = layout.map(item =>
      item.id === widgetId ? { ...item, visible: false } : item
    );
    save({ layout: nextLayout, defaultViewScope });
  };

  const renderKpiWidgets = () =>
    widgetsByColumn.kpi.map(item => {
      const def = getWidget(item.id);
      if (!def) return null;
      const Component = def.component;
      return <Component key={item.id} {...widgetProps} />;
    });

  const renderSortableWidgets = (column: DashboardColumn) =>
    widgetsByColumn[column].map(item => {
      const def = getWidget(item.id);
      if (!def) return null;
      const Component = def.component;
      if (def.locked) {
        return <Component key={item.id} {...widgetProps} />;
      }
      return (
        <SortableWidget key={item.id} id={item.id} onDismiss={() => handleDismiss(item.id)}>
          <Component {...widgetProps} />
        </SortableWidget>
      );
    });

  const getViewLabel = () => {
    switch (viewScope) {
      case 'my': return 'your';
      case 'team': return "your team's";
      case 'company': return 'company-wide';
    }
  };

  if (projectsLoading) {
    return <div className="loading">Loading...</div>;
  }

  const activeWidgetDef = activeId ? getWidget(activeId) : null;

  return (
    <div className="dashboard">
      <div className="dashboard-header-row">
        <div className="dashboard-welcome">
          <div className="welcome-text">
            <h1>{getGreeting()}, {user?.firstName || 'User'}</h1>
            <p>Here's what's happening with {getViewLabel()} projects today.</p>
          </div>
        </div>

        <div className="dashboard-header-actions">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewScope === 'my' ? 'active' : ''}`}
              onClick={() => setViewScope('my')}
            >
              <PersonIcon fontSize="small" />
              <span>My Work</span>
            </button>
            <button
              className={`view-toggle-btn ${viewScope === 'team' ? 'active' : ''}`}
              onClick={() => setViewScope('team')}
            >
              <GroupsIcon fontSize="small" />
              <span>My Team</span>
            </button>
            <button
              className={`view-toggle-btn ${viewScope === 'company' ? 'active' : ''}`}
              onClick={() => setViewScope('company')}
            >
              <BusinessIcon fontSize="small" />
              <span>Company</span>
            </button>
          </div>
          <button
            className="customize-button"
            onClick={() => setCustomizeOpen(true)}
            title="Customize dashboard"
          >
            <TuneIcon fontSize="small" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {renderKpiWidgets()}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="dashboard-grid">
          <DroppableColumn id="left" className="dashboard-col dashboard-col-left">
            <SortableContext items={widgetsByColumn.left.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {renderSortableWidgets('left')}
            </SortableContext>
          </DroppableColumn>
          <DroppableColumn id="center" className="dashboard-col dashboard-col-center">
            <SortableContext items={widgetsByColumn.center.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {renderSortableWidgets('center')}
            </SortableContext>
          </DroppableColumn>
          <DroppableColumn id="right" className="dashboard-col dashboard-col-right">
            <SortableContext items={widgetsByColumn.right.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {renderSortableWidgets('right')}
            </SortableContext>
          </DroppableColumn>
          <DroppableColumn id="activity" className="dashboard-col dashboard-activity">
            <SortableContext items={widgetsByColumn.activity.map(i => i.id)} strategy={verticalListSortingStrategy}>
              {renderSortableWidgets('activity')}
            </SortableContext>
          </DroppableColumn>
        </div>
        <DragOverlay>
          {activeWidgetDef ? (
            <div className="dashboard-card drag-overlay-ghost">
              <div className="card-header">
                <h3 className="card-title">{activeWidgetDef.title}</h3>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CustomizeDashboardDrawer
        open={customizeOpen}
        layout={layout}
        defaultViewScope={defaultViewScope}
        onClose={() => setCustomizeOpen(false)}
        onSave={(nextLayout, nextScope) => {
          save({ layout: nextLayout, defaultViewScope: nextScope });
          if (nextScope) setViewScope(nextScope);
          setCustomizeOpen(false);
        }}
        onReset={() => reset()}
        isSaving={isSaving}
      />
    </div>
  );
};

export default Dashboard;
