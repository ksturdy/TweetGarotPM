-- Fix estimate totals calculation to match cumulative formula
-- Contingency should be calculated on (subtotal + overhead + profit)
-- Bond should be calculated on (subtotal + overhead + profit + contingency)

CREATE OR REPLACE FUNCTION update_estimate_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update section totals
  UPDATE estimate_sections
  SET
    labor_cost = COALESCE((
      SELECT SUM(labor_cost + labor_burden_amount)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    material_cost = COALESCE((
      SELECT SUM(material_cost + material_waste_amount)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    equipment_cost = COALESCE((
      SELECT SUM(equipment_cost)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    subcontractor_cost = COALESCE((
      SELECT SUM(subcontractor_cost)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    rental_cost = COALESCE((
      SELECT SUM(rental_cost)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    total_cost = COALESCE((
      SELECT SUM(total_cost)
      FROM estimate_line_items
      WHERE section_id = estimate_sections.id
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.section_id, OLD.section_id);

  -- Update estimate totals
  UPDATE estimates
  SET
    labor_cost = COALESCE((
      SELECT SUM(labor_cost + labor_burden_amount)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    material_cost = COALESCE((
      SELECT SUM(material_cost + material_waste_amount)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    equipment_cost = COALESCE((
      SELECT SUM(equipment_cost)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    subcontractor_cost = COALESCE((
      SELECT SUM(subcontractor_cost)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    rental_cost = COALESCE((
      SELECT SUM(rental_cost)
      FROM estimate_line_items
      WHERE estimate_id = estimates.id
    ), 0),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Calculate subtotal and overhead first
  UPDATE estimates
  SET
    subtotal = labor_cost + material_cost + equipment_cost + subcontractor_cost + rental_cost,
    overhead_amount = (labor_cost + material_cost + equipment_cost + subcontractor_cost + rental_cost) * (overhead_percentage / 100)
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Calculate profit based on (subtotal + overhead)
  UPDATE estimates
  SET
    profit_amount = (subtotal + overhead_amount) * (profit_percentage / 100)
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Calculate contingency based on (subtotal + overhead + profit)
  UPDATE estimates
  SET
    contingency_amount = (subtotal + overhead_amount + profit_amount) * (contingency_percentage / 100)
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Calculate bond based on (subtotal + overhead + profit + contingency)
  UPDATE estimates
  SET
    bond_amount = (subtotal + overhead_amount + profit_amount + contingency_amount) * (bond_percentage / 100)
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Calculate final total
  UPDATE estimates
  SET
    total_cost = subtotal + overhead_amount + profit_amount + contingency_amount + bond_amount
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the percentage trigger function to match
CREATE OR REPLACE FUNCTION update_estimate_percentage_totals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.subtotal := NEW.labor_cost + NEW.material_cost + NEW.equipment_cost + NEW.subcontractor_cost + NEW.rental_cost;
  NEW.overhead_amount := NEW.subtotal * (NEW.overhead_percentage / 100);
  NEW.profit_amount := (NEW.subtotal + NEW.overhead_amount) * (NEW.profit_percentage / 100);
  NEW.contingency_amount := (NEW.subtotal + NEW.overhead_amount + NEW.profit_amount) * (NEW.contingency_percentage / 100);
  NEW.bond_amount := (NEW.subtotal + NEW.overhead_amount + NEW.profit_amount + NEW.contingency_amount) * (NEW.bond_percentage / 100);
  NEW.total_cost := NEW.subtotal + NEW.overhead_amount + NEW.profit_amount + NEW.contingency_amount + NEW.bond_amount;
  NEW.updated_at := CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recalculate all existing estimates with the corrected formula
UPDATE estimate_line_items SET updated_at = updated_at WHERE id IS NOT NULL;
