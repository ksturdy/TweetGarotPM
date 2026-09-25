const db = require('../config/database');

const SEGMENT_DEFINITIONS = [
  { key: '30',          label: 'Sheet Metal Field', isLabor: true  },
  { key: '35',          label: 'Sheet Metal Shop',  isLabor: true  },
  { key: '40',          label: 'Pipefitter Field',  isLabor: true  },
  { key: '45',          label: 'Pipefitter Shop',   isLabor: true  },
  { key: '50',          label: 'Plumbing Field',    isLabor: true  },
  { key: '55',          label: 'Plumbing Shop',     isLabor: true  },
  { key: '70',          label: 'Overhead',          isLabor: true  },
  { key: 'material',    label: 'Material',          isLabor: false },
  { key: 'subcontract', label: 'Subcontracts',      isLabor: false },
  { key: 'rental',      label: 'Rentals',           isLabor: false },
  { key: 'equipment',   label: 'MEP Equipment',     isLabor: false },
  { key: 'gc',          label: 'General Conditions',isLabor: false },
];

const OpportunityCostTypeSchedule = {
  async findByOpportunityId(opportunityId, tenantId) {
    const result = await db.query(
      `SELECT * FROM opportunity_cost_type_schedules
       WHERE opportunity_id = $1 AND tenant_id = $2`,
      [opportunityId, tenantId]
    );

    const byKey = {};
    for (const row of result.rows) {
      if (row.segment_key) byKey[row.segment_key] = row;
    }

    return SEGMENT_DEFINITIONS.map(def => ({
      segment_key:  def.key,
      label:        def.label,
      is_labor:     def.isLabor,
      start_date:   byKey[def.key]?.start_date   ?? null,
      end_date:     byKey[def.key]?.end_date      ?? null,
      notes:        byKey[def.key]?.notes         ?? '',
      contour_type: byKey[def.key]?.contour_type  ?? 'flat',
    }));
  },

  async upsert(opportunityId, tenantId, segmentKey, data) {
    const { start_date, end_date, notes, contour_type } = data;
    const result = await db.query(
      `INSERT INTO opportunity_cost_type_schedules
         (opportunity_id, tenant_id, segment_key, start_date, end_date, notes, contour_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (opportunity_id, segment_key) DO UPDATE SET
         start_date   = EXCLUDED.start_date,
         end_date     = EXCLUDED.end_date,
         notes        = EXCLUDED.notes,
         contour_type = EXCLUDED.contour_type,
         updated_at   = CURRENT_TIMESTAMP
       RETURNING *`,
      [opportunityId, tenantId, segmentKey, start_date || null, end_date || null, notes || null, contour_type || 'flat']
    );
    return result.rows[0];
  },
};

module.exports = OpportunityCostTypeSchedule;
