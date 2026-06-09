require('dotenv').config();
const VistaData = require('../src/models/VistaData');

(async () => {
  try {
    console.log('Running syncLinkedContractData(1) ...');
    const c = await VistaData.syncLinkedContractData(1);
    console.log(`Contracts synced: ${c.synced} / ${c.total_linked} total linked`);

    console.log('\nRunning syncLinkedWorkOrderData(1) ...');
    const w = await VistaData.syncLinkedWorkOrderData(1);
    console.log(`Work orders synced: ${w.synced} / ${w.total_linked} total linked`);

    const pmFixes = (c.changes || []).filter(ch =>
      (ch.fields || []).some(f => f.startsWith('manager:'))
    );
    console.log(`\nContracts with PM change: ${pmFixes.length}`);
    pmFixes.forEach(ch => console.log(`  ${ch.contract_number}: ${ch.fields.join(', ')}`));

    process.exit(0);
  } catch (e) {
    console.error('Sync failed:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
