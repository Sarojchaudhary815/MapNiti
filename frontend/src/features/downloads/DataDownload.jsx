import React, { useEffect, useMemo, useState } from 'react';
import {
  Download, Loader2, Mountain, Layers, Map as MapIcon, Building2, Landmark, CheckSquare, Square, AlertCircle, ExternalLink, Info,
} from 'lucide-react';
import AoiPicker from '../../components/common/AoiPicker';
import {
  getGeeCatalog, downloadRasters, downloadContours, downloadOsm, downloadGeeVector, getBoundaries,
} from '../../api/hubApi';
import { exportGeoJSON, exportKML, exportShapefile, exportCSV, exportText } from '../../utils/geoExport';

const TABS = [
  { id: 'raster', label: 'Rasters', icon: Layers },
  { id: 'contours', label: 'Contours', icon: Mountain },
  { id: 'osm', label: 'OSM vectors', icon: MapIcon },
  { id: 'gee', label: 'Buildings & rivers', icon: Building2 },
  { id: 'boundaries', label: 'Boundaries', icon: Landmark },
];

const OSM_LAYERS = [
  ['roads', 'Roads & paths'], ['buildings', 'Buildings (≤150 km²)'], ['waterways', 'Rivers, streams & canals'],
  ['water', 'Lakes & ponds'], ['landuse', 'Land use'], ['amenities', 'Amenities (schools, health…)'],
  ['railways', 'Railways'], ['power', 'Power lines'], ['bridges', 'Bridges'],
];

const errMsg = (err, fallback) => err.response?.data?.detail || err.response?.data?.message || err.message || fallback;

function Err({ text }) {
  return text ? <p className="text-[11px] text-red-600 bg-red-50 rounded-lg p-2 flex gap-1.5"><AlertCircle size={13} className="shrink-0 mt-0.5" />{text}</p> : null;
}

