import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { X, Loader2, Play, MoveHorizontal } from 'lucide-react';
import { submitJob } from '../../api/hubApi';
import { trackJob, getJobState, subscribe, markSeen } from './jobStore';
import MapLegend from '../../components/common/MapLegend';

const IMAGERY = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'];

function styleWith(layer) {
  const sources = { base: { type: 'raster', tiles: IMAGERY, tileSize: 256, attribution: 'Esri' } };
  const layers = [{ id: 'base', type: 'raster', source: 'base' }];
  if (layer?.visual_url) {
    sources.result = { type: 'raster', tiles: [layer.visual_url], tileSize: 256 };
    layers.push({ id: 'result', type: 'raster', source: 'result', paint: { 'raster-opacity': 0.85 } });
  }
  return { version: 8, sources, layers };
}

function addAoi(map, aoi) {
  if (!aoi?.geojson) return;
  map.addSource('aoi', { type: 'geojson', data: aoi.geojson });
  map.addLayer({ id: 'aoi', type: 'line', source: 'aoi', paint: { 'line-color': '#facc15', 'line-width': 2 } });
}

function Param({ p, value, onChange }) {
  const cls = 'w-full text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white';
  if (p.type === 'select') {
    return (
      <select className={cls} value={value} onChange={(e) => onChange(isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value))}>
        {p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (p.type === 'number') {
    return <input type="number" className={cls} value={value} min={p.min} max={p.max} step={p.step}
      onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
  }
  return null; // other input kinds (checkboxes, samples) stay as in the main run
}

/**
 * Before / after swipe: the current result on the right, the same tool run with
 * other inputs (e.g. another year) on the left, on two synced maps split by a
 * draggable bar.
 */
export default function SwipeCompare({ onClose, toolId, cfg, values, result, selectedAOI }) {
  const wrap = useRef(null);
  const leftEl = useRef(null);
  const rightEl = useRef(null);
  const maps = useRef({});
  const [pos, setPos] = useState(50);
  const editable = (cfg?.params || []).filter((p) => p.type === 'select' || p.type === 'number');
  const [before, setBefore] = useState(() => {
    const v = { ...values };
    const year = editable.find((p) => /year|epoch|start/i.test(p.key));
    if (year) {
      if (year.type === 'select') {
        const opts = year.options.map((o) => o.value);
        v[year.key] = opts[Math.max(0, opts.indexOf(values[year.key]) - 1)] ?? opts[0];
      } else {
        v[year.key] = Math.max(year.min ?? -Infinity, Number(values[year.key]) - (year.key.includes('year') ? 5 : 1));
      }
    }
    return v;
  });
  const [beforeResult, setBeforeResult] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState('');
  const afterLayer = result.layers?.[0];

  // two maps, kept in step
  useEffect(() => {
    const b = selectedAOI?.bbox;
    const common = { attributionControl: false, ...(b ? { bounds: [[b.west, b.south], [b.east, b.north]], fitBoundsOptions: { padding: 30 } } : { center: [84.1, 28.4], zoom: 7 }) };
    const left = new maplibregl.Map({ container: leftEl.current, style: styleWith(null), ...common });
    const right = new maplibregl.Map({ container: rightEl.current, style: styleWith(afterLayer), ...common });
    right.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    left.on('load', () => addAoi(left, selectedAOI));
    right.on('load', () => addAoi(right, selectedAOI));
    let syncing = false;
    const sync = (from, to) => () => {
      if (syncing) return;
      syncing = true;
      to.jumpTo({ center: from.getCenter(), zoom: from.getZoom(), bearing: from.getBearing(), pitch: from.getPitch() });
      syncing = false;
    };
    left.on('move', sync(left, right));
    right.on('move', sync(right, left));
    maps.current = { left, right };
    return () => { left.remove(); right.remove(); };
  }, [afterLayer, selectedAOI]);

  // show the "before" layer when it arrives
  useEffect(() => {
    const left = maps.current.left;
    const layer = beforeResult?.layers?.[0];
    if (!left || !layer?.visual_url) return;
    const apply = () => {
      if (left.getLayer('result')) left.removeLayer('result');
      if (left.getSource('result')) left.removeSource('result');
      left.addSource('result', { type: 'raster', tiles: [layer.visual_url], tileSize: 256 });
      left.addLayer({ id: 'result', type: 'raster', source: 'result', paint: { 'raster-opacity': 0.85 } }, left.getLayer('aoi') ? 'aoi' : undefined);
    };
    if (left.isStyleLoaded()) apply(); else left.once('load', apply);
  }, [beforeResult]);

  // follow the "before" job
  useEffect(() => {
    if (!jobId) return undefined;
    const check = () => {
      const j = getJobState(jobId);
      if (!j || j.status === 'queued' || j.status === 'running') return;
      if (j.status === 'done') setBeforeResult(j.result); else setError(j.error || 'The comparison run failed.');
      markSeen(jobId);
      setJobId(null);
    };
    check();
    return subscribe(check);
  }, [jobId]);

  const runBefore = async () => {
    setError('');
    setBeforeResult(null);
    try {
      const res = await submitJob(toolId, { ...before, geometry: selectedAOI?.geojson, aoi_name: selectedAOI?.name });
      const job = trackJob(res, { toolId, aoiName: selectedAOI?.name });
      if (res.status === 'done') { setBeforeResult(res.result); markSeen(job.id); } else setJobId(job.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not start the comparison run.');
    }
  };
  useEffect(() => { runBefore(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const drag = (e) => {
    const rect = wrap.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    setPos(Math.max(2, Math.min(98, (x / rect.width) * 100)));
  };
  const startDrag = (e) => {
    e.preventDefault();
    const move = (ev) => drag(ev);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
  };
  const describe = (v) => editable.map((p) => {
    const o = p.options?.find((x) => String(x.value) === String(v[p.key]));
    return `${p.label} ${o ? o.label : v[p.key]}`;
  }).join(' · ');

  return createPortal(
    <div className="fixed inset-0 z-[2100] flex flex-col bg-slate-900/70 backdrop-blur-sm p-2 md:p-5">
      <div className="flex flex-col w-full h-full max-w-6xl mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
          <MoveHorizontal size={18} className="text-[#0047AB]" />
          <p className="font-black text-slate-800 text-sm mr-auto">Before / after · {cfg?.label}</p>
          {editable.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500">Before:</span>
              {editable.map((p) => (
                <div key={p.key} className="w-28" title={p.label}>
                  <Param p={p} value={before[p.key]} onChange={(v) => setBefore((b) => ({ ...b, [p.key]: v }))} />
                </div>
              ))}
              <button onClick={runBefore} disabled={!!jobId}
                className="flex items-center gap-1 rounded-lg bg-[#0047AB] hover:bg-blue-800 disabled:opacity-50 text-white px-3 py-1.5 text-[12px] font-bold">
                {jobId ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Show
              </button>
            </div>
          )}
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div ref={wrap} className="relative flex-1 select-none overflow-hidden bg-slate-200">
          <div ref={leftEl} className="absolute inset-0" />
          <div ref={rightEl} className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }} />
          <div className="absolute inset-y-0 z-10 w-1 -ml-0.5 bg-white shadow cursor-ew-resize" style={{ left: `${pos}%` }}
            onMouseDown={startDrag} onTouchStart={startDrag}>
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 h-9 w-9 rounded-full bg-white shadow-lg flex items-center justify-center text-[#0047AB]">
              <MoveHorizontal size={16} />
            </div>
          </div>
          <span className="absolute top-3 left-3 z-10 rounded-lg bg-slate-900/75 text-white text-[11px] font-bold px-2.5 py-1">
            Before · {describe(before)}
            {jobId && <Loader2 size={11} className="inline ml-1.5 animate-spin" />}
          </span>
          <span className="absolute top-3 right-3 z-10 rounded-lg bg-slate-900/75 text-white text-[11px] font-bold px-2.5 py-1">After · {describe(values)}</span>
          {error && <p className="absolute bottom-3 left-3 z-10 rounded-lg bg-red-600 text-white text-[12px] px-3 py-1.5">{error}</p>}
          {jobId && !error && (
            <p className="absolute bottom-3 left-3 z-10 rounded-lg bg-white/95 text-slate-600 text-[11px] px-3 py-1.5 shadow">
              Running the “before” analysis on Earth Engine… it keeps going if you close this.
            </p>
          )}
        </div>
        {result.legend && <div className="px-4 py-2 border-t"><MapLegend legend={result.legend} /></div>}
      </div>
    </div>,
    document.body,
  );
}
