import React, { useEffect, useMemo, useState } from 'react';
import * as turf from '@turf/turf';
import { Ruler, Square, MapPin, Crosshair, Undo2, Trash2, Download } from 'lucide-react';
import { exportGeoJSON, exportKML } from '../../../utils/geoExport';

// Click-to-measure on the map (uses the map's point-pick mode, same as the
// Point Inspector). Everything is computed geodesically with Turf.
const MODES = [
  { id: 'distance', label: 'Distance', icon: Ruler },
  { id: 'area', label: 'Area', icon: Square },
  { id: 'points', label: 'Coordinates', icon: MapPin },
];

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: d }) : '—');

function rapd(m2) {
  let daam = m2 / 1.9871875;
  const r = Math.floor(daam / 256); daam -= r * 256;
  const a = Math.floor(daam / 16); daam -= a * 16;
  const p = Math.floor(daam / 4); daam -= p * 4;
  return `${r}-${a}-${p}-${daam.toFixed(2)}`;
}

function bkd(m2) {
  let dhur = m2 / 16.931575;
  const b = Math.floor(dhur / 400); dhur -= b * 400;
  const k = Math.floor(dhur / 20); dhur -= k * 20;
  return `${b}-${k}-${dhur.toFixed(2)}`;
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1 border-b border-slate-50 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-800 text-right">{value}</span>
    </div>
  );
}

export default function MeasurementToolbox({ activeStep, setActiveStep, outletCoords, setOutletCoords, setVectorLayers }) {
  const [mode, setMode] = useState('distance');

  useEffect(() => {
    setOutletCoords([]);
    setActiveStep('place-outlet');
    return () => {
      setActiveStep('none');
      setOutletCoords([]);
      setVectorLayers?.([]);
    };
  }, [setActiveStep, setOutletCoords, setVectorLayers]);

  const pts = useMemo(() => outletCoords.map((c) => [c.lng, c.lat]), [outletCoords]);

  const geom = useMemo(() => {
    if (mode === 'distance' && pts.length >= 2) return turf.lineString(pts);
    if (mode === 'area' && pts.length >= 3) return turf.polygon([[...pts, pts[0]]]);
    return null;
  }, [mode, pts]);

  useEffect(() => {
    if (!setVectorLayers) return;
    if (!geom) { setVectorLayers([]); return; }
    setVectorLayers([{ id: 'measure', name: 'Measurement', type: mode === 'area' ? 'fill' : 'line', color: '#f43f5e',
      opacity: mode === 'area' ? 0.2 : 1, width: 3, dashed: mode === 'distance', data: geom }]);
  }, [geom, mode, setVectorLayers]);

  const segments = useMemo(() => pts.slice(1).map((p, i) => ({
    dist: turf.distance(pts[i], p, { units: 'meters' }),
    bearing: (turf.bearing(pts[i], p) + 360) % 360,
  })), [pts]);

  const total = segments.reduce((s, x) => s + x.dist, 0);
  const area = mode === 'area' && geom ? turf.area(geom) : null;
  const perimeter = mode === 'area' && pts.length >= 3 ? total + turf.distance(pts[pts.length - 1], pts[0], { units: 'meters' }) : null;
  const picking = activeStep === 'place-outlet';

  return (
    <div className="p-5 space-y-4">
      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex items-center justify-center gap-1 text-[11px] font-bold py-1.5 rounded-lg ${mode === m.id ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>
            <m.icon size={12} /> {m.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500">
        {mode === 'distance' && 'Click points along a road, canal or boundary. Distances are geodesic (true ground distance on the ellipsoid).'}
        {mode === 'area' && 'Click the corners of a plot or area in order. Area is shown in m², hectares, ropani and bigha.'}
        {mode === 'points' && 'Click anywhere to read coordinates (decimal degrees).'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setActiveStep(picking ? 'none' : 'place-outlet')}
          className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold ${picking ? 'bg-amber-500 text-white' : 'bg-[#0047AB] text-white'}`}>
          <Crosshair size={12} /> {picking ? 'Clicking…' : 'Resume'}
        </button>
        <button onClick={() => setOutletCoords((c) => c.slice(0, -1))} disabled={!pts.length}
          className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-600 disabled:opacity-40">
          <Undo2 size={12} /> Undo
        </button>
        <button onClick={() => setOutletCoords([])}
          className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold bg-slate-100 text-slate-600">
          <Trash2 size={12} /> Clear
        </button>
      </div>

      {mode === 'distance' && pts.length >= 2 && (
        <div className="p-3 rounded-xl bg-slate-50">
          <Row label="Total distance" value={`${fmt(total)} m`} />
          <Row label="Kilometres" value={fmt(total / 1000, 3)} />
          <Row label="Feet" value={fmt(total * 3.28084, 1)} />
          <Row label="Segments" value={segments.length} />
          <div className="mt-2 max-h-40 overflow-y-auto">
            {segments.map((s, i) => (
              <p key={i} className="text-[10px] font-mono text-slate-500">{i + 1}→{i + 2}: {fmt(s.dist)} m · bearing {s.bearing.toFixed(1)}°</p>
            ))}
          </div>
        </div>
      )}

      {mode === 'area' && area != null && (
        <div className="p-3 rounded-xl bg-slate-50">
          <Row label="Area" value={`${fmt(area)} m²`} />
          <Row label="Hectares" value={fmt(area / 1e4, 4)} />
          <Row label="Ropani-Aana-Paisa-Daam" value={rapd(area)} />
          <Row label="Bigha-Kattha-Dhur" value={bkd(area)} />
          <Row label="Square feet" value={fmt(area * 10.7639, 0)} />
          <Row label="Perimeter" value={`${fmt(perimeter)} m`} />
        </div>
      )}

      {mode === 'points' && pts.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-50 space-y-1">
          {pts.map(([lng, lat], i) => (
            <p key={i} className="text-[11px] font-mono text-slate-700">{i + 1}. {lat.toFixed(6)}, {lng.toFixed(6)}</p>
          ))}
        </div>
      )}

      {pts.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => exportGeoJSON(geom ? turf.featureCollection([geom]) : turf.featureCollection(pts.map((p) => turf.point(p))), `measurement_${mode}.geojson`)}
            className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-lg py-2"><Download size={11} /> GeoJSON</button>
          <button onClick={() => exportKML(geom ? turf.featureCollection([geom]) : turf.featureCollection(pts.map((p) => turf.point(p))), `measurement_${mode}.kml`)}
            className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-lg py-2"><Download size={11} /> KML</button>
        </div>
      )}
    </div>
  );
}
