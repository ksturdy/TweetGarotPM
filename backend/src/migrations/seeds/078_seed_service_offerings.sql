-- Seed Service Offerings for Tweet Garot Mechanical
-- Note: This inserts sample data for tenant_id = 1

-- HVAC Services
INSERT INTO service_offerings (tenant_id, name, description, category, pricing_model, typical_duration_days, icon_name, display_order, is_active)
VALUES
(1, 'HVAC System Installation', 'Complete installation of heating, ventilation, and air conditioning systems for commercial and industrial facilities', 'HVAC', 'custom', 30, '❄️', 1, true),
(1, 'HVAC Maintenance & Repair', 'Preventive maintenance and repair services for existing HVAC systems', 'HVAC', 'hourly', 5, '🔧', 2, true),
(1, 'Ductwork Design & Installation', 'Custom ductwork design, fabrication, and installation services', 'HVAC', 'per_unit', 14, '🌀', 3, true),
(1, 'Energy Efficiency Upgrades', 'HVAC system upgrades to improve energy efficiency and reduce operating costs', 'HVAC', 'fixed', 21, '⚡', 4, true),
(1, 'Building Automation Controls', 'Installation and programming of building automation and HVAC control systems', 'Controls', 'custom', 14, '🎛️', 5, true);

-- Plumbing Services
INSERT INTO service_offerings (tenant_id, name, description, category, pricing_model, typical_duration_days, icon_name, display_order, is_active)
VALUES
(1, 'Commercial Plumbing Installation', 'Complete plumbing system installation for new construction and renovations', 'Plumbing', 'custom', 30, '🚰', 6, true),
(1, 'Plumbing Maintenance', 'Regular maintenance and inspection of commercial plumbing systems', 'Plumbing', 'hourly', 3, '🔍', 7, true),
(1, 'Emergency Plumbing Repair', 'Fast-response emergency plumbing repair services', 'Plumbing', 'hourly', 1, '🚨', 8, true),
(1, 'Backflow Prevention', 'Installation and testing of backflow prevention devices', 'Plumbing', 'fixed', 2, '↩️', 9, true);

-- Sheet Metal Services
INSERT INTO service_offerings (tenant_id, name, description, category, pricing_model, typical_duration_days, icon_name, display_order, is_active)
VALUES
(1, 'Custom Sheet Metal Fabrication', 'Custom fabrication of sheet metal components for HVAC and industrial applications', 'Sheet Metal', 'per_unit', 7, '🔨', 10, true),
(1, 'Metal Roofing & Flashing', 'Installation of metal roofing systems and flashing details', 'Sheet Metal', 'custom', 14, '🏗️', 11, true),
(1, 'Architectural Sheet Metal', 'Custom architectural sheet metal work for building exteriors', 'Sheet Metal', 'custom', 21, '🎨', 12, true);

-- Mechanical Services
INSERT INTO service_offerings (tenant_id, name, description, category, pricing_model, typical_duration_days, icon_name, display_order, is_active)
VALUES
(1, 'Boiler Installation & Repair', 'Installation, maintenance, and repair of commercial boiler systems', 'Mechanical', 'custom', 14, '🔥', 13, true),
(1, 'Chiller Systems', 'Installation and servicing of commercial chiller systems', 'Mechanical', 'custom', 21, '🧊', 14, true),
(1, 'Piping Systems', 'Design and installation of mechanical piping systems', 'Mechanical', 'custom', 30, '🔩', 15, true);

-- Specialty Services
INSERT INTO service_offerings (tenant_id, name, description, category, pricing_model, typical_duration_days, icon_name, display_order, is_active)
VALUES
(1, 'Indoor Air Quality Assessment', 'Comprehensive assessment and improvement of indoor air quality', 'Specialty', 'fixed', 3, '💨', 16, true),
(1, 'Commissioning Services', 'Building systems commissioning and performance verification', 'Specialty', 'custom', 21, '✅', 17, true),
(1, '24/7 Emergency Service', 'Round-the-clock emergency service for critical systems', 'Specialty', 'hourly', 1, '🕐', 18, true);

-- Comment
COMMENT ON TABLE service_offerings IS 'Sample service offerings seeded for Tweet Garot Mechanical';
