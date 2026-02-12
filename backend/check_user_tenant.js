const db = require('./src/config/database');

(async () => {
  try {
    const result = await db.query(
      'SELECT id, email, tenant_id FROM users WHERE email = $1',
      ['kipp.sturdivant@tweetgarot.com']
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('User:', user.email);
      console.log('User ID:', user.id);
      console.log('Tenant ID:', user.tenant_id);
      
      // Check how many offerings this tenant has
      const offeringsResult = await db.query(
        'SELECT COUNT(*) as count FROM service_offerings WHERE tenant_id = $1',
        [user.tenant_id]
      );
      console.log(`\nService offerings for tenant ${user.tenant_id}: ${offeringsResult.rows[0].count}`);
    } else {
      console.log('User not found');
    }
    
    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
