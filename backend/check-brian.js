const db = require('./src/config/database');

async function checkBrian() {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, password FROM users WHERE email ILIKE $1',
      ['%brian%']
    );

    console.log('\nBrian Smith user:');
    console.log('================');
    result.rows.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Name: ${user.first_name} ${user.last_name}`);
      console.log(`Role: ${user.role}`);
      console.log(`Has Password: ${user.password ? 'YES' : 'NO'}`);
      console.log(`Password Hash Length: ${user.password ? user.password.length : 0}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBrian();
