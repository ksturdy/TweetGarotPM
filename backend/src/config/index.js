require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
  },
  r2: {
    accountId: process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME,
    region: process.env.CLOUDFLARE_R2_REGION || process.env.R2_REGION || 'auto',
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL,
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT || process.env.R2_ENDPOINT,
  },
};
