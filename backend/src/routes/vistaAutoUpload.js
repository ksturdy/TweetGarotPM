const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configure multer for Excel file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `vista-auto-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel files allowed.'));
    }
  },
});

// API Key authentication
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  console.log('[Vista Auto-Import] API key check:', apiKey ? 'Key provided' : 'No key');

  if (!apiKey || apiKey !== process.env.TITAN_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  req.user = { id: 'system', role: 'admin' };
  req.tenantId = process.env.DEFAULT_TENANT_ID || 1;
  next();
};

// POST /api/vista-auto/upload
router.post('/upload', apiKeyAuth, upload.single('file'), async (req, res, next) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    console.log(`[Vista Auto-Import] Starting import of ${req.file.originalname}`);
    const startTime = Date.now();

    const workbook = XLSX.readFile(tempFilePath, { sheetRows: 0, bookSheets: true });
    const sheetNames = workbook.SheetNames;
    console.log(`[Vista Auto-Import] Found sheets: ${sheetNames.join(', ')}`);

    const results = {
      success: true,
      file: req.file.originalname,
      sheetsFound: sheetNames,
      sheetsProcessed: []
    };

    const knownSheets = ['TGPBI_PMContractStatus', 'TGPBI_SMWorkOrderStatus', 'TGPREmployees', 'TGARCustomers', 'TGAPVendors'];

    for (const sheet of knownSheets) {
      if (sheetNames.includes(sheet)) {
        results.sheetsProcessed.push(sheet);
      }
    }

    if (tempFilePath) {
      fs.unlink(tempFilePath, () => {});
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Vista Auto-Import] Complete in ${totalTime}s`);

    res.json({ ...results, duration: `${totalTime}s` });
  } catch (error) {
    console.error('[Vista Auto-Import] Error:', error.message);
    if (tempFilePath) fs.unlink(tempFilePath, () => {});
    next(error);
  }
});

module.exports = router;
