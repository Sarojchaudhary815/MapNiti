import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { Layers } from 'lucide-react';
import buildDrawStyles, { registerPointShapeImages } from '../data-management/components/digitization/drawStyles';
import { makeSnapMode, makeRectangleMode, makeCircleMode } from '../data-management/components/digitization/snapModes';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TERRAIN_TILES = ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'];

// All CORS-friendly / ToS-safe raster sources (no raw Google tile scraping —
// that violates Google's ToS; "hybrid" here is Esri imagery + Esri
// reference labels stacked as two layers, which looks the same to users).
const BASE_LAYERS = {
  satellite: {
    label: 'Satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  },
  hybrid: {
    label: 'Hybrid',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    overlayTiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
  },
  osm: {
    label: 'OSM',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
  },
  terrain: {
    label: 'Terrain',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
  },
  street: {
    label: 'Street (Esri)',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
  },
  // CARTO's basemaps now return "API KEY REQUIRED" tiles, so Light/Dark use
  // Esri's keyless canvas basemaps (same keys kept so saved settings still work).
  positron: {
    label: 'Light Gray (Esri)',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
  },
  darkMatter: {
    label: 'Dark Gray (Esri)',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
  },
  openTopo: {
    label: 'OpenTopoMap',
    tiles: [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
    ],
  },
  none: {
    label: 'None (Blank)',
    blank: true,
  },
};

function formatGeeUrl(url) {
  if (!url) return '';
  return url
    .replace('http://', 'https://')
    .replace(/{X}/g, '{x}')
    .replace(/{Y}/g, '{y}')
    .replace(/{Z}/g, '{z}');
}

const MapWindow = forwardRef(({
  onAreaSelected, rasterData, isPanelOpen, uploadedData, showRaster,
  activeStep, onOutletPlaced, outletCoords, selectedAOI,
  layers, boundaryVisible, trainingSamples, onSamplePlaced, vectorLayers
}, ref) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const outletMarkersRef = useRef([]);
  const sampleMarkersRef = useRef([]);
  const searchMarkerRef = useRef(null);
  const [baseLayer, setBaseLayer] = useState('satellite');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const activeStepRef = useRef(activeStep);
  const onOutletPlacedRef = useRef(onOutletPlaced);
  const onSamplePlacedRef = useRef(onSamplePlaced);
  useEffect(() => { activeStepRef.current = activeStep; }, [activeStep]);
  useEffect(() => { onOutletPlacedRef.current = onOutletPlaced; }, [onOutletPlaced]);
  useEffect(() => { onSamplePlacedRef.current = onSamplePlaced; }, [onSamplePlaced]);

  // Digitization tool support: while active it takes over the shared
  // MapboxDraw instance instead of the AOI-selection flow above.
  const digitizeModeRef = useRef(false);
  const digitizeChangeHandlerRef = useRef(null);
  const digitizeSelectionHandlerRef = useRef(null);
  const digitizeSnapStateRef = useRef({ enabled: true, features: [] });
  const digitizeHistoryRef = useRef([]);
  const digitizeHistoryIndexRef = useRef(-1);
  const digitizeRestoringRef = useRef(false);

  // Re-reads draw.getAll(), forwards it to the panel, and (unless we're
  // mid-undo/redo) records a history snapshot. Every mutation path that
  // doesn't naturally fire a draw.* event (draw.set, setFeatureProperty,
  // combine/uncombine — all silent by MapboxDraw's own design) must call
  // this manually to stay in sync, same as the existing addDigitizeFeatures
  // workaround did before this was generalized.
  const syncDigitize = () => {
    if (!digitizeModeRef.current || !digitizeChangeHandlerRef.current || !drawRef.current) return;
    const snapshot = drawRef.current.getAll();
    digitizeChangeHandlerRef.current(snapshot);
    if (!digitizeRestoringRef.current) {
      const history = digitizeHistoryRef.current.slice(0, digitizeHistoryIndexRef.current + 1);
      history.push(snapshot);
      if (history.length > 50) history.shift();
      digitizeHistoryRef.current = history;
      digitizeHistoryIndexRef.current = history.length - 1;
    }
  };

  const isLocked = !!(rasterData && rasterData.layerId !== 'dem') || !!(layers && layers.length > 0);
  const isLockedRef = useRef(isLocked);
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        sources: {
          base: { type: 'raster', tiles: BASE_LAYERS.satellite.tiles, tileSize: 256 },
          terrainSource: {
            type: 'raster-dem',
            tiles: TERRAIN_TILES,
            tileSize: 256,
            encoding: 'terrarium',
          },
        },
        layers: [
          { id: 'white-bg', type: 'background', paint: { 'background-color': '#ffffff' } },
          { id: 'base-layer', type: 'raster', source: 'base' },
        ],
        terrain: { source: 'terrainSource', exaggeration: 1.3 },
      },
      center: [84.1240, 28.3949],
      zoom: 7,
      pitch: 0,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    let dragging = false;
    let lastX = 0, lastY = 0;
    const container = map.getCanvasContainer();

    const onMouseDown = (e) => {
      if (e.button === 1) {
        e.preventDefault();
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      }
    };
    const onMouseMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      map.setBearing(map.getBearing() - dx * 0.3);
      map.setPitch(Math.max(0, Math.min(85, map.getPitch() - dy * 0.3)));
    };
    const onMouseUp = () => { dragging = false; };
    const onAuxClick = (e) => { if (e.button === 1) e.preventDefault(); };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('auxclick', onAuxClick);

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      userProperties: true,
      styles: buildDrawStyles(),
      modes: {
        ...MapboxDraw.modes,
        snap_point: makeSnapMode(MapboxDraw.modes.draw_point, digitizeSnapStateRef.current),
        snap_line_string: makeSnapMode(MapboxDraw.modes.draw_line_string, digitizeSnapStateRef.current),
        snap_polygon: makeSnapMode(MapboxDraw.modes.draw_polygon, digitizeSnapStateRef.current),
        snap_direct_select: makeSnapMode(MapboxDraw.modes.direct_select, digitizeSnapStateRef.current),
        draw_rectangle: makeRectangleMode(),
        draw_circle: makeCircleMode(),
      },
    });
    map.addControl(draw);
    drawRef.current = draw;

    map.on('draw.create', (e) => {
      // While the Digitization tool owns drawing, a created feature is data
      // to keep — not a transient AOI selection to bbox-and-discard.
      if (digitizeModeRef.current) return;
      const feature = e.features[0];
      const coords = feature.geometry.coordinates[0];
      let west = coords[0][0], east = coords[0][0], south = coords[0][1], north = coords[0][1];
      coords.forEach(([lng, lat]) => {
        if (lng < west) west = lng;
        if (lng > east) east = lng;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
      });
      onAreaSelected({
        bbox: { south, north, west, east },
        geojson: feature,
      });
      draw.deleteAll();
    });

    map.on('draw.create', syncDigitize);
    map.on('draw.update', syncDigitize);
    map.on('draw.delete', syncDigitize);
    map.on('draw.selectionchange', (e) => {
      if (!digitizeModeRef.current) return;
      digitizeSelectionHandlerRef.current?.(e.features || []);
    });

    map.on('click', (e) => {
      if (activeStepRef.current === 'place-outlet') {
        onOutletPlacedRef.current(e.lngLat);
      } else if (activeStepRef.current === 'place-sample') {
        onSamplePlacedRef.current?.(e.lngLat);
      }
    });

    map.on('load', () => {
      setMapReady(true);
      map.resize();
      registerPointShapeImages(map);
    });

    mapRef.current = map;

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('auxclick', onAuxClick);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = mapContainerRef.current;
    const map = mapRef.current;
    if (!el || !map) return;

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(el);

    return () => ro.disconnect();
  }, [mapReady]);

  useImperativeHandle(ref, () => ({
    // JPEG data URL of the current map (base map + result layers + AOI), framed
    // on `bbox` when given. Used for published articles and PDF reports. Every
    // tile source here sends CORS headers, so the canvas is never "tainted".
    // The picture is cropped to `aspect` (width / height, 4:3 by default) around
    // the map centre, and the AOI is framed inside that crop.
    snapshot: ({ bbox, maxWidth = 1400, quality = 0.85, aspect = 4 / 3 } = {}) => new Promise((resolve) => {
      const map = mapRef.current;
      if (!map) return resolve(null);
      const box = map.getContainer().getBoundingClientRect();
      const cropH = Math.min(box.height, box.width / aspect);
      const cropW = Math.min(box.width, box.height * aspect);
      const capture = () => {
        map.once('render', () => {
          try {
            const src = map.getCanvas();
            const k = src.width / box.width; // device pixels per CSS pixel
            const sw = cropW * k;
            const sh = cropH * k;
            const scale = Math.min(1, maxWidth / sw);
            const out = document.createElement('canvas');
            out.width = Math.round(sw * scale);
            out.height = Math.round(sh * scale);
            out.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, out.width, out.height);
            resolve(out.toDataURL('image/jpeg', quality));
          } catch (err) {
            console.warn('Map snapshot failed:', err);
            resolve(null);
          }
        });
        map.triggerRepaint();
      };
      if (bbox) {
        const padV = 40 + (box.height - cropH) / 2;
        const padH = 40 + (box.width - cropW) / 2;
        map.fitBounds([[bbox.west, bbox.south], [bbox.east, bbox.north]],
          { padding: { top: padV, bottom: padV, left: padH, right: padH }, duration: 0 });
        let done = false;
        const go = () => { if (!done) { done = true; capture(); } };
        map.once('idle', go);
        setTimeout(go, 8000); // tiles still loading after 8 s: take what is there
      } else {
        capture();
      }
      return undefined;
    }),
    startDrawing: () => {
      if (drawRef.current && !isLockedRef.current) {
        drawRef.current.deleteAll();
        drawRef.current.changeMode('draw_polygon');
      }
    },
    flyTo: (lng, lat, zoom = 14) => {
      const map = mapRef.current;
      if (!map) return;

      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
        searchMarkerRef.current = null;
      }

      const el = document.createElement('div');
      el.style.cssText =
        'background:#2563eb;width:16px;height:16px;border-radius:50% 50% 50% 0;' +
        'transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);';
      searchMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);

      map.flyTo({ center: [lng, lat], zoom, duration: 1500 });
    },

    // --- Native MapLibre passthroughs ---
    // Sibling tool components (e.g. FloodHazardMapping) are handed this
    // same ref and call native map methods directly on it (mapRef.current
    // .addSource/.getLayer/etc) — forward them to the real map instance,
    // called as methods on `map` so `this` binds correctly inside MapLibre.
    getSource: (...args) => mapRef.current?.getSource(...args),
    addSource: (...args) => mapRef.current?.addSource(...args),
    removeSource: (...args) => mapRef.current?.removeSource(...args),
    getLayer: (...args) => mapRef.current?.getLayer(...args),
    addLayer: (...args) => mapRef.current?.addLayer(...args),
    removeLayer: (...args) => mapRef.current?.removeLayer(...args),
    setLayoutProperty: (...args) => mapRef.current?.setLayoutProperty(...args),
    setPaintProperty: (...args) => mapRef.current?.setPaintProperty(...args),
    getStyle: (...args) => mapRef.current?.getStyle(...args),
    getCanvas: (...args) => mapRef.current?.getCanvas(...args),
    fitBounds: (...args) => mapRef.current?.fitBounds(...args),

    // --- Digitization tool API (shared MapboxDraw instance) ---
    setDigitizeMode: (active) => { digitizeModeRef.current = active; },
    setDigitizeChangeHandler: (handler) => { digitizeChangeHandlerRef.current = handler; },
    setDigitizeSelectionHandler: (handler) => { digitizeSelectionHandlerRef.current = handler; },
    startDigitizeDraw: (mode) => { drawRef.current?.changeMode(mode || 'simple_select'); },
    deleteDigitizeSelected: () => { drawRef.current?.trash(); },
    deleteDigitizeFeature: (id) => {
      // draw.delete() (unlike interactive trash) is silent — resync manually.
      drawRef.current?.delete(id);
      syncDigitize();
    },
    addDigitizeFeatures: (geojson) => {
      // draw.add() is silent (no draw.create event), unlike interactive
      // drawing — notify the change handler manually so upload/re-show
      // (toggling a hidden layer back on) stay in sync with React state.
      const result = drawRef.current?.add(geojson);
      syncDigitize();
      return result;
    },
    getDigitizeGeoJSON: () => drawRef.current?.getAll(),
    clearDigitize: () => {
      drawRef.current?.deleteAll();
      digitizeHistoryRef.current = [];
      digitizeHistoryIndexRef.current = -1;
    },

    // --- Symbology / attributes ---
    setFeatureProperty: (id, key, value) => {
      drawRef.current?.setFeatureProperty(id, key, value);
      syncDigitize();
    },
    // Sets several properties in one go (e.g. tagging a freshly-created
    // feature with layerId + color + width + ...) so only one syncDigitize
    // (and therefore one re-entrant handleDigitizeChange call) happens
    // instead of one per property.
    setFeatureProperties: (id, props) => {
      if (drawRef.current) {
        Object.entries(props).forEach(([key, value]) => drawRef.current.setFeatureProperty(id, key, value));
      }
      syncDigitize();
    },
    // Same as setFeatureProperties but for many features at once (e.g.
    // tagging every feature from a big upload) — a single syncDigitize at
    // the end instead of one per feature, so large datasets don't trigger
    // hundreds/thousands of redundant re-renders.
    setManyFeatureProperties: (entries) => {
      if (drawRef.current) {
        entries.forEach(([id, props]) => {
          Object.entries(props).forEach(([key, value]) => drawRef.current.setFeatureProperty(id, key, value));
        });
      }
      syncDigitize();
    },

    // --- Snapping ---
    setSnapFeatures: (features) => { digitizeSnapStateRef.current.features = features || []; },
    setSnappingEnabled: (enabled) => { digitizeSnapStateRef.current.enabled = enabled; },

    // --- Undo / redo ---
    canUndoDigitize: () => digitizeHistoryIndexRef.current > 0,
    canRedoDigitize: () => digitizeHistoryIndexRef.current < digitizeHistoryRef.current.length - 1,
    undoDigitize: () => {
      const idx = digitizeHistoryIndexRef.current;
      if (idx <= 0 || !drawRef.current) return;
      digitizeRestoringRef.current = true;
      digitizeHistoryIndexRef.current = idx - 1;
      drawRef.current.changeMode('simple_select');
      drawRef.current.set(digitizeHistoryRef.current[idx - 1]);
      digitizeRestoringRef.current = false;
      digitizeChangeHandlerRef.current?.(drawRef.current.getAll());
    },
    redoDigitize: () => {
      const idx = digitizeHistoryIndexRef.current;
      if (idx >= digitizeHistoryRef.current.length - 1 || !drawRef.current) return;
      digitizeRestoringRef.current = true;
      digitizeHistoryIndexRef.current = idx + 1;
      drawRef.current.changeMode('simple_select');
      drawRef.current.set(digitizeHistoryRef.current[idx + 1]);
      digitizeRestoringRef.current = false;
      digitizeChangeHandlerRef.current?.(drawRef.current.getAll());
    },

    // --- Merge / split geometries (Draw's native combine/uncombine) ---
    combineDigitizeSelected: () => { drawRef.current?.combineFeatures(); syncDigitize(); },
    uncombineDigitizeSelected: () => { drawRef.current?.uncombineFeatures(); syncDigitize(); },
  }));

  // Base layer switching — handles the "hybrid" case (imagery + reference
  // labels overlay) by adding/removing a second raster layer on top of base.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const config = BASE_LAYERS[baseLayer] || BASE_LAYERS.satellite;

    if (config.blank) {
      if (map.getLayer('base-layer')) map.setLayoutProperty('base-layer', 'visibility', 'none');
    } else {
      if (map.getLayer('base-layer')) map.setLayoutProperty('base-layer', 'visibility', 'visible');
      if (map.getSource('base')) map.getSource('base').setTiles(config.tiles);
    }

    const overlayId = 'base-hybrid-overlay';
    if (!config.blank && config.overlayTiles) {
      if (map.getSource(overlayId)) {
        map.getSource(overlayId).setTiles(config.overlayTiles);
      } else {
        map.addSource(overlayId, { type: 'raster', tiles: config.overlayTiles, tileSize: 256 });
        map.addLayer({ id: overlayId, type: 'raster', source: overlayId });
      }
    } else {
      if (map.getLayer(overlayId)) map.removeLayer(overlayId);
      if (map.getSource(overlayId)) map.removeSource(overlayId);
    }
  }, [baseLayer, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => map.resize(), 400);
    return () => clearTimeout(t);
  }, [isPanelOpen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const desired = (layers || []).filter((l) => l.visual_url);
    const desiredIds = desired.map((l) => `data-${l.layerId}`);

    const style = map.getStyle();
    if (style && style.layers) {
      style.layers.forEach((l) => {
        if (l.id.startsWith('data-') && !desiredIds.includes(l.id)) {
          if (map.getLayer(l.id)) map.removeLayer(l.id);
          if (map.getSource(l.id)) map.removeSource(l.id);
        }
      });
    }

    if (desired.length === 0 && showRaster && rasterData?.visual_url) {
      const id = 'data-legacy';
      const url = formatGeeUrl(rasterData.visual_url);
      try {
        if (map.getSource(id)) {
          map.getSource(id).setTiles([url]);
        } else {
          map.addSource(id, { type: 'raster', tiles: [url], tileSize: 256 });
          map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': 1.0 } });
        }
      } catch (err) {
        console.warn(`Could not render raster layer "${id}":`, err);
      }
    } else if (!showRaster || desired.length > 0) {
      if (map.getLayer('data-legacy')) map.removeLayer('data-legacy');
      if (map.getSource('data-legacy')) map.removeSource('data-legacy');
    }

    desired.forEach((layer) => {
      const id = `data-${layer.layerId}`;
      const url = formatGeeUrl(layer.visual_url);
      try {
        if (map.getSource(id)) {
          map.getSource(id).setTiles([url]);
          if (map.getLayer(id)) map.setPaintProperty(id, 'raster-opacity', layer.opacity ?? 1.0);
        } else {
          map.addSource(id, { type: 'raster', tiles: [url], tileSize: 256 });
          map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-opacity': layer.opacity ?? 1.0 } });
        }
      } catch (err) {
        console.warn(`Could not render raster layer "${id}":`, err);
      }
    });
  }, [layers, rasterData, showRaster, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const geojson = uploadedData?.geojson || selectedAOI?.geojson;
    const sourceId = 'boundary-source';

    if (!geojson || boundaryVisible === false) {
      if (map.getLayer('boundary-fill')) map.removeLayer('boundary-fill');
      if (map.getLayer('boundary-line')) map.removeLayer('boundary-line');
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }

    const color = isLocked ? '#64748b' : '#2563eb';

    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(geojson);
      if (map.getLayer('boundary-fill')) map.setPaintProperty('boundary-fill', 'fill-color', color);
      if (map.getLayer('boundary-line')) map.setPaintProperty('boundary-line', 'line-color', color);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'boundary-fill', type: 'fill', source: sourceId,
        paint: { 'fill-color': color, 'fill-opacity': isLocked ? 0 : 0.1 },
      });
      map.addLayer({
        id: 'boundary-line', type: 'line', source: sourceId,
        paint: { 'line-color': color, 'line-width': 2 },
      });
    }

    try {
      // Walk any nesting depth so Polygon and MultiPolygon (e.g. palika
      // boundaries) both zoom correctly.
      const bounds = new maplibregl.LngLatBounds();
      const walk = (c) => (typeof c[0] === 'number' ? bounds.extend([c[0], c[1]]) : c.forEach(walk));
      walk((geojson.geometry || geojson).coordinates);
      map.fitBounds(bounds, { padding: 60, duration: 1200 });
    } catch (e) {
      // ignore invalid geometry
    }
  }, [uploadedData, selectedAOI, boundaryVisible, isLocked, mapReady]);

  // GeoJSON overlays from analysis tools (roads, rivers, earthquakes,
  // contours, measurements…). Each entry: {id, type: line|fill|circle, data,
  // color | colorProp, width | widthProp, radiusProp, opacity}.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const desired = vectorLayers || [];
    const wanted = new Set(desired.map((v) => `vec-${v.id}`));
    const style = map.getStyle();
    (style?.layers || []).forEach((l) => {
      if (l.id.startsWith('vec-') && !wanted.has(l.id.replace(/-outline$/, ''))) map.removeLayer(l.id);
    });
    Object.keys(style?.sources || {}).forEach((sid) => {
      if (sid.startsWith('vec-') && !wanted.has(sid)) map.removeSource(sid);
    });

    desired.forEach((v) => {
      const id = `vec-${v.id}`;
      const color = v.colorProp ? ['coalesce', ['get', v.colorProp], v.color || '#0ea5e9'] : (v.color || '#0ea5e9');
      if (map.getSource(id)) {
        map.getSource(id).setData(v.data);
        return;
      }
      map.addSource(id, { type: 'geojson', data: v.data });
      if (v.type === 'fill') {
        map.addLayer({ id, type: 'fill', source: id, paint: { 'fill-color': color, 'fill-opacity': v.opacity ?? 0.3 } });
        map.addLayer({ id: `${id}-outline`, type: 'line', source: id, paint: { 'line-color': color, 'line-width': 1.5 } });
      } else if (v.type === 'circle') {
        map.addLayer({
          id, type: 'circle', source: id,
          paint: {
            'circle-color': color,
            'circle-radius': v.radiusProp ? ['coalesce', ['get', v.radiusProp], 5] : (v.radius || 5),
            'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1, 'circle-opacity': v.opacity ?? 0.9,
          },
        });
      } else {
        map.addLayer({
          id, type: 'line', source: id,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': color,
            'line-width': v.widthProp ? ['coalesce', ['get', v.widthProp], 2] : (v.width || 2),
            'line-opacity': v.opacity ?? 1,
            ...(v.dashed ? { 'line-dasharray': [2, 2] } : {}),
          },
        });
      }
      map.on('click', id, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const rows = Object.entries(f.properties || {})
          .filter(([k, val]) => !['color', 'width', 'radius'].includes(k) && val !== '' && val !== null && val !== 'null')
          .slice(0, 10)
          .map(([k, val]) => `<tr><td style="color:#64748b;padding-right:8px">${escapeHtml(k)}</td><td style="font-weight:600">${escapeHtml(String(val).slice(0, 60))}</td></tr>`)
          .join('');
        new maplibregl.Popup({ maxWidth: '280px' })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-size:11px"><b>${escapeHtml(v.name || v.id)}</b><table>${rows}</table></div>`)
          .addTo(map);
      });
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    });

    const first = desired.find((v) => v.fit);
    if (first) {
      try {
        const b = new maplibregl.LngLatBounds();
        const walk = (c) => (typeof c[0] === 'number' ? b.extend(c) : c.forEach(walk));
        const feats = first.data.type === 'FeatureCollection' ? first.data.features : [first.data];
        feats.forEach((f) => f.geometry && walk(f.geometry.coordinates));
        if (!b.isEmpty()) map.fitBounds(b, { padding: 60, duration: 800, maxZoom: 16 });
      } catch (e) {
        // ignore bad geometry
      }
    }
  }, [vectorLayers, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    outletMarkersRef.current.forEach((m) => m.remove());
    outletMarkersRef.current = [];

    (outletCoords || []).forEach((coord, i) => {
      const el = document.createElement('div');
      el.style.cssText =
        'background:#f43f5e;width:18px;height:18px;border-radius:50%;border:2px solid white;' +
        'display:flex;align-items:center;justify-content:center;color:white;font-size:10px;' +
        'font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.3);';
      el.textContent = String(i + 1);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([coord.lng, coord.lat])
        .addTo(map);
      outletMarkersRef.current.push(marker);
    });
  }, [outletCoords, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    sampleMarkersRef.current.forEach((m) => m.remove());
    sampleMarkersRef.current = [];

    (trainingSamples || []).forEach((sample) => {
      const el = document.createElement('div');
      el.style.cssText =
        `background:${sample.color || '#e6194b'};width:14px;height:14px;border-radius:50%;` +
        'border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);';
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([sample.lng, sample.lat])
        .addTo(map);
      sampleMarkersRef.current.push(marker);
    });
  }, [trainingSamples, mapReady]);

  return (
    <div className="w-full h-full relative bg-[#f8fafc]" style={{ width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} className="absolute inset-0" style={{ position: 'absolute', inset: 0 }} />

      {/* Base layer picker: single icon button, options appear only on click */}
      <div className="absolute bottom-6 right-16 z-10">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="w-9 h-9 flex items-center justify-center bg-white rounded-xl shadow-lg border border-slate-100 text-slate-600 hover:bg-slate-50"
          title="Change base map"
        >
          <Layers size={16} />
        </button>

        {pickerOpen && (
          <div className="absolute bottom-11 right-0 bg-white rounded-xl shadow-lg border border-slate-100 overflow-y-auto flex flex-col text-[10px] font-black uppercase min-w-[130px] max-h-64">
            {Object.entries(BASE_LAYERS).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => { setBaseLayer(key); setPickerOpen(false); }}
                className={`px-3 py-2 text-left ${baseLayer === key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default MapWindow;