export interface ConstructionTypeOption {
  value: string;
  label: string;
}

/**
 * Construction types for proposals — used for the {{construction_type}}
 * template variable and for filtering / reporting.
 */
export const CONSTRUCTION_TYPES: ConstructionTypeOption[] = [
  { value: 'New Construction', label: 'New Construction' },
  { value: 'Renovation', label: 'Renovation' },
  { value: 'Addition', label: 'Addition' },
  { value: 'Tenant Improvement', label: 'Tenant Improvement' },
  { value: 'Retrofit', label: 'Retrofit' },
  { value: 'Replacement', label: 'Replacement' },
  { value: 'Service / Maintenance', label: 'Service / Maintenance' },
  { value: 'Design-Build', label: 'Design-Build' },
];

export const CONSTRUCTION_TYPE_VALUES = CONSTRUCTION_TYPES.map((c) => c.value);
