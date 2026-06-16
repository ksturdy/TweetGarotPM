ALTER TABLE historical_projects ADD COLUMN IF NOT EXISTS market VARCHAR(100);

-- Map project_type (facility type) to top-level market, matching Viewpoint market values
UPDATE historical_projects SET market =
  CASE
    WHEN project_type IN (
      'Healthcare - Clinic', 'Healthcare - Hospital', 'Healthcare - Nursing Home',
      'Healthcare - Surgery Center', 'Healthcare - Hospital Surgery',
      'Office - Medical Office', 'Healthcare - Ambulance Garage',
      'Healthcare - Dental Clinic', 'Healthcare - Pharmacy'
    ) THEN 'Health Care'
    WHEN project_type IN (
      'School', 'Dormitory', 'Science Lab', 'Laboratory', 'Training Center'
    ) THEN 'Educational'
    WHEN project_type IN (
      'Athletic Facility', 'Casino', 'Community Center', 'Museum', 'Event Center'
    ) THEN 'Amusement/Recreation'
    WHEN project_type IN (
      'Office', 'Office - Core & Shell', 'Service Garage/Office', 'Office/Warehouse',
      'Data Center', 'Gas Station', 'Grocery Store', 'Maintenance Building',
      'Office - Buildout', 'Office/Lab', 'Restaurant', 'Retail Store'
    ) THEN 'Commercial'
    WHEN project_type IN ('Plant') THEN 'Manufacturing'
    WHEN project_type IN ('Hotel') THEN 'Lodging'
    WHEN project_type IN ('Church') THEN 'Religious'
    WHEN project_type IN ('Fire Station') THEN 'Public Safety'
    WHEN project_type IN ('Hangar - Airport & Office') THEN 'Transportation'
    WHEN project_type IN ('Apartments') THEN 'Residential'
    ELSE NULL
  END
WHERE market IS NULL;

CREATE INDEX IF NOT EXISTS idx_historical_projects_market ON historical_projects(market);
