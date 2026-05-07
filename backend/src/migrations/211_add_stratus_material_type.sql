-- Migration 211: Add material classification to stratus_parts
--
-- Promotes ServiceType / CutType / ServiceGroup from raw JSONB to typed columns,
-- and adds a derived material_type bucket so that earned-value reporting can
-- separate pipe (linear feet) from fittings, welds, valves, ductwork, etc.
--
-- Rule (mirrored in backend/src/utils/stratusImporter.js — keep them in sync):
--   service_type = 'Pipework' AND description matches \ypipe|tube\y
--                AND description does NOT match fitting keywords
--                AND length > 1                        => 'pipe'
--   service_type = 'Pipework' AND description does NOT match fitting keywords
--                AND length > 5                        => 'pipe'   (catches "Generic Pipework")
--   service_type = 'Pipework' otherwise                => 'pipe_fitting'
--   service_type = 'Weld'                              => 'weld'
--   service_type = 'Valve'                             => 'valve'
--   service_type = 'Hanger'                            => 'hanger'
--   service_type = 'Coupling'                          => 'coupling'
--   service_type IN ('Equipment','Mechanical Equipment')          => 'equipment'
--   service_type IN ('Round Duct','Rectangular Duct')             => 'duct'
--   service_type IN ('Duct Fittings','Duct Accessory',
--                    'Duct Accessories','Air Terminals',
--                    'Flex Ducts','Ducts')                        => 'duct_accessory'
--   else                                                          => 'other'
--
-- material_type_override is a nullable manual reclassification; queries should
-- prefer COALESCE(material_type_override, material_type).

ALTER TABLE stratus_parts
  ADD COLUMN IF NOT EXISTS service_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cut_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS service_group VARCHAR(100),
  ADD COLUMN IF NOT EXISTS material_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS material_type_override VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_stratus_parts_material
  ON stratus_parts(tenant_id, project_id, import_id, material_type);

-- Backfill existing rows from the raw JSONB blob captured at import.
UPDATE stratus_parts
SET service_type = raw->>'ServiceType',
    cut_type = raw->>'CutType',
    service_group = raw->>'ServiceGroup'
WHERE service_type IS NULL AND raw IS NOT NULL;

-- Derive material_type using the same rule the importer applies to new rows.
UPDATE stratus_parts
SET material_type = CASE
  WHEN service_type = 'Pipework' THEN
    CASE
      WHEN LOWER(COALESCE(item_description,'')) ~ '\y(pipe|tube)\y'
       AND LOWER(COALESCE(item_description,'')) !~ '\y(elbow|tee|reducer|flange|coupling|gasket|gskt|sockolet|stub|nipple|cap|adapter|union|olet|ell|cplg|fitting)\y'
       AND COALESCE(length, 0) > 1
        THEN 'pipe'
      WHEN LOWER(COALESCE(item_description,'')) !~ '\y(elbow|tee|reducer|flange|coupling|gasket|gskt|sockolet|stub|nipple|cap|adapter|union|olet|ell|cplg|fitting)\y'
       AND COALESCE(length, 0) > 5
        THEN 'pipe'
      ELSE 'pipe_fitting'
    END
  WHEN service_type = 'Weld' THEN 'weld'
  WHEN service_type = 'Valve' THEN 'valve'
  WHEN service_type = 'Hanger' THEN 'hanger'
  WHEN service_type = 'Coupling' THEN 'coupling'
  WHEN service_type IN ('Equipment','Mechanical Equipment') THEN 'equipment'
  WHEN service_type IN ('Round Duct','Rectangular Duct') THEN 'duct'
  WHEN service_type IN ('Duct Fittings','Duct Accessory','Duct Accessories','Air Terminals','Flex Ducts','Ducts') THEN 'duct_accessory'
  ELSE 'other'
END
WHERE material_type IS NULL;
