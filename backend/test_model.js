const ServiceOffering = require('./src/models/ServiceOffering');

(async () => {
  try {
    console.log('Testing ServiceOffering.findAllByTenant...\n');
    
    const offerings = await ServiceOffering.findAllByTenant(1);
    
    console.log('Result type:', typeof offerings);
    console.log('Is array:', Array.isArray(offerings));
    console.log('Count:', offerings.length);
    
    if (offerings.length > 0) {
      console.log('\nFirst offering:');
      console.log(JSON.stringify(offerings[0], null, 2));
    } else {
      console.log('\n❌ No offerings returned');
    }
    
    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
