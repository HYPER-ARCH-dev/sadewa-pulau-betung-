import * as L from 'leaflet';

declare module '@maplibre/maplibre-gl-leaflet' {
  // Side-effect plugin registers L.maplibreGL / L.MaplibreGL
}

declare module 'leaflet' {
  interface MaplibreGLOptions extends L.LayerOptions {
    style: string | Record<string, unknown>;
    interactive?: boolean;
    attribution?: string;
    preserveDrawingBuffer?: boolean;
  }

  interface MaplibreGLLayer extends L.Layer {
    getMaplibreMap(): unknown;
    setStyle(style: string | Record<string, unknown>): this;
  }

  function maplibreGL(options: MaplibreGLOptions): MaplibreGLLayer;
}
