-- Add cost_maps JSONB column to pipe_specs table
-- Stores material cost data from EST catalog alongside the existing rate sub-tables
-- Structure: { pipeCosts: {size→$/ft}, fittingCosts: {type→{size→$/ea}},
--              reducingFittingCosts: {type→{key→$/ea}}, reducingTeeCosts: {key→$/ea} }

ALTER TABLE pipe_specs
  ADD COLUMN IF NOT EXISTS cost_maps JSONB DEFAULT '{}';
