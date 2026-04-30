const db = require('../config/database');

// Standard equipment types matching historical_projects columns
const STANDARD_EQUIPMENT = {
  hvac: [
    { type: 'ahu', label: 'Air Handling Units' },
    { type: 'rtu', label: 'Rooftop Units' },
    { type: 'mau', label: 'Makeup Air Units' },
    { type: 'eru', label: 'Energy Recovery Units' },
    { type: 'chiller', label: 'Chillers' },
    { type: 'drycooler', label: 'Dry Coolers' },
    { type: 'vfd', label: 'Variable Frequency Drives' },
    { type: 'vav', label: 'VAV Boxes' },
    { type: 'vav_fan_powered', label: 'Fan Powered VAV' },
    { type: 'booster_coil', label: 'Booster Coils' },
    { type: 'cuh', label: 'Cabinet Unit Heaters' },
    { type: 'uh', label: 'Unit Heaters' },
    { type: 'fcu', label: 'Fan Coil Units' },
    { type: 'indoor_vrf_systems', label: 'Indoor VRF Systems' },
    { type: 'radiant_panels', label: 'Radiant Panels' },
    { type: 'humidifier', label: 'Humidifiers' },
    { type: 'prv', label: 'Pressure Reducing Valves' },
    { type: 'inline_fan', label: 'Inline Fans' },
    { type: 'high_plume_fan', label: 'High Plume Fans' },
    { type: 'rac', label: 'Refrigerant Air Coolers' },
    { type: 'lieberts', label: 'Liebert Units' },
    { type: 'grds', label: 'Grease Duct Systems' },
    { type: 'laminar_flow', label: 'Laminar Flow Hoods' },
    { type: 'louvers', label: 'Louvers' },
    { type: 'hoods', label: 'Kitchen Hoods' },
    { type: 'fire_dampers', label: 'Fire Dampers' },
    { type: 'silencers', label: 'Silencers' },
  ],
  plumbing: [
    { type: 'boilers', label: 'Boilers' },
    { type: 'htx', label: 'Heat Exchangers' },
    { type: 'pumps', label: 'Pumps' },
    { type: 'cond_pumps', label: 'Condensate Pumps' },
    { type: 'tower', label: 'Cooling Towers' },
    { type: 'air_sep', label: 'Air Separators' },
    { type: 'exp_tanks', label: 'Expansion Tanks' },
    { type: 'filters', label: 'Filters' },
    { type: 'pot_feeder', label: 'Pot Feeders' },
    { type: 'buffer_tank', label: 'Buffer Tanks' },
    { type: 'triple_duty', label: 'Triple Duty Valves' },
  ],
};

const ProjectCostModel = {
  /**
   * Get cost model metadata + all equipment rows for a project
   */
  async findByProject(projectId, tenantId) {
    const metaResult = await db.query(
      `SELECT * FROM project_cost_models WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );

    const equipResult = await db.query(
      `SELECT * FROM project_equipment
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY is_custom ASC, equipment_type ASC`,
      [projectId, tenantId]
    );

    return {
      meta: metaResult.rows[0] || null,
      equipment: equipResult.rows,
    };
  },

  /**
   * Create or update cost model metadata (sqft, building_type, project_type, notes)
   */
  async upsertMeta(projectId, tenantId, data) {
    const result = await db.query(
      `INSERT INTO project_cost_models (project_id, tenant_id, total_sqft, building_type, project_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (project_id) DO UPDATE SET
         total_sqft = EXCLUDED.total_sqft,
         building_type = EXCLUDED.building_type,
         project_type = EXCLUDED.project_type,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING *`,
      [
        projectId,
        tenantId,
        data.total_sqft ?? null,
        data.building_type ?? null,
        data.project_type ?? null,
        data.notes ?? null,
      ]
    );
    return result.rows[0];
  },

  /**
   * Bulk upsert equipment counts.
   * items: [{ equipment_type, equipment_label, count, is_custom, notes, source, ai_confidence }]
   */
  async bulkUpsertEquipment(projectId, tenantId, items) {
    if (!items || items.length === 0) return [];

    const results = [];
    for (const item of items) {
      const result = await db.query(
        `INSERT INTO project_equipment
           (project_id, tenant_id, equipment_type, equipment_label, count, is_custom, notes, source, ai_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (project_id, equipment_type) DO UPDATE SET
           equipment_label = EXCLUDED.equipment_label,
           count = EXCLUDED.count,
           is_custom = EXCLUDED.is_custom,
           notes = EXCLUDED.notes,
           source = EXCLUDED.source,
           ai_confidence = EXCLUDED.ai_confidence,
           updated_at = NOW()
         RETURNING *`,
        [
          projectId,
          tenantId,
          item.equipment_type,
          item.equipment_label,
          item.count ?? 0,
          item.is_custom ?? false,
          item.notes ?? null,
          item.source ?? 'manual',
          item.ai_confidence ?? null,
        ]
      );
      results.push(result.rows[0]);
    }
    return results;
  },

  /**
   * Delete a single equipment row (mainly for removing custom types)
   */
  async deleteEquipment(id, tenantId) {
    const result = await db.query(
      `DELETE FROM project_equipment WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Return canonical equipment type list with labels and categories
   */
  getStandardTypes() {
    return STANDARD_EQUIPMENT;
  },
};

module.exports = ProjectCostModel;
