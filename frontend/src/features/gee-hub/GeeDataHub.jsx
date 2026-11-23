import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Loader2, Download, Database, LineChart as LineIcon, Save, AlertCircle,
  ChevronLeft, Layers, Satellite, Mountain, Trees, CloudRain, Droplets, FlaskConical, Users, Flame, Globe2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AoiPicker from '../../components/common/AoiPicker';
import MapLegend, { downloadCsv } from '../../components/common/MapLegend';
import { CodeBlock } from '../../components/common/Markdown';
import { getGeeCatalog, fetchGeeLayer, fetchGeeTimeseries, fetchGeeCustom } from '../../api/hubApi';
import { saveResult } from '../../api/projectApi';

const CATEGORY_ICONS = {
  'Elevation & Terrain': Mountain,
  'Land Cover': Layers,
  'Satellite Imagery': Satellite,
  Vegetation: Trees,
  'Climate & Weather': CloudRain,
  Water: Droplets,
  Soil: FlaskConical,
  'People & Infrastructure': Users,
  'Air Quality & Hazards': Flame,
};

const describeError = (err, fallback) =>
  err.response?.data?.message || err.response?.data?.detail || err.message || fallback;

function StatGrid({ stats, units }) {
  const rows = [
    ['Mean', stats.mean], ['Median', stats.median], ['Min', stats.min], ['Max', stats.max],
    ['Std dev', stats.std], ['P10', stats.p10], ['P90', stats.p90],
  ].filter(([, v]) => v !== undefined);
  return (
    <div className="grid grid-cols-3 gap-2">
      {stats.total_population !== undefined && (
        <div className="col-span-3 p-3 rounded-xl bg-blue-50">
          <p className="text-[9px] font-black uppercase text-blue-500">Estimated population in AOI</p>
          <p className="text-xl font-black text-blue-900">{stats.total_population.toLocaleString()}</p>
        </div>
      )}
      {rows.map(([label, v]) => (
        <div key={label} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
          <p className="text-[9px] font-bold uppercase text-slate-400">{label}</p>
          <p className="text-[13px] font-black text-slate-800">{v ?? '—'}<span className="text-[9px] text-slate-400 ml-0.5">{units}</span></p>
        </div>
      ))}
      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
        <p className="text-[9px] font-bold uppercase text-slate-400">AOI area</p>
        <p className="text-[13px] font-black text-slate-800">{stats.area_km2}<span className="text-[9px] text-slate-400 ml-0.5">km²</span></p>
      </div>
    </div>
  );
}

function ClassBars({ classes }) {
  return (
    <div className="space-y-1.5">
      {classes.map((c) => (
        <div key={c.class}>
          <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: c.color }} /> {c.label}
            </span>
            <span className="font-mono">{c.area_km2} km² · {c.percent}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max(c.percent, 0.5)}%`, background: c.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimeSeriesPanel({ dataset, geometry, start, end }) {
  const [interval, setIntervalValue] = useState('month');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchGeeTimeseries({ dataset_id: dataset.id, geometry, start_date: start, end_date: end, interval });
      if (res.status === 'success') setData(res);
      else setError(res.message);
    } catch (err) {
      setError(describeError(err, 'Time series failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select value={interval} onChange={(e) => setIntervalValue(e.target.value)} className="flex-1 text-[11px] border border-slate-200 rounded-lg px-2 py-2">
          <option value="month">Monthly</option>
          <option value="year">Yearly</option>
        </select>
        <button onClick={run} disabled={loading || !geometry}
          className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg py-2">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <LineIcon size={12} />} Build series
        </button>
      </div>
      <p className="text-[10px] text-slate-400">Tip: use a long date range (e.g. 5–10 years with Yearly) to see trends.</p>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {data && (
        <>
          <div className="h-48 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={16} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${v} ${data.units}`, dataset.name]} />
                <Line type="monotone" dataKey="value" stroke="#0047AB" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {data.summary && (
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[['Mean', data.summary.mean], ['Min', data.summary.min], ['Max', data.summary.max], ['Trend / step', data.summary.trend_per_step]].map(([l, v]) => (
                <div key={l} className="p-1.5 bg-slate-50 rounded-lg">
                  <p className="text-[8px] font-bold uppercase text-slate-400">{l}</p>
                  <p className="text-[11px] font-black text-slate-700">{v ?? '—'}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => downloadCsv(`${dataset.id}_timeseries.csv`, data.series)}
            className="w-full text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-1.5 flex items-center justify-center gap-1">
            <Download size={11} /> Download series (CSV)
          </button>
        </>
      )}
    </div>
  );
}

