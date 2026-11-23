import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Pencil, Upload, Layers, ArrowRight, Loader2, Trash2,
  Info, Save, RotateCcw, CheckCircle2, History, ChevronDown, AlertCircle, Palette, Download,
} from 'lucide-react';
import { saveResult, listResults } from '../../../api/projectApi';
import { PALETTE_OPTIONS } from './paletteOptions';

import { API_BASE_URL } from '../../../config';

const IMAGERY_OPTIONS = [
  { value: 'SENTINEL2', label: 'Sentinel-2 (10m) — Most widely used' },
  { value: 'LANDSAT8', label: 'Landsat 8 (30m)' },
  { value: 'LANDSAT9', label: 'Landsat 9 (30m)' },
];

const AVAILABLE_BANDS = ['RED', 'GREEN', 'BLUE', 'NIR', 'SWIR1', 'SWIR2'];

export default function RasterCalculator({
  selectedAOI, setSelectedAOI, onStartDrawing, projectInfo, setMapLayers,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { layerId, name, visual_url, download_url, stats }
  const [imagerySource, setImagerySource] = useState('SENTINEL2');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxCloudCover, setMaxCloudCover] = useState(20);
  const [expression, setExpression] = useState('(NIR-RED)/(NIR+RED)');
  const [palette, setPalette] = useState('default');
  const [recoloring, setRecoloring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [showSavedList, setShowSavedList] = useState(false);
  const [savedResults, setSavedResults] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const fileInputRef = useRef(null);
  const hasRestored = useRef(false);

  const sessionKey = projectInfo?.id ? `mapniti_raster_calculator_${projectInfo.id}` : null;

  useEffect(() => {
    if (!sessionKey || hasRestored.current) return;
    hasRestored.current = true;
    try {
      const raw = localStorage.getItem(sessionKey);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (session.selectedAOI) setSelectedAOI(session.selectedAOI);
      if (session.result) setResult(session.result);
      if (session.imagerySource) setImagerySource(session.imagerySource);
      if (session.startDate) setStartDate(session.startDate);
      if (session.endDate) setEndDate(session.endDate);
      if (session.maxCloudCover !== undefined) setMaxCloudCover(session.maxCloudCover);
      if (session.expression) setExpression(session.expression);
      if (session.palette) setPalette(session.palette);
    } catch (e) {
      console.warn('Could not restore saved session:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    localStorage.setItem(sessionKey, JSON.stringify({
      selectedAOI, result, imagerySource, startDate, endDate, maxCloudCover, expression, palette,
    }));
  }, [sessionKey, selectedAOI, result, imagerySource, startDate, endDate, maxCloudCover, expression, palette]);

  useEffect(() => {
    if (result?.visual_url) {
      setMapLayers([{ layerId: result.layerId, visual_url: result.visual_url }]);
    } else {
      setMapLayers([]);
    }
  }, [result, setMapLayers]);

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

  const handleRun = async () => {
    if (!selectedAOI || !startDate || !endDate || !expression.trim()) return;
    setLoading(true);
    setError(null);
    setIsSaved(false);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/raster/custom-expression`, {
        geometry: selectedAOI.geojson,
        imagery_source: imagerySource,
        start_date: startDate,
        end_date: endDate,
        max_cloud_cover: maxCloudCover,
        expression,
        palette,
      });
      if (response.data.status === 'success') {
        const layer = response.data.layers[0];
        setResult({ ...layer, stats: response.data.stats });
      } else {
        setError(response.data.message || 'Could not run raster calculation.');
      }
    } catch (err) {
      console.error('Raster Calculator Error:', err);
      setError(describeError(err, 'Could not run raster calculation. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecolor = async (newPalette) => {
    if (!result || !selectedAOI || newPalette === palette) { setPalette(newPalette); return; }
    setPalette(newPalette);
    setRecoloring(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/raster/custom-expression`, {
        geometry: selectedAOI.geojson,
        imagery_source: imagerySource,
        start_date: startDate,
        end_date: endDate,
        max_cloud_cover: maxCloudCover,
        expression,
        palette: newPalette,
      });
      if (response.data.status === 'success') {
        const layer = response.data.layers[0];
        setResult({ ...layer, stats: response.data.stats });
      } else {
        setError(response.data.message || 'Could not recolor that layer.');
      }
    } catch (err) {
      console.error('Recolor Error:', err);
      setError(describeError(err, 'Could not recolor that layer. Please try again.'));
    } finally {
      setRecoloring(false);
    }
  };

  const handleSaveAnalysis = async () => {
    if (!projectInfo?.id) return;
    setSaving(true);
    setSaveMessage('');
    try {
      await saveResult(projectInfo.id, 'data-management', 'raster-calculator', selectedAOI?.geojson || null, {
        result, imagerySource, startDate, endDate, maxCloudCover, expression,
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
        setSavedResults(results.filter((r) => r.module === 'data-management' && r.tool_type === 'raster-calculator'));
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
    if (data.imagerySource) setImagerySource(data.imagerySource);
    if (data.startDate) setStartDate(data.startDate);
    if (data.endDate) setEndDate(data.endDate);
    if (data.maxCloudCover !== undefined) setMaxCloudCover(data.maxCloudCover);
    if (data.expression) setExpression(data.expression);
    if (data.palette) setPalette(data.palette);
    setIsSaved(true);
    setShowSavedList(false);
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-inner">
      <div className="p-5 space-y-4 flex-grow overflow-y-auto">
        <div className="flex items-center justify-between border-l-2 border-pink-500 pl-2">
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">Raster Calculator</p>
            <p className="text-[9px] text-slate-400">Custom band-math on optical imagery</p>
          </div>
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
                  <p className="text-[10px] font-bold text-slate-700 truncate">{r.result_data?.expression || 'Raster calculation'}</p>
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
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group active:scale-95">
              <Upload size={22} className="text-slate-400 group-hover:text-emerald-500" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Upload</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".geojson,.json" onChange={handleUploadBoundary} className="hidden" />
          </div>
        ) : (
          <div className="space-y-4">
            {result && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers size={14} className="text-pink-600 shrink-0" />
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-tighter truncate">{result.name}</span>
                  </div>
                  <button onClick={() => { setResult(null); setMapLayers([]); }} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
                {result.download_url && (
                  <a href={result.download_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 text-[9px] font-bold text-pink-600 hover:underline">
                    <Download size={11} /> Download GeoTIFF
                  </a>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <Palette size={11} /> Color Ramp {recoloring && <Loader2 size={11} className="animate-spin" />}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleRecolor(opt.id)}
                      disabled={recoloring}
                      title={opt.label}
                      className={`h-7 px-1 rounded-lg border-2 overflow-hidden flex items-center disabled:opacity-50 ${palette === opt.id ? 'border-pink-500' : 'border-slate-200'}`}
                      style={opt.colors ? { background: `linear-gradient(to right, ${opt.colors.join(',')})`, minWidth: '36px' } : { minWidth: '36px' }}
                    >
                      {!opt.colors && <span className="text-[8px] font-bold text-slate-500 px-1">Default</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!result && (
              <div className="space-y-3">
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
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expression</label>
                  <textarea
                    value={expression}
                    onChange={(e) => setExpression(e.target.value)}
                    rows={2}
                    className="w-full mt-1 p-3 border-2 border-slate-100 rounded-xl text-[11px] font-mono font-bold text-slate-700 outline-none focus:border-pink-500 bg-white"
                    placeholder="(NIR-RED)/(NIR+RED)"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    Available bands: {AVAILABLE_BANDS.map((b) => <code key={b} className="bg-slate-100 px-1 rounded mr-1">{b}</code>)}
                  </p>
                </div>
                <button onClick={handleRun} disabled={loading || !startDate || !endDate || !expression.trim()} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <>Run Calculation <ArrowRight size={16} /></>}
                </button>
              </div>
            )}

            {result?.stats && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                <Info size={18} className="text-blue-500 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Result Range</p>
                  <p className="text-[12px] font-bold text-blue-700">
                    <span className="text-blue-900 font-black">{result.stats.min_value}</span> to <span className="text-blue-900 font-black">{result.stats.max_value}</span>
                  </p>
                </div>
              </div>
            )}

            {result && (
              <button onClick={handleSaveAnalysis} disabled={saving} className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={16} /> : saveMessage ? <><CheckCircle2 size={16} /> {saveMessage}</> : <><Save size={16} /> Save Analysis to Project</>}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
