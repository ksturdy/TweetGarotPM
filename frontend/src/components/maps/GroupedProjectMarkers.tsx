import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapProject } from '../../services/projects';
import { MapMarketGroup } from '../../services/mapMarketGroups';

const formatCurrency = (value?: number) => {
  if (!value) return '-';
  if (value >= 1000000) return '$' + (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (value >= 1000) return '$' + Math.round(value / 1000) + 'K';
  return '$' + value.toLocaleString();
};

function createGroupIcon(color: string): L.DivIcon {
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

interface Props {
  locations: MapProject[];
  groups: MapMarketGroup[];
  showUngrouped?: boolean;
}

const GroupedProjectMarkers: React.FC<Props> = ({ locations, groups, showUngrouped = false }) => {
  const map = useMap();

  useEffect(() => {
    // Build market → group lookup (first group wins if markets overlap)
    const marketToGroup = new Map<string, MapMarketGroup>();
    groups.forEach(g => {
      g.markets.forEach(m => {
        if (!marketToGroup.has(m)) marketToGroup.set(m, g);
      });
    });

    // Bucket projects by group id
    const buckets = new Map<number, MapProject[]>();
    const ungrouped: MapProject[] = [];
    locations.forEach(loc => {
      const group = loc.market ? marketToGroup.get(loc.market) : undefined;
      if (group) {
        const arr = buckets.get(group.id) ?? [];
        arr.push(loc);
        buckets.set(group.id, arr);
      } else {
        ungrouped.push(loc);
      }
    });

    const layers: L.Layer[] = [];

    // One cluster layer per group
    groups.forEach(group => {
      const projectsInGroup = buckets.get(group.id) ?? [];
      if (projectsInGroup.length === 0) return;

      const color = group.pin_color;
      const cluster = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (c: any) => L.divIcon({
          className: '',
          html: `<div style="
            width: 28px; height: 28px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 11px; font-weight: 700;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          ">${c.getChildCount()}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      });

      projectsInGroup.forEach(loc => {
        const marker = L.marker([loc.latitude, loc.longitude], { icon: createGroupIcon(color) });
        const popup = `
          <div style="min-width:200px">
            <div style="margin-bottom:8px">
              <a href="/projects/${loc.id}" style="font-size:14px;font-weight:700;color:#1a56db;text-decoration:none">
                ${loc.name}
              </a>
              <div style="font-size:12px;color:#718096">#${loc.number}</div>
            </div>
            <div style="margin-bottom:6px">
              <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;background:${color};color:white">
                ${group.name}
              </span>
            </div>
            ${loc.customer_name ? `<div style="font-size:13px;margin-bottom:4px"><span style="color:#718096">Customer:</span> <span style="font-weight:500">${loc.customer_name}</span></div>` : ''}
            ${loc.ship_city || loc.address ? `<div style="font-size:13px;margin-bottom:4px"><span style="color:#718096">Location:</span> <span style="font-weight:500">${loc.ship_city && loc.ship_state ? `${loc.ship_city}, ${loc.ship_state}` : loc.address}</span></div>` : ''}
            ${loc.contract_value ? `<div style="font-size:13px;margin-bottom:4px"><span style="color:#718096">Contract:</span> <span style="font-weight:600;color:#10b981">${formatCurrency(loc.contract_value)}</span></div>` : ''}
            ${loc.manager_name ? `<div style="font-size:13px"><span style="color:#718096">Manager:</span> <span style="font-weight:500">${loc.manager_name}</span></div>` : ''}
            ${loc.market ? `<div style="font-size:12px;color:#718096;margin-top:6px;font-style:italic">${loc.market}</div>` : ''}
          </div>
        `;
        marker.bindPopup(popup);
        cluster.addLayer(marker);
      });

      map.addLayer(cluster);
      layers.push(cluster);
    });

    // Ungrouped projects shown in gray (only if enabled)
    if (showUngrouped && ungrouped.length > 0) {
      const grayCluster = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (c: any) => L.divIcon({
          className: '',
          html: `<div style="
            width: 28px; height: 28px;
            background: #9ca3af;
            border: 2px solid white;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 11px; font-weight: 700;
            box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          ">${c.getChildCount()}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      });
      ungrouped.forEach(loc => {
        const marker = L.marker([loc.latitude, loc.longitude], { icon: createGroupIcon('#9ca3af') });
        marker.bindPopup(`
          <div style="min-width:180px">
            <a href="/projects/${loc.id}" style="font-size:14px;font-weight:700;color:#1a56db;text-decoration:none">${loc.name}</a>
            <div style="font-size:12px;color:#718096">#${loc.number}</div>
            ${loc.market ? `<div style="font-size:12px;color:#9ca3af;margin-top:4px;font-style:italic">${loc.market}</div>` : ''}
          </div>
        `);
        grayCluster.addLayer(marker);
      });
      map.addLayer(grayCluster);
      layers.push(grayCluster);
    }

    return () => { layers.forEach(l => map.removeLayer(l)); };
  }, [map, locations, groups]);

  return null;
};

export default GroupedProjectMarkers;
