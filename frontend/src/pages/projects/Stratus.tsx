import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import stratusService, {
  MaterialType,
  PipeLengthRow,
  StratusFilterOptions,
  StratusImport,
  StratusPart,
  StratusPartFilters,
  StratusSummaryRow,
} from '../../services/stratus';
import { projectsApi } from '../../services/projects';
import { useTitanFeedback } from '../../context/TitanFeedbackContext';

type Metric = 'hours' | 'count' | 'weight' | 'length' | 'cost';

const METRIC_LABEL: Record<Metric, string> = {
  hours: 'Install Hours',
  count: 'Part Count',
  weight: 'Weight (lb)',
  length: 'Length (ft)',
  cost: 'Total Cost',
};

const STATUS_ORDER = [
  'Design',
  'Coordinated And Signed-Off',
  'On Hold Packages',
  'Shipped',
  'Field Installed',
];

const STATUS_COLORS: Record<string, string> = {
  'Design': '#94a3b8',
  'Coordinated And Signed-Off': '#3b82f6',
  'On Hold Packages': '#ef4444',
  'Shipped': '#f59e0b',
  'Field Installed': '#10b981',
};

const MATERIAL_LABELS: Record<MaterialType, string> = {
  pipe: 'Pipe',
  pipe_fitting: 'Pipe Fitting',
  weld: 'Weld',
  valve: 'Valve',
  coupling: 'Coupling',
  hanger: 'Hanger',
  equipment: 'Equipment',
  duct: 'Duct',
  duct_accessory: 'Duct Accessory',
  other: 'Other',
};

const fmt = (n: number, decimals = 1): string => {
  if (!Number.isFinite(n) || n === 0) return '-';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
};

const fmtMoney = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return '-';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const fmtPct = (n: number): string => `${(n * 100).toFixed(1)}%`;

