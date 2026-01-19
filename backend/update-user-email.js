const db = require('./src/config/database');

async function updateUserEmail() {
  try {
    // Check if the old email exists
    const checkResult = await db.query(
      'SELECT id, email, first_name, last_name FROM users WHERE email = $1',
      ['kipp.sturdivant@tweetgarot.com']
    );

    if (checkResult.rows.length === 0) {
      console.log('No user found with email: kipp.sturdivant@tweetgarot.com');
      process.exit(0);
    }

    console.log('Found user:', checkResult.rows[0]);

    // Update the email
    const updateResult = await db.query(
      'UPDATE users SET email = $1 WHERE email = $2 RETURNING id, email, first_name, last_name',
      ['admin@tweetgarot.com', 'kipp.sturdivant@tweetgarot.com']
    );

    console.log('\nEmail updated successfully!');
    console.log('Updated user:', updateResult.rows[0]);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateUserEmail();
