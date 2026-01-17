-- Tweet Garot PM Seed Data
-- Run after migrations: npm run seed

-- Clear existing data (in reverse order of dependencies)
TRUNCATE attachments, schedule_items, daily_reports, change_orders, submittals, rfis, projects, users RESTART IDENTITY CASCADE;

-- ============================================
-- USERS
-- ============================================
-- Password for all users: "password123" (bcrypt hash)
INSERT INTO users (email, password, first_name, last_name, role) VALUES
('admin@tweetgarot.com', '$2a$10$rQEY9zS8rXK8rZJ8vX8pทอeH0rV5wX5uZ5uZ5uZ5uZ5uZ5uZ5uZ5u', 'Kipp', 'Sturdivant', 'admin'),
('jsmith@tweetgarot.com', '$2a$10$rQEY9zS8rXK8rZJ8vX8pทอeH0rV5wX5uZ5uZ5uZ5uZ5uZ5uZ5uZ5u', 'John', 'Smith', 'manager'),
('sgarcia@tweetgarot.com', '$2a$10$rQEY9zS8rXK8rZJ8vX8pทอeH0rV5wX5uZ5uZ5uZ5uZ5uZ5uZ5uZ5u', 'Sarah', 'Garcia', 'manager'),
('bwilson@tweetgarot.com', '$2a$10$rQEY9zS8rXK8rZJ8vX8pทอeH0rV5wX5uZ5uZ5uZ5uZ5uZ5uZ5uZ5u', 'Bob', 'Wilson', 'user'),
('emartinez@tweetgarot.com', '$2a$10$rQEY9zS8rXK8rZJ8vX8pทอeH0rV5wX5uZ5uZ5uZ5uZ5uZ5uZ5uZ5u', 'Elena', 'Martinez', 'user');

-- ============================================
-- PROJECTS
-- ============================================
INSERT INTO projects (name, number, client, address, start_date, end_date, status, description, manager_id) VALUES
('Downtown Medical Center HVAC', 'P-2024-001', 'Metro Healthcare Systems', '500 Main Street, Downtown', '2024-01-15', '2024-12-31', 'active', 'Complete HVAC system installation for new 6-story medical facility including clean rooms and surgical suites.', 2),
('Riverside Office Complex', 'P-2024-002', 'Riverside Development LLC', '1200 River Road, Suite 100', '2024-03-01', '2024-09-30', 'active', 'Mechanical systems for 3-building office campus with central plant.', 2),
('Lincoln High School Renovation', 'P-2024-003', 'Lincoln School District', '800 Education Blvd', '2024-02-01', '2024-08-15', 'active', 'HVAC modernization for existing school building, including new rooftop units and controls.', 3),
('Marriott Hotel Downtown', 'P-2023-015', 'Marriott International', '250 Convention Center Dr', '2023-06-01', '2024-02-28', 'completed', '200-room hotel with restaurant, conference center, and pool mechanical systems.', 3),
('Tech Park Data Center', 'P-2024-004', 'CloudFirst Technologies', '5000 Innovation Way', '2024-04-01', '2025-03-31', 'active', 'Precision cooling systems for Tier III data center facility.', 2);

