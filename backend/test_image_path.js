require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  const res = await db.query('SELECT id, file_path FROM case_study_images LIMIT 1');
  const fp = res.rows[0].file_path;
  console.log('raw file_path:', fp);

  // Simulate the frontend getImageUrl logic
  const normalized = fp.replace(/\\/g, '/');
  console.log('normalized:', normalized);

  const idx = normalized.indexOf('uploads/');
  console.log('indexOf uploads/:', idx);

  if (idx !== -1) {
    const url = '/' + normalized.substring(idx);
    console.log('final URL:', url);
  }

  process.exit(0);
})();
