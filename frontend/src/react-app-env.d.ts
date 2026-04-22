/// <reference types="react-scripts" />

declare module 'leaflet.markercluster' {
  // augments the L namespace from @types/leaflet
}

declare namespace L {
  function markerClusterGroup(options?: any): any;
}
