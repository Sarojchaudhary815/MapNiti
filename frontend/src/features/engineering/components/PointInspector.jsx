import React, { useEffect, useState } from 'react';
import { Loader2, MapPin, Crosshair, Trash2 } from 'lucide-react';
import { fetchPointInfo } from '../../../api/hubApi';

const ROWS = [
  ['elevation_m', 'Elevation', 'm'],
  ['slope_deg', 'Slope', '°'],
  ['slope_pct', 'Slope', '%'],
  ['aspect_dir', 'Aspect', ''],
  ['land_cover', 'Land cover', ''],
  ['soil_texture', 'Soil texture', ''],
  ['clay_pct', 'Clay', '%'],
  ['sand_pct', 'Sand', '%'],
  ['annual_rain_mm', 'Mean annual rain', 'mm'],
  ['water_occurrence_pct', 'Water occurrence', '%'],
  ['population_per_100m_cell', 'People / 100 m cell', ''],
];

// Click anywhere on the map → every key site parameter at that point.
// Reuses the map's "place-outlet" click mode (markers are drawn by MapWindow).
export default function PointInspector({ activeStep, setActiveStep, outletCoords, setOutletCoords }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setOutletCoords([]);
    return () => {
      setActiveStep('none');
      setOutletCoords([]);
    };
  }, [setActiveStep, setOutletCoords]);

  useEffect(() => {
    const pending = outletCoords.slice(results.length);
    if (!pending.length || loading) return;
    const { lat, lng } = pending[0];
    setLoading(true);
    setError('');
    fetchPointInfo(lat, lng)
      .then((res) => {
        if (res.status === 'success') setResults((r) => [...r, res]);
        else {
          setError(res.message);
          setOutletCoords((c) => c.slice(0, results.length));
        }
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Lookup failed.');
        setOutletCoords((c) => c.slice(0, results.length));
      })
      .finally(() => setLoading(false));
  }, [outletCoords, results.length, loading, setOutletCoords]);

  const picking = activeStep === 'place-outlet';

  return (
    <div className="p-5 space-y-4">
      <p className="text-[11px] text-slate-500">Click points on the map to get elevation, slope, soil, land cover, rainfall and more at each location.</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setActiveStep(picking ? 'none' : 'place-outlet')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold ${picking ? 'bg-amber-500 text-white' : 'bg-[#0047AB] text-white hover:bg-blue-800'}`}>
          <Crosshair size={13} /> {picking ? 'Clicking… (stop)' : 'Pick on map'}
        </button>
        <button onClick={() => { setResults([]); setOutletCoords([]); }}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">
          <Trash2 size={13} /> Clear
        </button>
      </div>
      {loading && <p className="flex items-center gap-2 text-[11px] text-slate-500"><Loader2 size={12} className="animate-spin" /> Reading Earth Engine…</p>}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      <div className="space-y-3">
        {results.map((r, i) => (
          <div key={i} className="p-3 rounded-xl border border-slate-100">
            <p className="text-[11px] font-black text-slate-800 flex items-center gap-1"><MapPin size={12} className="text-red-500" /> Point {i + 1}</p>
            <p className="text-[10px] font-mono text-slate-400 mb-2">{r.lat.toFixed(6)}, {r.lng.toFixed(6)} · UTM {r.zone}</p>
            <div className="grid grid-cols-2 gap-x-3">
              {ROWS.map(([k, label, unit]) => (
                <div key={k + unit} className="flex justify-between text-[10px] py-0.5 border-b border-slate-50">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-bold text-slate-700">{r[k] ?? '—'}{r[k] != null && unit ? ` ${unit}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
