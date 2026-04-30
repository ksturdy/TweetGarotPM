const db = require('../config/database');

// Standard equipment organized by schedule section
// Each section defines shared column headers; each equipment type maps into those columns.
// Columns are stored in spec_1..spec_5 + weight_lbs on the project_equipment table.
//
// Section columns define what spec slot maps to which table column header.
// Equipment that doesn't use a given column simply leaves it null.

const SECTION_COLUMNS = {
  major_equipment: [
    { slot: 1, label: 'CFM', unit: 'CFM' },
    { slot: 2, label: 'Clg Tons', unit: 'tons' },
    { slot: 3, label: 'Htg MBH', unit: 'MBH' },
    { slot: 4, label: 'HP', unit: 'HP' },
    // weight_lbs is always available as a dedicated column
  ],
  terminal_units: [
    { slot: 1, label: 'CFM', unit: 'CFM' },
    { slot: 2, label: 'Clg MBH', unit: 'MBH' },
    { slot: 3, label: 'Htg MBH', unit: 'MBH' },
    { slot: 4, label: 'HP', unit: 'HP' },
  ],
  ventilation: [
    { slot: 1, label: 'CFM', unit: 'CFM' },
    { slot: 2, label: 'HP', unit: 'HP' },
    { slot: 3, label: 'Size', unit: 'in' },
  ],
  piping: [
    { slot: 1, label: 'HP', unit: 'HP' },
    { slot: 2, label: 'GPM', unit: 'GPM' },
    { slot: 3, label: 'Pipe Size', unit: 'in' },
    { slot: 4, label: 'Gallons', unit: 'gal' },
  ],
};

