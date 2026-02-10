const fs = require('fs');
const path = require('path');
const Tenant = require('../models/Tenant');

/**
 * Fetch tenant logo as base64 data URL for embedding in PDFs.
 * Tries tenant's R2 logo URL first, falls back to local file.
 * @param {number} tenantId - The tenant ID
 * @returns {Promise<string>} Base64 data URL string, or empty string if no logo
 */
async function fetchLogoBase64(tenantId) {
  // Try tenant's logo URL from database (R2 or other remote URL)
  if (tenantId) {
    try {
      const tenant = await Tenant.findById(tenantId);
      const logoUrl = tenant?.settings?.branding?.logo_url;

      if (logoUrl && logoUrl.startsWith('http')) {
        const response = await fetch(logoUrl);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get('content-type') || 'image/png';
          return `data:${contentType};base64,${buffer.toString('base64')}`;
        }
      }
    } catch (error) {
      console.error('Error fetching tenant logo from URL:', error.message);
    }
  }

  // Fallback: try local file (for development)
  try {
    const logoPath = path.join(__dirname, '../../uploads/TweetGarotLogo.png');
    const logoBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (error) {
    // No logo available
    return '';
  }
}

module.exports = { fetchLogoBase64 };
