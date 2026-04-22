import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import USBoundaryMask from '../../components/maps/USBoundaryMask';
import * as customMapLayerService from '../../services/customMapLayers';
import type { CustomMapLayer, CustomMapPin, UploadResult } from '../../services/customMapLayers';

const COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

function createPinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 12px; height: 12px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -8],
  });
}

const PinMarkers: React.FC<{ pins: CustomMapPin[]; color: string; layerName: string }> = ({ pins, color, layerName }) => {
  const map = useMap();

  useEffect(() => {
    const validPins = pins.filter(p => p.latitude && p.longitude);
    if (validPins.length === 0) return;

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (clusterObj: any) => {
        const count = clusterObj.getChildCount();
        return L.divIcon({
          className: '',
          html: `<div style="
            width: 28px; height: 28px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            color: white;
            font-size: 11px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          ">${count}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
      },
    });

    validPins.forEach((pin) => {
      const marker = L.marker([pin.latitude!, pin.longitude!], { icon: createPinIcon(color) });
      const addressParts = [pin.address, pin.city, pin.state, pin.zip_code].filter(Boolean);
      const popupContent = `
        <div style="min-width:180px">
          <div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px">${pin.name}</div>
          ${pin.category ? `<div style="font-size:12px;color:${color};font-weight:500;margin-bottom:4px">${pin.category}</div>` : ''}
          ${addressParts.length > 0 ? `<div style="font-size:12px;color:#64748b;margin-bottom:2px">${addressParts.join(', ')}</div>` : ''}
          ${pin.notes ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px;font-style:italic">${pin.notes}</div>` : ''}
        </div>
      `;
      marker.bindPopup(popupContent);
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);

    // Fit bounds to pins
    const bounds = L.latLngBounds(validPins.map(p => [p.latitude!, p.longitude!]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });

    return () => { map.removeLayer(cluster); };
  }, [map, pins, color, layerName]);

  return null;
};

const CustomMaps: React.FC = () => {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editLayer, setEditLayer] = useState<CustomMapLayer | null>(null);
  const [uploadLayer, setUploadLayer] = useState<CustomMapLayer | null>(null);
  const [deleteLayer, setDeleteLayer] = useState<CustomMapLayer | null>(null);
  const [viewLayer, setViewLayer] = useState<CustomMapLayer | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(COLOR_OPTIONS[0]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: layers = [], isLoading } = useQuery({
    queryKey: ['custom-map-layers'],
    queryFn: customMapLayerService.getAll,
  });

  const { data: viewPins = [] } = useQuery({
    queryKey: ['custom-map-pins', viewLayer?.id],
    queryFn: () => customMapLayerService.getPins(viewLayer!.id),
    enabled: !!viewLayer,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; pin_color: string }) => customMapLayerService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-map-layers'] });
      setShowCreateModal(false);
      setFormName('');
      setFormColor(COLOR_OPTIONS[0]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; pin_color: string } }) =>
      customMapLayerService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-map-layers'] });
      setEditLayer(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => customMapLayerService.deleteLayer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-map-layers'] });
      if (viewLayer && viewLayer.id === deleteLayer?.id) setViewLayer(null);
      setDeleteLayer(null);
    },
  });

  const openCreate = () => {
    setFormName('');
    setFormColor(COLOR_OPTIONS[0]);
    setShowCreateModal(true);
  };

  const openEdit = (layer: CustomMapLayer) => {
    setFormName(layer.name);
    setFormColor(layer.pin_color);
    setEditLayer(layer);
  };

  const openUpload = (layer: CustomMapLayer) => {
    setUploadFile(null);
    setUploadResult(null);
    setUploadLayer(layer);
  };

  const handleCreate = () => {
    if (!formName.trim()) return;
    createMutation.mutate({ name: formName.trim(), pin_color: formColor });
  };

  const handleUpdate = () => {
    if (!editLayer || !formName.trim()) return;
    updateMutation.mutate({ id: editLayer.id, data: { name: formName.trim(), pin_color: formColor } });
  };

  const handleUpload = async () => {
    if (!uploadLayer || !uploadFile) return;
    setUploading(true);
    try {
      const result = await customMapLayerService.uploadCsv(uploadLayer.id, uploadFile);
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ['custom-map-layers'] });
      queryClient.invalidateQueries({ queryKey: ['custom-map-pins'] });
    } catch (err: any) {
      setUploadResult({ total_rows: 0, imported: 0, skipped: 0, errors: [err.response?.data?.error || 'Upload failed'] });
    } finally {
      setUploading(false);
    }
  };

  const handleViewMap = (layer: CustomMapLayer) => {
    if (viewLayer?.id === layer.id) {
      setViewLayer(null);
    } else {
      setViewLayer(layer);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/marketing" style={{ color: '#64748b', textDecoration: 'none', fontSize: '14px' }}>
            Marketing
          </Link>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>Custom Maps</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => customMapLayerService.downloadTemplate()}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0',
              background: 'white', color: '#475569', fontSize: '13px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            Download Template
          </button>
          <button
            onClick={openCreate}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none',
              background: '#3b82f6', color: 'white', fontSize: '13px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            + New Custom Map
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{
        background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px',
        padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#0369a1',
      }}>
        Create custom map layers to view standalone or overlay on Project Locations and Customer Comparison maps.
        Download the CSV template, fill in your locations, then upload to any layer.
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading...</div>
      ) : layers.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px', background: '#f8fafc',
          borderRadius: '8px', border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🗺️</div>
          <div style={{ fontSize: '16px', color: '#475569', marginBottom: '8px' }}>No custom maps yet</div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            Create a custom map to add location overlays like service tech homes, office locations, or competitor sites.
          </div>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Color</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Name</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>Pins</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Created By</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Created</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {layers.map((layer) => (
                <tr
                  key={layer.id}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: viewLayer?.id === layer.id ? `${layer.pin_color}08` : undefined,
                  }}
                >
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: layer.pin_color, border: '2px solid white',
                      boxShadow: '0 0 0 1px #e2e8f0',
                    }} />
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 500, color: '#1e293b' }}>{layer.name}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', color: '#64748b' }}>
                    {Number(layer.pin_count) || 0}
                  </td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{layer.created_by_name || '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>
                    {new Date(layer.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleViewMap(layer)}
                        disabled={Number(layer.pin_count) === 0}
                        style={{
                          padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer',
                          border: viewLayer?.id === layer.id ? `1px solid ${layer.pin_color}` : '1px solid #e2e8f0',
                          background: viewLayer?.id === layer.id ? `${layer.pin_color}15` : 'white',
                          color: viewLayer?.id === layer.id ? layer.pin_color : '#475569',
                          fontWeight: viewLayer?.id === layer.id ? 600 : 400,
                          opacity: Number(layer.pin_count) === 0 ? 0.4 : 1,
                        }}
                      >
                        {viewLayer?.id === layer.id ? 'Hide Map' : 'View Map'}
                      </button>
                      <button
                        onClick={() => openUpload(layer)}
                        style={{
                          padding: '4px 10px', borderRadius: '4px', border: '1px solid #e2e8f0',
                          background: 'white', color: '#475569', fontSize: '12px', cursor: 'pointer',
                        }}
                      >
                        Upload CSV
                      </button>
                      <button
                        onClick={() => openEdit(layer)}
                        style={{
                          padding: '4px 10px', borderRadius: '4px', border: '1px solid #e2e8f0',
                          background: 'white', color: '#475569', fontSize: '12px', cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteLayer(layer)}
                        style={{
                          padding: '4px 10px', borderRadius: '4px', border: '1px solid #fecaca',
                          background: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Standalone Map View */}
      {viewLayer && (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px',
          }}>
            <div style={{
              width: '14px', height: '14px', borderRadius: '50%',
              background: viewLayer.pin_color, border: '2px solid white',
              boxShadow: '0 0 0 1px #e2e8f0',
            }} />
            <h2 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>{viewLayer.name}</h2>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              ({viewPins.filter(p => p.latitude && p.longitude).length} locations)
            </span>
          </div>
          <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <MapContainer
              center={[39.8283, -98.5795]}
              zoom={4}
              zoomSnap={0.25}
              zoomDelta={0.25}
              style={{ height: '500px', width: '100%', background: '#ffffff' }}
              scrollWheelZoom={true}
              key={viewLayer.id}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              <USBoundaryMask />
              <PinMarkers pins={viewPins} color={viewLayer.pin_color} layerName={viewLayer.name} />
            </MapContainer>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreateModal || editLayer) && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => { setShowCreateModal(false); setEditLayer(null); }}>
          <div
            style={{
              background: 'white', borderRadius: '12px', padding: '24px', width: '420px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', color: '#1e293b' }}>
              {editLayer ? 'Edit Custom Map' : 'New Custom Map'}
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '6px' }}>
                Layer Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Service Tech Locations"
                autoFocus
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0',
                  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>
                Pin Color
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {COLOR_OPTIONS.map((color) => (
                  <div
                    key={color}
                    onClick={() => setFormColor(color)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '50%', background: color, cursor: 'pointer',
                      border: formColor === color ? '3px solid #1e293b' : '3px solid transparent',
                      boxShadow: formColor === color ? '0 0 0 2px white, 0 0 0 4px ' + color : 'none',
                      transition: 'all 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowCreateModal(false); setEditLayer(null); }}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0',
                  background: 'white', color: '#475569', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={editLayer ? handleUpdate : handleCreate}
                disabled={!formName.trim() || createMutation.isPending || updateMutation.isPending}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: 'none',
                  background: '#3b82f6', color: 'white', fontSize: '13px', cursor: 'pointer',
                  opacity: !formName.trim() ? 0.5 : 1,
                }}
              >
                {editLayer ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadLayer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setUploadLayer(null)}>
          <div
            style={{
              background: 'white', borderRadius: '12px', padding: '24px', width: '480px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: '#1e293b' }}>
              Upload to "{uploadLayer.name}"
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8' }}>
              This will replace all existing pins in this layer.
            </p>

            {!uploadResult ? (
              <>
                <div style={{
                  border: '2px dashed #e2e8f0', borderRadius: '8px', padding: '24px',
                  textAlign: 'center', marginBottom: '16px',
                  background: uploadFile ? '#f0fdf4' : '#f8fafc',
                }}>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" style={{ cursor: 'pointer' }}>
                    {uploadFile ? (
                      <div>
                        <div style={{ fontSize: '14px', color: '#16a34a', fontWeight: 500 }}>{uploadFile.name}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Click to change file</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
                        <div style={{ fontSize: '14px', color: '#475569' }}>Click to select a CSV or Excel file</div>
                      </div>
                    )}
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setUploadLayer(null)}
                    style={{
                      padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0',
                      background: 'white', color: '#475569', fontSize: '13px', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!uploadFile || uploading}
                    style={{
                      padding: '8px 16px', borderRadius: '6px', border: 'none',
                      background: '#3b82f6', color: 'white', fontSize: '13px', cursor: 'pointer',
                      opacity: !uploadFile || uploading ? 0.5 : 1,
                    }}
                  >
                    {uploading ? 'Uploading & Geocoding...' : 'Upload'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  background: uploadResult.imported > 0 ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${uploadResult.imported > 0 ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: '8px', padding: '16px', marginBottom: '16px',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                    Upload Complete
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>Total rows: {uploadResult.total_rows}</div>
                    <div style={{ color: '#16a34a' }}>Imported: {uploadResult.imported}</div>
                    {uploadResult.skipped > 0 && (
                      <div style={{ color: '#dc2626' }}>Skipped: {uploadResult.skipped}</div>
                    )}
                  </div>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#dc2626' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>Issues:</div>
                      {uploadResult.errors.slice(0, 10).map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                      {uploadResult.errors.length > 10 && (
                        <div style={{ color: '#94a3b8', marginTop: '4px' }}>
                          ...and {uploadResult.errors.length - 10} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => setUploadLayer(null)}
                    style={{
                      padding: '8px 16px', borderRadius: '6px', border: 'none',
                      background: '#3b82f6', color: 'white', fontSize: '13px', cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteLayer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setDeleteLayer(null)}>
          <div
            style={{
              background: 'white', borderRadius: '12px', padding: '24px', width: '400px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#1e293b' }}>Delete Custom Map</h2>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b' }}>
              Are you sure you want to delete "{deleteLayer.name}"?
              This will also delete all {Number(deleteLayer.pin_count) || 0} pins. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteLayer(null)}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: '1px solid #e2e8f0',
                  background: 'white', color: '#475569', fontSize: '13px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteLayer.id)}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '8px 16px', borderRadius: '6px', border: 'none',
                  background: '#dc2626', color: 'white', fontSize: '13px', cursor: 'pointer',
                }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomMaps;
