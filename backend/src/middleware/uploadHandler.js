const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getR2Client, isR2Enabled } = require('../config/r2Client');
const config = require('../config');

/**
 * Custom multer storage engine for Cloudflare R2
 */
class R2Storage {
  constructor(opts) {
    this.r2Client = getR2Client();
    this.bucket = config.r2.bucketName;
    this.destination = opts.destination;
  }

  _handleFile(req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${uniqueSuffix}-${sanitizedOriginalName}`;
    const key = `${this.destination}/${fileName}`;

    // Collect file data from stream
    const chunks = [];

    file.stream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    file.stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);

        // Upload to R2
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype,
          Metadata: {
            originalname: file.originalname,
            fieldname: file.fieldname,
          },
        });

        await this.r2Client.send(command);

        // Return file info in multer format
        cb(null, {
          key: key,
          path: key, // For compatibility with local storage
          size: buffer.length,
          bucket: this.bucket,
          mimetype: file.mimetype,
          originalname: file.originalname,
        });
      } catch (error) {
        cb(error);
      }
    });

    file.stream.on('error', cb);
  }

  _removeFile(req, file, cb) {
    // File removal is handled by the deleteFile utility
    cb(null);
  }
}

/**
 * Create multer upload middleware with R2 or local storage
 * @param {Object} options - Upload configuration
 * @param {string} options.destination - Local directory for uploads (e.g., 'uploads/drawings')
 * @param {Array<string>} options.allowedTypes - Allowed MIME types
 * @param {Array<string>} options.allowedExtensions - Allowed file extensions (e.g., ['.xlsm', '.xlsx'])
 * @param {number} options.maxSize - Max file size in bytes
 * @returns {multer.Multer} Configured multer instance
 */
function createUploadMiddleware(options) {
  const {
    destination,
    allowedTypes,
    allowedExtensions,
    maxSize = config.upload.maxFileSize,
  } = options;

  // File filter for allowed types and extensions
  const fileFilter = (req, file, cb) => {
    // If no restrictions, allow all
    if ((!allowedTypes || allowedTypes.length === 0) && (!allowedExtensions || allowedExtensions.length === 0)) {
      return cb(null, true);
    }

    // Check by extension first (more reliable than MIME types)
    if (allowedExtensions && allowedExtensions.length > 0) {
      const fileExt = path.extname(file.originalname).toLowerCase();
      if (allowedExtensions.includes(fileExt)) {
        return cb(null, true);
      }
    }

    // Then check by MIME type
    if (allowedTypes && allowedTypes.includes(file.mimetype)) {
      return cb(null, true);
    }

    // Neither matched - reject
    const allowedInfo = [];
    if (allowedExtensions && allowedExtensions.length > 0) {
      allowedInfo.push(`extensions: ${allowedExtensions.join(', ')}`);
    }
    if (allowedTypes && allowedTypes.length > 0) {
      allowedInfo.push(`types: ${allowedTypes.join(', ')}`);
    }
    cb(new Error(`Invalid file type. Allowed ${allowedInfo.join(' or ')}`));
  };

  let storage;

  // Use R2 if configured, otherwise use local storage
  if (isR2Enabled()) {
    storage = new R2Storage({ destination });
    console.log(`Upload middleware using Cloudflare R2 storage for ${destination}`);
  } else {
    // Local disk storage fallback
    const uploadDir = path.join(__dirname, '../../', destination);

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${uniqueSuffix}-${sanitizedOriginalName}`);
      },
    });

    console.log(`Upload middleware using local storage for ${destination}`);
  }

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxSize,
    },
  });
}

/**
 * Create memory storage middleware (for imports that need processing)
 */
function createMemoryUploadMiddleware(options) {
  const {
    allowedTypes,
    maxSize = config.upload.maxFileSize,
  } = options;

  const fileFilter = (req, file, cb) => {
    if (!allowedTypes || allowedTypes.length === 0) {
      return cb(null, true);
    }

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`));
    }
  };

  return multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
      fileSize: maxSize,
    },
  });
}

module.exports = {
  createUploadMiddleware,
  createMemoryUploadMiddleware,
};
