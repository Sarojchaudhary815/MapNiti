import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Pencil, Upload, Layers, ArrowRight, Target, Shuffle, Database,
  Loader2, Save, RotateCcw, CheckCircle2, History, ChevronDown, AlertCircle, Trash2,
  Eye, Plus, X, MousePointer2,
} from 'lucide-react';
import { saveResult, listResults } from '../../../api/projectApi';

import { API_BASE_URL } from '../../../config';

const IMAGERY_OPTIONS = [
  { value: 'SENTINEL2', label: 'Sentinel-2 (10m) — Most widely used' },
  { value: 'LANDSAT8', label: 'Landsat 8 (30m)' },
  { value: 'LANDSAT9', label: 'Landsat 9 (30m)' },
];

const CALC_TYPES = [
  { id: 'supervised', label: 'Supervised', icon: Target, desc: 'Classify using your own labeled training samples.' },
  { id: 'unsupervised', label: 'Unsupervised', icon: Shuffle, desc: 'Auto-cluster pixels into k spectral groups.' },
  { id: 'preclassified', label: 'Pre-classified', icon: Database, desc: 'Use a ready-made global land cover product (ESA WorldCover 10m).' },
];

const CLASS_COLOR_PALETTE = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
];

export default function LulcClassification({
  selectedAOI, setSelectedAOI, onStartDrawing, projectInfo, setMapLayers,
  sampleClicks, setSampleClicks, setTrainingSamples, setActiveStep,
}) {
  const [calcType, setCalcType] = useState('supervised');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { layerId, name, visual_url, download_url, legend }

  const [imagerySource, setImagerySource] = useState('SENTINEL2');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxCloudCover, setMaxCloudCover] = useState(20);
  const [numClusters, setNumClusters] = useState(5);
  const [year, setYear] = useState(2021);
  const [trainingGeojson, setTrainingGeojson] = useState(null);

  // ---- Map-based training sample collection ----
  const [classes, setClasses] = useState([]); // [{name, color}]
  const [newClassName, setNewClassName] = useState('');
  const [activeClassIndex, setActiveClassIndex] = useState(null);
  const [mapSamples, setMapSamples] = useState([]); // [{lng, lat, className, color}]
  const [previewLoading, setPreviewLoading] = useState(false);
  const processedClicksRef = useRef(0);

  const classSummary = useMemo(() => {
    const counts = {};
    (trainingGeojson?.features || []).forEach((f) => {
      const name = f.properties?.class_name;
      if (name) counts[name] = (counts[name] || 0) + 1;
    });
    mapSamples.forEach((s) => {
      counts[s.className] = (counts[s.className] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [trainingGeojson, mapSamples]);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [showSavedList, setShowSavedList] = useState(false);
  const [savedResults, setSavedResults] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const boundaryFileInputRef = useRef(null);
  const trainingFileInputRef = useRef(null);
  const hasRestored = useRef(false);

  const toolType = `lulc-${calcType}`;
  const sessionKey = projectInfo?.id ? `mapniti_raster_lulc_${projectInfo.id}` : null;

  useEffect(() => {
    if (!sessionKey || hasRestored.current) return;
    hasRestored.current = true;
    try {
      const raw = localStorage.getItem(sessionKey);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (session.selectedAOI) setSelectedAOI(session.selectedAOI);
      if (session.result) setResult(session.result);
      if (session.calcType) setCalcType(session.calcType);
      if (session.imagerySource) setImagerySource(session.imagerySource);
      if (session.startDate) setStartDate(session.startDate);
      if (session.endDate) setEndDate(session.endDate);
      if (session.maxCloudCover !== undefined) setMaxCloudCover(session.maxCloudCover);
      if (session.numClusters) setNumClusters(session.numClusters);
      if (session.year) setYear(session.year);
      if (session.classes) setClasses(session.classes);
      if (session.mapSamples) setMapSamples(session.mapSamples);
    } catch (e) {
      console.warn('Could not restore saved session:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    localStorage.setItem(sessionKey, JSON.stringify({
      selectedAOI, result, calcType, imagerySource, startDate, endDate, maxCloudCover, numClusters, year, classes, mapSamples,
    }));
  }, [sessionKey, selectedAOI, result, calcType, imagerySource, startDate, endDate, maxCloudCover, numClusters, year, classes, mapSamples]);

  useEffect(() => {
    if (result?.visual_url) {
      setMapLayers([{ layerId: result.layerId, visual_url: result.visual_url }]);
    } else {
      setMapLayers([]);
    }
  }, [result, setMapLayers]);

  // Push collected map samples up to MapWindow (via the shared ToolDashboard bridge) for rendering.
  useEffect(() => {
    setTrainingSamples(mapSamples);
  }, [mapSamples, setTrainingSamples]);

  // Tag each new raw map click with whichever class is currently "armed".
  useEffect(() => {
    if (activeClassIndex === null) return;
    const clicks = sampleClicks || [];
    if (clicks.length <= processedClicksRef.current) return;
    const newClicks = clicks.slice(processedClicksRef.current);
    processedClicksRef.current = clicks.length;
    const activeClass = classes[activeClassIndex];
    if (!activeClass) return;
    setMapSamples((prev) => [
      ...prev,
      ...newClicks.map((c) => ({ lng: c.lng, lat: c.lat, className: activeClass.name, color: activeClass.color })),
    ]);
  }, [sampleClicks, activeClassIndex, classes]);

  // Leaving this tool (switching to NDVI/Calculator/etc.) shouldn't leave stale
  // sample markers or a stuck click-to-sample mode behind for other tools.
  useEffect(() => {
    return () => {
      setTrainingSamples([]);
      setActiveStep('none');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleUploadTrainingSamples = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
          setError('Training file must be a GeoJSON FeatureCollection.');
          return;
        }
        setError(null);
        setTrainingGeojson(parsed);
      } catch (err) {
        console.error('Failed to parse training samples file:', err);
        setError('Could not read that file. Please upload a valid GeoJSON with a class_name property on each feature.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePreviewImagery = async () => {
    if (!selectedAOI || !startDate || !endDate) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/raster/preview-imagery`, {
        geometry: selectedAOI.geojson,
        imagery_source: imagerySource,
        start_date: startDate,
        end_date: endDate,
        max_cloud_cover: maxCloudCover,
      });
      if (response.data.status === 'success') {
        const layer = response.data.layers[0];
        setMapLayers([{ layerId: layer.layerId, visual_url: layer.visual_url }]);
      } else {
        setError(response.data.message || 'Could not load preview imagery.');
      }
    } catch (err) {
      console.error('Preview Imagery Error:', err);
      setError(describeError(err, 'Could not load preview imagery. Please try again.'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const addClass = () => {
    const name = newClassName.trim();
    if (!name || classes.some((c) => c.name === name)) return;
    const color = CLASS_COLOR_PALETTE[classes.length % CLASS_COLOR_PALETTE.length];
    setClasses((prev) => [...prev, { name, color }]);
    setActiveClassIndex(classes.length);
    setActiveStep('place-sample');
    setNewClassName('');
  };

  const removeClass = (index) => {
    const removed = classes[index];
    setClasses((prev) => prev.filter((_, i) => i !== index));
    setMapSamples((prev) => prev.filter((s) => s.className !== removed.name));
    if (activeClassIndex === index) {
      setActiveClassIndex(null);
      setActiveStep('none');
    }
  };

  const toggleSampling = (index) => {
    if (activeClassIndex === index) {
      setActiveClassIndex(null);
      setActiveStep('none');
    } else {
      setActiveClassIndex(index);
      setActiveStep('place-sample');
    }
  };

  const canRunSupervised = classSummary.length >= 2 && classSummary.every((c) => c.count >= 5);

  const handleRun = async () => {
    if (!selectedAOI) return;
    setLoading(true);
    setError(null);
    setIsSaved(false);
    try {
      let response;
      if (calcType === 'supervised') {
        if (!startDate || !endDate || !canRunSupervised) return;
        const combinedFeatures = [
          ...(trainingGeojson?.features || []),
          ...mapSamples.map((s) => ({
            type: 'Feature',
            properties: { class_name: s.className, color: s.color },
            geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
          })),
        ];
        response = await axios.post(`${API_BASE_URL}/api/raster/lulc/supervised`, {
          geometry: selectedAOI.geojson,
          imagery_source: imagerySource,
          start_date: startDate,
          end_date: endDate,
          max_cloud_cover: maxCloudCover,
          training_geojson: { type: 'FeatureCollection', features: combinedFeatures },
        });
      } else if (calcType === 'unsupervised') {
        if (!startDate || !endDate) return;
        response = await axios.post(`${API_BASE_URL}/api/raster/lulc/unsupervised`, {
          geometry: selectedAOI.geojson,
          imagery_source: imagerySource,
          start_date: startDate,
          end_date: endDate,
          max_cloud_cover: maxCloudCover,
          num_clusters: numClusters,
        });
      } else {
        response = await axios.post(`${API_BASE_URL}/api/raster/lulc/preclassified`, {
          geometry: selectedAOI.geojson,
          year,
        });
      }

      if (response.data.status === 'success') {
        const layer = response.data.layers[0];
        setResult({ ...layer, legend: response.data.legend });
        setActiveClassIndex(null);
        setActiveStep('none');
      } else {
        setError(response.data.message || 'Could not run LULC classification.');
      }
    } catch (err) {
      console.error('LULC Error:', err);
      setError(describeError(err, 'Could not run LULC classification. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAnalysis = async () => {
    if (!projectInfo?.id) return;
    setSaving(true);
    setSaveMessage('');
    try {
      await saveResult(projectInfo.id, 'data-management', toolType, selectedAOI?.geojson || null, {
        result, calcType, imagerySource, startDate, endDate, maxCloudCover, numClusters, year, classes, mapSamples,
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
    if (!isSaved && result) {
      const confirmed = window.confirm("This analysis hasn't been saved yet. Starting a new analysis will discard it. Continue anyway?");
      if (!confirmed) return;
    }
    setResult(null);
    setSelectedAOI(null);
    setTrainingGeojson(null);
    setClasses([]);
    setMapSamples([]);
    setActiveClassIndex(null);
    setActiveStep('none');
    if (setSampleClicks) setSampleClicks([]);
    processedClicksRef.current = 0;
    setError(null);
    setIsSaved(true);
    setMapLayers([]);
    if (sessionKey) localStorage.removeItem(sessionKey);
  };

  const handleToggleSavedList = async () => {
    if (!showSavedList) {
      setLoadingSaved(true);
      try {
        const results = await listResults(projectInfo.id);
        setSavedResults(results.filter((r) => r.module === 'data-management' && r.tool_type?.startsWith('lulc-')));
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
    if (data.result) setResult(data.result);
    if (data.calcType) setCalcType(data.calcType);
    if (data.imagerySource) setImagerySource(data.imagerySource);
    if (data.startDate) setStartDate(data.startDate);
    if (data.endDate) setEndDate(data.endDate);
    if (data.maxCloudCover !== undefined) setMaxCloudCover(data.maxCloudCover);
    if (data.numClusters) setNumClusters(data.numClusters);
    if (data.year) setYear(data.year);
    if (data.classes) setClasses(data.classes);
    if (data.mapSamples) setMapSamples(data.mapSamples);
    setIsSaved(true);
    setShowSavedList(false);
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-inner">
      <div className="p-5 space-y-4 flex-grow overflow-y-auto">
        <div className="flex items-center justify-between border-l-2 border-pink-500 pl-2">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">LULC Calculation</p>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={handleToggleSavedList} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-pink-600 transition-colors">
              <History size={11} /> Saved <ChevronDown size={10} className={showSavedList ? 'rotate-180' : ''} />
            </button>
            {(selectedAOI || result) && (
              <button onClick={handleNewAnalysis} title="Clear this and start a new analysis" className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-red-500 transition-colors">
                <RotateCcw size={11} /> New
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
                <button key={r.id} onClick={() => handleLoadSavedResult(r)} className="w-full text-left p-2.5 bg-white border border-slate-100 rounded-xl hover:border-pink-400 transition-all">
                  <p className="text-[10px] font-bold text-slate-700">{r.tool_type}</p>
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
            <button onClick={onStartDrawing} className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-slate-200 rounded-3xl hover:border-pink-500 hover:bg-pink-50 transition-all group active:scale-95">
              <Pencil size={22} className="text-slate-400 group-hover:text-pink-500" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Draw Area</span>
            </button>
            <button onClick={() => boundaryFileInputRef.current?.click()} className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group active:scale-95">
              <Upload size={22} className="text-slate-400 group-hover:text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Upload</span>
            </button>
            <input ref={boundaryFileInputRef} type="file" accept=".geojson,.json" onChange={handleUploadBoundary} className="hidden" />
          </div>
        ) : (
          <div className="space-y-4">
            {!result && (
              <>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Calculation Type</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {CALC_TYPES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setCalcType(t.id)}
                        title={t.desc}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${calcType === t.id ? 'border-pink-500 bg-pink-50' : 'border-slate-100 hover:border-slate-200'}`}
                      >
                        <t.icon size={18} className={calcType === t.id ? 'text-pink-600' : 'text-slate-400'} />
                        <span className="text-[9px] font-black uppercase text-slate-700 text-center leading-tight">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {calcType !== 'preclassified' && (
                  <>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Imagery Source</label>
                      <select value={imagerySource} onChange={(e) => setImagerySource(e.target.value)} className="w-full mt-1 p-3 border-2 border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-pink-500 bg-white">
                        {IMAGERY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full mt-1 p-3 border-2 border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-pink-500 bg-white" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full mt-1 p-3 border-2 border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-pink-500 bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Max Cloud Cover: {maxCloudCover}%</label>
                      <input type="range" min="0" max="100" value={maxCloudCover} onChange={(e) => setMaxCloudCover(Number(e.target.value))} className="w-full mt-1 accent-pink-600" />
                    </div>
                  </>
                )}

                {calcType === 'supervised' && (
                  <div className="space-y-3">
                    <button
                      onClick={handlePreviewImagery}
                      disabled={previewLoading || !startDate || !endDate}
                      className="w-full flex items-center justify-center gap-2 p-3 border-2 border-slate-200 rounded-xl hover:border-pink-500 hover:bg-pink-50 transition-all text-[10px] font-bold uppercase text-slate-600 disabled:opacity-50"
                    >
                      {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview Imagery on Map
                    </button>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Classes &amp; Map Samples</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addClass(); } }}
                          placeholder="e.g. Water, Forest, Urban"
                          className="flex-1 p-2.5 border-2 border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-pink-500 bg-white"
                        />
                        <button onClick={addClass} disabled={!newClassName.trim()} className="px-3 bg-slate-900 text-white rounded-xl disabled:opacity-40">
                          <Plus size={16} />
                        </button>
                      </div>

                      {classes.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-100">
                          {classes.map((c, i) => {
                            const count = classSummary.find((s) => s.name === c.name)?.count || 0;
                            const isActive = activeClassIndex === i;
                            return (
                              <div key={c.name} className="flex items-center justify-between px-3 py-2 gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                                  <span className="text-[10px] font-bold text-slate-700 truncate">{c.name}</span>
                                  <span className={`text-[9px] font-black shrink-0 ${count >= 5 ? 'text-emerald-600' : 'text-rose-500'}`}>{count}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => toggleSampling(i)}
                                    title={isActive ? 'Click the map to add samples — click again to stop' : 'Place samples on the map for this class'}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase ${isActive ? 'bg-pink-600 text-white animate-pulse' : 'bg-white border border-slate-200 text-slate-500 hover:border-pink-300'}`}
                                  >
                                    <MousePointer2 size={10} /> {isActive ? 'Placing…' : 'Place Samples'}
                                  </button>
                                  <button onClick={() => removeClass(i)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg">
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-[9px] text-slate-400 leading-tight">
                        Add a class, click "Place Samples", then click the map (ideally after Preview Imagery) to drop labeled points. At least 2 classes, 5+ samples each — from the map, an upload, or both.
                      </p>
                    </div>

                    <button onClick={() => trainingFileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-2.5 border-2 border-dashed border-slate-200 rounded-xl hover:border-pink-500 hover:bg-pink-50 transition-all text-[10px] font-bold uppercase text-slate-500">
                      <Upload size={14} /> Or Upload Labeled GeoJSON
                    </button>
                    <input ref={trainingFileInputRef} type="file" accept=".geojson,.json" onChange={handleUploadTrainingSamples} className="hidden" />
                    {trainingGeojson && <p className="text-[9px] text-emerald-600 font-bold">Uploaded file included ({trainingGeojson.features.length} feature(s)).</p>}
                  </div>
                )}

                {calcType === 'unsupervised' && (
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Number of Clusters: {numClusters}</label>
                    <input type="range" min="2" max="10" value={numClusters} onChange={(e) => setNumClusters(Number(e.target.value))} className="w-full mt-1 accent-pink-600" />
                  </div>
                )}

                {calcType === 'preclassified' && (
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Year</label>
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full mt-1 p-3 border-2 border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-pink-500 bg-white">
                      <option value={2021}>2021 — ESA WorldCover v200</option>
                      <option value={2020}>2020 — ESA WorldCover v100</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={handleRun}
                  disabled={loading || (calcType !== 'preclassified' && (!startDate || !endDate)) || (calcType === 'supervised' && !canRunSupervised)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <>Run Classification <ArrowRight size={16} /></>}
                </button>
              </>
            )}

            {result && (
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers size={14} className="text-pink-600" />
                      <span className="text-[10px] font-black uppercase text-slate-600 tracking-tighter">{result.name}</span>
                    </div>
                    <button onClick={() => { setResult(null); setMapLayers([]); }} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {result.legend?.length > 0 && (
                    <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {result.legend.map((c) => (
                        <div key={c.class_id} className="px-3 py-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: c.color }} />
                            <span className="text-[10px] font-bold text-slate-700">{c.label}</span>
                          </div>
                          <span className="text-[9px] font-black text-slate-500">{c.area_km2} km²</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {result.download_url && (
                  <a href={result.download_url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-pink-600 hover:underline">Download GeoTIFF</a>
                )}
                <button onClick={handleSaveAnalysis} disabled={saving} className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : saveMessage ? <><CheckCircle2 size={16} /> {saveMessage}</> : <><Save size={16} /> Save Analysis to Project</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
