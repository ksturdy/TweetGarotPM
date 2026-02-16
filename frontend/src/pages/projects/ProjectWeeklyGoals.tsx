import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/projects';
import { weeklyGoalPlansApi, WeeklyGoalPlan, WeeklyGoalTask, DailyTradeActual } from '../../services/weeklyGoalPlans';

const ProjectWeeklyGoals: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const queryClient = useQueryClient();

  // State
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  });

  const [selectedTrade, setSelectedTrade] = useState<'all' | 'plumbing' | 'piping' | 'sheet_metal'>('all');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState('');
  const [quickAddTrade, setQuickAddTrade] = useState<'plumbing' | 'piping' | 'sheet_metal'>('plumbing');
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [expandedDayActuals, setExpandedDayActuals] = useState<string | null>(null);
  const [showIncompleteReason, setShowIncompleteReason] = useState(false);
  const [incompleteTaskId, setIncompleteTaskId] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<WeeklyGoalTask | null>(null);
  const [incompleteReason, setIncompleteReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [shouldReschedule, setShouldReschedule] = useState(false);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [reportContent, setReportContent] = useState('');

  // Queries
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(Number(projectId)).then(res => res.data),
  });

  const { data: plans } = useQuery({
    queryKey: ['weeklyGoalPlans', projectId],
    queryFn: () => weeklyGoalPlansApi.getByProject(Number(projectId!)).then(res => res.data),
    enabled: !!projectId,
  });

  const currentPlan = useMemo(() => {
    return plans?.find(p => p.week_start_date.split('T')[0] === selectedWeekStart);
  }, [plans, selectedWeekStart]);

  const { data: tasks } = useQuery({
    queryKey: ['weeklyGoalTasks', currentPlan?.id],
    queryFn: () => weeklyGoalPlansApi.getTasks(currentPlan!.id).then(res => res.data),
    enabled: !!currentPlan,
  });

  const { data: summary } = useQuery({
    queryKey: ['weeklyGoalSummary', currentPlan?.id],
    queryFn: () => weeklyGoalPlansApi.getSummary(currentPlan!.id).then(res => res.data),
    enabled: !!currentPlan,
  });

  const { data: dailyActuals } = useQuery({
    queryKey: ['dailyActuals', currentPlan?.id],
    queryFn: () => weeklyGoalPlansApi.getDailyActuals(currentPlan!.id).then(res => res.data),
    enabled: !!currentPlan,
  });

  // Mutations
  const createPlanMutation = useMutation({
    mutationFn: (data: any) => weeklyGoalPlansApi.create(data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalPlans', projectId] });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WeeklyGoalPlan> }) =>
      weeklyGoalPlansApi.update(id, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalPlans', projectId] });
      setShowPlanSettings(false);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: ({ planId, data }: { planId: number; data: any }) =>
      weeklyGoalPlansApi.createTask(planId, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalTasks', currentPlan?.id] });
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalSummary', currentPlan?.id] });
      setShowQuickAdd(false);
    },
    onError: (error: any) => {
      console.error('Create task error:', error);
      alert(`Error creating task: ${error.response?.data?.error || error.message}`);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: any }) =>
      weeklyGoalPlansApi.updateTask(taskId, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalTasks', currentPlan?.id] });
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalSummary', currentPlan?.id] });
      setEditingTask(null);
    },
    onError: (error: any) => {
      console.error('Update task error:', error);
      alert(`Error updating task: ${error.response?.data?.error || error.message}`);
    }
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status, incompleteReason, incompleteNotes }: {
      taskId: number;
      status: string;
      incompleteReason?: string | null;
      incompleteNotes?: string | null;
    }) =>
      weeklyGoalPlansApi.updateTaskStatus(taskId, status, incompleteReason, incompleteNotes).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalTasks', currentPlan?.id] });
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalSummary', currentPlan?.id] });
      setShowIncompleteReason(false);
      setIncompleteTaskId(null);
      setIncompleteReason('');
      setRescheduleDate('');
      setShouldReschedule(false);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => weeklyGoalPlansApi.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalTasks', currentPlan?.id] });
      queryClient.invalidateQueries({ queryKey: ['weeklyGoalSummary', currentPlan?.id] });
    },
  });

  const saveDailyActualsMutation = useMutation({
    mutationFn: ({ planId, data }: { planId: number; data: Partial<DailyTradeActual> }) =>
      weeklyGoalPlansApi.saveDailyActuals(planId, data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyActuals', currentPlan?.id] });
    },
  });

  // Week navigation
  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(selectedWeekStart);
    const offset = direction === 'prev' ? -7 : 7;
    current.setDate(current.getDate() + offset);
    setSelectedWeekStart(current.toISOString().split('T')[0]);
  };

  // Auto-create plan
  const handleCreateWeeklyPlan = () => {
    const startDate = new Date(selectedWeekStart);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 5);

    const planData: any = {
      projectId: Number(projectId),
      weekStartDate: selectedWeekStart,
      weekEndDate: endDate.toISOString().split('T')[0],
      includeSunday: false,
      status: 'active',
      plumbingCrewSize: 0,
      plumbingHoursPerDay: 0,
      plumbingDaysWorked: 0,
      pipingCrewSize: 0,
      pipingHoursPerDay: 0,
      pipingDaysWorked: 0,
      sheetMetalCrewSize: 0,
      sheetMetalHoursPerDay: 0,
      sheetMetalDaysWorked: 0,
    };
    createPlanMutation.mutate(planData);
  };

  // Submit daily report
  const handleSubmitDailyReport = (date: string) => {
    const dateInfo = formatDate(date);
    const dayData = tasksByDateAndTrade[date];

    if (!dayData || !project) {
      alert('No tasks to report for this day');
      return;
    }

    // Calculate planned and actual workers/hours across all trades
    let totalPlannedWorkers = 0;
    let totalActualWorkers = 0;
    let totalPlannedHours = 0;
    let totalActualHours = 0;

    (['plumbing', 'piping', 'sheet_metal'] as const).forEach(trade => {
      const plannedCrew = currentPlan?.[`${trade}_crew_size` as keyof WeeklyGoalPlan] as number || 0;
      const hoursPerDay = currentPlan?.[`${trade}_hours_per_day` as keyof WeeklyGoalPlan] as number || 0;
      totalPlannedWorkers += plannedCrew;
      totalPlannedHours += plannedCrew * hoursPerDay;

      const dailyActual = getDailyActual(date, trade);
      if (dailyActual) {
        totalActualWorkers += dailyActual.actual_crew_size;
        // actual_hours_worked is now hrs/shift per worker, so multiply by crew size for total
        totalActualHours += dailyActual.actual_crew_size * dailyActual.actual_hours_worked;
      }
    });

    // Generate report summary
    let reportText = `═══════════════════════════════════════════════════\n`;
    reportText += `DAILY REPORT - ${project.name}\n`;
    reportText += `Date: ${dateInfo.weekday}, ${dateInfo.monthDay}\n`;
    reportText += `═══════════════════════════════════════════════════\n\n`;

    // Workforce Summary
    const avgPlannedHoursPerWorker = totalPlannedWorkers > 0 ? (totalPlannedHours / totalPlannedWorkers).toFixed(1) : 0;
    // For actual, we already store hrs/shift, so just use that value
    const avgActualHoursPerWorker = 0; // Will be set from first trade with data

    // Get average hrs/shift from daily actuals (should be same across all trades for the day)
    let actualHrsPerShift = 0;
    (['plumbing', 'piping', 'sheet_metal'] as const).forEach(trade => {
      const dailyActual = getDailyActual(date, trade);
      if (dailyActual && dailyActual.actual_crew_size > 0 && actualHrsPerShift === 0) {
        actualHrsPerShift = Number(dailyActual.actual_hours_worked) || 0;
      }
    });

    reportText += `TOTAL JOB WORKFORCE SUMMARY:\n`;
    reportText += `Planned: ${totalPlannedWorkers} Workers | ${avgPlannedHoursPerWorker} Hrs/Shift | ${totalPlannedHours} Hours\n`;
    reportText += `Actual:  ${totalActualWorkers} Workers | ${actualHrsPerShift.toFixed(1)} Hrs/Shift | ${totalActualHours.toFixed(1)} Hours\n`;

    if (totalPlannedWorkers > 0 || totalPlannedHours > 0) {
      const workerVariance = totalActualWorkers - totalPlannedWorkers;
      const hourVariance = totalActualHours - totalPlannedHours;
      reportText += `Variance: ${workerVariance >= 0 ? '+' : ''}${workerVariance} Workers | ${hourVariance >= 0 ? '+' : ''}${hourVariance.toFixed(1)} Hours\n`;
    }
    reportText += `\n`;

    (['plumbing', 'piping', 'sheet_metal'] as const).forEach(trade => {
      const config = tradeConfig[trade];
      const tradeTasks = dayData[trade] || [];
      if (tradeTasks.length === 0) return;

      const completed = tradeTasks.filter(t => t.status === 'complete').length;
      const incomplete = tradeTasks.filter(t => t.status === 'incomplete').length;
      const totalHours = tradeTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
      const dailyActual = getDailyActual(date, trade);

      reportText += `━━━ ${config.name.toUpperCase()} (${config.abbr}) ━━━\n`;
      reportText += `Foreman: ${currentPlan?.[`${trade}_foreman` as keyof WeeklyGoalPlan] || 'Not assigned'}\n\n`;

      // Trade-specific workforce summary
      const plannedCrew = Number(currentPlan?.[`${trade}_crew_size` as keyof WeeklyGoalPlan]) || 0;
      const plannedHoursPerDay = Number(currentPlan?.[`${trade}_hours_per_day` as keyof WeeklyGoalPlan]) || 0;
      const plannedTotalHours = plannedCrew * plannedHoursPerDay;

      reportText += `Workforce Summary:\n`;
      reportText += `  Planned: ${plannedCrew} Workers | ${plannedHoursPerDay.toFixed(1)} Hrs/Shift | ${plannedTotalHours.toFixed(1)} Hours\n`;

      if (dailyActual) {
        const actualCrew = dailyActual.actual_crew_size;
        const actualHoursPerShift = Number(dailyActual.actual_hours_worked) || 0;
        const actualTotalHours = actualCrew * actualHoursPerShift;
        reportText += `  Actual:  ${actualCrew} Workers | ${actualHoursPerShift.toFixed(1)} Hrs/Shift | ${actualTotalHours.toFixed(1)} Hours\n`;

        if (plannedCrew > 0 || plannedTotalHours > 0) {
          const crewVariance = actualCrew - plannedCrew;
          const hoursVariance = actualTotalHours - plannedTotalHours;
          reportText += `  Variance: ${crewVariance >= 0 ? '+' : ''}${crewVariance} Workers | ${hoursVariance >= 0 ? '+' : ''}${hoursVariance.toFixed(1)} Hours\n`;
        }
      } else {
        reportText += `  Actual:  No data entered\n`;
      }

      reportText += `\nTasks: ${completed} completed, ${incomplete} incomplete (${tradeTasks.length} total)\n`;
      reportText += `Task Hours: ${totalHours}h\n\n`;

      // Completed Tasks
      const completedTasks = tradeTasks.filter(t => t.status === 'complete');
      if (completedTasks.length > 0) {
        reportText += `  ✓ COMPLETED TASKS:\n`;
        completedTasks.forEach(task => {
          reportText += `    • ${task.description}\n`;
          if (task.quantity && task.unit) {
            reportText += `      Quantity: ${task.quantity} ${task.unit}\n`;
          }
          reportText += `      Hours: ${task.actual_hours}h\n`;
        });
        reportText += '\n';
      }

      // Incomplete Tasks
      const incompleteTasks = tradeTasks.filter(t => t.status === 'incomplete');
      if (incompleteTasks.length > 0) {
        reportText += `  ⚠ INCOMPLETE TASKS:\n`;
        incompleteTasks.forEach(task => {
          reportText += `    • ${task.description}\n`;
          if (task.quantity && task.unit) {
            reportText += `      Quantity: ${task.quantity} ${task.unit}\n`;
          }
          reportText += `      Hours: ${task.actual_hours}h\n`;
          if (task.incomplete_reason) {
            const reasonText = task.incomplete_reason.replace('_', ' ').toUpperCase();
            reportText += `      Reason: ${reasonText}\n`;
          }
          if (task.incomplete_notes) {
            reportText += `      Notes: ${task.incomplete_notes}\n`;
          }
        });
        reportText += '\n';
      }
    });

    reportText += `═══════════════════════════════════════════════════\n`;
    reportText += `Report generated: ${new Date().toLocaleString()}\n`;

    // Show preview modal
    setReportContent(reportText);
    setShowReportPreview(true);
  };

  // Get week dates
  const weekDates = useMemo(() => {
    const start = new Date(selectedWeekStart);
    const dates = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }, [selectedWeekStart]);

  // Group tasks by date AND trade
  const tasksByDateAndTrade = useMemo(() => {
    if (!tasks) return {};

    const filtered = selectedTrade === 'all'
      ? tasks
      : tasks.filter(t => t.trade === selectedTrade);

    const grouped: Record<string, Record<string, WeeklyGoalTask[]>> = {};

    filtered.forEach(task => {
      const date = task.task_date.split('T')[0];
      if (!grouped[date]) {
        grouped[date] = {
          plumbing: [],
          piping: [],
          sheet_metal: []
        };
      }
      grouped[date][task.trade].push(task);
    });

    return grouped;
  }, [tasks, selectedTrade]);

  // Format helpers
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    const isToday = taskDate.getTime() === today.getTime();

    return {
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
      shortWeekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      monthDay: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isToday
    };
  };

  const tradeConfig = {
    plumbing: { color: '#3b82f6', bgLight: '#eff6ff', abbr: 'PL', name: 'Plumbing' },
    piping: { color: '#10b981', bgLight: '#f0fdf4', abbr: 'PF', name: 'Pipefitter' },
    sheet_metal: { color: '#f59e0b', bgLight: '#fffbeb', abbr: 'SM', name: 'Sheet Metal' }
  };

  // Get day stats
  const getDayStats = (date: string) => {
    const dayData = tasksByDateAndTrade[date];
    if (!dayData) return { completed: 0, total: 0, hours: 0 };

    let completed = 0;
    let total = 0;
    let hours = 0;

    Object.values(dayData).forEach(tradeTasks => {
      total += tradeTasks.length;
      completed += tradeTasks.filter(t => t.status === 'complete').length;
      hours += tradeTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
    });

    return { completed, total, hours };
  };

  // Get trade stats for a specific day
  const getTradeStatsForDay = (date: string, trade: 'plumbing' | 'piping' | 'sheet_metal') => {
    const dayData = tasksByDateAndTrade[date];
    if (!dayData) return { hours: 0, tasks: 0 };

    const tradeTasks = dayData[trade] || [];
    const hours = tradeTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);

    return { hours, tasks: tradeTasks.length };
  };

  // Get daily actual for a specific date and trade
  const getDailyActual = (date: string, trade: 'plumbing' | 'piping' | 'sheet_metal') => {
    if (!dailyActuals) return null;
    return dailyActuals.find(a => a.work_date.split('T')[0] === date && a.trade === trade);
  };

  // Handle saving daily actuals
  const handleSaveDailyActual = (date: string, trade: 'plumbing' | 'piping' | 'sheet_metal', crewSize: number, hoursWorked: number) => {
    if (!currentPlan) return;

    saveDailyActualsMutation.mutate({
      planId: currentPlan.id,
      data: {
        work_date: date + 'T12:00:00.000Z',
        trade,
        actual_crew_size: crewSize,
        actual_hours_worked: hoursWorked
      }
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header - Sticky */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'white',
        borderBottom: '2px solid #e2e8f0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ padding: '12px 16px' }}>
          <Link to={`/projects/${projectId}`} style={{
            textDecoration: 'none',
            color: '#3b82f6',
            fontSize: '14px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginBottom: '8px'
          }}>
            ← {project?.name}
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '600' }}>
              📋 Weekly Goals
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Plan Settings Button */}
              {currentPlan && (
                <button
                  onClick={() => setShowPlanSettings(true)}
                  style={{
                    backgroundColor: '#64748b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ⚙️ Plan Settings
                </button>
              )}

              {/* Week Navigation */}
              <button
                onClick={() => navigateWeek('prev')}
                style={{
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                ←
              </button>

              <div style={{ textAlign: 'center', minWidth: '200px' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>
                  {new Date(selectedWeekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              <button
                onClick={() => navigateWeek('next')}
                style={{
                  background: 'white',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '18px',
                  cursor: 'pointer'
                }}
              >
                →
              </button>
            </div>
          </div>

          {/* Trade Filter Pills */}
          <div style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
            {(['all', 'plumbing', 'piping', 'sheet_metal'] as const).map(trade => {
              const config = trade === 'all' ? null : tradeConfig[trade];
              return (
                <button
                  key={trade}
                  onClick={() => setSelectedTrade(trade)}
                  style={{
                    backgroundColor: selectedTrade === trade ? (config?.color || '#64748b') : 'white',
                    color: selectedTrade === trade ? 'white' : '#64748b',
                    border: selectedTrade === trade ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {trade === 'all' ? 'All Trades' : `${config?.abbr} - ${config?.name}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary Bar */}
        {summary && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1px',
            backgroundColor: '#e2e8f0',
            borderTop: '1px solid #e2e8f0'
          }}>
            {[
              { label: 'Hours', value: `${summary.total.actual_hours}/${summary.total.planned_hours}` },
              { label: 'Progress', value: `${summary.total.percent_complete}%` },
              { label: 'Variance', value: summary.total.variance >= 0 ? `+${summary.total.variance}h` : `${summary.total.variance}h` }
            ].map((stat, idx) => (
              <div key={idx} style={{
                backgroundColor: 'white',
                padding: '10px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content - Horizontal Columns */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
        {!currentPlan ? (
          // No Plan State
          <div style={{
            textAlign: 'center',
            padding: '60px 24px',
            margin: '40px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '40px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                No Plan for This Week
              </h3>
              <p style={{ margin: '0 0 24px 0', color: '#64748b', fontSize: '14px' }}>
                Create a weekly plan to start tracking daily goals
              </p>
              <button
                onClick={handleCreateWeeklyPlan}
                disabled={createPlanMutation.isPending}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                }}
              >
                {createPlanMutation.isPending ? 'Creating...' : 'Create Weekly Plan'}
              </button>
            </div>
          </div>
        ) : (
          // Horizontal Day Columns
          <div style={{
            display: 'flex',
            gap: '12px',
            padding: '12px',
            minHeight: 'calc(100vh - 200px)',
            alignItems: 'stretch'
          }}>
            {weekDates.map((date) => {
              const dateInfo = formatDate(date);
              const stats = getDayStats(date);
              const dayData = tasksByDateAndTrade[date];
              const isDayExpanded = expandedDayActuals === date;

              return (
                <div
                  key={date}
                  style={{
                    minWidth: '320px',
                    width: '320px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                    border: dateInfo.isToday ? '3px solid #3b82f6' : '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: 'calc(100vh - 220px)'
                  }}
                >
                  {/* Day Header */}
                  <div style={{
                    padding: '12px',
                    backgroundColor: dateInfo.isToday ? '#eff6ff' : '#f8fafc',
                    borderBottom: '2px solid #e2e8f0',
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px'
                  }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: dateInfo.isToday ? '#3b82f6' : '#1e293b',
                      marginBottom: '4px'
                    }}>
                      {dateInfo.shortWeekday}
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b',
                      marginBottom: '8px'
                    }}>
                      {dateInfo.monthDay}
                    </div>
                    {stats.total > 0 && (
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: stats.completed === stats.total ? '#10b981' : '#64748b',
                        marginBottom: '4px'
                      }}>
                        {stats.completed}/{stats.total} tasks • {stats.hours}h
                      </div>
                    )}

                    {/* Daily Actuals Toggle */}
                    <button
                      onClick={() => setExpandedDayActuals(isDayExpanded ? null : date)}
                      style={{
                        width: '100%',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#475569',
                        cursor: 'pointer',
                        marginTop: '6px'
                      }}
                    >
                      {isDayExpanded ? '▼' : '▶'} Daily Actuals
                    </button>

                    {/* Expanded Daily Actuals - Manual Entry */}
                    {isDayExpanded && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px',
                        backgroundColor: 'white',
                        borderRadius: '6px',
                        fontSize: '11px'
                      }}>
                        {(['plumbing', 'piping', 'sheet_metal'] as const).map(trade => {
                          // Filter by selected trade
                          if (selectedTrade !== 'all' && selectedTrade !== trade) {
                            return null;
                          }

                          const config = tradeConfig[trade];
                          const plannedCrew = currentPlan?.[`${trade}_crew_size` as keyof WeeklyGoalPlan] || 0;
                          const plannedHours = currentPlan?.[`${trade}_hours_per_day` as keyof WeeklyGoalPlan] || 0;
                          const actualData = getDailyActual(date, trade);

                          return (
                            <div key={trade} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                              <div style={{ fontWeight: '700', color: config.color, marginBottom: '4px', fontSize: '12px' }}>
                                {config.abbr} - {config.name}
                              </div>
                              <div style={{ color: '#64748b', fontSize: '10px', marginBottom: '6px' }}>
                                Planned: {plannedCrew} crew × {plannedHours}h/day
                              </div>

                              {/* Manual Entry Fields */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '4px', alignItems: 'end' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '9px', color: '#64748b', marginBottom: '2px' }}>
                                    Actual Crew
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    defaultValue={actualData?.actual_crew_size || 0}
                                    onBlur={(e) => {
                                      const hoursInput = e.currentTarget.parentElement?.nextElementSibling?.querySelector('input') as HTMLInputElement;
                                      handleSaveDailyActual(
                                        date,
                                        trade,
                                        Number(e.target.value),
                                        hoursInput ? Number(hoursInput.value) : (actualData?.actual_hours_worked || 0)
                                      );
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '4px 6px',
                                      fontSize: '12px',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      fontWeight: '600'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', fontSize: '9px', color: '#64748b', marginBottom: '2px' }}>
                                    Actual Hrs/Shift
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    defaultValue={actualData?.actual_hours_worked || 0}
                                    onBlur={(e) => {
                                      const crewInput = e.currentTarget.parentElement?.previousElementSibling?.querySelector('input') as HTMLInputElement;
                                      handleSaveDailyActual(
                                        date,
                                        trade,
                                        crewInput ? Number(crewInput.value) : (actualData?.actual_crew_size || 0),
                                        Number(e.target.value)
                                      );
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '4px 6px',
                                      fontSize: '12px',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      fontWeight: '600'
                                    }}
                                  />
                                </div>

                                {actualData && (
                                  <div style={{
                                    fontSize: '16px',
                                    color: '#10b981',
                                    fontWeight: '700',
                                    paddingBottom: '4px'
                                  }}>
                                    ✓
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Submit Daily Report Button */}
                    {stats.total > 0 && (
                      <button
                        onClick={() => handleSubmitDailyReport(date)}
                        style={{
                          width: '100%',
                          backgroundColor: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          marginTop: '8px'
                        }}
                      >
                        📋 Submit Daily Report
                      </button>
                    )}
                  </div>

                  {/* Trade Sections - Scrollable */}
                  <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '8px'
                  }}>
                    {(['plumbing', 'piping', 'sheet_metal'] as const).map(trade => {
                      const config = tradeConfig[trade];
                      const tradeTasks = dayData?.[trade] || [];

                      if (selectedTrade !== 'all' && selectedTrade !== trade) {
                        return null;
                      }

                      return (
                        <div key={trade} style={{ marginBottom: '10px' }}>
                          {/* Trade Header */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px',
                            backgroundColor: config.bgLight,
                            borderRadius: '8px',
                            border: `2px solid ${config.color}`,
                            marginBottom: '6px'
                          }}>
                            <div style={{
                              fontSize: '12px',
                              fontWeight: '700',
                              color: config.color,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <span style={{
                                backgroundColor: config.color,
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '800'
                              }}>
                                {config.abbr}
                              </span>
                              {tradeTasks.length > 0 && (
                                <span>
                                  {tradeTasks.filter(t => t.status === 'complete').length}/{tradeTasks.length}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setQuickAddDate(date);
                                setQuickAddTrade(trade);
                                setShowQuickAdd(true);
                              }}
                              style={{
                                backgroundColor: config.color,
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                width: '24px',
                                height: '24px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '700'
                              }}
                            >
                              +
                            </button>
                          </div>

                          {/* Tasks */}
                          {tradeTasks.map(task => (
                            <div
                              key={task.id}
                              style={{
                                backgroundColor: task.status === 'complete' ? '#f0fdf4' : 'white',
                                border: `1px solid ${task.status === 'complete' ? '#86efac' : '#e2e8f0'}`,
                                borderRadius: '6px',
                                padding: '6px',
                                marginBottom: '4px',
                                cursor: 'pointer',
                                transition: 'box-shadow 0.2s',
                                position: 'relative'
                              }}
                              onClick={() => setEditingTask(task)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              {/* Content */}
                              <div>
                                <div style={{
                                  fontSize: '13px',
                                  color: '#1e293b',
                                  marginBottom: '4px',
                                  lineHeight: '1.3',
                                  textDecoration: task.status === 'complete' ? 'line-through' : 'none',
                                  opacity: task.status === 'complete' ? 0.7 : 1,
                                  wordWrap: 'break-word',
                                  fontWeight: '500'
                                }}>
                                  {task.description}
                                </div>

                                <div style={{
                                  fontSize: '10px',
                                  color: '#64748b',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '4px',
                                  marginBottom: task.status === 'incomplete' && task.incomplete_reason ? '4px' : '0'
                                }}>
                                  {task.quantity && (
                                    <span>📦 {task.quantity}{task.unit}</span>
                                  )}
                                  <span>⏱️ {task.actual_hours}h</span>
                                </div>

                                {/* Show incomplete reason if exists */}
                                {task.status === 'incomplete' && task.incomplete_reason && (
                                  <div style={{
                                    padding: '3px 6px',
                                    backgroundColor: '#fee2e2',
                                    borderRadius: '3px',
                                    fontSize: '9px',
                                    color: '#dc2626',
                                    fontWeight: '600',
                                    lineHeight: '1.3',
                                    marginBottom: '4px'
                                  }}>
                                    ⚠️ {task.incomplete_reason.replace('_', ' ').toUpperCase()}
                                    {task.incomplete_notes && (
                                      <div style={{ fontWeight: '400', marginTop: '2px', fontStyle: 'italic' }}>
                                        {task.incomplete_notes}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Status Buttons - Bottom */}
                                {task.status === 'complete' ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIncompleteTaskId(task.id);
                                      setShowIncompleteReason(true);
                                    }}
                                    style={{
                                      width: '100%',
                                      backgroundColor: '#10b981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      lineHeight: '1.2',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }}
                                  >
                                    ✓ Complete
                                  </button>
                                ) : task.incomplete_reason === 'rescheduled' ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    style={{
                                      width: '100%',
                                      backgroundColor: '#f59e0b',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      lineHeight: '1.2',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }}
                                  >
                                    📅 Rescheduled
                                  </button>
                                ) : task.incomplete_reason ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateTaskStatusMutation.mutate({
                                        taskId: task.id,
                                        status: 'complete'
                                      });
                                    }}
                                    style={{
                                      width: '100%',
                                      backgroundColor: '#dc2626',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      lineHeight: '1.2',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }}
                                  >
                                    ✗ Incomplete
                                  </button>
                                ) : (
                                  <div style={{
                                    display: 'flex',
                                    gap: '4px',
                                    justifyContent: 'center'
                                  }}>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateTaskStatusMutation.mutate({
                                          taskId: task.id,
                                          status: 'complete'
                                        });
                                      }}
                                      style={{
                                        flex: 1,
                                        backgroundColor: 'white',
                                        color: '#10b981',
                                        border: '2px solid #10b981',
                                        borderRadius: '6px',
                                        padding: '6px 14px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        lineHeight: '1.2'
                                      }}
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setIncompleteTaskId(task.id);
                                        setShowIncompleteReason(true);
                                      }}
                                      style={{
                                        flex: 1,
                                        backgroundColor: 'white',
                                        color: '#dc2626',
                                        border: '2px solid #dc2626',
                                        borderRadius: '6px',
                                        padding: '6px 14px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        lineHeight: '1.2'
                                      }}
                                    >
                                      ✗
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Plan Settings Modal */}
      {showPlanSettings && currentPlan && (
        <div
          onClick={() => setShowPlanSettings(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px'
            }}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: '22px', fontWeight: '600' }}>
              Weekly Plan Settings
            </h2>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              updatePlanMutation.mutate({
                id: currentPlan.id,
                data: {
                  plumbing_foreman: formData.get('plumbingForeman') as string,
                  plumbing_crew_size: Number(formData.get('plumbingCrewSize')) || 0,
                  plumbing_hours_per_day: Number(formData.get('plumbingHoursPerDay')) || 0,
                  plumbing_days_worked: Number(formData.get('plumbingDaysWorked')) || 0,
                  piping_foreman: formData.get('pipingForeman') as string,
                  piping_crew_size: Number(formData.get('pipingCrewSize')) || 0,
                  piping_hours_per_day: Number(formData.get('pipingHoursPerDay')) || 0,
                  piping_days_worked: Number(formData.get('pipingDaysWorked')) || 0,
                  sheet_metal_foreman: formData.get('sheetMetalForeman') as string,
                  sheet_metal_crew_size: Number(formData.get('sheetMetalCrewSize')) || 0,
                  sheet_metal_hours_per_day: Number(formData.get('sheetMetalHoursPerDay')) || 0,
                  sheet_metal_days_worked: Number(formData.get('sheetMetalDaysWorked')) || 0,
                }
              });
            }}>
              {/* Trade Settings */}
              {(['plumbing', 'piping', 'sheet_metal'] as const).map(trade => {
                const config = tradeConfig[trade];
                const tradeKey = trade as 'plumbing' | 'piping' | 'sheet_metal';

                return (
                  <div key={trade} style={{
                    marginBottom: '24px',
                    padding: '16px',
                    backgroundColor: config.bgLight,
                    borderRadius: '12px',
                    border: `2px solid ${config.color}`
                  }}>
                    <h3 style={{
                      margin: '0 0 16px 0',
                      fontSize: '16px',
                      fontWeight: '700',
                      color: config.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{
                        backgroundColor: config.color,
                        color: 'white',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        {config.abbr}
                      </span>
                      {config.name}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                          Foreman Name
                        </label>
                        <input
                          type="text"
                          name={`${tradeKey}Foreman`}
                          defaultValue={currentPlan[`${trade}_foreman` as keyof WeeklyGoalPlan] as string || ''}
                          placeholder="Enter foreman name"
                          style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '14px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                          Planned Crew Size
                        </label>
                        <input
                          type="number"
                          name={`${tradeKey}CrewSize`}
                          defaultValue={currentPlan[`${trade}_crew_size` as keyof WeeklyGoalPlan] as number || 0}
                          min="0"
                          style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '14px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                          Hours per Day
                        </label>
                        <input
                          type="number"
                          name={`${tradeKey}HoursPerDay`}
                          defaultValue={currentPlan[`${trade}_hours_per_day` as keyof WeeklyGoalPlan] as number || 0}
                          min="0"
                          step="0.5"
                          style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '14px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                          Days Worked (this week)
                        </label>
                        <input
                          type="number"
                          name={`${tradeKey}DaysWorked`}
                          defaultValue={currentPlan[`${trade}_days_worked` as keyof WeeklyGoalPlan] as number || 0}
                          min="0"
                          max="6"
                          style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '14px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowPlanSettings(false)}
                  style={{
                    flex: '1',
                    backgroundColor: 'white',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatePlanMutation.isPending}
                  style={{
                    flex: '2',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {updatePlanMutation.isPending ? 'Saving...' : 'Save Plan Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incomplete Reason Modal */}
      {showIncompleteReason && incompleteTaskId && (
        <div
          onClick={() => {
            setShowIncompleteReason(false);
            setIncompleteTaskId(null);
            setIncompleteReason('');
            setRescheduleDate('');
      setShouldReschedule(false);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '450px',
              padding: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600', color: '#dc2626' }}>
              Task Not Complete
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
              Please select a reason why this task wasn't completed
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              console.log('=== FORM SUBMIT STARTED ===');
              console.log('shouldReschedule state:', shouldReschedule);
              console.log('rescheduleDate state:', rescheduleDate);

              const formData = new FormData(e.currentTarget);
              const reason = formData.get('reason') as string;
              const notes = formData.get('notes') as string;
              const newDate = formData.get('rescheduleDate') as string;

              console.log('Form data captured:', {
                reason,
                notes,
                newDate,
                incompleteTaskId,
                currentPlanId: currentPlan?.id
              });

              if (!incompleteTaskId || !currentPlan) {
                console.log('ERROR: Missing task or plan information');
                alert('Error: Missing task or plan information');
                return;
              }

              if (!reason) {
                console.log('ERROR: No reason selected');
                alert('Please select a reason');
                return;
              }

              if (!notes || notes.trim() === '') {
                console.log('ERROR: No notes provided');
                alert('Please provide additional notes explaining why this task was not completed');
                return;
              }

              console.log('Validation passed, entering try block');

              try {
                let targetPlan: any = null;

                // If rescheduling, create duplicate first
                if (newDate) {
                  const task = tasks?.find(t => t.id === incompleteTaskId);
                  if (!task) {
                    alert('Error: Task not found');
                    return;
                  }

                  // Find the Monday of the target week
                  const targetDate = new Date(newDate + 'T00:00:00');
                  const targetDay = targetDate.getDay();
                  const targetMonday = new Date(targetDate);
                  targetMonday.setDate(targetDate.getDate() - (targetDay === 0 ? 6 : targetDay - 1));
                  const targetWeekStart = targetMonday.toISOString().split('T')[0];

                  // Check if rescheduling within the same week as current plan
                  const currentWeekStart = currentPlan?.week_start_date.split('T')[0];
                  if (currentWeekStart === targetWeekStart) {
                    // Rescheduling within same week - use current plan
                    targetPlan = currentPlan;
                  } else {
                    // Find or create the plan for the target week
                    targetPlan = plans?.find(p => p.week_start_date.split('T')[0] === targetWeekStart);
                  }

                  if (!targetPlan) {
                    // Create a new plan for the target week
                    const targetFriday = new Date(targetMonday);
                    targetFriday.setDate(targetMonday.getDate() + 5);
                    const targetWeekEnd = targetFriday.toISOString().split('T')[0];

                    const planData: any = {
                      projectId: Number(projectId),
                      weekStartDate: targetWeekStart,
                      weekEndDate: targetWeekEnd,
                      includeSunday: false,
                      status: 'active'
                    };
                    const newPlan = await weeklyGoalPlansApi.create(planData).then(res => res.data);

                    targetPlan = newPlan;
                    queryClient.invalidateQueries({ queryKey: ['weeklyGoalPlans', projectId] });
                  }

                  // Create duplicate task on new date
                  console.log('Creating duplicate task:', {
                    planId: targetPlan.id,
                    trade: task.trade,
                    taskDate: newDate,
                  });

                  const taskData: any = {
                    trade: task.trade,
                    taskDate: newDate + 'T12:00:00.000Z',
                    description: task.description,
                    quantity: task.quantity,
                    unit: task.unit,
                    actualHours: task.actual_hours,
                    status: 'incomplete'
                  };

                  await createTaskMutation.mutateAsync({
                    planId: targetPlan.id,
                    data: taskData
                  });
                }

                // Mark original as incomplete
                // If rescheduling, use 'rescheduled' as reason and include original reason in notes
                // If not rescheduling, use the selected reason
                const finalReason = newDate ? 'rescheduled' : (reason || null);
                const noteText = newDate
                  ? `Rescheduled to ${newDate}. Reason: ${reason}${notes ? '. ' + notes : ''}`
                  : (notes || null);

                console.log('Updating task status:', {
                  taskId: incompleteTaskId,
                  status: 'incomplete',
                  reason: finalReason,
                  noteText
                });

                await weeklyGoalPlansApi.updateTaskStatus(
                  incompleteTaskId,
                  'incomplete',
                  finalReason,
                  noteText
                );

                // Manually trigger refresh and close modal
                queryClient.invalidateQueries({ queryKey: ['weeklyGoalPlans', projectId] });
                if (currentPlan) {
                  queryClient.invalidateQueries({ queryKey: ['weeklyGoalTasks', currentPlan.id] });
                  queryClient.invalidateQueries({ queryKey: ['weeklyGoalSummary', currentPlan.id] });
                }
                if (targetPlan) {
                  queryClient.invalidateQueries({ queryKey: ['weeklyGoalTasks', targetPlan.id] });
                  queryClient.invalidateQueries({ queryKey: ['weeklyGoalSummary', targetPlan.id] });
                }
                setShowIncompleteReason(false);
                setIncompleteTaskId(null);
                setIncompleteReason('');
                setRescheduleDate('');
      setShouldReschedule(false);
              } catch (error: any) {
                console.error('=== TASK UPDATE ERROR ===');
                console.error('Error object:', error);
                console.error('Error response:', error?.response);
                console.error('Error response data:', error?.response?.data);
                console.error('Error message:', error?.message);
                const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
                alert(`Error updating task: ${errorMsg}`);
              }
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                  Reason *
                </label>
                <select
                  name="reason"
                  required
                  autoFocus
                  value={incompleteReason}
                  onChange={(e) => setIncompleteReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Select a reason...</option>
                  <option value="weather">Weather Delay</option>
                  <option value="materials">Material Delay/Shortage</option>
                  <option value="equipment">Equipment Issue</option>
                  <option value="labor">Labor Shortage/No Show</option>
                  <option value="gc_delay">GC/Owner Delay</option>
                  <option value="other_trade">Other Trade Delay</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Reschedule checkbox - separate from reason */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shouldReschedule}
                    onChange={(e) => {
                      setShouldReschedule(e.target.checked);
                      if (!e.target.checked) {
                        setRescheduleDate('');
      setShouldReschedule(false);
                      }
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>
                    Also reschedule to another day?
                  </span>
                </label>
              </div>

              {/* Show date picker if reschedule checked */}
              {shouldReschedule && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                    Reschedule to Date *
                  </label>
                  <input
                    type="date"
                    name="rescheduleDate"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '15px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                  Additional Notes *
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  required
                  placeholder="Add any additional details..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowIncompleteReason(false);
                    setIncompleteTaskId(null);
                    setIncompleteReason('');
                    setRescheduleDate('');
      setShouldReschedule(false);
                  }}
                  style={{
                    flex: '1',
                    backgroundColor: 'white',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateTaskStatusMutation.isPending}
                  style={{
                    flex: '2',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(220, 38, 38, 0.3)'
                  }}
                >
                  {updateTaskStatusMutation.isPending ? 'Saving...' : 'Mark Incomplete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && currentPlan && (
        <div
          onClick={() => setEditingTask(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '600' }}>
              Edit Task
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
              Update task details
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              const updateData: any = {
                description: formData.get('description') as string,
                quantity: formData.get('quantity') ? Number(formData.get('quantity')) : null,
                unit: formData.get('unit') as string || null,
                actualHours: Number(formData.get('actualHours')) || 0,
              };

              // Include incomplete info if task is incomplete
              if (editingTask.status === 'incomplete') {
                const incompleteReason = formData.get('incompleteReason') as string;
                const incompleteNotes = formData.get('incompleteNotes') as string;
                updateData.incompleteReason = incompleteReason || null;
                updateData.incompleteNotes = incompleteNotes || null;
              }

              updateTaskMutation.mutate({
                taskId: editingTask.id,
                data: updateData
              });
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                  Task Description *
                </label>
                <textarea
                  name="description"
                  required
                  rows={3}
                  defaultValue={editingTask.description}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    step="1"
                    defaultValue={editingTask.quantity || ''}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '15px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    name="unit"
                    defaultValue={editingTask.unit || ''}
                    placeholder="ft, ea"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '15px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                  Estimated Hours
                </label>
                <input
                  type="number"
                  name="actualHours"
                  step="0.5"
                  defaultValue={editingTask.actual_hours || 0}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px'
                  }}
                />
              </div>

              {/* Incomplete Information */}
              {editingTask.status === 'incomplete' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                      Incomplete Reason
                    </label>
                    <select
                      name="incompleteReason"
                      defaultValue={editingTask.incomplete_reason || ''}
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '15px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="">None (Task is planned)</option>
                      <option value="weather">Weather Delay</option>
                      <option value="materials">Material Delay/Shortage</option>
                      <option value="equipment">Equipment Issue</option>
                      <option value="labor">Labor Shortage/No Show</option>
                      <option value="gc_delay">GC/Owner Delay</option>
                      <option value="other_trade">Other Trade Delay</option>
                      <option value="rescheduled">Rescheduled</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                      Incomplete Notes
                    </label>
                    <textarea
                      name="incompleteNotes"
                      rows={2}
                      defaultValue={editingTask.incomplete_notes || ''}
                      placeholder="Add details about why incomplete..."
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '15px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  style={{
                    flex: '1',
                    backgroundColor: 'white',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateTaskMutation.isPending}
                  style={{
                    flex: '2',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  {updateTaskMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>

            {/* Status Actions */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              {/* Reset to Planned Button - only show if task has incomplete reason or is complete */}
              {(editingTask.status === 'complete' || editingTask.incomplete_reason) && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset this task to planned status? This will clear any completion or incomplete reasons.')) {
                      updateTaskStatusMutation.mutate({
                        taskId: editingTask.id,
                        status: 'incomplete',
                        incompleteReason: null as any,
                        incompleteNotes: null as any
                      });
                      setEditingTask(null);
                    }
                  }}
                  style={{
                    width: '100%',
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: '8px'
                  }}
                >
                  ↺ Reset to Planned (Clear Status)
                </button>
              )}

              {/* Delete Task Button */}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
                    deleteTaskMutation.mutate(editingTask.id);
                    setEditingTask(null);
                  }
                }}
                style={{
                  width: '100%',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🗑️ Delete Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Task Modal */}
      {showQuickAdd && currentPlan && (
        <div
          onClick={() => setShowQuickAdd(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            <h2 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '600' }}>
              Add Task
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{formatDate(quickAddDate).weekday}, {formatDate(quickAddDate).monthDay}</span>
              <span style={{
                backgroundColor: tradeConfig[quickAddTrade].color,
                color: 'white',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '700'
              }}>
                {tradeConfig[quickAddTrade].abbr}
              </span>
              <span>{tradeConfig[quickAddTrade].name}</span>
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);

              // Format date with time to avoid timezone issues
              const taskDateWithTime = quickAddDate + 'T12:00:00.000Z';

              createTaskMutation.mutate({
                planId: currentPlan.id,
                data: {
                  trade: quickAddTrade,
                  taskDate: taskDateWithTime,
                  description: formData.get('description') as string,
                  quantity: formData.get('quantity') ? Number(formData.get('quantity')) : undefined,
                  unit: formData.get('unit') as string || undefined,
                  actualHours: Number(formData.get('actualHours')) || 0,
                }
              });
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                  Task Description *
                </label>
                <textarea
                  name="description"
                  required
                  rows={3}
                  placeholder="What needs to be done?"
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    step="1"
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '15px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    name="unit"
                    placeholder="ft, ea"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '15px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                  Estimated Hours
                </label>
                <input
                  type="number"
                  name="actualHours"
                  step="0.5"
                  defaultValue="0"
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '15px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  style={{
                    flex: '1',
                    backgroundColor: 'white',
                    color: '#64748b',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTaskMutation.isPending}
                  style={{
                    flex: '2',
                    backgroundColor: tradeConfig[quickAddTrade].color,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: `0 2px 4px ${tradeConfig[quickAddTrade].color}40`
                  }}
                >
                  {createTaskMutation.isPending ? 'Adding...' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Report Preview Modal */}
      {showReportPreview && (
        <div
          onClick={() => setShowReportPreview(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '24px',
              borderBottom: '2px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                📋 Daily Report Preview
              </h2>
              <button
                onClick={() => setShowReportPreview(false)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '28px',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                ×
              </button>
            </div>

            {/* Report Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '32px',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '13px',
                lineHeight: '1.8',
                color: '#1e293b',
                whiteSpace: 'pre-wrap',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}>
                {reportContent}
              </div>
            </div>

            {/* Footer with Actions */}
            <div style={{
              padding: '20px 24px',
              borderTop: '2px solid #e2e8f0',
              display: 'flex',
              gap: '12px',
              backgroundColor: '#f8fafc'
            }}>
              <button
                onClick={() => setShowReportPreview(false)}
                style={{
                  flex: '1',
                  backgroundColor: 'white',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(reportContent).then(() => {
                    alert('✓ Report copied to clipboard!\n\nYou can now paste it into an email or document.');
                    setShowReportPreview(false);
                  });
                }}
                style={{
                  flex: '2',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                }}
              >
                📋 Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectWeeklyGoals;
