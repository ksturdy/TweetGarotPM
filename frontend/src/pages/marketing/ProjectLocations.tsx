import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { projectsApi, MapProject } from '../../services/projects';
import { MARKETS } from '../../constants/markets';
import SearchableSelect from '../../components/SearchableSelect';
import SearchableMultiSelect from '../../components/SearchableMultiSelect';
import CustomLayerMarkers from '../../components/maps/CustomLayerMarkers';
import StateRevenueLayer from '../../components/maps/StateRevenueLayer';
import USBoundaryMask from '../../components/maps/USBoundaryMask';
import * as customMapLayerService from '../../services/customMapLayers';
import '../../components/modals/Modal.css';
import '../../styles/SalesPipeline.css';

const STATUS_COLORS: Record<string, string> = {
  'Open': '#10b981',
  'active': '#10b981',
  'Soft-Closed': '#f59e0b',
  'on_hold': '#f59e0b',
  'Hard-Closed': '#6b7280',
  'completed': '#6b7280',
  'cancelled': '#ef4444',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  'Open': 'badge badge-success',
  'active': 'badge badge-success',
  'Soft-Closed': 'badge badge-warning',
  'on_hold': 'badge badge-warning',
  'Hard-Closed': 'badge',
  'completed': 'badge',
  'cancelled': 'badge badge-danger',
};

function createMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 12px; height: 12px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 2px rgba(0,0,0,0.15);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

const formatCurrency = (value?: number) => {
  if (!value) return '-';
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (value >= 1000) return '$' + Math.round(value / 1000) + 'K';
  return '$' + value.toLocaleString();
};

const ClusteredMarkers: React.FC<{ locations: MapProject[] }> = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });

    locations.forEach((loc) => {
      const color = STATUS_COLORS[loc.status] || '#6b7280';
      const badgeClass = STATUS_BADGE_CLASSES[loc.status] || 'badge';
      const marker = L.marker([loc.latitude, loc.longitude], {
        icon: createMarkerIcon(color),
      });

      const popupContent = `
        <div style="min-width:200px">
          <div style="margin-bottom:8px">
            <a href="/projects/${loc.id}" style="font-size:14px;font-weight:700;color:#1a56db;text-decoration:none">
              ${loc.name}
            </a>
            <div style="font-size:12px;color:#718096">#${loc.number}</div>
          </div>
          <div style="margin-bottom:6px">
            <span class="${badgeClass}">${loc.status}</span>
          </div>
          ${loc.customer_name ? `<div style="font-size:13px;margin-bottom:4px"><span style="color:#718096">Customer:</span> <span style="font-weight:500">${loc.customer_name}</span></div>` : ''}
          ${loc.ship_city || loc.address ? `<div style="font-size:13px;margin-bottom:4px"><span style="color:#718096">Location:</span> <span style="font-weight:500">${loc.ship_city && loc.ship_state ? `${loc.ship_city}, ${loc.ship_state}` : loc.address}</span></div>` : ''}
          ${loc.contract_value ? `<div style="font-size:13px;margin-bottom:4px"><span style="color:#718096">Contract:</span> <span style="font-weight:600;color:#10b981">${formatCurrency(loc.contract_value)}</span></div>` : ''}
          ${loc.manager_name ? `<div style="font-size:13px"><span style="color:#718096">Manager:</span> <span style="font-weight:500">${loc.manager_name}</span></div>` : ''}
          ${loc.market ? `<div style="font-size:12px;color:#718096;margin-top:6px;font-style:italic">${loc.market}</div>` : ''}
        </div>
      `;
      marker.bindPopup(popupContent);
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    return () => { map.removeLayer(cluster); };
  }, [map, locations]);

  return null;
};

const MapRefCapture: React.FC<{ mapRef: React.MutableRefObject<L.Map | null> }> = ({ mapRef }) => {
  const map = useMap();
  useEffect(() => { mapRef.current = map; }, [map, mapRef]);
  return null;
};

const US_GEOJSON_URL = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';
let cachedUSGeoJSON: any = null;

