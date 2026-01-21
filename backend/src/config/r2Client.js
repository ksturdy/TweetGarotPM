const { S3Client } = require('@aws-sdk/client-s3');
const config = require('./index');

let r2Client = null;

/**
 * Initialize and return Cloudflare R2 client
 * R2 is S3-compatible, so we use AWS SDK v3
 */
function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  // Check if R2 is configured
  if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey) {
    console.warn('Cloudflare R2 credentials not configured. File uploads will use local storage.');
    return null;
  }

  try {
    // Use custom endpoint if provided, otherwise construct from account ID
    const endpoint = config.r2.endpoint || `https://${config.r2.accountId}.r2.cloudflarestorage.com`;

    r2Client = new S3Client({
      region: config.r2.region,
      endpoint: endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });

    console.log(`Cloudflare R2 client initialized successfully (endpoint: ${endpoint})`);
    return r2Client;
  } catch (error) {
    console.error('Failed to initialize R2 client:', error);
    return null;
  }
}

/**
 * Check if R2 is enabled and configured
 */
function isR2Enabled() {
  return !!(
    config.r2.accountId &&
    config.r2.accessKeyId &&
    config.r2.secretAccessKey &&
    config.r2.bucketName
  );
}

module.exports = {
  getR2Client,
  isR2Enabled,
};
