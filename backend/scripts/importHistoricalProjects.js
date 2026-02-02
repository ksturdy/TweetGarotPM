const XLSX = require('xlsx');
const path = require('path');
const db = require('../src/config/database');

const excelPath = path.join(__dirname, '../../Estimate Templates/12 HVAC Budget Spreadsheet 05-20-25.xlsx');

// Helper function to convert Excel serial date to JavaScript Date
const excelDateToJSDate = (serial) => {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().split('T')[0];
};

// Helper function to clean numeric values
const cleanNumeric = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'yes' || lowerValue === 'no' || lowerValue === 'n/a' || lowerValue === 'na') return null;
    const parsed = parseFloat(value.replace(/[,$]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

// Helper function to clean integer values
const cleanInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'yes' || lowerValue === 'no' || lowerValue === 'n/a' || lowerValue === 'na') return null;
    const parsed = parseInt(value.replace(/[,$]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

async function importData() {
  try {
    console.log('Reading Excel file:', excelPath);
    const workbook = XLSX.readFile(excelPath);

    // Get the Data sheet
    const sheetName = 'Data';
    if (!workbook.SheetNames.includes(sheetName)) {
      console.log('Available sheets:', workbook.SheetNames);
      throw new Error(`Sheet "${sheetName}" not found in workbook`);
    }

    const worksheet = workbook.Sheets[sheetName];

    // Read as array of arrays to handle the complex header structure
    const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Row 3 (index 3) contains the actual headers
    const headers = allRows[3];

    // Data starts at row 4 (index 4)
    const dataRows = allRows.slice(4);

    console.log(`Found ${dataRows.length} data rows`);
    console.log('Headers:', headers.slice(0, 15));

    // Map and clean the data
    const mappedProjects = dataRows
      .filter(row => {
        // First column is Name
        return row[0] && typeof row[0] === 'string' && row[0].trim() !== '';
      })
      .map(row => {
        // Create an object mapping header to value
        const project = {};
        headers.forEach((header, idx) => {
          if (header) {
            project[header] = row[idx];
          }
        });

        const getClean = (key) => cleanNumeric(project[key]);
        const getInt = (key) => cleanInteger(project[key]);

        return {
          name: project['Name']?.toString().trim(),
          bid_date: excelDateToJSDate(project['Bid Date']),
          building_type: project['Building Type'],
          project_type: project['Project Type'],
          bid_type: project['Bid Type'],
          total_cost: cleanNumeric(project['Total Cost']),
          total_sqft: cleanNumeric(project['Total SqFt']),
          cost_per_sqft_with_index: cleanNumeric(project['Cost/sqFt with Index Factor']),
          total_cost_per_sqft: cleanNumeric(project['Total Cost/SqFt']),
          pm_hours: cleanNumeric(project['PM Hours']),
          pm_cost: cleanNumeric(project['PM $']),
          sm_field_rate: getClean('SM Field Rate $'),
          sm_shop_rate: getClean('SM Shop Rate $'),
          sm_misc_field: getClean('SM Misc Field'),
          sm_misc_field_cost: getClean('SM Misc Field $'),
          sm_misc_shop: getClean('SM Misc Shop'),
          sm_misc_shop_cost: getClean('SM Misc Shop $'),
          sm_equip_cost: getClean('SM Equip $'),
          s_field: getClean('S Field'),
          s_field_cost: getClean('S Field $'),
          s_shop: getClean('S Shop'),
          s_shop_cost: getClean('S Shop $'),
          s_material_cost: getClean('S Material $'),
          s_materials_with_escalation: getClean('S Materials with Escalation'),
          s_lbs_per_sq: getClean('S Lbs/Sq'),
          s_lbs: getClean('S Lbs'),
          r_field: getClean('R Field'),
          r_field_cost: getClean('R Field $'),
          r_shop: getClean('R Shop'),
          r_shop_cost: getClean('R Shop $'),
          r_material_cost: getClean('R Material $'),
          r_materials_with_escalation: getClean('R Materials with Escalation'),
          r_lbs_per_sq: getClean('R Lbs/Sq'),
          r_lbs: getClean('R Lbs'),
          r_plenum: getClean('R Plenum'),
          e_field: getClean('E Field'),
          e_field_cost: getClean('E Field $'),
          e_shop: getClean('E Shop'),
          e_shop_cost: getClean('E Shop $'),
          e_material_cost: getClean('E Material $'),
          e_material_with_escalation: getClean('E Material with Escalation'),
          e_lbs_per_sq: getClean('E Lbs/Sq'),
          e_lbs: getClean('E Lbs'),
          o_field: getClean('O Field'),
          o_field_cost: getClean('O Field $'),
          o_shop: getClean('O Shop'),
          o_shop_cost: getClean('O Shop $'),
          o_material_cost: getClean('O Material $'),
          o_materials_with_escalation: getClean('O Materials with Escalation'),
          o_lbs_per_sq: getClean('O Lbs/Sq'),
          o_lbs: getClean('O Lbs'),
          w_field: getClean('W Field'),
          w_field_cost: getClean('W Field $'),
          w_shop: getClean('W Shop'),
          w_shop_cost: getClean('W Shop $'),
          w_material_cost: getClean('W Material $'),
          w_materials_with_escalation: getClean('W Materials with Escalation'),
          w_lbs_per_sq: getClean('W Lbs/Sq'),
          w_lbs: getClean('W Lbs'),
          pf_field_rate: getClean('PF Field Rate $'),
          pf_misc_field: getClean('PF Misc Field'),
          pf_misc_field_cost: getClean('PF Misc Field $'),
          pf_equip_cost: getClean('PF Equip $'),
          hw_field: getClean('HW Field'),
          hw_field_cost: getClean('HW Field $'),
          hw_material_cost: getClean('HW Material $'),
          hw_material_with_esc: getClean('HW Material with Esc'),
          hw_feet_per_sq: getClean('HW Ft/Sq'),
          hw_footage: getClean('HW Footage'),
          chw_field: getClean('CHW Field'),
          chw_field_cost: getClean('CHW Field $'),
          chw_material_cost: getClean('CHW Material $'),
          chw_material_with_esc: getClean('CHW Material with Esc'),
          chw_feet_per_sq: getClean('CHW Ft/Sq'),
          chw_footage: getClean('CHW Footage'),
          d_field: getClean('D Field'),
          d_field_cost: getClean('D Field $'),
          d_material_cost: getClean('D Material $'),
          d_material_with_esc: getClean('D Material with Esc'),
          d_feet_per_sq: getClean('D Ft/Sq'),
          d_footage: getClean('D Footage'),
          g_field: getClean('G Field'),
          g_field_cost: getClean('G Field $'),
          g_material_cost: getClean('G Material $'),
          g_material_with_esc: getClean('G Material with Esc'),
          g_feet_per_sq: getClean('G Ft/Sq'),
          g_footage: getClean('G Footage'),
          gs_field: getClean('GS Field'),
          gs_field_cost: getClean('GS Field $'),
          gs_material_cost: getClean('GS Material $'),
          gs_material_with_esc: getClean('GS Material with Esc'),
          gs_feet_per_sq: getClean('GS Ft/Sq'),
          gs_footage: getClean('GS Footage'),
          cw_field: getClean('CW Field'),
          cw_field_cost: getClean('CW Field $'),
          cw_material_cost: getClean('CW Material $'),
          cw_material_with_esc: getClean('CW Material with Esc'),
          cw_feet_per_sq: getClean('CW Ft/Sq'),
          cw_footage: getClean('CW Footage'),
          rad_field: getClean('RAD Field'),
          rad_field_cost: getClean('RAD Field $'),
          rad_material_cost: getClean('RAD Material $'),
          rad_material_with_esc: getClean('RAD Material with Esc'),
          rad_feet_per_sq: getClean('RAD Ft/Sq'),
          rad_footage: getClean('RAD Footage'),
          ref_field: getClean('REF Field'),
          ref_field_cost: getClean('REF Field $'),
          ref_material_cost: getClean('REF Material $'),
          ref_material_with_esc: getClean('REF Material with Esc'),
          ref_feet_per_sq: getClean('REF Ft/Sq'),
          ref_footage: getClean('REF Footage'),
          stm_cond_field: getClean('S&C Field'),
          stm_cond_field_cost: getClean('S&C Field $'),
          stm_cond_material_cost: getClean('S&C Material $'),
          stm_cond_material_with_esc: getClean('S&C Material with Esc'),
          stm_cond_feet_per_sq: getClean('S&C Ft/Sq'),
          stm_cond_footage: getClean('S&C Footage'),
          ahu: getInt('AHU'),
          rtu: getInt('RTU'),
          mau: getInt('MAU'),
          eru: getInt('ERU'),
          chiller: getInt('Chiller'),
          drycooler: getInt('Drycooler'),
          vfd: getInt('VFD'),
          vav: getInt('VAV'),
          vav_fan_powered: getInt('VAV-FP'),
          booster_coil: getInt('Booster Coil'),
          cuh: getInt('CUH'),
          uh: getInt('UH'),
          fcu: getInt('FCU'),
          indoor_vrf_systems: getInt('Indoor VRF'),
          radiant_panels: getInt('Radiant Panels'),
          humidifier: getInt('Humidifier'),
          prv: getInt('PRV'),
          inline_fan: getInt('Inline Fan'),
          high_plume_fan: getInt('High Plume'),
          rac: getInt('RAC'),
          lieberts: getInt('Lieberts'),
          grds: getInt('GRDS'),
          laminar_flow: getInt('Laminar Flow'),
          louvers: getInt('Louvers'),
          hoods: getInt('Hoods'),
          fire_dampers: getInt('Fire Dampers'),
          silencers: getInt('Silencers'),
          boilers: getInt('Boilers'),
          htx: getInt('HTX'),
          pumps: getInt('Pumps'),
          cond_pumps: getInt('Cond Pumps'),
          tower: getInt('Tower'),
          air_sep: getInt('Air Sep'),
          exp_tanks: getInt('Exp Tanks'),
          filters: getInt('Filters'),
          pot_feeder: getInt('Pot Feeder'),
          buffer_tank: getInt('Buffer Tank'),
          triple_duty: getInt('Triple Duty'),
          truck_rental: getClean('Truck Rental'),
          temp_heat: getClean('Temp Heat'),
          controls: getClean('Controls'),
          insulation: getClean('Insulation'),
          balancing: getClean('Balancing'),
          electrical: getClean('Electrical'),
          general: getClean('General'),
          allowance: getClean('Allowance'),
          geo_thermal: getClean('Geo Thermal'),
          notes: project['Notes']
        };
      });

    console.log(`Mapped ${mappedProjects.length} valid projects`);

    if (mappedProjects.length > 0) {
      console.log('\nSample project:', JSON.stringify(mappedProjects[0], null, 2));
    }

    // Insert into database
    let inserted = 0;
    for (const project of mappedProjects) {
      const columns = Object.keys(project).filter(k => project[k] !== undefined && project[k] !== null);
      const values = columns.map(k => project[k]);
      const placeholders = columns.map((_, i) => `$${i + 1}`);

      const query = `INSERT INTO historical_projects (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`;

      try {
        await db.query(query, values);
        inserted++;
        if (inserted % 50 === 0) {
          console.log(`Inserted ${inserted} projects...`);
        }
      } catch (err) {
        console.error(`Error inserting project "${project.name}":`, err.message);
      }
    }

    console.log(`\nSuccessfully imported ${inserted} historical projects!`);
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importData();