function CustomAsset({ geometry, setMapLayers }) {
  const [assetId, setAssetId] = useState('');
  const [band, setBand] = useState('');
  const [reducer, setReducer] = useState('median');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchGeeCustom({ asset_id: assetId, band, reducer, start_date: start || undefined, end_date: end || undefined, geometry });
      if (res.status === 'success') {
        setResult(res);
        setMapLayers([{ layerId: res.layers[0].layerId, visual_url: res.layers[0].visual_url }]);
      } else setError(res.message);
    } catch (err) {
      setError(describeError(err, 'Could not load that asset.'));
    } finally {
      setLoading(false);
    }
  };

  const examples = [
    ['NASA/GPM_L3/IMERG_V07', 'precipitation'],
    ['MODIS/061/MOD16A2', 'ET'],
    ['CSP/ERGo/1_0/Global/SRTM_landforms', 'constant'],
    ['COPERNICUS/S2_SR_HARMONIZED', 'B8'],
  ];

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Load <b>any public Earth Engine Image or ImageCollection</b> by its asset ID. Browse IDs in the{' '}
        <a href="https://developers.google.com/earth-engine/datasets" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">GEE Data Catalog</a>.
      </p>
      <input value={assetId} onChange={(e) => setAssetId(e.target.value)} placeholder="e.g. NASA/GPM_L3/IMERG_V07"
        className="w-full text-[12px] font-mono border border-slate-200 rounded-lg px-3 py-2" />
      <div className="flex flex-wrap gap-1">
        {examples.map(([a, b]) => (
          <button key={a} onClick={() => { setAssetId(a); setBand(b); }} className="text-[9px] font-mono px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600">{a}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={band} onChange={(e) => setBand(e.target.value)} placeholder="Band (blank = first)" className="text-[11px] border border-slate-200 rounded-lg px-2 py-2" />
        <select value={reducer} onChange={(e) => setReducer(e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-2 py-2">
          {['median', 'mean', 'max', 'min', 'sum', 'mosaic'].map((r) => <option key={r} value={r}>Collection → {r}</option>)}
        </select>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-2 py-2" />
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-2 py-2" />
      </div>
      <button onClick={run} disabled={!assetId || !geometry || loading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black text-white bg-[#0047AB] hover:bg-blue-800 disabled:opacity-40">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe2 size={14} />} Fetch asset
      </button>
      {error && <p className="text-[11px] text-red-500 flex gap-1"><AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}</p>}
      {result && (
        <div className="space-y-3">
          <MapLegend legend={result.legend} />
          <StatGrid stats={{ ...result.stats, area_km2: result.stats.area_km2 ?? '—' }} units="" />
          <p className="text-[10px] text-slate-400">Bands: {result.bands.join(', ')}</p>
          {result.layers[0].download_url && (
            <a href={result.layers[0].download_url} className="block text-center text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-lg py-2">Download GeoTIFF</a>
          )}
        </div>
      )}
    </div>
  );
}

export default function GeeDataHub({ selectedAOI, setSelectedAOI, onStartDrawing, setMapLayers, projectInfo }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [tab, setTab] = useState('catalog');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [opacity, setOpacity] = useState(0.85);
  const [section, setSection] = useState('stats');
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    getGeeCatalog().then(setCatalog).catch((err) => setCatalogError(describeError(err, 'Could not load the dataset catalog.')));
    return () => setMapLayers([]);
  }, [setMapLayers]);

  useEffect(() => {
    if (result?.layers?.[0]) {
      setMapLayers([{ layerId: result.layers[0].layerId, visual_url: result.layers[0].visual_url, opacity }]);
    }
  }, [result, opacity, setMapLayers]);

  const categories = useMemo(() => ['All', ...new Set(catalog.map((d) => d.category))], [catalog]);
  const filtered = catalog.filter((d) =>
    (category === 'All' || d.category === category) &&
    (`${d.name} ${d.description} ${d.provider} ${d.asset}`.toLowerCase().includes(query.toLowerCase())));

  const pick = (d) => {
    setSelected(d);
    setStart(d.default_start);
    setEnd(d.default_end);
    setResult(null);
    setError('');
    setSection('stats');
  };

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchGeeLayer({ dataset_id: selected.id, geometry: selectedAOI.geojson, start_date: start, end_date: end });
      if (res.status === 'success') setResult(res);
      else setError(res.message);
    } catch (err) {
      setError(describeError(err, 'Could not fetch this dataset.'));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      await saveResult(projectInfo.id, 'gee-hub', selected.id, selectedAOI?.geojson, { stats: result.stats, start, end, dataset: selected.name });
      setSaveMsg('Saved to project ✓');
    } catch {
      setSaveMsg('Could not save.');
    }
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const statsCsvRows = () => {
    if (!result) return [];
    if (result.stats.classes) return result.stats.classes.map(({ label, area_km2, percent }) => ({ class: label, area_km2, percent }));
    return Object.entries(result.stats).map(([stat, value]) => ({ stat, value, units: result.units }));
  };

  return (
    <div className="p-5 space-y-5">
      <div className="border-b pb-4">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">GEE Data Hub</h2>
        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mt-1">{catalog.length || '30+'} Earth Engine datasets · stats · trends · GeoTIFF</p>
      </div>

      <AoiPicker selectedAOI={selectedAOI} setSelectedAOI={setSelectedAOI} onStartDrawing={onStartDrawing} />

      <div className="flex p-1 bg-slate-100 rounded-xl">
        {[['catalog', 'Dataset catalog'], ['custom', 'Any GEE asset']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 text-[11px] font-bold py-1.5 rounded-lg ${tab === id ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>{label}</button>
        ))}
      </div>

      {tab === 'custom' ? (
        <CustomAsset geometry={selectedAOI?.geojson} setMapLayers={setMapLayers} />
      ) : !selected ? (
        <div className="space-y-3">
          {catalogError && <p className="text-[11px] text-red-500">{catalogError}</p>}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rainfall, DEM, soil, population..."
              className="w-full pl-8 pr-3 py-2 text-[12px] border border-slate-200 rounded-xl" />
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`text-[9px] font-bold px-2 py-1 rounded-full border ${category === c ? 'bg-[#0047AB] text-white border-[#0047AB]' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>{c}</button>
            ))}
          </div>
          {!catalog.length && !catalogError && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-300" /></div>}
          <div className="space-y-2">
            {filtered.map((d) => {
              const Icon = CATEGORY_ICONS[d.category] || Database;
              return (
                <button key={d.id} onClick={() => pick(d)}
                  className="w-full text-left p-3 bg-white border border-slate-100 rounded-2xl hover:border-blue-400 hover:shadow-md transition-all flex gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg h-fit"><Icon size={16} className="text-blue-600" /></div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-800">{d.name}</p>
                    <p className="text-[10px] text-slate-500 leading-snug">{d.description}</p>
                    <p className="text-[9px] text-slate-400 mt-1">{d.provider} · {d.resolution_m} m {d.time_aware ? '· time-based' : ''}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => { setSelected(null); setResult(null); setMapLayers([]); }} className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800">
            <ChevronLeft size={14} /> All datasets
          </button>
          <div>
            <h3 className="text-[15px] font-black text-slate-800">{selected.name}</h3>
            <p className="text-[11px] text-slate-500 mt-1">{selected.description}</p>
            <p className="text-[10px] font-mono text-slate-400 mt-1">{selected.asset} · {selected.resolution_m} m · {selected.units}</p>
          </div>

          {selected.time_aware && (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[9px] font-bold uppercase text-slate-400">Start
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-700" />
              </label>
              <label className="text-[9px] font-bold uppercase text-slate-400">End
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-700" />
              </label>
            </div>
          )}

          <button onClick={run} disabled={!selectedAOI || loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black text-white bg-[#0047AB] hover:bg-blue-800 disabled:opacity-40">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            {selectedAOI ? 'Fetch data for AOI' : 'Select an AOI first'}
          </button>
          {error && <p className="text-[11px] text-red-500 flex gap-1"><AlertCircle size={12} className="shrink-0 mt-0.5" /> {error}</p>}

          {result && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl border border-slate-100 space-y-3">
                <MapLegend legend={result.legend} />
                <label className="flex items-center gap-2 text-[10px] text-slate-500">
                  Opacity
                  <input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="flex-1" />
                </label>
              </div>

              <div className="flex gap-1 border-b">
                {[['stats', 'Statistics'], ...(selected.timeseries ? [['ts', 'Time series']] : []), ['code', 'Code']].map(([id, label]) => (
                  <button key={id} onClick={() => setSection(id)}
                    className={`text-[11px] font-bold px-3 py-1.5 border-b-2 -mb-px ${section === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400'}`}>{label}</button>
                ))}
              </div>

              {section === 'stats' && (
                <div className="space-y-3">
                  {result.stats.classes ? <ClassBars classes={result.stats.classes} /> : <StatGrid stats={result.stats} units={result.units} />}
                  <div className="grid grid-cols-2 gap-2">
                    {result.layers[0].download_url ? (
                      <a href={result.layers[0].download_url} className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg py-2">
                        <Download size={11} /> GeoTIFF
                      </a>
                    ) : (
                      <span className="text-[9px] text-slate-400 text-center py-2">AOI too large for direct GeoTIFF</span>
                    )}
                    <button onClick={() => downloadCsv(`${selected.id}_stats.csv`, statsCsvRows())}
                      className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-2">
                      <Download size={11} /> Stats CSV
                    </button>
                  </div>
                  {projectInfo && (
                    <button onClick={save} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg py-2">
                      <Save size={11} /> {saveMsg || `Save to "${projectInfo.name}"`}
                    </button>
                  )}
                </div>
              )}
              {section === 'ts' && <TimeSeriesPanel dataset={selected} geometry={selectedAOI?.geojson} start={start} end={end} />}
              {section === 'code' && (
                <div>
                  <p className="text-[10px] text-slate-500">Reproduce this layer in your own Python / Jupyter / Colab notebook:</p>
                  <CodeBlock lang="python" code={selected.code_snippet} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
