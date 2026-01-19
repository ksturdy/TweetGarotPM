const express = require('express');
const router = express.Router();
const Vendors = require('../models/vendors');
const multer = require('multer');
const XLSX = require('xlsx');
const { authenticate } = require('../middleware/auth');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
    }
  },
});

// Apply authentication to all routes
router.use(authenticate);

// GET /api/vendors - Get all vendors with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { status, vendor_type, trade_specialty, search } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (vendor_type) filters.vendor_type = vendor_type;
    if (trade_specialty) filters.trade_specialty = trade_specialty;
    if (search) filters.search = search;

    const vendors = await Vendors.findAll(filters);
    res.json(vendors);
  } catch (error) {
    next(error);
  }
});

// GET /api/vendors/:id - Get vendor by ID
router.get('/:id', async (req, res, next) => {
  try {
    const vendor = await Vendors.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// POST /api/vendors - Create new vendor
router.post('/', async (req, res, next) => {
  try {
    const vendor = await Vendors.create(req.body, req.user.id);
    res.status(201).json(vendor);
  } catch (error) {
    next(error);
  }
});

// PUT /api/vendors/:id - Update vendor
router.put('/:id', async (req, res, next) => {
  try {
    const vendor = await Vendors.update(req.params.id, req.body, req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vendors/:id - Delete vendor
router.delete('/:id', async (req, res, next) => {
  try {
    const vendor = await Vendors.delete(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json({ message: 'Vendor deleted successfully', vendor });
  } catch (error) {
    next(error);
  }
});

// POST /api/vendors/import - Import vendors from Excel/CSV
router.post('/import', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse the Excel/CSV file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ message: 'No data found in file' });
    }

    // Map Excel columns to database fields
    const vendorsData = data.map(row => ({
      vendor_name: row['Vendor Name'] || row['vendor_name'] || '',
      company_name: row['Company Name'] || row['company_name'] || '',
      email: row['Email'] || row['email'] || '',
      phone: row['Phone'] || row['phone'] || '',
      address_line1: row['Address Line 1'] || row['address_line1'] || '',
      address_line2: row['Address Line 2'] || row['address_line2'] || '',
      city: row['City'] || row['city'] || '',
      state: row['State'] || row['state'] || '',
      zip_code: row['Zip Code'] || row['zip_code'] || '',
      country: row['Country'] || row['country'] || 'USA',
      payment_terms: row['Payment Terms'] || row['payment_terms'] || '',
      tax_id: row['Tax ID'] || row['tax_id'] || '',
      w9_on_file: row['W9 On File'] || row['w9_on_file'] || false,
      vendor_type: row['Vendor Type'] || row['vendor_type'] || '',
      trade_specialty: row['Trade Specialty'] || row['trade_specialty'] || '',
      insurance_expiry: row['Insurance Expiry'] || row['insurance_expiry'] || null,
      license_number: row['License Number'] || row['license_number'] || '',
      license_expiry: row['License Expiry'] || row['license_expiry'] || null,
      primary_contact: row['Primary Contact'] || row['primary_contact'] || '',
      accounts_payable_contact: row['AP Contact'] || row['accounts_payable_contact'] || '',
      accounts_payable_email: row['AP Email'] || row['accounts_payable_email'] || '',
      rating: row['Rating'] || row['rating'] || null,
      status: row['Status'] || row['status'] || 'active',
      notes: row['Notes'] || row['notes'] || '',
    }));

    // Bulk insert
    const vendors = await Vendors.bulkCreate(vendorsData, req.user.id);

    res.status(201).json({
      message: `Successfully imported ${vendors.length} vendors`,
      count: vendors.length,
      vendors,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/vendors/export/template - Download Excel template
router.get('/export/template', (req, res) => {
  const templateData = [
    {
      'Vendor Name': 'ABC Plumbing',
      'Company Name': 'ABC Plumbing Inc',
      'Email': 'contact@abcplumbing.com',
      'Phone': '555-0200',
      'Address Line 1': '456 Industrial Blvd',
      'Address Line 2': '',
      'City': 'Chicago',
      'State': 'IL',
      'Zip Code': '60601',
      'Country': 'USA',
      'Payment Terms': 'Net 30',
      'Tax ID': '98-7654321',
      'W9 On File': 'true',
      'Vendor Type': 'subcontractor',
      'Trade Specialty': 'Plumbing',
      'Insurance Expiry': '2026-12-31',
      'License Number': 'PL-12345',
      'License Expiry': '2026-12-31',
      'Primary Contact': 'Jane Smith',
      'AP Contact': 'John Billing',
      'AP Email': 'ap@abcplumbing.com',
      'Rating': '5',
      'Status': 'active',
      'Notes': 'Sample vendor record',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendors');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=vendors_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

module.exports = router;
