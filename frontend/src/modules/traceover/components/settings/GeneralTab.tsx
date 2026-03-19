import { useState, useEffect, useCallback } from 'react';
import type { PipeSpec, EstCategoryFilter } from '../../types/pipingSystem';
import type { JointMethod, SystemMaterial } from '../../types/pipingSystem';
import {
  JOINT_METHOD_TO_INSTALL_TYPES,
  MATERIAL_TO_EST_KEYWORDS,
  detectFittingType,
  extractSchedule,
  parseCompoundSizeNormalized,
} from '../../lib/estProductMapper';
import { estProductService } from '../../../../services/estProducts';

interface GeneralTabProps {
  spec: PipeSpec;
  onUpdate: (updates: Partial<PipeSpec>) => void;
}

type FilterOption = { value: string; count: number };

// EST product category → the `product` column value in est_products
const CATEGORY_PRODUCTS: Record<string, string> = {
  pipe: 'Pipework',
  fittings: 'Pipework',
  valves: 'Valve',
  hangers: 'Hanger',
};

const CATEGORY_LABELS: Record<string, string> = {
  pipe: 'Pipe',
  fittings: 'Fittings',
  valves: 'Valves',
  hangers: 'Hangers',
};

// ─── Styles ───

const selectStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 6,
  border: '1px solid #1f3450',
  backgroundColor: '#131f33',
  padding: '6px 8px',
  fontSize: 12,
  color: '#d4e3f3',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 4,
  fontSize: 10,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#4a6a88',
};

const sectionStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 6,
  border: '1px solid #1f3450',
  backgroundColor: '#0d1b2a',
  marginBottom: 12,
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#7a9ab5',
  marginBottom: 10,
};

const populateBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 4,
  border: '1px solid #2563eb',
  backgroundColor: 'transparent',
  color: '#3b82f6',
  cursor: 'pointer',
};

const populateBtnDisabledStyle: React.CSSProperties = {
  ...populateBtnStyle,
  border: '1px solid #1f3450',
  color: '#4a6a88',
  cursor: 'not-allowed',
};

// ─── Reverse mapping helpers ───

function installTypeToJointMethod(installType: string): JointMethod | null {
  const lower = installType.toLowerCase();
  for (const [code, aliases] of Object.entries(JOINT_METHOD_TO_INSTALL_TYPES)) {
    if (aliases.some(a => a.toLowerCase() === lower)) return code as JointMethod;
  }
  return null;
}

function estMaterialToSystemMaterial(estMat: string): SystemMaterial | null {
  const lower = estMat.toLowerCase();
  for (const [code, keywords] of Object.entries(MATERIAL_TO_EST_KEYWORDS)) {
    if (keywords.some(k => k.toLowerCase() === lower)) return code as SystemMaterial;
  }
  return null;
}

// ─── Category Filter Section ───

interface CategoryFilterProps {
  category: string;
  filter: EstCategoryFilter;
  onChange: (updates: EstCategoryFilter) => void;
  onPopulate: () => void;
  populating: boolean;
}

