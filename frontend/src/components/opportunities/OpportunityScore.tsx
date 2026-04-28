import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import opportunitiesService, { OpportunityScoreData, OpportunityScoreInput } from '../../services/opportunities';
import { useAuth } from '../../context/AuthContext';

interface OpportunityScoreProps {
  opportunityId?: number;
  stageName: string;
  /** When true, skips API calls and reports form data via onScoreChange */
  localMode?: boolean;
  onScoreChange?: (data: OpportunityScoreInput) => void;
  /** When true, renders in compact sidebar layout */
  compact?: boolean;
}

// Factor definitions matching the TITAN Pursuit Pipeline guideline
const FACTORS = [
  { key: 'customer_relationship', label: 'Customer Relationship', desc: 'Repeat client, warmth of relationship, history with us', weight: 3, gate: 1 },
  { key: 'scope_fit', label: 'Scope Fit', desc: 'Match to our crews, prefab, and division capabilities', weight: 3, gate: 1 },
  { key: 'delivery_method', label: 'Delivery Method', desc: 'Negotiated & design-assist score higher than hard bid', weight: 2, gate: 1 },
  { key: 'strategic_value', label: 'Strategic Value', desc: 'Target sector, key GC, geographic anchor', weight: 2, gate: 1 },
  { key: 'schedule_fit', label: 'Schedule Fit', desc: 'Backlog capacity and crew availability when work hits', weight: 2, gate: 2 },
  { key: 'margin_profile', label: 'Margin Profile', desc: 'Expected gross profit vs. risk profile', weight: 2, gate: 2 },
  { key: 'win_probability_score', label: 'Win Probability', desc: 'Honest read on competition and our positioning', weight: 2, gate: 2 },
] as const;

const DEALBREAKERS = [
  { key: 'db_payment_dispute', label: 'Owner or GC with prior payment dispute' },
  { key: 'db_liquidated_damages', label: 'Liquidated damages above 1% of contract per day' },
  { key: 'db_schedule_conflict', label: 'Required schedule shorter than crew availability' },
  { key: 'db_scope_outside', label: 'Scope outside our division capabilities' },
  { key: 'db_margin_below_floor', label: 'Margin profile below division floor' },
  { key: 'db_bonding_unmet', label: 'Bonding or insurance requirements unmet' },
] as const;

type FactorKey = typeof FACTORS[number]['key'];
type DealbreakKey = typeof DEALBREAKERS[number]['key'];

interface ScoreFormState {
  customer_relationship: number | null;
  scope_fit: number | null;
  delivery_method: number | null;
  strategic_value: number | null;
  schedule_fit: number | null;
  margin_profile: number | null;
  win_probability_score: number | null;
  db_payment_dispute: boolean;
  db_liquidated_damages: boolean;
  db_schedule_conflict: boolean;
  db_scope_outside: boolean;
  db_margin_below_floor: boolean;
  db_bonding_unmet: boolean;
  has_override: boolean;
  override_reason: string;
  notes: string;
}

const EMPTY_FORM: ScoreFormState = {
  customer_relationship: null,
  scope_fit: null,
  delivery_method: null,
  strategic_value: null,
  schedule_fit: null,
  margin_profile: null,
  win_probability_score: null,
  db_payment_dispute: false,
  db_liquidated_damages: false,
  db_schedule_conflict: false,
  db_scope_outside: false,
  db_margin_below_floor: false,
  db_bonding_unmet: false,
  has_override: false,
  override_reason: '',
  notes: '',
};

function getGateForStage(stageName: string): 1 | 2 | null {
  const name = stageName.toLowerCase();
  if (name.includes('lead')) return 1;
  if (name.includes('opportunity') || name.includes('quoted') || name.includes('qualified') || name.includes('proposal') || name.includes('negotiation')) return 2;
  return null; // Awarded, Won, Lost, Passed → read-only
}

