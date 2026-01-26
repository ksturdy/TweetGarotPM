require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function seedPlatformAdmin() {
  const client = await db.getClient();

  try {
    console.log('Creating platform admin user...\n');

    // Default password - CHANGE IN PRODUCTION
    const password = process.env.PLATFORM_ADMIN_PASSWORD || 'PlatformAdmin123!';
    const email = process.env.PLATFORM_ADMIN_EMAIL || 'platform@titanpm.com';

    const passwordHash = await bcrypt.hash(password, 10);

    // Check if platform admin already exists
    const existingAdmin = await client.query(
      'SELECT id FROM users WHERE is_platform_admin = TRUE'
    );

    if (existingAdmin.rows.length > 0) {
      console.log('Platform admin already exists. Updating password...');
      await client.query(
        `UPDATE users
         SET password = $1, email = $2, updated_at = CURRENT_TIMESTAMP
         WHERE is_platform_admin = TRUE`,
        [passwordHash, email]
      );
      console.log(`Platform admin password updated.`);
    } else {
      // Create the platform admin user
      await client.query(
        `INSERT INTO users (
          email,
          password,
          first_name,
          last_name,
          role,
          is_platform_admin,
          is_active,
          force_password_change,
          tenant_id
        ) VALUES ($1, $2, 'Platform', 'Administrator', 'admin', TRUE, TRUE, FALSE, NULL)`,
        [email, passwordHash]
      );
      console.log('Platform admin user created successfully!');
    }

    console.log('\n─────────────────────────────────────────');
    console.log('Platform Admin Credentials:');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('─────────────────────────────────────────');
    console.log('\n⚠️  IMPORTANT: Change this password in production!');
    console.log('Set PLATFORM_ADMIN_PASSWORD and PLATFORM_ADMIN_EMAIL in .env\n');

  } catch (error) {
    console.error('Failed to create platform admin:', error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

seedPlatformAdmin();
