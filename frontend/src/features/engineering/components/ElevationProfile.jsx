import React, { useEffect, useState } from 'react';
import { Loader2, Crosshair, Trash2, TrendingUp, Download } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchProfile } from '../../../api/hubApi';
import { downloadCsv } from '../../../components/common/MapLegend';

// Ground profile along a clicked alignment (road, canal, pipeline, transmission line).
export default function ElevationProfile({ activeStep, setActiveStep, outletCoords, setOutletCoords }) {
  const [dem, setDem] = useState('SRTM');
  const [samples, setSamples] = useState(150);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setOutletCoords([]);
    return () => {
      setActiveStep('none');
      setOutletCoords([]);
    };
  }, [setActiveStep, setOutletCoords]);

  const picking = activeStep === 'place-outlet';

  const run = async () => {
    setActiveStep('none');
    setLoading(true);
    setError('');
    try {
      const res = await fetchProfile(outletCoords, dem, samples);
      if (res.status === 'success') setData(res);
      else setError(res.message);
    } catch (err) {
      setError(err.response?.data?.detail || 'Profile failed.');
    } finally {
      setLoading(false);
    }
  };

  const s = data?.summary;

  return (
    <div className="p-5 space-y-4">
      <p className="text-[11px] text-slate-500">Click the alignment vertices on the map in order (start → end), then build the ground profile.</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setActiveStep(picking ? 'none' : 'place-outlet')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold ${picking ? 'bg-amber-500 text-white' : 'bg-[#0047AB] text-white hover:bg-blue-800'}`}>
          <Crosshair size={13} /> {picking ? `Clicking (${outletCoords.length})` : 'Pick vertices'}
        </button>
        <button onClick={() => { setOutletCoords([]); setData(null); }}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">
          <Trash2 size={13} /> Clear
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[9px] font-bold uppercase text-slate-400">DEM
          <select value={dem} onChange={(e) => setDem(e.target.value)} className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-700">
            <option value="SRTM">SRTM 30 m</option>
            <option value="COPERNICUS">Copernicus GLO-30</option>
            <option value="ALOS">ALOS AW3D30</option>
          </select>
        </label>
        <label className="text-[9px] font-bold uppercase text-slate-400">Samples
          <input type="number" min="20" max="500" value={samples} onChange={(e) => setSamples(Number(e.target.value))}
            className="mt-1 w-full text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-700" />
        </label>
      </div>
      <button onClick={run} disabled={outletCoords.length < 2 || loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-40">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />} Build profile ({outletCoords.length} pts)
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}

      {data && (
        <div className="space-y-3">
          <div className="h-52 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.profile} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="profileFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ea580c" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="distance_m" type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)} domain={['dataMin', 'dataMax']} />
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} labelFormatter={(v) => `Chainage ${Math.round(v)} m`} formatter={(v) => [`${v} m`, 'Ground RL']} />
                <Area type="linear" dataKey="elevation_m" stroke="#ea580c" strokeWidth={2} fill="url(#profileFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[
              ['Length', `${(s.length_m / 1000).toFixed(2)} km`], ['Start RL', `${s.start_elev} m`], ['End RL', `${s.end_elev} m`],
              ['Ascent', `${s.total_ascent_m} m`], ['Descent', `${s.total_descent_m} m`], ['Avg grade', `${s.avg_grade_pct}%`],
              ['Max grade', `${s.max_grade_pct}%`], ['Min RL', `${s.min_elev} m`], ['Max RL', `${s.max_elev} m`],
            ].map(([l, v]) => (
              <div key={l} className="p-1.5 bg-slate-50 rounded-lg">
                <p className="text-[8px] font-bold uppercase text-slate-400">{l}</p>
                <p className="text-[11px] font-black text-slate-700">{v}</p>
              </div>
            ))}
          </div>
          {s.max_grade_pct > 12 && (
            <p className="text-[10px] p-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
              Max grade {s.max_grade_pct}% exceeds 12% — steeper than typical limits for rural roads in hilly terrain. Consider hairpin bends or realignment (check DoR / NRRS standards).
            </p>
          )}
          <button onClick={() => downloadCsv('elevation_profile.csv', data.profile)}
            className="w-full text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg py-2 flex items-center justify-center gap-1">
            <Download size={11} /> Download chainage / RL table (CSV)
          </button>
        </div>
      )}
    </div>
  );
}