const fmtDate = (s: string | null): string => {
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const statusKey = (s: string | null): string => s || '(blank)';

const Stratus: React.FC = () => {
  const { projectId: projectIdParam } = useParams<{ projectId: string }>();
  const projectId = Number(projectIdParam);
  const queryClient = useQueryClient();
  const { confirm, toast } = useTitanFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [metric, setMetric] = useState<Metric>('hours');
  const [filters, setFilters] = useState<StratusPartFilters>({});
  const [page, setPage] = useState(0);
  const pageSize = 100;

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.getById(projectId).then((r) => r.data),
    enabled: !!projectId,
  });

  const { data: latest, isLoading: loadingLatest } = useQuery({
    queryKey: ['stratus-latest', projectId],
    queryFn: () => stratusService.getLatestImport(projectId),
    enabled: !!projectId,
  });

  const { data: summary } = useQuery({
    queryKey: ['stratus-summary', projectId, latest?.id],
    queryFn: () => stratusService.getSummary(projectId, latest?.id),
    enabled: !!projectId && !!latest?.id,
  });

  const { data: filterOpts } = useQuery({
    queryKey: ['stratus-filter-opts', projectId, latest?.id],
    queryFn: () => stratusService.getFilterOptions(projectId, latest?.id),
    enabled: !!projectId && !!latest?.id,
  });

  const { data: pipeSummary } = useQuery({
    queryKey: ['stratus-pipe-length', projectId, latest?.id],
    queryFn: () => stratusService.getPipeLengthSummary(projectId, { importId: latest?.id }),
    enabled: !!projectId && !!latest?.id,
  });

  const { data: partsResult } = useQuery({
    queryKey: ['stratus-parts', projectId, latest?.id, filters, page],
    queryFn: () =>
      stratusService.listParts(projectId, {
        importId: latest?.id,
        limit: pageSize,
        offset: page * pageSize,
        filters,
      }),
    enabled: !!projectId && !!latest?.id,
  });

  const { data: imports } = useQuery({
    queryKey: ['stratus-imports', projectId],
    queryFn: () => stratusService.listImports(projectId),
    enabled: !!projectId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => stratusService.uploadImport(projectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stratus-latest', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-parts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-imports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-filter-opts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-pipe-length', projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (importId: number) => stratusService.deleteImport(importId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stratus-latest', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-parts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-imports', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-filter-opts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['stratus-pipe-length', projectId] });
    },
  });

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadMutation.mutateAsync(file);
      const sourceName = result.sourceProjectName || '(unknown)';
      const projectName = project?.name || '(this project)';
      const looksMatched =
        sourceName.toLowerCase().includes((project?.number || '').toLowerCase()) ||
        sourceName.toLowerCase().includes((project?.name || '').toLowerCase());
      if (!looksMatched) {
        toast.warning(
          `Imported ${result.rowCount.toLocaleString()} parts from "${sourceName}" — source project name does not obviously match "${projectName}". Verify before relying on this data.`
        );
      } else {
        toast.success(`Imported ${result.rowCount.toLocaleString()} parts from Stratus.`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Stratus import failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImport = async (imp: StratusImport) => {
    const ok = await confirm({
      title: 'Delete Stratus import?',
      message: `Delete the import "${imp.filename || imp.id}" with ${imp.row_count.toLocaleString()} parts? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (ok) deleteMutation.mutate(imp.id);
  };

  const pivot = useMemo(() => buildPivot(summary?.rows || [], metric), [summary, metric]);

  const setMulti = (key: keyof StratusPartFilters, values: string[]) => {
    setFilters((f) => ({ ...f, [key]: values.length ? values : undefined }));
    setPage(0);
  };

  const toggleFilterValue = (key: keyof StratusPartFilters, value: string) => {
    const cur = (filters[key] as string[] | undefined) || [];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    setMulti(key, next);
  };

  const opt = (arr?: string[]) => (arr || []).filter(Boolean);

  return (
    <div style={{ padding: '24px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Link to={`/projects/${projectId}`} style={{ color: '#6b7280', textDecoration: 'none' }}>
          ← Back to Project
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Stratus</h1>
          <p style={{ color: '#6b7280', margin: '4px 0 0' }}>
            Model content and part-level statuses for {project?.name || `project ${projectId}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            style={{ display: 'none' }}
          />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={btnPrimary}>
            {uploading ? 'Uploading…' : 'Upload Stratus Export'}
          </button>
        </div>
      </div>

      {loadingLatest ? (
        <div style={cardStyle}>Loading…</div>
      ) : !latest ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Stratus data yet</div>
          <div style={{ color: '#6b7280', marginBottom: 16 }}>
            Upload a Stratus Tracking export (.xlsx) to populate this module. Parts data will be loaded
            from the "Parts" sheet of the workbook.
          </div>
          <button onClick={() => fileInputRef.current?.click()} style={btnPrimary}>Upload Stratus Export</button>
        </div>
      ) : (
        <>
          <div style={{ ...cardStyle, marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Latest Import</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{latest.filename || '(no filename)'}</div>
              <div style={{ color: '#6b7280', fontSize: 13 }}>
                {latest.row_count.toLocaleString()} parts • imported {fmtDate(latest.imported_at)}
                {latest.imported_by_name ? ` by ${latest.imported_by_name}` : ''}
              </div>
              {latest.source_project_name && (
                <div style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                  Source: <em>{latest.source_project_name}</em>
                </div>
              )}
            </div>
            <details style={{ minWidth: 280 }}>
              <summary style={{ cursor: 'pointer', color: '#3b82f6' }}>Import history ({imports?.length || 0})</summary>
              <div style={{ marginTop: 8, fontSize: 13, maxHeight: 200, overflowY: 'auto' }}>
                {(imports || []).map((imp) => (
                  <div key={imp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span>
                      {fmtDate(imp.imported_at)} • {imp.row_count.toLocaleString()} parts
                      {imp.id === latest.id && <span style={{ marginLeft: 6, color: '#10b981', fontWeight: 600 }}>(current)</span>}
                    </span>
                    <button onClick={() => handleDeleteImport(imp)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </details>
          </div>

          {/* Pipe LF summary */}
          <PipeLengthCard rows={pipeSummary?.rows || []} />

          {/* Pivot */}
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Status by Phase Code</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['hours', 'count', 'weight', 'length', 'cost'] as Metric[]).map((m) => (
                  <button key={m} onClick={() => setMetric(m)} style={metric === m ? btnToggleActive : btnToggle}>
                    {METRIC_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Phase Code</th>
                    {pivot.statuses.map((s) => (
                      <th key={s} style={{ ...thStyle, textAlign: 'right', borderBottom: `3px solid ${STATUS_COLORS[s] || '#cbd5e1'}` }}>
                        {s}
                      </th>
                    ))}
                    <th style={{ ...thStyle, textAlign: 'right', fontWeight: 700 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pivot.phaseCodes.map((pc) => {
                    const isSelected = (filters.phase_code || []).includes(pc);
                    return (
                      <tr
                        key={pc}
                        style={{ cursor: 'pointer', background: isSelected ? '#eff6ff' : undefined }}
                        onClick={() => pc !== '(blank)' && toggleFilterValue('phase_code', pc)}
                      >
                        <td style={tdStyle}>{pc}{isSelected && <span style={{ marginLeft: 6, color: '#3b82f6' }}>✓</span>}</td>
                        {pivot.statuses.map((s) => {
                          const v = pivot.cells[pc]?.[s] || 0;
                          return (
                            <td key={s} style={{ ...tdStyle, textAlign: 'right' }}>
                              {metric === 'cost' ? fmtMoney(v) : fmt(v, metric === 'count' ? 0 : 1)}
                            </td>
                          );
                        })}
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                          {metric === 'cost' ? fmtMoney(pivot.rowTotals[pc] || 0) : fmt(pivot.rowTotals[pc] || 0, metric === 'count' ? 0 : 1)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                    <td style={tdStyle}>Total</td>
                    {pivot.statuses.map((s) => (
                      <td key={s} style={{ ...tdStyle, textAlign: 'right' }}>
                        {metric === 'cost' ? fmtMoney(pivot.colTotals[s] || 0) : fmt(pivot.colTotals[s] || 0, metric === 'count' ? 0 : 1)}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {metric === 'cost' ? fmtMoney(pivot.grandTotal) : fmt(pivot.grandTotal, metric === 'count' ? 0 : 1)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Tip: click phase-code rows to add/remove them from the parts filter below.</div>
          </div>

          {/* Filters + Parts table */}
          <div style={{ ...cardStyle, marginTop: 16 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>
              Parts {partsResult ? `(${partsResult.total.toLocaleString()})` : ''}
            </h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <MultiSelect label="Material Type" values={filters.material_type || []} options={opt(filterOpts?.material_types)}
                renderOption={(v) => MATERIAL_LABELS[v as MaterialType] || v}
                onChange={(v) => setMulti('material_type', v)} />
              <MultiSelect label="Status" values={filters.status || []} options={opt(filterOpts?.statuses)}
                onChange={(v) => setMulti('status', v)} />
              <MultiSelect label="Phase Code" values={filters.phase_code || []} options={opt(filterOpts?.phase_codes)}
                onChange={(v) => setMulti('phase_code', v)} />
              <MultiSelect label="Service Type" values={filters.service_type || []} options={opt(filterOpts?.service_types)}
                onChange={(v) => setMulti('service_type', v)} />
              <MultiSelect label="Service" values={filters.service || []} options={opt(filterOpts?.services)}
                onChange={(v) => setMulti('service', v)} />
              <MultiSelect label="Area" values={filters.area || []} options={opt(filterOpts?.areas)}
                onChange={(v) => setMulti('area', v)} />
              <MultiSelect label="Size" values={filters.size || []} options={opt(filterOpts?.sizes)}
                onChange={(v) => setMulti('size', v)} />
              <MultiSelect label="Division" values={filters.division || []} options={opt(filterOpts?.divisions)}
                onChange={(v) => setMulti('division', v)} />
              <MultiSelect label="Package" values={filters.package_category || []} options={opt(filterOpts?.package_categories)}
                onChange={(v) => setMulti('package_category', v)} />
              <input
                type="text"
                placeholder="Search description / CAD ID…"
                value={filters.search || ''}
                onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value || undefined })); setPage(0); }}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, minWidth: 220 }}
              />
              {hasAnyFilter(filters) && (
                <button onClick={() => { setFilters({}); setPage(0); }} style={{ ...btnToggle, color: '#ef4444' }}>
                  Clear all filters
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Phase Code</th>
                    <th style={thStyle}>Material</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Service</th>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Size</th>
                    <th style={thStyle}>Area</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Length</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Weight</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                    <th style={thStyle}>Shipped</th>
                    <th style={thStyle}>Installed</th>
                  </tr>
                </thead>
                <tbody>
                  {(partsResult?.rows || []).map((p: StratusPart) => (
                    <tr key={p.id}>
                      <td style={tdStyle}>{p.part_field_phase_code || '-'}</td>
                      <td style={tdStyle}>
                        <span style={{
                          background: '#f3f4f6', color: '#374151', padding: '2px 8px',
                          borderRadius: 4, fontSize: 11, whiteSpace: 'nowrap',
                          fontWeight: p.material_type === 'pipe' ? 700 : 400,
                        }}>
                          {p.material_type ? (MATERIAL_LABELS[p.material_type] || p.material_type) : '—'}
                          {p.material_type_override && <span title="Manual override" style={{ marginLeft: 4 }}>*</span>}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          background: STATUS_COLORS[p.part_tracking_status || ''] || '#9ca3af',
                          color: 'white', padding: '2px 8px', borderRadius: 12, fontSize: 12, whiteSpace: 'nowrap',
                        }}>
                          {p.part_tracking_status || '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>{p.service_abbreviation || p.service_name || '-'}</td>
                      <td style={tdStyle} title={p.item_description || ''}>
                        {(p.item_description || '').slice(0, 60)}{(p.item_description || '').length > 60 ? '…' : ''}
                      </td>
                      <td style={tdStyle}>{p.size || '-'}</td>
                      <td style={tdStyle}>{p.area || '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(num(p.length), 2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(num(p.item_weight), 1)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(num(p.install_hours), 2)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoney(num(p.total_cost))}</td>
                      <td style={tdStyle}>{fmtDate(p.part_shipped_dt)}</td>
                      <td style={tdStyle}>{fmtDate(p.part_field_installed_dt)}</td>
                    </tr>
                  ))}
                  {partsResult && partsResult.rows.length === 0 && (
                    <tr><td colSpan={13} style={{ ...tdStyle, textAlign: 'center', padding: 24, color: '#6b7280' }}>No parts match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {partsResult && partsResult.total > pageSize && (
              <Pagination total={partsResult.total} page={page} pageSize={pageSize} onPage={setPage} />
            )}
          </div>
        </>
      )}
    </div>
  );
};

const hasAnyFilter = (f: StratusPartFilters): boolean => {
  if (f.search) return true;
  return (Object.keys(f) as Array<keyof StratusPartFilters>).some((k) => k !== 'search' && Array.isArray(f[k]) && (f[k] as string[]).length > 0);
};

// ── Pipe LF Summary ──
const PipeLengthCard: React.FC<{ rows: PipeLengthRow[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Pipe Length — Earned Value</h2>
        <div style={{ color: '#6b7280', fontSize: 13 }}>No parts classified as "pipe" in this import. Pipe is auto-detected by description, length, and ServiceType.</div>
      </div>
    );
  }
  const totalLen = rows.reduce((s, r) => s + num(r.total_length), 0);
  const installedLen = rows.reduce((s, r) => s + num(r.installed_length), 0);
  const totalCost = rows.reduce((s, r) => s + num(r.total_cost), 0);
  const installedCost = rows.reduce((s, r) => s + num(r.installed_cost), 0);
  const pct = totalLen > 0 ? installedLen / totalLen : 0;
  return (
    <div style={{ ...cardStyle, marginTop: 16 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Pipe Length — Earned Value</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="Estimated LF" value={fmt(totalLen, 1)} />
        <Stat label="Installed LF" value={fmt(installedLen, 1)} />
        <Stat label="% LF Installed" value={fmtPct(pct)} accent />
        <Stat label="Earned $" value={fmtMoney(installedCost)} />
        <Stat label="Total Pipe $" value={fmtMoney(totalCost)} />
      </div>
      <details>
        <summary style={{ cursor: 'pointer', color: '#3b82f6', fontSize: 13 }}>Breakdown by phase code ({rows.length})</summary>
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Phase Code</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Pipe Count</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Estimated LF</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Installed LF</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>% Installed</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Earned $</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Total $</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tl = num(r.total_length); const il = num(r.installed_length);
                const p = tl > 0 ? il / tl : 0;
                return (
                  <tr key={r.part_field_phase_code || '(blank)'}>
                    <td style={tdStyle}>{r.part_field_phase_code || '(blank)'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.pipe_count}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(tl, 1)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(il, 1)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: p >= 0.5 ? '#10b981' : '#6b7280' }}>{fmtPct(p)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoney(num(r.installed_cost))}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoney(num(r.total_cost))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div style={{ background: accent ? '#eff6ff' : '#f9fafb', padding: 12, borderRadius: 6 }}>
    <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#6b7280', letterSpacing: 0.5 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color: accent ? '#2563eb' : '#111827', marginTop: 4 }}>{value}</div>
  </div>
);

// ── Searchable MultiSelect (portal-positioned dropdown) ──
const MultiSelect: React.FC<{
  label: string;
  values: string[];
  options: string[];
  renderOption?: (v: string) => string;
  onChange: (next: string[]) => void;
}> = ({ label, values, options, renderOption, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
    };
    updatePos();
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const display = renderOption ? renderOption(o) : o;
      return o.toLowerCase().includes(q) || display.toLowerCase().includes(q);
    });
  }, [options, search, renderOption]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => values.includes(o));

  const toggle = (o: string) => {
    onChange(values.includes(o) ? values.filter((v) => v !== o) : [...values, o]);
  };
  const handleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      onChange(values.filter((v) => !filtered.includes(v)));
    } else {
      const set = new Set([...values, ...filtered]);
      onChange(Array.from(set));
    }
  };

  const active = values.length > 0;
  const labelText = active
    ? `${label}: ${values.length === 1 ? (renderOption ? renderOption(values[0]) : values[0]) : `${values.length} selected`}`
    : `${label}: All`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: '6px 10px',
          border: `1px solid ${active ? '#3b82f6' : '#d1d5db'}`,
          background: active ? '#eff6ff' : 'white',
          color: active ? '#1d4ed8' : '#374151',
          borderRadius: 4, fontSize: 13, cursor: 'pointer', minWidth: 130, textAlign: 'left',
          fontWeight: active ? 600 : 400,
        }}
      >
        {labelText} ▾
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999,
          background: 'white', border: '1px solid #e5e7eb', borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 360, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
            <input
              autoFocus
              type="text"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ padding: '4px 0', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
            <button type="button" onClick={handleSelectAllFiltered} style={{ background: 'none', border: 'none', padding: '4px 10px', color: '#3b82f6', cursor: 'pointer' }}>
              {allFilteredSelected ? 'Unselect all' : `Select all${search ? ' (filtered)' : ''}`}
            </button>
            {active && (
              <button type="button" onClick={() => onChange([])} style={{ background: 'none', border: 'none', padding: '4px 10px', color: '#ef4444', cursor: 'pointer' }}>
                Clear
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 12, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>No matches</div>
            ) : (
              filtered.map((o) => {
                const checked = values.includes(o);
                return (
                  <label
                    key={o}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(o)} />
                    <span>{renderOption ? renderOption(o) : o}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const Pagination: React.FC<{ total: number; page: number; pageSize: number; onPage: (n: number) => void }> = ({ total, page, pageSize, onPage }) => {
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13 }}>
      <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total.toLocaleString()}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onPage(0)} disabled={page === 0} style={btnToggle}>« First</button>
        <button onClick={() => onPage(Math.max(0, page - 1))} disabled={page === 0} style={btnToggle}>‹ Prev</button>
        <span style={{ padding: '6px 10px' }}>Page {page + 1} / {lastPage + 1}</span>
        <button onClick={() => onPage(Math.min(lastPage, page + 1))} disabled={page >= lastPage} style={btnToggle}>Next ›</button>
        <button onClick={() => onPage(lastPage)} disabled={page >= lastPage} style={btnToggle}>Last »</button>
      </div>
    </div>
  );
};

function buildPivot(rows: StratusSummaryRow[], metric: Metric) {
  const cells: Record<string, Record<string, number>> = {};
  const phaseSet = new Set<string>();
  const statusSet = new Set<string>();

  const valueOf = (r: StratusSummaryRow): number => {
    switch (metric) {
      case 'hours': return num(r.total_hours);
      case 'count': return r.part_count;
      case 'weight': return num(r.total_weight);
      case 'length': return num(r.total_length);
      case 'cost': return num(r.total_cost);
    }
  };

  for (const r of rows) {
    const pc = r.part_field_phase_code || '(blank)';
    const st = statusKey(r.part_tracking_status);
    phaseSet.add(pc);
    statusSet.add(st);
    if (!cells[pc]) cells[pc] = {};
    cells[pc][st] = (cells[pc][st] || 0) + valueOf(r);
  }

  const orderedKnown = STATUS_ORDER.filter((s) => statusSet.has(s));
  const others = Array.from(statusSet).filter((s) => !STATUS_ORDER.includes(s)).sort();
  const statuses = [...orderedKnown, ...others];

  const phaseCodes = Array.from(phaseSet).sort((a, b) => {
    if (a === '(blank)') return 1;
    if (b === '(blank)') return -1;
    return a.localeCompare(b);
  });

  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const pc of phaseCodes) {
    rowTotals[pc] = 0;
    for (const s of statuses) {
      const v = cells[pc]?.[s] || 0;
      rowTotals[pc] += v;
      colTotals[s] = (colTotals[s] || 0) + v;
      grandTotal += v;
    }
  }

  return { statuses, phaseCodes, cells, rowTotals, colTotals, grandTotal };
}

// styles
const cardStyle: React.CSSProperties = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' };
const btnPrimary: React.CSSProperties = { background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 4, fontWeight: 500, cursor: 'pointer' };
const btnToggle: React.CSSProperties = { background: 'white', border: '1px solid #d1d5db', padding: '6px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', color: '#374151' };
const btnToggleActive: React.CSSProperties = { ...btnToggle, background: '#3b82f6', color: 'white', borderColor: '#3b82f6' };

export default Stratus;
