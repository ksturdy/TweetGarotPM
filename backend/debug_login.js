const axios = require('axios');

(async () => {
  try {
    console.log('Attempting login...');
    console.log('Email: kipp.sturdivant@tweetgarot.com');
    console.log('Password: Dice4123#\n');

    const response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'kipp.sturdivant@tweetgarot.com',
      password: 'Dice4123#'
    }, {
      validateStatus: () => true // Don't throw on any status
    });

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log('Request error:', error.message);
  }
  process.exit(0);
})();
