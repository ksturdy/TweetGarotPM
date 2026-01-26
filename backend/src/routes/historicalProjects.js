const express = require('express');
const router = express.Router();
const HistoricalProject = require('../models/HistoricalProject');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// Apply auth and tenant middleware to all routes
router.use(authenticate);
router.use(tenantContext);

// Import historical projects from Excel data
router.post('/import', async (req, res, next) => {
  try {
    const { projects } = req.body;

    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ error: 'Projects array is required' });
    }

    // Helper function to convert Excel serial date to JavaScript Date
    const excelDateToJSDate = (serial) => {
      if (!serial || typeof serial !== 'number') return null;
      const utc_days = Math.floor(serial - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      return date_info.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
    };

    // Helper function to clean numeric values
    const cleanNumeric = (value) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        // Remove common text values
        const lowerValue = value.toLowerCase().trim();
        if (lowerValue === 'yes' || lowerValue === 'no' || lowerValue === 'n/a' || lowerValue === 'na') return null;

        // Try to parse as number
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

    // Map Excel column names to database field names and clean all values
    const mappedProjects = projects
      .filter(project => {
        // Skip rows without a name (empty rows or header rows)
        return project['Name'] && typeof project['Name'] === 'string' && project['Name'].trim() !== '';
      })
      .map(project => {
        // Create a helper to get and clean values
        const getClean = (key) => cleanNumeric(project[key]);
        const getInt = (key) => cleanInteger(project[key]);

        return {
          name: project['Name'].trim(),
          bid_date: excelDateToJSDate(project['Bid Date']),
          building_type: project['Building Type'],
          project_type: project['Project Type'],
          bid_type: project['Bid Type'],
          total_cost: cleanNumeric(project['Total Cost']),
          total_sqft: cleanNumeric(project['Total SqFt']),
          cost_per_sqft_with_index: cleanNumeric(project['Cost per SqFt with Index']),
          total_cost_per_sqft: cleanNumeric(project['Total Cost per SqFt']),

          // PM Section
          pm_hours: cleanNumeric(project['PM Hours']),
          pm_cost: cleanNumeric(project['PM Cost']),

          // SM Section
          sm_field_rate: getClean('SM Field Rate'),
          sm_shop_rate: getClean('SM Shop Rate'),
          sm_misc_field: getClean('SM Misc Field'),
          sm_misc_field_cost: getClean('SM Misc Field Cost'),
          sm_misc_shop: getClean('SM Misc Shop'),
          sm_misc_shop_cost: getClean('SM Misc Shop Cost'),
          sm_equip_cost: getClean('SM Equip Cost'),

          // S Section (Supply)
          s_field: getClean('S Field'),
          s_field_cost: getClean('S Field Cost'),
          s_shop: getClean('S Shop'),
          s_shop_cost: getClean('S Shop Cost'),
          s_material_cost: getClean('S Material Cost'),
          s_materials_with_escalation: getClean('S Materials with Escalation'),
          s_lbs_per_sq: getClean('S Lbs per Sq'),
          s_lbs: getClean('S Lbs'),

          // R Section (Return)
          r_field: getClean('R Field'),
          r_field_cost: getClean('R Field Cost'),
          r_shop: getClean('R Shop'),
          r_shop_cost: getClean('R Shop Cost'),
          r_material_cost: getClean('R Material Cost'),
          r_materials_with_escalation: getClean('R Materials with Escalation'),
          r_lbs_per_sq: getClean('R Lbs per Sq'),
          r_lbs: getClean('R Lbs'),
          r_plenum: getClean('R Plenum'),

          // E Section (Exhaust)
          e_field: getClean('E Field'),
          e_field_cost: getClean('E Field Cost'),
          e_shop: getClean('E Shop'),
          e_shop_cost: getClean('E Shop Cost'),
          e_material_cost: getClean('E Material Cost'),
          e_material_with_escalation: getClean('E Material with Escalation'),
          e_lbs_per_sq: getClean('E Lbs per Sq'),
          e_lbs: getClean('E Lbs'),

          // O Section (Outside Air)
          o_field: getClean('O Field'),
          o_field_cost: getClean('O Field Cost'),
          o_shop: getClean('O Shop'),
          o_shop_cost: getClean('O Shop Cost'),
          o_material_cost: getClean('O Material Cost'),
          o_materials_with_escalation: getClean('O Materials with Escalation'),
          o_lbs_per_sq: getClean('O Lbs per Sq'),
          o_lbs: getClean('O Lbs'),

          // W Section (Welded)
          w_field: getClean('W Field'),
          w_field_cost: getClean('W Field Cost'),
          w_shop: getClean('W Shop'),
          w_shop_cost: getClean('W Shop Cost'),
          w_material_cost: getClean('W Material Cost'),
          w_materials_with_escalation: getClean('W Materials with Escalation'),
          w_lbs_per_sq: getClean('W Lbs per Sq'),
          w_lbs: getClean('W Lbs'),

          // PF Section (Plumbing Field)
          pf_field_rate: getClean('PF Field Rate'),
          pf_misc_field: getClean('PF Misc Field'),
          pf_misc_field_cost: getClean('PF Misc Field Cost'),
          pf_equip_cost: getClean('PF Equip Cost'),

          // HW Section (Hot Water)
          hw_field: getClean('HW Field'),
          hw_field_cost: getClean('HW Field Cost'),
          hw_material_cost: getClean('HW Material Cost'),
          hw_material_with_esc: getClean('HW Material with Esc'),
          hw_feet_per_sq: getClean('HW Feet per Sq'),
          hw_footage: getClean('HW Footage'),

          // CHW Section (Chilled Water)
          chw_field: getClean('CHW Field'),
          chw_field_cost: getClean('CHW Field Cost'),
          chw_material_cost: getClean('CHW Material Cost'),
          chw_material_with_esc: getClean('CHW Material with Esc'),
          chw_feet_per_sq: getClean('CHW Feet per Sq'),
          chw_footage: getClean('CHW Footage'),

          // D Section (Domestic)
          d_field: getClean('D Field'),
          d_field_cost: getClean('D Field Cost'),
          d_material_cost: getClean('D Material Cost'),
          d_material_with_esc: getClean('D Material with Esc'),
          d_feet_per_sq: getClean('D Feet per Sq'),
          d_footage: getClean('D Footage'),

          // G Section (Gas)
          g_field: getClean('G Field'),
          g_field_cost: getClean('G Field Cost'),
          g_material_cost: getClean('G Material Cost'),
          g_material_with_esc: getClean('G Material with Esc'),
          g_feet_per_sq: getClean('G Feet per Sq'),
          g_footage: getClean('G Footage'),

          // GS Section (Grease)
          gs_field: getClean('GS Field'),
          gs_field_cost: getClean('GS Field Cost'),
          gs_material_cost: getClean('GS Material Cost'),
          gs_material_with_esc: getClean('GS Material with Esc'),
          gs_feet_per_sq: getClean('GS Feet per Sq'),
          gs_footage: getClean('GS Footage'),

          // CW Section (Condensate)
          cw_field: getClean('CW Field'),
          cw_field_cost: getClean('CW Field Cost'),
          cw_material_cost: getClean('CW Material Cost'),
          cw_material_with_esc: getClean('CW Material with Esc'),
          cw_feet_per_sq: getClean('CW Feet per Sq'),
          cw_footage: getClean('CW Footage'),

          // RAD Section (Radiant)
          rad_field: getClean('RAD Field'),
          rad_field_cost: getClean('RAD Field Cost'),
          rad_material_cost: getClean('RAD Material Cost'),
          rad_material_with_esc: getClean('RAD Material with Esc'),
          rad_feet_per_sq: getClean('RAD Feet per Sq'),
          rad_footage: getClean('RAD Footage'),

          // REF Section (Refrigerant)
          ref_field: getClean('REF Field'),
          ref_field_cost: getClean('REF Field Cost'),
          ref_material_cost: getClean('REF Material Cost'),
          ref_material_with_esc: getClean('REF Material with Esc'),
          ref_feet_per_sq: getClean('REF Feet per Sq'),
          ref_footage: getClean('REF Footage'),

          // Stm&Cond Section (Steam & Condensate)
          stm_cond_field: getClean('Stm&Cond Field'),
          stm_cond_field_cost: getClean('Stm&Cond Field Cost'),
          stm_cond_material_cost: getClean('Stm&Cond Material Cost'),
          stm_cond_material_with_esc: getClean('Stm&Cond Material with Esc'),
          stm_cond_feet_per_sq: getClean('Stm&Cond Feet per Sq'),
          stm_cond_footage: getClean('Stm&Cond Footage'),

          // Equipment Counts
          ahu: getInt('AHU'),
          rtu: getInt('RTU'),
          mau: getInt('MAU'),
          eru: getInt('ERU'),
          chiller: getInt('Chiller'),
          drycooler: getInt('Drycooler'),
          vfd: getInt('VFD'),
          vav: getInt('VAV'),
          vav_fan_powered: getInt('VAV - Fan Powered'),
          booster_coil: getInt('Booster Coil'),
          cuh: getInt('CUH'),
          uh: getInt('UH'),
          fcu: getInt('FCU'),
          indoor_vrf_systems: getInt('Indoor VRF Systems'),
          radiant_panels: getInt('Radiant Panels'),
          humidifier: getInt('Humidifier'),
          prv: getInt('PRV'),
          inline_fan: getInt('Inline Fan'),
          high_plume_fan: getInt('High Plume Fan'),
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

          // Additional Costs
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

    // Track stats
    const totalRows = projects.length;
    const validRows = mappedProjects.length;
    const skippedRows = totalRows - validRows;

    // Bulk insert all projects with tenant ID
    const inserted = await HistoricalProject.bulkCreate(mappedProjects, req.tenantId);

    res.json({
      message: `Successfully imported ${inserted.length} historical projects${skippedRows > 0 ? ` (skipped ${skippedRows} empty rows)` : ''}`,
      count: inserted.length,
      skipped: skippedRows,
      total: totalRows
    });
  } catch (error) {
    next(error);
  }
});

// Get all historical projects
router.get('/', async (req, res, next) => {
  try {
    const projects = await HistoricalProject.findAllByTenant(req.tenantId);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Get single historical project
router.get('/:id', async (req, res, next) => {
  try {
    const project = await HistoricalProject.findByIdAndTenant(req.params.id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    next(error);
  }
});

// Update historical project
router.put('/:id', async (req, res, next) => {
  try {
    const project = await HistoricalProject.findByIdAndTenant(req.params.id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = await HistoricalProject.update(req.params.id, req.body, req.tenantId);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete all historical projects (admin only - for re-importing)
// IMPORTANT: This route must come BEFORE /:id route to avoid route conflict
router.delete('/all', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    await HistoricalProject.deleteAllByTenant(req.tenantId);
    res.json({ message: 'All historical projects deleted' });
  } catch (error) {
    next(error);
  }
});

// Delete single historical project
router.delete('/:id', async (req, res, next) => {
  try {
    const project = await HistoricalProject.findByIdAndTenant(req.params.id, req.tenantId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await HistoricalProject.delete(req.params.id, req.tenantId);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
