import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Upload, CheckCircle2, X, Landmark, Loader2, Search } from 'lucide-react';
import { getAdminIndex, getAdminFeature, getPalikaWards } from '../../api/hubApi';
import { useT } from '../../i18n';

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

const sel = 'w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white disabled:bg-slate-100 disabled:text-slate-400';
let indexCache = null;
const wardCache = {};

/**
 * Nepal admin picker: Province → District → Palika → Ward, plus a search over
 * every palika and district. The deepest chosen level becomes the AOI.
 */
function BoundaryPicker({ onPick, onClose }) {
  const t = useT();
  const [idx, setIdx] = useState(indexCache);
  const [error, setError] = useState('');
  const [prov, setProv] = useState('');
  const [dist, setDist] = useState('');
  const [pal, setPal] = useState('');
  const [ward, setWard] = useState('');
  const [wards, setWards] = useState(null);
  const [wardState, setWardState] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (indexCache) return;
    getAdminIndex()
      .then((d) => { if (d.status === 'error') throw new Error(d.message); indexCache = d; setIdx(d); })
      .catch((err) => setError(err.message || 'Could not load Nepal boundaries.'));
  }, []);

  const districts = useMemo(() => (idx?.districts || [])
    .filter((d) => prov === '' || d.province === idx.provinces[prov].name)
    .sort((a, b) => a.name.localeCompare(b.name)), [idx, prov]);
  const palikas = useMemo(() => (dist === '' || !idx ? [] : idx.palikas
    .filter((p) => p.district === idx.districts[dist].name && p.province === idx.districts[dist].province))
    .sort((a, b) => String(a.name).localeCompare(String(b.name))), [idx, dist]);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!idx || t.length < 2) return [];
    const d = idx.districts.filter((x) => x.name.toLowerCase().includes(t))
      .map((x) => ({ level: 'district', ...x, sub: `District · ${x.province}` }));
    const p = idx.palikas.filter((x) => String(x.name).toLowerCase().includes(t))
      .map((x) => ({ level: 'palika', ...x, sub: `${x.type} · ${x.district}, ${x.province}` }));
    return [...d, ...p].slice(0, 40);
  }, [idx, q]);

  const choosePalika = (i) => { setPal(i); setWard(''); setWards(null); setWardState(''); };
  const provOf = (name) => String(idx.provinces.findIndex((x) => x.name === name));
  const jumpTo = (h) => {
    setQ('');
    setProv(provOf(h.province));
    if (h.level === 'district') { setDist(String(h.i)); choosePalika(''); return; }
    setDist(String(idx.districts.findIndex((x) => x.name === h.district && x.province === h.province)));
    choosePalika(String(h.i));
  };
  const loadWards = async () => {
    if (wardCache[pal]) { setWards(wardCache[pal]); return; }
    setWardState('loading');
    try {
      const d = await getPalikaWards(pal);
      if (d.status === 'error') throw new Error(d.message);
      wardCache[pal] = d;
      setWards(d);
      setWardState('');
    } catch (err) {
      setWardState(/time|abort/i.test(`${err.message} ${err.code}`)
        ? 'OpenStreetMap did not answer. Try again in a minute.' : (err.message || 'Could not load wards.'));
    }
  };

  const use = async () => {
    setBusy(true);
    setError('');
    try {
      if (ward !== '' && wards) { onPick(featureToAoi(wards.features[ward])); return; }
      const [level, i] = pal !== '' ? ['palika', pal] : dist !== '' ? ['district', dist] : ['province', prov];
      const f = await getAdminFeature(level, i);
      if (f.status === 'error') throw new Error(f.message);
      const aoi = featureToAoi(f);
      const pr = f.properties;
      aoi.name = level === 'palika' ? `${pr.shapeName}, ${pr.district}` : level === 'district' ? `${pr.shapeName} district` : `${pr.shapeName} Province`;
      onPick(aoi);
    } catch (err) {
      setError(err.message || 'Could not load that boundary.');
    } finally {
      setBusy(false);
    }
  };

  const palInfo = pal !== '' && idx ? idx.palikas[pal] : null;
  const useLabel = ward !== '' && wards ? wards.features[ward].properties.shapeName
    : palInfo ? palInfo.name
      : dist !== '' ? `${idx.districts[dist].name} district`
        : prov !== '' ? `${idx.provinces[prov].name} Province` : 'this area';

  return (
    <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('Nepal boundaries')}</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={13} /></button>
      </div>
      {!idx && !error && <p className="text-[10px] text-slate-500 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Loading 753 palikas…</p>}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
      {idx && (
        <>
          <div className="relative">
            <Search size={12} className="absolute left-2 top-2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search a palika or district…')}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-slate-200 rounded-lg" />
          </div>
          {hits.length > 0 && (
            <div className="max-h-44 overflow-y-auto space-y-0.5 bg-white rounded-lg border border-slate-200 p-1">
              {hits.map((h) => (
                <button key={`${h.level}-${h.i}`} onClick={() => jumpTo(h)} className="w-full text-left px-2 py-1 rounded hover:bg-slate-50">
                  <span className="block text-[11px] font-semibold text-slate-700">{h.name}</span>
                  <span className="block text-[9px] text-slate-400">{h.sub}</span>
                </button>
              ))}
            </div>
          )}
          <select aria-label="Province" className={sel} value={prov} onChange={(e) => { setProv(e.target.value); setDist(''); choosePalika(''); }}>
            <option value="">{t('Province…')}</option>
            {idx.provinces.map((p) => <option key={p.i} value={p.i}>{p.name}</option>)}
          </select>
          <select aria-label="District" className={sel} value={dist}
            onChange={(e) => { const v = e.target.value; setDist(v); choosePalika(''); if (v !== '') setProv(provOf(idx.districts[v].province)); }}>
            <option value="">{t('District…')}</option>
            {districts.map((d) => <option key={d.i} value={d.i}>{d.name}</option>)}
          </select>
          <select aria-label="Palika" className={sel} value={pal} disabled={dist === ''} onChange={(e) => choosePalika(e.target.value)}>
            <option value="">{t('Palika (local level)…')}</option>
            {palikas.map((p) => <option key={p.i} value={p.i}>{p.name} · {p.type}</option>)}
          </select>
          {palInfo && (wards ? (
            <select aria-label="Ward" className={sel} value={ward} onChange={(e) => setWard(e.target.value)}>
              <option value="">Whole palika ({wards.features.length}{palInfo.wards ? ` of ${palInfo.wards}` : ''} wards mapped)</option>
              {wards.features.map((f, i) => <option key={f.properties.osm_id || i} value={i}>{f.properties.shapeName}</option>)}
            </select>
          ) : palInfo.wards ? (
            <button onClick={loadWards} disabled={wardState === 'loading'}
              className="w-full text-[11px] font-semibold py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-white flex items-center justify-center gap-1.5 disabled:opacity-60">
              {wardState === 'loading'
                ? <><Loader2 size={11} className="animate-spin" /> Loading wards from OpenStreetMap (up to a minute)…</>
                : `Pick one of ${palInfo.wards} wards`}
            </button>
          ) : null)}
          {wardState && wardState !== 'loading' && <p className="text-[10px] text-amber-600">{wardState}</p>}
          {wards && wards.features.length === 0 && <p className="text-[10px] text-amber-600">OpenStreetMap has no ward boundaries here yet. Use the whole palika or draw the ward.</p>}
          <button onClick={use} disabled={busy || prov === ''}
            className="w-full py-2 rounded-lg text-[11px] font-black text-white bg-[#0047AB] hover:bg-blue-800 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {busy && <Loader2 size={12} className="animate-spin" />} Use {useLabel}
          </button>
          <p className="text-[9px] text-slate-400">Boundaries: Survey Department of Nepal (via younginnovations, MIT). Wards: OpenStreetMap (ODbL).</p>
        </>
      )}
    </div>
  );
}

export default function AoiPicker({ selectedAOI, setSelectedAOI, onStartDrawing }) {
  const t = useT();
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
          <span className="truncate">{selectedAOI.name ? `AOI: ${selectedAOI.name}` : t('Area of interest selected')}</span>
        </div>
        <button onClick={() => setSelectedAOI(null)} className="p-1 text-emerald-600 hover:text-red-500" title={t('Clear AOI')}>
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
          <Pencil size={12} /> {t('Draw')}
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
          <Upload size={12} /> GeoJSON
        </button>
        <button onClick={() => setPicking((p) => !p)}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
          <Landmark size={12} /> {t('Nepal')}
        </button>
        <input ref={fileRef} type="file" accept=".geojson,.json" className="hidden" onChange={onFile} />
      </div>
      {picking && <BoundaryPicker onPick={(aoi) => { setSelectedAOI(aoi); setPicking(false); }} onClose={() => setPicking(false)} />}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}
