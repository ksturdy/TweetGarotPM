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
    console.log('✅ Login successful\n');

    // Test service offerings endpoint
    console.log('Fetching service offerings...');
    const response = await axios.get('http://localhost:3001/api/service-offerings', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`✅ Found ${response.data.length} service offerings`);
    console.log('\nFirst 3 offerings:');
    response.data.slice(0, 3).forEach(offering => {
      console.log(`  ${offering.icon_name} ${offering.name} (${offering.category})`);
    });

    // Test category filter
    console.log('\nFetching HVAC offerings...');
    const hvacRes = await axios.get('http://localhost:3001/api/service-offerings?category=HVAC', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ Found ${hvacRes.data.length} HVAC offerings`);

    // Test categories endpoint
    console.log('\nFetching categories...');
    const catRes = await axios.get('http://localhost:3001/api/service-offerings/categories', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`✅ Categories: ${catRes.data.join(', ')}`);

  } catch (error) {
    console.log('❌ Error occurred');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
  process.exit(0);
})();
