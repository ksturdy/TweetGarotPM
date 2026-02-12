const db = require('./src/config/database');

(async () => {
  try {
    const result = await db.query(
      'SELECT id, email, is_active FROM users WHERE email LIKE $1',
      ['%kipp%']
    );
    
    console.log('Users matching kipp:');
    result.rows.forEach(user => {
      console.log(`  ID: ${user.id}, Email: "${user.email}", Active: ${user.is_active}`);
    });
    
    process.exit(0);
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
