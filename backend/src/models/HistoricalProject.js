const db = require('../config/database');

const HistoricalProject = {
  async findAll() {
    const result = await db.query(
      'SELECT * FROM historical_projects ORDER BY bid_date DESC NULLS LAST, created_at DESC'
    );
    return result.rows;
  },


  async findById(id) {
    const result = await db.query(
      'SELECT * FROM historical_projects WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },


  // Create a historical project (no tenant_id - table doesn't have that column)
  async create(data) {
    const result = await db.query(
      `INSERT INTO historical_projects (
        name, bid_date, building_type, project_type, bid_type,
        total_cost, total_sqft, cost_per_sqft_with_index, total_cost_per_sqft,
        pm_hours, pm_cost,
        sm_field_rate, sm_shop_rate, sm_misc_field, sm_misc_field_cost, sm_misc_shop, sm_misc_shop_cost, sm_equip_cost,
        s_field, s_field_cost, s_shop, s_shop_cost, s_material_cost, s_materials_with_escalation, s_lbs_per_sq, s_lbs,
        r_field, r_field_cost, r_shop, r_shop_cost, r_material_cost, r_materials_with_escalation, r_lbs_per_sq, r_lbs, r_plenum,
        e_field, e_field_cost, e_shop, e_shop_cost, e_material_cost, e_material_with_escalation, e_lbs_per_sq, e_lbs,
        o_field, o_field_cost, o_shop, o_shop_cost, o_material_cost, o_materials_with_escalation, o_lbs_per_sq, o_lbs,
        w_field, w_field_cost, w_shop, w_shop_cost, w_material_cost, w_materials_with_escalation, w_lbs_per_sq, w_lbs,
        pf_field_rate, pf_misc_field, pf_misc_field_cost, pf_equip_cost,
        hw_field, hw_field_cost, hw_material_cost, hw_material_with_esc, hw_feet_per_sq, hw_footage,
        chw_field, chw_field_cost, chw_material_cost, chw_material_with_esc, chw_feet_per_sq, chw_footage,
        d_field, d_field_cost, d_material_cost, d_material_with_esc, d_feet_per_sq, d_footage,
        g_field, g_field_cost, g_material_cost, g_material_with_esc, g_feet_per_sq, g_footage,
        gs_field, gs_field_cost, gs_material_cost, gs_material_with_esc, gs_feet_per_sq, gs_footage,
        cw_field, cw_field_cost, cw_material_cost, cw_material_with_esc, cw_feet_per_sq, cw_footage,
        rad_field, rad_field_cost, rad_material_cost, rad_material_with_esc, rad_feet_per_sq, rad_footage,
        ref_field, ref_field_cost, ref_material_cost, ref_material_with_esc, ref_feet_per_sq, ref_footage,
        stm_cond_field, stm_cond_field_cost, stm_cond_material_cost, stm_cond_material_with_esc, stm_cond_feet_per_sq, stm_cond_footage,
        ahu, rtu, mau, eru, chiller, drycooler, vfd, vav, vav_fan_powered, booster_coil, cuh, uh, fcu,
        indoor_vrf_systems, radiant_panels, humidifier, prv, inline_fan, high_plume_fan, rac, lieberts, grds,
        laminar_flow, louvers, hoods, fire_dampers, silencers,
        boilers, htx, pumps, cond_pumps, tower, air_sep, exp_tanks, filters, pot_feeder, buffer_tank, triple_duty,
        truck_rental, temp_heat, controls, insulation, balancing, electrical, general, allowance, geo_thermal,
        notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
        $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60,
        $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76, $77, $78, $79, $80,
        $81, $82, $83, $84, $85, $86, $87, $88, $89, $90, $91, $92, $93, $94, $95, $96, $97, $98, $99, $100,
        $101, $102, $103, $104, $105, $106, $107, $108, $109, $110, $111, $112, $113, $114, $115, $116, $117, $118, $119, $120,
        $121, $122, $123, $124, $125, $126, $127, $128, $129, $130, $131, $132, $133, $134, $135, $136, $137, $138, $139, $140,
        $141, $142, $143, $144, $145, $146, $147, $148, $149, $150, $151, $152, $153, $154, $155, $156, $157, $158, $159, $160,
        $161, $162, $163, $164, $165
      ) RETURNING *`,
      [
        data.name, data.bid_date, data.building_type, data.project_type, data.bid_type,
        data.total_cost, data.total_sqft, data.cost_per_sqft_with_index, data.total_cost_per_sqft,
        data.pm_hours, data.pm_cost,
        data.sm_field_rate, data.sm_shop_rate, data.sm_misc_field, data.sm_misc_field_cost, data.sm_misc_shop, data.sm_misc_shop_cost, data.sm_equip_cost,
        data.s_field, data.s_field_cost, data.s_shop, data.s_shop_cost, data.s_material_cost, data.s_materials_with_escalation, data.s_lbs_per_sq, data.s_lbs,
        data.r_field, data.r_field_cost, data.r_shop, data.r_shop_cost, data.r_material_cost, data.r_materials_with_escalation, data.r_lbs_per_sq, data.r_lbs, data.r_plenum,
        data.e_field, data.e_field_cost, data.e_shop, data.e_shop_cost, data.e_material_cost, data.e_material_with_escalation, data.e_lbs_per_sq, data.e_lbs,
        data.o_field, data.o_field_cost, data.o_shop, data.o_shop_cost, data.o_material_cost, data.o_materials_with_escalation, data.o_lbs_per_sq, data.o_lbs,
        data.w_field, data.w_field_cost, data.w_shop, data.w_shop_cost, data.w_material_cost, data.w_materials_with_escalation, data.w_lbs_per_sq, data.w_lbs,
        data.pf_field_rate, data.pf_misc_field, data.pf_misc_field_cost, data.pf_equip_cost,
        data.hw_field, data.hw_field_cost, data.hw_material_cost, data.hw_material_with_esc, data.hw_feet_per_sq, data.hw_footage,
        data.chw_field, data.chw_field_cost, data.chw_material_cost, data.chw_material_with_esc, data.chw_feet_per_sq, data.chw_footage,
        data.d_field, data.d_field_cost, data.d_material_cost, data.d_material_with_esc, data.d_feet_per_sq, data.d_footage,
        data.g_field, data.g_field_cost, data.g_material_cost, data.g_material_with_esc, data.g_feet_per_sq, data.g_footage,
        data.gs_field, data.gs_field_cost, data.gs_material_cost, data.gs_material_with_esc, data.gs_feet_per_sq, data.gs_footage,
        data.cw_field, data.cw_field_cost, data.cw_material_cost, data.cw_material_with_esc, data.cw_feet_per_sq, data.cw_footage,
        data.rad_field, data.rad_field_cost, data.rad_material_cost, data.rad_material_with_esc, data.rad_feet_per_sq, data.rad_footage,
        data.ref_field, data.ref_field_cost, data.ref_material_cost, data.ref_material_with_esc, data.ref_feet_per_sq, data.ref_footage,
        data.stm_cond_field, data.stm_cond_field_cost, data.stm_cond_material_cost, data.stm_cond_material_with_esc, data.stm_cond_feet_per_sq, data.stm_cond_footage,
        data.ahu, data.rtu, data.mau, data.eru, data.chiller, data.drycooler, data.vfd, data.vav, data.vav_fan_powered, data.booster_coil, data.cuh, data.uh, data.fcu,
        data.indoor_vrf_systems, data.radiant_panels, data.humidifier, data.prv, data.inline_fan, data.high_plume_fan, data.rac, data.lieberts, data.grds,
        data.laminar_flow, data.louvers, data.hoods, data.fire_dampers, data.silencers,
        data.boilers, data.htx, data.pumps, data.cond_pumps, data.tower, data.air_sep, data.exp_tanks, data.filters, data.pot_feeder, data.buffer_tank, data.triple_duty,
        data.truck_rental, data.temp_heat, data.controls, data.insulation, data.balancing, data.electrical, data.general, data.allowance, data.geo_thermal,
        data.notes
      ]
    );
    return result.rows[0];
  },

  async bulkCreate(projects) {
    const inserted = [];

    for (const project of projects) {
      const result = await this.create(project);
      inserted.push(result);
    }

    return inserted;
  },

  // Update a historical project (no tenant filtering - table doesn't have tenant_id)
  async update(id, data) {
    const query = `UPDATE historical_projects SET
      name = $1, bid_date = $2, building_type = $3, project_type = $4, bid_type = $5,
      total_cost = $6, total_sqft = $7, cost_per_sqft_with_index = $8, total_cost_per_sqft = $9,
      notes = $10,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $11
    RETURNING *`;

    const params = [
      data.name, data.bid_date, data.building_type, data.project_type, data.bid_type,
      data.total_cost, data.total_sqft, data.cost_per_sqft_with_index, data.total_cost_per_sqft,
      data.notes,
      id
    ];

    const result = await db.query(query, params);
    return result.rows[0];
  },

  // Delete a historical project (no tenant filtering - table doesn't have tenant_id)
  async delete(id) {
    await db.query('DELETE FROM historical_projects WHERE id = $1', [id]);
  },

  async deleteAll() {
    await db.query('DELETE FROM historical_projects');
  },


  // Find similar projects for budget generation (no tenant filtering - table doesn't have tenant_id)
  async findSimilar(criteria) {
    const { buildingType, projectType, bidType, sqft, limit = 5 } = criteria;

    // Build query with similarity scoring
    // Cast parameters to explicit types to avoid PostgreSQL type inference issues
    const query = `
      SELECT
        id, name, building_type, project_type, bid_type,
        total_sqft, total_cost, total_cost_per_sqft, bid_date,
        pm_hours, pm_cost, sm_equip_cost, pf_equip_cost,
        controls, insulation, balancing, electrical, general, allowance,
        s_materials_with_escalation, r_materials_with_escalation,
        e_material_with_escalation, o_materials_with_escalation,
        hw_material_with_esc, chw_material_with_esc,
        ahu, rtu, vav, boilers, pumps, chiller,
        (
          -- Building type match: 40 points
          CASE WHEN building_type = $1::text THEN 40 ELSE 0 END +
          -- Project type match: 35 points
          CASE WHEN project_type = $2::text THEN 35 ELSE 0 END +
          -- Bid type match: 10 points
          CASE WHEN $3::text IS NULL OR bid_type = $3::text THEN 10 ELSE 0 END +
          -- Square footage similarity: 15 points
          CASE
            WHEN total_sqft IS NULL OR $4::decimal IS NULL THEN 0
            WHEN ABS(total_sqft - $4::decimal) / GREATEST($4::decimal, 1) <= 0.25 THEN 15
            WHEN ABS(total_sqft - $4::decimal) / GREATEST($4::decimal, 1) <= 0.5 THEN 10
            WHEN ABS(total_sqft - $4::decimal) / GREATEST($4::decimal, 1) <= 1.0 THEN 5
            ELSE 0
          END
        ) as similarity_score
      FROM historical_projects
      WHERE total_cost IS NOT NULL AND total_cost > 0
      ORDER BY similarity_score DESC, bid_date DESC NULLS LAST
      LIMIT $5::integer
    `;

    const params = [buildingType, projectType, bidType, sqft, limit];
    const result = await db.query(query, params);
    return result.rows;
  },

  // Get category averages for budget estimation (no tenant filtering)
  async getCategoryAverages(buildingType, projectType) {
    let query = `
      SELECT
        COUNT(*)::integer as project_count,
        AVG(total_cost) as avg_total_cost,
        AVG(total_cost_per_sqft) as avg_cost_per_sqft,
        AVG(pm_cost) as avg_pm_cost,
        AVG(sm_equip_cost) as avg_sm_equip_cost,
        AVG(pf_equip_cost) as avg_pf_equip_cost,
        AVG(controls) as avg_controls,
        AVG(insulation) as avg_insulation,
        AVG(balancing) as avg_balancing,
        AVG(electrical) as avg_electrical,
        AVG(general) as avg_general,
        AVG(allowance) as avg_allowance,
        AVG(s_field_cost) as avg_supply_labor,
        AVG(s_materials_with_escalation) as avg_supply_material,
        AVG(r_field_cost) as avg_return_labor,
        AVG(r_materials_with_escalation) as avg_return_material,
        AVG(e_field_cost) as avg_exhaust_labor,
        AVG(e_material_with_escalation) as avg_exhaust_material,
        AVG(o_field_cost) as avg_outside_air_labor,
        AVG(o_materials_with_escalation) as avg_outside_air_material,
        AVG(hw_field_cost) as avg_hw_labor,
        AVG(hw_material_with_esc) as avg_hw_material,
        AVG(chw_field_cost) as avg_chw_labor,
        AVG(chw_material_with_esc) as avg_chw_material
      FROM historical_projects
      WHERE total_cost IS NOT NULL AND total_cost > 0
    `;

    const params = [];
    let paramIndex = 1;

    if (buildingType) {
      query += ` AND building_type = $${paramIndex}`;
      params.push(buildingType);
      paramIndex++;
    }

    if (projectType) {
      query += ` AND project_type = $${paramIndex}`;
      params.push(projectType);
    }

    const result = await db.query(query, params);
    return result.rows[0];
  },

  // Get distinct values for dropdown options (no tenant filtering)
  async getDistinctValues(column) {
    const allowedColumns = ['building_type', 'project_type', 'bid_type'];
    if (!allowedColumns.includes(column)) {
      throw new Error('Invalid column name');
    }

    const query = `
      SELECT DISTINCT ${column} as value
      FROM historical_projects
      WHERE ${column} IS NOT NULL AND ${column} != ''
      ORDER BY ${column}
    `;

    const result = await db.query(query);
    return result.rows.map(r => r.value);
  },

  // Get statistics for dashboard (no tenant filtering)
  async getStats() {
    const query = `
      SELECT
        COUNT(*) as total_projects,
        COUNT(DISTINCT building_type) as building_types,
        COUNT(DISTINCT project_type) as project_types,
        MIN(bid_date) as oldest_project,
        MAX(bid_date) as newest_project,
        AVG(total_cost) as avg_cost,
        AVG(total_cost_per_sqft) as avg_cost_per_sqft,
        MIN(total_cost) as min_cost,
        MAX(total_cost) as max_cost
      FROM historical_projects
      WHERE total_cost IS NOT NULL AND total_cost > 0
    `;

    const result = await db.query(query);
    return result.rows[0];
  }
};

module.exports = HistoricalProject;
