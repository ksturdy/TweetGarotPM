import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ConstructionIcon from '@mui/icons-material/Construction';
import DescriptionIcon from '@mui/icons-material/Description';
import DateRangeIcon from '@mui/icons-material/DateRange';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FolderIcon from '@mui/icons-material/Folder';
import './ProjectModuleSidebar.css';

interface ModuleGroup {
  label: string;
  icon: React.ReactNode;
  modules: { path: string; label: string }[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    label: 'Pre-Construction',
    icon: <AssignmentTurnedInIcon />,
    modules: [
      { path: 'pre-job-checklist', label: 'Pre-Job Checklist' },
      { path: 'companies', label: 'Companies' },
      { path: 'specifications', label: 'Specifications' },
      { path: 'drawings', label: 'Drawings' },
    ],
  },
  {
    label: 'Field',
    icon: <ConstructionIcon />,
    modules: [
      { path: 'daily-reports', label: 'Daily Reports' },
      { path: 'issues', label: 'Field Issues' },
      { path: 'photos', label: 'Photos' },
      { path: 'weekly-goals', label: 'Weekly Goal Plans' },
    ],
  },
  {
    label: 'Documents',
    icon: <DescriptionIcon />,
    modules: [
      { path: 'rfis', label: 'RFIs' },
      { path: 'submittals', label: 'Submittals' },
      { path: 'change-orders', label: 'Change Orders' },
    ],
  },
  {
    label: 'Schedule',
    icon: <DateRangeIcon />,
    modules: [
      { path: 'schedule', label: 'Schedule' },
      { path: 'gc-schedule', label: 'GC Schedule' },
    ],
  },
  {
    label: 'Cost & Finance',
    icon: <AccountBalanceIcon />,
    modules: [
      { path: 'financials', label: 'Financials' },
      { path: 'cost-model', label: 'Cost Model' },
      { path: 'stratus', label: 'Stratus' },
    ],
  },
];

const EXPANDED_KEY = 'project-modules-expanded';

const getInitialExpanded = (): string[] => {
  const stored = localStorage.getItem(EXPANDED_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fall through */ }
  }
  return MODULE_GROUPS.map(g => g.label);
};

interface Props {
  projectId: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const ProjectModuleSidebar: React.FC<Props> = ({ projectId, isCollapsed, onToggleCollapse }) => {
  const location = useLocation();

  const [expandedGroups, setExpandedGroups] = useState<string[]>(getInitialExpanded);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const [flyoutRight, setFlyoutRight] = useState(0);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label];
      localStorage.setItem(EXPANDED_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleGroupMouseEnter = useCallback((label: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyoutTop(rect.top);
    setFlyoutRight(window.innerWidth - rect.left + 8);
    setHoveredGroup(label);
  }, []);

  const handleGroupMouseLeave = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setHoveredGroup(null), 80);
  }, []);

  const handleFlyoutMouseEnter = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }, []);

  const handleFlyoutMouseLeave = useCallback(() => {
    setHoveredGroup(null);
  }, []);

  // Close flyout on navigation
  useEffect(() => {
    setHoveredGroup(null);
  }, [location.pathname]);

  const isModuleActive = useCallback((modulePath: string) => {
    const base = `/projects/${projectId}/${modulePath}`;
    return location.pathname === base || location.pathname.startsWith(base + '/');
  }, [projectId, location.pathname]);

  const isGroupActive = useCallback((group: ModuleGroup) =>
    group.modules.some(m => isModuleActive(m.path)),
  [isModuleActive]);

  const isOverviewActive = location.pathname === `/projects/${projectId}`;

  return (
    <aside className={`project-module-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Overview link at the top */}
      <div className="project-module-sidebar-header">
        {isCollapsed ? (
          <Link
            to={`/projects/${projectId}`}
            className={`project-module-overview-icon ${isOverviewActive ? 'active' : ''}`}
            title="Project Overview"
          >
            <span className="project-module-icon"><FolderIcon /></span>
          </Link>
        ) : (
          <Link
            to={`/projects/${projectId}`}
            className={`project-module-overview-link ${isOverviewActive ? 'active' : ''}`}
          >
            <span className="project-module-icon"><FolderIcon /></span>
            <span>Overview</span>
          </Link>
        )}
      </div>

      {/* Scrollable group nav */}
      <div className="project-module-sidebar-content">
        <nav className="project-module-nav">
          {MODULE_GROUPS.map(group => {
            const active = isGroupActive(group);
            const expanded = expandedGroups.includes(group.label);

            if (isCollapsed) {
              return (
                <button
                  key={group.label}
                  className={`project-module-item ${active ? 'active' : ''}`}
                  title={group.label}
                  onMouseEnter={(e) => handleGroupMouseEnter(group.label, e)}
                  onMouseLeave={handleGroupMouseLeave}
                >
                  <span className="project-module-icon">{group.icon}</span>
                </button>
              );
            }

            return (
              <div key={group.label} className="project-module-section">
                <button
                  className={`project-module-item ${active ? 'active' : ''}`}
                  onClick={() => toggleGroup(group.label)}
                >
                  <span className="project-module-icon">{group.icon}</span>
                  <span className="project-module-label">{group.label}</span>
                  <span className="project-module-expand-icon">
                    {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </span>
                </button>
                {expanded && (
                  <div className="project-module-children">
                    {group.modules.map(mod => (
                      <Link
                        key={mod.path}
                        to={`/projects/${projectId}/${mod.path}`}
                        className={`project-module-child-item ${isModuleActive(mod.path) ? 'active' : ''}`}
                      >
                        {mod.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Collapse toggle */}
      <button className="project-module-toggle" onClick={onToggleCollapse} title={isCollapsed ? 'Expand modules' : 'Collapse modules'}>
        {isCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </button>

      {/* Flyout — collapsed mode only */}
      {isCollapsed && hoveredGroup && (() => {
        const group = MODULE_GROUPS.find(g => g.label === hoveredGroup);
        if (!group) return null;
        return (
          <div
            className="project-modules-flyout"
            style={{ top: flyoutTop, right: flyoutRight }}
            onMouseEnter={handleFlyoutMouseEnter}
            onMouseLeave={handleFlyoutMouseLeave}
          >
            <div className="project-modules-flyout-header">
              <span className="project-modules-flyout-header-icon">{group.icon}</span>
              {group.label}
            </div>
            <div className="project-modules-flyout-items">
              {group.modules.map(mod => (
                <Link
                  key={mod.path}
                  to={`/projects/${projectId}/${mod.path}`}
                  className={`project-modules-flyout-item ${isModuleActive(mod.path) ? 'active' : ''}`}
                  onClick={() => setHoveredGroup(null)}
                >
                  {mod.label}
                </Link>
              ))}
            </div>
          </div>
        );
      })()}
    </aside>
  );
};

export default ProjectModuleSidebar;
