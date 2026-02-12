const { body, validationResult } = require('express-validator');

// Simulate what express-validator does
const normalizedEmail = 'kipp.sturdivant@tweetgarot.com'.toLowerCase().trim();
console.log('Original: kipp.sturdivant@tweetgarot.com');
console.log('Normalized:', normalizedEmail);
console.log('Match:', normalizedEmail === 'kipp.sturdivant@tweetgarot.com');
