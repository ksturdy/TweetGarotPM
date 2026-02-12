const db = require('./src/config/database');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    const email = 'kipp.sturdivant@tweetgarot.com';
    const newPassword = 'Dice4123#';

    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    const result = await db.query(
      'UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email',
      [hashedPassword, email]
    );

    if (result.rows.length > 0) {
      console.log(`✅ Password updated successfully for ${result.rows[0].email}`);
      console.log(`   New password: ${newPassword}`);
    } else {
      console.log('❌ User not found');
    }

    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
