import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FolderIcon from '@mui/icons-material/Folder';
import CalculateIcon from '@mui/icons-material/Calculate';
import PeopleIcon from '@mui/icons-material/People';
import BadgeIcon from '@mui/icons-material/Badge';
import SettingsIcon from '@mui/icons-material/Settings';
import SecurityIcon from '@mui/icons-material/Security';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CampaignIcon from '@mui/icons-material/Campaign';
import BusinessIcon from '@mui/icons-material/Business';
import ContactsIcon from '@mui/icons-material/Contacts';
import GroupsIcon from '@mui/icons-material/Groups';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import GavelIcon from '@mui/icons-material/Gavel';
import SyncIcon from '@mui/icons-material/Sync';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import './Sidebar.css';

interface NavItem {
  label: string;
  path?: string;
  icon: React.ReactNode;
  children?: { label: string; path: string }[];
  adminOnly?: boolean;
  hrOnly?: boolean;
}

const STORAGE_KEY = 'sidebar-expanded-sections';
const DEFAULT_EXPANDED = ['Sales', 'Estimating', 'Accounts'];

const getInitialExpandedSections = (): string[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_EXPANDED;
    }
  }
  return DEFAULT_EXPANDED;
};

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<string[]>(getInitialExpandedSections);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Persist expanded sections to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedSections));
  }, [expandedSections]);

  const isAdmin = user?.role === 'admin';
  const hasHRAccess = user?.role === 'admin' || (user?.hrAccess && user.hrAccess !== 'none');

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      path: '/',
      icon: <DashboardIcon />,
    },
    {
      label: 'Sales',
      icon: <TrendingUpIcon />,
      children: [
        { label: 'Pipeline', path: '/sales' },
        { label: 'Campaigns', path: '/campaigns' },
        { label: 'Marketing', path: '/marketing' },
      ],
    },
    {
      label: 'Estimating',
      icon: <CalculateIcon />,
      children: [
        { label: 'Estimates', path: '/estimating' },
        { label: 'Budgets', path: '/estimating/budgets' },
        { label: 'Cost Database', path: '/estimating/cost-database' },
      ],
    },
    {
      label: 'Accounts',
      icon: <PeopleIcon />,
      children: [
        { label: 'Overview', path: '/account-management' },
        { label: 'Customers', path: '/account-management/customers' },
        { label: 'Contacts', path: '/account-management/contacts' },
        { label: 'Vendors', path: '/account-management/vendors' },
        { label: 'Teams', path: '/account-management/teams' },
      ],
    },
    {
      label: 'Projects',
      path: '/projects',
      icon: <FolderIcon />,
    },
    {
      label: 'Safety',
      path: '/safety',
      icon: <HealthAndSafetyIcon />,
    },
    {
      label: 'Risk Management',
      path: '/risk-management',
      icon: <GavelIcon />,
    },
  ];

  const adminItems: NavItem[] = [
    {
      label: 'Administration',
      path: '/administration',
      icon: <BusinessIcon />,
      adminOnly: true,
    },
    {
      label: 'HR',
      icon: <BadgeIcon />,
      hrOnly: true,
      children: [
        { label: 'Dashboard', path: '/hr' },
        { label: 'Employees', path: '/hr/employees' },
        { label: 'Departments', path: '/hr/departments' },
        { label: 'Locations', path: '/hr/locations' },
      ],
    },
    {
      label: 'Users',
      path: '/users',
      icon: <GroupsIcon />,
      adminOnly: true,
    },
    {
      label: 'Security',
      path: '/security',
      icon: <SecurityIcon />,
      adminOnly: true,
    },
    {
      label: 'Settings',
      icon: <SettingsIcon />,
      adminOnly: true,
      children: [
        { label: 'General', path: '/settings' },
        { label: 'Vista Data', path: '/settings/vista-data' },
      ],
    },
  ];

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  };

  const isPathActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    // Exact match or the path is a proper prefix (followed by /)
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Check if a child path is active, considering sibling paths
  // Only returns true if this path is the BEST match among siblings
  const isChildPathActive = (path: string, siblingPaths: string[]) => {
    if (path === '/') {
      return location.pathname === '/';
    }

    // Check if this path matches
    const matches = location.pathname === path || location.pathname.startsWith(path + '/');
    if (!matches) return false;

    // Check if any sibling has a more specific (longer) match
    const hasMoreSpecificSibling = siblingPaths.some((siblingPath) => {
      if (siblingPath === path) return false; // Skip self
      // Check if sibling is a more specific match (longer path that also matches)
      return (
        siblingPath.length > path.length &&
        siblingPath.startsWith(path) &&
        (location.pathname === siblingPath || location.pathname.startsWith(siblingPath + '/'))
      );
    });

    return !hasMoreSpecificSibling;
  };

  const isSectionActive = (item: NavItem) => {
    if (item.path) {
      return isPathActive(item.path);
    }
    const childPaths = item.children?.map((c) => c.path) || [];
    return item.children?.some((child) => isChildPathActive(child.path, childPaths)) || false;
  };

  const renderNavItem = (item: NavItem) => {
    if (item.adminOnly && !isAdmin) return null;
    if (item.hrOnly && !hasHRAccess) return null;

    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedSections.includes(item.label);
    const isActive = isSectionActive(item);
    const childPaths = item.children?.map((c) => c.path) || [];

    if (hasChildren) {
      return (
        <div key={item.label} className="nav-section">
          <button
            className={`nav-item nav-item-expandable ${isActive ? 'active' : ''}`}
            onClick={() => toggleSection(item.label)}
            title={isCollapsed ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!isCollapsed && (
              <>
                <span className="nav-label">{item.label}</span>
                <span className="nav-expand-icon">
                  {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </span>
              </>
            )}
          </button>
          {!isCollapsed && isExpanded && (
            <div className="nav-children">
              {item.children?.map((child) => (
                <Link
                  key={child.path}
                  to={child.path}
                  className={`nav-child-item ${isChildPathActive(child.path, childPaths) ? 'active' : ''}`}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.label}
        to={item.path || '/'}
        className={`nav-item ${isActive ? 'active' : ''}`}
        title={isCollapsed ? item.label : undefined}
      >
        <span className="nav-icon">{item.icon}</span>
        {!isCollapsed && <span className="nav-label">{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-content">
        <nav className="sidebar-nav">
          {navItems.map(renderNavItem)}
        </nav>

        {(isAdmin || hasHRAccess) && (
          <>
            <div className="sidebar-divider"></div>
            <nav className="sidebar-nav sidebar-nav-admin">
              {adminItems.map(renderNavItem)}
            </nav>
          </>
        )}
      </div>

      <button
        className="sidebar-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
      </button>
    </aside>
  );
};

export default Sidebar;
