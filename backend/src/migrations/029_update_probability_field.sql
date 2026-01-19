-- Update probability field from integer percentage to Low/Medium/High enum

-- Check if opportunities.probability is already text-based, if so skip
DO $$
BEGIN
  -- Check if probability column exists and is numeric type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opportunities'
    AND column_name = 'probability'
    AND data_type IN ('integer', 'numeric', 'smallint', 'bigint')
  ) THEN
    -- Add a temporary column for the new probability type
    ALTER TABLE opportunities ADD COLUMN probability_level VARCHAR(20);

    -- Migrate existing data based on percentage ranges
    UPDATE opportunities
    SET probability_level = CASE
      WHEN probability IS NULL THEN NULL
      WHEN probability::INTEGER <= 33 THEN 'Low'
      WHEN probability::INTEGER <= 66 THEN 'Medium'
      ELSE 'High'
    END;

    -- Drop the old probability column
    ALTER TABLE opportunities DROP COLUMN probability;

    -- Rename the new column to probability
    ALTER TABLE opportunities RENAME COLUMN probability_level TO probability;

    -- Add a check constraint to ensure only valid values
    ALTER TABLE opportunities ADD CONSTRAINT probability_check CHECK (probability IN ('Low', 'Medium', 'High') OR probability IS NULL);
  END IF;
END $$;

-- Update pipeline_stages probability column to be text-based as well
DO $$
BEGIN
  -- Check if probability column exists and is numeric type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pipeline_stages'
    AND column_name = 'probability'
    AND data_type IN ('integer', 'numeric', 'smallint', 'bigint')
  ) THEN
    ALTER TABLE pipeline_stages ADD COLUMN probability_level VARCHAR(20);

    UPDATE pipeline_stages
    SET probability_level = CASE
      WHEN probability IS NULL THEN NULL
      WHEN probability::INTEGER <= 33 THEN 'Low'
      WHEN probability::INTEGER <= 66 THEN 'Medium'
      ELSE 'High'
    END;

    ALTER TABLE pipeline_stages DROP COLUMN probability;
    ALTER TABLE pipeline_stages RENAME COLUMN probability_level TO probability;
    ALTER TABLE pipeline_stages ADD CONSTRAINT stage_probability_check CHECK (probability IN ('Low', 'Medium', 'High') OR probability IS NULL);
  END IF;
END $$;

-- Add comment for clarity
COMMENT ON COLUMN opportunities.probability IS 'Win probability: Low, Medium, or High';
COMMENT ON COLUMN pipeline_stages.probability IS 'Stage default probability: Low, Medium, or High';
