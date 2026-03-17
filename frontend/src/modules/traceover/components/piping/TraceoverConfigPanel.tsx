import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTraceoverStore } from '../../stores/useTraceoverStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { PipeServiceType } from '../../types/piping';
import { resolveSpecIdForSize, specPipeMaterial, JOINT_METHOD_LABELS } from '../../types/pipingSystem';
import type { JointMethod } from '../../types/pipingSystem';
import {
  PIPE_SIZES,
  MATERIAL_LABELS,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_COLORS,
} from '../../lib/piping/referenceData';
import { projectSystemsApi } from '../../../../services/pipingServices';

const STANDARD_COLORS: { hex: string; name: string }[] = [
  { hex: '#ef4444', name: 'Red' },
  { hex: '#dc2626', name: 'Dark Red' },
  { hex: '#f97316', name: 'Orange' },
  { hex: '#eab308', name: 'Yellow' },
  { hex: '#84cc16', name: 'Lime' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#14b8a6', name: 'Teal' },
  { hex: '#06b6d4', name: 'Cyan' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#2563eb', name: 'Dark Blue' },
  { hex: '#8b5cf6', name: 'Violet' },
  { hex: '#a855f7', name: 'Purple' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#f472b6', name: 'Light Pink' },
  { hex: '#fb923c', name: 'Light Orange' },
  { hex: '#a3a3a3', name: 'Gray' },
  { hex: '#ffffff', name: 'White' },
];

const selectStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 4,
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

export default function TraceoverConfigPanel() {
  const { id: takeoffId } = useParams<{ id: string }>();
  const numericTakeoffId = takeoffId ? Number(takeoffId) : null;

  const config = useTraceoverStore((s) => s.config);
  const setConfig = useTraceoverStore((s) => s.setConfig);
  const activeTraceover = useTraceoverStore((s) => s.activeTraceover);
  const setElevation = useTraceoverStore((s) => s.setElevation);

  const projectSystems = useSettingsStore((s) => s.systems);
  const globalServices = useSettingsStore((s) => s.services);
  const pipeSpecs = useSettingsStore((s) => s.pipeSpecs);

  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  // ─── Add System inline form ───
  const [showAddSystem, setShowAddSystem] = useState(false);
  const [newSystemName, setNewSystemName] = useState('');
  const [newSystemAbbr, setNewSystemAbbr] = useState('');
  const [newSystemServiceId, setNewSystemServiceId] = useState('');
  const [newSystemColor, setNewSystemColor] = useState('#3b82f6');
  const [addingSystem, setAddingSystem] = useState(false);

  const handleAddSystem = useCallback(async () => {
    if (!numericTakeoffId || !newSystemName.trim()) return;
    setAddingSystem(true);
    try {
      const serviceId = newSystemServiceId ? Number(newSystemServiceId) : null;
      const { data: created } = await projectSystemsApi.create(numericTakeoffId, {
        name: newSystemName.trim(),
        abbreviation: newSystemAbbr.trim(),
        piping_service_id: serviceId,
        color: newSystemColor,
      } as any);
      // Add to local store
      const store = useSettingsStore.getState();
      store.setSystems([...store.systems, {
        id: String(created.id),
        name: created.name,
        abbreviation: created.abbreviation,
        serviceId: String(created.piping_service_id ?? ''),
        color: created.color,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
      }]);
      setShowAddSystem(false);
      setNewSystemName('');
      setNewSystemAbbr('');
      setNewSystemServiceId('');
      setNewSystemColor('#3b82f6');
    } catch (err) {
      console.error('Failed to create system:', err);
    } finally {
      setAddingSystem(false);
    }
  }, [numericTakeoffId, newSystemName, newSystemAbbr, newSystemServiceId, newSystemColor]);

  const handleServicePreset = useCallback((serviceId: string) => {
    setNewSystemServiceId(serviceId);
    const service = globalServices.find((s) => s.id === serviceId);
    if (service) {
      if (!newSystemName) setNewSystemName(service.name);
      if (!newSystemAbbr) setNewSystemAbbr(service.abbreviation);
      setNewSystemColor(service.color);
    }
  }, [globalServices, newSystemName, newSystemAbbr]);

  useEffect(() => {
    if (!colorOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorOpen]);

  const serviceEntries = Object.entries(SERVICE_TYPE_LABELS) as [PipeServiceType, string][];

  const selectedSystem = config.projectSystemId
    ? projectSystems.find((s) => s.id === config.projectSystemId)
    : null;

  const selectedService = selectedSystem
    ? globalServices.find((s) => s.id === selectedSystem.serviceId)
    : null;

  // The active spec — either directly selected or resolved from system
  const activeSpec = config.pipeSpecId
    ? pipeSpecs.find((s) => s.id === config.pipeSpecId) ?? null
    : null;

  // Group pipe specs by jointMethod for the dropdown
  const specsByMethod = useMemo(() => {
    const groups = new Map<JointMethod, typeof pipeSpecs>();
    for (const spec of pipeSpecs) {
      const list = groups.get(spec.jointMethod) ?? [];
      list.push(spec);
      groups.set(spec.jointMethod, list);
    }
    return groups;
  }, [pipeSpecs]);

  return (
    <div style={{ fontSize: 12 }}>
      {/* System */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>System</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <select
            value={config.projectSystemId ?? ''}
            onChange={(e) => {
              const systemId = e.target.value || null;
              const system = systemId
                ? projectSystems.find((s) => s.id === systemId)
                : null;

              if (system) {
                const service = globalServices.find((s) => s.id === system.serviceId);
                const specId = service
                  ? resolveSpecIdForSize(service, config.pipeSize.nominalInches)
                  : null;
                const spec = specId ? pipeSpecs.find((s) => s.id === specId) : null;

                setConfig({
                  projectSystemId: systemId,
                  pipingServiceId: null,
                  jointSpecFamilyId: null,
                  pipeSpecId: specId,
                  color: system.color,
                  serviceType: service?.serviceCategory ?? config.serviceType,
                  label: system.abbreviation || config.label,
                  ...(spec ? { material: specPipeMaterial(spec) } : {}),
                });
              } else {
                setConfig({ projectSystemId: null, pipeSpecId: null });
              }
            }}
            style={{ ...selectStyle, flex: 1 }}
          >
            <option value="">None (manual)</option>
            {projectSystems.map((sys) => {
              const svc = globalServices.find((s) => s.id === sys.serviceId);
              return (
                <option key={sys.id} value={sys.id}>
                  {sys.abbreviation ? `${sys.abbreviation} — ${sys.name}` : sys.name}
                  {svc ? '' : ' (unlinked)'}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            title="Add system"
            onClick={() => setShowAddSystem(!showAddSystem)}
            style={{
              width: 28,
              height: 28,
              flexShrink: 0,
              borderRadius: 4,
              border: '1px solid #1f3450',
              backgroundColor: showAddSystem ? '#1f3450' : '#131f33',
              color: '#7a9ab5',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
        </div>
        {selectedSystem && !selectedService && (
          <div style={{ marginTop: 4, padding: '6px 8px', borderRadius: 4, backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
            <p style={{ fontSize: 10, color: '#eab308', margin: '0 0 4px 0' }}>
              Service not linked — spec resolution disabled
            </p>
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value || !selectedSystem) return;
                const service = globalServices.find((s) => s.id === e.target.value);
                useSettingsStore.getState().updateSystem(selectedSystem.id, { serviceId: e.target.value });
                if (service) {
                  const specId = resolveSpecIdForSize(service, config.pipeSize.nominalInches);
                  const spec = specId ? pipeSpecs.find((s) => s.id === specId) : null;
                  setConfig({
                    pipeSpecId: specId,
                    color: service.color,
                    serviceType: service.serviceCategory as any,
                    ...(spec ? { material: specPipeMaterial(spec) } : {}),
                  });
                }
              }}
              style={{ ...selectStyle, fontSize: 10, padding: '3px 6px' }}
            >
              <option value="">Link a service...</option>
              {globalServices.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.abbreviation ? `${svc.abbreviation} — ${svc.name}` : svc.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {selectedService && (
          <p style={{ marginTop: 4, fontSize: 10, color: '#7a9ab5' }}>
            Service: {selectedService.name}
          </p>
        )}

        {/* Inline Add System Form */}
        {showAddSystem && (
          <div
            style={{
              marginTop: 8,
              padding: 8,
              borderRadius: 6,
              border: '1px solid #1f3450',
              backgroundColor: '#0d1825',
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 600, color: '#7a9ab5', marginBottom: 8 }}>
              New System
            </p>

            {globalServices.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Piping Service</label>
                <select
                  value={newSystemServiceId}
                  onChange={(e) => handleServicePreset(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">None</option>
                  {globalServices.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.abbreviation ? `${svc.abbreviation} — ${svc.name}` : svc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 2 }}>Name</label>
              <input
                type="text"
                value={newSystemName}
                onChange={(e) => setNewSystemName(e.target.value)}
                placeholder="e.g. Heating Water Supply"
                style={selectStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Abbr</label>
                <input
                  type="text"
                  value={newSystemAbbr}
                  onChange={(e) => setNewSystemAbbr(e.target.value)}
                  placeholder="HWS"
                  style={selectStyle}
                />
              </div>
              <div style={{ width: 48 }}>
                <label style={{ ...labelStyle, marginBottom: 2 }}>Color</label>
                <input
                  type="color"
                  value={newSystemColor}
                  onChange={(e) => setNewSystemColor(e.target.value)}
                  style={{
                    width: '100%',
                    height: 28,
                    border: '1px solid #1f3450',
                    borderRadius: 4,
                    backgroundColor: '#131f33',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={handleAddSystem}
                disabled={addingSystem || !newSystemName.trim()}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 4,
                  border: 'none',
                  backgroundColor: !newSystemName.trim() ? '#1f3450' : '#3b82f6',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: !newSystemName.trim() ? 'not-allowed' : 'pointer',
                  opacity: addingSystem ? 0.6 : 1,
                }}
              >
                {addingSystem ? 'Adding...' : 'Add System'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddSystem(false)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 4,
                  border: '1px solid #1f3450',
                  backgroundColor: 'transparent',
                  color: '#7a9ab5',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Specification (rate table) — grouped by joint method category */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Specification
          {selectedSystem && activeSpec && (
            <span style={{ marginLeft: 4, textTransform: 'none', letterSpacing: 'normal', color: '#3b82f6' }}>
              (from system)
            </span>
          )}
        </label>
        <select
          value={config.pipeSpecId ?? ''}
          onChange={(e) => {
            const specId = e.target.value || null;
            const spec = specId ? pipeSpecs.find((s) => s.id === specId) : null;
            if (spec) {
              setConfig({ pipeSpecId: specId, material: specPipeMaterial(spec) });
            } else {
              setConfig({ pipeSpecId: null });
            }
          }}
          style={selectStyle}
        >
          <option value="">None (no rates)</option>
          {[...specsByMethod.entries()].map(([method, specs]) => (
            <optgroup key={method} label={JOINT_METHOD_LABELS[method]}>
              {specs.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {activeSpec && (
          <p style={{ marginTop: 4, fontSize: 10, color: '#7a9ab5' }}>
            {MATERIAL_LABELS[specPipeMaterial(activeSpec)]} — {JOINT_METHOD_LABELS[activeSpec.jointMethod]}
          </p>
        )}
        {pipeSpecs.length === 0 && (
          <p style={{ marginTop: 4, fontSize: 10, color: '#4a6a88' }}>
            No specs defined. Add them in Settings.
          </p>
        )}
      </div>

      {/* Pipe Size */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Pipe Size</label>
        <select
          value={config.pipeSize.nominal}
          onChange={(e) => {
            const size = PIPE_SIZES.find((s) => s.nominal === e.target.value);
            if (!size) return;
            const updates: Record<string, unknown> = { pipeSize: size };
            if (selectedService) {
              const specId = resolveSpecIdForSize(selectedService, size.nominalInches);
              const spec = specId ? pipeSpecs.find((s) => s.id === specId) : null;
              if (spec) {
                updates.pipeSpecId = specId;
                updates.material = specPipeMaterial(spec);
              }
            }
            setConfig(updates as Parameters<typeof setConfig>[0]);
          }}
          style={selectStyle}
        >
          {PIPE_SIZES.map((size) => (
            <option key={size.nominal} value={size.nominal}>{size.displayLabel}</option>
          ))}
        </select>
      </div>

      {/* Service Type (manual mode only) */}
      {!selectedSystem && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Service Type</label>
          <select
            value={config.serviceType}
            onChange={(e) => {
              const serviceType = e.target.value as PipeServiceType;
              setConfig({
                serviceType,
                color: SERVICE_TYPE_COLORS[serviceType],
              });
            }}
            style={selectStyle}
          >
            {serviceEntries.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Color */}
      <div ref={colorRef} style={{ marginBottom: 12, position: 'relative' }}>
        <label style={labelStyle}>Color</label>
        <button
          type="button"
          onClick={() => setColorOpen(!colorOpen)}
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: 8,
            borderRadius: 4,
            border: '1px solid #1f3450',
            backgroundColor: '#131f33',
            padding: '6px 8px',
            textAlign: 'left',
            fontSize: 12,
            color: '#d4e3f3',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.2)',
              backgroundColor: config.color,
              flexShrink: 0,
            }}
          />
          {STANDARD_COLORS.find((c) => c.hex === config.color)?.name ?? 'Custom'}
        </button>

        {colorOpen && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: '100%',
              zIndex: 50,
              marginTop: 4,
              width: '100%',
              borderRadius: 8,
              border: '1px solid #1f3450',
              backgroundColor: '#131f33',
              padding: 8,
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {STANDARD_COLORS.map(({ hex, name }) => (
                <button
                  key={hex}
                  type="button"
                  title={name}
                  onClick={() => {
                    setConfig({ color: hex });
                    setColorOpen(false);
                  }}
                  style={{
                    height: 24,
                    width: '100%',
                    borderRadius: 2,
                    border: config.color === hex ? '2px solid white' : '2px solid transparent',
                    backgroundColor: hex,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Run Label</label>
        <input
          type="text"
          value={config.label}
          onChange={(e) => setConfig({ label: e.target.value })}
          placeholder="e.g. HWS-1"
          style={{
            ...selectStyle,
            color: '#d4e3f3',
          }}
        />
      </div>

      {/* Elevation */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          {activeTraceover ? 'Current Elevation' : 'Starting Elevation'}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            step="0.5"
            value={
              activeTraceover
                ? activeTraceover.currentElevation
                : config.startingElevation
            }
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (isNaN(val)) return;
              if (activeTraceover) {
                setElevation(val);
              } else {
                setConfig({ startingElevation: val });
              }
            }}
            onFocus={(e) => e.target.select()}
            style={{ ...selectStyle, flex: 1 }}
          />
          <span style={{ flexShrink: 0, fontSize: 10, color: '#4a6a88' }}>ft</span>
        </div>
        <p style={{ marginTop: 4, fontSize: 10, color: '#4a6a88' }}>
          {activeTraceover
            ? 'Change height to auto-add vertical pipe + elbows'
            : 'Set the elevation before tracing to start at this height'}
        </p>
      </div>

      {/* Instructions */}
      <div
        style={{
          borderRadius: 4,
          border: '1px solid rgba(31, 52, 80, 0.5)',
          backgroundColor: '#0d1825',
          padding: 8,
          fontSize: 10,
          lineHeight: 1.6,
          color: '#4a6a88',
        }}
      >
        <p style={{ marginBottom: 4, fontWeight: 600, color: '#7a9ab5' }}>How to trace:</p>
        <p>Click points to trace pipe run. Angles snap to 45/90 degrees. Double-click to complete.</p>
        <p style={{ marginTop: 4 }}>Esc = cancel, Ctrl+Z = undo last point</p>
        <p style={{ marginTop: 4 }}>Set elevation to auto-add vertical offsets with fittings</p>
      </div>
    </div>
  );
}
