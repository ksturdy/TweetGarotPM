require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function resetPassword() {
  const client = await db.getClient();

  try {
    // Hash a simple password
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 10);

    console.log('🔐 Resetting local admin passwords...\n');

    // Update admin@tweetgarot.com
    const result1 = await client.query(`
      UPDATE users
      SET password = $1, is_active = true
      WHERE email = 'admin@tweetgarot.com'
      RETURNING id, email, first_name, last_name, role
    `, [passwordHash]);

    if (result1.rows.length > 0) {
      console.log('✅ Updated admin@tweetgarot.com');
      console.log('   Password: password123');
      console.log(`   User: ${result1.rows[0].first_name} ${result1.rows[0].last_name} (${result1.rows[0].role})\n`);
    } else {
      console.log('⚠️  admin@tweetgarot.com not found\n');
    }

    // Update kipp.sturdivant@tweetgarot.com
    const result2 = await client.query(`
      UPDATE users
      SET password = $1, is_active = true
      WHERE email = 'kipp.sturdivant@tweetgarot.com'
      RETURNING id, email, first_name, last_name, role
    `, [passwordHash]);

    if (result2.rows.length > 0) {
      console.log('✅ Updated kipp.sturdivant@tweetgarot.com');
      console.log('   Password: password123');
      console.log(`   User: ${result2.rows[0].first_name} ${result2.rows[0].last_name} (${result2.rows[0].role})\n`);
    } else {
      console.log('⚠️  kipp.sturdivant@tweetgarot.com not found\n');
    }

    // Show all users
    const allUsers = await client.query(`
      SELECT id, email, first_name, last_name, role, is_active
      FROM users
      ORDER BY id
    `);

    console.log('📋 All users in local database:');
    console.log('─────────────────────────────────────────────────────────');
    allUsers.rows.forEach(user => {
      const status = user.is_active ? '✓' : '✗';
      console.log(`${status} ${user.email} - ${user.first_name} ${user.last_name} (${user.role})`);
    });
    console.log('─────────────────────────────────────────────────────────');
    console.log('\n✅ Done! Try logging in with:');
    console.log('   Email: admin@tweetgarot.com');
    console.log('   Password: password123');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

resetPassword();
