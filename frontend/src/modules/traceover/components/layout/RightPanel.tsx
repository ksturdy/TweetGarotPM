import { useCallback, useRef } from 'react';
import { useUiStore } from '../../stores/useUiStore';
import { TabList, Tab } from '../ui/Tabs';
import TakeoffTable from '../takeoff/TakeoffTable';
import BomTable from '../bom/BomTable';
import CostEstimateTable from '../cost/CostEstimateTable';

const TABS = [
  { key: 'takeoff' as const, label: 'Takeoff' },
  { key: 'bom' as const, label: 'BOM' },
  { key: 'cost' as const, label: 'Cost' },
];

export default function RightPanel() {
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const rightPanelTab = useUiStore((s) => s.rightPanelTab);
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab);
  const rightPanelWidth = useUiStore((s) => s.rightPanelWidth);
  const setRightPanelWidth = useUiStore((s) => s.setRightPanelWidth);

  const dragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;

      const startX = e.clientX;
      const startWidth = rightPanelWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!dragging.current) return;
        const delta = startX - moveEvent.clientX;
        setRightPanelWidth(startWidth + delta);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [rightPanelWidth, setRightPanelWidth],
  );

  if (!rightPanelOpen) return null;

  return (
    <aside
      style={{
        position: 'relative',
        display: 'flex',
        height: '100%',
        flexShrink: 0,
        flexDirection: 'column',
        borderLeft: '1px solid #1f3450',
        backgroundColor: '#0d1825',
        width: rightPanelWidth,
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 10,
          height: '100%',
          width: 6,
          cursor: 'col-resize',
          transition: 'background-color 0.15s',
        }}
      />

      <TabList>
        {TABS.map((tab) => (
          <Tab
            key={tab.key}
            label={tab.label}
            active={rightPanelTab === tab.key}
            onClick={() => setRightPanelTab(tab.key)}
          />
        ))}
      </TabList>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        {rightPanelTab === 'takeoff' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TakeoffTable />
          </div>
        )}
        {rightPanelTab === 'bom' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BomTable />
          </div>
        )}
        {rightPanelTab === 'cost' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CostEstimateTable />
          </div>
        )}
      </div>
    </aside>
  );
}
