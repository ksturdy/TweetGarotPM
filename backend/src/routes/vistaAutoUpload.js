const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
const VistaData = require('../models/VistaData');

// Helper function to convert Excel serial date to JS Date
const excelDateToJS = (excelDate) => {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate;
  const excelEpoch = new Date(1899, 11, 30);
  const jsDate = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
  return jsDate.toISOString().split('T')[0];
};

// Helper function to parse numbers, preserving 0 values
const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
};

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

  req.user = { id: 1, role: 'admin' };  // Use ID 1 (admin user) for automated imports
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
    console.log(`[Vista Auto-Import] Starting import of ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    const startTime = Date.now();

    // Parse Excel file - get sheet names first
    console.log('[Vista Auto-Import] Reading Excel structure...');
    const workbook = XLSX.readFile(tempFilePath, {
      sheetRows: 0,
      bookSheets: true
    });
    const sheetNames = workbook.SheetNames;
    console.log(`[Vista Auto-Import] Found sheets: ${sheetNames.join(', ')}`);

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
      console.log(`[Vista Auto-Import] Processing ${contractSheetName}...`);
      results.sheetsFound.push(contractSheetName);
      const data = loadSheet(contractSheetName);
      console.log(`[Vista Auto-Import] ${contractSheetName}: ${data.length} rows to process`);

      if (data.length > 0) {
        if (data[0]) {
          const columns = Object.keys(data[0]);
          console.log(`[Vista Auto-Import] ${contractSheetName} columns: ${columns.join(', ')}`);
        }

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
            pf_hours_estimate: parseNumber(row[' PF Hours Estimate '] ?? row['PF Hours Estimate']),
            pf_hours_jtd: parseNumber(row[' PF Hours JTD '] ?? row['PF Hours JTD']),
            pf_hours_projected: parseNumber(row[' PF Hours Projected '] ?? row['PF Hours Projected']),
            sm_hours_estimate: parseNumber(row[' SM Hours Estimate '] ?? row['SM Hours Estimate']),
            sm_hours_jtd: parseNumber(row[' SM Hours JTD '] ?? row['SM Hours JTD']),
            sm_hours_projected: parseNumber(row[' SM Hours Projected '] ?? row['SM Hours Projected']),
            pl_hours_estimate: parseNumber(row[' PL Hours Estimate '] ?? row['PL Hours Estimate']),
            pl_hours_jtd: parseNumber(row[' PL Hours JTD '] ?? row['PL Hours JTD']),
            pl_hours_projected: parseNumber(row[' PL Hours Projected '] ?? row['PL Hours Projected']),
            total_hours_estimate: parseNumber(row[' Total Hours Estimate '] ?? row['Total Hours Estimate']),
            total_hours_jtd: parseNumber(row[' Total Hours JTD '] ?? row['Total Hours JTD']),
            total_hours_projected: parseNumber(row[' Total Hours Projected '] ?? row['Total Hours Projected']),
            material_jtd: parseNumber(row[' Material JTD '] ?? row['Material JTD']),
            material_estimate: parseNumber(row[' Material Estimate '] ?? row['Material Estimate']),
            material_projected: parseNumber(row[' Material Projected '] ?? row['Material Projected']),
            subcontracts_jtd: parseNumber(row[' Subcontracts JTD '] ?? row['Subcontracts JTD']),
            subcontracts_estimate: parseNumber(row[' Subcontracts Estimate '] ?? row['Subcontracts Estimate']),
            subcontracts_projected: parseNumber(row[' Subcontracts Projected '] ?? row['Subcontracts Projected']),
            rentals_jtd: parseNumber(row[' Rentals JTD '] ?? row['Rentals JTD']),
            rentals_estimate: parseNumber(row[' Rentals Estimate '] ?? row['Rentals Estimate']),
            rentals_projected: parseNumber(row[' Rentals Projected '] ?? row['Rentals Projected']),
            mep_equip_jtd: parseNumber(row[' MEP Equip JTD '] ?? row['MEP Equip JTD']),
            mep_equip_estimate: parseNumber(row[' MEP Equip Estimate '] ?? row['MEP Equip Estimate']),
            mep_equip_projected: parseNumber(row[' MEP Equip Projected '] ?? row['MEP Equip Projected']),
            cash_flow: parseNumber(row[' Cash Flow '] ?? row['Cash Flow']),
            gross_profit_dollars: parseNumber(row['Gross Profit'] ?? row[' Gross Profit ']),
            open_receivables: parseNumber(row[' Open Receivables '] ?? row['Open Receivables']),
            current_est_cost: parseNumber(row['Current Est Cost'] ?? row[' Current Est Cost ']),
            pending_change_orders: parseNumber(row[' Pending Change Orders '] ?? row['Pending Change Orders']),
            approved_changes: parseNumber(row['Approved Changes'] ?? row[' Approved Changes ']),
            change_order_count: parseNumber(row['Quantity Of Change Orders'] ?? row[' Quantity Of Change Orders ']),
            original_estimated_margin: parseNumber(row[' Original Estimated Margin '] ?? row['Original Estimated Margin']),
            original_estimated_margin_pct: parseNumber(row['Original Estimated Margin %'] ?? row[' Original Estimated Margin % ']),
            actual_labor_rate: parseNumber(row['Actual Labor Rate'] ?? row[' Actual Labor Rate ']),
            estimated_labor_rate: parseNumber(row['Estimated Labor Rate'] ?? row[' Estimated Labor Rate ']),
            current_est_labor_cost: parseNumber(row['Current Est Labor Cost'] ?? row[' Current Est Labor Cost ']),
            ttl_labor_projected: parseNumber(row['TTL Labor $ Projected'] ?? row[' TTL Labor $ Projected ']),
            start_month: row['StartMonth'] ? excelDateToJS(row['StartMonth']) : null,
            month_closed: row['MonthClosed'] ? excelDateToJS(row['MonthClosed']) : null,
            customer_number: (row['Customer'] ?? row[' Customer ']) ? String(row['Customer'] ?? row[' Customer ']) : null,
            customer_name: row['Customer Name'] ?? row[' Customer Name '] ?? '',
            ship_address: row['Ship Address'] ?? row[' Ship Address '] ?? row['Address'] ?? '',
            ship_city: row['Ship City'] ?? row[' Ship City '] ?? row['City'] ?? '',
            ship_state: row['Ship State'] ?? row[' Ship State '] ?? row['State'] ?? '',
            ship_zip: row['Ship Zip'] ?? row[' Ship Zip '] ?? row['Zip'] ?? '',
            primary_market: row['Primary Market'] ?? row[' Primary Market '] ?? '',
            negotiated_work: row['Negotiated Work'] ?? row[' Negotiated Work '] ?? '',
            delivery_method: row['Delivery Method'] ?? row[' Delivery Method '] ?? '',
            raw_data: null
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
      console.log(`[Vista Auto-Import] Processing ${workOrderSheetName} with chunked memory management...`);
      results.sheetsFound.push(workOrderSheetName);

      const woWorkbook = XLSX.readFile(tempFilePath, { sheets: workOrderSheetName });
      const woSheet = woWorkbook.Sheets[workOrderSheetName];
      const woRange = XLSX.utils.decode_range(woSheet['!ref'] || 'A1');
      const totalWORows = woRange.e.r;
      console.log(`[Vista Auto-Import] ${workOrderSheetName}: ${totalWORows} rows to process`);

      if (totalWORows > 0) {
        const batch = await VistaData.createImportBatch({
          file_name: req.file.originalname,
          file_type: 'work_orders',
          records_total: totalWORows,
          imported_by: req.user.id
        }, req.tenantId);

        let newCount = 0;
        let updatedCount = 0;
        const WO_CHUNK_SIZE = 500;

        for (let startRow = 1; startRow <= totalWORows; startRow += WO_CHUNK_SIZE) {
          const endRow = Math.min(startRow + WO_CHUNK_SIZE - 1, totalWORows);
          console.log(`[Vista Auto-Import] Processing work orders rows ${startRow}-${endRow}...`);

          const chunkRange = { s: { r: 0, c: woRange.s.c }, e: { r: endRow, c: woRange.e.c } };
          const chunkData = XLSX.utils.sheet_to_json(woSheet, { range: chunkRange, defval: '' });

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
            raw_data: null
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
            raw_data: null
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
            raw_data: null
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
    let facilitiesSheetName = null;
    for (const sn of sheetNames) {
      const wb = XLSX.readFile(tempFilePath, { sheets: sn, sheetRows: 2 });
      const testData = XLSX.utils.sheet_to_json(wb.Sheets[sn]);
      if (testData.length > 0) {
        const firstRow = testData[0];
        if (firstRow.hasOwnProperty('Customer_Owner-Facility') || firstRow.hasOwnProperty('Customer_Owner')) {
          facilitiesSheetName = sn;
          break;
        }
      }
    }

    if (facilitiesSheetName) {
      console.log(`[Vista Auto-Import] Processing facilities from ${facilitiesSheetName}...`);
      results.sheetsFound.push(`${facilitiesSheetName} (Facilities)`);
      const data = loadSheet(facilitiesSheetName);

      if (data.length > 0) {
        let createdCount = 0;
        let updatedCount = 0;
        let notFoundCount = 0;
        const notFoundNames = [];

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
          not_found_names: notFoundNames
        };
        results.sheetsProcessed.push(`${facilitiesSheetName} (Facilities)`);
        console.log(`[Vista Auto-Import] Facilities: ${createdCount} created, ${updatedCount} updated, ${notFoundCount} not found`);
      }
    }

    // Check if any sheets were processed
    if (results.sheetsProcessed.length === 0) {
      // Clean up temp file before returning error
      if (tempFilePath) {
        fs.unlink(tempFilePath, () => {});
      }
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
      console.log('[Vista Auto-Import] Auto-linking 100% matches...');

      if (results.contracts.total > 0) {
        const contractLinkResult = await VistaData.autoLinkExactContractMatches(req.tenantId, req.user.id);
        autoLink.contracts = contractLinkResult;
        console.log(`[Vista Auto-Import] Auto-linked ${contractLinkResult.contracts_linked} contracts (100% match by number)`);
      }

      if (results.customers.total > 0) {
        const customerLinkResult = await VistaData.autoLinkExactCustomerMatches(req.tenantId, req.user.id);
        autoLink.customers = customerLinkResult;
        console.log(`[Vista Auto-Import] Auto-linked ${customerLinkResult.customers_linked} customers (100% match)`);
      }

      if (results.employees.total > 0) {
        const empLinkResult = await VistaData.autoLinkExactEmployeeMatches(req.tenantId, req.user.id);
        autoLink.employees = empLinkResult;
        console.log(`[Vista Auto-Import] Auto-linked ${empLinkResult.employees_linked} employees (100% match)`);
      }

      if (results.vendors.total > 0) {
        const vendorLinkResult = await VistaData.autoLinkExactVendorMatches(req.tenantId, req.user.id);
        autoLink.vendors = vendorLinkResult;
        console.log(`[Vista Auto-Import] Auto-linked ${vendorLinkResult.vendors_linked} vendors (100% match)`);
      }

      // Auto-import contracts as projects (only those NOT already linked)
      if (results.contracts.total > 0) {
        console.log('[Vista Auto-Import] Auto-importing contracts as projects...');
        const contractResult = await VistaData.importUnmatchedContractsToTitan(req.tenantId, req.user.id);
        autoImport.contracts = contractResult;
        console.log(`[Vista Auto-Import] Auto-imported ${contractResult.imported} contracts as projects`);
      }

      if (results.customers.total > 0) {
        console.log('[Vista Auto-Import] Auto-importing customers...');
        const customerResult = await VistaData.importUnmatchedCustomersToTitan(req.tenantId, req.user.id);
        autoImport.customers = customerResult;
        console.log(`[Vista Auto-Import] Auto-imported ${customerResult.imported} customers`);
      }

      if (results.contracts.total > 0 || results.workOrders.total > 0) {
        console.log('[Vista Auto-Import] Auto-importing departments...');
        const deptResult = await VistaData.importUnmatchedDepartmentsToTitan(req.tenantId, req.user.id);
        autoImport.departments = deptResult;
        console.log(`[Vista Auto-Import] Auto-imported ${deptResult.imported} departments`);

        const deptLinkResult = await VistaData.autoLinkExactDepartmentMatches(req.tenantId, req.user.id);
        autoLink.departments = deptLinkResult;
        console.log(`[Vista Auto-Import] Auto-linked ${deptLinkResult.codes_linked} department codes`);
      }

      if (results.employees.total > 0) {
        console.log('[Vista Auto-Import] Auto-importing employees...');
        const empResult = await VistaData.importUnmatchedEmployeesToTitan(req.tenantId, req.user.id);
        autoImport.employees = empResult;
        console.log(`[Vista Auto-Import] Auto-imported ${empResult.imported} employees`);
      }

      if (results.vendors.total > 0) {
        console.log('[Vista Auto-Import] Auto-importing vendors...');
        const vendorResult = await VistaData.importUnmatchedVendorsToTitan(req.tenantId, req.user.id);
        autoImport.vendors = vendorResult;
        console.log(`[Vista Auto-Import] Auto-imported ${vendorResult.imported} vendors`);
      }
    } catch (autoImportError) {
      console.error('[Vista Auto-Import] Auto-import error:', autoImportError.message);
      // Don't fail the whole upload if auto-import fails
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Vista Auto-Import] Complete in ${totalTime}s. Sheets processed: ${results.sheetsProcessed.join(', ')}`);

    // Clean up temp file
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('[Vista Auto-Import] Failed to delete temp file:', err.message);
      });
    }

    res.json({
      message: `Successfully imported data from ${results.sheetsProcessed.length} sheet(s)`,
      ...results,
      autoLink,
      autoImport
    });
  } catch (error) {
    console.error('[Vista Auto-Import] Error:', error.message);
    console.error('[Vista Auto-Import] Stack:', error.stack);
    if (tempFilePath) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error('[Vista Auto-Import] Failed to delete temp file:', err.message);
      });
    }
    next(error);
  }
});

module.exports = router;
