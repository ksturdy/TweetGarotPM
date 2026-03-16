import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, Upload } from 'lucide-react';
import { useUiStore } from '../../stores/useUiStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import RateTableList from './RateTableList';
import RateTableEditor from './RateTableEditor';
import PipeSpecList from './PipeSpecList';
import PipeSpecEditor from './PipeSpecEditor';
import ServiceList from './ServiceList';
import ServiceEditor from './ServiceEditor';
import ProjectSystemList from './ProjectSystemList';
import ProjectSystemEditor from './ProjectSystemEditor';

type MainTab = 'rateTables' | 'specs' | 'services' | 'systems';

export default function TraceoverSettings() {
  const showSettings = useUiStore((s) => s.showSettings);
  const setShowSettings = useUiStore((s) => s.setShowSettings);

  const [mainTab, setMainTab] = useState<MainTab>('rateTables');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  // Rate Tables
  const rateTables = useSettingsStore((s) => s.rateTables);
  const addRateTable = useSettingsStore((s) => s.addRateTable);
  const updateRateTable = useSettingsStore((s) => s.updateRateTable);
  const removeRateTable = useSettingsStore((s) => s.removeRateTable);
  const duplicateRateTable = useSettingsStore((s) => s.duplicateRateTable);
  const updateRateTableColumn = useSettingsStore((s) => s.updateRateTableColumn);
  const addRateTableColumns = useSettingsStore((s) => s.addRateTableColumns);
  const removeRateTableColumn = useSettingsStore((s) => s.removeRateTableColumn);

  // Pipe Specs
  const pipeSpecs = useSettingsStore((s) => s.pipeSpecs);
  const addPipeSpec = useSettingsStore((s) => s.addPipeSpec);
  const updatePipeSpec = useSettingsStore((s) => s.updatePipeSpec);
  const removePipeSpec = useSettingsStore((s) => s.removePipeSpec);
  const duplicatePipeSpec = useSettingsStore((s) => s.duplicatePipeSpec);

  // Services
  const services = useSettingsStore((s) => s.services);
  const addService = useSettingsStore((s) => s.addService);
  const updateService = useSettingsStore((s) => s.updateService);
  const removeService = useSettingsStore((s) => s.removeService);
  const addSizeRule = useSettingsStore((s) => s.addSizeRule);
  const removeSizeRule = useSettingsStore((s) => s.removeSizeRule);
  const updateSizeRule = useSettingsStore((s) => s.updateSizeRule);
  const exportServicesJson = useSettingsStore((s) => s.exportServicesJson);
  const importServicesJson = useSettingsStore((s) => s.importServicesJson);

  // Systems
  const projectSystems = useSettingsStore((s) => s.systems);
  const addProjectSystem = useSettingsStore((s) => s.addSystem);
  const updateProjectSystem = useSettingsStore((s) => s.updateSystem);
  const removeProjectSystem = useSettingsStore((s) => s.removeSystem);

  // Auto-select first item if none selected
  const activeTableId =
    selectedTableId && rateTables.find((t) => t.id === selectedTableId)
      ? selectedTableId
      : rateTables[0]?.id ?? null;

  const activeSpecId =
    selectedSpecId && pipeSpecs.find((s) => s.id === selectedSpecId)
      ? selectedSpecId
      : pipeSpecs[0]?.id ?? null;

  const activeServiceId =
    selectedServiceId && services.find((s) => s.id === selectedServiceId)
      ? selectedServiceId
      : services[0]?.id ?? null;

  const activeSystemId =
    selectedSystemId && projectSystems.find((s) => s.id === selectedSystemId)
      ? selectedSystemId
      : projectSystems[0]?.id ?? null;

  const activeTable = activeTableId
    ? rateTables.find((t) => t.id === activeTableId)
    : null;
  const activeSpec = activeSpecId
    ? pipeSpecs.find((s) => s.id === activeSpecId)
    : null;
  const activeService = activeServiceId
    ? services.find((s) => s.id === activeServiceId)
    : null;
  const activeSystem = activeSystemId
    ? projectSystems.find((s) => s.id === activeSystemId)
    : null;

  // Close on Escape
  useEffect(() => {
    if (!showSettings) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettings(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showSettings, setShowSettings]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) setShowSettings(false);
    },
    [setShowSettings],
  );

  // ── Handlers ──

  const handleAddTable = () => {
    const newId = addRateTable({
      name: 'New Rate Table',
      category: 'other',
      notes: '',
      columns: [],
    });
    setSelectedTableId(newId);
  };

  const handleDuplicateTable = (id: string) => {
    const newId = duplicateRateTable(id);
    if (newId) setSelectedTableId(newId);
  };

  const handleRemoveTable = (id: string) => {
    removeRateTable(id);
    if (selectedTableId === id) setSelectedTableId(null);
  };

  const handleAddSpec = () => {
    const newId = addPipeSpec({
      name: 'New Pipe Spec',
      jointMethod: 'BW',
      material: 'carbon_steel',
      schedule: 'STD',
      stockPipeLength: 21,
      jointType: 'welded',
      pipeMaterial: 'carbon_steel',
      pipeRates: {},
      fittingRates: {},
      reducingFittingRates: {},
      reducingTeeRates: {},
      crossReducingRates: {},
      isDefault: false,
    });
    setSelectedSpecId(newId);
  };

  const handleDuplicateSpec = (id: string) => {
    const newId = duplicatePipeSpec(id);
    if (newId) setSelectedSpecId(newId);
  };

  const handleRemoveSpec = (id: string) => {
    removePipeSpec(id);
    if (selectedSpecId === id) setSelectedSpecId(null);
  };

  const handleAddService = () => {
    const defaultSpecId = pipeSpecs[0]?.id ?? '';
    const newId = addService({
      name: 'New Service',
      abbreviation: '',
      color: '#3b82f6',
      serviceCategory: 'other',
      sizeRules: [],
      defaultPipeSpecId: defaultSpecId,
      fittingTypes: [],
      valveTypes: [],
      accessories: [],
    });
    setSelectedServiceId(newId);
  };

  const handleRemoveService = (id: string) => {
    removeService(id);
    if (selectedServiceId === id) setSelectedServiceId(null);
  };

  const handleAddSystem = (preset?: {
    name: string;
    abbreviation: string;
    color: string;
  }) => {
    const newId = addProjectSystem({
      name: preset?.name ?? 'New System',
      abbreviation: preset?.abbreviation ?? '',
      serviceId: services[0]?.id ?? '',
      color: preset?.color ?? '#3b82f6',
    });
    setSelectedSystemId(newId);
  };

  const handleRemoveSystem = (id: string) => {
    removeProjectSystem(id);
    if (selectedSystemId === id) setSelectedSystemId(null);
  };

  const handleExport = () => {
    const json = exportServicesJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'titan-services.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importServicesJson(reader.result as string);
      if (result.errors.length > 0) {
        setImportMessage(
          `Imported ${result.imported}. Warnings: ${result.errors.join('; ')}`,
        );
      } else {
        setImportMessage(`Imported ${result.imported} service(s)`);
      }
      setTimeout(() => setImportMessage(''), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!showSettings) return null;

  const tabs: { key: MainTab; label: string }[] = [
    { key: 'rateTables', label: 'Rate Tables' },
    { key: 'specs', label: 'Specifications' },
    { key: 'services', label: 'Services' },
    { key: 'systems', label: 'Systems' },
  ];

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
      }}
    >
      <div
        style={{
          width: '92vw',
          maxWidth: 1200,
          height: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f1b2d',
          borderRadius: 12,
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: '1px solid #1f3450',
            backgroundColor: '#0d1825',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#d4e3f3' }}>
            Settings
          </h2>
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              backgroundColor: 'transparent',
              color: '#7a9ab5',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #1f3450',
            backgroundColor: '#0d1825',
            padding: '0 16px',
            flexShrink: 0,
          }}
        >
          {tabs.map((tab) => {
            const isActive = mainTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMainTab(tab.key)}
                style={{
                  padding: '10px 20px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: isActive ? '#d4e3f3' : '#4a6a88',
                  background: 'none',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}

          {/* Import/Export — only on Services tab */}
          {mainTab === 'services' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {importMessage && (
                <span style={{ marginRight: 8, fontSize: 10, color: '#4ade80' }}>
                  {importMessage}
                </span>
              )}
              <button
                onClick={handleExport}
                disabled={services.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 4,
                  border: '1px solid #1f3450',
                  backgroundColor: '#131f33',
                  padding: '6px 10px',
                  fontSize: 10,
                  color: '#7a9ab5',
                  cursor: 'pointer',
                  opacity: services.length === 0 ? 0.4 : 1,
                }}
                title="Export services as JSON"
              >
                <Download size={12} />
                Export
              </button>
              <button
                onClick={() => importRef.current?.click()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  borderRadius: 4,
                  border: '1px solid #1f3450',
                  backgroundColor: '#131f33',
                  padding: '6px 10px',
                  fontSize: 10,
                  color: '#7a9ab5',
                  cursor: 'pointer',
                }}
                title="Import services from JSON"
              >
                <Upload size={12} />
                Import
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
            </div>
          )}
        </div>

        {/* Content area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* ── Rate Tables tab ── */}
          {mainTab === 'rateTables' && (
            <>
              <div style={{ width: 256, flexShrink: 0, borderRight: '1px solid #1f3450', backgroundColor: '#0d1825' }}>
                <RateTableList
                  tables={rateTables}
                  selectedId={activeTableId}
                  onSelect={setSelectedTableId}
                  onAdd={handleAddTable}
                  onDuplicate={handleDuplicateTable}
                  onRemove={handleRemoveTable}
                />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTable ? (
                  <RateTableEditor
                    key={activeTable.id}
                    table={activeTable}
                    onUpdate={(updates) => updateRateTable(activeTable.id, updates)}
                    onUpdateColumn={(colId, updates) =>
                      updateRateTableColumn(activeTable.id, colId, updates)
                    }
                    onAddColumns={(cols) => addRateTableColumns(activeTable.id, cols)}
                    onRemoveColumn={(colId) =>
                      removeRateTableColumn(activeTable.id, colId)
                    }
                  />
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#4a6a88' }}>
                    Select or add a rate table to edit
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Pipe Specs tab ── */}
          {mainTab === 'specs' && (
            <>
              <div style={{ width: 256, flexShrink: 0, borderRight: '1px solid #1f3450', backgroundColor: '#0d1825' }}>
                <PipeSpecList
                  specs={pipeSpecs}
                  selectedId={activeSpecId}
                  onSelect={setSelectedSpecId}
                  onAdd={handleAddSpec}
                  onDuplicate={handleDuplicateSpec}
                  onRemove={handleRemoveSpec}
                />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeSpec ? (
                  <PipeSpecEditor
                    key={activeSpec.id}
                    spec={activeSpec}
                    onUpdate={(updates) => updatePipeSpec(activeSpec.id, updates)}
                  />
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#4a6a88' }}>
                    Select or add a pipe spec to edit
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Services tab ── */}
          {mainTab === 'services' && (
            <>
              <div style={{ width: 256, flexShrink: 0, borderRight: '1px solid #1f3450', backgroundColor: '#0d1825' }}>
                <ServiceList
                  services={services}
                  selectedId={activeServiceId}
                  onSelect={setSelectedServiceId}
                  onAdd={handleAddService}
                  onRemove={handleRemoveService}
                />
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {activeService ? (
                  <ServiceEditor
                    key={activeService.id}
                    service={activeService}
                    onUpdate={(updates) =>
                      updateService(activeService.id, updates)
                    }
                    onAddSizeRule={(maxSize, specId) =>
                      addSizeRule(activeService.id, maxSize, specId)
                    }
                    onRemoveSizeRule={(ruleId) =>
                      removeSizeRule(activeService.id, ruleId)
                    }
                    onUpdateSizeRule={(ruleId, updates) =>
                      updateSizeRule(activeService.id, ruleId, updates)
                    }
                  />
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#4a6a88' }}>
                    Select or add a service to edit
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Project Systems tab ── */}
          {mainTab === 'systems' && (
            <>
              <div style={{ width: 256, flexShrink: 0, borderRight: '1px solid #1f3450', backgroundColor: '#0d1825' }}>
                <ProjectSystemList
                  systems={projectSystems}
                  selectedId={activeSystemId}
                  onSelect={setSelectedSystemId}
                  onAdd={handleAddSystem}
                  onRemove={handleRemoveSystem}
                />
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                {activeSystem ? (
                  <ProjectSystemEditor
                    key={activeSystem.id}
                    system={activeSystem}
                    services={services}
                    pipeSpecs={pipeSpecs}
                    onUpdate={(updates) =>
                      updateProjectSystem(activeSystem.id, updates)
                    }
                  />
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#4a6a88' }}>
                    {projectSystems.length === 0
                      ? 'Add a project system to get started'
                      : 'Select a project system to edit'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
