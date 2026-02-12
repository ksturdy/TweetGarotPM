const axios = require('axios');

(async () => {
  try {
    // Login
    const loginRes = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'kipp.sturdivant@tweetgarot.com',
      password: 'Dice4123#'
    });

    const token = loginRes.data.token;
    console.log('✅ Logged in\n');

    // Test service offerings
    const response = await axios.get('http://localhost:3001/api/service-offerings', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Status:', response.status);
    console.log('Data type:', typeof response.data);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    console.log('\nCount:', Array.isArray(response.data) ? response.data.length : 'Not an array');

  } catch (error) {
    console.log('❌ Error');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Message:', error.message);
    }
  }
  process.exit(0);
})();
