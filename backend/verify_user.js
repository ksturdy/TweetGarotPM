const db = require('./src/config/database');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const email = 'kipp.sturdivant@tweetgarot.com';
    const testPassword = 'Dice4123#';

    // Get user from database
    const result = await db.query(
      'SELECT id, email, password, role, tenant_id FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('\n📋 User Details:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Tenant ID: ${user.tenant_id}`);
    console.log(`   Password hash (first 20 chars): ${user.password.substring(0, 20)}...`);

    // Test password
    const isMatch = await bcrypt.compare(testPassword, user.password);
    console.log(`\n🔐 Password Test:`);
    console.log(`   Testing: "${testPassword}"`);
    console.log(`   Result: ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);

    if (!isMatch) {
      console.log('\n⚠️  Password does not match! Let me try updating it again...');
      const newHash = await bcrypt.hash(testPassword, 10);
      await db.query('UPDATE users SET password = $1 WHERE email = $2', [newHash, email]);
      console.log('✅ Password updated again');
    }

    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
