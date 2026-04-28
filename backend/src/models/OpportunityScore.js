const db = require('../config/database');

// Factor weights per the TITAN Pursuit Pipeline guideline
const WEIGHTS = {
  customer_relationship: 3,
  scope_fit: 3,
  delivery_method: 2,
  strategic_value: 2,
  schedule_fit: 2,
  margin_profile: 2,
  win_probability_score: 2,
};

const GATE1_FACTORS = ['customer_relationship', 'scope_fit', 'delivery_method', 'strategic_value'];
const GATE2_FACTORS = ['schedule_fit', 'margin_profile', 'win_probability_score'];
const ALL_FACTORS = [...GATE1_FACTORS, ...GATE2_FACTORS];

const DEALBREAKER_COLS = [
  'db_payment_dispute', 'db_liquidated_damages', 'db_schedule_conflict',
  'db_scope_outside', 'db_margin_below_floor', 'db_bonding_unmet'
];

function computeScore(gate, data) {
  const factors = gate === 1 ? GATE1_FACTORS : ALL_FACTORS;
  let total = 0;
  let maxPossible = 0;
  for (const f of factors) {
    maxPossible += 5 * WEIGHTS[f];
    if (data[f] != null) {
      total += data[f] * WEIGHTS[f];
    }
  }
  return { total, maxPossible };
}

function computeRecommendation(gate, totalScore, data, hasOverride) {
  const anyDealbreaker = DEALBREAKER_COLS.some(col => data[col]);
  if (anyDealbreaker && !hasOverride) return 'no_go';
  if (anyDealbreaker && hasOverride) return 'vp_override';

  if (gate === 1) {
    if (totalScore >= 35) return 'advance';
    if (totalScore >= 25) return 'review_required';
    return 'no_go';
  } else {
    if (totalScore >= 55) return 'go';
    if (totalScore >= 40) return 'review_required';
    return 'no_go';
  }
}

const OpportunityScore = {
  /**
   * Get all scores for an opportunity (newest first)
   */
  async findByOpportunityId(opportunityId, tenantId) {
    const result = await db.query(
      `SELECT os.*,
              u.first_name || ' ' || u.last_name AS scored_by_name
       FROM opportunity_scores os
       JOIN users u ON os.scored_by = u.id
       WHERE os.opportunity_id = $1 AND os.tenant_id = $2
       ORDER BY os.created_at DESC`,
      [opportunityId, tenantId]
    );
    return result.rows;
  },

  /**
   * Get the most recent score for an opportunity
   */
  async findLatest(opportunityId, tenantId) {
    const result = await db.query(
      `SELECT os.*,
              u.first_name || ' ' || u.last_name AS scored_by_name
       FROM opportunity_scores os
       JOIN users u ON os.scored_by = u.id
       WHERE os.opportunity_id = $1 AND os.tenant_id = $2
       ORDER BY os.created_at DESC
       LIMIT 1`,
      [opportunityId, tenantId]
    );
    return result.rows[0] || null;
  },

  /**
   * Create a new scoring event
   */
  async create(opportunityId, tenantId, data, userId) {
    const gate = data.gate;
    const { total, maxPossible } = computeScore(gate, data);
    const recommendation = computeRecommendation(gate, total, data, data.has_override);

    const result = await db.query(
      `INSERT INTO opportunity_scores (
        opportunity_id, tenant_id, gate,
        customer_relationship, scope_fit, delivery_method, strategic_value,
        schedule_fit, margin_profile, win_probability_score,
        total_score, max_possible,
        db_payment_dispute, db_liquidated_damages, db_schedule_conflict,
        db_scope_outside, db_margin_below_floor, db_bonding_unmet,
        has_override, override_reason, override_by,
        recommendation, notes, scored_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21,
        $22, $23, $24
      ) RETURNING *`,
      [
        opportunityId, tenantId, gate,
        data.customer_relationship ?? null,
        data.scope_fit ?? null,
        data.delivery_method ?? null,
        data.strategic_value ?? null,
        data.schedule_fit ?? null,
        data.margin_profile ?? null,
        data.win_probability_score ?? null,
        total, maxPossible,
        data.db_payment_dispute || false,
        data.db_liquidated_damages || false,
        data.db_schedule_conflict || false,
        data.db_scope_outside || false,
        data.db_margin_below_floor || false,
        data.db_bonding_unmet || false,
        data.has_override || false,
        data.override_reason || null,
        data.has_override ? (data.override_by || userId) : null,
        recommendation,
        data.notes || null,
        userId
      ]
    );
    return result.rows[0];
  },

  /**
   * Update an existing score
   */
  async update(scoreId, tenantId, data, userId) {
    const gate = data.gate;
    const { total, maxPossible } = computeScore(gate, data);
    const recommendation = computeRecommendation(gate, total, data, data.has_override);

    const result = await db.query(
      `UPDATE opportunity_scores SET
        gate = $3,
        customer_relationship = $4, scope_fit = $5, delivery_method = $6, strategic_value = $7,
        schedule_fit = $8, margin_profile = $9, win_probability_score = $10,
        total_score = $11, max_possible = $12,
        db_payment_dispute = $13, db_liquidated_damages = $14, db_schedule_conflict = $15,
        db_scope_outside = $16, db_margin_below_floor = $17, db_bonding_unmet = $18,
        has_override = $19, override_reason = $20, override_by = $21,
        recommendation = $22, notes = $23
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [
        scoreId, tenantId, gate,
        data.customer_relationship ?? null,
        data.scope_fit ?? null,
        data.delivery_method ?? null,
        data.strategic_value ?? null,
        data.schedule_fit ?? null,
        data.margin_profile ?? null,
        data.win_probability_score ?? null,
        total, maxPossible,
        data.db_payment_dispute || false,
        data.db_liquidated_damages || false,
        data.db_schedule_conflict || false,
        data.db_scope_outside || false,
        data.db_margin_below_floor || false,
        data.db_bonding_unmet || false,
        data.has_override || false,
        data.override_reason || null,
        data.has_override ? (data.override_by || userId) : null,
        recommendation,
        data.notes || null
      ]
    );
    return result.rows[0];
  },

  /**
   * Delete a score by ID
   */
  async delete(scoreId, tenantId) {
    const result = await db.query(
      `DELETE FROM opportunity_scores WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [scoreId, tenantId]
    );
    return result.rows[0];
  },

  // Expose helpers for route-level computation if needed
  WEIGHTS,
  GATE1_FACTORS,
  ALL_FACTORS,
  DEALBREAKER_COLS,
  computeScore,
  computeRecommendation
};

module.exports = OpportunityScore;
