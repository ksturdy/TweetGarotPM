const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getR2Client, isR2Enabled } = require('../config/r2Client');
const config = require('../config');

const THUMB_WIDTH = 300;
const FEED_WIDTH = 1200;

/**
 * Process an uploaded image buffer:
 *   - Strip EXIF/GPS metadata
 *   - Resize to thumbnail (300px wide) and feed (1200px wide)
 *   - Output as JPEG (handles HEIC/PNG/JPG input uniformly)
 *
 * @param {Buffer} inputBuffer  Raw file bytes from multer memory storage
 * @param {string} basePath     Destination prefix (e.g. "uploads/project-photos")
 * @param {string} baseName     Unique base filename without extension
 * @returns {Promise<{thumbPath, feedPath, width, height}>}
 */
async function processAndStoreVariants(inputBuffer, basePath, baseName) {
  // Get original dimensions first
  const meta = await sharp(inputBuffer).metadata();
  const origWidth = meta.width || 0;
  const origHeight = meta.height || 0;

  // Build resized buffers — sharp strips EXIF by default
  const thumbBuffer = await sharp(inputBuffer)
    .rotate() // auto-rotate based on EXIF orientation before stripping
    .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const feedBuffer = await sharp(inputBuffer)
    .rotate()
    .resize(FEED_WIDTH, null, { withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();

  const thumbName = `${baseName}-thumb.jpg`;
  const feedName = `${baseName}-feed.jpg`;
  const thumbKey = `${basePath}/thumbnails/${thumbName}`;
  const feedKey = `${basePath}/feed/${feedName}`;

  if (isR2Enabled()) {
    const r2 = getR2Client();

    await r2.send(new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: thumbKey,
      Body: thumbBuffer,
      ContentType: 'image/jpeg',
    }));

    await r2.send(new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: feedKey,
      Body: feedBuffer,
      ContentType: 'image/jpeg',
    }));
  } else {
    // Local storage
    const thumbDir = path.join(__dirname, '../../', basePath, 'thumbnails');
    const feedDir = path.join(__dirname, '../../', basePath, 'feed');
    fs.mkdirSync(thumbDir, { recursive: true });
    fs.mkdirSync(feedDir, { recursive: true });
    fs.writeFileSync(path.join(thumbDir, thumbName), thumbBuffer);
    fs.writeFileSync(path.join(feedDir, feedName), feedBuffer);
  }

  return {
    thumbPath: thumbKey,
    feedPath: feedKey,
    width: origWidth,
    height: origHeight,
  };
}

module.exports = { processAndStoreVariants };