function CategoryFilterSection({ category, filter, onChange, onPopulate, populating }: CategoryFilterProps) {
  const [installTypes, setInstallTypes] = useState<FilterOption[]>([]);
  const [materials, setMaterials] = useState<FilterOption[]>([]);
  const [specs, setSpecs] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(false);

  const productFilter = CATEGORY_PRODUCTS[category];

  // Load install types for this category
  useEffect(() => {
    setLoading(true);
    estProductService.getSpecFilterOptions({ product: productFilter })
      .then((options) => {
        setInstallTypes(options.installTypes);
        setMaterials(options.materials);
        setSpecs(options.specs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productFilter]);

  // Cascade: reload materials + specs when install type changes
  useEffect(() => {
    if (!filter.installType) return;
    estProductService.getSpecFilterOptions({ product: productFilter, installType: filter.installType })
      .then((options) => {
        setMaterials(options.materials);
        setSpecs(options.specs);
        // Clear material if no longer available
        if (filter.material && !options.materials.find(m => m.value === filter.material)) {
          onChange({ ...filter, material: undefined, spec: undefined });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line
  }, [filter.installType]);

  // Cascade: reload specs when material changes
  useEffect(() => {
    if (!filter.installType || !filter.material) return;
    estProductService.getSpecFilterOptions({ product: productFilter, installType: filter.installType, material: filter.material })
      .then((options) => {
        setSpecs(options.specs);
        if (filter.spec && !options.specs.find(s => s.value === filter.spec)) {
          onChange({ ...filter, spec: undefined });
        }
      })
      .catch(() => {});
  // eslint-disable-next-line
  }, [filter.material]);

  const canPopulate = !!filter.installType && !!filter.material;

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={sectionHeaderStyle}>
          {CATEGORY_LABELS[category]}
          {loading && <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 6 }}>Loading...</span>}
        </div>
        <button
          onClick={onPopulate}
          disabled={!canPopulate || populating}
          style={canPopulate && !populating ? populateBtnStyle : populateBtnDisabledStyle}
        >
          {populating ? 'Populating...' : 'Populate Rates'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Install Type</label>
          <select
            value={filter.installType || ''}
            onChange={(e) => onChange({ ...filter, installType: e.target.value || undefined, spec: undefined })}
            style={selectStyle}
            disabled={loading}
          >
            <option value="">-- Select --</option>
            {installTypes.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value} ({opt.count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Material</label>
          <select
            value={filter.material || ''}
            onChange={(e) => onChange({ ...filter, material: e.target.value || undefined, spec: undefined })}
            style={selectStyle}
            disabled={loading}
          >
            <option value="">-- Select --</option>
            {materials.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value} ({opt.count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Spec</label>
          <select
            value={filter.spec || ''}
            onChange={(e) => onChange({ ...filter, spec: e.target.value || undefined })}
            style={selectStyle}
            disabled={loading}
          >
            <option value="">All</option>
            {specs.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value} ({opt.count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Main GeneralTab ───

export default function GeneralTab({ spec, onUpdate }: GeneralTabProps) {
  const [populatingCategory, setPopulatingCategory] = useState<string | null>(null);

  const filters = spec.estFilters || {};

  const updateCategoryFilter = useCallback((category: string, catFilter: EstCategoryFilter) => {
    const newFilters = { ...filters, [category]: catFilter };

    const updates: Partial<PipeSpec> = { estFilters: newFilters };

    // Also update legacy estInstallType/estMaterial from pipe category for backward compat
    if (category === 'pipe') {
      if (catFilter.installType) updates.estInstallType = catFilter.installType;
      if (catFilter.material) updates.estMaterial = catFilter.material;
    }

    // Auto-derive internal jointMethod/material from pipe install type
    if (category === 'pipe' && catFilter.installType) {
      const jm = installTypeToJointMethod(catFilter.installType);
      if (jm) updates.jointMethod = jm;
    }
    if (category === 'pipe' && catFilter.material) {
      const sm = estMaterialToSystemMaterial(catFilter.material);
      if (sm) updates.material = sm;
    }

    onUpdate(updates);
  }, [filters, onUpdate]);

  const handlePopulate = useCallback(async (category: string) => {
    const catFilter = filters[category as keyof typeof filters];
    if (!catFilter?.installType || !catFilter?.material) return;

    setPopulatingCategory(category);
    try {
      const productFilter = CATEGORY_PRODUCTS[category];
      const result = await estProductService.getRatesForSpec({
        installType: catFilter.installType,
        material: catFilter.material,
        product: productFilter,
      });

      const updates: Partial<PipeSpec> = {};

      if (category === 'pipe') {
        // Populate pipe rates from per_ft products
        const pipeRates: Record<string, number> = {};
        for (const rate of result.pipeRates) {
          if (rate.size_normalized) {
            pipeRates[rate.size_normalized] = rate.labor_time;
          }
        }
        updates.pipeRates = pipeRates;
      }

      if (category === 'fittings') {
        // Populate fittings, reducing, and reducing tee rates
        const fittingRates: Record<string, Record<string, number>> = {};
        const reducingFittingRates: Record<string, Record<string, number>> = {};
        const reducingTeeRates: Record<string, number> = {};
        const crossReducingRates: Record<string, number> = {};

        for (const product of result.fittingProducts) {
          const detected = detectFittingType(product);

          if (detected.kind === 'fitting') {
            const ft = detected.type;
            if (!fittingRates[ft]) fittingRates[ft] = {};
            if (product.size_normalized) {
              fittingRates[ft][product.size_normalized] = product.labor_time;
            }
          } else if (detected.kind === 'reducing') {
            const rt = detected.type;
            if (!reducingFittingRates[rt]) reducingFittingRates[rt] = {};
            // Parse compound size for composite key (e.g., "4|2")
            const compound = parseCompoundSizeNormalized(product.size, product.size_normalized);
            if (compound) {
              const [mainSize, reducingSize] = compound;
              reducingFittingRates[rt][`${mainSize}|${reducingSize}`] = product.labor_time;
            } else if (product.size_normalized) {
              // Fallback: use single size (won't render in matrix but preserves data)
              reducingFittingRates[rt][product.size_normalized] = product.labor_time;
            }
          } else if (detected.kind === 'reducing_tee') {
            // Parse compound size for composite key (e.g., "4|2")
            const compound = parseCompoundSizeNormalized(product.size, product.size_normalized);
            if (compound) {
              const [mainSize, branchSize] = compound;
              reducingTeeRates[`${mainSize}|${branchSize}`] = product.labor_time;
            } else if (product.size_normalized) {
              reducingTeeRates[product.size_normalized] = product.labor_time;
            }
          }
        }

        updates.fittingRates = fittingRates;
        updates.reducingFittingRates = reducingFittingRates;
        updates.reducingTeeRates = reducingTeeRates;
        updates.crossReducingRates = crossReducingRates;
      }

      if (category === 'valves') {
        // Populate valve fitting rates (valve types go into fittingRates)
        const fittingRates: Record<string, Record<string, number>> = { ...spec.fittingRates };
        for (const product of result.fittingProducts) {
          const detected = detectFittingType(product);
          if (detected.kind === 'fitting') {
            const ft = detected.type;
            if (!fittingRates[ft]) fittingRates[ft] = {};
            else fittingRates[ft] = { ...fittingRates[ft] };
            if (product.size_normalized) {
              fittingRates[ft][product.size_normalized] = product.labor_time;
            }
          }
        }
        updates.fittingRates = fittingRates;
      }

      // Hangers - future use, just log for now
      if (category === 'hangers') {
        // Hangers don't have a rate tab yet — placeholder
      }

      onUpdate(updates);
    } catch (err) {
      console.error('Failed to populate rates:', err);
    } finally {
      setPopulatingCategory(null);
    }
  }, [filters, spec.fittingRates, onUpdate]);

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Name + Stock Length */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Spec Name</label>
          <input
            type="text"
            value={spec.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            style={selectStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Stock Pipe Length (ft)</label>
          <input
            type="number"
            value={spec.stockPipeLength}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) onUpdate({ stockPipeLength: val });
            }}
            min={1}
            step={1}
            style={selectStyle}
          />
        </div>
      </div>

      {/* Category filter sections */}
      {(['pipe', 'fittings', 'valves', 'hangers'] as const).map((cat) => (
        <CategoryFilterSection
          key={cat}
          category={cat}
          filter={filters[cat] || {}}
          onChange={(f) => updateCategoryFilter(cat, f)}
          onPopulate={() => handlePopulate(cat)}
          populating={populatingCategory === cat}
        />
      ))}
    </div>
  );
}
