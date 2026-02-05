const express = require('express');
const router = express.Router();
const VistaData = require('../models/VistaData');
const multer = require('multer');
const XLSX = require('xlsx');
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

// Configure multer for Excel file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit for large VP data files
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
          return res.status(400).json({ message: 'File too large. Maximum size is 200MB.' });
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
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse the Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });

    const results = {
      contracts: { total: 0, new: 0, updated: 0, batch_id: null },
      workOrders: { total: 0, new: 0, updated: 0, batch_id: null },
      employees: { total: 0, new: 0, updated: 0, batch_id: null },
      customers: { total: 0, new: 0, updated: 0, batch_id: null },
      vendors: { total: 0, new: 0, updated: 0, batch_id: null },
      sheetsFound: [],
      sheetsProcessed: []
    };

    // Process Contracts sheet (TGPBI_PMContractStatus)
    const contractSheetName = 'TGPBI_PMContractStatus';
    if (workbook.SheetNames.includes(contractSheetName)) {
      results.sheetsFound.push(contractSheetName);
      const worksheet = workbook.Sheets[contractSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length > 0) {
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
            orig_contract_amount: parseNumber(row['Orig Contract Amt']),
            contract_amount: parseNumber(row['Contract Amt']),
            billed_amount: parseNumber(row['Billed Amt']),
            received_amount: parseNumber(row['Received Amt']),
            backlog: parseNumber(row['Backlog']),
            projected_revenue: parseNumber(row['Projected Revenue']),
            gross_profit_percent: parseNumber(row['Gross Profit %']),
            earned_revenue: parseNumber(row['EarnedRevenue']),
            actual_cost: parseNumber(row['Actual Cost']),
            projected_cost: parseNumber(row['Projected Cost']),
            pf_hours_estimate: parseNumber(row['PF Hours Estimate']),
            pf_hours_jtd: parseNumber(row['PF Hours JTD']),
            sm_hours_estimate: parseNumber(row['SM Hours Estimate']),
            sm_hours_jtd: parseNumber(row['SM Hours JTD']),
            total_hours_estimate: parseNumber(row['Total Hours Estimate']),
            total_hours_jtd: parseNumber(row['Total Hours JTD']),
            customer_number: row['Customer'] ? String(row['Customer']) : null,
            customer_name: row['Customer Name'] || '',
            ship_city: row['Ship City'] || '',
            ship_state: row['Ship State'] || '',
            ship_zip: row['Ship Zip'] || '',
            primary_market: row['Primary Market'] || '',
            negotiated_work: row['Negotiated Work'] || '',
            delivery_method: row['Delivery Method'] || '',
            raw_data: row
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

    // Process Work Orders sheet (TGPBI_SMWorkOrderStatus)
    const workOrderSheetName = 'TGPBI_SMWorkOrderStatus';
    if (workbook.SheetNames.includes(workOrderSheetName)) {
      results.sheetsFound.push(workOrderSheetName);
      const worksheet = workbook.Sheets[workOrderSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length > 0) {
        // Create import batch for work orders
        const batch = await VistaData.createImportBatch({
          file_name: req.file.originalname,
          file_type: 'work_orders',
          records_total: data.length,
          imported_by: req.user.id
        }, req.tenantId);

        let newCount = 0;
        let updatedCount = 0;

        for (const row of data) {
          // Try multiple possible column names for contract amount (including with spaces from Excel quirks)
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
            raw_data: row
          };

          if (!woData.work_order_number) continue;

          const result = await VistaData.upsertWorkOrder(woData, req.tenantId, batch.id);
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

        results.workOrders = { total: data.length, new: newCount, updated: updatedCount, batch_id: batch.id };
        results.sheetsProcessed.push(workOrderSheetName);
      }
    }

    // Process Employees sheet (TGPREmployees)
    const employeeSheetName = 'TGPREmployees';
    if (workbook.SheetNames.includes(employeeSheetName)) {
      results.sheetsFound.push(employeeSheetName);
      const worksheet = workbook.Sheets[employeeSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

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
            raw_data: row
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
    if (workbook.SheetNames.includes(customerSheetName)) {
      results.sheetsFound.push(customerSheetName);
      const worksheet = workbook.Sheets[customerSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

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
            raw_data: row
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
    if (workbook.SheetNames.includes(vendorSheetName)) {
      results.sheetsFound.push(vendorSheetName);
      const worksheet = workbook.Sheets[vendorSheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

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
            raw_data: row
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

    // Check if any sheets were processed
    if (results.sheetsProcessed.length === 0) {
      return res.status(400).json({
        message: 'No valid Vista data sheets found. Expected sheets: TGPBI_PMContractStatus, TGPBI_SMWorkOrderStatus, TGPREmployees, TGARCustomers, TGAPVendors',
        availableSheets: workbook.SheetNames
      });
    }

    res.json({
      message: `Successfully imported data from ${results.sheetsProcessed.length} sheet(s)`,
      ...results
    });
  } catch (error) {
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

module.exports = router;