function computeTotal(gate: 1 | 2, form: ScoreFormState) {
  const factors = gate === 1
    ? FACTORS.filter(f => f.gate === 1)
    : FACTORS;
  let total = 0;
  let maxPossible = 0;
  let scoredCount = 0;
  for (const f of factors) {
    maxPossible += 5 * f.weight;
    const val = form[f.key as FactorKey] as number | null;
    if (val != null) {
      total += val * f.weight;
      scoredCount++;
    }
  }
  return { total, maxPossible, scoredCount, factorCount: factors.length };
}

function getRecommendation(gate: 1 | 2, total: number, form: ScoreFormState): string {
  const anyDealbreaker = DEALBREAKERS.some(d => form[d.key as DealbreakKey]);
  if (anyDealbreaker && !form.has_override) return 'no_go';
  if (anyDealbreaker && form.has_override) return 'vp_override';

  if (gate === 1) {
    if (total >= 35) return 'advance';
    if (total >= 25) return 'review_required';
    return 'no_go';
  } else {
    if (total >= 55) return 'go';
    if (total >= 40) return 'review_required';
    return 'no_go';
  }
}

const REC_LABELS: Record<string, { label: string; cls: string }> = {
  advance: { label: 'ADVANCE', cls: 'advance' },
  go: { label: 'GO', cls: 'go' },
  review_required: { label: 'VP REVIEW REQUIRED', cls: 'review' },
  no_go: { label: 'NO-GO', cls: 'no-go' },
  vp_override: { label: 'VP OVERRIDE', cls: 'vp-override' },
};

function formFromScore(score: OpportunityScoreData): ScoreFormState {
  return {
    customer_relationship: score.customer_relationship,
    scope_fit: score.scope_fit,
    delivery_method: score.delivery_method,
    strategic_value: score.strategic_value,
    schedule_fit: score.schedule_fit,
    margin_profile: score.margin_profile,
    win_probability_score: score.win_probability_score,
    db_payment_dispute: score.db_payment_dispute,
    db_liquidated_damages: score.db_liquidated_damages,
    db_schedule_conflict: score.db_schedule_conflict,
    db_scope_outside: score.db_scope_outside,
    db_margin_below_floor: score.db_margin_below_floor,
    db_bonding_unmet: score.db_bonding_unmet,
    has_override: score.has_override,
    override_reason: score.override_reason || '',
    notes: score.notes || '',
  };
}