-- ============================================
-- RFIs
-- ============================================
INSERT INTO rfis (project_id, number, subject, question, response, priority, status, due_date, assigned_to, created_by, responded_by, responded_at) VALUES
-- Project 1 RFIs
(1, 1, 'Chiller Plant Room Clearances', 'Drawing M-101 shows 3ft clearance on north side of chiller. Can this be reduced to 2.5ft to accommodate structural column?', 'Approved. 2.5ft clearance is acceptable provided service access panel can fully open. Update shop drawings accordingly.', 'high', 'closed', '2024-02-01', 2, 4, 2, '2024-01-28 14:30:00'),
(1, 2, 'Operating Room Air Change Requirements', 'Confirm required air changes per hour for OR suites 3 and 4. Specs show 20 ACH but code requires 25 ACH minimum.', 'Confirmed: All OR suites require 25 ACH per ASHRAE 170. Update design to comply with current code requirements.', 'urgent', 'closed', '2024-02-05', 2, 4, 2, '2024-02-03 09:15:00'),
(1, 3, 'VAV Box Sizing Discrepancy', 'VAV-2-15 shown as 12" on drawings but schedule calls for 10". Please clarify correct size.', NULL, 'normal', 'open', '2024-02-15', 2, 4, NULL, NULL),
(1, 4, 'Ductwork Routing at Grid Line 5', 'Conflict between supply duct and structural beam at grid 5/C. Request routing alternatives.', NULL, 'high', 'open', '2024-02-20', 2, 5, NULL, NULL),
-- Project 2 RFIs
(2, 1, 'Cooling Tower Location', 'Proposed cooling tower location conflicts with future building phase. Can we relocate to east side of Building A?', 'Approved relocation to east side. Revise piping routing and submit updated drawings for review.', 'normal', 'answered', '2024-04-01', 2, 4, 2, '2024-03-28 11:00:00'),
(2, 2, 'BAS Integration Protocol', 'Confirm communication protocol for BAS integration. Specs mention both BACnet and Modbus.', NULL, 'normal', 'open', '2024-04-15', 3, 5, NULL, NULL),
-- Project 3 RFIs
(3, 1, 'Existing Ductwork Reuse', 'Can existing main trunk ductwork in Gymnasium be reused? Appears to be in good condition.', 'Existing ductwork may be reused after cleaning and inspection. Replace all flex connections and dampers.', 'normal', 'closed', '2024-03-01', 3, 5, 3, '2024-02-25 16:45:00'),
(3, 2, 'Rooftop Unit Structural Support', 'Structural engineer requesting equipment weights for new RTUs. Please provide cut sheets.', NULL, 'high', 'open', '2024-03-15', 3, 4, NULL, NULL);

-- ============================================
-- SUBMITTALS
-- ============================================
INSERT INTO submittals (project_id, number, spec_section, description, subcontractor, status, due_date, review_notes, created_by, reviewed_by, reviewed_at) VALUES
-- Project 1 Submittals
(1, 1, '23 64 00', 'Centrifugal Chillers - Trane CVGF 400 Ton', 'ABC Mechanical', 'approved', '2024-02-01', 'Approved as submitted. Verify electrical requirements with EC.', 4, 2, '2024-01-28 10:00:00'),
(1, 2, '23 37 13', 'Air Handling Units - AHU-1 through AHU-4', 'ABC Mechanical', 'approved_as_noted', '2024-02-10', 'Approved as noted. Add smoke detectors at return air openings per code.', 4, 2, '2024-02-08 14:30:00'),
(1, 3, '23 09 00', 'Building Automation System - Johnson Controls', 'Control Systems Inc', 'under_review', '2024-02-20', NULL, 5, NULL, NULL),
(1, 4, '23 33 00', 'Ductwork - Sheet Metal Shop Drawings', 'Metro Sheet Metal', 'revise_resubmit', '2024-02-15', 'Revise to show coordination with plumbing and electrical. Add hanger details.', 4, 2, '2024-02-12 09:00:00'),
(1, 5, '23 21 13', 'Hydronic Piping - Victaulic Fittings', 'ABC Mechanical', 'pending', '2024-02-25', NULL, 4, NULL, NULL),
-- Project 2 Submittals
(2, 1, '23 65 00', 'Cooling Towers - BAC Series 3000', 'Johnson Cooling', 'approved', '2024-04-01', 'Approved. Coordinate basin heater electrical with EC.', 4, 2, '2024-03-28 11:30:00'),
(2, 2, '23 73 00', 'Rooftop Units - Carrier 50XC', 'Comfort Air Systems', 'approved_as_noted', '2024-04-10', 'Approved as noted. Provide seismic calculations for roof curb attachment.', 5, 3, '2024-04-08 15:00:00'),
(2, 3, '23 09 00', 'DDC Controls - Tridium Niagara', 'Smart Building Controls', 'pending', '2024-04-20', NULL, 5, NULL, NULL),
-- Project 3 Submittals
(3, 1, '23 73 00', 'Rooftop Units - Gymnasium and Cafeteria', 'School HVAC Specialists', 'approved', '2024-03-01', 'Approved as submitted.', 5, 3, '2024-02-26 10:00:00'),
(3, 2, '23 82 16', 'Coils - Replacement Heating Coils', 'Metro Coil Company', 'approved', '2024-03-05', 'Approved. Verify connection sizes match existing.', 5, 3, '2024-03-02 14:00:00');

