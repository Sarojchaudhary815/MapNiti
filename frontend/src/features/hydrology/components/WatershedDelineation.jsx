import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Pencil, Upload, MoreVertical, Layers, ArrowRight,
  MapPin, Activity, Loader2, Trash2, Download, Info, Save, RotateCcw, CheckCircle2,
  History, ChevronDown, AlertCircle
} from 'lucide-react';
import { saveResult, listResults } from '../../../api/projectApi';

import { API_BASE_URL } from '../../../config';

export default function WatershedDelineation({ 
  selectedAOI, setSelectedAOI, onStartDrawing, onRasterGenerated, 
  setShowRaster, rasterData, activeStep, setActiveStep, outletCoords, setOutletCoords,
  setBoundaryVisible, projectInfo, setMapLayers
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [layers, setLayers] = useState([]);
  const [openMenu, setOpenMenu] = useState(null);
  const [catchmentArea, setCatchmentArea] = useState(null);
  const [demSource, setDemSource] = useState('SRTM');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [showSavedList, setShowSavedList] = useState(false);
  const [savedResults, setSavedResults] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const flowDataStorage = useRef({});
  const downloadUrlStorage = useRef({});
  const hasRestored = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---------- SESSION PERSISTENCE (local browser cache, survives refresh) ----------
  const sessionKey = projectInfo?.id ? `mapniti_hydrology_${projectInfo.id}` : null;

  useEffect(() => {
    if (!sessionKey || hasRestored.current) return;
    hasRestored.current = true;
    try {
      const raw = localStorage.getItem(sessionKey);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (session.selectedAOI) setSelectedAOI(session.selectedAOI);
      if (session.outletCoords) setOutletCoords(session.outletCoords);
      if (session.layers) setLayers(session.layers);
      if (session.catchmentArea) setCatchmentArea(session.catchmentArea);
      if (session.urls) flowDataStorage.current = session.urls;
      if (session.downloadUrls) downloadUrlStorage.current = session.downloadUrls;
    } catch (e) {
      console.warn("Could not restore saved session:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    const session = {
      selectedAOI,
      outletCoords,
      layers,
      catchmentArea,
      urls: flowDataStorage.current,
      downloadUrls: downloadUrlStorage.current,
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));
  }, [sessionKey, layers, catchmentArea, selectedAOI, outletCoords]);

  // ---------- Keep the map's visible layer list in sync with the layer panel ----------
  useEffect(() => {
    const visibleRasterLayers = layers
      .filter(l => l.type === 'Raster' && l.visible && flowDataStorage.current[l.id])
      .map(l => ({ layerId: l.id, visual_url: flowDataStorage.current[l.id] }));
    setMapLayers(visibleRasterLayers);
  }, [layers, setMapLayers]);

  const addLayer = (id, defaultName, type) => {
    if (!layers.find(l => l.id === id)) {
      setLayers(prev => [...prev, { id, name: defaultName, visible: true, type }]);
    }
  };

  const toggleLayer = (id) => {
    setLayers(layers.map(l => {
      if (l.id === id) {
        const newStatus = !l.visible;
        if (id === 'boundary') setBoundaryVisible(newStatus);
        return { ...l, visible: newStatus };
      }
      return l;
    }));
  };

  const deleteLayer = (id) => {
    setLayers(layers.filter(l => l.id !== id));
    delete flowDataStorage.current[id];
    delete downloadUrlStorage.current[id];

    if (id === 'boundary') setSelectedAOI(null);
    if (id === 'catchment') setCatchmentArea(null);
    if (id === 'outlets') {
      setOutletCoords([]);
      setActiveStep('none');
    }
    setOpenMenu(null);
  };

  const downloadJSON = (obj, filename) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownload = (id) => {
    if (id === 'boundary' && selectedAOI?.geojson) {
      downloadJSON(selectedAOI.geojson, 'project-area.geojson');
    } else if (id === 'outlets' && outletCoords.length > 0) {
      const geojson = {
        type: 'FeatureCollection',
        features: outletCoords.map((c, i) => ({
          type: 'Feature',
          properties: { id: i + 1 },
          geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        })),
      };
      downloadJSON(geojson, 'outlet-points.geojson');
    } else if (downloadUrlStorage.current[id]) {
      window.open(downloadUrlStorage.current[id], '_blank');
    }
    setOpenMenu(null);
  };

  // ---------- SAVE TO BACKEND (permanent, attached to the project) ----------
  const handleSaveAnalysis = async () => {
    if (!projectInfo?.id) return;
    setSaving(true);
    setSaveMessage('');
    try {
      await saveResult(
        projectInfo.id,
        'hydrology',
        'watershed',
        selectedAOI?.geojson || null,
        {
          layers,
          catchmentArea,
          urls: flowDataStorage.current,
          downloadUrls: downloadUrlStorage.current,
        }
      );
      setSaveMessage('Saved to project ✓');
      setIsSaved(true);
      setTimeout(() => setSaveMessage(''), 2500);
    } catch (err) {
      setSaveMessage('Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ---------- NEW ANALYSIS (clears current work to start fresh) ----------
  const handleNewAnalysis = () => {
    if (!isSaved && (catchmentArea || layers.length > 0)) {
      const confirmed = window.confirm(
        "This analysis hasn't been saved yet. Starting a new analysis will discard it. Continue anyway?"
      );
      if (!confirmed) return;
    }
    setLayers([]);
    setCatchmentArea(null);
    setOutletCoords([]);
    setSelectedAOI(null);
    setActiveStep('none');
    setMapLayers([]);
    setIsSaved(true);
    setError(null);
    flowDataStorage.current = {};
    downloadUrlStorage.current = {};
    if (sessionKey) localStorage.removeItem(sessionKey);
  };

  // ---------- SAVED ANALYSES (previously saved results for this project) ----------
  const handleToggleSavedList = async () => {
    if (!showSavedList) {
      setLoadingSaved(true);
      try {
        const results = await listResults(projectInfo.id);
        setSavedResults(results.filter(r => r.module === 'hydrology' && r.tool_type === 'watershed'));
      } catch (err) {
        console.error("Could not load saved analyses:", err);
      } finally {
        setLoadingSaved(false);
      }
    }
    setShowSavedList(!showSavedList);
  };

  const handleLoadSavedResult = (result) => {
    const data = result.result_data || {};
    if (result.input_geometry) {
      setSelectedAOI({ geojson: result.input_geometry, bbox: null });
    }
    if (data.layers) setLayers(data.layers);
    if (data.catchmentArea) setCatchmentArea(data.catchmentArea);
    if (data.urls) flowDataStorage.current = data.urls;
    if (data.downloadUrls) downloadUrlStorage.current = data.downloadUrls;
    setIsSaved(true);
    setShowSavedList(false);
  };

  const describeError = (err, fallback) => {
    const serverMsg = err.response?.data?.message || err.response?.data?.detail;
    return serverMsg || (err.response?.status ? `Request failed (status ${err.response.status}).` : fallback);
  };

  const handleRunDEM = async () => {
    if (!selectedAOI) return;
    setLoading(true);
    setError(null);
    setIsSaved(false);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/fetch-dem-gee`, {
        geometry: selectedAOI.geojson,
        bbox: selectedAOI.bbox,
        dem_source: demSource
      });
      if (response.data.status === "success") {
        const layer = response.data.layers[0];
        flowDataStorage.current['dem'] = layer.visual_url;
        downloadUrlStorage.current['dem'] = layer.download_url;
        addLayer('dem', layer.name || 'Elevation Layer (DEM)', 'Raster');
      } else {
        setError(response.data.message || 'Could not generate the terrain layer.');
      }
    } catch (err) {
      console.error("DEM Error:", err);
      setError(describeError(err, 'Could not generate the terrain layer. Please try again.'));
    } finally { setLoading(false); }
  };

  const handleRunFlow = async () => {
    if (!selectedAOI) return;
    setLoading(true);
    setError(null);
    setIsSaved(false);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/analyze-flow`, {
        geometry: selectedAOI.geojson
      });
      if (response.data.status === "success" && response.data.layers) {
        response.data.layers.forEach(layer => {
          flowDataStorage.current[layer.layerId] = layer.visual_url;
          downloadUrlStorage.current[layer.layerId] = layer.download_url;
          addLayer(layer.layerId, layer.name, 'Raster');
        });
      } else {
        setError(response.data.message || 'Could not run flow analysis.');
      }
    } catch (err) {
      console.error("Flow Error:", err);
      setError(describeError(err, 'Could not run flow analysis. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRunCatchment = async () => {
    if (outletCoords.length === 0) return;
    setLoading(true);
    setError(null);
    setIsSaved(false);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/delineate-watershed`, {
        outlets: outletCoords,
        geometry: selectedAOI.geojson
      });
      if (response.data.status === "success") {
        flowDataStorage.current['catchment'] = response.data.visual_url;
        downloadUrlStorage.current['catchment'] = response.data.download_url;
        addLayer('catchment', 'Delineated Catchment', 'Raster');
        setCatchmentArea(response.data.area_km2);
        setActiveStep('none');
      } else {
        setError(response.data.message || 'Could not delineate the watershed.');
      }
    } catch (err) {
      console.error("Catchment Error:", err);
      setError(describeError(err, 'Could not delineate the watershed. Please try again.'));
    } finally { setLoading(false); }
  };

  const handleUploadBoundary = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);

        let geometry;
        if (parsed.type === 'FeatureCollection') {
          geometry = parsed.features[0];
        } else if (parsed.type === 'Feature') {
          geometry = parsed;
        } else {
          geometry = { type: 'Feature', properties: {}, geometry: parsed };
        }

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
        addLayer('boundary', 'Project Area', 'Vector');
      } catch (err) {
        console.error('Failed to parse uploaded boundary file:', err);
        setError('Could not read that file. Please upload a valid GeoJSON boundary.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-inner">
      <div className="p-5 space-y-4 flex-grow overflow-y-auto">
        <div className="flex items-center justify-between border-l-2 border-cyan-500 pl-2">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">
            Terrain & Hydrology Analysis
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSavedList}
              className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-cyan-600 transition-colors"
            >
              <History size={11} /> Saved <ChevronDown size={10} className={showSavedList ? 'rotate-180' : ''} />
            </button>
            {(selectedAOI || layers.length > 0) && (
              <button
                onClick={handleNewAnalysis}
                title="Clear this and start a new analysis"
                className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-red-500 transition-colors"
              >
                <RotateCcw size={11} /> New Analysis
              </button>
            )}
          </div>
        </div>

        {showSavedList && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 max-h-48 overflow-y-auto">
            {loadingSaved ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-400" size={18} /></div>
            ) : savedResults.length === 0 ? (
              <p className="text-[10px] text-slate-400 font-bold text-center py-2">No saved analyses yet</p>
            ) : (
              savedResults.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleLoadSavedResult(r)}
                  className="w-full text-left p-2.5 bg-white border border-slate-100 rounded-xl hover:border-cyan-400 transition-all"
                >
                  <p className="text-[10px] font-bold text-slate-700">
                    Catchment: {r.result_data?.catchmentArea ?? '—'} sq.km
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

        {!selectedAOI ? (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { onStartDrawing(); addLayer('boundary', 'Project Area', 'Vector'); }} className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-slate-200 rounded-3xl hover:border-cyan-500 hover:bg-cyan-50 transition-all group active:scale-95">
              <Pencil size={22} className="text-slate-400 group-hover:text-cyan-500" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Draw Area</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group active:scale-95">
              <Upload size={22} className="text-slate-400 group-hover:text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Upload</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".geojson,.json"
              onChange={handleUploadBoundary}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-cyan-600" />
                  <span className="text-[10px] font-black uppercase text-slate-600 tracking-tighter">Active Layers</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                {layers.map((layer) => (
                  <div key={layer.id} className="p-3 flex items-center justify-between hover:bg-white transition-colors">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={layer.visible} onChange={() => toggleLayer(layer.id)} className="w-4 h-4 rounded-md accent-cyan-600 cursor-pointer" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-700">{layer.name}</span>
                        <span className="text-[8px] font-black text-slate-400 uppercase">{layer.type}</span>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setOpenMenu({ id: layer.id, x: rect.left - 130, y: rect.bottom + 5 }); }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                      <MoreVertical size={14} className="text-slate-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {openMenu && (
              <div ref={menuRef} style={{ top: openMenu.y, left: openMenu.x }} className="fixed w-40 bg-white shadow-2xl border border-slate-100 rounded-xl z-[9999] py-1">
                <button onClick={() => handleDownload(openMenu.id)} className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                  <Download size={12} /> Download
                </button>
                <button onClick={() => deleteLayer(openMenu.id)} className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-2">
                  <Trash2 size={12} /> Remove Layer
                </button>
              </div>
            )}

            {!layers.some(l => l.id === 'dem') && (
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DEM Source</label>
                  <select
                    value={demSource}
                    onChange={(e) => setDemSource(e.target.value)}
                    className="w-full mt-1 p-3 border-2 border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-cyan-500 bg-white"
                  >
                    <option value="SRTM">SRTM (30m) — Most widely used</option>
                    <option value="COPERNICUS">Copernicus GLO-30 (30m) — Most accurate</option>
                    <option value="ALOS">ALOS AW3D30 (30m) — JAXA</option>
                    <option value="NASADEM">NASADEM (30m) — Improved SRTM</option>
                  </select>
                </div>
                <button onClick={handleRunDEM} disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <>Generate Terrain (DEM) <ArrowRight size={16} /></>}
                </button>
              </div>
            )}

            {layers.some(l => l.id === 'dem') && !layers.some(l => l.id === 'flow') && (
              <button onClick={handleRunFlow} disabled={loading} className="w-full py-4 bg-cyan-600 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 shadow-lg shadow-cyan-100 active:scale-[0.98] transition-all">
                {loading ? <Loader2 className="animate-spin" size={16} /> : <>Run Flow Analysis <Activity size={16} /></>}
              </button>
            )}

            {layers.some(l => l.id === 'flow') && !layers.some(l => l.id === 'catchment') && (
              <button 
                onClick={() => { setActiveStep('place-outlet'); addLayer('outlets', 'Watershed Outlet', 'Point'); }} 
                className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${activeStep === 'place-outlet' ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-100 bg-white hover:border-emerald-200'}`}
              >
                <div className={`p-2.5 rounded-xl ${activeStep === 'place-outlet' ? 'bg-emerald-600 text-white animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                  <MapPin size={22} />
                </div>
                <div className="text-left">
                  <span className="block text-[11px] font-black text-slate-800 uppercase tracking-tight">Set Outlet Point</span>
                  <span className="block text-[9px] text-slate-500 font-bold">Captured: {outletCoords.length} points</span>
                </div>
              </button>
            )}

            {catchmentArea && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                    <Info size={18} className="text-blue-500 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Analysis Result</p>
                        <p className="text-[12px] font-bold text-blue-700">Catchment Area: <span className="text-blue-900 font-black">{catchmentArea} sq. km</span></p>
                    </div>
                </div>
            )}

            {catchmentArea && (
              <button
                onClick={handleSaveAnalysis}
                disabled={saving}
                className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : saveMessage ? <><CheckCircle2 size={16} /> {saveMessage}</> : <><Save size={16} /> Save Analysis to Project</>}
              </button>
            )}
          </div>
        )}
      </div>

      {outletCoords.length > 0 && !layers.some(l => l.id === 'catchment') && (
        <div className="p-5 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm">
          <button 
            onClick={handleRunCatchment} 
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[12px] font-black uppercase flex items-center justify-center gap-2 shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <>Delineate Watershed <Activity size={16} /></>}
          </button>
        </div>
      )}
    </div>
  );
}