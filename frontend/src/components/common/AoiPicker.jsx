import React, { useMemo, useRef, useState } from 'react';
import { Pencil, Upload, CheckCircle2, X, Landmark, Loader2, Search } from 'lucide-react';
import { getBoundaryGeojson } from '../../api/hubApi';

// Draw-or-upload-or-pick AOI control shared by every analysis / download tool.
export function parseGeoJsonBoundary(text) {
  const parsed = typeof text === 'string' ? JSON.parse(text) : text;
  let feature;
  if (parsed.type === 'FeatureCollection') feature = parsed.features[0];
  else if (parsed.type === 'Feature') feature = parsed;
  else feature = { type: 'Feature', properties: {}, geometry: parsed };
  return featureToAoi(feature);
}

export function featureToAoi(feature) {
  const geom = feature.geometry;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      west = Math.min(west, c[0]); east = Math.max(east, c[0]);
      south = Math.min(south, c[1]); north = Math.max(north, c[1]);
    } else c.forEach(walk);
  };
  walk(geom.coordinates);
  return { bbox: { south, north, west, east }, geojson: feature, name: feature.properties?.shapeName };
}

const LEVELS = [
  { id: 'ADM1', label: 'Province' },
  { id: 'ADM2', label: 'District' },
  { id: 'ADM3', label: 'Palika (local level)' },
];
const cache = {};

function BoundaryPicker({ onPick, onClose }) {
  const [level, setLevel] = useState('ADM2');
  const [features, setFeatures] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = async (lvl) => {
    setLevel(lvl);
    setFeatures(null);
    setError('');
    if (cache[lvl]) { setFeatures(cache[lvl]); return; }
    setLoading(true);
    try {
      // Served through our API (geoBoundaries' GitHub links block browser CORS).
      const gj = await getBoundaryGeojson(lvl);
      if (gj.status === 'error') throw new Error(gj.message);
      const feats = gj.features.filter((f) => f.geometry).sort((a, b) => String(a.properties.shapeName).localeCompare(String(b.properties.shapeName)));
      cache[lvl] = feats;
      setFeatures(feats);
    } catch (err) {
      setError(err.message || 'Could not load boundaries.');
    } finally {
      setLoading(false);
    }
  };

  const list = useMemo(() => (features || []).filter((f) => String(f.properties.shapeName).toLowerCase().includes(q.toLowerCase())).slice(0, 80), [features, q]);

  return (
    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nepal boundaries</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={13} /></button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {LEVELS.map((l) => (
          <button key={l.id} onClick={() => load(l.id)}
            className={`text-[10px] font-bold py-1.5 rounded-lg ${level === l.id && (features || loading) ? 'bg-[#0047AB] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{l.label}</button>
        ))}
      </div>
      {loading && <p className="text-[10px] text-slate-500 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Loading boundaries (first time can take ~30 s)…</p>}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      {features && (
        <>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${features.length} names…`}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-slate-200 rounded-lg" />
          </div>
          <div className="max-h-44 overflow-y-auto space-y-0.5">
            {list.map((f, i) => (
              <button key={`${f.properties.shapeName}-${i}`} onClick={() => onPick(featureToAoi(f))}
                className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-white text-slate-700">{f.properties.shapeName}</button>
            ))}
          </div>
          <p className="text-[9px] text-slate-400">Source: geoBoundaries / Open Data Nepal (CC BY 4.0), simplified for speed.</p>
        </>
      )}
      {!features && !loading && <p className="text-[10px] text-slate-400">Choose a level to list names.</p>}
    </div>
  );
}

export default function AoiPicker({ selectedAOI, setSelectedAOI, onStartDrawing }) {
  const fileRef = useRef(null);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        setSelectedAOI(parseGeoJsonBoundary(ev.target.result));
        setError('');
      } catch {
        setError('Could not read that file. Upload a GeoJSON polygon.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (selectedAOI) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
        <div className="flex items-center gap-2 text-emerald-700 text-[11px] font-bold min-w-0">
          <CheckCircle2 size={14} className="shrink-0" />
          <span className="truncate">{selectedAOI.name ? `AOI: ${selectedAOI.name}` : 'Area of interest selected'}</span>
        </div>
        <button onClick={() => setSelectedAOI(null)} className="p-1 text-emerald-600 hover:text-red-500" title="Clear AOI">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <button onClick={onStartDrawing}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold text-white bg-[#0047AB] hover:bg-blue-800 transition-colors">
          <Pencil size={12} /> Draw
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
          <Upload size={12} /> GeoJSON
        </button>
        <button onClick={() => setPicking((p) => !p)}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
          <Landmark size={12} /> Nepal
        </button>
        <input ref={fileRef} type="file" accept=".geojson,.json" className="hidden" onChange={onFile} />
      </div>
      {picking && <BoundaryPicker onPick={(aoi) => { setSelectedAOI(aoi); setPicking(false); }} onClose={() => setPicking(false)} />}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}
