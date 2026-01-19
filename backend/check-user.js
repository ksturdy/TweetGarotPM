const db = require('./src/config/database');

async function checkUser() {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE email = $1',
      ['Kipp.Sturdivant@tweetgarot.com']
    );

    console.log('User found:', result.rows);

    if (result.rows.length === 0) {
      console.log('\nNo user found with that email.');
      console.log('Checking for similar emails...');
      const similarResult = await db.query(
        "SELECT id, email, first_name, last_name, role FROM users WHERE email ILIKE '%kipp%'"
      );
      console.log('Similar users:', similarResult.rows);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
