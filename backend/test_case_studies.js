const axios = require('axios');

(async () => {
  try {
    // Login first
    console.log('Logging in...');
    const loginRes = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'kipp.sturdivant@tweetgarot.com',
      password: 'Dice4123#'
    });

    const token = loginRes.data.token;
    console.log('✅ Login successful');

    // Try to get case studies
    console.log('\nFetching case studies...');
    const casesRes = await axios.get('http://localhost:3001/api/case-studies', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Case studies loaded:', casesRes.data.length, 'items');
    console.log(JSON.stringify(casesRes.data, null, 2));

  } catch (error) {
    console.log('❌ Error occurred');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
  process.exit(0);
})();
