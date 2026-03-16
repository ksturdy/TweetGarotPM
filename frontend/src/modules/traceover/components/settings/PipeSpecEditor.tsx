import { useState } from 'react';
import type { PipeSpec } from '../../types/pipingSystem';
import GeneralTab from './GeneralTab';
import PipeRatesTab from './PipeRatesTab';
import FittingRatesTab from './FittingRatesTab';
import ReducingRatesTab from './ReducingRatesTab';
import ReducingTeeRatesTab from './ReducingTeeRatesTab';

type SubTab = 'general' | 'pipe' | 'fittings' | 'reducing' | 'tees';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'general', label: 'General' },
  { key: 'pipe', label: 'Pipe Rates' },
  { key: 'fittings', label: 'Fittings' },
  { key: 'reducing', label: 'Reducing' },
  { key: 'tees', label: 'Tees & Cross' },
];

interface PipeSpecEditorProps {
  spec: PipeSpec;
  onUpdate: (updates: Partial<PipeSpec>) => void;
}

export default function PipeSpecEditor({ spec, onUpdate }: PipeSpecEditorProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('general');

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1f3450', flexShrink: 0 }}>
        {SUB_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 500,
                color: isActive ? '#d4e3f3' : '#4a6a88',
                borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                background: 'none',
                border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: isActive ? '#3b82f6' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {activeTab === 'general' && <GeneralTab spec={spec} onUpdate={onUpdate} />}
        {activeTab === 'pipe' && <PipeRatesTab spec={spec} onUpdate={onUpdate} />}
        {activeTab === 'fittings' && <FittingRatesTab spec={spec} onUpdate={onUpdate} />}
        {activeTab === 'reducing' && <ReducingRatesTab spec={spec} onUpdate={onUpdate} />}
        {activeTab === 'tees' && <ReducingTeeRatesTab spec={spec} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}
