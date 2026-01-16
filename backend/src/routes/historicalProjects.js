const express = require('express');
const router = express.Router();
const HistoricalProject = require('../models/HistoricalProject');
const { authenticate } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authenticate);

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

    // Map Excel column names to database field names
    const mappedProjects = projects.map(project => ({
      name: project['Name'],
      bid_date: excelDateToJSDate(project['Bid Date']),
      building_type: project['Building Type'],
      project_type: project['Project Type'],
      bid_type: project['Bid Type'],
      total_cost: project['Total Cost'],
      total_sqft: project['Total SqFt'],
      cost_per_sqft_with_index: project['Cost per SqFt with Index'],
      total_cost_per_sqft: project['Total Cost per SqFt'],

      // PM Section
      pm_hours: project['PM Hours'],
      pm_cost: project['PM Cost'],

      // SM Section
      sm_field_rate: project['SM Field Rate'],
      sm_shop_rate: project['SM Shop Rate'],
      sm_misc_field: project['SM Misc Field'],
      sm_misc_field_cost: project['SM Misc Field Cost'],
      sm_misc_shop: project['SM Misc Shop'],
      sm_misc_shop_cost: project['SM Misc Shop Cost'],
      sm_equip_cost: project['SM Equip Cost'],

      // S Section (Supply)
      s_field: project['S Field'],
      s_field_cost: project['S Field Cost'],
      s_shop: project['S Shop'],
      s_shop_cost: project['S Shop Cost'],
      s_material_cost: project['S Material Cost'],
      s_materials_with_escalation: project['S Materials with Escalation'],
      s_lbs_per_sq: project['S Lbs per Sq'],
      s_lbs: project['S Lbs'],

      // R Section (Return)
      r_field: project['R Field'],
      r_field_cost: project['R Field Cost'],
      r_shop: project['R Shop'],
      r_shop_cost: project['R Shop Cost'],
      r_material_cost: project['R Material Cost'],
      r_materials_with_escalation: project['R Materials with Escalation'],
      r_lbs_per_sq: project['R Lbs per Sq'],
      r_lbs: project['R Lbs'],
      r_plenum: project['R Plenum'],

      // E Section (Exhaust)
      e_field: project['E Field'],
      e_field_cost: project['E Field Cost'],
      e_shop: project['E Shop'],
      e_shop_cost: project['E Shop Cost'],
      e_material_cost: project['E Material Cost'],
      e_material_with_escalation: project['E Material with Escalation'],
      e_lbs_per_sq: project['E Lbs per Sq'],
      e_lbs: project['E Lbs'],

      // O Section (Outside Air)
      o_field: project['O Field'],
      o_field_cost: project['O Field Cost'],
      o_shop: project['O Shop'],
      o_shop_cost: project['O Shop Cost'],
      o_material_cost: project['O Material Cost'],
      o_materials_with_escalation: project['O Materials with Escalation'],
      o_lbs_per_sq: project['O Lbs per Sq'],
      o_lbs: project['O Lbs'],

      // W Section (Welded)
      w_field: project['W Field'],
      w_field_cost: project['W Field Cost'],
      w_shop: project['W Shop'],
      w_shop_cost: project['W Shop Cost'],
      w_material_cost: project['W Material Cost'],
      w_materials_with_escalation: project['W Materials with Escalation'],
      w_lbs_per_sq: project['W Lbs per Sq'],
      w_lbs: project['W Lbs'],

      // PF Section (Plumbing Field)
      pf_field_rate: project['PF Field Rate'],
      pf_misc_field: project['PF Misc Field'],
      pf_misc_field_cost: project['PF Misc Field Cost'],
      pf_equip_cost: project['PF Equip Cost'],

      // HW Section (Hot Water)
      hw_field: project['HW Field'],
      hw_field_cost: project['HW Field Cost'],
      hw_material_cost: project['HW Material Cost'],
      hw_material_with_esc: project['HW Material with Esc'],
      hw_feet_per_sq: project['HW Feet per Sq'],
      hw_footage: project['HW Footage'],

      // CHW Section (Chilled Water)
      chw_field: project['CHW Field'],
      chw_field_cost: project['CHW Field Cost'],
      chw_material_cost: project['CHW Material Cost'],
      chw_material_with_esc: project['CHW Material with Esc'],
      chw_feet_per_sq: project['CHW Feet per Sq'],
      chw_footage: project['CHW Footage'],

      // D Section (Domestic)
      d_field: project['D Field'],
      d_field_cost: project['D Field Cost'],
      d_material_cost: project['D Material Cost'],
      d_material_with_esc: project['D Material with Esc'],
      d_feet_per_sq: project['D Feet per Sq'],
      d_footage: project['D Footage'],

      // G Section (Gas)
      g_field: project['G Field'],
      g_field_cost: project['G Field Cost'],
      g_material_cost: project['G Material Cost'],
      g_material_with_esc: project['G Material with Esc'],
      g_feet_per_sq: project['G Feet per Sq'],
      g_footage: project['G Footage'],

      // GS Section (Grease)
      gs_field: project['GS Field'],
      gs_field_cost: project['GS Field Cost'],
      gs_material_cost: project['GS Material Cost'],
      gs_material_with_esc: project['GS Material with Esc'],
      gs_feet_per_sq: project['GS Feet per Sq'],
      gs_footage: project['GS Footage'],

      // CW Section (Condensate)
      cw_field: project['CW Field'],
      cw_field_cost: project['CW Field Cost'],
      cw_material_cost: project['CW Material Cost'],
      cw_material_with_esc: project['CW Material with Esc'],
      cw_feet_per_sq: project['CW Feet per Sq'],
      cw_footage: project['CW Footage'],

      // RAD Section (Radiant)
      rad_field: project['RAD Field'],
      rad_field_cost: project['RAD Field Cost'],
      rad_material_cost: project['RAD Material Cost'],
      rad_material_with_esc: project['RAD Material with Esc'],
      rad_feet_per_sq: project['RAD Feet per Sq'],
      rad_footage: project['RAD Footage'],

      // REF Section (Refrigerant)
      ref_field: project['REF Field'],
      ref_field_cost: project['REF Field Cost'],
      ref_material_cost: project['REF Material Cost'],
      ref_material_with_esc: project['REF Material with Esc'],
      ref_feet_per_sq: project['REF Feet per Sq'],
      ref_footage: project['REF Footage'],

      // Stm&Cond Section (Steam & Condensate)
      stm_cond_field: project['Stm&Cond Field'],
      stm_cond_field_cost: project['Stm&Cond Field Cost'],
      stm_cond_material_cost: project['Stm&Cond Material Cost'],
      stm_cond_material_with_esc: project['Stm&Cond Material with Esc'],
      stm_cond_feet_per_sq: project['Stm&Cond Feet per Sq'],
      stm_cond_footage: project['Stm&Cond Footage'],

      // Equipment Counts
      ahu: project['AHU'],
      rtu: project['RTU'],
      mau: project['MAU'],
      eru: project['ERU'],
      chiller: project['Chiller'],
      drycooler: project['Drycooler'],
      vfd: project['VFD'],
      vav: project['VAV'],
      vav_fan_powered: project['VAV - Fan Powered'],
      booster_coil: project['Booster Coil'],
      cuh: project['CUH'],
      uh: project['UH'],
      fcu: project['FCU'],
      indoor_vrf_systems: project['Indoor VRF Systems'],
      radiant_panels: project['Radiant Panels'],
      humidifier: project['Humidifier'],
      prv: project['PRV'],
      inline_fan: project['Inline Fan'],
      high_plume_fan: project['High Plume Fan'],
      rac: project['RAC'],
      lieberts: project['Lieberts'],
      grds: project['GRDS'],
      laminar_flow: project['Laminar Flow'],
      louvers: project['Louvers'],
      hoods: project['Hoods'],
      fire_dampers: project['Fire Dampers'],
      silencers: project['Silencers'],
      boilers: project['Boilers'],
      htx: project['HTX'],
      pumps: project['Pumps'],
      cond_pumps: project['Cond Pumps'],
      tower: project['Tower'],
      air_sep: project['Air Sep'],
      exp_tanks: project['Exp Tanks'],
      filters: project['Filters'],
      pot_feeder: project['Pot Feeder'],
      buffer_tank: project['Buffer Tank'],
      triple_duty: project['Triple Duty'],

      // Additional Costs
      truck_rental: project['Truck Rental'],
      temp_heat: project['Temp Heat'],
      controls: project['Controls'],
      insulation: project['Insulation'],
      balancing: project['Balancing'],
      electrical: project['Electrical'],
      general: project['General'],
      allowance: project['Allowance'],
      geo_thermal: project['Geo Thermal'],

      notes: project['Notes']
    }));

    // Bulk insert all projects
    const inserted = await HistoricalProject.bulkCreate(mappedProjects);

    res.json({
      message: `Successfully imported ${inserted.length} historical projects`,
      count: inserted.length
    });
  } catch (error) {
    next(error);
  }
});

// Get all historical projects
router.get('/', async (req, res, next) => {
  try {
    const projects = await HistoricalProject.findAll();
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// Get single historical project
router.get('/:id', async (req, res, next) => {
  try {
    const project = await HistoricalProject.findById(req.params.id);
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
    const project = await HistoricalProject.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = await HistoricalProject.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete single historical project
router.delete('/:id', async (req, res, next) => {
  try {
    const project = await HistoricalProject.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await HistoricalProject.delete(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Delete all historical projects (admin only - for re-importing)
router.delete('/all', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    await HistoricalProject.deleteAll();
    res.json({ message: 'All historical projects deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
