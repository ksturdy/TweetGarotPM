import React, { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import BusinessIcon from '@mui/icons-material/Business';
import { DashboardLayout, ViewScope, WidgetLayoutItem } from './types';
import { widgetRegistry } from './widgetRegistry';
import './CustomizeDashboardDrawer.css';

interface Props {
  open: boolean;
  layout: DashboardLayout;
  defaultViewScope: ViewScope | null;
  onClose: () => void;
  onSave: (layout: DashboardLayout, defaultViewScope: ViewScope | null) => void;
  onReset: () => void;
  isSaving?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  overview: 'Overview',
  sales: 'Sales',
  projects: 'Projects',
  marketing: 'Marketing',
  field: 'Field',
};

const reorderColumn = (layout: DashboardLayout): DashboardLayout => {
  const grouped: Record<string, WidgetLayoutItem[]> = {};
  layout.forEach(item => {
    if (!grouped[item.column]) grouped[item.column] = [];
    grouped[item.column].push(item);
  });
  const reindexed: DashboardLayout = [];
  Object.keys(grouped).forEach(col => {
    grouped[col]
      .sort((a, b) => a.order - b.order)
      .forEach((item, idx) => reindexed.push({ ...item, order: idx }));
  });
  return reindexed;
};

const CustomizeDashboardDrawer: React.FC<Props> = ({
  open, layout, defaultViewScope, onClose, onSave, onReset, isSaving,
}) => {
  const [draft, setDraft] = useState<DashboardLayout>(layout);
  const [scopeDraft, setScopeDraft] = useState<ViewScope>(defaultViewScope || 'my');

  useEffect(() => {
    if (open) {
      setDraft(layout);
      setScopeDraft(defaultViewScope || 'my');
    }
  }, [open, layout, defaultViewScope]);

  if (!open) return null;

  const findItem = (id: string) => draft.find(i => i.id === id);

  const toggleVisible = (id: string) => {
    const def = widgetRegistry[id];
    if (def?.locked) return;
    setDraft(prev => prev.map(item =>
      item.id === id ? { ...item, visible: !item.visible } : item
    ));
  };

  const handleSave = () => {
    onSave(reorderColumn(draft), scopeDraft);
  };

  const handleReset = () => {
    onReset();
    onClose();
  };

  const allWidgets = Object.values(widgetRegistry);
  const widgetsByCategory = allWidgets.reduce<Record<string, typeof allWidgets>>((acc, w) => {
    if (!acc[w.category]) acc[w.category] = [];
    acc[w.category].push(w);
    return acc;
  }, {});

  return (
    <>
      <div className="customize-drawer-backdrop" onClick={onClose} />
      <aside className="customize-drawer">
        <div className="customize-drawer-header">
          <h2>Customize Dashboard</h2>
          <button className="customize-drawer-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="customize-drawer-body">
          <section className="customize-section">
            <h3>Default View</h3>
            <p className="customize-section-hint">Which scope the dashboard opens to.</p>
            <div className="customize-scope-toggle">
              <button
                type="button"
                className={`customize-scope-btn ${scopeDraft === 'my' ? 'active' : ''}`}
                onClick={() => setScopeDraft('my')}
              >
                <PersonIcon fontSize="small" />
                <span>My Work</span>
              </button>
              <button
                type="button"
                className={`customize-scope-btn ${scopeDraft === 'team' ? 'active' : ''}`}
                onClick={() => setScopeDraft('team')}
              >
                <GroupsIcon fontSize="small" />
                <span>My Team</span>
              </button>
              <button
                type="button"
                className={`customize-scope-btn ${scopeDraft === 'company' ? 'active' : ''}`}
                onClick={() => setScopeDraft('company')}
              >
                <BusinessIcon fontSize="small" />
                <span>Company</span>
              </button>
            </div>
          </section>

          <section className="customize-section">
            <h3>Widgets</h3>
            <p className="customize-section-hint">Toggle widgets on or off. Drag to reorder on the dashboard.</p>
            {Object.entries(widgetsByCategory).map(([category, widgets]) => (
              <div key={category} className="customize-category">
                <h4>{CATEGORY_LABELS[category] || category}</h4>
                <ul className="customize-widget-list">
                  {widgets.map(def => {
                    const item = findItem(def.id);
                    const checked = item?.visible ?? false;
                    return (
                      <li key={def.id} className={`customize-widget-row ${def.locked ? 'locked' : ''}`}>
                        <label>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={def.locked}
                            onChange={() => toggleVisible(def.id)}
                          />
                          <span>{def.title}</span>
                          {def.locked && <LockIcon className="locked-icon" fontSize="small" />}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        </div>

        <div className="customize-drawer-footer">
          <button className="customize-drawer-reset" onClick={handleReset} type="button">
            Reset to default
          </button>
          <div className="customize-drawer-actions">
            <button className="customize-drawer-cancel" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="customize-drawer-save"
              onClick={handleSave}
              type="button"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default CustomizeDashboardDrawer;
