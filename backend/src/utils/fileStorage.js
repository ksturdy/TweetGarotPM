const { GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getR2Client, isR2Enabled } = require('../config/r2Client');
const config = require('../config');
const path = require('path');
const fs = require('fs');

/**
 * Generate a presigned URL for downloading a file from R2
 * @param {string} fileKey - The R2 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned download URL
 */
async function getPresignedUrl(fileKey, expiresIn = 3600) {
  if (!isR2Enabled()) {
    throw new Error('R2 is not configured');
  }

  const r2Client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: config.r2.bucketName,
    Key: fileKey,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Delete a file from R2 or local storage
 * @param {string} filePath - File path or R2 key
 * @returns {Promise<void>}
 */
async function deleteFile(filePath) {
  if (!filePath) {
    return;
  }

  if (isR2Enabled()) {
    // Delete from R2
    try {
      const r2Client = getR2Client();
      const command = new DeleteObjectCommand({
        Bucket: config.r2.bucketName,
        Key: filePath,
      });

      await r2Client.send(command);
      console.log(`Deleted file from R2: ${filePath}`);
    } catch (error) {
      console.error(`Error deleting file from R2: ${filePath}`, error);
      throw error;
    }
  } else {
    // Delete from local storage
    try {
      // filePath may be absolute (local multer) or relative
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(__dirname, '../../', filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Deleted local file: ${fullPath}`);
      }
    } catch (error) {
      console.error(`Error deleting local file: ${filePath}`, error);
      throw error;
    }
  }
}

/**
 * Get file download stream from R2
 * @param {string} fileKey - The R2 object key
 * @returns {Promise<Object>} File stream and metadata
 */
async function getFileStream(fileKey) {
  if (!isR2Enabled()) {
    throw new Error('R2 is not configured');
  }

  const r2Client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: config.r2.bucketName,
    Key: fileKey,
  });

  const response = await r2Client.send(command);

  return {
    stream: response.Body,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
  };
}

/**
 * Get the public URL for a file
 * For R2: returns the configured public URL or generates presigned URL
 * For local: returns the relative path
 * @param {string} filePath - File path or R2 key
 * @returns {Promise<string>} File URL
 */
async function getFileUrl(filePath) {
  if (!filePath) {
    return null;
  }

  if (isR2Enabled()) {
    // If public URL is configured, use it
    if (config.r2.publicUrl) {
      return `${config.r2.publicUrl}/${filePath}`;
    }

    // Otherwise, generate a presigned URL (valid for 1 hour)
    return await getPresignedUrl(filePath);
  } else {
    // Check if file exists locally first
    const normalized = filePath.replace(/\\/g, '/');
    const idx = normalized.indexOf('uploads/');
    const relativePath = idx !== -1 ? normalized.substring(idx) : filePath;
    const localPath = path.join(__dirname, '../../', relativePath);

    if (fs.existsSync(localPath)) {
      return '/' + relativePath;
    }

    // File not on disk — fall back to R2 public URL if configured
    // (handles local dev pointing at Render DB with R2-uploaded files)
    if (config.r2.publicUrl) {
      return `${config.r2.publicUrl}/${filePath}`;
    }

    // Last resort: return local path (may 404)
    return '/' + relativePath;
  }
}

/**
 * Extract file information from multer upload
 * Works with both R2 (multer-s3) and local storage
 * @param {Object} file - Multer file object
 * @returns {Object} Normalized file info
 */
function getFileInfo(file) {
  if (!file) {
    return null;
  }

  // For R2 (multer-s3), file has 'key' and 'location'
  // For local storage, file has 'path' and 'filename'
  return {
    fileName: file.originalname,
    filePath: file.key || file.path, // R2 uses 'key', local uses 'path'
    fileSize: file.size,
    fileType: file.mimetype,
    location: file.location || null, // R2 provides full URL in 'location'
  };
}

module.exports = {
  getPresignedUrl,
  deleteFile,
  getFileStream,
  getFileUrl,
  getFileInfo,
};
