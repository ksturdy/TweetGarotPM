const Tenant = require('../models/Tenant');
const Project = require('../models/Project');
const VistaData = require('../models/VistaData');
const ProjectSnapshot = require('../models/ProjectSnapshot');

/**
 * Capture financial snapshots for all active/open projects across all tenants.
 * Runs automatically every Thursday at 6:00 PM ET via cron.
 * Can also be triggered manually via POST /api/projects/snapshots/capture-all.
 */
async function captureAllSnapshots() {
  const startTime = Date.now();
  const snapshotDate = new Date().toISOString().split('T')[0];

  console.log(`[Weekly Snapshots] Starting bulk snapshot capture for ${snapshotDate}...`);

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  try {
    const tenants = await Tenant.findAll();

    for (const tenant of tenants) {
      if (!tenant.is_active) continue;

      try {
        // Get both 'active' and 'Open' projects for this tenant
        const activeProjects = await Project.findAllByTenant(tenant.id, { status: 'active' });
        const openProjects = await Project.findAllByTenant(tenant.id, { status: 'Open' });

        // Combine and deduplicate by project id
        const projectMap = new Map();
        [...activeProjects, ...openProjects].forEach(p => projectMap.set(p.id, p));
        const projects = Array.from(projectMap.values());

        for (const project of projects) {
          try {
            const vistaContract = await VistaData.getContractByProjectId(project.id, tenant.id);

            if (!vistaContract) {
              totalSkipped++;
              continue;
            }

            const percentComplete = vistaContract.projected_revenue && vistaContract.projected_revenue > 0
              ? vistaContract.earned_revenue / vistaContract.projected_revenue
              : null;

            const snapshotData = {
              projectId: project.id,
              tenantId: tenant.id,
              snapshotDate,
              createdBy: null, // Automated system snapshot
              vistaData: {
                orig_contract_amount: vistaContract.orig_contract_amount,
                contract_amount: vistaContract.contract_amount,
                approved_changes: vistaContract.approved_changes,
                pending_change_orders: vistaContract.pending_change_orders,
                change_order_count: vistaContract.change_order_count,
                projected_revenue: vistaContract.projected_revenue,
                earned_revenue: vistaContract.earned_revenue,
                backlog: vistaContract.backlog,
                percent_complete: percentComplete,
                gross_profit_dollars: vistaContract.gross_profit_dollars,
                gross_profit_percent: vistaContract.gross_profit_percent,
                original_estimated_margin: project.override_original_estimated_margin ?? vistaContract.original_estimated_margin,
                original_estimated_margin_pct: project.override_original_estimated_margin_pct ?? vistaContract.original_estimated_margin_pct,
                billed_amount: vistaContract.billed_amount,
                received_amount: vistaContract.received_amount,
                open_receivables: vistaContract.open_receivables,
                cash_flow: vistaContract.cash_flow,
                actual_cost: vistaContract.actual_cost,
                projected_cost: vistaContract.projected_cost,
                current_est_cost: vistaContract.current_est_cost,
                actual_labor_rate: vistaContract.actual_labor_rate,
                estimated_labor_rate: vistaContract.estimated_labor_rate,
                current_est_labor_cost: vistaContract.current_est_labor_cost,
                ttl_labor_projected: vistaContract.ttl_labor_projected,
                material_estimate: vistaContract.material_estimate,
                material_jtd: vistaContract.material_jtd,
                material_projected: vistaContract.material_projected,
                subcontracts_estimate: vistaContract.subcontracts_estimate,
                subcontracts_jtd: vistaContract.subcontracts_jtd,
                subcontracts_projected: vistaContract.subcontracts_projected,
                rentals_estimate: vistaContract.rentals_estimate,
                rentals_jtd: vistaContract.rentals_jtd,
                rentals_projected: vistaContract.rentals_projected,
                mep_equip_estimate: vistaContract.mep_equip_estimate,
                mep_equip_jtd: vistaContract.mep_equip_jtd,
                mep_equip_projected: vistaContract.mep_equip_projected,
                pf_hours_estimate: vistaContract.pf_hours_estimate,
                pf_hours_jtd: vistaContract.pf_hours_jtd,
                pf_hours_projected: vistaContract.pf_hours_projected,
                sm_hours_estimate: vistaContract.sm_hours_estimate,
                sm_hours_jtd: vistaContract.sm_hours_jtd,
                sm_hours_projected: vistaContract.sm_hours_projected,
                pl_hours_estimate: vistaContract.pl_hours_estimate,
                pl_hours_jtd: vistaContract.pl_hours_jtd,
                pl_hours_projected: vistaContract.pl_hours_projected,
                total_hours_estimate: vistaContract.total_hours_estimate,
                total_hours_jtd: vistaContract.total_hours_jtd,
                total_hours_projected: vistaContract.total_hours_projected,
              }
            };

            await ProjectSnapshot.create(snapshotData);
            totalCreated++;
          } catch (err) {
            totalErrors++;
            console.error(`[Weekly Snapshots] Error snapshotting project ${project.id} (${project.name}):`, err.message);
          }
        }
      } catch (err) {
        console.error(`[Weekly Snapshots] Error processing tenant ${tenant.id} (${tenant.company_name}):`, err.message);
      }
    }
  } catch (err) {
    console.error('[Weekly Snapshots] Fatal error fetching tenants:', err.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Weekly Snapshots] Complete: ${totalCreated} created, ${totalSkipped} skipped (no Vista contract), ${totalErrors} errors. (${duration}s)`);

  return { totalCreated, totalSkipped, totalErrors, duration };
}

module.exports = { captureAllSnapshots };
