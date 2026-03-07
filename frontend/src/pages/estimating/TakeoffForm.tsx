import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { takeoffsApi, Takeoff, TakeoffItem } from '../../services/takeoffs';
import { estimatesApi, Estimate } from '../../services/estimates';

const FITTING_TYPES = [
  { value: '90', label: '90\u00B0 Elbow', rateKey: '90_elbow' },
  { value: '45', label: '45\u00B0 Elbow', rateKey: '45_elbow' },
  { value: 'tee', label: 'Tee', rateKey: 'tee' },
  { value: 'wye', label: 'Wye', rateKey: 'wye' },
  { value: 'reducer', label: 'Reducer', rateKey: 'reducer' },
  { value: 'coupling', label: 'Coupling', rateKey: 'coupling' },
  { value: 'union', label: 'Union', rateKey: 'union' },
  { value: 'cap', label: 'Cap', rateKey: 'cap' },
  { value: 'valve', label: 'Valve', rateKey: 'valve' },
  { value: 'flange', label: 'Flange', rateKey: 'flange' },
  { value: 'nipple', label: 'Nipple', rateKey: 'nipple' },
  { value: 'bushing', label: 'Bushing', rateKey: 'bushing' },
  { value: 'pipe', label: 'Pipe', rateKey: 'pipe' },
];

const PIPE_SIZES = [
  '1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '4"', '5"', '6"', '8"', '10"', '12"', '14"', '16"',
];

const JOIN_TYPES = [
  { value: 'threaded', label: 'Threaded' },
  { value: 'welded', label: 'Welded' },
  { value: 'flanged', label: 'Flanged' },
  { value: 'grooved', label: 'Grooved' },
  { value: 'press', label: 'Press' },
  { value: 'soldered', label: 'Soldered' },
  { value: 'glued', label: 'Glued' },
];

const FLANGE_TYPES = [
  { value: 'slip-on', label: 'Slip-On' },
  { value: 'blind', label: 'Blind' },
  { value: 'weld-neck', label: 'Weld Neck' },
  { value: 'threaded', label: 'Threaded' },
];

const getSizeConfig = (fittingType: string): { count: number; labels: string[] } => {
  switch (fittingType) {
    case 'tee':
    case 'wye':
      return { count: 3, labels: ['Run', 'Run', 'Branch'] };
    case 'reducer':
    case 'bushing':
      return { count: 2, labels: ['Large End', 'Small End'] };
    default:
      return { count: 1, labels: ['Size'] };
  }
};

// For rate lookup, use the largest size (run for tees, large end for reducers)
const getLookupSize = (sizes: string[]): string => {
  if (sizes.length === 0) return '';
  // Parse sizes to find the largest by converting to decimal inches
  const sizeToNum = (s: string): number => {
    const clean = s.replace('"', '').trim();
    const parts = clean.split('-');
    if (parts.length === 2) {
      const whole = parseFloat(parts[0]) || 0;
      const frac = parts[1].includes('/') ? (() => { const [n, d] = parts[1].split('/'); return parseFloat(n) / parseFloat(d); })() : parseFloat(parts[1]) || 0;
      return whole + frac;
    }
    if (clean.includes('/')) {
      const [num, den] = clean.split('/');
      return parseFloat(num) / parseFloat(den);
    }
    return parseFloat(clean) || 0;
  };
  return sizes.reduce((max, s) => sizeToNum(s) > sizeToNum(max) ? s : max, sizes[0]);
};

interface LocalLineItem {
  id?: number;
  fitting_type: string;
  size: string;
  join_type: string;
  quantity: number;
  base_hours_per_unit: number;
  base_hours_total: number;
  adjusted_hours: number;
  material_unit_cost: number;
  material_cost: number;
  remarks: string;
  rate_not_found?: boolean;
}

const TakeoffForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  // Header form
  const [form, setForm] = useState({
    name: '',
    description: '',
    estimate_id: '' as string | number,
    performance_factor: 0,
    notes: '',
    status: 'draft',
  });

  // Line items
  const [lineItems, setLineItems] = useState<LocalLineItem[]>([]);

  // Quick-add state
  const [selectedFitting, setSelectedFitting] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedJoinType, setSelectedJoinType] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [joinTypeLocked, setJoinTypeLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'fitting' | 'size' | 'join' | 'qty'>('fitting');
  const [editingMaterialIdx, setEditingMaterialIdx] = useState<number | null>(null);
  const [editingQtyIdx, setEditingQtyIdx] = useState<number | null>(null);

  const qtyInputRef = useRef<HTMLInputElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);
  const sizeConfig = getSizeConfig(selectedFitting);

  // Fetch existing takeoff for edit mode
  const { isLoading: loadingExisting } = useQuery({
    queryKey: ['takeoff', id],
    queryFn: async () => {
      const res = await takeoffsApi.getById(Number(id));
      const takeoff = res.data;
      setForm({
        name: takeoff.name || '',
        description: takeoff.description || '',
        estimate_id: takeoff.estimate_id || '',
        performance_factor: Number(takeoff.performance_factor) || 0,
        notes: takeoff.notes || '',
        status: takeoff.status || 'draft',
      });
      if (takeoff.items && takeoff.items.length > 0) {
        setLineItems(takeoff.items.map((item: TakeoffItem) => ({
          id: item.id,
          fitting_type: item.fitting_type || '',
          size: item.size || '',
          join_type: item.join_type || '',
          quantity: Number(item.quantity) || 1,
          base_hours_per_unit: Number(item.base_hours_per_unit) || 0,
          base_hours_total: Number(item.base_hours_total) || 0,
          adjusted_hours: Number(item.adjusted_hours) || 0,
          material_unit_cost: Number(item.material_unit_cost) || 0,
          material_cost: Number(item.material_cost) || 0,
          remarks: item.remarks || '',
        })));
      }
      return takeoff;
    },
    enabled: isEdit,
  });

  // Fetch estimates for the dropdown
  const { data: estimates = [] } = useQuery({
    queryKey: ['estimates-for-takeoff'],
    queryFn: () => estimatesApi.getAll().then(res => res.data),
  });

  // Auto-focus quantity input
  useEffect(() => {
    if (step === 'qty' && qtyInputRef.current) {
      qtyInputRef.current.focus();
      qtyInputRef.current.select();
    }
  }, [step]);

  const getFittingLabel = (value: string) =>
    FITTING_TYPES.find(f => f.value === value)?.label || value;
  const getFittingRateKey = (value: string) =>
    FITTING_TYPES.find(f => f.value === value)?.rateKey || value;
  const getJoinLabel = (value: string) =>
    JOIN_TYPES.find(j => j.value === value)?.label || FLANGE_TYPES.find(j => j.value === value)?.label || value;

  const perfMultiplier = 1 + (form.performance_factor / 100);

  // Recalculate all items when performance factor changes
  const recalculateAll = (items: LocalLineItem[], perfFactor: number): LocalLineItem[] => {
    const mult = 1 + (perfFactor / 100);
    return items.map(item => ({
      ...item,
      adjusted_hours: item.base_hours_total * mult,
    }));
  };

  // Quick-add handlers
  const handleSelectFitting = (value: string) => {
    setSelectedFitting(value);
    setSelectedSizes([]);
    setStep('size');
  };

  const handleSelectSize = (value: string) => {
    const newSizes = [...selectedSizes, value];
    setSelectedSizes(newSizes);
    const config = getSizeConfig(selectedFitting);
    if (newSizes.length < config.count) return;
    if (joinTypeLocked && selectedJoinType) {
      setStep('qty');
    } else {
      setStep('join');
    }
  };

  const handleSelectJoinType = (value: string) => {
    setSelectedJoinType(value);
    setStep('qty');
  };

  const handleAddItem = async () => {
    if (!selectedFitting || selectedSizes.length === 0) return;

    const sizeStr = selectedSizes.join(' x ');
    const lookupSize = getLookupSize(selectedSizes);
    const rateKey = getFittingRateKey(selectedFitting);

    // Lookup productivity rate
    let baseHoursPerUnit = 0;
    let rateNotFound = false;
    try {
      const res = await takeoffsApi.lookupRate(rateKey, selectedJoinType || null, lookupSize);
      if (res.data.found) {
        baseHoursPerUnit = Number(res.data.hours_per_unit);
      } else {
        rateNotFound = true;
      }
    } catch (err) {
      console.error('Rate lookup failed:', err);
      rateNotFound = true;
    }

    const qty = quantity || 1;
    const baseHoursTotal = baseHoursPerUnit * qty;
    const adjustedHours = baseHoursTotal * perfMultiplier;

    const newItem: LocalLineItem = {
      fitting_type: selectedFitting,
      size: sizeStr,
      join_type: selectedJoinType,
      quantity: qty,
      base_hours_per_unit: baseHoursPerUnit,
      base_hours_total: baseHoursTotal,
      adjusted_hours: adjustedHours,
      material_unit_cost: 0,
      material_cost: 0,
      remarks: '',
      rate_not_found: rateNotFound,
    };

    setLineItems(prev => [...prev, newItem]);

    // Reset for next item
    setSelectedFitting('');
    setSelectedSizes([]);
    if (!joinTypeLocked) setSelectedJoinType('');
    setQuantity(1);
    setStep('fitting');

    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); }
  };

  const removeItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handlePerfFactorChange = (val: number) => {
    setForm(prev => ({ ...prev, performance_factor: val }));
    setLineItems(prev => recalculateAll(prev, val));
  };

  const handleMaterialCostChange = (index: number, unitCost: number) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      return { ...item, material_unit_cost: unitCost, material_cost: unitCost * item.quantity };
    }));
  };

  const handleQtyChange = (index: number, newQty: number) => {
    const qty = Math.max(0, newQty);
    setLineItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const baseHoursTotal = item.base_hours_per_unit * qty;
      const adjustedHours = baseHoursTotal * perfMultiplier;
      const materialCost = item.material_unit_cost * qty;
      return { ...item, quantity: qty, base_hours_total: baseHoursTotal, adjusted_hours: adjustedHours, material_cost: materialCost };
    }));
  };

  // Save
  const handleSave = async () => {
    if (!form.name.trim()) {
      window.alert('Name is required.');
      return;
    }
    setSaving(true);
    try {
      const takeoffData = {
        name: form.name,
        description: form.description,
        estimate_id: form.estimate_id ? Number(form.estimate_id) : null,
        performance_factor: form.performance_factor,
        notes: form.notes,
        status: form.status,
      };

      let takeoffId: number;

      if (isEdit) {
        takeoffId = Number(id);
        await takeoffsApi.update(takeoffId, takeoffData);

        // Get existing items to compare
        const existingRes = await takeoffsApi.getById(takeoffId);
        const existingItems = existingRes.data.items || [];
        const existingIds = existingItems.map((item: TakeoffItem) => item.id);
        const currentIds = lineItems.filter(item => item.id).map(item => item.id as number);

        // Delete removed items
        const deletedIds = existingIds.filter((eid: number) => !currentIds.includes(eid));
        for (const itemId of deletedIds) {
          await takeoffsApi.deleteItem(takeoffId, itemId);
        }

        // Update existing and add new items
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          const itemData = {
            sort_order: i + 1,
            fitting_type: item.fitting_type,
            size: item.size,
            join_type: item.join_type,
            quantity: item.quantity,
            base_hours_per_unit: item.base_hours_per_unit,
            base_hours_total: item.base_hours_total,
            adjusted_hours: item.adjusted_hours,
            material_unit_cost: item.material_unit_cost,
            material_cost: item.material_cost,
            remarks: item.remarks,
          };
          if (item.id) {
            await takeoffsApi.updateItem(takeoffId, item.id, itemData);
          } else {
            await takeoffsApi.addItem(takeoffId, itemData);
          }
        }
      } else {
        const res = await takeoffsApi.create(takeoffData);
        takeoffId = res.data.id;

        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          await takeoffsApi.addItem(takeoffId, {
            sort_order: i + 1,
            fitting_type: item.fitting_type,
            size: item.size,
            join_type: item.join_type,
            quantity: item.quantity,
            base_hours_per_unit: item.base_hours_per_unit,
            base_hours_total: item.base_hours_total,
            adjusted_hours: item.adjusted_hours,
            material_unit_cost: item.material_unit_cost,
            material_cost: item.material_cost,
            remarks: item.remarks,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['takeoffs'] });
      queryClient.invalidateQueries({ queryKey: ['takeoff', id] });
      navigate(`/estimating/takeoffs/${takeoffId}`);
    } catch (err) {
      console.error('Failed to save:', err);
      window.alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && loadingExisting) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading takeoff...</div>;
  }

  // Summary calculations
  const totalBaseHours = lineItems.reduce((sum, i) => sum + i.base_hours_total, 0);
  const totalAdjustedHours = lineItems.reduce((sum, i) => sum + i.adjusted_hours, 0);
  const totalMaterialCost = lineItems.reduce((sum, i) => sum + i.material_cost, 0);

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 14, boxSizing: 'border-box',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}
        >
          <ArrowBackIcon />
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>
          {isEdit ? 'Edit Takeoff' : 'New Takeoff'}
        </h1>
      </div>

      {/* Header Form */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Level 2 Piping Takeoff"
            />
          </div>
          <div>
            <label style={labelStyle}>Linked Estimate</label>
            <select
              style={{ ...inputStyle, background: '#fff' }}
              value={form.estimate_id}
              onChange={(e) => setForm(prev => ({ ...prev, estimate_id: e.target.value }))}
            >
              <option value="">None</option>
              {estimates.map((est: Estimate) => (
                <option key={est.id} value={est.id}>{est.estimate_number} - {est.project_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select
              style={{ ...inputStyle, background: '#fff' }}
              value={form.status}
              onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>
              Performance Factor (%)
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>
                {form.performance_factor < 0 ? `${Math.abs(form.performance_factor)}% faster` :
                 form.performance_factor > 0 ? `${form.performance_factor}% slower` : 'Baseline'}
              </span>
            </label>
            <input
              type="number"
              style={inputStyle}
              value={form.performance_factor}
              onChange={(e) => handlePerfFactorChange(Number(e.target.value))}
              placeholder="0"
            />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <input
              style={inputStyle}
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes..."
            />
          </div>
        </div>
      </div>

      {/* Quick Add Section */}
      <div style={{
        background: '#fff', border: '2px solid #3b82f6', borderRadius: 12,
        padding: 16, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e40af' }}>Quick Add</div>
          <button
            type="button"
            onClick={() => setJoinTypeLocked(!joinTypeLocked)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: joinTypeLocked ? '2px solid #3b82f6' : '1px solid #d1d5db',
              background: joinTypeLocked ? '#eff6ff' : '#fff',
              color: joinTypeLocked ? '#1e40af' : '#6b7280',
            }}
          >
            {joinTypeLocked ? <LockIcon style={{ fontSize: 14 }} /> : <LockOpenIcon style={{ fontSize: 14 }} />}
            {joinTypeLocked ? `Joint: ${getJoinLabel(selectedJoinType)}` : 'Lock Joint'}
          </button>
        </div>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, fontSize: 12, color: '#9ca3af', flexWrap: 'wrap' }}>
          <span style={{ color: step === 'fitting' ? '#1e40af' : selectedFitting ? '#10b981' : '#9ca3af', fontWeight: step === 'fitting' ? 700 : 400 }}>
            {selectedFitting ? getFittingLabel(selectedFitting) : 'Fitting'}
          </span>
          <span>{'\u203A'}</span>
          <span style={{ color: step === 'size' ? '#1e40af' : selectedSizes.length === sizeConfig.count ? '#10b981' : '#9ca3af', fontWeight: step === 'size' ? 700 : 400 }}>
            {selectedSizes.length > 0 ? selectedSizes.join(' x ') + (selectedSizes.length < sizeConfig.count ? ' x ?' : '') : 'Size'}
          </span>
          <span>{'\u203A'}</span>
          <span style={{ color: step === 'join' ? '#1e40af' : selectedJoinType ? '#10b981' : '#9ca3af', fontWeight: step === 'join' ? 700 : 400 }}>
            {selectedJoinType ? getJoinLabel(selectedJoinType) : 'Joint'}
          </span>
          <span>{'\u203A'}</span>
          <span style={{ color: step === 'qty' ? '#1e40af' : '#9ca3af', fontWeight: step === 'qty' ? 700 : 400 }}>
            Qty
          </span>
        </div>

        {/* Step 1: Fitting Type */}
        {step === 'fitting' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {FITTING_TYPES.map(ft => (
              <button
                key={ft.value}
                type="button"
                onClick={() => handleSelectFitting(ft.value)}
                style={{
                  padding: '10px 4px', border: '1px solid #d1d5db', borderRadius: 8,
                  background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  color: '#374151', textAlign: 'center', lineHeight: 1.2,
                }}
              >
                {ft.label}
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Size */}
        {step === 'size' && (
          <div>
            {sizeConfig.count > 1 && (
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Select {sizeConfig.labels[selectedSizes.length]}
                {selectedSizes.length > 0 && (
                  <span style={{ fontWeight: 400, color: '#6b7280' }}>
                    {' '}({selectedSizes.length} of {sizeConfig.count}: {selectedSizes.join(' x ')})
                  </span>
                )}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
              {PIPE_SIZES.map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleSelectSize(sz)}
                  style={{
                    padding: '10px 4px', border: '1px solid #d1d5db', borderRadius: 8,
                    background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    color: '#374151', textAlign: 'center',
                  }}
                >
                  {sz}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8 }}>
              {selectedSizes.length > 0 ? (
                <button type="button" onClick={() => setSelectedSizes(prev => prev.slice(0, -1))}
                  style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Undo last size
                </button>
              ) : (
                <button type="button" onClick={() => { setSelectedFitting(''); setStep('fitting'); }}
                  style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Back to fitting type
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Join Type */}
        {step === 'join' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
              {(selectedFitting === 'flange' ? FLANGE_TYPES : JOIN_TYPES).map(jt => (
                <button
                  key={jt.value}
                  type="button"
                  onClick={() => handleSelectJoinType(jt.value)}
                  style={{
                    padding: '10px 4px', border: '1px solid #d1d5db', borderRadius: 8,
                    background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    color: '#374151', textAlign: 'center',
                  }}
                >
                  {jt.label}
                </button>
              ))}
            </div>
            <button type="button"
              onClick={() => { setSelectedSizes(prev => prev.slice(0, -1)); setStep('size'); }}
              style={{ marginTop: 8, fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Back to size
            </button>
          </div>
        )}

        {/* Step 4: Quantity + Add */}
        {step === 'qty' && (
          <div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ width: 160 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Quantity</label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  onKeyDown={handleQtyKeyDown}
                  min={1}
                  style={{
                    width: '100%', height: 48, padding: '0 12px',
                    border: '2px solid #3b82f6', borderRadius: 8, fontSize: 24,
                    fontWeight: 700, textAlign: 'center', boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!selectedFitting || selectedSizes.length === 0}
                style={{
                  height: 48, padding: '0 24px', background: '#1a56db', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <AddIcon style={{ fontSize: 20 }} /> Add
              </button>
              <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center' }}>or press Enter</span>
            </div>
            <button type="button"
              onClick={() => {
                if (joinTypeLocked && selectedJoinType) { setSelectedSizes(prev => prev.slice(0, -1)); setStep('size'); }
                else { setSelectedJoinType(''); setStep('join'); }
              }}
              style={{ marginTop: 8, fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Back
            </button>
          </div>
        )}
      </div>

      {/* Items List */}
      {lineItems.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#6b7280', width: 50 }}>Qty</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Size</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Fitting</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Joint</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Hrs/Unit</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Base Hrs</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Adj Hrs</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280', width: 100 }}>Mat $/Unit</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Mat Cost</th>
                <th style={{ padding: '10px 8px', width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #f3f4f6', background: item.rate_not_found ? '#fef2f2' : index % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    {editingQtyIdx === index ? (
                      <input
                        type="number"
                        autoFocus
                        value={item.quantity}
                        onChange={(e) => handleQtyChange(index, Number(e.target.value))}
                        onBlur={() => setEditingQtyIdx(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingQtyIdx(null)}
                        style={{
                          width: 60, padding: '4px 6px', border: '1px solid #3b82f6',
                          borderRadius: 4, fontSize: 14, textAlign: 'center', fontWeight: 700,
                        }}
                        min="0"
                      />
                    ) : (
                      <span
                        onClick={() => setEditingQtyIdx(index)}
                        style={{ fontSize: 14, fontWeight: 700, color: '#111827', cursor: 'pointer' }}
                      >
                        {item.quantity}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 14, fontWeight: 600, color: '#1e40af' }}>{item.size}</td>
                  <td style={{ padding: '8px 12px', fontSize: 13, color: '#374151' }}>{getFittingLabel(item.fitting_type)}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {item.join_type && (
                      <span style={{ fontSize: 11, color: item.rate_not_found ? '#dc2626' : '#6b7280', background: item.rate_not_found ? '#fee2e2' : '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                        {getJoinLabel(item.join_type)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, color: item.rate_not_found ? '#dc2626' : '#6b7280' }}>
                    {item.rate_not_found ? (
                      <span title="No productivity rate found for this fitting/join type/size combination" style={{ cursor: 'help' }}>
                        No rate
                      </span>
                    ) : item.base_hours_per_unit.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#374151' }}>{item.base_hours_total.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#10b981' }}>{item.adjusted_hours.toFixed(2)}</td>
                  <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                    {editingMaterialIdx === index ? (
                      <input
                        type="number"
                        autoFocus
                        value={item.material_unit_cost || ''}
                        onChange={(e) => handleMaterialCostChange(index, Number(e.target.value))}
                        onBlur={() => setEditingMaterialIdx(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingMaterialIdx(null)}
                        style={{
                          width: 80, padding: '4px 6px', border: '1px solid #3b82f6',
                          borderRadius: 4, fontSize: 12, textAlign: 'right',
                        }}
                        step="0.01"
                      />
                    ) : (
                      <span
                        onClick={(e) => { e.stopPropagation(); setEditingMaterialIdx(index); }}
                        style={{
                          fontSize: 12, color: item.material_unit_cost ? '#374151' : '#d1d5db',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2,
                        }}
                      >
                        {item.material_unit_cost ? `$${item.material_unit_cost.toFixed(2)}` : '$-.--'}
                        <EditIcon style={{ fontSize: 12, color: '#9ca3af' }} />
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 12, color: item.material_cost > 0 ? '#374151' : '#d1d5db' }}>
                    {item.material_cost > 0 ? `$${item.material_cost.toFixed(2)}` : '-'}
                  </td>
                  <td style={{ padding: '8px 4px' }}>
                    <button onClick={() => removeItem(index)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, opacity: 0.6 }}>
                      <DeleteIcon style={{ fontSize: 16 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary Footer */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
            borderTop: '2px solid #e5e7eb', background: '#f9fafb',
          }}>
            {[
              { label: 'Total Items', value: lineItems.length.toString(), color: '#374151' },
              { label: 'Base Hours', value: totalBaseHours.toFixed(1), color: '#8b5cf6' },
              { label: 'Adjusted Hours', value: totalAdjustedHours.toFixed(1), color: '#10b981' },
              { label: 'Material Cost', value: totalMaterialCost > 0 ? `$${totalMaterialCost.toFixed(2)}` : '-', color: '#f59e0b' },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: '12px 16px', textAlign: 'center',
                borderRight: i < 3 ? '1px solid #e5e7eb' : 'none',
              }}>
                <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div ref={listEndRef} />
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '40px 20px', background: '#fff',
          borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16,
          color: '#9ca3af', fontSize: 14,
        }}>
          No items added yet. Use the quick add above to start building your takeoff.
        </div>
      )}

      {/* Save Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 24px', border: '1px solid #d1d5db', borderRadius: 8,
            background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px',
            background: saving ? '#9ca3af' : '#1a56db', color: '#fff', border: 'none',
            borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
          }}
        >
          <SaveIcon style={{ fontSize: 18 }} />
          {saving ? 'Saving...' : isEdit ? 'Update Takeoff' : 'Save Takeoff'}
        </button>
      </div>
    </div>
  );
};

export default TakeoffForm;
