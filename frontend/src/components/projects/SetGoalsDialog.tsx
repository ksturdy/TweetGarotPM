import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectGoalsApi, ProjectGoals, ProjectGoalsInput } from '../../services/projectGoals';

interface SetGoalsDialogProps {
  projectId: number;
  currentGoals: ProjectGoals | null;
  onClose: () => void;
}

const SetGoalsDialog: React.FC<SetGoalsDialogProps> = ({ projectId, currentGoals, onClose }) => {
  const queryClient = useQueryClient();

  // Form values are displayed as whole numbers (15 = 15%), stored as decimals (0.15)
  const [cashFlowPct, setCashFlowPct] = useState('');
  const [marginPct, setMarginPct] = useState('');
  const [shopHoursPct, setShopHoursPct] = useState('');
  const [laborRate, setLaborRate] = useState('');

  useEffect(() => {
    if (currentGoals) {
      setCashFlowPct(currentGoals.cash_flow_goal_pct != null ? (currentGoals.cash_flow_goal_pct * 100).toString() : '');
      setMarginPct(currentGoals.margin_goal_pct != null ? (currentGoals.margin_goal_pct * 100).toString() : '');
      setShopHoursPct(currentGoals.shop_hours_goal_pct != null ? (currentGoals.shop_hours_goal_pct * 100).toString() : '');
      setLaborRate(currentGoals.labor_rate_goal != null ? currentGoals.labor_rate_goal.toString() : '');
    }
  }, [currentGoals]);

  const saveMutation = useMutation({
    mutationFn: (data: ProjectGoalsInput) => projectGoalsApi.save(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-goals', projectId.toString()] });
      onClose();
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => projectGoalsApi.clear(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-goals', projectId.toString()] });
      onClose();
    },
  });

  const handleSave = () => {
    const data: ProjectGoalsInput = {
      cash_flow_goal_pct: cashFlowPct ? parseFloat(cashFlowPct) / 100 : null,
      margin_goal_pct: marginPct ? parseFloat(marginPct) / 100 : null,
      shop_hours_goal_pct: shopHoursPct ? parseFloat(shopHoursPct) / 100 : null,
      labor_rate_goal: laborRate ? parseFloat(laborRate) : null,
    };
    saveMutation.mutate(data);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.6rem',
    fontSize: '0.85rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    background: '#fff',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: '0.3rem',
    display: 'block',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '28px 32px',
          maxWidth: 480,
          width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1f2937' }}>
            Set Project Goals
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: '1.25rem',
              color: '#9ca3af', cursor: 'pointer', padding: '0 0.25rem',
            }}
          >
            &times;
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 0, marginBottom: '1rem' }}>
          Set target values for this project. KPI cards will show green/yellow/red based on performance vs. these goals.
        </p>

        {/* Form grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Cash Flow Goal (%)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="0.1"
                value={cashFlowPct}
                onChange={(e) => setCashFlowPct(e.target.value)}
                placeholder="e.g. 5"
                style={inputStyle}
              />
              <span style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#9ca3af' }}>
                % of CV
              </span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Margin Goal (%)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="0.1"
                value={marginPct}
                onChange={(e) => setMarginPct(e.target.value)}
                placeholder="e.g. 15"
                style={inputStyle}
              />
              <span style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#9ca3af' }}>
                %
              </span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Shop Hours Goal (%)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="1"
                value={shopHoursPct}
                onChange={(e) => setShopHoursPct(e.target.value)}
                placeholder="e.g. 30"
                style={inputStyle}
              />
              <span style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#9ca3af' }}>
                % shop
              </span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Labor Rate Goal</label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                step="0.01"
                value={laborRate}
                onChange={(e) => setLaborRate(e.target.value)}
                placeholder="e.g. 55.00"
                style={inputStyle}
              />
              <span style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#9ca3af' }}>
                $/hr
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
          <button
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || !currentGoals}
            style={{
              background: 'none', border: '1px solid #e5e7eb',
              padding: '0.4rem 0.85rem', borderRadius: '6px',
              fontSize: '0.8rem', color: '#ef4444', cursor: 'pointer',
              opacity: currentGoals ? 1 : 0.4,
            }}
          >
            Clear All
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: '1px solid #e5e7eb',
                padding: '0.4rem 0.85rem', borderRadius: '6px',
                fontSize: '0.8rem', color: '#374151', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #7c3aed)',
                border: 'none', padding: '0.4rem 1rem', borderRadius: '6px',
                fontSize: '0.8rem', color: '#fff', cursor: 'pointer', fontWeight: 600,
              }}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Goals'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetGoalsDialog;
