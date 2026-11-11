import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const GEOJSON_URL = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

let cachedGeoJSON: any = null;

const STATE_NAME: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

interface Props {
  /** State abbreviations (e.g. "WI") that have pins. When provided, states not in this set are grayed out. */
  activePinStates?: Set<string>;
}

const USBoundaryMask: React.FC<Props> = ({ activePinStates }) => {
  const map = useMap();
  const [geoJSON, setGeoJSON] = useState<any>(cachedGeoJSON);
  const rendererRef = useRef<L.Canvas | null>(null);

  useEffect(() => {
    if (cachedGeoJSON) return;
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(data => {
        cachedGeoJSON = data;
        setGeoJSON(data);
      })
      .catch(err => console.error('Failed to load US boundaries:', err));
  }, []);

  // Outer white mask — covers everything outside the US boundary
  useEffect(() => {
    if (!geoJSON) return;

    map.getContainer().style.background = '#ffffff';

    if (!rendererRef.current) {
      rendererRef.current = L.canvas({ padding: 1 });
    }

    const worldOuter: L.LatLngExpression[] = [
      [-90, -360], [90, -360], [90, 360], [-90, 360],
    ];

    const holes: L.LatLngExpression[][] = [];
    for (const feature of geoJSON.features) {
      const { type, coordinates } = feature.geometry;
      if (type === 'Polygon') {
        holes.push(
          coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression)
        );
      } else if (type === 'MultiPolygon') {
        for (const polygon of coordinates) {
          holes.push(
            polygon[0].map(([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression)
          );
        }
      }
    }

    const mask = L.polygon([worldOuter, ...holes], {
      fillColor: '#ffffff',
      fillOpacity: 1,
      color: '#94a3b8',
      weight: 1.5,
      interactive: false,
      renderer: rendererRef.current,
    });

    map.addLayer(mask);
    return () => { map.removeLayer(mask); };
  }, [map, geoJSON]);

  // Gray overlay for states without pins (only when activePinStates is provided)
  useEffect(() => {
    if (!geoJSON || !activePinStates) return;

    if (!rendererRef.current) {
      rendererRef.current = L.canvas({ padding: 1 });
    }

    const activeNames = new Set<string>();
    activePinStates.forEach(abbrev => {
      const name = STATE_NAME[abbrev.toUpperCase()];
      if (name) activeNames.add(name);
    });

    const grayLayers: L.Layer[] = [];

    for (const feature of geoJSON.features) {
      const stateName: string = feature.properties?.name ?? '';
      if (activeNames.has(stateName)) continue;

      const { type, coordinates } = feature.geometry;
      const rings: L.LatLngExpression[][] = [];

      if (type === 'Polygon') {
        rings.push(
          coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression)
        );
      } else if (type === 'MultiPolygon') {
        for (const polygon of coordinates) {
          rings.push(
            polygon[0].map(([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression)
          );
        }
      }

      for (const ring of rings) {
        const grayPoly = L.polygon(ring, {
          fillColor: '#d1d5db',
          fillOpacity: 0.88,
          color: '#9ca3af',
          weight: 0.5,
          interactive: false,
          renderer: rendererRef.current,
        });
        map.addLayer(grayPoly);
        grayLayers.push(grayPoly);
      }
    }

    return () => { grayLayers.forEach(l => map.removeLayer(l)); };
  }, [map, geoJSON, activePinStates]);

  return null;
};

export default USBoundaryMask;
