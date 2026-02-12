const axios = require('axios');

(async () => {
  try {
    console.log('Testing login endpoint...\n');

    const response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'kipp.sturdivant@tweetgarot.com',
      password: 'Dice4123#'
    });

    console.log('✅ Login successful!');
    console.log('Response:', {
      user: response.data.user,
      token: response.data.token ? 'Token received' : 'No token',
    });

  } catch (error) {
    console.log('❌ Login failed');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else if (error.request) {
      console.log('No response from server - is backend running?');
      console.log('Error:', error.message);
    } else {
      console.log('Error:', error.message);
    }
  }
  process.exit(0);
})();