function RasterTab({ aoi }) {
  const [catalog, setCatalog] = useState([]);
  const [picked, setPicked] = useState(['srtm', 'esa_worldcover']);
  const [crs, setCrs] = useState('UTM');
  const [customEpsg, setCustomEpsg] = useState('');
  const [scale, setScale] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { getGeeCatalog().then(setCatalog).catch(() => setError('Could not load the dataset list.')); }, []);
  const groups = useMemo(() => catalog.reduce((g, d) => ({ ...g, [d.category]: [...(g[d.category] || []), d] }), {}), [catalog]);
  const anyTime = picked.some((id) => catalog.find((d) => d.id === id)?.time_aware);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const run = async () => {
    setBusy(true); setError(''); setFiles(null);
    try {
      const res = await downloadRasters({
        geometry: aoi.geojson, datasets: picked, crs: crs === 'custom' ? customEpsg : crs,
        scale: scale || undefined, start_date: start || undefined, end_date: end || undefined,
      });
      if (res.status === 'success') setFiles(res.files); else setError(res.message);
    } catch (err) { setError(errMsg(err, 'Could not prepare downloads.')); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl p-2 space-y-2">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{cat}</p>
            {items.map((d) => (
              <button key={d.id} onClick={() => toggle(d.id)} className="w-full flex items-start gap-2 text-left py-1">
                {picked.includes(d.id) ? <CheckSquare size={14} className="text-[#0047AB] shrink-0" /> : <Square size={14} className="text-slate-300 shrink-0" />}
                <span className="text-[11px] text-slate-700">{d.name} <span className="text-slate-400">· {d.resolution_m} m</span></span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[9px] font-bold uppercase text-slate-400">Coordinate system
          <select value={crs} onChange={(e) => setCrs(e.target.value)} className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-800">
            <option value="UTM">UTM (auto zone, metres)</option>
            <option value="EPSG:4326">WGS84 lat/long (EPSG:4326)</option>
            <option value="EPSG:32644">UTM 44N (EPSG:32644)</option>
            <option value="EPSG:32645">UTM 45N (EPSG:32645)</option>
            <option value="custom">Custom EPSG…</option>
          </select>
        </label>
        <label className="text-[9px] font-bold uppercase text-slate-400">Resolution (m, optional)
          <input type="number" value={scale} onChange={(e) => setScale(e.target.value)} placeholder="native" className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-800" />
        </label>
        {crs === 'custom' && (
          <label className="col-span-2 text-[9px] font-bold uppercase text-slate-400">EPSG code
            <input value={customEpsg} onChange={(e) => setCustomEpsg(e.target.value)} placeholder="e.g. 3857" className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-800" />
          </label>
        )}
        {anyTime && (
          <>
            <label className="text-[9px] font-bold uppercase text-slate-400">Start (time-based)
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal" />
            </label>
            <label className="text-[9px] font-bold uppercase text-slate-400">End
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal" />
            </label>
          </>
        )}
      </div>
      <button onClick={run} disabled={!aoi || !picked.length || busy}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black text-white bg-[#0047AB] disabled:opacity-40">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Prepare {picked.length} GeoTIFF{picked.length === 1 ? '' : 's'}
      </button>
      <Err text={error} />
      {files && (
        <div className="space-y-1.5">
          {files.map((f) => (f.url ? (
            <a key={f.id} href={f.url} className="block p-2.5 rounded-xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100">
              <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1"><Download size={12} /> {f.name}</p>
              <p className="text-[9px] text-emerald-700">{f.crs} · {f.scale_m} m · {f.units}</p>
              {f.note && <p className="text-[9px] text-amber-700 mt-0.5">{f.note}</p>}
            </a>
          ) : (
            <p key={f.id} className="text-[10px] text-red-600">{f.name}: {f.error}</p>
          )))}
          <p className="text-[9px] text-slate-400">Links are valid for a few hours. Files open directly in QGIS / ArcGIS.</p>
        </div>
      )}
    </div>
  );
}

function ContoursTab({ aoi, setVectorLayers }) {
  const [dem, setDem] = useState('SRTM');
  const [interval, setIntervalM] = useState(10);
  const [major, setMajor] = useState(5);
  const [busy, setBusy] = useState('');
  const [info, setInfo] = useState(null);
  const [gj, setGj] = useState(null);
  const [error, setError] = useState('');

  const req = (format) => downloadContours({ geometry: aoi.geojson, dem, interval, major_every: major, format });

  const preview = async () => {
    setBusy('geojson'); setError('');
    try {
      const res = await req('geojson');
      if (res.status !== 'success') throw new Error(res.message);
      setInfo(res.summary); setGj(res.geojson);
      res.geojson.features.forEach((f) => { f.properties.color = f.properties.type === 'major' ? '#b45309' : '#f59e0b'; f.properties.width = f.properties.type === 'major' ? 1.8 : 0.8; });
      setVectorLayers([{ id: 'contours', name: 'Contours', type: 'line', colorProp: 'color', widthProp: 'width', data: res.geojson, fit: true }]);
    } catch (err) { setError(errMsg(err, 'Contour generation failed.')); } finally { setBusy(''); }
  };

  const dxf = async () => {
    setBusy('dxf'); setError('');
    try {
      const res = await req('dxf');
      if (res.status !== 'success') throw new Error(res.message);
      exportText(res.content, res.filename, 'application/dxf');
      setInfo(res.summary);
    } catch (err) { setError(errMsg(err, 'DXF export failed.')); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">Generate contour lines from a 30 m DEM for any AOI up to 400 km². DXF is in the AOI's UTM zone with 3D elevations — ready for AutoCAD / Civil 3D.</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-[9px] font-bold uppercase text-slate-400">DEM
          <select value={dem} onChange={(e) => setDem(e.target.value)} className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal">
            <option value="SRTM">SRTM 30 m</option><option value="COPERNICUS">Copernicus 30 m</option><option value="ALOS">ALOS 30 m</option>
          </select>
        </label>
        <label className="text-[9px] font-bold uppercase text-slate-400">Interval (m)
          <input type="number" min="1" value={interval} onChange={(e) => setIntervalM(e.target.value)} className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal" />
        </label>
        <label className="text-[9px] font-bold uppercase text-slate-400">Major every
          <input type="number" min="1" value={major} onChange={(e) => setMajor(e.target.value)} className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={preview} disabled={!aoi || busy} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black text-white bg-[#0047AB] disabled:opacity-40">
          {busy === 'geojson' ? <Loader2 size={13} className="animate-spin" /> : <Mountain size={13} />} Generate & preview
        </button>
        <button onClick={dxf} disabled={!aoi || busy} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black text-white bg-amber-600 disabled:opacity-40">
          {busy === 'dxf' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download DXF
        </button>
      </div>
      <Err text={error} />
      {info && (
        <p className="text-[10px] text-slate-600 bg-slate-50 rounded-lg p-2">
          {info.lines} lines · {info.levels} levels · {info.min_elev}–{info.max_elev} m · grid {info.grid_m} m · UTM EPSG:{info.utm_epsg} · {info.dem}
        </p>
      )}
      {gj && (
        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => exportGeoJSON(gj, `contours_${interval}m.geojson`)} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-lg py-2">GeoJSON</button>
          <button onClick={() => exportKML(gj, `contours_${interval}m.kml`)} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-lg py-2">KML</button>
          <button onClick={() => exportShapefile(gj, `contours_${interval}m`)} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-lg py-2">Shapefile</button>
        </div>
      )}
      <p className="text-[9px] text-slate-400 flex gap-1"><Info size={10} className="shrink-0 mt-0.5" />30 m DEMs have ±5–10 m vertical accuracy in hills — fine for planning; use total-station / drone surveys for detailed design.</p>
    </div>
  );
}

function OsmTab({ aoi, setVectorLayers }) {
  const [layer, setLayer] = useState('roads');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true); setError(''); setRes(null);
    try {
      const r = await downloadOsm({ geometry: aoi.geojson, layer });
      if (r.status !== 'success') throw new Error(r.message);
      setRes(r);
      const t = r.geojson.features[0]?.geometry?.type || '';
      setVectorLayers([{ id: 'osm', name: r.name, type: t.includes('Polygon') ? 'fill' : t === 'Point' ? 'circle' : 'line', color: '#e11d48', opacity: t.includes('Polygon') ? 0.35 : 1, data: r.geojson, fit: true }]);
    } catch (err) { setError(errMsg(err, 'OSM download failed.')); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <select value={layer} onChange={(e) => setLayer(e.target.value)} className="w-full text-[12px] border border-slate-200 rounded-lg px-2 py-2">
        {OSM_LAYERS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
      </select>
      <button onClick={run} disabled={!aoi || busy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black text-white bg-[#0047AB] disabled:opacity-40">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <MapIcon size={14} />} Fetch from OpenStreetMap
      </button>
      <Err text={error} />
      {res && (
        <>
          <p className="text-[11px] font-bold text-slate-700">{res.count.toLocaleString()} features · {res.name}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {[['GeoJSON', () => exportGeoJSON(res.geojson, res.filename)], ['KML', () => exportKML(res.geojson, `osm_${res.layer}.kml`)],
              ['Shapefile', () => exportShapefile(res.geojson, `osm_${res.layer}`)], ['CSV', () => exportCSV(res.geojson, `osm_${res.layer}.csv`)]].map(([l, fn]) => (
              <button key={l} onClick={fn} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg py-2">{l}</button>
            ))}
          </div>
        </>
      )}
      <p className="text-[9px] text-slate-400">© OpenStreetMap contributors (ODbL). Shapefile export needs a single geometry type — most layers qualify.</p>
    </div>
  );
}

function GeeVectorTab({ aoi }) {
  const [kind, setKind] = useState('buildings');
  const [format, setFormat] = useState('geojson');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true); setError(''); setRes(null);
    try {
      const r = await downloadGeeVector({ geometry: aoi.geojson, kind, format });
      if (r.status !== 'success') throw new Error(r.message);
      setRes(r);
    } catch (err) { setError(errMsg(err, 'Download failed.')); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-2 py-2">
          <option value="buildings">Google Open Buildings (≤300 km²)</option>
          <option value="rivers">HydroSHEDS rivers (order, discharge)</option>
          <option value="basins">HydroBASINS level 8 catchments</option>
        </select>
        <select value={format} onChange={(e) => setFormat(e.target.value)} className="text-[11px] border border-slate-200 rounded-lg px-2 py-2">
          <option value="geojson">GeoJSON</option><option value="kml">KML</option><option value="shp">Shapefile (zip)</option><option value="csv">CSV</option>
        </select>
      </div>
      <button onClick={run} disabled={!aoi || busy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black text-white bg-[#0047AB] disabled:opacity-40">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />} Prepare download
      </button>
      <Err text={error} />
      {res && (
        <a href={res.url} className="block p-2.5 rounded-xl border border-emerald-100 bg-emerald-50 hover:bg-emerald-100">
          <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1"><Download size={12} /> {res.filename}</p>
          <p className="text-[9px] text-emerald-700">{res.count.toLocaleString()} features</p>
        </a>
      )}
    </div>
  );
}

function BoundariesTab() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getBoundaries('NPL').then((r) => (r.status === 'success' ? setMeta(r.levels) : setError(r.message))).catch((err) => setError(errMsg(err, 'Could not load.')));
  }, []);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500">Official administrative boundaries of Nepal (full resolution). Tip: use the "Nepal" button in the AOI picker to analyse any province, district or palika directly.</p>
      <Err text={error} />
      {!meta && !error && <Loader2 size={16} className="animate-spin text-slate-300" />}
      {meta?.map((l) => (
        <div key={l.level} className="p-2.5 rounded-xl border border-slate-100">
          <p className="text-[11px] font-bold text-slate-800">{l.label} <span className="text-slate-400 font-normal">· {l.count} units · {l.year}</span></p>
          <div className="flex gap-2 mt-1">
            {l.geojson && <a href={l.geojson} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5"><Download size={10} /> GeoJSON</a>}
            {l.zip && <a href={l.zip} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5"><Download size={10} /> Shapefile + all formats (zip)</a>}
          </div>
          <p className="text-[9px] text-slate-400 mt-0.5">{l.source} · {l.license}</p>
        </div>
      ))}
      <a href="https://nationalgeoportal.gov.np" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 flex items-center gap-1">
        Survey Department National Geoportal <ExternalLink size={10} />
      </a>
    </div>
  );
}

export default function DataDownload({ selectedAOI, setSelectedAOI, onStartDrawing, setMapLayers, setVectorLayers }) {
  const [tab, setTab] = useState('raster');
  useEffect(() => { setMapLayers([]); return () => setVectorLayers([]); }, [setMapLayers, setVectorLayers]);
  const needsAoi = tab !== 'boundaries';
  return (
    <div className="p-5 space-y-4">
      <div className="border-b pb-4">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Data Download</h2>
        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">GeoTIFF · DXF · GeoJSON · KML · Shapefile · CSV</p>
      </div>
      {needsAoi && <AoiPicker selectedAOI={selectedAOI} setSelectedAOI={(v) => { setSelectedAOI(v); if (!v) setVectorLayers([]); }} onStartDrawing={onStartDrawing} />}
      <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-xl">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setVectorLayers([]); }} title={t.label}
            className={`flex flex-col items-center gap-0.5 text-[9px] font-bold py-1.5 rounded-lg ${tab === t.id ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      {needsAoi && !selectedAOI && <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2">Choose an area first — draw it, upload GeoJSON, or pick a Nepal province/district/palika.</p>}
      {tab === 'raster' && <RasterTab aoi={selectedAOI} />}
      {tab === 'contours' && <ContoursTab aoi={selectedAOI} setVectorLayers={setVectorLayers} />}
      {tab === 'osm' && <OsmTab aoi={selectedAOI} setVectorLayers={setVectorLayers} />}
      {tab === 'gee' && <GeeVectorTab aoi={selectedAOI} />}
      {tab === 'boundaries' && <BoundariesTab />}
    </div>
  );
}
