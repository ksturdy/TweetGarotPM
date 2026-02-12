const User = require('./src/models/User');

(async () => {
  try {
    console.log('Testing User.findByEmail...\n');
    
    const user = await User.findByEmail('kipp.sturdivant@tweetgarot.com');
    
    if (!user) {
      console.log('❌ User not found');
    } else {
      console.log('✅ User found:');
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  Role:', user.role);
      console.log('  Active:', user.is_active);
      console.log('  Has password:', !!user.password);
      
      console.log('\n🔐 Testing password comparison...');
      const isMatch = await User.comparePassword('Dice4123#', user.password);
      console.log('  Password match:', isMatch ? '✅ YES' : '❌ NO');
    }
    
    process.exit(0);
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
