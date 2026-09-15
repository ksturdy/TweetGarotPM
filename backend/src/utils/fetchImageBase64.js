const fs = require('fs');
const path = require('path');
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
 * Fetch an uploaded file as a base64 data URL.
 * Works with both R2 and local disk storage.
 */
async function fetchImageBase64(filename) {
  if (!filename) return null;

  try {
    if (isR2Enabled()) {
      if (config.r2.publicUrl) {
        const url = `${config.r2.publicUrl}/${filename}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${buffer.toString('base64')}`;
      } else {
        // Stream directly from R2
        const r2Client = getR2Client();
        const command = new GetObjectCommand({ Bucket: config.r2.bucketName, Key: filename });
        const { Body, ContentType } = await r2Client.send(command);
        const chunks = [];
        for await (const chunk of Body) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        return `data:${ContentType || 'image/jpeg'};base64,${buffer.toString('base64')}`;
      }
    } else {
      const normalized = filename.replace(/\\/g, '/');
      const idx = normalized.indexOf('uploads/');
      const relativePath = idx !== -1 ? normalized.substring(idx) : filename;
      const localPath = path.join(__dirname, '../../', relativePath);
      if (!fs.existsSync(localPath)) return null;
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(filename).toLowerCase();
      const contentType = MIME_BY_EXT[ext] || 'image/jpeg';
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    }
  } catch (err) {
    console.error(`fetchImageBase64 failed for ${filename}:`, err.message);
    return null;
  }
}

module.exports = { fetchImageBase64 };
