const express = require('express');
const router = express.Router();
const VistaData = require('../models/VistaData');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// Helper function to convert Excel serial date to JS Date
const excelDateToJS = (excelDate) => {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate; // Already a string date
  // Excel dates start from 1900-01-01 (day 1 = 1)
  // JavaScript dates use milliseconds since 1970-01-01
  const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
  const jsDate = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
  return jsDate.toISOString().split('T')[0]; // Return as YYYY-MM-DD
};

// Helper function to parse numbers, preserving 0 values (not treating them as null)
const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

// Configure multer for Excel file uploads - use disk storage to avoid memory issues
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `vista-upload-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit (Render.com constraint)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) files are allowed.'));
    }
  },
});

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Admin check middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// ==================== STATS ====================

// GET /api/vista/stats - Get Vista data statistics
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await VistaData.getStats(req.tenantId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ==================== IMPORT ====================

// GET /api/vista/import/history - Get import history
router.get('/import/history', async (req, res, next) => {
  try {
    const history = await VistaData.getImportHistory(req.tenantId);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Multer error handler wrapper
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File too large. Maximum size is 100MB.' });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      // Other errors (like invalid file type from fileFilter)
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// POST /api/vista/import/upload - Import both contracts and work orders from single Excel file
router.post('/import/upload', requireAdmin, handleUpload, async (req, res, next) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    console.log(`[Vista Import] Starting import of ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    const startTime = Date.now();

    // Parse Excel file with minimal memory - only get sheet names first
    console.log('[Vista Import] Reading Excel structure...');
    const workbook = XLSX.readFile(tempFilePath, {
      sheetRows: 0,  // Don't load data yet, just structure
      bookSheets: true
    });
    const sheetNames = workbook.SheetNames;
    console.log(`[Vista Import] Found sheets: ${sheetNames.join(', ')}`);

    // Helper to load a single sheet on demand
    const loadSheet = (sheetName) => {
      const wb = XLSX.readFile(tempFilePath, { sheets: sheetName });
      return XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    };

    const results = {
      contracts: { total: 0, new: 0, updated: 0, batch_id: null },
      workOrders: { total: 0, new: 0, updated: 0, batch_id: null },
      employees: { total: 0, new: 0, updated: 0, batch_id: null },
      customers: { total: 0, new: 0, updated: 0, batch_id: null },
      vendors: { total: 0, new: 0, updated: 0, batch_id: null },
      facilities: { total: 0, created: 0, updated: 0, not_found: 0 },
      sheetsFound: [],
      sheetsProcessed: []
    };

    // Process Contracts sheet (TGPBI_PMContractStatus)
    const contractSheetName = 'TGPBI_PMContractStatus';
    if (sheetNames.includes(contractSheetName)) {
      console.log(`[Vista Import] Processing ${contractSheetName}...`);
      results.sheetsFound.push(contractSheetName);
      const data = loadSheet(contractSheetName);
      console.log(`[Vista Import] ${contractSheetName}: ${data.length} rows to process`);

      if (data.length > 0) {
        // Log available columns from first row for debugging
        if (data[0]) {
          const columns = Object.keys(data[0]);
          console.log(`[Vista Import] ${contractSheetName} columns: ${columns.join(', ')}`);
        }

        // Create import batch for contracts
        const batch = await VistaData.createImportBatch({
          file_name: req.file.originalname,
          file_type: 'contracts',
          records_total: data.length,
          imported_by: req.user.id
        }, req.tenantId);

        let newCount = 0;
        let updatedCount = 0;

        for (const row of data) {
          const contractData = {
            contract_number: String(row['Contract'] || row['Contract Number'] || '').trim(),
            description: row['Contract Description'] || row['Description'] || '',
            status: row['Contract Status'] || row['Status'] || '',
            employee_number: row['Employee Number Emp Number'] ? String(row['Employee Number Emp Number']) : null,
            project_manager_name: row['Project Manager'] || '',
            department_code: row['Department'] || '',
            // Handle column names with/without spaces (based on actual Excel columns)
            orig_contract_amount: parseNumber(row[' Orig Contract Amt '] ?? row['Orig Contract Amt']),
            contract_amount: parseNumber(row[' Contract Amt '] ?? row['Contract Amt']),
            billed_amount: parseNumber(row[' Billed Amt '] ?? row['Billed Amt']),
            received_amount: parseNumber(row[' Received Amt '] ?? row['Received Amt']),
            backlog: parseNumber(row[' Backlog '] ?? row['Backlog']),
            projected_revenue: parseNumber(row[' Projected Revenue '] ?? row['Projected Revenue']),
            gross_profit_percent: parseNumber(row['Gross Profit %'] ?? row[' Gross Profit % ']),
            earned_revenue: parseNumber(row[' EarnedRevenue '] ?? row['EarnedRevenue']),
            actual_cost: parseNumber(row['Actual Cost'] ?? row[' Actual Cost ']),
            projected_cost: parseNumber(row['Projected Cost'] ?? row[' Projected Cost ']),
            // Hours - Pipefitter (PF)
            pf_hours_estimate: parseNumber(row[' PF Hours Estimate '] ?? row['PF Hours Estimate']),
            pf_hours_jtd: parseNumber(row[' PF Hours JTD '] ?? row['PF Hours JTD']),
            pf_hours_projected: parseNumber(row[' PF Hours Projected '] ?? row['PF Hours Projected']),
            // Hours - Sheet Metal (SM)
            sm_hours_estimate: parseNumber(row[' SM Hours Estimate '] ?? row['SM Hours Estimate']),
            sm_hours_jtd: parseNumber(row[' SM Hours JTD '] ?? row['SM Hours JTD']),
            sm_hours_projected: parseNumber(row[' SM Hours Projected '] ?? row['SM Hours Projected']),
            // Hours - Plumber (PL)
            pl_hours_estimate: parseNumber(row[' PL Hours Estimate '] ?? row['PL Hours Estimate']),
            pl_hours_jtd: parseNumber(row[' PL Hours JTD '] ?? row['PL Hours JTD']),
            pl_hours_projected: parseNumber(row[' PL Hours Projected '] ?? row['PL Hours Projected']),
            // Hours - Total
            total_hours_estimate: parseNumber(row[' Total Hours Estimate '] ?? row['Total Hours Estimate']),
            total_hours_jtd: parseNumber(row[' Total Hours JTD '] ?? row['Total Hours JTD']),
            total_hours_projected: parseNumber(row[' Total Hours Projected '] ?? row['Total Hours Projected']),
            // Cost breakdown - Material
            material_jtd: parseNumber(row[' Material JTD '] ?? row['Material JTD']),
            material_estimate: parseNumber(row[' Material Estimate '] ?? row['Material Estimate']),
            material_projected: parseNumber(row[' Material Projected '] ?? row['Material Projected']),
            // Cost breakdown - Subcontracts
            subcontracts_jtd: parseNumber(row[' Subcontracts JTD '] ?? row['Subcontracts JTD']),
            subcontracts_estimate: parseNumber(row[' Subcontracts Estimate '] ?? row['Subcontracts Estimate']),
            subcontracts_projected: parseNumber(row[' Subcontracts Projected '] ?? row['Subcontracts Projected']),
            // Cost breakdown - Rentals
            rentals_jtd: parseNumber(row[' Rentals JTD '] ?? row['Rentals JTD']),
            rentals_estimate: parseNumber(row[' Rentals Estimate '] ?? row['Rentals Estimate']),
            rentals_projected: parseNumber(row[' Rentals Projected '] ?? row['Rentals Projected']),
            // Cost breakdown - MEP Equipment
            mep_equip_jtd: parseNumber(row[' MEP Equip JTD '] ?? row['MEP Equip JTD']),
            mep_equip_estimate: parseNumber(row[' MEP Equip Estimate '] ?? row['MEP Equip Estimate']),
            mep_equip_projected: parseNumber(row[' MEP Equip Projected '] ?? row['MEP Equip Projected']),
            // Financial metrics
            cash_flow: parseNumber(row[' Cash Flow '] ?? row['Cash Flow']),
            gross_profit_dollars: parseNumber(row['Gross Profit'] ?? row[' Gross Profit ']),
            open_receivables: parseNumber(row[' Open Receivables '] ?? row['Open Receivables']),
            current_est_cost: parseNumber(row['Current Est Cost'] ?? row[' Current Est Cost ']),
            // Change orders
            pending_change_orders: parseNumber(row[' Pending Change Orders '] ?? row['Pending Change Orders']),
            approved_changes: parseNumber(row['Approved Changes'] ?? row[' Approved Changes ']),
            change_order_count: parseNumber(row['Quantity Of Change Orders'] ?? row[' Quantity Of Change Orders ']),
            // Original margin
            original_estimated_margin: parseNumber(row[' Original Estimated Margin '] ?? row['Original Estimated Margin']),
            original_estimated_margin_pct: parseNumber(row['Original Estimated Margin %'] ?? row[' Original Estimated Margin % ']),
            // Labor rates
            actual_labor_rate: parseNumber(row['Actual Labor Rate'] ?? row[' Actual Labor Rate ']),
            estimated_labor_rate: parseNumber(row['Estimated Labor Rate'] ?? row[' Estimated Labor Rate ']),
            current_est_labor_cost: parseNumber(row['Current Est Labor Cost'] ?? row[' Current Est Labor Cost ']),
            ttl_labor_projected: parseNumber(row['TTL Labor $ Projected'] ?? row[' TTL Labor $ Projected ']),
            // Dates (Excel serial dates)
            start_month: row['StartMonth'] ? excelDateToJS(row['StartMonth']) : null,
            month_closed: row['MonthClosed'] ? excelDateToJS(row['MonthClosed']) : null,
            // Customer and location
            customer_number: (row['Customer'] ?? row[' Customer ']) ? String(row['Customer'] ?? row[' Customer ']) : null,
            customer_name: row['Customer Name'] ?? row[' Customer Name '] ?? '',
            ship_city: row['Ship City'] ?? row[' Ship City '] ?? row['City'] ?? '',
            ship_state: row['Ship State'] ?? row[' Ship State '] ?? row['State'] ?? '',
            ship_zip: row['Ship Zip'] ?? row[' Ship Zip '] ?? row['Zip'] ?? '',
            primary_market: row['Primary Market'] ?? row[' Primary Market '] ?? '',
            negotiated_work: row['Negotiated Work'] ?? row[' Negotiated Work '] ?? '',
            delivery_method: row['Delivery Method'] ?? row[' Delivery Method '] ?? '',
            raw_data: null  // Don't store raw data to save memory
          };

          if (!contractData.contract_number) continue;

          const result = await VistaData.upsertContract(contractData, req.tenantId, batch.id);
          if (result.isNew) {
            newCount++;
          } else {
            updatedCount++;
          }
        }

        await VistaData.updateImportBatch(batch.id, {
          records_new: newCount,
          records_updated: updatedCount
        });

        results.contracts = { total: data.length, new: newCount, updated: updatedCount, batch_id: batch.id };
        results.sheetsProcessed.push(contractSheetName);
      }
    }

    // Process Work Orders sheet (TGPBI_SMWorkOrderStatus) - memory-efficient chunked processing
    const workOrderSheetName = 'TGPBI_SMWorkOrderStatus';
    if (sheetNames.includes(workOrderSheetName)) {
      console.log(`[Vista Import] Processing ${workOrderSheetName} with chunked memory management...`);
      results.sheetsFound.push(workOrderSheetName);

      // Get sheet reference and row count without loading all data
      const woWorkbook = XLSX.readFile(tempFilePath, { sheets: workOrderSheetName });
      const woSheet = woWorkbook.Sheets[workOrderSheetName];
      const woRange = XLSX.utils.decode_range(woSheet['!ref'] || 'A1');
      const totalWORows = woRange.e.r; // Total rows (0-indexed, excludes header)
      console.log(`[Vista Import] ${workOrderSheetName}: ${totalWORows} rows to process`);

      if (totalWORows > 0) {
        // Create import batch
        const batch = await VistaData.createImportBatch({
          file_name: req.file.originalname,
          file_type: 'work_orders',
          records_total: totalWORows,
          imported_by: req.user.id
        }, req.tenantId);

        let newCount = 0;
        let updatedCount = 0;
        const WO_CHUNK_SIZE = 500; // Process 500 rows at a time

        for (let startRow = 1; startRow <= totalWORows; startRow += WO_CHUNK_SIZE) {
          const endRow = Math.min(startRow + WO_CHUNK_SIZE - 1, totalWORows);
          console.log(`[Vista Import] Processing work orders rows ${startRow}-${endRow}...`);

          // Load only a chunk of rows
          const chunkRange = { s: { r: 0, c: woRange.s.c }, e: { r: endRow, c: woRange.e.c } };
          const chunkData = XLSX.utils.sheet_to_json(woSheet, { range: chunkRange, defval: '' });

          // Skip header row in first chunk, process only the current chunk's rows
          const chunkStartIdx = startRow === 1 ? 0 : startRow - 1;
          const chunkEndIdx = endRow;
          const rowsToProcess = chunkData.slice(chunkStartIdx, chunkEndIdx);

          for (const row of rowsToProcess) {
            const contractAmt = parseNumber(
              row['Contract Amt'] ?? row[' Contract Amt '] ?? row['Contract Amount'] ?? row['ContractAmt'] ??
              row['Orig Contract Amt'] ?? row['Original Contract'] ?? row['Total Contract']
            );

            const woData = {
              work_order_number: String(row['Work Order'] || '').trim(),
              description: row['Description'] || '',
              entered_date: row['EnteredDateTime'] ? excelDateToJS(row['EnteredDateTime']) : null,
              requested_date: row['RequestedDate'] ? excelDateToJS(row['RequestedDate']) : null,
              status: row['Status'] || '',
              employee_number: row['Project Manager Emp Number'] ? String(row['Project Manager Emp Number']) : null,
              project_manager_name: row['Project Manager'] || '',
              department_code: row['Department'] || '',
              negotiated_work: row['Negotiated Work'] || '',
              contract_amount: contractAmt,
              actual_cost: parseNumber(row['Actual Cost']),
              billed_amount: parseNumber(row['Billed Amt'] ?? row[' Billed Amt '] ?? row['Billed Amount'] ?? row['BilledAmt']),
              received_amount: parseNumber(row['Received Amt'] ?? row['Received Amount'] ?? row['ReceivedAmt']),
              backlog: parseNumber(row['Backlog']),
              gross_profit_percent: parseNumber(row['Gross Profit %'] ?? row['Gross Profit Pct'] ?? row['GP%']),
              pf_hours_jtd: parseNumber(row['PF/SF/PF Hours JTD'] ?? row['PF Hours JTD']),
              sm_hours_jtd: parseNumber(row['SM Hours JTD']),
              mep_jtd: parseNumber(row['MEP JTD']),
              material_jtd: parseNumber(row['Material JTD']),
              subcontracts_jtd: parseNumber(row['Subcontracts JTD']),
              rentals_jtd: parseNumber(row['Rentals JTD']),
              customer_name: row['Customer'] || '',
              city: row['City'] || '',
              state: row['State'] || '',
              zip: row['Zip'] || '',
              primary_market: row['Primary Market'] || '',
              raw_data: null
            };

            if (!woData.work_order_number) continue;

            const result = await VistaData.upsertWorkOrder(woData, req.tenantId, batch.id);
            if (result.isNew) {
              newCount++;
            } else {
              updatedCount++;
            }
          }

          // Force garbage collection hint
          if (global.gc) global.gc();
        }

        await VistaData.updateImportBatch(batch.id, {
          records_new: newCount,
          records_updated: updatedCount
        });

        results.workOrders = { total: totalWORows, new: newCount, updated: updatedCount, batch_id: batch.id };
        results.sheetsProcessed.push(workOrderSheetName);
      }
    }

    // Process Employees sheet (TGPREmployees)
    const employeeSheetName = 'TGPREmployees';
    if (sheetNames.includes(employeeSheetName)) {
      results.sheetsFound.push(employeeSheetName);
      const data = loadSheet(employeeSheetName);

      if (data.length > 0) {
        const batch = await VistaData.createImportBatch({
          file_name: req.file.originalname,
          file_type: 'employees',
          records_total: data.length,
          imported_by: req.user.id
        }, req.tenantId);

        let newCount = 0;
        let updatedCount = 0;

        for (const row of data) {
          const empData = {
            employee_number: parseInt(row['Employee']) || null,
            first_name: row['First Name'] || '',
            last_name: row['Last Name'] || '',
            hire_date: row['Hire Date'] ? excelDateToJS(row['Hire Date']) : null,
            active: row['Active Y/N'] === 'Y',
            raw_data: null  // Don't store raw data to save memory
          };

          if (!empData.employee_number) continue;

          const result = await VistaData.upsertEmployee(empData, batch.id);
          if (result.isNew) {
            newCount++;
          } else {
            updatedCount++;
          }
        }

        await VistaData.updateImportBatch(batch.id, {
          records_new: newCount,
          records_updated: updatedCount
        });

        results.employees = { total: data.length, new: newCount, updated: updatedCount, batch_id: batch.id };
        results.sheetsProcessed.push(employeeSheetName);
      }
    }

    // Process Customers sheet (TGARCustomers)
    const customerSheetName = 'TGARCustomers';
    if (sheetNames.includes(customerSheetName)) {
      results.sheetsFound.push(customerSheetName);
      const data = loadSheet(customerSheetName);

      if (data.length > 0) {
        const batch = await VistaData.createImportBatch({
          file_name: req.file.originalname,
          file_type: 'customers',
          records_total: data.length,
          imported_by: req.user.id
        }, req.tenantId);

        let newCount = 0;
        let updatedCount = 0;

        for (const row of data) {
          const custData = {
            customer_number: parseInt(row['Customer Number']) || null,
            name: row['Name'] || '',
            address: row['Address'] || '',
            address2: row['Address2'] || '',
            city: row['City'] || '',
            state: row['State'] || '',
            zip: row['Zip'] || '',
            active: row['Active Y/N'] === 'Y',
            raw_data: null  // Don't store raw data to save memory
          };

          if (!custData.customer_number) continue;

          const result = await VistaData.upsertCustomer(custData, batch.id);
          if (result.isNew) {
            newCount++;
          } else {
            updatedCount++;
          }
        }

        await VistaData.updateImportBatch(batch.id, {
          records_new: newCount,
          records_updated: updatedCount
        });

        results.customers = { total: data.length, new: newCount, updated: updatedCount, batch_id: batch.id };
        results.sheetsProcessed.push(customerSheetName);
      }
    }

    // Process Vendors sheet (TGAPVendors)
    const vendorSheetName = 'TGAPVendors';
    if (sheetNames.includes(vendorSheetName)) {
      results.sheetsFound.push(vendorSheetName);
      const data = loadSheet(vendorSheetName);

      if (data.length > 0) {
        const batch = await VistaData.createImportBatch({
          file_name: req.file.originalname,
          file_type: 'vendors',
          records_total: data.length,
          imported_by: req.user.id
        }, req.tenantId);

        let newCount = 0;
        let updatedCount = 0;

        for (const row of data) {
          const vendorData = {
            vendor_number: parseInt(row['Vendor Number']) || null,
            name: row['Name'] || '',
            address: row['Address'] || '',
            address2: row['Address2'] || '',
            city: row['City'] || '',
            state: row['State'] || '',
            zip: row['Zip'] || '',
            active: row['Active Y/N'] === 'Y',
            raw_data: null  // Don't store raw data to save memory
          };

          if (!vendorData.vendor_number) continue;

          const result = await VistaData.upsertVendor(vendorData, batch.id);
          if (result.isNew) {
            newCount++;
          } else {
            updatedCount++;
          }
        }

        await VistaData.updateImportBatch(batch.id, {
          records_new: newCount,
          records_updated: updatedCount
        });

        results.vendors = { total: data.length, new: newCount, updated: updatedCount, batch_id: batch.id };
        results.sheetsProcessed.push(vendorSheetName);
      }
    }

    // Process Facilities (Customer List) - detect by column names
    // Look for a sheet with Customer_Owner-Facility or Customer_Owner columns
    let facilitiesSheetName = null;
    for (const sn of sheetNames) {
      // Load just first row to check columns
      const wb = XLSX.readFile(tempFilePath, { sheets: sn, sheetRows: 2 });
      const testData = XLSX.utils.sheet_to_json(wb.Sheets[sn]);
      if (testData.length > 0) {
        const firstRow = testData[0];
        // Check if this looks like a facilities file (has Customer_Owner-Facility column)
        if (firstRow.hasOwnProperty('Customer_Owner-Facility') || firstRow.hasOwnProperty('Customer_Owner')) {
          facilitiesSheetName = sn;
          break;
        }
      }
    }

    if (facilitiesSheetName) {
      console.log(`[Vista Import] Processing facilities from ${facilitiesSheetName}...`);
      results.sheetsFound.push(`${facilitiesSheetName} (Facilities)`);
      const data = loadSheet(facilitiesSheetName);

      if (data.length > 0) {
        let createdCount = 0;
        let updatedCount = 0;
        let notFoundCount = 0;
        const notFoundNames = []; // Collect names that don't match

        // Helper function to extract name from SharePoint format "Name;#123" -> "Name"
        const extractName = (value) => {
          if (!value) return null;
          const str = String(value).trim();
          const match = str.match(/^([^;]+);#\d+$/);
          return match ? match[1].trim() : str;
        };

        for (const row of data) {
          const customerOwner = row['Customer_Owner'] || null;
          const facility = row['Customer_Owner-Facility'] || null;
          const accountManager = extractName(row['Account manager']);
          const fieldLead = extractName(row['Field Lead(s)']);
          const address = row['Address'] || null;
          const city = row['City_Province'] || null;
          const state = row['State_Country'] || null;
          const zip = row['ZipCode_PostalCode'] || null;
          const department = row['Department'] || null;
          const customerScore = row['Customer Score'] || null;
          const isActive = row['Active Customer'] === 'Yes' || row['Active Customer'] === true;

          if (!customerOwner) continue;

          try {
            const result = await VistaData.updateCustomerFacility(req.tenantId, {
              customer_owner: customerOwner,
              customer_facility: facility,
              account_manager: accountManager,
              field_lead: fieldLead,
              address: address,
              city: city,
              state: state,
              zip: zip,
              department: department,
              customer_score: customerScore,
              is_active: isActive
            });

            if (result.status === 'created') createdCount++;
            else if (result.status === 'updated') updatedCount++;
            else {
              notFoundCount++;
              if (notFoundNames.length < 50) {
                notFoundNames.push(customerOwner);
              }
            }
          } catch (err) {
            console.error(`[Facilities Import] Error processing ${customerOwner}:`, err.message);
            notFoundCount++;
            if (notFoundNames.length < 50) {
              notFoundNames.push(customerOwner);
            }
          }
        }

        results.facilities = {
          total: data.length,
          created: createdCount,
          updated: updatedCount,
          not_found: notFoundCount,
          not_found_names: notFoundNames  // Include first 50 names for debugging
        };
        results.sheetsProcessed.push(`${facilitiesSheetName} (Facilities)`);
        console.log(`[Vista Import] Facilities: ${createdCount} created, ${updatedCount} updated, ${notFoundCount} not found`);
      }
    }

    // Check if any sheets were processed
    if (results.sheetsProcessed.length === 0) {
      return res.status(400).json({
        message: 'No valid Vista data sheets found. Expected sheets: TGPBI_PMContractStatus, TGPBI_SMWorkOrderStatus, TGPREmployees, TGARCustomers, TGAPVendors, or a Customer List with Customer_Owner column',
        availableSheets: sheetNames
      });
    }

    // Auto-import all entities to Titan (Vista is source of truth)
    const autoImport = {
      contracts: { imported: 0 },
      customers: { imported: 0 },
      departments: { imported: 0 },
      employees: { imported: 0 },
      vendors: { imported: 0 }
    };

    const autoLink = {
      contracts: { linked: 0 },
      customers: { linked: 0 },
      employees: { linked: 0 },
      vendors: { linked: 0 },
      departments: { linked: 0 }
    };

    try {
      // FIRST: Auto-link 100% matches BEFORE importing new records
      // This links Vista records to existing Titan records by exact match
      console.log('[Vista Import] Auto-linking 100% matches...');

      // Auto-link contracts by contract_number = project.number
      if (results.contracts.total > 0) {
        const contractLinkResult = await VistaData.autoLinkExactContractMatches(req.tenantId, req.user.id);
        autoLink.contracts = contractLinkResult;
        console.log(`[Vista Import] Auto-linked ${contractLinkResult.contracts_linked} contracts (100% match by number)`);
      }

      if (results.customers.total > 0) {
        const customerLinkResult = await VistaData.autoLinkExactCustomerMatches(req.tenantId, req.user.id);
        autoLink.customers = customerLinkResult;
        console.log(`[Vista Import] Auto-linked ${customerLinkResult.customers_linked} customers (100% match)`);
      }

      if (results.employees.total > 0) {
        const empLinkResult = await VistaData.autoLinkExactEmployeeMatches(req.tenantId, req.user.id);
        autoLink.employees = empLinkResult;
        console.log(`[Vista Import] Auto-linked ${empLinkResult.employees_linked} employees (100% match)`);
      }

      if (results.vendors.total > 0) {
        const vendorLinkResult = await VistaData.autoLinkExactVendorMatches(req.tenantId, req.user.id);
        autoLink.vendors = vendorLinkResult;
        console.log(`[Vista Import] Auto-linked ${vendorLinkResult.vendors_linked} vendors (100% match)`);
      }

      // Auto-import contracts as projects (only those NOT already linked)
      if (results.contracts.total > 0) {
        console.log('[Vista Import] Auto-importing contracts as projects...');
        const contractResult = await VistaData.importUnmatchedContractsToTitan(req.tenantId, req.user.id);
        autoImport.contracts = contractResult;
        console.log(`[Vista Import] Auto-imported ${contractResult.imported} contracts as projects`);
      }

      // Auto-import customers (only those not linked)
      if (results.customers.total > 0) {
        console.log('[Vista Import] Auto-importing customers...');
        const customerResult = await VistaData.importUnmatchedCustomersToTitan(req.tenantId, req.user.id);
        autoImport.customers = customerResult;
        console.log(`[Vista Import] Auto-imported ${customerResult.imported} customers`);
      }

      // Auto-import departments from contract/work order department codes
      if (results.contracts.total > 0 || results.workOrders.total > 0) {
        console.log('[Vista Import] Auto-importing departments...');
        const deptResult = await VistaData.importUnmatchedDepartmentsToTitan(req.tenantId, req.user.id);
        autoImport.departments = deptResult;
        console.log(`[Vista Import] Auto-imported ${deptResult.imported} departments`);

        // Auto-link departments after import
        const deptLinkResult = await VistaData.autoLinkExactDepartmentMatches(req.tenantId, req.user.id);
        autoLink.departments = deptLinkResult;
        console.log(`[Vista Import] Auto-linked ${deptLinkResult.codes_linked} department codes`);
      }

      // Auto-import employees (only those not linked)
      if (results.employees.total > 0) {
        console.log('[Vista Import] Auto-importing employees...');
        const empResult = await VistaData.importUnmatchedEmployeesToTitan(req.tenantId, req.user.id);
        autoImport.employees = empResult;
        console.log(`[Vista Import] Auto-imported ${empResult.imported} employees`);
      }

      // Auto-import vendors (only those not linked)
      if (results.vendors.total > 0) {
        console.log('[Vista Import] Auto-importing vendors...');
        const vendorResult = await VistaData.importUnmatchedVendorsToTitan(req.tenantId, req.user.id);
        autoImport.vendors = vendorResult;
        console.log(`[Vista Import] Auto-imported ${vendorResult.imported} vendors`);
      }
    } catch (autoImportError) {
      console.error('[Vista Import] Auto-import error:', autoImportError.message);
      // Don't fail the whole upload if auto-import fails
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Vista Import] Complete in ${totalTime}s. Sheets processed: ${results.sheetsProcessed.join(', ')}`);

    // Clean up temp file
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('[Vista Import] Failed to delete temp file:', err.message);
      });
    }

    res.json({
      message: `Successfully imported data from ${results.sheetsProcessed.length} sheet(s)`,
      ...results,
      autoLink,
      autoImport
    });
  } catch (error) {
    console.error('[Vista Import] Error:', error.message);
    console.error('[Vista Import] Stack:', error.stack);
    // Clean up temp file on error
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('[Vista Import] Failed to delete temp file:', err.message);
      });
    }
    next(error);
  }
});

// POST /api/vista/import/auto-match - Run auto-matching on unmatched records
router.post('/import/auto-match', requireAdmin, async (req, res, next) => {
  try {
    const contractResults = await VistaData.autoMatchContracts(req.tenantId);
    const workOrderResults = await VistaData.autoMatchWorkOrders(req.tenantId);

    res.json({
      message: 'Auto-matching completed',
      contracts: contractResults,
      workOrders: workOrderResults
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/import/facilities - Import customer facilities from Excel
router.post('/import/facilities', requireAdmin, upload.single('file'), async (req, res, next) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    tempFilePath = req.file.path;
    console.log(`[Facilities Import] Starting import of ${req.file.originalname}`);

    // Read sheet names first, then load only the sheet we need
    const wbStructure = XLSX.readFile(tempFilePath, { sheetRows: 0, bookSheets: true });
    const sheetName = wbStructure.SheetNames[0];
    console.log(`[Facilities Import] Using sheet: ${sheetName}`);

    const workbook = XLSX.readFile(tempFilePath, { sheets: sheetName });
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (data.length === 0) {
      return res.status(400).json({ message: 'No data found in Excel file' });
    }

    console.log(`[Facilities Import] Processing ${data.length} rows`);

    // Helper to extract name from SharePoint format "Name;#123"
    const extractName = (value) => {
      if (!value) return null;
      const str = String(value);
      const semicolonIdx = str.indexOf(';#');
      return semicolonIdx > 0 ? str.substring(0, semicolonIdx).trim() : str.trim();
    };

    let created = 0;
    let updated = 0;
    let notFound = [];
    let errors = [];

    for (const row of data) {
      try {
        const customerOwner = row['Customer_Owner'] || row['Customer Owner'];
        const facilityName = row['Customer_Owner-Facility'] || row['Customer_Owner-Facility'] || row['Facility'];

        if (!customerOwner) {
          continue; // Skip rows without customer owner
        }

        // Extract account manager name (strip SharePoint ID)
        const accountManager = extractName(row['Account manager'] || row['Account Manager']);
        const fieldLead = extractName(row['Field Lead(s)'] || row['Field Leads']);

        // Find existing customer by customer_owner
        const result = await VistaData.updateCustomerFacility(req.tenantId, {
          customerOwner: customerOwner.trim(),
          facilityName: facilityName ? facilityName.trim() : null,
          accountManager: accountManager,
          fieldLead: fieldLead,
          address: row['Address'] || null,
          city: row['City_Province'] || row['City'] || null,
          state: row['State_Country'] || row['State'] || null,
          zip: row['ZipCode_PostalCode'] || row['Zip'] || null,
          controls: row['Controls'] || null,
          department: row['Department'] || null,
          customerScore: row['Customer Score'] ? parseFloat(row['Customer Score']) : null,
          activeCustomer: row['Active Customer'] === 'Yes' || row['Active Customer'] === 'TRUE' || row['Active Customer'] === true
        });

        if (result.status === 'created') {
          created++;
        } else if (result.status === 'updated') {
          updated++;
        } else if (result.status === 'not_found') {
          notFound.push(customerOwner);
        }
      } catch (rowError) {
        console.error(`[Facilities Import] Error processing row:`, rowError.message);
        errors.push({ row: row['Customer_Owner-Facility'], error: rowError.message });
      }
    }

    console.log(`[Facilities Import] Complete. Created: ${created}, Updated: ${updated}, Not Found: ${notFound.length}`);

    // Clean up temp file
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('[Facilities Import] Failed to delete temp file:', err.message);
      });
    }

    res.json({
      message: `Facilities import complete`,
      total: data.length,
      created,
      updated,
      notFoundCount: notFound.length,
      notFound: notFound.slice(0, 20), // Only return first 20 for display
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    console.error('[Facilities Import] Error:', error.message);
    // Clean up temp file on error
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('[Facilities Import] Failed to delete temp file:', err.message);
      });
    }
    next(error);
  }
});

// ==================== TITAN-ONLY RECORDS ====================

// GET /api/vista/titan-only/projects - Get Titan projects not linked to Vista
router.get('/titan-only/projects', async (req, res, next) => {
  try {
    const projects = await VistaData.getTitanOnlyProjects(req.tenantId);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/titan-only/employees - Get Titan employees not linked to Vista
router.get('/titan-only/employees', async (req, res, next) => {
  try {
    const employees = await VistaData.getTitanOnlyEmployees(req.tenantId);
    res.json(employees);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/titan-only/customers - Get Titan customers not linked to Vista
router.get('/titan-only/customers', async (req, res, next) => {
  try {
    const customers = await VistaData.getTitanOnlyCustomers(req.tenantId);
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/titan-only/vendors - Get Titan vendors not linked to Vista
router.get('/titan-only/vendors', async (req, res, next) => {
  try {
    const vendors = await VistaData.getTitanOnlyVendors(req.tenantId);
    res.json(vendors);
  } catch (error) {
    next(error);
  }
});

// ==================== CONTRACTS ====================

// GET /api/vista/contracts - Get all contracts
router.get('/contracts', async (req, res, next) => {
  try {
    const { link_status, search, status, limit } = req.query;
    const filters = {};

    if (link_status) filters.link_status = link_status;
    if (search) filters.search = search;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);

    const contracts = await VistaData.getAllContracts(filters, req.tenantId);
    res.json(contracts);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/contracts/unmatched - Get unmatched contracts
router.get('/contracts/unmatched', async (req, res, next) => {
  try {
    const contracts = await VistaData.getUnmatchedContracts(req.tenantId);
    res.json(contracts);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/contracts/by-project/:projectId - Get contract by linked project ID
router.get('/contracts/by-project/:projectId', async (req, res, next) => {
  try {
    const contract = await VistaData.getContractByProjectId(req.params.projectId, req.tenantId);
    if (!contract) {
      return res.status(404).json({ message: 'No VP contract linked to this project' });
    }
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/contracts/:id - Get contract by ID
router.get('/contracts/:id', async (req, res, next) => {
  try {
    const contract = await VistaData.getContractById(req.params.id, req.tenantId);
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/contracts/:id/link - Link contract to Titan entities
router.post('/contracts/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const { project_id, employee_id, customer_id, department_id } = req.body;

    const contract = await VistaData.linkContract(
      req.params.id,
      { project_id, employee_id, customer_id, department_id },
      req.user.id,
      req.tenantId
    );

    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }

    res.json(contract);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vista/contracts/:id/link - Unlink contract
router.delete('/contracts/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const contract = await VistaData.unlinkContract(req.params.id, req.tenantId);
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/contracts/:id/ignore - Mark contract as ignored
router.post('/contracts/:id/ignore', requireAdmin, async (req, res, next) => {
  try {
    const contract = await VistaData.ignoreContract(req.params.id, req.tenantId);
    if (!contract) {
      return res.status(404).json({ message: 'Contract not found' });
    }
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

// ==================== WORK ORDERS ====================

// GET /api/vista/work-orders - Get all work orders
router.get('/work-orders', async (req, res, next) => {
  try {
    const { link_status, search, status, limit } = req.query;
    const filters = {};

    if (link_status) filters.link_status = link_status;
    if (search) filters.search = search;
    if (status) filters.status = status;
    if (limit) filters.limit = parseInt(limit);

    const workOrders = await VistaData.getAllWorkOrders(filters, req.tenantId);
    res.json(workOrders);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/work-orders/unmatched - Get unmatched work orders
router.get('/work-orders/unmatched', async (req, res, next) => {
  try {
    const workOrders = await VistaData.getUnmatchedWorkOrders(req.tenantId);
    res.json(workOrders);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/work-orders/:id - Get work order by ID
router.get('/work-orders/:id', async (req, res, next) => {
  try {
    const workOrder = await VistaData.getWorkOrderById(req.params.id, req.tenantId);
    if (!workOrder) {
      return res.status(404).json({ message: 'Work order not found' });
    }
    res.json(workOrder);
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/work-orders/:id/link - Link work order to Titan entities
router.post('/work-orders/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const { employee_id, customer_id, department_id } = req.body;

    const workOrder = await VistaData.linkWorkOrder(
      req.params.id,
      { employee_id, customer_id, department_id },
      req.user.id,
      req.tenantId
    );

    if (!workOrder) {
      return res.status(404).json({ message: 'Work order not found' });
    }

    res.json(workOrder);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vista/work-orders/:id/link - Unlink work order
router.delete('/work-orders/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const workOrder = await VistaData.unlinkWorkOrder(req.params.id, req.tenantId);
    if (!workOrder) {
      return res.status(404).json({ message: 'Work order not found' });
    }
    res.json(workOrder);
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/work-orders/:id/ignore - Mark work order as ignored
router.post('/work-orders/:id/ignore', requireAdmin, async (req, res, next) => {
  try {
    const workOrder = await VistaData.ignoreWorkOrder(req.params.id, req.tenantId);
    if (!workOrder) {
      return res.status(404).json({ message: 'Work order not found' });
    }
    res.json(workOrder);
  } catch (error) {
    next(error);
  }
});

// ==================== ENTITY AGGREGATIONS ====================

// GET /api/vista/customer/:id - Get Vista data for a customer
router.get('/customer/:id', async (req, res, next) => {
  try {
    const data = await VistaData.getCustomerVistaData(req.params.id, req.tenantId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/project/:id - Get Vista data for a project
router.get('/project/:id', async (req, res, next) => {
  try {
    const contract = await VistaData.getProjectVistaData(req.params.id, req.tenantId);
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/employee/:id - Get Vista data for an employee
router.get('/employee/:id', async (req, res, next) => {
  try {
    const data = await VistaData.getEmployeeVistaData(req.params.id, req.tenantId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ==================== VP EMPLOYEES (Reference Data) ====================

// GET /api/vista/vp-employees - Get all VP employees
router.get('/vp-employees', async (req, res, next) => {
  try {
    const { link_status, search, active, limit } = req.query;
    const filters = {};

    if (link_status) filters.link_status = link_status;
    if (search) filters.search = search;
    if (active !== undefined) filters.active = active === 'true';
    if (limit) filters.limit = parseInt(limit);

    const employees = await VistaData.getAllVPEmployees(filters);
    res.json(employees);
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/vp-employees/:id/link - Link VP employee to Titan employee
router.post('/vp-employees/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const { employee_id } = req.body;
    const employee = await VistaData.linkVPEmployee(req.params.id, { employee_id }, req.user.id);
    if (!employee) {
      return res.status(404).json({ message: 'VP Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vista/vp-employees/:id/link - Unlink VP employee
router.delete('/vp-employees/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const employee = await VistaData.unlinkVPEmployee(req.params.id);
    if (!employee) {
      return res.status(404).json({ message: 'VP Employee not found' });
    }
    res.json(employee);
  } catch (error) {
    next(error);
  }
});

// ==================== VP CUSTOMERS (Reference Data) ====================

// GET /api/vista/vp-customers - Get all VP customers
router.get('/vp-customers', async (req, res, next) => {
  try {
    const { link_status, search, active, limit } = req.query;
    const filters = {};

    if (link_status) filters.link_status = link_status;
    if (search) filters.search = search;
    if (active !== undefined) filters.active = active === 'true';
    if (limit) filters.limit = parseInt(limit);

    const customers = await VistaData.getAllVPCustomers(filters);
    res.json(customers);
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/vp-customers/:id/link - Link VP customer to Titan customer
router.post('/vp-customers/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const { customer_id } = req.body;
    const customer = await VistaData.linkVPCustomer(req.params.id, { customer_id }, req.user.id);
    if (!customer) {
      return res.status(404).json({ message: 'VP Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vista/vp-customers/:id/link - Unlink VP customer
router.delete('/vp-customers/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const customer = await VistaData.unlinkVPCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'VP Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    next(error);
  }
});

// ==================== VP VENDORS (Reference Data) ====================

// GET /api/vista/vp-vendors - Get all VP vendors
router.get('/vp-vendors', async (req, res, next) => {
  try {
    const { link_status, search, active, limit } = req.query;
    const filters = {};

    if (link_status) filters.link_status = link_status;
    if (search) filters.search = search;
    if (active !== undefined) filters.active = active === 'true';
    if (limit) filters.limit = parseInt(limit);

    const vendors = await VistaData.getAllVPVendors(filters);
    res.json(vendors);
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/vp-vendors/:id/link - Link VP vendor (placeholder - no vendors table yet)
router.post('/vp-vendors/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const { vendor_id } = req.body;
    const vendor = await VistaData.linkVPVendor(req.params.id, { vendor_id }, req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'VP Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vista/vp-vendors/:id/link - Unlink VP vendor
router.delete('/vp-vendors/:id/link', requireAdmin, async (req, res, next) => {
  try {
    const vendor = await VistaData.unlinkVPVendor(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'VP Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    next(error);
  }
});

// ==================== IMPORT UNMATCHED TO TITAN ====================

// POST /api/vista/import-to-titan/employees - Import unmatched VP employees as new Titan employees
router.post('/import-to-titan/employees', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.importUnmatchedEmployeesToTitan(req.tenantId, req.user.id);
    res.json({
      message: `Successfully imported ${result.imported} employees to Titan`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/import-to-titan/customers - Import unmatched VP customers as new Titan customers
router.post('/import-to-titan/customers', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.importUnmatchedCustomersToTitan(req.tenantId, req.user.id);
    res.json({
      message: `Successfully imported ${result.imported} customers to Titan`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// ==================== DUPLICATES / SIMILARITY REPORT ====================

// GET /api/vista/duplicates/stats - Get summary of potential duplicates
router.get('/duplicates/stats', async (req, res, next) => {
  try {
    const stats = await VistaData.getDuplicatesStats(req.tenantId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/duplicates/employees - Find potential employee matches
router.get('/duplicates/employees', async (req, res, next) => {
  try {
    const { min_similarity } = req.query;
    const minSimilarity = min_similarity ? parseFloat(min_similarity) : 0.5;
    const duplicates = await VistaData.findEmployeeDuplicates(req.tenantId, minSimilarity);
    res.json(duplicates);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/duplicates/customers - Find potential customer matches
router.get('/duplicates/customers', async (req, res, next) => {
  try {
    const { min_similarity } = req.query;
    const minSimilarity = min_similarity ? parseFloat(min_similarity) : 0.5;
    const duplicates = await VistaData.findCustomerDuplicates(req.tenantId, minSimilarity);
    res.json(duplicates);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/duplicates/contracts - Find potential contract to project matches
router.get('/duplicates/contracts', async (req, res, next) => {
  try {
    const { min_similarity } = req.query;
    const minSimilarity = min_similarity ? parseFloat(min_similarity) : 0.5;
    const duplicates = await VistaData.findContractDuplicates(req.tenantId, minSimilarity);
    res.json(duplicates);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/duplicates/departments - Find potential department matches
router.get('/duplicates/departments', async (req, res, next) => {
  try {
    const { min_similarity } = req.query;
    const minSimilarity = min_similarity ? parseFloat(min_similarity) : 0.5;
    const duplicates = await VistaData.findDepartmentDuplicates(req.tenantId, minSimilarity);
    res.json(duplicates);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/duplicates/vendors - Find potential vendor matches
router.get('/duplicates/vendors', async (req, res, next) => {
  try {
    const { min_similarity } = req.query;
    const minSimilarity = min_similarity ? parseFloat(min_similarity) : 0.5;
    const duplicates = await VistaData.findVendorDuplicates(req.tenantId, minSimilarity);
    res.json(duplicates);
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/import-to-titan/vendors - Import unmatched VP vendors as new Titan vendors
router.post('/import-to-titan/vendors', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.importUnmatchedVendorsToTitan(req.tenantId, req.user.id);
    res.json({
      message: `Successfully imported ${result.imported} vendors to Titan`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/import-to-titan/contracts - Import unmatched VP contracts as new Titan projects
router.post('/import-to-titan/contracts', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.importUnmatchedContractsToTitan(req.tenantId, req.user.id);
    res.json({
      message: `Successfully imported ${result.imported} contracts as Titan projects`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/import-to-titan/work-orders - Import unmatched VP work orders as new Titan projects
router.post('/import-to-titan/work-orders', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.importUnmatchedWorkOrdersToTitan(req.tenantId, req.user.id);
    res.json({
      message: `Successfully imported ${result.imported} work orders as Titan projects`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/import-to-titan/departments - Import unmatched VP department codes as new Titan departments
router.post('/import-to-titan/departments', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.importUnmatchedDepartmentsToTitan(req.tenantId, req.user.id);
    res.json({
      message: `Successfully imported ${result.imported} departments to Titan`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/link-department-code - Link a VP department code to a Titan department
router.post('/link-department-code', requireAdmin, async (req, res, next) => {
  try {
    const { department_code, department_id } = req.body;

    if (!department_code || !department_id) {
      return res.status(400).json({ message: 'department_code and department_id are required' });
    }

    const result = await VistaData.linkDepartmentCode(
      department_code,
      department_id,
      req.tenantId,
      req.user.id
    );

    res.json({
      message: `Successfully linked department code "${department_code}" to department ${department_id}`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/auto-link-departments - Auto-link all exact department matches
router.post('/auto-link-departments', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.autoLinkExactDepartmentMatches(req.tenantId, req.user.id);

    res.json({
      message: `Auto-linked ${result.codes_linked} department codes - updated ${result.contracts_updated} contracts and ${result.work_orders_updated} work orders`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/auto-link-customers - Auto-link all exact customer matches
router.post('/auto-link-customers', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.autoLinkExactCustomerMatches(req.tenantId, req.user.id);

    res.json({
      message: `Auto-linked ${result.customers_linked} customers`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/auto-link-all-customer-matches - Link ALL customer matches (any similarity)
router.post('/auto-link-all-customer-matches', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.autoLinkAllCustomerMatches(req.tenantId, req.user.id);

    res.json({
      message: `Auto-linked ${result.customers_linked} customers`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/auto-link-vendors - Auto-link all exact vendor matches
router.post('/auto-link-vendors', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.autoLinkExactVendorMatches(req.tenantId, req.user.id);

    res.json({
      message: `Auto-linked ${result.vendors_linked} vendors`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/auto-link-employees - Auto-link all exact employee matches
router.post('/auto-link-employees', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.autoLinkExactEmployeeMatches(req.tenantId, req.user.id);

    res.json({
      message: `Auto-linked ${result.employees_linked} employees`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/vista/auto-link-contracts - Auto-link contracts by contract_number = project.number
router.post('/auto-link-contracts', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.autoLinkExactContractMatches(req.tenantId, req.user.id);

    res.json({
      message: `Auto-linked ${result.contracts_linked} contracts`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// ==================== DELETE TITAN-ONLY RECORDS ====================

// DELETE /api/vista/titan-only/customers - Delete all Titan-only customers
router.delete('/titan-only/customers', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.deleteTitanOnlyCustomers(req.tenantId);
    res.json({
      message: `Deleted ${result.deleted} Titan-only customers`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vista/titan-only/employees - Delete all Titan-only employees
router.delete('/titan-only/employees', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.deleteTitanOnlyEmployees(req.tenantId);
    res.json({
      message: `Deleted ${result.deleted} Titan-only employees`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vista/titan-only/projects - Delete all Titan-only projects
router.delete('/titan-only/projects', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.deleteTitanOnlyProjects(req.tenantId);
    res.json({
      message: `Deleted ${result.deleted} Titan-only projects`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/vista/titan-only/vendors - Delete all Titan-only vendors
router.delete('/titan-only/vendors', requireAdmin, async (req, res, next) => {
  try {
    const result = await VistaData.deleteTitanOnlyVendors(req.tenantId);
    res.json({
      message: `Deleted ${result.deleted} Titan-only vendors`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

// ==================== TITAN DUPLICATES ====================

// GET /api/vista/titan-duplicates/customers - Find duplicate customers within Titan
router.get('/titan-duplicates/customers', async (req, res, next) => {
  try {
    const duplicates = await VistaData.findTitanDuplicateCustomers(req.tenantId);
    res.json(duplicates);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/titan-duplicates/employees - Find duplicate employees within Titan
router.get('/titan-duplicates/employees', async (req, res, next) => {
  try {
    const duplicates = await VistaData.findTitanDuplicateEmployees(req.tenantId);
    res.json(duplicates);
  } catch (error) {
    next(error);
  }
});

// GET /api/vista/titan-duplicates/projects - Find duplicate projects within Titan
router.get('/titan-duplicates/projects', async (req, res, next) => {
  try {
    const duplicates = await VistaData.findTitanDuplicateProjects(req.tenantId);
    res.json(duplicates);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
