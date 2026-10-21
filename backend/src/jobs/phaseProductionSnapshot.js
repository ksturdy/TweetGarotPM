const WeeklyProduction = require('../models/WeeklyProduction');

async function runPhaseProductionSnapshot() {
  console.log('[PhaseProductionSnapshot] Starting Sunday snapshot...');
  const result = await WeeklyProduction.snapshotAllTenants();
  console.log(`[PhaseProductionSnapshot] Done: ${result.total} rows, ${result.errors} errors`);
  return result;
}

module.exports = { runPhaseProductionSnapshot };