const OpportunityScore: React.FC<OpportunityScoreProps> = ({ opportunityId, stageName, localMode, onScoreChange, compact }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<ScoreFormState>(EMPTY_FORM);
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const stageGate = getGateForStage(stageName);
  const gate: 1 | 2 = stageGate || 2; // Default to gate 2 if stage unknown
  const readOnly = !localMode && stageGate === null;

  // Fetch latest score (skip in local mode)
  const { data: latestScore, isLoading } = useQuery({
    queryKey: ['opportunity-score-latest', opportunityId],
    queryFn: () => opportunitiesService.getLatestScore(opportunityId!),
    staleTime: 30000,
    enabled: !!opportunityId && !localMode,
  });

  // Fetch history (only when panel open, skip in local mode)
  const { data: history = [] } = useQuery({
    queryKey: ['opportunity-scores', opportunityId],
    queryFn: () => opportunitiesService.getScores(opportunityId!),
    enabled: showHistory && !!opportunityId && !localMode,
    staleTime: 30000,
  });

  // Initialize form from latest score
  useEffect(() => {
    if (localMode) return;
    if (latestScore) {
      setForm(formFromScore(latestScore));
      setEditingId(latestScore.id);
    } else {
      setForm(EMPTY_FORM);
      setEditingId(null);
    }
  }, [latestScore, localMode]);

  // Report form changes to parent in local mode
  useEffect(() => {
    if (localMode && onScoreChange) {
      onScoreChange({
        gate,
        customer_relationship: form.customer_relationship,
        scope_fit: form.scope_fit,
        delivery_method: form.delivery_method,
        strategic_value: form.strategic_value,
        schedule_fit: gate === 2 ? form.schedule_fit : null,
        margin_profile: gate === 2 ? form.margin_profile : null,
        win_probability_score: gate === 2 ? form.win_probability_score : null,
        db_payment_dispute: form.db_payment_dispute,
        db_liquidated_damages: form.db_liquidated_damages,
        db_schedule_conflict: form.db_schedule_conflict,
        db_scope_outside: form.db_scope_outside,
        db_margin_below_floor: form.db_margin_below_floor,
        db_bonding_unmet: form.db_bonding_unmet,
        has_override: form.has_override,
        override_reason: form.override_reason || undefined,
        notes: form.notes || undefined,
      });
    }
  }, [form, gate, localMode, onScoreChange]);

  // Mutations (only used in non-local mode)
  const createMutation = useMutation({
    mutationFn: (data: OpportunityScoreInput) =>
      opportunitiesService.createScore(opportunityId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-score-latest', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-scores', opportunityId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ scoreId, data }: { scoreId: number; data: OpportunityScoreInput }) =>
      opportunitiesService.updateScore(opportunityId!, scoreId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-score-latest', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-scores', opportunityId] });
    },
  });

  const saving = createMutation.isPending || updateMutation.isPending;

  // Computed values
  const { total, maxPossible, scoredCount, factorCount } = useMemo(
    () => computeTotal(gate, form),
    [gate, form]
  );
  const recommendation = useMemo(
    () => getRecommendation(gate, total, form),
    [gate, total, form]
  );
  const anyDealbreaker = DEALBREAKERS.some(d => form[d.key as DealbreakKey]);
  const barPct = maxPossible > 0 ? Math.round((total / maxPossible) * 100) : 0;

  // Thresholds for the bar
  const thresholds = gate === 1
    ? [{ value: 25, label: '25' }, { value: 35, label: '35' }]
    : [{ value: 40, label: '40' }, { value: 55, label: '55' }];
  const barColor = recommendation === 'no_go' ? 'red'
    : recommendation === 'review_required' || recommendation === 'vp_override' ? 'amber'
    : 'green';

  const setFactor = (key: FactorKey, value: number | null) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const setDealbreaker = (key: DealbreakKey, value: boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const payload: OpportunityScoreInput = {
      gate,
      customer_relationship: form.customer_relationship,
      scope_fit: form.scope_fit,
      delivery_method: form.delivery_method,
      strategic_value: form.strategic_value,
      schedule_fit: gate === 2 ? form.schedule_fit : null,
      margin_profile: gate === 2 ? form.margin_profile : null,
      win_probability_score: gate === 2 ? form.win_probability_score : null,
      db_payment_dispute: form.db_payment_dispute,
      db_liquidated_damages: form.db_liquidated_damages,
      db_schedule_conflict: form.db_schedule_conflict,
      db_scope_outside: form.db_scope_outside,
      db_margin_below_floor: form.db_margin_below_floor,
      db_bonding_unmet: form.db_bonding_unmet,
      has_override: form.has_override,
      override_reason: form.override_reason || undefined,
      notes: form.notes || undefined,
    };

    // If editing an existing score by the same user, update it; otherwise create new
    if (editingId && latestScore && latestScore.scored_by === (user as any)?.id) {
      updateMutation.mutate({ scoreId: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleNewScore = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleLoadHistory = (score: OpportunityScoreData) => {
    setForm(formFromScore(score));
    setEditingId(score.id);
    setShowHistory(false);
  };

  if (!localMode && isLoading) {
    return <div className={`opp-score${compact ? ' opp-score--compact' : ''}`}><div className="opp-score-loading">Loading scorecard...</div></div>;
  }

  const visibleFactors = FACTORS.filter(f => gate === 2 || f.gate === 1);
  const gate2Factors = FACTORS.filter(f => f.gate === 2);
  const recInfo = REC_LABELS[recommendation] || REC_LABELS.no_go;

  return (
    <div className={`opp-score${compact ? ' opp-score--compact' : ''}`}>
      {/* Header */}
      <div className="opp-score-hdr">
        <div className="opp-score-hdr-left">
          <span className="opp-score-title">GO / NO-GO SCORECARD</span>
          <span className={`opp-score-gate-badge gate-${gate}`}>
            Gate {gate}{gate === 1 ? ' · Lead → Opportunity' : ' · Opportunity → Quoted'}
          </span>
        </div>
        <div className="opp-score-hdr-right">
          <a
            href="/TITAN_Pursuit_Pipeline_GoNoGo_Guideline.pdf"
            download
            className="opp-score-download-btn"
            title="Download Go/No-Go Guideline PDF"
          >
            PDF Guideline
          </a>
          {!localMode && latestScore && !readOnly && (
            <button className="opp-score-new-btn" onClick={handleNewScore} title="Start a new score">
              + New Score
            </button>
          )}
          {!localMode && (
            <button
              className="opp-score-history-toggle"
              onClick={() => setShowHistory(prev => !prev)}
            >
              {showHistory ? 'Hide History' : 'History'}
            </button>
          )}
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="opp-score-history">
          {history.length === 0 ? (
            <div className="opp-score-history-empty">No previous scores.</div>
          ) : (
            history.map(s => (
              <div
                key={s.id}
                className={`opp-score-history-item ${s.id === editingId ? 'active' : ''}`}
                onClick={() => handleLoadHistory(s)}
              >
                <span className="opp-score-hist-date">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
                <span className="opp-score-hist-gate">Gate {s.gate}</span>
                <span className="opp-score-hist-total">{s.total_score}/{s.max_possible}</span>
                <span className={`opp-score-hist-rec ${REC_LABELS[s.recommendation]?.cls || ''}`}>
                  {REC_LABELS[s.recommendation]?.label || s.recommendation}
                </span>
                <span className="opp-score-hist-by">{s.scored_by_name}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Factor Scoring Table */}
      <table className="opp-score-tbl">
        <thead>
          <tr>
            <th>Factor</th>
            <th className="r">Wt</th>
            <th>Score</th>
            <th className="r">Points</th>
          </tr>
        </thead>
        <tbody>
          {FACTORS.map((f, idx) => {
            const isGate2 = f.gate === 2;
            const disabled = gate === 1 && isGate2;
            const val = form[f.key as FactorKey] as number | null;
            const pts = val != null ? val * f.weight : null;
            const showDivider = isGate2 && idx === 4; // first gate-2 factor

            return (
              <React.Fragment key={f.key}>
                {showDivider && (
                  <tr className="opp-score-divider-row">
                    <td colSpan={4}>
                      <div className="opp-score-divider">
                        {gate === 1 ? 'Scored at Gate 2 only' : 'Gate 2 Factors'}
                      </div>
                    </td>
                  </tr>
                )}
                <tr className={`opp-score-factor-row ${disabled ? 'disabled' : ''}`}>
                  <td className="opp-score-factor-name">
                    <span className="opp-score-factor-label">{f.label}</span>
                    <span className="opp-score-factor-desc">{f.desc}</span>
                  </td>
                  <td className="r opp-score-weight">×{f.weight}</td>
                  <td>
                    {disabled ? (
                      <span className="opp-score-tbd-label">—</span>
                    ) : (
                      <div className="opp-score-pills">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            type="button"
                            className={`opp-score-pill ${val === n ? 'selected' : ''}`}
                            onClick={() => !readOnly && setFactor(f.key as FactorKey, n)}
                            disabled={readOnly}
                          >
                            {n}
                          </button>
                        ))}
                        {val != null && !readOnly && (
                          <button
                            type="button"
                            className="opp-score-pill tbd"
                            onClick={() => setFactor(f.key as FactorKey, null)}
                            title="Clear (TBD)"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="r opp-score-pts">
                    {disabled ? '—' : pts != null ? pts : <span className="opp-score-tbd">TBD</span>}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
          {/* Total row */}
          <tr className="opp-score-total-row">
            <td><strong>Total</strong></td>
            <td></td>
            <td>
              <span className="opp-score-scored-count">
                {scoredCount}/{factorCount} scored
              </span>
            </td>
            <td className="r">
              <strong>{total}</strong> / {maxPossible}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Score Bar */}
      <div className="opp-score-bar-container">
        <div className="opp-score-bar">
          <div
            className={`opp-score-bar-fill ${barColor}`}
            style={{ width: `${barPct}%` }}
          />
          {thresholds.map(t => (
            <div
              key={t.value}
              className="opp-score-bar-marker"
              style={{ left: `${(t.value / maxPossible) * 100}%` }}
            >
              <span className="opp-score-bar-marker-label">{t.label}</span>
            </div>
          ))}
        </div>
        <div className="opp-score-bar-legend">
          {gate === 1 ? (
            <>
              <span className="legend-red">{'<25 No-Go'}</span>
              <span className="legend-amber">25-34 VP Review</span>
              <span className="legend-green">35+ Advance</span>
            </>
          ) : (
            <>
              <span className="legend-red">{'<40 No-Go'}</span>
              <span className="legend-amber">40-54 VP Review</span>
              <span className="legend-green">55+ Go</span>
            </>
          )}
        </div>
      </div>

      {/* Dealbreakers */}
      <div className={`opp-score-dealbreakers ${anyDealbreaker ? 'has-flag' : ''}`}>
        <div className="opp-score-db-title">DEALBREAKERS</div>
        <div className="opp-score-db-subtitle">Any checked = automatic No-Go (VP override required)</div>
        <div className="opp-score-db-list">
          {DEALBREAKERS.map(d => (
            <label key={d.key} className="opp-score-db-item">
              <input
                type="checkbox"
                checked={form[d.key as DealbreakKey] as boolean}
                onChange={e => !readOnly && setDealbreaker(d.key as DealbreakKey, e.target.checked)}
                disabled={readOnly}
              />
              <span>{d.label}</span>
            </label>
          ))}
        </div>
        {anyDealbreaker && (
          <div className="opp-score-override-section">
            <label className="opp-score-db-item">
              <input
                type="checkbox"
                checked={form.has_override}
                onChange={e => !readOnly && setForm(prev => ({ ...prev, has_override: e.target.checked }))}
                disabled={readOnly}
              />
              <span className="opp-score-override-label">VP Override — proceed despite dealbreaker(s)</span>
            </label>
            {form.has_override && (
              <textarea
                className="opp-score-override-reason"
                placeholder="Override justification (required)..."
                value={form.override_reason}
                onChange={e => setForm(prev => ({ ...prev, override_reason: e.target.value }))}
                disabled={readOnly}
              />
            )}
          </div>
        )}
      </div>

      {/* Recommendation Badge */}
      <div className="opp-score-rec">
        <span className={`opp-score-rec-badge ${recInfo.cls}`}>
          {recInfo.label}
        </span>
      </div>

      {/* Notes */}
      <div className="opp-score-notes-section">
        <label className="opp-score-notes-label">Notes</label>
        <textarea
          className="opp-score-notes"
          placeholder="Scoring rationale, key considerations..."
          value={form.notes}
          onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
          disabled={readOnly}
        />
      </div>

      {/* Actions (hidden in local mode — parent handles submit) */}
      {!localMode && !readOnly && (
        <div className="opp-score-actions">
          <button
            className="opp-score-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : editingId ? 'Update Score' : 'Save Score'}
          </button>
        </div>
      )}

      {!localMode && readOnly && latestScore && (
        <div className="opp-score-readonly-info">
          Last scored by {latestScore.scored_by_name} on{' '}
          {new Date(latestScore.created_at).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

export default OpportunityScore;
