const XLSX = require('xlsx');

const PARTS_SHEET_CANDIDATES = ['Parts', 'parts'];

const str = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const dt = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') {
    const epoch = Date.UTC(1899, 11, 30);
    const d = new Date(epoch + v * 86400000);
    return d.toISOString();
  }
  const s = String(v).trim();
  if (!s) return null;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const uuid = (v) => {
  const s = str(v);
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
};

const PIPE_DESC_RE = /\b(pipe|tube)\b/i;
const FITTING_DESC_RE = /\b(elbow|tee|reducer|flange|coupling|gasket|gskt|sockolet|stub|nipple|cap|adapter|union|olet|ell|cplg|fitting)\b/i;

// Mirror of the SQL CASE in migration 211 — keep them in sync. Anything classified
// here is also classified the same way by the migration's backfill.
function classifyMaterialType(serviceType, description, length) {
  const desc = description || '';
  const len = Number.isFinite(length) ? length : 0;
  const fitting = FITTING_DESC_RE.test(desc);

  if (serviceType === 'Pipework') {
    if (!fitting && PIPE_DESC_RE.test(desc) && len > 1) return 'pipe';
    if (!fitting && len > 5) return 'pipe';
    return 'pipe_fitting';
  }
  switch (serviceType) {
    case 'Weld': return 'weld';
    case 'Valve': return 'valve';
    case 'Hanger': return 'hanger';
    case 'Coupling': return 'coupling';
    case 'Equipment':
    case 'Mechanical Equipment': return 'equipment';
    case 'Round Duct':
    case 'Rectangular Duct': return 'duct';
    case 'Duct Fittings':
    case 'Duct Accessory':
    case 'Duct Accessories':
    case 'Air Terminals':
    case 'Flex Ducts':
    case 'Ducts': return 'duct_accessory';
    default: return 'other';
  }
}

function parseStratusWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = PARTS_SHEET_CANDIDATES.find((n) => wb.SheetNames.includes(n));
  if (!sheetName) {
    throw new Error(`Workbook does not contain a "Parts" sheet. Found: ${wb.SheetNames.join(', ')}`);
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: true });
  if (rows.length === 0) {
    throw new Error('Parts sheet is empty.');
  }

  const sourceProjectName = str(rows[0].ProjectName);

  const parts = rows.map((r) => {
    const serviceType = str(r.ServiceType);
    const desc = str(r.ItemDescription);
    const length = num(r.Length);
    const materialType = classifyMaterialType(serviceType, desc, length);
    return {
    stratus_part_id: uuid(r.Id),
    cad_id: str(r.CadId),
    model_id: uuid(r.ModelId),
    assembly_id: uuid(r.AssemblyId),
    assembly_name: str(r.AssemblyName),
    part_number: str(r.PartNumber),

    service_name: str(r.ServiceName),
    service_abbreviation: str(r.ServiceAbbreviation),
    fabrication_service: str(r.FabricationService),
    item_description: desc,
    area: str(r.Area),
    size: str(r.Size),
    part_division: str(r.PartDivision),
    package_category: str(r.PackageCategory),
    category: str(r.Category),
    cost_category: str(r.CostCategory),

    service_type: serviceType,
    cut_type: str(r.CutType),
    service_group: str(r.ServiceGroup),
    material_type: materialType,

    length,
    item_weight: num(r.ItemWeight),
    install_hours: num(r.InstallHours),

    material_cost: num(r.MaterialCost),
    install_cost: num(r.InstallCost),
    fabrication_cost: num(r.FabricationCost),
    total_cost: num(r.TotalCost),

    part_tracking_status: str(r.PartTrackingStatus),
    part_field_phase_code: str(r.PartFieldPhaseCode),
    part_shop_phase_code: str(r.PartShopPhaseCode),

    weld_id: str(r.WeldID),
    fit_id: str(r.FitID),
    qc_id: str(r.QCID),

    part_issue_to_shop_dt: dt(r.PartIssueToShopDT),
    part_shipped_dt: dt(r.PartShippedDT),
    part_field_installed_dt: dt(r.PartFieldInstalledDT),
    fab_complete_date: dt(r.FabCompleteDate),
    qaqc_complete_date: dt(r.QAQCCompleteDate),

    raw: r,
    };
  });

  return { sourceProjectName, rowCount: parts.length, parts };
}

module.exports = { parseStratusWorkbook, classifyMaterialType };