-- ============================================
-- CHANGE ORDERS
-- ============================================
INSERT INTO change_orders (project_id, number, title, description, reason, amount, days_added, status, rejection_reason, created_by, approved_by, approved_at) VALUES
-- Project 1 Change Orders
(1, 1, 'Additional Isolation Room', 'Add negative pressure isolation room on 3rd floor per revised program', 'Owner requested scope change based on updated healthcare requirements', 45000.00, 5, 'approved', NULL, 2, 1, '2024-02-15 10:00:00'),
(1, 2, 'Upgrade to Variable Speed Chillers', 'Replace constant speed chillers with variable speed units for energy efficiency', 'Value engineering - lifecycle cost savings', 78500.00, 0, 'approved', NULL, 2, 1, '2024-02-20 14:00:00'),
(1, 3, 'Emergency Generator Connection', 'Add mechanical equipment connections to emergency power system', 'Code requirement identified during plan review', 32000.00, 3, 'pending', NULL, 2, NULL, NULL),
(1, 4, 'Premium Efficiency Motors', 'Upgrade all motors above 5HP to premium efficiency', 'Owner request for LEED points', 15750.00, 0, 'draft', NULL, 4, NULL, NULL),
-- Project 2 Change Orders
(2, 1, 'Extended Piping Run to Building C', 'Additional 200ft underground chilled water piping to serve future Building C', 'Master plan coordination', 67500.00, 7, 'approved', NULL, 2, 1, '2024-04-10 09:00:00'),
(2, 2, 'Delete Economizer on RTU-3', 'Remove air-side economizer from RTU-3 due to proximity to loading dock', 'Design coordination issue', -4500.00, 0, 'approved', NULL, 4, 2, '2024-04-12 11:00:00'),
-- Project 3 Change Orders
(3, 1, 'Asbestos Abatement Delay', 'Time extension for unforeseen asbestos in existing ductwork', 'Concealed condition', 0.00, 14, 'approved', NULL, 3, 1, '2024-03-10 15:00:00'),
(3, 2, 'Add CO2 Sensors to Classrooms', 'Install CO2 demand ventilation sensors in all classrooms', 'District sustainability initiative', 18200.00, 0, 'pending', NULL, 5, NULL, NULL);

-- ============================================
-- DAILY REPORTS
-- ============================================
INSERT INTO daily_reports (project_id, report_date, weather, temperature, work_performed, materials, equipment, visitors, issues, created_by) VALUES
-- Project 1 Daily Reports
(1, '2024-02-12', 'Sunny', '45°F', 'Continued installation of chilled water piping on Level 2. Completed 150 linear feet of 6" main. Started hanging ductwork in corridor 2A.', '6" copper pipe (200ft), Victaulic couplings (24), Pipe hangers (48)', 'Scissor lift, Pipe threader, Welding equipment', 'Owner rep (J. Anderson) - progress meeting', 'Minor delay waiting for structural steel completion at grid line 7.', 4),
(1, '2024-02-13', 'Cloudy', '42°F', 'Completed chilled water piping Level 2 east wing. Set AHU-2 on housekeeping pad. Electrical contractor began motor connections.', 'AHU-2 unit, Flex connectors (8), Vibration isolators (4)', 'Crane (4 hours), Rigging equipment, Forklift', 'Mechanical inspector - rough-in inspection passed', 'None', 4),
(1, '2024-02-14', 'Rain', '38°F', 'Indoor work only due to weather. Ductwork installation Level 3. Insulation crew started on Level 1 piping.', 'Ductwork sections, Fiberglass insulation (20 bags), Mastic', 'Scissor lift, Duct lift', 'None', 'Rain delayed rooftop equipment setting. Rescheduled to Friday.', 4),
-- Project 2 Daily Reports
(2, '2024-04-08', 'Sunny', '62°F', 'Cooling tower foundation pour complete. Underground piping 80% complete to Building A. Started equipment pad layout Building B.', 'Concrete (15 yards), Rebar, Underground pipe (300ft)', 'Concrete pump, Excavator, Laser level', 'Structural engineer - foundation inspection', 'None', 4),
(2, '2024-04-09', 'Sunny', '65°F', 'Underground piping complete. Pressure test scheduled tomorrow. RTU curbs delivered and staged. Crane scheduled for Thursday.', 'RTU curbs (6), Flashing material, Caulk', 'Forklift', 'Owner walk-through with tenant rep', 'Curb for RTU-4 arrived damaged. Replacement ordered, due Wednesday.', 5),
-- Project 3 Daily Reports
(3, '2024-03-11', 'Cloudy', '52°F', 'Demo of existing RTU-1 complete. New curb adapter installed. Abatement crew completed section 3 of gymnasium ductwork.', 'Curb adapter, Sheet metal, Fasteners', 'Crane (6 hours), Demo equipment', 'Abatement supervisor, School facilities manager', 'School requested work stop 2pm-4pm for assembly in adjacent gymnasium.', 5),
(3, '2024-03-12', 'Sunny', '55°F', 'Set new RTU-1. Electrical and controls connections in progress. Started ductwork modifications in Cafeteria.', 'RTU-1 unit, Electrical conduit, Control wire', 'Crane (4 hours), Scissor lift', 'Mechanical inspector', 'None', 5);

