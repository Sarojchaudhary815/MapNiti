import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import { Upload, Loader2, Download, Trash2, Info } from 'lucide-react';
import { exportGeoJSON, exportKML, exportShapefile, exportCSV } from '../../../utils/geoExport';

// Client-side vector toolkit (Turf.js): load GeoJSON / CSV points, inspect
// attributes, run geoprocessing, export to GeoJSON / KML / Shapefile / CSV.

const OPS = [
  { id: 'measure', label: 'Add area / length fields', desc: 'Adds area_m2, area_ropani, length_m, perimeter_m to every feature.' },
  { id: 'buffer', label: 'Buffer', desc: 'Zone at a fixed distance around each feature (setbacks, right-of-way).', param: { key: 'distance', label: 'Distance (m)', default: 30 } },
  { id: 'dissolve', label: 'Dissolve (union)', desc: 'Merge all polygons into one outline.' },
  { id: 'centroid', label: 'Centroids', desc: 'Centre point of each feature.' },
  { id: 'hull', label: 'Convex hull', desc: 'Smallest convex polygon around all features.' },
  { id: 'bbox', label: 'Bounding box', desc: 'Rectangle covering the layer (extent).' },
  { id: 'simplify', label: 'Simplify', desc: 'Reduce vertices for lighter web maps.', param: { key: 'tolerance', label: 'Tolerance (m)', default: 5 } },
  { id: 'clip', label: 'Clip to AOI', desc: 'Keep only the parts inside the current AOI.' },
  { id: 'grid', label: 'Hex grid over layer', desc: 'Hexagon grid with feature counts — density mapping.', param: { key: 'cell', label: 'Cell size (m)', default: 200 } },
];

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const head = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const lonKey = head.find((h) => /^(lon|lng|long|longitude|x)$/i.test(h));
  const latKey = head.find((h) => /^(lat|latitude|y)$/i.test(h));
  if (!lonKey || !latKey) throw new Error('CSV needs lon/lat (or longitude/latitude, x/y) columns in WGS84.');
  const feats = lines.slice(1).map((l) => {
    const vals = l.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const props = Object.fromEntries(head.map((h, i) => [h, vals[i]]));
    return turf.point([parseFloat(props[lonKey]), parseFloat(props[latKey])], props);
  }).filter((f) => f.geometry.coordinates.every(Number.isFinite));
  return turf.featureCollection(feats);
}

function normalise(gj) {
  if (gj.type === 'FeatureCollection') return gj;
  if (gj.type === 'Feature') return turf.featureCollection([gj]);
  return turf.featureCollection([turf.feature(gj)]);
}

function summarise(fc) {
  const types = {};
  let area = 0;
  let length = 0;
  fc.features.forEach((f) => {
    const t = f.geometry?.type || 'None';
    types[t] = (types[t] || 0) + 1;
    if (/Polygon/.test(t)) area += turf.area(f);
    if (/LineString/.test(t)) length += turf.length(f, { units: 'meters' });
  });
  const fields = {};
  fc.features.forEach((f) => Object.entries(f.properties || {}).forEach(([k, v]) => {
    fields[k] = fields[k] || { numeric: 0, values: [] };
    const n = parseFloat(v);
    if (v !== '' && v !== null && Number.isFinite(n)) { fields[k].numeric += 1; fields[k].values.push(n); }
  }));
  const fieldStats = Object.entries(fields).map(([k, v]) => {
    if (v.numeric < fc.features.length * 0.8 || !v.values.length) return { field: k, type: 'text' };
    const s = [...v.values].sort((a, b) => a - b);
    return { field: k, type: 'number', min: s[0], max: s[s.length - 1], mean: s.reduce((a, b) => a + b, 0) / s.length };
  });
  return { count: fc.features.length, types, area, length, bbox: fc.features.length ? turf.bbox(fc) : null, fieldStats };
}

