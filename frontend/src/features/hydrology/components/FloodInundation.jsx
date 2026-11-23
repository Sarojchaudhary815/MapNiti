import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import * as turf from '@turf/turf';
import {
  Waves, Play, Loader2, CheckCircle2, Info, AlertCircle, Pencil, Upload,
  RotateCcw, History, ChevronDown, Save, Mountain, Layers, TrendingUp, Gauge,
  Building2, Route, Download, Home, ShieldAlert, Box, FileUp, Grid3x3, Wind,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, ReferenceDot,
} from 'recharts';
import { saveResult, listResults } from '../../../api/projectApi';

import { API_BASE_URL } from '../../../config';
const DEFAULT_FLOOD_COLOR = '#2563eb';
const ROADS_SOURCE_ID = 'impact-roads-source';
const ROADS_LAYER_ID = 'impact-roads-line';
const BUILDINGS_3D_SOURCE_ID = 'impact-buildings-3d-source';
const BUILDINGS_3D_LAYER_ID = 'impact-buildings-3d-fill';
const UPLOADED_3D_SOURCE_ID = 'impact-uploaded-buildings-3d-source';
const UPLOADED_3D_LAYER_ID = 'impact-uploaded-buildings-3d-fill';
const FLOOD_SIM_SOURCE_ID = 'impact-flood-sim-source';
const FLOOD_SIM_LAYER_ID = 'impact-flood-sim-raster';
const FLOOD_SIM_FRAME_MS = 450; // time each depth frame stays on screen
const MESH_SOURCE_ID = 'impact-mesh-source';
const MESH_LAYER_ID = 'impact-mesh-line';
const WATER_FLOW_SOURCE_ID = 'impact-water-flow-source';
const WATER_FLOW_LAYER_ID = 'impact-water-flow-circle';
const WATER_FLOW_DRIFT_KM = 0.05; // how far each particle travels downstream before looping — kept small so it stays within the flooded area
const WATER_FLOW_TRAVERSAL_SECONDS = 3; // time for one particle to complete a drift cycle

// Common property names used for building height in real-world GeoJSON exports (OSM, municipal surveys, etc.)
const HEIGHT_PROPERTY_CANDIDATES = ['height', 'Height', 'HEIGHT', 'height_m', 'building_height', 'bldg_height', 'ht'];
const DEFAULT_UPLOADED_HEIGHT_M = 6; // fallback when no height attribute is found, so extrusion still renders something reasonable