async function applyUSMaskToCanvas(
  canvas: HTMLCanvasElement,
  leafletMap: L.Map,
  cardEl: HTMLElement,
  renderScale: number
) {
  if (!cachedUSGeoJSON) {
    const resp = await fetch(US_GEOJSON_URL);
    cachedUSGeoJSON = await resp.json();
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const mapContainer = leafletMap.getContainer();
  const mapRect = mapContainer.getBoundingClientRect();
  const cardRect = cardEl.getBoundingClientRect();
  const ox = (mapRect.left - cardRect.left) * renderScale;
  const oy = (mapRect.top - cardRect.top) * renderScale;

  ctx.save();
  ctx.beginPath();

  // Outer rectangle covering entire canvas
  ctx.moveTo(0, 0);
  ctx.lineTo(canvas.width, 0);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();

  // Cut out each US state polygon as a hole
  for (const feature of cachedUSGeoJSON.features) {
    const { type, coordinates } = feature.geometry;
    const rings = type === 'MultiPolygon'
      ? coordinates.map((p: any) => p[0])
      : [coordinates[0]];

    for (const ring of rings) {
      let first = true;
      for (const [lng, lat] of ring) {
        const pt = leafletMap.latLngToContainerPoint([lat, lng]);
        const x = pt.x * renderScale + ox;
        const y = pt.y * renderScale + oy;
        if (first) { ctx.moveTo(x, y); first = false; }
        else { ctx.lineTo(x, y); }
      }
      ctx.closePath();
    }
  }

  ctx.fillStyle = '#ffffff';
  ctx.fill('evenodd');
  ctx.restore();
}

const ProjectLocations: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [marketFilter, setMarketFilter] = useState<string[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [managerFilter, setManagerFilter] = useState<string>('');
  const [customerFilter, setCustomerFilter] = useState<string>('');
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

  const [geocodeProgress, setGeocodeProgress] = useState<{ running: boolean; total: number; geocoded: number; failed: number } | null>(null);
  const [showConfirmGeocode, setShowConfirmGeocode] = useState(false);

  // Check for an already-running geocode job on page load
  useEffect(() => {
    projectsApi.geocodeStatus().then(({ data }) => {
      if (data.running) {
        setGeocodeProgress({ running: true, total: data.total, geocoded: data.geocoded, failed: data.failed });
      }
    }).catch(() => { /* ignore */ });
  }, []);

  const geocodeMutation = useMutation({
    mutationFn: (force?: boolean) => projectsApi.geocodeProjects(force).then(res => res.data),
    onSuccess: (data) => {
      if (data.status === 'started' || data.status === 'running') {
        setGeocodeProgress({ running: true, total: data.total, geocoded: data.geocoded || 0, failed: data.failed || 0 });
      } else {
        queryClient.invalidateQueries({ queryKey: ['projectMapLocations'] });
        setGeocodeProgress(null);
      }
    },
    onError: () => {
      alert('Geocoding failed. Please try again.');
    },
  });

  // Poll for geocoding progress
  useEffect(() => {
    if (!geocodeProgress?.running) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await projectsApi.geocodeStatus();
        setGeocodeProgress({ running: data.running ?? false, total: data.total, geocoded: data.geocoded, failed: data.failed });
        if (!data.running) {
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: ['projectMapLocations'] });
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [geocodeProgress?.running, queryClient]);

  // Get unique managers for filter dropdown
  const managerOptions = useMemo(() => {
    const unique = new Set<string>();
    locations.forEach((loc: MapProject) => {
      if (loc.manager_name) unique.add(loc.manager_name);
    });
    return [
      { value: '', label: 'All Managers' },
      ...Array.from(unique).sort().map(name => ({ value: name, label: name })),
    ];
  }, [locations]);

  // Get unique customers for filter dropdown
  const customerOptions = useMemo(() => {
    const unique = new Set<string>();
    locations.forEach((loc: MapProject) => {
      if (loc.customer_name) unique.add(loc.customer_name);
    });
    return [
      { value: '', label: 'All Customers' },
      ...Array.from(unique).sort().map(name => ({ value: name, label: name })),
    ];
  }, [locations]);

  // Get unique departments for filter dropdown
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

  // Apply client-side filters (market is now client-side for multi-select)
  const filteredLocations = useMemo(() => {
    return locations.filter((loc: MapProject) => {
      if (marketFilter.length > 0 && !marketFilter.includes(loc.market || '')) return false;
      if (departmentFilter && loc.department_name !== departmentFilter) return false;
      if (managerFilter && loc.manager_name !== managerFilter) return false;
      if (customerFilter && loc.customer_name !== customerFilter) return false;
      if (dateFrom && (!loc.start_date || loc.start_date < dateFrom)) return false;
      if (dateTo && (!loc.start_date || loc.start_date > dateTo)) return false;
      return true;
    });
  }, [locations, marketFilter, departmentFilter, managerFilter, customerFilter, dateFrom, dateTo]);

  // Stats
  const stats = useMemo(() => {
    const states = new Set<string>();
    const marketCounts: Record<string, number> = {};
    let totalContract = 0;
    filteredLocations.forEach((loc: MapProject) => {
      if (loc.ship_state) states.add(loc.ship_state);
      if (loc.market) {
        marketCounts[loc.market] = (marketCounts[loc.market] || 0) + 1;
      }
      if (loc.contract_value) totalContract += Number(loc.contract_value) || 0;
    });
    const topMarket = Object.entries(marketCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      totalOnMap: filteredLocations.length,
      statesCovered: states.size,
      topMarket: topMarket ? topMarket[0] : '-',
      totalContract,
    };
  }, [filteredLocations]);

  const stateRevenueData = useMemo(() => {
    const data: Record<string, { revenue: number; count: number }> = {};
    filteredLocations.forEach((loc: MapProject) => {
      const state = loc.ship_state?.toUpperCase().trim();
      if (!state) return;
      if (!data[state]) data[state] = { revenue: 0, count: 0 };
      data[state].revenue += Number(loc.contract_value) || 0;
      data[state].count += 1;
    });
    return data;
  }, [filteredLocations]);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [includeList, setIncludeList] = useState(false);
  const [enabledCustomLayers, setEnabledCustomLayers] = useState<number[]>([]);
  const [standardLayers, setStandardLayers] = useState<string[]>([]);

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

  const customLayerOptions = useMemo(() => {
    return customLayers.map(l => ({
      value: String(l.id),
      label: l.name,
      subtitle: `${l.pin_count} pin${l.pin_count !== 1 ? 's' : ''}`,
    }));
  }, [customLayers]);

  const handleExportPdf = async () => {
    setPdfLoading(true);
    setShowExportModal(false);
    try {
      // Capture the map as a base64 PNG, then overlay the US boundary mask
      let mapImage: string | undefined;
      if (mapRef.current) {
        const canvas = await html2canvas(mapRef.current, {
          useCORS: true,
          allowTaint: false,
          scale: 2,
          logging: false,
        });
        if (leafletMapRef.current) {
          await applyUSMaskToCanvas(canvas, leafletMapRef.current, mapRef.current, 2);
        }
        mapImage = canvas.toDataURL('image/png');
      }

      await projectsApi.downloadLocationsPdf({
        status: statusFilter || undefined,
        markets: marketFilter.length > 0 ? marketFilter : undefined,
        manager: managerFilter || undefined,
        customer: customerFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        mapImage,
        includeList,
      });
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const hasActiveFilters = statusFilter || marketFilter.length > 0 || departmentFilter || managerFilter || customerFilter || dateFrom || dateTo;

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
            <h1>Project Locations</h1>
            <div className="sales-subtitle">{filteredLocations.length} projects on map</div>
          </div>
        </div>
        <div className="sales-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowExportModal(true)}
            disabled={pdfLoading}
          >
            {pdfLoading ? 'Generating...' : 'Export PDF'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowConfirmGeocode(true)}
            disabled={geocodeMutation.isPending || !!geocodeProgress?.running}
          >
            Re-geocode All
          </button>
          <button
            className="btn btn-primary"
            onClick={() => geocodeMutation.mutate(false)}
            disabled={geocodeMutation.isPending || !!geocodeProgress?.running}
          >
            Geocode Missing
          </button>
        </div>
      </div>

      {/* Geocoding Progress */}
      {geocodeProgress?.running && (
        <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>
              Geocoding in progress...
            </span>
            <span style={{ fontSize: '14px', color: '#718096' }}>
              {geocodeProgress.geocoded + geocodeProgress.failed} / {geocodeProgress.total}
              {geocodeProgress.failed > 0 && ` (${geocodeProgress.failed} failed)`}
            </span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${geocodeProgress.total > 0 ? ((geocodeProgress.geocoded + geocodeProgress.failed) / geocodeProgress.total * 100) : 0}%`,
              height: '100%',
              background: '#3b82f6',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ fontSize: '32px' }}>📍</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#1a202c' }}>{stats.totalOnMap}</div>
            <div style={{ fontSize: '14px', color: '#718096' }}>Projects on Map</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ fontSize: '32px' }}>🗺️</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#1a202c' }}>{stats.statesCovered}</div>
            <div style={{ fontSize: '14px', color: '#718096' }}>States Covered</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ fontSize: '32px' }}>💰</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#1a202c' }}>${stats.totalContract ? Math.round(stats.totalContract).toLocaleString() : '0'}</div>
            <div style={{ fontSize: '14px', color: '#718096' }}>Total Contract Value</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ fontSize: '32px' }}>🏗️</div>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#1a202c' }}>{stats.topMarket}</div>
            <div style={{ fontSize: '14px', color: '#718096' }}>Top Market</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto auto', gap: '1rem' }}>
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
            <label className="form-label">Manager</label>
            <SearchableSelect
              options={managerOptions}
              value={managerFilter}
              onChange={setManagerFilter}
              placeholder="All Managers"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer</label>
            <SearchableSelect
              options={customerOptions}
              value={customerFilter}
              onChange={setCustomerFilter}
              placeholder="All Customers"
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
                  setManagerFilter('');
                  setCustomerFilter('');
                  setDateFrom('');
                  setDateTo('');
                }}
                style={{ width: '100%' }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Layer Selectors */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '8px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Standard Maps</label>
          <SearchableMultiSelect
            options={[
              { value: 'projects', label: 'Projects' },
              { value: 'revenue', label: 'Revenue by State' },
            ]}
            values={standardLayers}
            onChange={setStandardLayers}
            placeholder="Select layers..."
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Custom Layers
            <Link to="/marketing/custom-maps" style={{ fontSize: '12px', fontWeight: 500, color: '#3b82f6', textDecoration: 'none' }}>
              Manage
            </Link>
          </label>
          <SearchableMultiSelect
            options={customLayerOptions}
            values={enabledCustomLayers.map(String)}
            onChange={(vals) => setEnabledCustomLayers(vals.map(Number))}
            placeholder={customLayers.length === 0 ? 'No custom layers' : 'Select layers...'}
          />
        </div>
      </div>
      <div ref={mapRef} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
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
            url={standardLayers.includes('revenue')
              ? 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
            }
          />
          <MapRefCapture mapRef={leafletMapRef} />
          <USBoundaryMask />
          {standardLayers.includes('projects') && filteredLocations.length > 0 && (
            <ClusteredMarkers locations={filteredLocations} />
          )}
          {standardLayers.includes('revenue') && (
            <StateRevenueLayer stateData={stateRevenueData} />
          )}
          {enabledCustomLayers.map(layerId => {
            const layer = customLayers.find(l => l.id === layerId);
            const pins = customPinQueries.data?.[layerId] || [];
            return layer && pins.length > 0 ? (
              <CustomLayerMarkers key={layerId} pins={pins} color={layer.pin_color} layerName={layer.name} />
            ) : null;
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Legend:</span>
          {standardLayers.length === 0 && enabledCustomLayers.length === 0 && (
            <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Select layers above to display on map</span>
          )}
          {standardLayers.includes('projects') && (
            Object.entries({ 'Open': '#10b981', 'Soft-Closed': '#f59e0b', 'Hard-Closed': '#6b7280' }).map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '14px', height: '14px',
                  background: color,
                  borderRadius: '50%',
                  border: '2px solid white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
                <span style={{ fontSize: '13px', color: '#374151' }}>{label}</span>
              </div>
            ))
          )}
          {standardLayers.includes('revenue') && (
            <>
              {standardLayers.includes('projects') && <div style={{ width: '1px', height: '16px', background: '#e2e8f0' }} />}
              {['#dcfce7', '#bbf7d0', '#4ade80', '#16a34a', '#166534'].map((color, i) => {
                const labels = ['Low', '', 'Medium', '', 'High'];
                return (
                  <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '20px', height: '14px', background: color, borderRadius: '2px', border: '1px solid #e2e8f0' }} />
                    {labels[i] && <span style={{ fontSize: '12px', color: '#64748b' }}>{labels[i]}</span>}
                  </div>
                );
              })}
            </>
          )}
          {enabledCustomLayers.length > 0 && (
            <>
              {standardLayers.length > 0 && <div style={{ width: '1px', height: '16px', background: '#e2e8f0' }} />}
              {enabledCustomLayers.map(layerId => {
                const layer = customLayers.find(l => l.id === layerId);
                if (!layer) return null;
                return (
                  <div key={layerId} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '10px', height: '10px',
                      background: layer.pin_color,
                      borderRadius: '50%',
                      border: '2px solid white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                    <span style={{ fontSize: '13px', color: '#374151' }}>{layer.name}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Re-geocode Confirmation Modal */}
      {showConfirmGeocode && (
        <div className="modal-overlay" onClick={() => setShowConfirmGeocode(false)}>
          <div className="modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>Re-geocode All Projects</h2>
              <button className="modal-close" onClick={() => setShowConfirmGeocode(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#4b5563', lineHeight: 1.6, margin: 0 }}>
                This will re-geocode all projects with street addresses using Geocodio. The process runs in the background and you can navigate away from this page.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowConfirmGeocode(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowConfirmGeocode(false);
                  geocodeMutation.mutate(true);
                }}
              >
                Start Re-geocode
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export PDF Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>Export Project Locations PDF</h2>
              <button className="modal-close" onClick={() => setShowExportModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#4b5563', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                The PDF will include a screenshot of the current map view, summary statistics, and state/market breakdowns.
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
                Adds a second page with all {filteredLocations.length} projects sorted by state and city
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

export default ProjectLocations;
