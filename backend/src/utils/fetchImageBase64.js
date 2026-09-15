const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getR2Client, isR2Enabled } = require('../config/r2Client');
const config = require('../config');

const MIME_BY_EXT = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

/**
 * Fetch an uploaded file as a base64 data URL, resizing for PDF embedding.
 * maxPx: longest edge limit (default 600px keeps PDFs small while staying crisp)
 */
async function fetchImageBase64(filename, maxPx = 600) {
  if (!filename) return null;

  try {
    let buffer;

    if (isR2Enabled()) {
      if (config.r2.publicUrl) {
        const url = `${config.r2.publicUrl}/${filename}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        buffer = Buffer.from(await response.arrayBuffer());
      } else {
        const r2Client = getR2Client();
        const command = new GetObjectCommand({ Bucket: config.r2.bucketName, Key: filename });
        const { Body } = await r2Client.send(command);
        const chunks = [];
        for await (const chunk of Body) chunks.push(chunk);
        buffer = Buffer.concat(chunks);
      }
    } else {
      const normalized = filename.replace(/\\/g, '/');
      const idx = normalized.indexOf('uploads/');
      const relativePath = idx !== -1 ? normalized.substring(idx) : filename;
      const localPath = path.join(__dirname, '../../', relativePath);
      if (!fs.existsSync(localPath)) return null;
      buffer = fs.readFileSync(localPath);
    }

    // Resize and convert to JPEG for compact PDF embedding
    const resized = await sharp(buffer)
      .resize({ width: maxPx, height: maxPx, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch (err) {
    console.error(`fetchImageBase64 failed for ${filename}:`, err.message);
    return null;
  }
}

module.exports = { fetchImageBase64 };
