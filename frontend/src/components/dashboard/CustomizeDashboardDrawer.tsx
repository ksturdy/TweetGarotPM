import React, { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import LockIcon from '@mui/icons-material/Lock';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { DashboardColumn, DashboardLayout, WidgetLayoutItem } from './types';
import { widgetRegistry } from './widgetRegistry';
import './CustomizeDashboardDrawer.css';

interface Props {
  open: boolean;
  layout: DashboardLayout;
  onClose: () => void;
  onSave: (layout: DashboardLayout) => void;
  onReset: () => void;
  isSaving?: boolean;
}

const COLUMN_LABELS: Record<DashboardColumn, string> = {
  kpi: 'KPI Row',
  left: 'Left Column',
  center: 'Center Column',
  right: 'Right Column',
};

const CATEGORY_LABELS: Record<string, string> = {
  overview: 'Overview',
  sales: 'Sales',
  projects: 'Projects',
  marketing: 'Marketing',
  field: 'Field',
};

const reorderColumn = (layout: DashboardLayout): DashboardLayout => {
  const grouped: Record<DashboardColumn, WidgetLayoutItem[]> = {
    kpi: [], left: [], center: [], right: [],
  };
  layout.forEach(item => grouped[item.column].push(item));
  const reindexed: DashboardLayout = [];
  (Object.keys(grouped) as DashboardColumn[]).forEach(col => {
    grouped[col]
      .sort((a, b) => a.order - b.order)
      .forEach((item, idx) => reindexed.push({ ...item, order: idx }));
  });
  return reindexed;
};

const CustomizeDashboardDrawer: React.FC<Props> = ({
  open, layout, onClose, onSave, onReset, isSaving,
}) => {
  const [draft, setDraft] = useState<DashboardLayout>(layout);

  useEffect(() => {
    if (open) setDraft(layout);
  }, [open, layout]);

  if (!open) return null;

  const findItem = (id: string) => draft.find(i => i.id === id);

  const toggleVisible = (id: string) => {
    const def = widgetRegistry[id];
    if (def?.locked) return;
    setDraft(prev => prev.map(item =>
      item.id === id ? { ...item, visible: !item.visible } : item
    ));
  };

  const moveColumn = (id: string, column: DashboardColumn) => {
    setDraft(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, column, order: 999 } : item
      );
      return reorderColumn(updated);
    });
  };

  const moveOrder = (id: string, direction: -1 | 1) => {
    setDraft(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const sameColumn = prev
        .filter(i => i.column === item.column)
        .sort((a, b) => a.order - b.order);
      const idx = sameColumn.findIndex(i => i.id === id);
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= sameColumn.length) return prev;

      const swap = sameColumn[swapIdx];
      const updated = prev.map(i => {
        if (i.id === item.id) return { ...i, order: swap.order };
        if (i.id === swap.id) return { ...i, order: item.order };
        return i;
      });
      return reorderColumn(updated);
    });
  };

  const handleSave = () => {
    onSave(reorderColumn(draft));
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

  const visibleByColumn = (Object.keys(COLUMN_LABELS) as DashboardColumn[]).reduce(
    (acc, col) => {
      acc[col] = draft
        .filter(i => i.column === col && i.visible)
        .sort((a, b) => a.order - b.order);
      return acc;
    },
    {} as Record<DashboardColumn, WidgetLayoutItem[]>
  );

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
            <h3>Available Widgets</h3>
            <p className="customize-section-hint">Toggle widgets on or off.</p>
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

          <section className="customize-section">
            <h3>Your Layout</h3>
            <p className="customize-section-hint">Move widgets between columns and reorder.</p>
            {(Object.keys(COLUMN_LABELS) as DashboardColumn[]).map(col => (
              <div key={col} className="customize-column">
                <h4>{COLUMN_LABELS[col]}</h4>
                {visibleByColumn[col].length === 0 ? (
                  <p className="customize-column-empty">No widgets</p>
                ) : (
                  <ul className="customize-layout-list">
                    {visibleByColumn[col].map((item, idx) => {
                      const def = widgetRegistry[item.id];
                      if (!def) return null;
                      return (
                        <li key={item.id} className="customize-layout-row">
                          <span className="customize-layout-title">{def.title}</span>
                          <div className="customize-layout-controls">
                            <button
                              type="button"
                              onClick={() => moveOrder(item.id, -1)}
                              disabled={idx === 0}
                              aria-label="Move up"
                            >
                              <ArrowUpwardIcon fontSize="small" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveOrder(item.id, 1)}
                              disabled={idx === visibleByColumn[col].length - 1}
                              aria-label="Move down"
                            >
                              <ArrowDownwardIcon fontSize="small" />
                            </button>
                            <select
                              value={item.column}
                              onChange={(e) => moveColumn(item.id, e.target.value as DashboardColumn)}
                              disabled={def.locked && def.defaultColumn !== item.column}
                            >
                              {(Object.keys(COLUMN_LABELS) as DashboardColumn[]).map(c => (
                                <option key={c} value={c}>{COLUMN_LABELS[c]}</option>
                              ))}
                            </select>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
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