// Which spec slots each equipment type uses (1-indexed to match spec_N columns)
// null means that column is not applicable for this equipment type
const STANDARD_EQUIPMENT = {
  major_equipment: [
    { type: 'ahu', label: 'Air Handling Units', slots: [1, 2, 3, 4] },
    { type: 'rtu', label: 'Rooftop Units', slots: [1, 2, 3, 4] },
    { type: 'mau', label: 'Makeup Air Units', slots: [1, null, 3, 4] },
    { type: 'eru', label: 'Energy Recovery Units', slots: [1, null, 3, 4] },
    { type: 'chiller', label: 'Chillers', slots: [null, 2, null, null] },
    { type: 'boilers', label: 'Boilers', slots: [null, null, 3, null] },
    { type: 'tower', label: 'Cooling Towers', slots: [null, 2, null, null] },
    { type: 'drycooler', label: 'Dry Coolers', slots: [null, null, 3, null] },
    { type: 'htx', label: 'Heat Exchangers', slots: [null, null, 3, null] },
    { type: 'indoor_vrf_systems', label: 'Indoor VRF Systems', slots: [null, 2, 3, null] },
    { type: 'lieberts', label: 'Liebert Units', slots: [1, 2, null, null] },
  ],
  terminal_units: [
    { type: 'vav', label: 'VAV Boxes', slots: [1, 2, 3, null] },
    { type: 'vav_fan_powered', label: 'Fan Powered VAV', slots: [1, 2, 3, 4] },
    { type: 'fcu', label: 'Fan Coil Units', slots: [1, 2, 3, null] },
    { type: 'uh', label: 'Unit Heaters', slots: [null, null, 3, null] },
    { type: 'cuh', label: 'Cabinet Unit Heaters', slots: [null, null, 3, null] },
    { type: 'booster_coil', label: 'Booster Coils', slots: [null, null, 3, null] },
    { type: 'radiant_panels', label: 'Radiant Panels', slots: [null, null, 3, null] },
    { type: 'rac', label: 'Refrigerant Air Coolers', slots: [null, 2, null, null] },
    { type: 'humidifier', label: 'Humidifiers', slots: [1, null, null, null] },
    { type: 'vfd', label: 'Variable Frequency Drives', slots: [null, null, null, 4] },
  ],
  ventilation: [
    { type: 'inline_fan', label: 'Inline Fans', slots: [1, 2, null] },
    { type: 'high_plume_fan', label: 'High Plume Fans', slots: [1, 2, null] },
    { type: 'grds', label: 'Grease Duct Systems', slots: [1, null, 3] },
    { type: 'hoods', label: 'Kitchen Hoods', slots: [1, null, null] },
    { type: 'laminar_flow', label: 'Laminar Flow Hoods', slots: [1, null, null] },
    { type: 'louvers', label: 'Louvers', slots: [null, null, 3] },
    { type: 'fire_dampers', label: 'Fire Dampers', slots: [null, null, 3] },
    { type: 'silencers', label: 'Silencers', slots: [null, null, 3] },
  ],
  piping: [
    { type: 'pumps', label: 'Pumps', slots: [1, 2, 3, null] },
    { type: 'cond_pumps', label: 'Condensate Pumps', slots: [1, 2, null, null] },
    { type: 'prv', label: 'Pressure Reducing Valves', slots: [null, null, 3, null] },
    { type: 'air_sep', label: 'Air Separators', slots: [null, null, 3, null] },
    { type: 'exp_tanks', label: 'Expansion Tanks', slots: [null, null, null, 4] },
    { type: 'buffer_tank', label: 'Buffer Tanks', slots: [null, null, null, 4] },
    { type: 'filters', label: 'Filters', slots: [null, null, 3, null] },
    { type: 'pot_feeder', label: 'Pot Feeders', slots: [null, null, null, 4] },
    { type: 'triple_duty', label: 'Triple Duty Valves', slots: [null, null, 3, null] },
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
   * Bulk upsert equipment counts + specs (up to 5 spec slots + weight).
   */
  async bulkUpsertEquipment(projectId, tenantId, items) {
    if (!items || items.length === 0) return [];

    const results = [];
    for (const item of items) {
      const result = await db.query(
        `INSERT INTO project_equipment
           (project_id, tenant_id, equipment_type, equipment_label, count, is_custom, notes, source, ai_confidence,
            spec_1_label, spec_1_value, spec_1_unit,
            spec_2_label, spec_2_value, spec_2_unit,
            spec_3_label, spec_3_value, spec_3_unit,
            spec_4_label, spec_4_value, spec_4_unit,
            spec_5_label, spec_5_value, spec_5_unit,
            weight_lbs)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
         ON CONFLICT (project_id, equipment_type) DO UPDATE SET
           equipment_label = EXCLUDED.equipment_label,
           count = EXCLUDED.count,
           is_custom = EXCLUDED.is_custom,
           notes = EXCLUDED.notes,
           source = EXCLUDED.source,
           ai_confidence = EXCLUDED.ai_confidence,
           spec_1_label = EXCLUDED.spec_1_label, spec_1_value = EXCLUDED.spec_1_value, spec_1_unit = EXCLUDED.spec_1_unit,
           spec_2_label = EXCLUDED.spec_2_label, spec_2_value = EXCLUDED.spec_2_value, spec_2_unit = EXCLUDED.spec_2_unit,
           spec_3_label = EXCLUDED.spec_3_label, spec_3_value = EXCLUDED.spec_3_value, spec_3_unit = EXCLUDED.spec_3_unit,
           spec_4_label = EXCLUDED.spec_4_label, spec_4_value = EXCLUDED.spec_4_value, spec_4_unit = EXCLUDED.spec_4_unit,
           spec_5_label = EXCLUDED.spec_5_label, spec_5_value = EXCLUDED.spec_5_value, spec_5_unit = EXCLUDED.spec_5_unit,
           weight_lbs = EXCLUDED.weight_lbs,
           updated_at = NOW()
         RETURNING *`,
        [
          projectId, tenantId,
          item.equipment_type, item.equipment_label,
          item.count ?? 0, item.is_custom ?? false,
          item.notes ?? null, item.source ?? 'manual', item.ai_confidence ?? null,
          item.spec_1_label ?? null, item.spec_1_value ?? null, item.spec_1_unit ?? null,
          item.spec_2_label ?? null, item.spec_2_value ?? null, item.spec_2_unit ?? null,
          item.spec_3_label ?? null, item.spec_3_value ?? null, item.spec_3_unit ?? null,
          item.spec_4_label ?? null, item.spec_4_value ?? null, item.spec_4_unit ?? null,
          item.spec_5_label ?? null, item.spec_5_value ?? null, item.spec_5_unit ?? null,
          item.weight_lbs ?? null,
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
    return { equipment: STANDARD_EQUIPMENT, columns: SECTION_COLUMNS };
  },
};

module.exports = ProjectCostModel;
