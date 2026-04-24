import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { projectsApi, MapProject } from '../../services/projects';
import { MARKETS } from '../../constants/markets';
import SearchableSelect from '../../components/SearchableSelect';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import CustomLayerToggle from '../../components/maps/CustomLayerToggle';
import CustomLayerMarkers from '../../components/maps/CustomLayerMarkers';
import USBoundaryMask from '../../components/maps/USBoundaryMask';
import * as customMapLayerService from '../../services/customMapLayers';
import '../../components/modals/Modal.css';
import '../../styles/SalesPipeline.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const CUSTOMER_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
];

function createCustomerMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 14px; height: 14px;
      background: ${color};
      border: 2.5px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -9],
  });
}

const formatCurrency = (value?: number) => {
  if (!value) return '-';
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (value >= 1000) return '$' + Math.round(value / 1000) + 'K';
  return '$' + value.toLocaleString();
};

const formatCurrencyFull = (value?: number) => {
  if (!value) return '$0';
  return '$' + Math.round(value).toLocaleString();
};

// Color-coded clustered markers for comparison view
const ComparisonMarkers: React.FC<{
  locations: MapProject[];
  customerColors: Record<string, string>;
}> = ({ locations, customerColors }) => {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });

    locations.forEach((loc) => {
      const color = customerColors[loc.customer_name || ''] || '#6b7280';
      const marker = L.marker([loc.latitude, loc.longitude], {
        icon: createCustomerMarkerIcon(color),
      });

      const popupContent = `
        <div style="min-width:200px">
          <div style="margin-bottom:8px">
            <a href="/projects/${loc.id}" style="font-size:14px;font-weight:700;color:#1a56db;text-decoration:none">
              ${loc.name}
            </a>
            <div style="font-size:12px;color:#718096">#${loc.number}</div>
          </div>
          <div style="font-size:13px;margin-bottom:4px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle;"></span>
            <span style="font-weight:600">${loc.customer_name || '-'}</span>
          </div>
          ${loc.ship_city || loc.address ? `<div style="font-size:13px;margin-bottom:4px"><span style="color:#718096">Location:</span> <span style="font-weight:500">${loc.ship_city && loc.ship_state ? `${loc.ship_city}, ${loc.ship_state}` : loc.address}</span></div>` : ''}
          ${loc.contract_value ? `<div style="font-size:13px;margin-bottom:4px"><span style="color:#718096">Contract:</span> <span style="font-weight:600;color:#10b981">${formatCurrency(loc.contract_value)}</span></div>` : ''}
          ${loc.market ? `<div style="font-size:12px;color:#718096;margin-top:4px;font-style:italic">${loc.market}</div>` : ''}
        </div>
      `;
      marker.bindPopup(popupContent);
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    return () => { map.removeLayer(cluster); };
  }, [map, locations, customerColors]);

  return null;
};

const MapRefCapture: React.FC<{ mapRef: React.MutableRefObject<L.Map | null> }> = ({ mapRef }) => {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
};

