import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listMatrices, createBlankMatrix, createMatrixFromBudget, getMatrixForBudget, CostControlMatrixSummary } from '../../services/costControl';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.round(Number(n)).toLocaleString();

export default function CostControlList() {
  const navigate = useNavigate();
  const { toast } = useTitanFeedback();
  const [matrices, setMatrices] = useState<CostControlMatrixSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await listMatrices();
      setMatrices(data);
    } catch {
      toast.error('Failed to load matrices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const handleCreateBlank = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const target = newTarget ? parseFloat(newTarget.replace(/[$,]/g, '')) : undefined;
      const { matrixId } = await createBlankMatrix(newName.trim(), target);
      navigate(`/estimating/cost-control/${matrixId}`);
    } catch {
      toast.error('Failed to create matrix');
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: '12px 20px', background: 'var(--bg-dark)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <Link to="/estimating" style={{ color: 'var(--accent-blue)', fontSize: 12, textDecoration: 'none' }}>← Estimating</Link>
          <h1 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Cost Control Matrices</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/estimating/budgets" className="btn btn-secondary" style={{ fontSize: 13 }}>
            Start from AI Budget
          </Link>
          <button className="btn btn-primary" onClick={() => setShowNew(!showNew)} style={{ fontSize: 13 }}>
            + New Blank Matrix
          </button>
        </div>
      </div>

      {/* New blank matrix inline form */}
      {showNew && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            Matrix Name *
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Riverside Hospital HVAC"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 13, padding: '4px 8px', minWidth: 240 }}
              onKeyDown={e => e.key === 'Enter' && handleCreateBlank()}
            />
          </label>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            Target Cost (optional)
            <input
              value={newTarget}
              onChange={e => setNewTarget(e.target.value)}
              placeholder="$0"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 13, padding: '4px 8px', minWidth: 130 }}
            />
          </label>
          <button className="btn btn-primary" onClick={handleCreateBlank} disabled={creating || !newName.trim()} style={{ fontSize: 13 }}>
            {creating ? 'Creating…' : 'Create'}
          </button>
          <button className="btn btn-secondary" onClick={() => setShowNew(false)} style={{ fontSize: 13 }}>Cancel</button>
        </div>
      )}

      {/* Explainer */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 16px', marginBottom: 14, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        A <strong style={{ color: 'var(--text-primary)' }}>Cost Control Matrix</strong> tracks your budget through multiple design milestones — from early conceptual through 100% construction documents and into execution.
        You can start with a <strong style={{ color: 'var(--text-primary)' }}>blank matrix</strong> and fill it in manually, or start from an <strong style={{ color: 'var(--text-primary)' }}>AI-generated budget</strong> which pre-populates Version 1 automatically.
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>Loading…</div>
      ) : matrices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p style={{ marginBottom: 12 }}>No cost control matrices yet.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Blank Matrix</button>
            <Link to="/estimating/budgets" className="btn btn-secondary">Start from AI Budget</Link>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '8px 16px', color: 'var(--text-muted)', fontWeight: 600 }}>Name</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Source</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Target Cost</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Versions</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Last Updated</th>
                <th style={{ padding: '8px 12px' }} />
              </tr>
            </thead>
            <tbody>
              {matrices.map(m => (
                <tr
                  key={m.id}
                  style={{ borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                  onClick={() => navigate(`/estimating/cost-control/${m.id}`)}
                >
                  <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 600 }}>{m.name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                    {m.budget_name
                      ? <span>AI Budget: <span style={{ color: 'var(--text-primary)' }}>{m.budget_name}</span></span>
                      : m.project_name
                        ? <span>Project: <span style={{ color: 'var(--text-primary)' }}>{m.project_name}</span></span>
                        : <span style={{ fontStyle: 'italic' }}>Standalone</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(m.target_cost)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 12, padding: '2px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
                      {m.version_count} version{Number(m.version_count) !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(m.updated_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '3px 10px' }}
                      onClick={e => { e.stopPropagation(); navigate(`/estimating/cost-control/${m.id}`); }}
                    >
                      Open →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