export default function VectorDataAnalysis({ selectedAOI, setVectorLayers }) {
  const [layer, setLayer] = useState(null);   // { name, fc }
  const [result, setResult] = useState(null); // { name, fc }
  const [op, setOp] = useState('measure');
  const [param, setParam] = useState({ distance: 30, tolerance: 5, cell: 200 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => () => setVectorLayers?.([]), [setVectorLayers]);

  useEffect(() => {
    const layers = [];
    if (layer) layers.push({ id: 'vec-input', name: layer.name, type: /Polygon/.test(layer.fc.features[0]?.geometry?.type) ? 'fill' : /Point/.test(layer.fc.features[0]?.geometry?.type) ? 'circle' : 'line', color: '#6366f1', opacity: 0.25, data: layer.fc, fit: !result });
    if (result) layers.push({ id: 'vec-result', name: result.name, type: /Polygon/.test(result.fc.features[0]?.geometry?.type) ? 'fill' : /Point/.test(result.fc.features[0]?.geometry?.type) ? 'circle' : 'line', color: '#f97316', opacity: 0.35, data: result.fc, fit: true });
    setVectorLayers?.(layers);
  }, [layer, result, setVectorLayers]);

  const summary = useMemo(() => (layer ? summarise(layer.fc) : null), [layer]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const fc = file.name.toLowerCase().endsWith('.csv') ? parseCsv(text) : normalise(JSON.parse(text));
        if (!fc.features.length) throw new Error('No features found.');
        setLayer({ name: file.name.replace(/\.[^.]+$/, ''), fc });
        setResult(null);
        setError('');
      } catch (err) {
        setError(err.message || 'Could not read the file. Use GeoJSON (WGS84) or a CSV with lon/lat.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const run = () => {
    setBusy(true);
    setError('');
    setTimeout(() => {
      try {
        const fc = layer.fc;
        let out;
        if (op === 'measure') {
          out = turf.featureCollection(fc.features.map((f) => {
            const t = f.geometry?.type || '';
            const props = { ...f.properties };
            if (/Polygon/.test(t)) {
              const a = turf.area(f);
              props.area_m2 = +a.toFixed(2);
              props.area_ha = +(a / 1e4).toFixed(4);
              props.area_ropani = +(a / 508.72).toFixed(3);
              props.perimeter_m = +turf.length(turf.polygonToLine(f), { units: 'meters' }).toFixed(2);
            }
            if (/LineString/.test(t)) props.length_m = +turf.length(f, { units: 'meters' }).toFixed(2);
            return { ...f, properties: props };
          }));
        } else if (op === 'buffer') {
          out = turf.buffer(fc, Number(param.distance), { units: 'meters' });
        } else if (op === 'dissolve') {
          const polys = fc.features.filter((f) => /Polygon/.test(f.geometry?.type));
          if (polys.length < 1) throw new Error('Dissolve needs polygon features.');
          const u = polys.length === 1 ? polys[0] : turf.union(turf.featureCollection(polys));
          out = turf.featureCollection([u]);
        } else if (op === 'centroid') {
          out = turf.featureCollection(fc.features.map((f) => turf.centroid(f, { properties: f.properties })));
        } else if (op === 'hull') {
          const h = turf.convex(turf.explode(fc));
          out = turf.featureCollection(h ? [h] : []);
        } else if (op === 'bbox') {
          out = turf.featureCollection([turf.bboxPolygon(turf.bbox(fc))]);
        } else if (op === 'simplify') {
          // tolerance is in degrees for turf.simplify; ~1e-5 deg ≈ 1.1 m
          out = turf.simplify(fc, { tolerance: Number(param.tolerance) / 111320, highQuality: true });
        } else if (op === 'clip') {
          if (!selectedAOI) throw new Error('Draw or upload an AOI first (top of the panel / map).');
          const aoi = selectedAOI.geojson.type === 'Feature' ? selectedAOI.geojson : turf.feature(selectedAOI.geojson);
          const kept = [];
          fc.features.forEach((f) => {
            const t = f.geometry?.type || '';
            if (/Point/.test(t)) { if (turf.booleanPointInPolygon(f, aoi)) kept.push(f); return; }
            if (/Polygon/.test(t)) { const c = turf.intersect(turf.featureCollection([f, aoi])); if (c) kept.push({ ...c, properties: f.properties }); return; }
            if (/LineString/.test(t)) { const parts = turf.lineSplit(f, turf.polygonToLine(aoi)); const segs = parts.features.length ? parts.features : [f]; segs.forEach((s) => { const mid = turf.along(s, turf.length(s) / 2); if (turf.booleanPointInPolygon(mid, aoi)) kept.push({ ...s, properties: f.properties }); }); }
          });
          out = turf.featureCollection(kept);
        } else if (op === 'grid') {
          const grid = turf.hexGrid(turf.bbox(fc), Number(param.cell) / 1000, { units: 'kilometers' });
          const pts = turf.featureCollection(fc.features.map((f) => (f.geometry.type === 'Point' ? f : turf.centroid(f))));
          grid.features.forEach((cell) => { cell.properties = { count: turf.pointsWithinPolygon(pts, cell).features.length }; });
          const max = Math.max(1, ...grid.features.map((c) => c.properties.count));
          grid.features = grid.features.filter((c) => c.properties.count > 0).map((c) => ({ ...c, properties: { ...c.properties, color: `rgba(234,88,12,${0.2 + 0.8 * c.properties.count / max})` } }));
          out = grid;
        }
        if (!out?.features?.length) throw new Error('The operation produced no features.');
        setResult({ name: `${layer.name}_${op}`, fc: out });
      } catch (err) {
        setError(err.message || 'Operation failed.');
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const current = OPS.find((o) => o.id === op);
  const target = result || layer;

  return (
    <div className="p-5 space-y-4">
      <p className="text-[11px] text-slate-500">Load a vector layer (GeoJSON in WGS84, or CSV with lon/lat), inspect it, run geoprocessing and export to any format. Everything runs in your browser.</p>
      <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700">
        <Upload size={13} /> {layer ? 'Load another file' : 'Load GeoJSON / CSV'}
      </button>
      <input ref={fileRef} type="file" accept=".geojson,.json,.csv" className="hidden" onChange={onFile} />
      {error && <p className="text-[11px] text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

      {summary && (
        <div className="p-3 rounded-xl border border-slate-100 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-black text-slate-800">{layer.name}</p>
            <button onClick={() => { setLayer(null); setResult(null); }} className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
          </div>
          <p className="text-[10px] text-slate-500">{summary.count} features · {Object.entries(summary.types).map(([t, n]) => `${n} ${t}`).join(', ')}</p>
          {summary.area > 0 && <p className="text-[10px] text-slate-500">Total area {(summary.area / 1e4).toFixed(3)} ha ({(summary.area / 508.72).toFixed(2)} ropani)</p>}
          {summary.length > 0 && <p className="text-[10px] text-slate-500">Total length {(summary.length / 1000).toFixed(3)} km</p>}
          {summary.fieldStats.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] mt-1">
                <thead><tr className="text-slate-400"><th className="text-left">Field</th><th className="text-left">Type</th><th className="text-right">Min</th><th className="text-right">Mean</th><th className="text-right">Max</th></tr></thead>
                <tbody>
                  {summary.fieldStats.slice(0, 15).map((f) => (
                    <tr key={f.field} className="border-t border-slate-50">
                      <td className="font-bold text-slate-700 pr-2">{f.field}</td><td className="text-slate-400">{f.type}</td>
                      <td className="text-right">{f.min != null ? +f.min.toFixed(2) : ''}</td><td className="text-right">{f.mean != null ? +f.mean.toFixed(2) : ''}</td><td className="text-right">{f.max != null ? +f.max.toFixed(2) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {layer && (
        <div className="space-y-2">
          <select value={op} onChange={(e) => setOp(e.target.value)} className="w-full text-[12px] border border-slate-200 rounded-lg px-2 py-2">
            {OPS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <p className="text-[10px] text-slate-500 flex gap-1"><Info size={11} className="shrink-0 mt-0.5" />{current.desc}</p>
          {current.param && (
            <label className="block text-[9px] font-bold uppercase text-slate-400">{current.param.label}
              <input type="number" value={param[current.param.key]} onChange={(e) => setParam((p) => ({ ...p, [current.param.key]: e.target.value }))}
                className="mt-1 w-full text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-800" />
            </label>
          )}
          <button onClick={run} disabled={busy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-black text-white bg-[#0047AB] disabled:opacity-40">
            {busy && <Loader2 size={13} className="animate-spin" />} Run {current.label}
          </button>
        </div>
      )}

      {result && <p className="text-[11px] font-bold text-orange-700">Result: {result.fc.features.length} features (orange on map)</p>}

      {target && (
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Export {result ? 'result' : 'layer'}</p>
          <div className="grid grid-cols-4 gap-1.5">
            {[['GeoJSON', () => exportGeoJSON(target.fc, `${target.name}.geojson`)], ['KML', () => exportKML(target.fc, `${target.name}.kml`)],
              ['Shapefile', () => exportShapefile(target.fc, target.name)], ['CSV', () => exportCSV(target.fc, `${target.name}.csv`)]].map(([l, fn]) => (
              <button key={l} onClick={fn} className="flex items-center justify-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg py-2"><Download size={10} /> {l}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