-- ============================================
-- SCHEDULE ITEMS
-- ============================================
INSERT INTO schedule_items (project_id, parent_id, name, description, start_date, end_date, percent_complete, assigned_to, created_by) VALUES
-- Project 1 Schedule (parent items first, then children)
(1, NULL, 'Underground Rough-in', 'Below slab mechanical rough-in', '2024-01-15', '2024-02-15', 100, 4, 2),
(1, NULL, 'Level 1 Mechanical', 'First floor mechanical installation', '2024-02-01', '2024-04-30', 75, 4, 2),
(1, NULL, 'Level 2 Mechanical', 'Second floor mechanical installation', '2024-03-01', '2024-05-31', 60, 4, 2),
(1, NULL, 'Level 3 Mechanical', 'Third floor mechanical installation', '2024-04-01', '2024-06-30', 40, 5, 2),
(1, NULL, 'Penthouse Equipment', 'Rooftop and penthouse mechanical', '2024-05-01', '2024-07-31', 20, 4, 2),
(1, NULL, 'Controls & TAB', 'Building automation and test/balance', '2024-07-01', '2024-09-30', 0, 5, 2),
(1, NULL, 'Commissioning', 'System commissioning and owner training', '2024-09-01', '2024-11-30', 0, 2, 2),
-- Project 2 Schedule
(2, NULL, 'Site Utilities', 'Underground utilities and central plant prep', '2024-03-01', '2024-04-15', 95, 4, 2),
(2, NULL, 'Central Plant', 'Cooling tower and pump installation', '2024-04-01', '2024-05-31', 50, 4, 2),
(2, NULL, 'Building A HVAC', 'Complete mechanical for Building A', '2024-04-15', '2024-07-15', 35, 5, 2),
(2, NULL, 'Building B HVAC', 'Complete mechanical for Building B', '2024-05-01', '2024-08-15', 15, 5, 2),
(2, NULL, 'Building C HVAC', 'Complete mechanical for Building C', '2024-06-01', '2024-09-15', 0, 4, 2),
-- Project 3 Schedule
(3, NULL, 'Abatement', 'Hazardous material removal', '2024-02-01', '2024-03-15', 100, NULL, 3),
(3, NULL, 'Demo Existing Equipment', 'Remove existing HVAC equipment', '2024-02-15', '2024-03-31', 100, 5, 3),
(3, NULL, 'New Equipment Installation', 'Install new RTUs and ductwork', '2024-03-15', '2024-06-15', 65, 5, 3),
(3, NULL, 'Controls Upgrade', 'New DDC controls throughout', '2024-05-01', '2024-07-15', 20, 5, 3),
(3, NULL, 'Testing & Closeout', 'TAB, commissioning, documentation', '2024-07-01', '2024-08-15', 0, 3, 3);

-- Add child schedule items for Project 1 Level 2 (id=3)
INSERT INTO schedule_items (project_id, parent_id, name, description, start_date, end_date, percent_complete, assigned_to, created_by) VALUES
(1, 3, 'Piping Rough-in', 'Hydronic piping installation', '2024-03-01', '2024-04-15', 80, 4, 2),
(1, 3, 'Ductwork Installation', 'Supply and return ductwork', '2024-03-15', '2024-05-01', 60, 4, 2),
(1, 3, 'Equipment Setting', 'VAV boxes and terminal units', '2024-04-01', '2024-05-15', 40, 5, 2),
(1, 3, 'Insulation', 'Pipe and duct insulation', '2024-04-15', '2024-05-31', 30, 4, 2);

-- Reset sequences to proper values
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));
SELECT setval('rfis_id_seq', (SELECT MAX(id) FROM rfis));
SELECT setval('submittals_id_seq', (SELECT MAX(id) FROM submittals));
SELECT setval('change_orders_id_seq', (SELECT MAX(id) FROM change_orders));
SELECT setval('daily_reports_id_seq', (SELECT MAX(id) FROM daily_reports));
SELECT setval('schedule_items_id_seq', (SELECT MAX(id) FROM schedule_items));
