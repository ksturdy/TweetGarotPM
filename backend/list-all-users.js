const db = require('./src/config/database');

async function listAllUsers() {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role FROM users ORDER BY email'
    );

    console.log('\nAll users in database:');
    console.log('======================');
    result.rows.forEach(user => {
      console.log(`${user.id}: ${user.email} - ${user.first_name} ${user.last_name} (${user.role})`);
    });
    console.log(`\nTotal users: ${result.rows.length}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listAllUsers();
