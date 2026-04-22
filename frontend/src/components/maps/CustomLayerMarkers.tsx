import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { CustomMapPin } from '../../services/customMapLayers';

interface CustomLayerMarkersProps {
  pins: CustomMapPin[];
  color: string;
  layerName: string;
}

function createSmallIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 10px; height: 10px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -7],
  });
}

const CustomLayerMarkers: React.FC<CustomLayerMarkersProps> = ({ pins, color, layerName }) => {
  const map = useMap();

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 35,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (clusterObj: any) => {
        const count = clusterObj.getChildCount();
        return L.divIcon({
          className: '',
          html: `<div style="
            width: 24px; height: 24px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            color: white;
            font-size: 10px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          ">${count}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      },
    });

    const validPins = pins.filter(p => p.latitude && p.longitude);
    validPins.forEach((pin) => {
      const marker = L.marker([pin.latitude!, pin.longitude!], {
        icon: createSmallIcon(color),
      });

      const addressParts = [pin.address, pin.city, pin.state, pin.zip_code].filter(Boolean);
      const popupContent = `
        <div style="min-width:160px">
          <div style="font-size:13px;font-weight:600;color:#1e293b;margin-bottom:4px">${pin.name}</div>
          <div style="font-size:11px;color:${color};font-weight:500;margin-bottom:4px">${layerName}</div>
          ${pin.category ? `<div style="font-size:12px;color:#64748b;margin-bottom:2px">${pin.category}</div>` : ''}
          ${addressParts.length > 0 ? `<div style="font-size:12px;color:#94a3b8">${addressParts.join(', ')}</div>` : ''}
          ${pin.notes ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px;font-style:italic">${pin.notes}</div>` : ''}
        </div>
      `;
      marker.bindPopup(popupContent);
      cluster.addLayer(marker);
    });

    map.addLayer(cluster);
    return () => { map.removeLayer(cluster); };
  }, [map, pins, color, layerName]);

  return null;
};

export default CustomLayerMarkers;