const CustomerComparison: React.FC = () => {
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [marketFilter, setMarketFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const { data: locations = [], isLoading, error } = useQuery({
    queryKey: ['projectMapLocations', statusFilter],
    queryFn: () => {
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      return projectsApi.getMapLocations(filters).then(res => res.data);
    },
  });

  // Build customer options from all locations
  const customerOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    locations.forEach((loc: MapProject) => {
      if (loc.customer_name) {
        counts[loc.customer_name] = (counts[loc.customer_name] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        value: name,
        label: name,
        subtitle: `${count} project${count !== 1 ? 's' : ''}`,
      }));
  }, [locations]);

  // Build department options
  const departmentOptions = useMemo(() => {
    const unique = new Set<string>();
    locations.forEach((loc: MapProject) => {
      if (loc.department_name) unique.add(loc.department_name);
    });
    return [
      { value: '', label: 'All Departments' },
      ...Array.from(unique).sort().map(name => ({ value: name, label: name })),
    ];
  }, [locations]);

  // Assign colors to selected customers
  const customerColors = useMemo(() => {
    const map: Record<string, string> = {};
    selectedCustomers.forEach((name, i) => {
      map[name] = CUSTOMER_COLORS[i % CUSTOMER_COLORS.length];
    });
    return map;
  }, [selectedCustomers]);

  // Apply filters and restrict to selected customers
  const filteredLocations = useMemo(() => {
    if (selectedCustomers.length === 0) return [];
    return locations.filter((loc: MapProject) => {
      if (!selectedCustomers.includes(loc.customer_name || '')) return false;
      if (marketFilter.length > 0 && !marketFilter.includes(loc.market || '')) return false;
      if (departmentFilter && loc.department_name !== departmentFilter) return false;
      if (dateFrom && (!loc.start_date || loc.start_date < dateFrom)) return false;
      if (dateTo && (!loc.start_date || loc.start_date > dateTo)) return false;
      return true;
    });
  }, [locations, selectedCustomers, marketFilter, departmentFilter, dateFrom, dateTo]);

  // Per-customer stats
  const customerStats = useMemo(() => {
    return selectedCustomers.map(name => {
      const projects = filteredLocations.filter(l => l.customer_name === name);
      const states = new Set<string>();
      const marketCounts: Record<string, number> = {};
      let totalContract = 0;
      projects.forEach(p => {
        if (p.ship_state) states.add(p.ship_state);
        if (p.market) marketCounts[p.market] = (marketCounts[p.market] || 0) + 1;
        totalContract += Number(p.contract_value) || 0;
      });
      const topMarket = Object.entries(marketCounts).sort((a, b) => b[1] - a[1])[0];
      return {
        name,
        color: customerColors[name],
        projectCount: projects.length,
        totalContract,
        avgProjectSize: projects.length > 0 ? totalContract / projects.length : 0,
        statesCovered: states.size,
        topMarket: topMarket ? topMarket[0] : '-',
      };
    });
  }, [selectedCustomers, filteredLocations, customerColors]);

  // Chart data: Contract Value by Customer
  const contractChartData = useMemo(() => ({
    labels: customerStats.map(s => s.name),
    datasets: [{
      label: 'Total Contract Value',
      data: customerStats.map(s => s.totalContract),
      backgroundColor: customerStats.map(s => s.color + 'CC'),
      borderColor: customerStats.map(s => s.color),
      borderWidth: 1,
      borderRadius: 4,
    }],
  }), [customerStats]);

  // Chart data: Project Count by State (grouped)
  const stateChartData = useMemo(() => {
    const stateSet = new Set<string>();
    filteredLocations.forEach(l => { if (l.ship_state) stateSet.add(l.ship_state); });
    const states = Array.from(stateSet).sort();

    const datasets = selectedCustomers.map(name => {
      const custLocs = filteredLocations.filter(l => l.customer_name === name);
      const stateCounts: Record<string, number> = {};
      custLocs.forEach(l => {
        if (l.ship_state) stateCounts[l.ship_state] = (stateCounts[l.ship_state] || 0) + 1;
      });
      return {
        label: name,
        data: states.map(s => stateCounts[s] || 0),
        backgroundColor: customerColors[name] + 'CC',
        borderColor: customerColors[name],
        borderWidth: 1,
        borderRadius: 3,
      };
    });

    return { labels: states, datasets };
  }, [selectedCustomers, filteredLocations, customerColors]);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [includeList, setIncludeList] = useState(false);
  const [enabledCustomLayers, setEnabledCustomLayers] = useState<number[]>([]);

  const { data: customLayers = [] } = useQuery({
    queryKey: ['custom-map-layers'],
    queryFn: customMapLayerService.getAll,
  });

  const customPinQueries = useQuery({
    queryKey: ['custom-map-pins', enabledCustomLayers],
    queryFn: async () => {
      const results: Record<number, Awaited<ReturnType<typeof customMapLayerService.getPins>>> = {};
      await Promise.all(enabledCustomLayers.map(async (id) => {
        results[id] = await customMapLayerService.getPins(id);
      }));
      return results;
    },
    enabled: enabledCustomLayers.length > 0,
  });

  const toggleCustomLayer = (id: number) => {
    setEnabledCustomLayers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleExportPdf = async () => {
    setPdfLoading(true);
    setShowExportModal(false);
    try {
      // Gather current map viewport
      const map = leafletMapRef.current;
      const center = map ? [map.getCenter().lat, map.getCenter().lng] : [39.8283, -98.5795];
      const zoom = map ? map.getZoom() : 4;

      // Gather custom pin data for enabled layers
      const customPinData = enabledCustomLayers
        .map(layerId => {
          const layer = customLayers.find(l => l.id === layerId);
          const pins = customPinQueries.data?.[layerId] || [];
          return layer && pins.length > 0
            ? { pins, color: layer.pin_color, name: layer.name }
            : null;
        })
        .filter(Boolean);

      await projectsApi.downloadComparisonPdf({
        customers: selectedCustomers,
        customerColors,
        status: statusFilter || undefined,
        markets: marketFilter.length > 0 ? marketFilter : undefined,
        department: departmentFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        includeList,
        mapConfig: {
          center,
          zoom,
          tileUrl: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
          customPins: customPinData,
        },
      });
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const hasActiveFilters = statusFilter || marketFilter.length > 0 || departmentFilter || dateFrom || dateTo;

  if (isLoading) {
    return <div className="loading">Loading project locations...</div>;
  }

  if (error) {
    return <div className="error-message">Error loading project locations</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div className="sales-page-header">
        <div className="sales-page-title">
          <div>
            <Link to="/marketing" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
              &larr; Back to Marketing
            </Link>
            <h1>Customer Comparison</h1>
            <div className="sales-subtitle">
              {selectedCustomers.length > 0
                ? `Comparing ${selectedCustomers.length} customer${selectedCustomers.length !== 1 ? 's' : ''} | ${filteredLocations.length} projects`
                : 'Select customers to compare'}
            </div>
          </div>
        </div>
        <div className="sales-header-actions" style={{ display: 'flex', gap: '8px' }}>
          {selectedCustomers.length >= 2 && (
            <button
              className="btn btn-secondary"
              onClick={() => setShowExportModal(true)}
              disabled={pdfLoading}
            >
              {pdfLoading ? 'Generating...' : 'Export PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Customer Selector */}
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontWeight: 600 }}>Select Customers to Compare</label>
          <SearchableMultiSelect
            options={customerOptions}
            values={selectedCustomers}
            onChange={(vals) => setSelectedCustomers(vals.slice(0, 6))}
            placeholder="Search and select customers (up to 6)..."
          />
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <SearchableSelect
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'Open', label: 'Open' },
                { value: 'Soft-Closed', label: 'Soft-Closed' },
                { value: 'Hard-Closed', label: 'Hard-Closed' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Statuses"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Market</label>
            <SearchableMultiSelect
              options={MARKETS.map(m => ({ value: m.value, label: m.label }))}
              values={marketFilter}
              onChange={setMarketFilter}
              placeholder="All Markets"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Department</label>
            <SearchableSelect
              options={departmentOptions}
              value={departmentFilter}
              onChange={setDepartmentFilter}
              placeholder="All Departments"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Start</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: '0.4rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: 'white',
                fontSize: '0.875rem',
                minHeight: '36px',
                boxSizing: 'border-box',
                width: '140px',
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Finish</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                padding: '0.4rem 0.5rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: 'white',
                fontSize: '0.875rem',
                minHeight: '36px',
                boxSizing: 'border-box',
                width: '140px',
              }}
            />
          </div>

          {hasActiveFilters && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setStatusFilter('');
                  setMarketFilter([]);
                  setDepartmentFilter('');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedCustomers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1a202c', margin: '0 0 8px 0' }}>Select Customers Above</h3>
          <p style={{ color: '#718096', margin: 0, fontSize: '14px' }}>
            Choose 2 or more customers to see a side-by-side comparison of their projects on the map
          </p>
        </div>
      ) : (
        <>
          {/* Per-Customer KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(selectedCustomers.length, 4)}, 1fr)`, gap: '12px', marginBottom: '20px' }}>
            {customerStats.map(stat => (
              <div
                key={stat.name}
                className="card"
                style={{
                  padding: '16px',
                  borderTop: `4px solid ${stat.color}`,
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 700, color: stat.color, marginBottom: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stat.name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Projects</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{stat.projectCount}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Contract Value</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#059669' }}>{formatCurrency(stat.totalContract)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>States</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{stat.statesCovered}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Avg Size</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(stat.avgProjectSize)}</div>
                  </div>
                </div>
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Top Market</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>{stat.topMarket}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Map */}
          {customLayers.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <CustomLayerToggle layers={customLayers} enabledIds={enabledCustomLayers} onToggle={toggleCustomLayer} />
            </div>
          )}
          <div ref={mapRef} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem', position: 'relative' }}>
            {filteredLocations.length > 0 ? (
              <>
                <MapContainer
                  center={[39.8283, -98.5795]}
                  zoom={4}
                  zoomSnap={0.25}
                  zoomDelta={0.25}
                  style={{ height: '550px', width: '100%', background: '#ffffff' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  />
                  <MapRefCapture mapRef={leafletMapRef} />
                  <USBoundaryMask />
                  <ComparisonMarkers locations={filteredLocations} customerColors={customerColors} />
                  {enabledCustomLayers.map(layerId => {
                    const layer = customLayers.find(l => l.id === layerId);
                    const pins = customPinQueries.data?.[layerId] || [];
                    return layer && pins.length > 0 ? (
                      <CustomLayerMarkers key={layerId} pins={pins} color={layer.pin_color} layerName={layer.name} />
                    ) : null;
                  })}
                </MapContainer>
                {/* Map Legend */}
                <div style={{
                  position: 'absolute',
                  bottom: '16px',
                  right: '16px',
                  background: 'white',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  maxWidth: '220px',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Legend
                  </div>
                  {selectedCustomers.map(name => {
                    const count = filteredLocations.filter(l => l.customer_name === name).length;
                    return (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{
                          width: '12px', height: '12px',
                          background: customerColors[name],
                          borderRadius: '50%',
                          border: '2px solid white',
                          boxShadow: '0 0 0 1px ' + customerColors[name],
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: '12px', color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1a202c', margin: '0 0 6px 0' }}>No geocoded projects for selected customers</h3>
                <p style={{ color: '#718096', margin: 0, fontSize: '13px' }}>
                  Try selecting different customers or adjusting filters
                </p>
              </div>
            )}
          </div>

          {/* Charts */}
          {selectedCustomers.length >= 2 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#002356', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '16px' }}>
                  Total Contract Value
                </div>
                <Bar
                  data={contractChartData}
                  options={{
                    indexAxis: 'y' as const,
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => formatCurrencyFull(ctx.raw as number),
                        },
                      },
                    },
                    scales: {
                      x: {
                        ticks: {
                          callback: (val) => formatCurrency(val as number),
                          font: { size: 11 },
                        },
                        grid: { color: '#f1f5f9' },
                      },
                      y: {
                        ticks: { font: { size: 12 } },
                        grid: { display: false },
                      },
                    },
                  }}
                />
              </div>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#002356', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '16px' }}>
                  Projects by State
                </div>
                <div style={{ maxHeight: '300px' }}>
                  <Bar
                    data={stateChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      plugins: {
                        legend: {
                          position: 'bottom' as const,
                          labels: { boxWidth: 12, font: { size: 11 }, padding: 12 },
                        },
                      },
                      scales: {
                        x: {
                          ticks: { font: { size: 10 } },
                          grid: { display: false },
                        },
                        y: {
                          beginAtZero: true,
                          ticks: {
                            stepSize: 1,
                            font: { size: 11 },
                          },
                          grid: { color: '#f1f5f9' },
                        },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Export PDF Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>Export Customer Comparison PDF</h2>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#4b5563', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                The PDF will include the color-coded map, per-customer KPI comparison, and breakdown charts.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={includeList}
                  onChange={(e) => setIncludeList(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#002356' }}
                />
                <span style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 500 }}>
                  Include project detail list
                </span>
              </label>
              <p style={{ color: '#6b7280', fontSize: '0.8rem', margin: '4px 0 0 24px' }}>
                Adds project details grouped by customer ({filteredLocations.length} projects total)
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExportPdf}
                disabled={pdfLoading}
              >
                {pdfLoading ? 'Generating...' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerComparison;
