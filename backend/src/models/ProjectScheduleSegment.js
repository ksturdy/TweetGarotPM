const db = require('../config/database');

// Canonical segment definitions — order determines display order in the UI
const SEGMENT_DEFINITIONS = [
  { key: '30',          label: 'Sheet Metal Field', isLabor: true },
  { key: '35',          label: 'Sheet Metal Shop',  isLabor: true },
  { key: '40',          label: 'Pipefitter Field',  isLabor: true },
  { key: '45',          label: 'Pipefitter Shop',   isLabor: true },
  { key: '50',          label: 'Plumbing Field',    isLabor: true },
  { key: '55',          label: 'Plumbing Shop',     isLabor: true },
  { key: '70',          label: 'Overhead',          isLabor: true },
  { key: 'bas',         label: 'BAS',               isLabor: true },
  { key: 'material',    label: 'Material',          isLabor: false },
  { key: 'subcontract', label: 'Subcontracts',      isLabor: false },
  { key: 'rental',      label: 'Rentals',           isLabor: false },
  { key: 'equipment',   label: 'MEP Equipment',     isLabor: false },
  { key: 'gc',          label: 'General Conditions',isLabor: false },
];

async function getByProject(projectId, tenantId) {
  const { rows } = await db.query(
    `SELECT segment_key, label, start_date, end_date, contour_type, weekly_hours
       FROM project_schedule_segments
      WHERE project_id = $1 AND tenant_id = $2
      ORDER BY id`,
    [projectId, tenantId]
  );
  return rows;
}

async function upsertSegment(projectId, tenantId, segmentKey, label, startDate, endDate, contourType, weeklyHours) {
  const { rows } = await db.query(
    `INSERT INTO project_schedule_segments
       (project_id, tenant_id, segment_key, label, start_date, end_date, contour_type, weekly_hours, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (project_id, segment_key)
     DO UPDATE SET
       label        = EXCLUDED.label,
       start_date   = EXCLUDED.start_date,
       end_date     = EXCLUDED.end_date,
       contour_type = EXCLUDED.contour_type,
       weekly_hours = COALESCE(EXCLUDED.weekly_hours, project_schedule_segments.weekly_hours),
       updated_at   = NOW()
     RETURNING segment_key, label, start_date, end_date, contour_type, weekly_hours`,
    [projectId, tenantId, segmentKey, label, startDate || null, endDate || null, contourType || 'flat', weeklyHours ?? null]
  );
  return rows[0];
}

// Creates all 13 segment rows pre-populated with projectStart/projectEnd.
// Skips any segment that already exists (idempotent).
async function initializeSegments(projectId, tenantId, projectStart, projectEnd) {
  for (const seg of SEGMENT_DEFINITIONS) {
    await db.query(
      `INSERT INTO project_schedule_segments
         (project_id, tenant_id, segment_key, label, start_date, end_date, contour_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'flat')
       ON CONFLICT (project_id, segment_key) DO UPDATE
         SET start_date = EXCLUDED.start_date,
             end_date   = EXCLUDED.end_date
         WHERE project_schedule_segments.start_date IS NULL
           AND project_schedule_segments.end_date IS NULL`,
      [projectId, tenantId, seg.key, seg.label, projectStart || null, projectEnd || null]
    );
  }
  return getByProject(projectId, tenantId);
}

// Returns which segment keys are "active" for this project based on Vista phase codes
async function getActiveSegmentKeys(projectId, tenantId) {
  const { rows } = await db.query(
    `SELECT DISTINCT
       CASE
         WHEN UPPER(phase) LIKE 'BAS%'             THEN 'bas'
         WHEN cost_type = 1 AND LEFT(phase,2)='30' THEN '30'
         WHEN cost_type = 1 AND LEFT(phase,2)='35' THEN '35'
         WHEN cost_type = 1 AND LEFT(phase,2)='40' THEN '40'
         WHEN cost_type = 1 AND LEFT(phase,2)='45' THEN '45'
         WHEN cost_type = 1 AND LEFT(phase,2)='50' THEN '50'
         WHEN cost_type = 1 AND LEFT(phase,2)='55' THEN '55'
         WHEN cost_type = 1 AND LEFT(phase,2)='70' THEN '70'
         WHEN cost_type = 2 THEN 'material'
         WHEN cost_type = 3 THEN 'subcontract'
         WHEN cost_type = 4 THEN 'rental'
         WHEN cost_type = 5 THEN 'equipment'
         WHEN cost_type = 6 THEN 'gc'
         ELSE NULL
       END AS segment_key
     FROM vp_phase_codes
     WHERE linked_project_id = $1 AND tenant_id = $2`,
    [projectId, tenantId]
  );
  return rows.filter((r) => r.segment_key != null).map((r) => r.segment_key);
}

