import { useEffect, useState, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const GEOJSON_URL = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

let cachedGeoJSON: any = null;

const USBoundaryMask: React.FC = () => {
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

  useEffect(() => {
    if (!geoJSON) return;

    // Set white background so areas outside tiles also show white
    map.getContainer().style.background = '#ffffff';

    // Use Canvas renderer so html2canvas can capture it (SVG paths fail in html2canvas)
    if (!rendererRef.current) {
      rendererRef.current = L.canvas({ padding: 1 });
    }

    // World outer ring — extend well beyond ±180 to cover wrapped tiles
    const worldOuter: L.LatLngExpression[] = [
      [-90, -360], [90, -360], [90, 360], [-90, 360],
    ];

    // Collect every US state polygon boundary as a hole
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

  return null;
};

export default USBoundaryMask;
