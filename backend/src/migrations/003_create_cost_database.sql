-- Historical HVAC Project Cost Database
-- This stores past project data for estimating future projects

CREATE TABLE IF NOT EXISTS historical_projects (
  id SERIAL PRIMARY KEY,

  -- Project Information
  name VARCHAR(255) NOT NULL,
  bid_date DATE,
  building_type VARCHAR(100),
  project_type VARCHAR(100),
  bid_type VARCHAR(100),

  -- Cost Summary
  total_cost DECIMAL(12,2),
  total_sqft DECIMAL(10,2),
  cost_per_sqft_with_index DECIMAL(10,2),
  total_cost_per_sqft DECIMAL(10,2),

  -- Project Management (PM)
  pm_hours DECIMAL(10,2),
  pm_cost DECIMAL(12,2),

  -- Sheet Metal (SM)
  sm_field_rate DECIMAL(10,2),
  sm_shop_rate DECIMAL(10,2),
  sm_misc_field DECIMAL(10,2),
  sm_misc_field_cost DECIMAL(12,2),
  sm_misc_shop DECIMAL(10,2),
  sm_misc_shop_cost DECIMAL(12,2),
  sm_equip_cost DECIMAL(12,2),

  -- Supply Air (S)
  s_field DECIMAL(10,2),
  s_field_cost DECIMAL(12,2),
  s_shop DECIMAL(10,2),
  s_shop_cost DECIMAL(12,2),
  s_material_cost DECIMAL(12,2),
  s_materials_with_escalation DECIMAL(12,2),
  s_lbs_per_sq DECIMAL(10,4),
  s_lbs DECIMAL(10,2),

  -- Return Air (R)
  r_field DECIMAL(10,2),
  r_field_cost DECIMAL(12,2),
  r_shop DECIMAL(10,2),
  r_shop_cost DECIMAL(12,2),
  r_material_cost DECIMAL(12,2),
  r_materials_with_escalation DECIMAL(12,2),
  r_lbs_per_sq DECIMAL(10,4),
  r_lbs DECIMAL(10,2),
  r_plenum DECIMAL(10,2),

  -- Exhaust (E)
  e_field DECIMAL(10,2),
  e_field_cost DECIMAL(12,2),
  e_shop DECIMAL(10,2),
  e_shop_cost DECIMAL(12,2),
  e_material_cost DECIMAL(12,2),
  e_material_with_escalation DECIMAL(12,2),
  e_lbs_per_sq DECIMAL(10,4),
  e_lbs DECIMAL(10,2),

  -- Outside Air (O)
  o_field DECIMAL(10,2),
  o_field_cost DECIMAL(12,2),
  o_shop DECIMAL(10,2),
  o_shop_cost DECIMAL(12,2),
  o_material_cost DECIMAL(12,2),
  o_materials_with_escalation DECIMAL(12,2),
  o_lbs_per_sq DECIMAL(10,4),
  o_lbs DECIMAL(10,2),

  -- Welded (W)
  w_field DECIMAL(10,2),
  w_field_cost DECIMAL(12,2),
  w_shop DECIMAL(10,2),
  w_shop_cost DECIMAL(12,2),
  w_material_cost DECIMAL(12,2),
  w_materials_with_escalation DECIMAL(12,2),
  w_lbs_per_sq DECIMAL(10,4),
  w_lbs DECIMAL(10,2),

  -- Plumbing/Piping Field (PF)
  pf_field_rate DECIMAL(10,2),
  pf_misc_field DECIMAL(10,2),
  pf_misc_field_cost DECIMAL(12,2),
  pf_equip_cost DECIMAL(12,2),

  -- Hot Water (HW)
  hw_field DECIMAL(10,2),
  hw_field_cost DECIMAL(12,2),
  hw_material_cost DECIMAL(12,2),
  hw_material_with_esc DECIMAL(12,2),
  hw_feet_per_sq DECIMAL(10,4),
  hw_footage DECIMAL(10,2),

  -- Chilled Water (CHW)
  chw_field DECIMAL(10,2),
  chw_field_cost DECIMAL(12,2),
  chw_material_cost DECIMAL(12,2),
  chw_material_with_esc DECIMAL(12,2),
  chw_feet_per_sq DECIMAL(10,4),
  chw_footage DECIMAL(10,2),

  -- Domestic Water (D)
  d_field DECIMAL(10,2),
  d_field_cost DECIMAL(12,2),
  d_material_cost DECIMAL(12,2),
  d_material_with_esc DECIMAL(12,2),
  d_feet_per_sq DECIMAL(10,4),
  d_footage DECIMAL(10,2),

  -- Gas (G)
  g_field DECIMAL(10,2),
  g_field_cost DECIMAL(12,2),
  g_material_cost DECIMAL(12,2),
  g_material_with_esc DECIMAL(12,2),
  g_feet_per_sq DECIMAL(10,4),
  g_footage DECIMAL(10,2),

  -- Grease (GS)
  gs_field DECIMAL(10,2),
  gs_field_cost DECIMAL(12,2),
  gs_material_cost DECIMAL(12,2),
  gs_material_with_esc DECIMAL(12,2),
  gs_feet_per_sq DECIMAL(10,4),
  gs_footage DECIMAL(10,2),

  -- Condensate Water (CW)
  cw_field DECIMAL(10,2),
  cw_field_cost DECIMAL(12,2),
  cw_material_cost DECIMAL(12,2),
  cw_material_with_esc DECIMAL(12,2),
  cw_feet_per_sq DECIMAL(10,4),
  cw_footage DECIMAL(10,2),

  -- Radiant (RAD)
  rad_field DECIMAL(10,2),
  rad_field_cost DECIMAL(12,2),
  rad_material_cost DECIMAL(12,2),
  rad_material_with_esc DECIMAL(12,2),
  rad_feet_per_sq DECIMAL(10,4),
  rad_footage DECIMAL(10,2),

  -- Refrigerant (REF)
  ref_field DECIMAL(10,2),
  ref_field_cost DECIMAL(12,2),
  ref_material_cost DECIMAL(12,2),
  ref_material_with_esc DECIMAL(12,2),
  ref_feet_per_sq DECIMAL(10,4),
  ref_footage DECIMAL(10,2),

  -- Steam & Condensate (Stm&Cond)
  stm_cond_field DECIMAL(10,2),
  stm_cond_field_cost DECIMAL(12,2),
  stm_cond_material_cost DECIMAL(12,2),
  stm_cond_material_with_esc DECIMAL(12,2),
  stm_cond_feet_per_sq DECIMAL(10,4),
  stm_cond_footage DECIMAL(10,2),

  -- Equipment Counts
  ahu INTEGER,
  rtu INTEGER,
  mau INTEGER,
  eru INTEGER,
  chiller INTEGER,
  drycooler INTEGER,
  vfd INTEGER,
  vav INTEGER,
  vav_fan_powered INTEGER,
  booster_coil INTEGER,
  cuh INTEGER,
  uh INTEGER,
  fcu INTEGER,
  indoor_vrf_systems INTEGER,
  radiant_panels INTEGER,
  humidifier INTEGER,
  prv INTEGER,
  inline_fan INTEGER,
  high_plume_fan INTEGER,
  rac INTEGER,
  lieberts INTEGER,
  grds INTEGER,
  laminar_flow INTEGER,
  louvers INTEGER,
  hoods INTEGER,
  fire_dampers INTEGER,
  silencers INTEGER,

  -- Plumbing Equipment
  boilers INTEGER,
  htx INTEGER,
  pumps INTEGER,
  cond_pumps INTEGER,
  tower INTEGER,
  air_sep INTEGER,
  exp_tanks INTEGER,
  filters INTEGER,
  pot_feeder INTEGER,
  buffer_tank INTEGER,
  triple_duty INTEGER,

  -- Additional Costs
  truck_rental DECIMAL(12,2),
  temp_heat DECIMAL(12,2),
  controls DECIMAL(12,2),
  insulation DECIMAL(12,2),
  balancing DECIMAL(12,2),
  electrical DECIMAL(12,2),
  general DECIMAL(12,2),
  allowance DECIMAL(12,2),
  geo_thermal DECIMAL(12,2),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

-- Create indexes for common queries
CREATE INDEX idx_historical_projects_building_type ON historical_projects(building_type);
CREATE INDEX idx_historical_projects_project_type ON historical_projects(project_type);
CREATE INDEX idx_historical_projects_bid_date ON historical_projects(bid_date);
CREATE INDEX idx_historical_projects_total_sqft ON historical_projects(total_sqft);

-- Create a view for easy cost per sqft analysis
CREATE OR REPLACE VIEW project_cost_analysis AS
SELECT
  id,
  name,
  building_type,
  project_type,
  bid_date,
  total_sqft,
  total_cost,
  cost_per_sqft_with_index,

  -- Calculate percentages
  CASE WHEN total_cost > 0 THEN (s_materials_with_escalation / total_cost * 100) ELSE 0 END as supply_percent,
  CASE WHEN total_cost > 0 THEN (r_materials_with_escalation / total_cost * 100) ELSE 0 END as return_percent,
  CASE WHEN total_cost > 0 THEN (hw_material_with_esc / total_cost * 100) ELSE 0 END as hot_water_percent,
  CASE WHEN total_cost > 0 THEN (chw_material_with_esc / total_cost * 100) ELSE 0 END as chilled_water_percent,
  CASE WHEN total_cost > 0 THEN (sm_equip_cost / total_cost * 100) ELSE 0 END as sheet_metal_equip_percent,
  CASE WHEN total_cost > 0 THEN (pf_equip_cost / total_cost * 100) ELSE 0 END as plumbing_equip_percent,
  CASE WHEN total_cost > 0 THEN (controls / total_cost * 100) ELSE 0 END as controls_percent
FROM historical_projects;