export default function FloodInundation({ selectedAOI, setSelectedAOI, onStartDrawing, projectInfo, setMapLayers, setBoundaryVisible, mapRef }) {
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState(null);

  const [hand, setHand] = useState(null); // { channel_properties }
  const [channel, setChannel] = useState({ manning_n: 0.035, bed_slope_percent: 1, reach_length_km: 1, max_stage_m: 5 });
  const [demSource, setDemSource] = useState('SRTM');

  const [curve, setCurve] = useState(null);
  const [designQ, setDesignQ] = useState('');
  const [runoffResults, setRunoffResults] = useState([]);
  const [showRunoffPicker, setShowRunoffPicker] = useState(false);

  const [inundation, setInundation] = useState(null); // { stats }
  const [runTimestamp, setRunTimestamp] = useState(null);
  const [layers, setLayers] = useState([]);
  const urlStorage = useRef({});
  const downloadUrlStorage = useRef({});

  const [buildingsInfo, setBuildingsInfo] = useState(null); // { building_count, building_count_capped }
  const [roadsInfo, setRoadsInfo] = useState(null); // { road_count, road_count_truncated }
  const [roadsVisible, setRoadsVisible] = useState(true);
  const [impact, setImpact] = useState(null); // { summary, affected_buildings, affected_buildings_truncated, all_buildings_download_url }
  const [showAffectedList, setShowAffectedList] = useState(false);

  const [uploadedBuildings, setUploadedBuildings] = useState(null); // GeoJSON FeatureCollection, height normalized
  const [uploadedImpact, setUploadedImpact] = useState(null); // { summary, geojson } from /impact/uploaded-buildings
  const [show3D, setShow3D] = useState(false);
  const [meshVisible, setMeshVisible] = useState(false);
  const buildingsFileInputRef = useRef(null);
  const floodSimIntervalRef = useRef(null);
  const [floodSimFrames, setFloodSimFrames] = useState(null);
  const [floodSimPlaying, setFloodSimPlaying] = useState(false);
  const [floodSimStage, setFloodSimStage] = useState(null);
  const [floodSimLegend, setFloodSimLegend] = useState(null);
  const waterFlowAnimationFrameRef = useRef(null);
  const waterFlowDataRef = useRef(null); // { points, bearingDeg } cached so replay doesn't refetch
  const [waterFlowPlaying, setWaterFlowPlaying] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [showSavedList, setShowSavedList] = useState(false);
  const [savedResults, setSavedResults] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const visible = layers
      .filter((l) => l.visible && urlStorage.current[l.id])
      .map((l) => ({ layerId: l.id, visual_url: urlStorage.current[l.id] }));
    setMapLayers(visible);
  }, [layers, setMapLayers]);

  const addLayer = (id, name) => {
    setLayers((prev) => (prev.find((l) => l.id === id) ? prev : [...prev, { id, name, visible: true }]));
  };
  const toggleLayer = (id) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };
  const handleDownloadLayer = (id) => {
    const url = downloadUrlStorage.current[id];
    if (url) window.open(url, '_blank');
  };

  const describeError = (err, fallback) => {
    const serverMsg = err.response?.data?.message || err.response?.data?.detail;
    return serverMsg || (err.response?.status ? `Request failed (status ${err.response.status}).` : fallback);
  };

  const handleUploadBoundary = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        let geometry;
        if (parsed.type === 'FeatureCollection') geometry = parsed.features[0];
        else if (parsed.type === 'Feature') geometry = parsed;
        else geometry = { type: 'Feature', properties: {}, geometry: parsed };

        const coords = geometry.geometry.coordinates[0];
        let west = coords[0][0], east = coords[0][0], south = coords[0][1], north = coords[0][1];
        coords.forEach(([lng, lat]) => {
          if (lng < west) west = lng;
          if (lng > east) east = lng;
          if (lat < south) south = lat;
          if (lat > north) north = lat;
        });
        setError(null);
        setSelectedAOI({ bbox: { south, north, west, east }, geojson: geometry });
      } catch (err) {
        console.error('Failed to parse uploaded boundary file:', err);
        setError('Could not read that file. Please upload a valid GeoJSON boundary.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadBoundary = () => {
    if (!selectedAOI?.geojson) return;
    const blob = new Blob([JSON.stringify(selectedAOI.geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-area-boundary-${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleComputeHand = async () => {
    if (!selectedAOI) return;
    setLoading(true);
    setLoadingStage('hand');
    setError(null);
    setIsSaved(false);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/ras/hand`, {
        geometry: selectedAOI.geojson,
        dem_source: demSource,
      });
      if (response.data.status === 'success') {
        const layer = response.data.layers[0];
        urlStorage.current[layer.layerId] = layer.visual_url;
        downloadUrlStorage.current[layer.layerId] = layer.download_url;
        addLayer(layer.layerId, layer.name);
        setHand(response.data.channel_properties);
        setChannel({
          manning_n: response.data.channel_properties.manning_n,
          bed_slope_percent: response.data.channel_properties.bed_slope_percent,
          reach_length_km: response.data.channel_properties.reach_length_km,
          max_stage_m: response.data.channel_properties.suggested_max_stage_m,
        });
      } else {
        setError(response.data.message || 'Could not compute HAND.');
      }
    } catch (err) {
      console.error('HAND error:', err);
      setError(describeError(err, 'Could not compute HAND. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleBuildCurve = async () => {
    setLoading(true);
    setLoadingStage('curve');
    setError(null);
    setIsSaved(false);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/ras/rating-curve`, {
        geometry: selectedAOI.geojson,
        dem_source: demSource,
        manning_n: channel.manning_n,
        bed_slope_percent: channel.bed_slope_percent,
        reach_length_km: channel.reach_length_km,
        max_stage_m: channel.max_stage_m,
      });
      if (response.data.status === 'success') {
        setCurve(response.data.curve);
      } else {
        setError(response.data.message || 'Could not build the rating curve.');
      }
    } catch (err) {
      console.error('Rating curve error:', err);
      setError(describeError(err, 'Could not build the rating curve. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleOpenRunoffPicker = async () => {
    if (!showRunoffPicker && projectInfo?.id) {
      try {
        const results = await listResults(projectInfo.id);
        setRunoffResults(results.filter((r) => r.module === 'hydrology' && r.tool_type === 'runoff'));
      } catch (err) {
        console.error('Could not load runoff analyses:', err);
      }
    }
    setShowRunoffPicker(!showRunoffPicker);
  };

  const handlePickRunoff = (r) => {
    const peak = r.result_data?.result?.results?.peak_discharge_cms;
    if (peak) setDesignQ(String(peak));
    setShowRunoffPicker(false);
  };

  const handleRunInundation = async () => {
    if (!curve || !designQ) return;
    setLoading(true);
    setLoadingStage('inundate');
    setError(null);
    setIsSaved(false);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/ras/inundate`, {
        geometry: selectedAOI.geojson,
        dem_source: demSource,
        curve,
        design_discharge_cms: parseFloat(designQ),
        flood_color: DEFAULT_FLOOD_COLOR,
      });
      if (response.data.status === 'success') {
        response.data.layers.forEach((layer) => {
          urlStorage.current[layer.layerId] = layer.visual_url;
          downloadUrlStorage.current[layer.layerId] = layer.download_url;
          addLayer(layer.layerId, layer.name);
        });
        setInundation({ stats: response.data.stats });
        setRunTimestamp(new Date().toISOString());
      } else {
        setError(response.data.message || 'Could not run the inundation analysis.');
      }
    } catch (err) {
      console.error('Inundation error:', err);
      setError(describeError(err, 'Could not run the inundation analysis. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleAddBuildings = async () => {
    if (!selectedAOI) return;
    setLoading(true);
    setLoadingStage('buildings');
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/impact/buildings`, {
        geometry: selectedAOI.geojson,
      });
      if (response.data.status === 'success') {
        const layer = response.data.layers[0];
        urlStorage.current[layer.layerId] = layer.visual_url;
        downloadUrlStorage.current[layer.layerId] = layer.download_url;
        addLayer(layer.layerId, layer.name);
        setBuildingsInfo({
          count: response.data.building_count,
          capped: response.data.building_count_capped,
          downloadUrl: layer.download_url,
          features3DAvailable: response.data.features_available,
        });
        if (response.data.features_available && response.data.features) {
          render3DBuildings(BUILDINGS_3D_SOURCE_ID, BUILDINGS_3D_LAYER_ID, response.data.features, 'height_m', '#1e293b');
        }
      } else {
        setError(response.data.message || 'Could not fetch buildings.');
      }
    } catch (err) {
      console.error('Buildings error:', err);
      setError(describeError(err, 'Could not fetch buildings. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const removeRoadsLayer = () => {
    if (!mapRef?.current) return;
    if (mapRef.current.getLayer(ROADS_LAYER_ID)) mapRef.current.removeLayer(ROADS_LAYER_ID);
    if (mapRef.current.getSource(ROADS_SOURCE_ID)) mapRef.current.removeSource(ROADS_SOURCE_ID);
  };

  // ---------- 3D buildings (native maplibre fill-extrusion via mapRef) ----------
  const remove3DLayer = (sourceId, layerId) => {
    const map = mapRef?.current;
    if (!map) return;
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  };

  const render3DBuildings = (sourceId, layerId, geojson, heightProp, colorExpr) => {
    const map = mapRef?.current;
    if (!map || !geojson) return;
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(geojson);
      // setData() only updates the geometry/properties — the paint color
      // (e.g. recoloring by affected status after analysis) has to be
      // pushed separately, otherwise an existing layer keeps its original
      // flat color forever.
      if (map.getLayer(layerId)) map.setPaintProperty(layerId, 'fill-extrusion-color', colorExpr);
      return;
    }
    map.addSource(sourceId, { type: 'geojson', data: geojson });
    map.addLayer({
      id: layerId, type: 'fill-extrusion', source: sourceId,
      paint: {
        'fill-extrusion-height': ['coalesce', ['to-number', ['get', heightProp]], DEFAULT_UPLOADED_HEIGHT_M],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.85,
        'fill-extrusion-color': colorExpr,
      },
    });
  };

  const removeAllBuildings3D = () => {
    remove3DLayer(BUILDINGS_3D_SOURCE_ID, BUILDINGS_3D_LAYER_ID);
    remove3DLayer(UPLOADED_3D_SOURCE_ID, UPLOADED_3D_LAYER_ID);
  };

  // ---------- Animated flood-rise raster (depth colour, actually "flowing"/spreading) ----------
  const setStaticFloodLayersVisible = (visible) => {
    const map = mapRef?.current;
    if (!map) return;
    ['data-flood_extent', 'data-flood_depth'].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  };

  const stopFloodSimAnimation = () => {
    if (floodSimIntervalRef.current) {
      clearInterval(floodSimIntervalRef.current);
      floodSimIntervalRef.current = null;
    }
    setFloodSimPlaying(false);
    const map = mapRef?.current;
    if (map) {
      if (map.getLayer(FLOOD_SIM_LAYER_ID)) map.removeLayer(FLOOD_SIM_LAYER_ID);
      if (map.getSource(FLOOD_SIM_SOURCE_ID)) map.removeSource(FLOOD_SIM_SOURCE_ID);
    }
    setStaticFloodLayersVisible(true);
  };

  // Cycles through the pre-rendered depth-frame tiles (0 -> target stage)
  // on an interval: swapping the raster source's tile URL each tick reads
  // as the water actually rising and spreading, with colour showing depth
  // — rather than just a directional line with dots moving along it.
  const startFloodSimAnimation = (frames) => {
    const map = mapRef?.current;
    if (!map || !frames || frames.length === 0) return;
    stopFloodSimAnimation();
    setStaticFloodLayersVisible(false);

    const formatUrl = (url) => (url || '').replace('http://', 'https://');
    let i = 0;
    const drawFrame = () => {
      const frame = frames[i];
      const url = formatUrl(frame.visual_url);
      if (map.getSource(FLOOD_SIM_SOURCE_ID)) {
        map.getSource(FLOOD_SIM_SOURCE_ID).setTiles([url]);
      } else {
        map.addSource(FLOOD_SIM_SOURCE_ID, { type: 'raster', tiles: [url], tileSize: 256 });
        map.addLayer({ id: FLOOD_SIM_LAYER_ID, type: 'raster', source: FLOOD_SIM_SOURCE_ID, paint: { 'raster-opacity': 0.9 } });
      }
      setFloodSimStage(frame.stage_m);
      i = (i + 1) % frames.length;
    };
    drawFrame();
    floodSimIntervalRef.current = setInterval(drawFrame, FLOOD_SIM_FRAME_MS);
    setFloodSimPlaying(true);
  };

  const handleSimulateFloodRise = async () => {
    if (!inundation) return;
    if (floodSimPlaying) {
      stopFloodSimAnimation();
      return;
    }
    if (floodSimFrames) {
      startFloodSimAnimation(floodSimFrames);
      return;
    }
    setLoading(true);
    setLoadingStage('flood-sim');
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/ras/simulate-flood-rise`, {
        geometry: selectedAOI.geojson,
        dem_source: demSource,
        target_stage_m: inundation.stats.water_surface_stage_m,
      });
      if (response.data.status === 'success') {
        setFloodSimFrames(response.data.frames);
        setFloodSimLegend(response.data.legend);
        startFloodSimAnimation(response.data.frames);
      } else {
        setError(response.data.message || 'Could not build the flood-rise simulation.');
      }
    } catch (err) {
      console.error('Flood simulation error:', err);
      setError(describeError(err, 'Could not build the flood-rise simulation. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  // ---------- Animated water flow across the WHOLE flooded surface ----------
  // (as opposed to the earlier single-line version) — many particles,
  // sampled from within the actual flood extent, all drifting a short
  // distance along the same overall upstream->downstream bearing and
  // looping. Still a visual approximation (uniform bearing, not a true
  // per-pixel velocity field), but reads as the whole water body flowing,
  // closer to a HEC-RAS animated result view.
  const stopWaterFlowAnimation = () => {
    if (waterFlowAnimationFrameRef.current) {
      cancelAnimationFrame(waterFlowAnimationFrameRef.current);
      waterFlowAnimationFrameRef.current = null;
    }
    setWaterFlowPlaying(false);
    const map = mapRef?.current;
    if (!map) return;
    if (map.getLayer(WATER_FLOW_LAYER_ID)) map.removeLayer(WATER_FLOW_LAYER_ID);
    if (map.getSource(WATER_FLOW_SOURCE_ID)) map.removeSource(WATER_FLOW_SOURCE_ID);
  };

  const startWaterFlowAnimation = ({ points, bearingDeg }) => {
    const map = mapRef?.current;
    if (!map || !points || points.length === 0) return;
    stopWaterFlowAnimation();

    map.addSource(WATER_FLOW_SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: WATER_FLOW_LAYER_ID, type: 'circle', source: WATER_FLOW_SOURCE_ID,
      paint: {
        'circle-radius': 3.5, 'circle-color': '#e0f2fe',
        'circle-stroke-width': 1, 'circle-stroke-color': '#0284c7', 'circle-opacity': 0.85,
      },
    });

    // Each particle gets its own phase so they don't all move in lockstep.
    const phases = points.map(() => Math.random() * WATER_FLOW_DRIFT_KM);
    const speedKmPerSec = WATER_FLOW_DRIFT_KM / WATER_FLOW_TRAVERSAL_SECONDS;

    let startTime = null;
    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsedSec = (timestamp - startTime) / 1000;

      const features = points.map((anchor, i) => {
        const distKm = (phases[i] + elapsedSec * speedKmPerSec) % WATER_FLOW_DRIFT_KM;
        return turf.destination(turf.point(anchor), distKm, bearingDeg, { units: 'kilometers' });
      });
      const src = map.getSource(WATER_FLOW_SOURCE_ID);
      if (src) src.setData({ type: 'FeatureCollection', features });

      waterFlowAnimationFrameRef.current = requestAnimationFrame(animate);
    };
    waterFlowAnimationFrameRef.current = requestAnimationFrame(animate);
    setWaterFlowPlaying(true);
  };

  const handleAnimateWaterFlow = async () => {
    if (waterFlowPlaying) {
      stopWaterFlowAnimation();
      return;
    }
    if (waterFlowDataRef.current) {
      startWaterFlowAnimation(waterFlowDataRef.current);
      return;
    }
    if (!inundation) return;
    setLoading(true);
    setLoadingStage('water-flow');
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/ras/flood-flow-field`, {
        geometry: selectedAOI.geojson,
        dem_source: demSource,
        stage_m: inundation.stats.water_surface_stage_m,
      });
      if (response.data.status === 'success' && response.data.points?.length > 0) {
        const bearingDeg = turf.bearing(
          turf.point(response.data.upstream_point), turf.point(response.data.downstream_point)
        );
        const flowData = { points: response.data.points, bearingDeg };
        waterFlowDataRef.current = flowData;
        startWaterFlowAnimation(flowData);
      } else {
        setError(response.data.message || 'Not enough flooded area found to animate.');
      }
    } catch (err) {
      console.error('Water flow animation error:', err);
      setError(describeError(err, 'Could not animate water flow. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  // ---------- Computational mesh/grid overlay ----------
  // Shows the actual raster grid resolution the HAND/rating-curve analysis
  // was computed at (from compute_hand's analysis_scale_m) — an honest
  // "here's the computational grid" view, since this tool doesn't build a
  // true HEC-RAS-style unstructured 2D mesh.
  const removeMeshLayer = () => {
    const map = mapRef?.current;
    if (!map) return;
    if (map.getLayer(MESH_LAYER_ID)) map.removeLayer(MESH_LAYER_ID);
    if (map.getSource(MESH_SOURCE_ID)) map.removeSource(MESH_SOURCE_ID);
  };

  const handleToggleMesh = () => {
    const map = mapRef?.current;
    if (!map) return;

    if (map.getSource(MESH_SOURCE_ID)) {
      const next = !meshVisible;
      setMeshVisible(next);
      if (map.getLayer(MESH_LAYER_ID)) {
        map.setLayoutProperty(MESH_LAYER_ID, 'visibility', next ? 'visible' : 'none');
      }
      return;
    }

    if (!selectedAOI?.bbox || !hand?.analysis_scale_m) return;
    const { south, north, west, east } = selectedAOI.bbox;
    const cellSizeKm = hand.analysis_scale_m / 1000;
    const grid = turf.squareGrid([west, south, east, north], cellSizeKm, { units: 'kilometers' });

    map.addSource(MESH_SOURCE_ID, { type: 'geojson', data: grid });
    map.addLayer({
      id: MESH_LAYER_ID, type: 'line', source: MESH_SOURCE_ID,
      paint: { 'line-color': '#94a3b8', 'line-width': 0.75, 'line-opacity': 0.6 },
    });
    setMeshVisible(true);
  };

  // Tilts the camera to actually see extrusion height (a flat top-down
  // view can't show 3D); pitch/bearing ride along on the same fitBounds
  // passthrough already used for the AOI zoom, so no changes to
  // MapWindow.jsx are needed.
  const handleToggle3D = () => {
    const map = mapRef?.current;
    if (!map || !selectedAOI?.geojson) return;
    const next = !show3D;
    setShow3D(next);
    try {
      const geom = selectedAOI.geojson.geometry || selectedAOI.geojson;
      const coords = geom.coordinates[0];
      let west = coords[0][0], east = coords[0][0], south = coords[0][1], north = coords[0][1];
      coords.forEach(([lng, lat]) => {
        if (lng < west) west = lng;
        if (lng > east) east = lng;
        if (lat < south) south = lat;
        if (lat > north) north = lat;
      });
      map.fitBounds([[west, south], [east, north]], {
        pitch: next ? 55 : 0, bearing: next ? -17 : 0, padding: 80, duration: 1000,
      });
    } catch (e) {
      // ignore invalid geometry
    }
  };

  const detectHeightProperty = (properties) => {
    for (const key of HEIGHT_PROPERTY_CANDIDATES) {
      if (properties && typeof properties[key] === 'number') return key;
    }
    return null;
  };

  const handleUploadBuildings = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const features = parsed.type === 'FeatureCollection' ? parsed.features
          : parsed.type === 'Feature' ? [parsed]
          : [];
        if (features.length === 0) {
          setError('Could not find any building features in that file.');
          return;
        }
        const heightKey = detectHeightProperty(features[0].properties);
        const normalized = {
          type: 'FeatureCollection',
          features: features.map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              height_m_normalized: heightKey ? f.properties[heightKey] : DEFAULT_UPLOADED_HEIGHT_M,
            },
          })),
        };
        setError(null);
        setUploadedBuildings(normalized);
        setUploadedImpact(null);
        render3DBuildings(UPLOADED_3D_SOURCE_ID, UPLOADED_3D_LAYER_ID, normalized, 'height_m_normalized', '#0ea5e9');
        if (!heightKey) {
          setError(`No height attribute found in the uploaded file (checked: ${HEIGHT_PROPERTY_CANDIDATES.join(', ')}) — using a default ${DEFAULT_UPLOADED_HEIGHT_M}m for all buildings.`);
        }
      } catch (err) {
        console.error('Failed to parse uploaded buildings file:', err);
        setError('Could not read that file. Please upload a valid GeoJSON of building footprints.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleToggleRoads = async () => {
    const map = mapRef?.current;
    if (!map) return;

    // Already fetched — just toggle visibility.
    if (roadsInfo) {
      const next = !roadsVisible;
      setRoadsVisible(next);
      if (map.getLayer(ROADS_LAYER_ID)) {
        map.setLayoutProperty(ROADS_LAYER_ID, 'visibility', next ? 'visible' : 'none');
      }
      return;
    }

    if (!selectedAOI?.bbox) return;
    setLoading(true);
    setLoadingStage('roads');
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/impact/roads`, {
        bbox: selectedAOI.bbox,
      });
      if (response.data.status === 'success') {
        const geojson = response.data.geojson;
        if (map.getSource(ROADS_SOURCE_ID)) {
          map.getSource(ROADS_SOURCE_ID).setData(geojson);
        } else {
          map.addSource(ROADS_SOURCE_ID, { type: 'geojson', data: geojson });
          map.addLayer({
            id: ROADS_LAYER_ID, type: 'line', source: ROADS_SOURCE_ID,
            paint: { 'line-color': '#f59e0b', 'line-width': 2 },
          });
        }
        setRoadsVisible(true);
        setRoadsInfo({ count: response.data.road_count, truncated: response.data.road_count_truncated });
      } else {
        setError(response.data.message || 'Could not fetch roads.');
      }
    } catch (err) {
      console.error('Roads error:', err);
      setError(describeError(err, 'Could not fetch roads. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleAnalyzeImpact = async () => {
    if (!inundation) return;
    setLoading(true);
    setLoadingStage('impact');
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/impact/building-flood-impact`, {
        geometry: selectedAOI.geojson,
        dem_source: demSource,
        stage_m: inundation.stats.water_surface_stage_m,
      });
      if (response.data.status === 'success') {
        const layer = response.data.layers[0];
        urlStorage.current[layer.layerId] = layer.visual_url;
        downloadUrlStorage.current[layer.layerId] = layer.download_url;
        addLayer(layer.layerId, layer.name);
        setImpact({
          summary: response.data.summary,
          affectedBuildings: response.data.affected_buildings,
          truncated: response.data.affected_buildings_truncated,
          downloadUrl: layer.download_url,
          allBuildingsDownloadUrl: response.data.all_buildings_download_url,
        });
        // Recolor the 3D buildings layer (added earlier by Add Buildings)
        // red/dark by actual affected status — it was rendering every
        // building the same flat color until this.
        if (response.data.all_buildings_features) {
          render3DBuildings(
            BUILDINGS_3D_SOURCE_ID, BUILDINGS_3D_LAYER_ID, response.data.all_buildings_features, 'height_m',
            ['case', ['get', 'affected'], '#dc2626', '#1e293b']
          );
        }
      } else {
        setError(response.data.message || 'Could not analyze building impact.');
      }
    } catch (err) {
      console.error('Building impact error:', err);
      setError(describeError(err, 'Could not analyze building impact. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleAnalyzeUploadedImpact = async () => {
    if (!inundation || !uploadedBuildings) return;
    setLoading(true);
    setLoadingStage('uploaded-impact');
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/impact/uploaded-buildings`, {
        geometry: selectedAOI.geojson,
        dem_source: demSource,
        stage_m: inundation.stats.water_surface_stage_m,
        buildings_geojson: uploadedBuildings,
      });
      if (response.data.status === 'success') {
        setUploadedImpact(response.data);
        // Recolor the 3D layer by affected status now that we know it.
        render3DBuildings(
          UPLOADED_3D_SOURCE_ID, UPLOADED_3D_LAYER_ID, response.data.geojson, 'height_m_normalized',
          ['case', ['get', 'affected'], '#dc2626', '#0ea5e9']
        );
      } else {
        setError(response.data.message || 'Could not analyze the uploaded buildings.');
      }
    } catch (err) {
      console.error('Uploaded buildings impact error:', err);
      setError(describeError(err, 'Could not analyze the uploaded buildings. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleSaveAnalysis = async () => {
    if (!projectInfo?.id || !inundation) return;
    setSaving(true);
    setSaveMessage('');
    try {
      await saveResult(projectInfo.id, 'hydrology', 'inundation', selectedAOI?.geojson || null, {
        channel, curve, designQ, inundation, layers, urls: urlStorage.current,
        downloadUrls: downloadUrlStorage.current, buildingsInfo, impact, runTimestamp,
      });
      setSaveMessage('Saved to project ✓');
      setIsSaved(true);
      setTimeout(() => setSaveMessage(''), 2500);
    } catch (err) {
      setSaveMessage('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleNewAnalysis = () => {
    if (!isSaved && (inundation || layers.length > 0)) {
      const confirmed = window.confirm("This analysis hasn't been saved yet. Starting a new analysis will discard it. Continue anyway?");
      if (!confirmed) return;
    }
    setHand(null);
    setCurve(null);
    setDesignQ('');
    setInundation(null);
    setRunTimestamp(null);
    setLayers([]);
    setSelectedAOI(null);
    setError(null);
    setIsSaved(true);
    setMapLayers([]);
    urlStorage.current = {};
    downloadUrlStorage.current = {};
    removeRoadsLayer();
    removeAllBuildings3D();
    removeMeshLayer();
    stopFloodSimAnimation();
    stopWaterFlowAnimation();
    waterFlowDataRef.current = null;
    setBuildingsInfo(null);
    setRoadsInfo(null);
    setRoadsVisible(true);
    setImpact(null);
    setShowAffectedList(false);
    setUploadedBuildings(null);
    setUploadedImpact(null);
    setShow3D(false);
    setMeshVisible(false);
    setFloodSimFrames(null);
    setFloodSimStage(null);
    setFloodSimLegend(null);
    if (setBoundaryVisible) setBoundaryVisible(true);
  };

  // Roads, 3D buildings, the mesh grid, the flood-rise simulation, and the
  // water-flow particles are all native maplibre layers added directly via
  // mapRef, not part of the raster `layers` state — clean them up if the
  // component unmounts (e.g. user switches to a different hydrology tool)
  // so they don't leak.
  useEffect(() => () => {
    removeRoadsLayer();
    removeAllBuildings3D();
    removeMeshLayer();
    stopFloodSimAnimation();
    stopWaterFlowAnimation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleSavedList = async () => {
    if (!showSavedList) {
      setLoadingSaved(true);
      try {
        const results = await listResults(projectInfo.id);
        setSavedResults(results.filter((r) => r.module === 'hydrology' && r.tool_type === 'inundation'));
      } catch (err) {
        console.error('Could not load saved analyses:', err);
      } finally {
        setLoadingSaved(false);
      }
    }
    setShowSavedList(!showSavedList);
  };

  const handleLoadSavedResult = (r) => {
    const data = r.result_data || {};
    if (r.input_geometry) setSelectedAOI({ geojson: r.input_geometry, bbox: null });
    if (data.channel) setChannel(data.channel);
    if (data.curve) setCurve(data.curve);
    if (data.designQ) setDesignQ(data.designQ);
    if (data.inundation) setInundation(data.inundation);
    if (data.layers) setLayers(data.layers);
    if (data.urls) urlStorage.current = data.urls;
    if (data.downloadUrls) downloadUrlStorage.current = data.downloadUrls;
    if (data.buildingsInfo) setBuildingsInfo(data.buildingsInfo);
    if (data.impact) setImpact(data.impact);
    setRunTimestamp(data.runTimestamp || r.created_at || null);
    setIsSaved(true);
    setShowSavedList(false);
  };

  const nearestCurvePoint = curve && designQ
    ? curve.reduce((best, p) => (Math.abs(p.discharge_cms - parseFloat(designQ)) < Math.abs(best.discharge_cms - parseFloat(designQ)) ? p : best), curve[0])
    : null;

  return (
    <div className="p-5 space-y-5 animate-in fade-in">
      <div className="flex items-center justify-between border-l-2 border-blue-500 pl-2">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">
          Hydraulic Flood Routing
        </p>
        <div className="flex items-center gap-3">
          <button onClick={handleToggleSavedList} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-blue-600 transition-colors">
            <History size={11} /> Saved <ChevronDown size={10} className={showSavedList ? 'rotate-180' : ''} />
          </button>
          {selectedAOI && (
            <button onClick={handleDownloadBoundary} title="Download the study area boundary" className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-emerald-600 transition-colors">
              <Download size={11} /> Boundary
            </button>
          )}
          {(selectedAOI || inundation) && (
            <button onClick={handleNewAnalysis} title="Clear this and start a new analysis" className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-red-500 transition-colors">
              <RotateCcw size={11} /> New Analysis
            </button>
          )}
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3 text-blue-800 text-[11px]">
        <Info size={18} className="shrink-0" />
        <p>HEC-RAS-style hydraulic routing: HAND (Height Above Nearest Drainage) terrain index + a Manning's-equation synthetic rating curve, to map inundation extent and depth for a given design discharge.</p>
      </div>

      {showSavedList && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 max-h-48 overflow-y-auto">
          {loadingSaved ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-400" size={18} /></div>
          ) : savedResults.length === 0 ? (
            <p className="text-[10px] text-slate-400 font-bold text-center py-2">No saved analyses yet</p>
          ) : (
            savedResults.map((r) => (
              <button key={r.id} onClick={() => handleLoadSavedResult(r)} className="w-full text-left p-2.5 bg-white border border-slate-100 rounded-xl hover:border-blue-400 transition-all">
                <p className="text-[10px] font-bold text-slate-700">
                  Flooded Area: {r.result_data?.inundation?.stats?.flooded_area_km2 ?? '—'} km²
                </p>
                <p className="text-[9px] text-slate-400">{new Date(r.created_at).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold rounded-xl">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* STEP 1 — Study Area */}
      {!selectedAOI ? (
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onStartDrawing} className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-slate-200 rounded-3xl hover:border-blue-500 hover:bg-blue-50 transition-all group active:scale-95">
            <Pencil size={22} className="text-slate-400 group-hover:text-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Draw Reach Area</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group active:scale-95">
            <Upload size={22} className="text-slate-400 group-hover:text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Upload</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".geojson,.json" onChange={handleUploadBoundary} className="hidden" />
        </div>
      ) : (
        <div className="space-y-5">

          {layers.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-2">
                <Layers size={14} className="text-blue-600" />
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-tighter">Active Layers</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-32 overflow-y-auto">
                {layers.map((l) => (
                  <div key={l.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-white transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <input type="checkbox" checked={l.visible} onChange={() => toggleLayer(l.id)} className="w-4 h-4 rounded-md accent-blue-600 cursor-pointer shrink-0" />
                      <span className="text-[10px] font-bold text-slate-700 truncate">{l.name}</span>
                    </div>
                    {downloadUrlStorage.current[l.id] && (
                      <button onClick={() => handleDownloadLayer(l.id)} title="Download this layer" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0">
                        <Download size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — HAND */}
          {!hand ? (
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DEM Source</label>
              <select value={demSource} onChange={(e) => setDemSource(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-blue-500 bg-white">
                <option value="SRTM">SRTM (30m)</option>
                <option value="COPERNICUS">Copernicus GLO-30 (30m)</option>
                <option value="ALOS">ALOS AW3D30 (30m)</option>
                <option value="NASADEM">NASADEM (30m)</option>
              </select>
              <button onClick={handleComputeHand} disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                {loading && loadingStage === 'hand' ? <Loader2 className="animate-spin" size={16} /> : <>Compute HAND &amp; Channel Properties <Mountain size={16} /></>}
              </button>
            </div>
          ) : !curve ? (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase">Manning's n</label>
                  <input type="number" step="0.005" value={channel.manning_n} onChange={(e) => setChannel({ ...channel, manning_n: parseFloat(e.target.value) || 0.035 })} className="w-full text-[12px] font-bold p-1.5 bg-white border border-slate-200 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase">Bed Slope (%)</label>
                  <input type="number" step="0.01" value={channel.bed_slope_percent} onChange={(e) => setChannel({ ...channel, bed_slope_percent: parseFloat(e.target.value) || 1 })} className="w-full text-[12px] font-bold p-1.5 bg-white border border-slate-200 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase">Reach Length (km)</label>
                  <input type="number" step="0.1" value={channel.reach_length_km} onChange={(e) => setChannel({ ...channel, reach_length_km: parseFloat(e.target.value) || 1 })} className="w-full text-[12px] font-bold p-1.5 bg-white border border-slate-200 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase">Max Stage (m)</label>
                  <input type="number" step="0.5" value={channel.max_stage_m} onChange={(e) => setChannel({ ...channel, max_stage_m: parseFloat(e.target.value) || 5 })} className="w-full text-[12px] font-bold p-1.5 bg-white border border-slate-200 rounded-lg outline-none" />
                </div>
              </div>
              <button onClick={handleBuildCurve} disabled={loading} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-100 active:scale-[0.98] transition-all">
                {loading && loadingStage === 'curve' ? <Loader2 className="animate-spin" size={16} /> : <>Build Rating Curve <TrendingUp size={16} /></>}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Stage-Discharge Rating Curve</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={curve} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="discharge_cms" tick={{ fontSize: 9 }} label={{ value: 'm³/s', position: 'insideBottomRight', fontSize: 9, offset: -2 }} />
                    <YAxis dataKey="stage_m" tick={{ fontSize: 9 }} label={{ value: 'stage (m)', angle: -90, fontSize: 9 }} />
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="stage_m" stroke="#2563eb" strokeWidth={2} dot={false} />
                    {nearestCurvePoint && (
                      <ReferenceDot x={nearestCurvePoint.discharge_cms} y={nearestCurvePoint.stage_m} r={5} fill="#f97316" stroke="white" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {!inundation && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Gauge size={12} /> Design Discharge (m³/s)
                  </label>
                  <input type="number" value={designQ} onChange={(e) => setDesignQ(e.target.value)} placeholder="e.g. 45.5" className="w-full text-[11px] font-bold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500" />

                  {projectInfo?.id && (
                    <div>
                      <button onClick={handleOpenRunoffPicker} className="text-[9px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        Use Peak Q from a Rainfall-Runoff analysis <ChevronDown size={10} className={showRunoffPicker ? 'rotate-180' : ''} />
                      </button>
                      {showRunoffPicker && (
                        <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1 max-h-32 overflow-y-auto">
                          {runoffResults.length === 0 ? (
                            <p className="text-[9px] text-slate-400 font-bold text-center py-2">No saved Rainfall-Runoff analyses in this project</p>
                          ) : (
                            runoffResults.map((r) => (
                              <button key={r.id} onClick={() => handlePickRunoff(r)} className="w-full text-left p-2 bg-white border border-slate-100 rounded-lg hover:border-blue-400 text-[9px] font-bold text-slate-700">
                                Peak Q: {r.result_data?.result?.results?.peak_discharge_cms ?? '—'} m³/s · {new Date(r.created_at).toLocaleString()}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button onClick={handleRunInundation} disabled={loading || !designQ} className="w-full py-4 rounded-2xl text-xs font-black flex items-center justify-center gap-3 bg-blue-600 text-white shadow-xl disabled:opacity-50 active:scale-[0.98] transition-all">
                    {loading && loadingStage === 'inundate' ? <><Loader2 size={16} className="animate-spin" /> ROUTING...</> : <><Waves size={16} /> RUN INUNDATION MAPPING</>}
                  </button>
                </div>
              )}

              {inundation && (
                <div className="space-y-3">
                  {runTimestamp && (
                    <p className="text-[9px] font-bold text-slate-400">
                      Run: {new Date(runTimestamp).toLocaleString()}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="text-[8px] font-black text-blue-400 uppercase">Flooded Area</p>
                      <p className="text-[15px] font-black text-blue-900">{inundation.stats.flooded_area_km2} <span className="text-[9px] font-bold">km²</span></p>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <p className="text-[8px] font-black text-blue-400 uppercase">Water Surface Stage</p>
                      <p className="text-[15px] font-black text-blue-900">{inundation.stats.water_surface_stage_m} <span className="text-[9px] font-bold">m</span></p>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Avg / Max Depth</p>
                      <p className="text-[13px] font-black text-slate-700">{inundation.stats.avg_depth_m}m / {inundation.stats.max_depth_m}m</p>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Affected Population</p>
                      <p className="text-[13px] font-black text-slate-700">{inundation.stats.affected_population ?? '—'}</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
                    <button onClick={handleSimulateFloodRise} disabled={loading && loadingStage !== 'flood-sim'} className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-[10px] font-black uppercase disabled:opacity-50 active:scale-[0.98] transition-all ${floodSimPlaying ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white shadow-lg shadow-blue-100'}`}>
                      {loading && loadingStage === 'flood-sim' ? <><Loader2 size={14} className="animate-spin" /> BUILDING SIMULATION...</> : <><Waves size={14} /> {floodSimPlaying ? 'Stop Flood Simulation' : 'Simulate Flood Rise (Depth)'}</>}
                    </button>
                    {floodSimPlaying && floodSimStage !== null && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-500">
                          <span>Rising water level</span>
                          <span>{floodSimStage.toFixed(2)} m deep</span>
                        </div>
                        {floodSimLegend && (
                          <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${floodSimLegend.palette.join(',')})` }} />
                        )}
                      </div>
                    )}
                    <button onClick={handleAnimateWaterFlow} disabled={loading && loadingStage !== 'water-flow'} className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-[10px] font-black uppercase disabled:opacity-50 active:scale-[0.98] transition-all ${waterFlowPlaying ? 'bg-sky-700 text-white' : 'bg-white border border-slate-200 text-sky-700 hover:border-sky-400'}`}>
                      {loading && loadingStage === 'water-flow' ? <><Loader2 size={14} className="animate-spin" /> ANIMATING...</> : <><Wind size={14} /> {waterFlowPlaying ? 'Stop Water Flow' : 'Animate Water Flow'}</>}
                    </button>
                  </div>

                  {/* EXPOSURE ANALYSIS — buildings, roads, and per-building flood impact */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                      <ShieldAlert size={14} className="text-orange-600" />
                      <span className="text-[10px] font-black uppercase text-slate-600 tracking-tighter">Exposure Analysis</span>
                    </div>
                    <div className="p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleAddBuildings} disabled={loading} className="flex items-center justify-center gap-2 p-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-50 active:scale-[0.98] transition-all">
                          {loading && loadingStage === 'buildings' ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
                          {buildingsInfo ? `${buildingsInfo.count} Buildings` : 'Add Buildings'}
                        </button>
                        <button onClick={handleToggleRoads} disabled={loading} className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-[10px] font-black uppercase disabled:opacity-50 active:scale-[0.98] transition-all ${roadsInfo && !roadsVisible ? 'bg-white border border-slate-200 text-slate-500' : 'bg-amber-500 text-white'}`}>
                          {loading && loadingStage === 'roads' ? <Loader2 size={14} className="animate-spin" /> : <Route size={14} />}
                          {roadsInfo ? `${roadsInfo.count} Roads` : 'Add Roads'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => buildingsFileInputRef.current?.click()} disabled={loading} className="flex items-center justify-center gap-2 p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase disabled:opacity-50 active:scale-[0.98] transition-all hover:border-sky-400">
                          <FileUp size={14} /> {uploadedBuildings ? `${uploadedBuildings.features.length} Uploaded` : 'Upload Buildings'}
                        </button>
                        <input ref={buildingsFileInputRef} type="file" accept=".geojson,.json" onChange={handleUploadBuildings} className="hidden" />
                        <button onClick={handleToggle3D} disabled={loading || (!buildingsInfo?.features3DAvailable && !uploadedBuildings)} className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-[10px] font-black uppercase disabled:opacity-30 active:scale-[0.98] transition-all ${show3D ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-400'}`}>
                          <Box size={14} /> {show3D ? '3D On' : '3D View'}
                        </button>
                      </div>
                      <button onClick={handleToggleMesh} disabled={loading || !hand?.analysis_scale_m} className={`w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-[10px] font-black uppercase disabled:opacity-30 active:scale-[0.98] transition-all ${meshVisible ? 'bg-slate-700 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                        <Grid3x3 size={14} /> {meshVisible ? 'Mesh On' : 'Show Mesh'}
                      </button>
                      {hand && !hand.analysis_scale_m && (
                        <p className="text-[9px] text-slate-400 font-bold">Mesh needs the HAND step's analysis scale — recompute HAND to enable it.</p>
                      )}
                      {buildingsInfo?.capped && (
                        <p className="text-[9px] text-amber-600 font-bold">Building count capped at 20,000 — area may be larger than shown.</p>
                      )}
                      {buildingsInfo && !buildingsInfo.features3DAvailable && (
                        <p className="text-[9px] text-slate-400 font-bold">Too many buildings for 3D rendering here — showing the flat overview only. Upload a smaller custom layer for 3D.</p>
                      )}
                      {roadsInfo?.truncated && (
                        <p className="text-[9px] text-amber-600 font-bold">Road results truncated at 5,000 ways — area may have more.</p>
                      )}

                      {uploadedBuildings ? (
                        !uploadedImpact ? (
                          <button onClick={handleAnalyzeUploadedImpact} disabled={loading || !inundation} className="w-full py-3.5 bg-sky-600 text-white rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-sky-100 disabled:opacity-50 active:scale-[0.98] transition-all">
                            {loading && loadingStage === 'uploaded-impact' ? <><Loader2 size={16} className="animate-spin" /> ANALYZING...</> : <><Home size={16} /> Analyze Uploaded Buildings</>}
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2.5 bg-sky-50 border border-sky-100 rounded-xl">
                                <p className="text-[8px] font-black text-sky-500 uppercase">Affected</p>
                                <p className="text-[14px] font-black text-sky-900">{uploadedImpact.summary.affected_buildings} <span className="text-[9px] font-bold">/ {uploadedImpact.summary.total_buildings_analyzed} ({uploadedImpact.summary.affected_percentage}%)</span></p>
                              </div>
                              <button
                                onClick={() => {
                                  const blob = new Blob([JSON.stringify(uploadedImpact.geojson, null, 2)], { type: 'application/json' });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url; a.download = 'uploaded-buildings-flood-impact.geojson';
                                  document.body.appendChild(a); a.click(); a.remove();
                                  URL.revokeObjectURL(url);
                                }}
                                className="flex items-center justify-center gap-1.5 p-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-600 hover:border-sky-300"
                              >
                                <Download size={12} /> Download Results
                              </button>
                            </div>
                          </div>
                        )
                      ) : !impact ? (
                        <button onClick={handleAnalyzeImpact} disabled={loading} className="w-full py-3.5 bg-rose-600 text-white rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-rose-100 disabled:opacity-50 active:scale-[0.98] transition-all">
                          {loading && loadingStage === 'impact' ? <><Loader2 size={16} className="animate-spin" /> ANALYZING...</> : <><Home size={16} /> Analyze Affected Buildings</>}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                              <p className="text-[8px] font-black text-rose-400 uppercase">Affected Buildings</p>
                              <p className="text-[14px] font-black text-rose-900">{impact.summary.affected_buildings} <span className="text-[9px] font-bold">/ {impact.summary.total_buildings_analyzed} ({impact.summary.affected_percentage}%)</span></p>
                            </div>
                            <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                              <p className="text-[8px] font-black text-rose-400 uppercase">Affected Floor Area</p>
                              <p className="text-[14px] font-black text-rose-900">{impact.summary.affected_building_area_m2.toLocaleString()} <span className="text-[9px] font-bold">m²</span></p>
                            </div>
                          </div>

                          <button onClick={() => setShowAffectedList(!showAffectedList)} className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 hover:border-rose-300">
                            View Affected Buildings List <ChevronDown size={12} className={showAffectedList ? 'rotate-180' : ''} />
                          </button>
                          {showAffectedList && (
                            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50">
                              {impact.affectedBuildings.length === 0 ? (
                                <p className="text-[9px] text-slate-400 font-bold text-center py-2">No affected buildings found.</p>
                              ) : (
                                impact.affectedBuildings.map((b) => (
                                  <div key={b.id} className="p-2 bg-white border border-slate-100 rounded-lg flex items-center justify-between">
                                    <div>
                                      <p className="text-[9px] font-black text-slate-700">{b.area_m2} m² · depth {b.depth_m}m</p>
                                      <p className="text-[8px] text-slate-400">{b.centroid ? `${b.centroid.lat.toFixed(5)}, ${b.centroid.lon.toFixed(5)}` : '—'} · confidence {b.confidence}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                              {impact.truncated && (
                                <p className="text-[9px] text-amber-600 font-bold text-center pt-1">List capped at 300 — use the download for the full set.</p>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => window.open(impact.downloadUrl, '_blank')} className="flex items-center justify-center gap-1.5 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-600 hover:border-rose-300">
                              <Download size={12} /> Affected (GeoJSON)
                            </button>
                            <button onClick={() => window.open(impact.allBuildingsDownloadUrl, '_blank')} className="flex items-center justify-center gap-1.5 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-600 hover:border-slate-400">
                              <Download size={12} /> All Buildings (GeoJSON)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {projectInfo?.id && (
                    <button onClick={handleSaveAnalysis} disabled={saving} className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50">
                      {saving ? <Loader2 className="animate-spin" size={16} /> : saveMessage ? <><CheckCircle2 size={16} /> {saveMessage}</> : <><Save size={16} /> Save Analysis to Project</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
