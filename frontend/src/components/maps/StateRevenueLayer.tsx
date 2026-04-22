import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface StateRevenueData {
  [stateAbbr: string]: { revenue: number; count: number };
}

interface StateRevenueLayerProps {
  stateData: StateRevenueData;
}

const GEOJSON_URL = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

const formatCurrency = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

function getColor(revenue: number, maxRevenue: number): string {
  if (maxRevenue === 0 || revenue === 0) return '#f1f5f9';
  const ratio = revenue / maxRevenue;
  // 5-step green scale
  if (ratio > 0.75) return '#166534';
  if (ratio > 0.5) return '#16a34a';
  if (ratio > 0.25) return '#4ade80';
  if (ratio > 0.05) return '#bbf7d0';
  return '#dcfce7';
}

let cachedGeoJSON: any = null;

const StateRevenueLayer: React.FC<StateRevenueLayerProps> = ({ stateData }) => {
  const map = useMap();
  const [geoJSON, setGeoJSON] = useState<any>(cachedGeoJSON);

  useEffect(() => {
    if (cachedGeoJSON) return;
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(data => {
        cachedGeoJSON = data;
        setGeoJSON(data);
      })
      .catch(err => console.error('Failed to load state boundaries:', err));
  }, []);

  useEffect(() => {
    if (!geoJSON) return;

    const maxRevenue = Math.max(...Object.values(stateData).map(d => d.revenue), 1);

    // Map GeoJSON state names to abbreviations
    const nameToAbbr: Record<string, string> = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
      'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
      'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
      'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
      'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
      'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
      'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
      'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
      'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
      'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
      'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
      'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
      'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
    };

    const labels: L.Marker[] = [];

    const layer = L.geoJSON(geoJSON, {
      style: (feature) => {
        const stateName = feature?.properties?.name || '';
        const abbr = nameToAbbr[stateName] || '';
        const data = stateData[abbr];
        const revenue = data?.revenue || 0;
        return {
          fillColor: getColor(revenue, maxRevenue),
          weight: 1,
          opacity: 1,
          color: '#94a3b8',
          fillOpacity: revenue > 0 ? 0.7 : 0.2,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const stateName = feature?.properties?.name || '';
        const abbr = nameToAbbr[stateName] || '';
        const data = stateData[abbr];
        if (data && data.revenue > 0) {
          featureLayer.bindPopup(`
            <div style="min-width:140px">
              <div style="font-size:14px;font-weight:700;color:#1e293b;margin-bottom:4px">${stateName}</div>
              <div style="font-size:13px;color:#16a34a;font-weight:600">${formatCurrency(data.revenue)}</div>
              <div style="font-size:12px;color:#64748b">${data.count} project${data.count !== 1 ? 's' : ''}</div>
            </div>
          `);
          featureLayer.on('mouseover', (e: any) => {
            e.target.setStyle({ weight: 2, color: '#1e293b', fillOpacity: 0.85 });
          });
          featureLayer.on('mouseout', (e: any) => {
            layer.resetStyle(e.target);
          });

          // Add a label at the center of the state
          const bounds = (featureLayer as any).getBounds?.();
          if (bounds) {
            const center = bounds.getCenter();
            const label = L.marker(center, {
              icon: L.divIcon({
                className: '',
                html: `<div style="
                  text-align:center;
                  white-space:nowrap;
                  pointer-events:none;
                ">
                  <div style="font-size:11px;font-weight:700;color:#1e293b;text-shadow:0 0 3px white,0 0 3px white">${data.count} proj</div>
                  <div style="font-size:10px;font-weight:600;color:#166534;text-shadow:0 0 3px white,0 0 3px white">${formatCurrency(data.revenue)}</div>
                </div>`,
                iconSize: [70, 30],
                iconAnchor: [35, 15],
              }),
              interactive: false,
            });
            labels.push(label);
          }
        }
      },
    });

    map.addLayer(layer);
    labels.forEach(l => map.addLayer(l));
    return () => {
      map.removeLayer(layer);
      labels.forEach(l => map.removeLayer(l));
    };
  }, [map, geoJSON, stateData]);

  return null;
};

export default StateRevenueLayer;