// Aggregates vp_phase_codes costs rolled up per segment key
async function getCostsByProject(projectId, tenantId) {
  const { rows } = await db.query(
    `SELECT segment_key,
            SUM(NULLIF(est_cost,       'NaN'::numeric)) AS est_cost,
            SUM(NULLIF(est_hours,      'NaN'::numeric)) AS est_hours,
            SUM(NULLIF(jtd_cost,       'NaN'::numeric)) AS jtd_cost,
            SUM(NULLIF(jtd_hours,      'NaN'::numeric)) AS jtd_hours,
            SUM(NULLIF(projected_cost, 'NaN'::numeric)) AS projected_cost
       FROM (
         SELECT
           CASE
             WHEN UPPER(phase) LIKE 'BAS%'             THEN 'bas'
             WHEN cost_type = 1 AND LEFT(phase,2)='30' THEN '30'
             WHEN cost_type = 1 AND LEFT(phase,2)='35' THEN '35'
             WHEN cost_type = 1 AND LEFT(phase,2)='40' THEN '40'
             WHEN cost_type = 1 AND LEFT(phase,2)='45' THEN '45'
             WHEN cost_type = 1 AND LEFT(phase,2)='50' THEN '50'
             WHEN cost_type = 1 AND LEFT(phase,2)='55' THEN '55'
             WHEN cost_type = 1 AND LEFT(phase,2)='70' THEN '70'
             WHEN cost_type = 2 THEN 'material'
             WHEN cost_type = 3 THEN 'subcontract'
             WHEN cost_type = 4 THEN 'rental'
             WHEN cost_type = 5 THEN 'equipment'
             WHEN cost_type = 6 THEN 'gc'
             ELSE NULL
           END AS segment_key,
           est_cost, est_hours, jtd_cost, jtd_hours, projected_cost
         FROM vp_phase_codes
         WHERE linked_project_id = $1 AND tenant_id = $2
       ) sub
      WHERE segment_key IS NOT NULL
      GROUP BY segment_key`,
    [projectId, tenantId]
  );
  return rows;
}

async function patchWeeklyHours(projectId, tenantId, segmentKey, weeklyHours) {
  await db.query(
    `UPDATE project_schedule_segments
        SET weekly_hours = $1, updated_at = NOW()
      WHERE project_id = $2 AND tenant_id = $3 AND segment_key = $4`,
    [weeklyHours ?? null, projectId, tenantId, segmentKey]
  );
}

async function getBulkByProjects(projectIds, tenantId) {
  if (!projectIds || projectIds.length === 0) return {};
  const { rows } = await db.query(
    `SELECT project_id, segment_key, label, start_date, end_date, contour_type, weekly_hours
       FROM project_schedule_segments
      WHERE project_id = ANY($1::int[]) AND tenant_id = $2`,
    [projectIds, tenantId]
  );
  const result = {};
  for (const row of rows) {
    if (!result[row.project_id]) result[row.project_id] = [];
    result[row.project_id].push({
      segment_key: row.segment_key,
      label: row.label,
      start_date: row.start_date,
      end_date: row.end_date,
      contour_type: row.contour_type,
      weekly_hours: row.weekly_hours,
    });
  }
  return result;
}

module.exports = {
  SEGMENT_DEFINITIONS,
  getByProject,
  getBulkByProjects,
  patchWeeklyHours,
  upsertSegment,
  initializeSegments,
  getActiveSegmentKeys,
  getCostsByProject,
};
