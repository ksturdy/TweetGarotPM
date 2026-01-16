const Database = require('better-sqlite3');
const db = require('../config/database');
const path = require('path');

// Helper function to convert Excel serial date to JavaScript Date
const excelDateToJSDate = (serial) => {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

// Helper function to convert Yes/No or numeric values to numeric
const toNumeric = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.toLowerCase() === 'yes') return 1;
    if (trimmed.toLowerCase() === 'no') return 0;
    const num = parseFloat(trimmed);
    return isNaN(num) ? null : num;
  }
  return null;
};

async function importHistoricalProjects() {
  try {
    // Open SQLite database
    const sqliteDbPath = path.join(__dirname, '../../../hvac_database.db');
    const sqliteDb = new Database(sqliteDbPath, { readonly: true });

    console.log('Connected to SQLite database');

    // Get all tables
    const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables in database:', tables.map(t => t.name));

    // Get all rows from the main table (assuming it's the first non-system table)
    const mainTable = tables.find(t => !t.name.startsWith('sqlite_'));

    if (!mainTable) {
      console.error('No data table found in SQLite database');
      sqliteDb.close();
      process.exit(1);
    }

    console.log(`Reading from table: ${mainTable.name}`);

    // Get column names
    const columns = sqliteDb.prepare(`PRAGMA table_info(${mainTable.name})`).all();
    console.log(`Found ${columns.length} columns`);
    console.log('Column names:', columns.map(c => c.name).join(', '));

    // Get all rows
    const rows = sqliteDb.prepare(`SELECT * FROM ${mainTable.name}`).all();
    console.log(`Found ${rows.length} rows to import`);

    if (rows.length === 0) {
      console.log('No data to import');
      sqliteDb.close();
      process.exit(0);
    }

    // Map each row to the PostgreSQL format
    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      try {
        // Skip rows without a name
        if (!row.Name) {
          continue;
        }

        const mappedData = {
          name: row.Name,
          bid_date: excelDateToJSDate(row.Bid_Date),
          building_type: row.Building_Type,
          project_type: row.Project_Type,
          bid_type: row.Bid_Type,
          total_cost: row.Total_Cost,
          total_sqft: row.Total_SqFt,
          cost_per_sqft_with_index: row.Cost_sqFt_with_Index_Factor,
          total_cost_per_sqft: row.Total_Cost_SqFt,

          // PM Section
          pm_hours: row.PM_Hours,
          pm_cost: row.PM,

          // SM Section
          sm_field_rate: row.SM_Field_Rate,
          sm_shop_rate: row.SM_Shop_Rate,
          sm_misc_field: row.SM_Misc_Field,
          sm_misc_field_cost: row.SM_Misc_Field_1,
          sm_misc_shop: row.SM_Misc_Shop,
          sm_misc_shop_cost: row.SM_Misc_Shop_1,
          sm_equip_cost: row.SM_Equip_Cost,

          // S Section (Supply)
          s_field: row.S_Field,
          s_field_cost: row.S_Field_1,
          s_shop: row.S_Shop,
          s_shop_cost: row.S_Shop_1,
          s_material_cost: row.S_Material,
          s_materials_with_escalation: row.S_Materials_with_Escalation,
          s_lbs_per_sq: row.S_LBS_Sq,
          s_lbs: row.S_LBS,

          // R Section (Return)
          r_field: row.R_Field,
          r_field_cost: row.R_Field_1,
          r_shop: row.R_Shop,
          r_shop_cost: row.R_Shop_1,
          r_material_cost: row.R_Material,
          r_materials_with_escalation: row.R_Materials_with_Escalation,
          r_lbs_per_sq: row.R_LBS_Sq,
          r_lbs: row.R_LBS,
          r_plenum: toNumeric(row.R_Plenum),

          // E Section (Exhaust)
          e_field: row.E_Field,
          e_field_cost: row.E_Field_1,
          e_shop: row.E_Shop,
          e_shop_cost: row.E_Shop_1,
          e_material_cost: row.E_Material,
          e_material_with_escalation: row.E_Material_w_Escalation,
          e_lbs_per_sq: row.E_LBS_Sq,
          e_lbs: row.E_LBS,

          // O Section (Outside Air)
          o_field: row.O_Field,
          o_field_cost: row.O_Field_1,
          o_shop: row.O_Shop,
          o_shop_cost: row.O_Shop_1,
          o_material_cost: row.O_Material,
          o_materials_with_escalation: row.O_Materials_with_Escalation,
          o_lbs_per_sq: row.O_LBS_Sq,
          o_lbs: row.O_LBS,

          // W Section (Welded)
          w_field: row.W_Field,
          w_field_cost: row.W_Field_1,
          w_shop: row.W_Shop,
          w_shop_cost: row.W_Shop_1,
          w_material_cost: row.W_Material,
          w_materials_with_escalation: row.W_Materials_with_Escalation,
          w_lbs_per_sq: row.W_LBS_Sq,
          w_lbs: row.W_LBS,

          // PF Section (Plumbing Field)
          pf_field_rate: row.PF_Field_Rate,
          pf_misc_field: row.PF_Misc_Field,
          pf_misc_field_cost: row.PF_Misc_Field_1,
          pf_equip_cost: row.PF_Equip_Cost,

          // Piping Systems
          hw_field: row.HW_Field,
          hw_field_cost: row.HW_Field_1,
          hw_material_cost: row.HW_Material,
          hw_material_with_esc: row.HW_Material_W_Esc,
          hw_feet_per_sq: row.HW_Feet_Sq,
          hw_footage: row.HW_Footage,

          chw_field: row.CHW_Field,
          chw_field_cost: row.CHW_Field_1,
          chw_material_cost: row.CHW_Material,
          chw_material_with_esc: row.CHW_Material_W_Esc,
          chw_feet_per_sq: row.CHW_Feet_Sq,
          chw_footage: row.CHW_Footage,

          d_field: row.D_Field2,
          d_field_cost: row.D_Field_2,
          d_material_cost: row.D_Material_2,
          d_material_with_esc: row.D_Material_W_Esc,
          d_feet_per_sq: row.D_Feet_Sq2,
          d_footage: row.D_Footage2,

          g_field: row.G_Field,
          g_field_cost: row.G_Field_1,
          g_material_cost: row.G_Material,
          g_material_with_esc: row.G_Material_W_Esc,
          g_feet_per_sq: row.G_Feet_Sq,
          g_footage: row.G_Footage,

          gs_field: row.GS_Field,
          gs_field_cost: row.GS_Field_1,
          gs_material_cost: row.GS_Material,
          gs_material_with_esc: row.GS_Material_W_Esc,
          gs_feet_per_sq: row.GS_Feet_Sq,
          gs_footage: row.GS_Footage,

          cw_field: row.CW_Field,
          cw_field_cost: row.CW_Field_1,
          cw_material_cost: row.CW_Material,
          cw_material_with_esc: row.CW_Material_W_Esc,
          cw_feet_per_sq: row.CW_Feet_Sq,
          cw_footage: row.CW_Footage,

          rad_field: row.RAD_Field2,
          rad_field_cost: row.RAD_Field_2,
          rad_material_cost: row.RAD_Material,
          rad_material_with_esc: row.RAD_Material_W_Esc,
          rad_feet_per_sq: row.RAD_Feet_Sq,
          rad_footage: row.RAD_Footage,

          ref_field: row.REF_Field,
          ref_field_cost: row.REF_Field_1,
          ref_material_cost: row.REF_Material,
          ref_material_with_esc: row.REF_Material_W_Esc,
          ref_feet_per_sq: row.REF_Feet_Sq,
          ref_footage: row.REF_Footage,

          stm_cond_field: row.Stm_Cond_Field2,
          stm_cond_field_cost: row.Stm_Cond_Field_2,
          stm_cond_material_cost: row.Stm_Cond_Material,
          stm_cond_material_with_esc: row.Stm_Cond_Material_W_Esc,
          stm_cond_feet_per_sq: row.Stm_Cond_Feet_Sq2,
          stm_cond_footage: row.Stm_Cond_Footage2,

          // Equipment Counts
          ahu: row.AHU || 0,
          rtu: row.RTU || 0,
          mau: row.MAU || 0,
          eru: row.ERU || 0,
          chiller: row.Chiller || 0,
          drycooler: row.Drycooler || 0,
          vfd: row.VFD || 0,
          vav: row.VAV || 0,
          vav_fan_powered: row.VAV_Fan_Powered || 0,
          booster_coil: row.Booster_Coil || 0,
          cuh: row.CUH || 0,
          uh: row.UH || 0,
          fcu: row.FCU || 0,
          indoor_vrf_systems: row.Indoor_VRF_Systems || 0,
          radiant_panels: row.Radiant_Panels || 0,
          humidifier: row.Humidifier || 0,
          prv: row.PRV || 0,
          inline_fan: row.Inline_Fan || 0,
          high_plume_fan: row.High_Plume_Fan || 0,
          rac: row.RAC || 0,
          lieberts: row.Lieberts || 0,
          grds: row.GRD_s || 0,
          laminar_flow: row.Laminar_Flow || 0,
          louvers: row.Louvers || 0,
          hoods: row.Hoods || 0,
          fire_dampers: row.Fire_Dampers || 0,
          silencers: row.Silencers || 0,
          boilers: row.Boilers || 0,
          htx: row.HTX || 0,
          pumps: row.Pumps || 0,
          cond_pumps: row.Cond_Pumps || 0,
          tower: row.Tower || 0,
          air_sep: row.Air_Sep || 0,
          exp_tanks: row.Exp_Tanks || 0,
          filters: row.Filters || 0,
          pot_feeder: row.Pot_Feeder || 0,
          buffer_tank: row.Buffer_Tank || 0,
          triple_duty: row.Triple_Duty || 0,

          // Additional Costs
          truck_rental: row.Truck_Rental,
          temp_heat: toNumeric(row.Temp_heat),
          controls: row.Controls,
          insulation: row.Insulation,
          balancing: row.Balancing,
          electrical: row.Electrical,
          general: row.General,
          allowance: row.Allowance,
          geo_thermal: row.Geo_Thermal,

          notes: row.Notes
        };

        // Insert into PostgreSQL
        await db.query(
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
          )`,
          [
            mappedData.name, mappedData.bid_date, mappedData.building_type, mappedData.project_type, mappedData.bid_type,
            mappedData.total_cost, mappedData.total_sqft, mappedData.cost_per_sqft_with_index, mappedData.total_cost_per_sqft,
            mappedData.pm_hours, mappedData.pm_cost,
            mappedData.sm_field_rate, mappedData.sm_shop_rate, mappedData.sm_misc_field, mappedData.sm_misc_field_cost, mappedData.sm_misc_shop, mappedData.sm_misc_shop_cost, mappedData.sm_equip_cost,
            mappedData.s_field, mappedData.s_field_cost, mappedData.s_shop, mappedData.s_shop_cost, mappedData.s_material_cost, mappedData.s_materials_with_escalation, mappedData.s_lbs_per_sq, mappedData.s_lbs,
            mappedData.r_field, mappedData.r_field_cost, mappedData.r_shop, mappedData.r_shop_cost, mappedData.r_material_cost, mappedData.r_materials_with_escalation, mappedData.r_lbs_per_sq, mappedData.r_lbs, mappedData.r_plenum,
            mappedData.e_field, mappedData.e_field_cost, mappedData.e_shop, mappedData.e_shop_cost, mappedData.e_material_cost, mappedData.e_material_with_escalation, mappedData.e_lbs_per_sq, mappedData.e_lbs,
            mappedData.o_field, mappedData.o_field_cost, mappedData.o_shop, mappedData.o_shop_cost, mappedData.o_material_cost, mappedData.o_materials_with_escalation, mappedData.o_lbs_per_sq, mappedData.o_lbs,
            mappedData.w_field, mappedData.w_field_cost, mappedData.w_shop, mappedData.w_shop_cost, mappedData.w_material_cost, mappedData.w_materials_with_escalation, mappedData.w_lbs_per_sq, mappedData.w_lbs,
            mappedData.pf_field_rate, mappedData.pf_misc_field, mappedData.pf_misc_field_cost, mappedData.pf_equip_cost,
            mappedData.hw_field, mappedData.hw_field_cost, mappedData.hw_material_cost, mappedData.hw_material_with_esc, mappedData.hw_feet_per_sq, mappedData.hw_footage,
            mappedData.chw_field, mappedData.chw_field_cost, mappedData.chw_material_cost, mappedData.chw_material_with_esc, mappedData.chw_feet_per_sq, mappedData.chw_footage,
            mappedData.d_field, mappedData.d_field_cost, mappedData.d_material_cost, mappedData.d_material_with_esc, mappedData.d_feet_per_sq, mappedData.d_footage,
            mappedData.g_field, mappedData.g_field_cost, mappedData.g_material_cost, mappedData.g_material_with_esc, mappedData.g_feet_per_sq, mappedData.g_footage,
            mappedData.gs_field, mappedData.gs_field_cost, mappedData.gs_material_cost, mappedData.gs_material_with_esc, mappedData.gs_feet_per_sq, mappedData.gs_footage,
            mappedData.cw_field, mappedData.cw_field_cost, mappedData.cw_material_cost, mappedData.cw_material_with_esc, mappedData.cw_feet_per_sq, mappedData.cw_footage,
            mappedData.rad_field, mappedData.rad_field_cost, mappedData.rad_material_cost, mappedData.rad_material_with_esc, mappedData.rad_feet_per_sq, mappedData.rad_footage,
            mappedData.ref_field, mappedData.ref_field_cost, mappedData.ref_material_cost, mappedData.ref_material_with_esc, mappedData.ref_feet_per_sq, mappedData.ref_footage,
            mappedData.stm_cond_field, mappedData.stm_cond_field_cost, mappedData.stm_cond_material_cost, mappedData.stm_cond_material_with_esc, mappedData.stm_cond_feet_per_sq, mappedData.stm_cond_footage,
            mappedData.ahu, mappedData.rtu, mappedData.mau, mappedData.eru, mappedData.chiller, mappedData.drycooler, mappedData.vfd, mappedData.vav, mappedData.vav_fan_powered, mappedData.booster_coil, mappedData.cuh, mappedData.uh, mappedData.fcu,
            mappedData.indoor_vrf_systems, mappedData.radiant_panels, mappedData.humidifier, mappedData.prv, mappedData.inline_fan, mappedData.high_plume_fan, mappedData.rac, mappedData.lieberts, mappedData.grds,
            mappedData.laminar_flow, mappedData.louvers, mappedData.hoods, mappedData.fire_dampers, mappedData.silencers,
            mappedData.boilers, mappedData.htx, mappedData.pumps, mappedData.cond_pumps, mappedData.tower, mappedData.air_sep, mappedData.exp_tanks, mappedData.filters, mappedData.pot_feeder, mappedData.buffer_tank, mappedData.triple_duty,
            mappedData.truck_rental, mappedData.temp_heat, mappedData.controls, mappedData.insulation, mappedData.balancing, mappedData.electrical, mappedData.general, mappedData.allowance, mappedData.geo_thermal,
            mappedData.notes
          ]
        );

        successCount++;
        if (successCount % 10 === 0) {
          console.log(`Imported ${successCount}/${rows.length} projects...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error importing project "${row.Name || row.name}":`, error.message);
      }
    }

    sqliteDb.close();

    console.log('\nImport complete!');
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

importHistoricalProjects();
