import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import {
  Play, Loader2, CheckCircle2, Info, AlertCircle, Pencil, Upload,
  RotateCcw, History, ChevronDown, Save, Settings2, Waves, Gauge, Download,
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line,
} from 'recharts';
import { saveResult, listResults } from '../../../api/projectApi';

import { API_BASE_URL } from '../../../config';

const DISTRIBUTIONS = [
  { value: 'uniform', label: 'Uniform Intensity' },
  { value: 'triangular', label: 'Triangular (peaked storm pattern)' },
];

export default function RainfallRunoffModeling({ selectedAOI, setSelectedAOI, onStartDrawing, projectInfo, setMapLayers }) {
  // This tool is chart-only (no raster overlays of its own) — clear any
  // raster layers a previous tool (e.g. Watershed Delineation) left in the
  // shared map state, otherwise stale/expired GEE tiles keep trying to render.
  useEffect(() => {
    if (setMapLayers) setMapLayers([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState(null);

  const [basin, setBasin] = useState(null); // { area_km2, avg_slope_percent, curve_number, basin_length_km, time_of_concentration_hr }
  const [storm, setStorm] = useState({ rainfall_depth_mm: 80, storm_duration_hr: 6, distribution: 'uniform', ia_ratio: 0.2 });
  const [demSource, setDemSource] = useState('SRTM');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [result, setResult] = useState(null); // { results, series }
  const [runTimestamp, setRunTimestamp] = useState(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSaved, setIsSaved] = useState(true);
  const [showSavedList, setShowSavedList] = useState(false);
  const [savedResults, setSavedResults] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleFetchBasinParams = async () => {
    if (!selectedAOI) return;
    setLoading(true);
    setLoadingStage('params');
    setError(null);
    setIsSaved(false);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/hms/basin-parameters`, {
        geometry: selectedAOI.geojson,
        dem_source: demSource,
      });
      if (response.data.status === 'success') {
        setBasin(response.data.params);
      } else {
        setError(response.data.message || 'Could not derive basin parameters.');
      }
    } catch (err) {
      console.error('Basin params error:', err);
      setError(describeError(err, 'Could not derive basin parameters. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleRunModel = async () => {
    if (!basin) return;
    setLoading(true);
    setLoadingStage('run');
    setError(null);
    setIsSaved(false);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/hms/run-runoff`, {
        area_km2: basin.area_km2,
        curve_number: basin.curve_number,
        time_of_concentration_hr: basin.time_of_concentration_hr,
        rainfall_depth_mm: storm.rainfall_depth_mm,
        storm_duration_hr: storm.storm_duration_hr,
        distribution: storm.distribution,
        ia_ratio: storm.ia_ratio,
      });
      if (response.data.status === 'success') {
        setResult(response.data);
        setRunTimestamp(new Date().toISOString());
      } else {
        setError(response.data.message || 'Could not run the rainfall-runoff model.');
      }
    } catch (err) {
      console.error('Run runoff error:', err);
      setError(describeError(err, 'Could not run the rainfall-runoff model. Please try again.'));
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleSaveAnalysis = async () => {
    if (!projectInfo?.id || !result) return;
    setSaving(true);
    setSaveMessage('');
    try {
      await saveResult(projectInfo.id, 'hydrology', 'runoff', selectedAOI?.geojson || null, {
        basin, storm, result, runTimestamp,
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
    setBasin(null);
    setResult(null);
    setRunTimestamp(null);
    setSelectedAOI(null);
    setError(null);
    setIsSaved(true);
  };

  const handleToggleSavedList = async () => {
    if (!showSavedList) {
      setLoadingSaved(true);
      try {
        const results = await listResults(projectInfo.id);
        setSavedResults(results.filter((r) => r.module === 'hydrology' && r.tool_type === 'runoff'));
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
    if (data.basin) setBasin(data.basin);
    if (data.storm) setStorm(data.storm);
    if (data.result) setResult(data.result);
    setRunTimestamp(data.runTimestamp || r.created_at || null);
    setIsSaved(true);
    setShowSavedList(false);
  };

  return (
    <div className="p-5 space-y-5 animate-in fade-in">
      <div className="flex items-center justify-between border-l-2 border-indigo-500 pl-2">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">
          Rainfall-Runoff Modeling
        </p>
        <div className="flex items-center gap-3">
          <button onClick={handleToggleSavedList} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-indigo-600 transition-colors">
            <History size={11} /> Saved <ChevronDown size={10} className={showSavedList ? 'rotate-180' : ''} />
          </button>
          {selectedAOI && (
            <button onClick={handleDownloadBoundary} title="Download the study area boundary" className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-emerald-600 transition-colors">
              <Download size={11} /> Boundary
            </button>
          )}
          {(selectedAOI || result) && (
            <button onClick={handleNewAnalysis} title="Clear this and start a new analysis" className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-red-500 transition-colors">
              <RotateCcw size={11} /> New Analysis
            </button>
          )}
        </div>
      </div>

      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3 text-indigo-800 text-[11px]">
        <Info size={18} className="shrink-0" />
        <p>HEC-HMS-style lumped basin model: SCS Curve Number loss + SCS synthetic Unit Hydrograph. Curve Number is auto-estimated from land cover and soil texture — review it before running.</p>
      </div>

      {showSavedList && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 max-h-48 overflow-y-auto">
          {loadingSaved ? (
            <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-400" size={18} /></div>
          ) : savedResults.length === 0 ? (
            <p className="text-[10px] text-slate-400 font-bold text-center py-2">No saved analyses yet</p>
          ) : (
            savedResults.map((r) => (
              <button key={r.id} onClick={() => handleLoadSavedResult(r)} className="w-full text-left p-2.5 bg-white border border-slate-100 rounded-xl hover:border-indigo-400 transition-all">
                <p className="text-[10px] font-bold text-slate-700">
                  Peak Q: {r.result_data?.result?.results?.peak_discharge_cms ?? '—'} m³/s
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
          <button onClick={onStartDrawing} className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-slate-200 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group active:scale-95">
            <Pencil size={22} className="text-slate-400 group-hover:text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Draw Basin</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-slate-200 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group active:scale-95">
            <Upload size={22} className="text-slate-400 group-hover:text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Upload</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".geojson,.json" onChange={handleUploadBoundary} className="hidden" />
        </div>
      ) : (
        <div className="space-y-5">

          {/* STEP 2 — Basin Parameters */}
          {!basin ? (
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">DEM Source</label>
              <select value={demSource} onChange={(e) => setDemSource(e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-500 bg-white">
                <option value="SRTM">SRTM (30m)</option>
                <option value="COPERNICUS">Copernicus GLO-30 (30m)</option>
                <option value="ALOS">ALOS AW3D30 (30m)</option>
                <option value="NASADEM">NASADEM (30m)</option>
              </select>
              <button onClick={handleFetchBasinParams} disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                {loading && loadingStage === 'params' ? <Loader2 className="animate-spin" size={16} /> : <>Fetch Basin Parameters <Gauge size={16} /></>}
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-2">
                <Gauge size={14} className="text-indigo-600" />
                <span className="text-[10px] font-black uppercase text-slate-600 tracking-tighter">Basin Parameters</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Area</p>
                  <p className="text-[12px] font-bold text-slate-700">{basin.area_km2} km²</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Avg. Slope</p>
                  <p className="text-[12px] font-bold text-slate-700">{basin.avg_slope_percent}%</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Curve Number (editable)</p>
                  <input type="number" value={basin.curve_number} min="30" max="100"
                    onChange={(e) => setBasin({ ...basin, curve_number: parseFloat(e.target.value) || basin.curve_number })}
                    className="w-full text-[12px] font-bold text-slate-700 outline-none bg-transparent" />
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Time of Conc. (hr, editable)</p>
                  <input type="number" step="0.1" value={basin.time_of_concentration_hr}
                    onChange={(e) => setBasin({ ...basin, time_of_concentration_hr: parseFloat(e.target.value) || basin.time_of_concentration_hr })}
                    className="w-full text-[12px] font-bold text-slate-700 outline-none bg-transparent" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Design Storm */}
          {basin && !result && (
            <div className="space-y-3">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Waves size={12} /> Design Storm
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500">Rainfall Depth (mm)</label>
                  <input type="number" value={storm.rainfall_depth_mm} onChange={(e) => setStorm({ ...storm, rainfall_depth_mm: parseFloat(e.target.value) || 0 })} className="w-full text-[11px] font-bold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500">Storm Duration (hr)</label>
                  <input type="number" value={storm.storm_duration_hr} onChange={(e) => setStorm({ ...storm, storm_duration_hr: parseFloat(e.target.value) || 0 })} className="w-full text-[11px] font-bold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">Temporal Distribution</label>
                <select value={storm.distribution} onChange={(e) => setStorm({ ...storm, distribution: e.target.value })} className="w-full text-[11px] font-bold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500">
                  {DISTRIBUTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-indigo-600">
                <Settings2 size={11} /> Advanced <ChevronDown size={10} className={showAdvanced ? 'rotate-180' : ''} />
              </button>
              {showAdvanced && (
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-500">Initial Abstraction Ratio (Ia/S)</label>
                  <input type="number" step="0.01" value={storm.ia_ratio} onChange={(e) => setStorm({ ...storm, ia_ratio: parseFloat(e.target.value) || 0.2 })} className="w-full text-[11px] font-bold p-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500" />
                </div>
              )}

              <button onClick={handleRunModel} disabled={loading} className="w-full py-4 rounded-2xl text-xs font-black flex items-center justify-center gap-3 bg-indigo-600 text-white shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all">
                {loading && loadingStage === 'run' ? <><Loader2 size={16} className="animate-spin" /> MODELING...</> : <><Play size={16} fill="currentColor" /> RUN RUNOFF MODEL</>}
              </button>
            </div>
          )}

          {/* STEP 4 — Results */}
          {result && (
            <div className="space-y-4">
              {runTimestamp && (
                <p className="text-[9px] font-bold text-slate-400">
                  Run: {new Date(runTimestamp).toLocaleString()}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-[8px] font-black text-indigo-400 uppercase">Peak Discharge</p>
                  <p className="text-[15px] font-black text-indigo-900">{result.results.peak_discharge_cms} <span className="text-[9px] font-bold">m³/s</span></p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-[8px] font-black text-indigo-400 uppercase">Time to Peak</p>
                  <p className="text-[15px] font-black text-indigo-900">{result.results.time_to_peak_hr} <span className="text-[9px] font-bold">hr</span></p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Runoff Volume</p>
                  <p className="text-[13px] font-black text-slate-700">{result.results.runoff_volume_m3.toLocaleString()} <span className="text-[9px] font-bold">m³</span></p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Runoff Depth</p>
                  <p className="text-[13px] font-black text-slate-700">{result.results.runoff_depth_mm} <span className="text-[9px] font-bold">mm</span></p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-3">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Hyetograph &amp; Hydrograph</p>
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={result.series} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="t_hr" tick={{ fontSize: 9 }} label={{ value: 'hr', position: 'insideBottomRight', fontSize: 9, offset: -2 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} />
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Bar yAxisId="left" dataKey="rainfall_mm" name="Rainfall (mm)" fill="#a5b4fc" barSize={4} />
                    <Line yAxisId="right" dataKey="discharge_cms" name="Discharge (m³/s)" stroke="#4338ca" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[10px] text-blue-800 space-y-1">
                <p>Total Rainfall: <b>{result.results.total_rainfall_mm} mm</b> · Total Excess: <b>{result.results.total_excess_mm} mm</b></p>
                <p>Potential Retention (S): <b>{result.results.potential_retention_s_mm} mm</b> · Initial Abstraction: <b>{result.results.initial_abstraction_mm} mm</b></p>
                <p>Unit Hydrograph Tp: <b>{result.results.unit_hydrograph_tp_hr} hr</b> · Tb: <b>{result.results.unit_hydrograph_tb_hr} hr</b></p>
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
  );
}
