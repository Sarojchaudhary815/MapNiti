import React, { useMemo, useState } from 'react';
import proj4 from 'proj4';
import { Plus, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Coordinate systems
// Nepal MUTM: Everest 1830 ellipsoid, TM, k0 = 0.9999, FE 500 000 m,
// central meridians 81°, 84°, 87° E. Datum shift to WGS84 = Nepal (Nagarkot).
// ---------------------------------------------------------------------------
const EVEREST_NEPAL = '+a=6377276.345 +rf=300.8017 +towgs84=293.17,726.18,245.36,0,0,0,0';
const MUTM = (cm) => `+proj=tmerc +lat_0=0 +lon_0=${cm} +k=0.9999 +x_0=500000 +y_0=0 ${EVEREST_NEPAL} +units=m +no_defs`;
const UTM = (zone, south) => `+proj=utm +zone=${zone} ${south ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

const CRS_OPTIONS = [
  { id: 'wgs84', label: 'WGS84 Lat/Long (degrees)' },
  { id: 'utm', label: 'UTM WGS84 (auto zone / chosen zone)' },
  { id: 'mutm81', label: 'Nepal MUTM 81° (Far-West)' },
  { id: 'mutm84', label: 'Nepal MUTM 84° (Central-West)' },
  { id: 'mutm87', label: 'Nepal MUTM 87° (East)' },
];

const toDMS = (deg, pos, neg) => {
  const d = Math.abs(deg);
  const D = Math.floor(d);
  const M = Math.floor((d - D) * 60);
  const S = ((d - D - M / 60) * 3600).toFixed(2);
  return `${D}° ${M}' ${S}" ${deg >= 0 ? pos : neg}`;
};

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const fmt = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : Number(v.toFixed(d)).toLocaleString(undefined, { maximumFractionDigits: d }));

function Field({ label, value, onChange, unit, type = 'number', step = 'any' }) {
  return (
    <label className="block text-[9px] font-bold uppercase text-slate-400">
      {label}
      <div className="flex items-center mt-1">
        <input type={type} step={step} value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-800" />
        {unit && <span className="ml-1 text-[10px] text-slate-400 normal-case whitespace-nowrap">{unit}</span>}
      </div>
    </label>
  );
}

function Out({ label, value, unit, strong }) {
  return (
    <div className="flex justify-between py-1 border-b border-slate-50 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className={`${strong ? 'font-black text-orange-700' : 'font-bold text-slate-800'}`}>{value}{unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

function CoordinateConverter() {
  const [from, setFrom] = useState('wgs84');
  const [a, setA] = useState('27.7172');
  const [b, setB] = useState('85.3240');
  const [zone, setZone] = useState('');

  const result = useMemo(() => {
    const x = num(a);
    const y = num(b);
    if (x == null || y == null) return null;
    try {
      let lat;
      let lng;
      if (from === 'wgs84') {
        lat = x; lng = y;
      } else {
        const def = from === 'utm' ? UTM(parseInt(zone || '45', 10), false) : MUTM(from.slice(4));
        [lng, lat] = proj4(def, WGS84, [x, y]);
      }
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: 'Coordinates out of range.' };
      const utmZone = zone && from === 'utm' ? parseInt(zone, 10) : Math.floor((lng + 180) / 6) + 1;
      const [ue, un] = proj4(WGS84, UTM(utmZone, lat < 0), [lng, lat]);
      const cm = lng < 82.5 ? 81 : lng < 85.5 ? 84 : 87;
      const [me, mn] = proj4(WGS84, MUTM(cm), [lng, lat]);
      return { lat, lng, utmZone, ue, un, cm, me, mn };
    } catch (e) {
      return { error: e.message };
    }
  }, [from, a, b, zone]);

  const labels = from === 'wgs84' ? ['Latitude', 'Longitude'] : ['Easting (m)', 'Northing (m)'];
  return (
    <div className="space-y-3">
      <select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full text-[11px] border border-slate-200 rounded-lg px-2 py-2">
        {CRS_OPTIONS.map((o) => <option key={o.id} value={o.id}>Input: {o.label}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <Field label={labels[0]} value={a} onChange={setA} />
        <Field label={labels[1]} value={b} onChange={setB} />
      </div>
      {from === 'utm' && <Field label="UTM zone (Nepal: 44 or 45)" value={zone} onChange={setZone} />}
      {result?.error && <p className="text-[11px] text-red-500">{result.error}</p>}
      {result && !result.error && (
        <div className="p-3 rounded-xl bg-slate-50">
          <Out label="Lat, Long (decimal)" value={`${result.lat.toFixed(7)}, ${result.lng.toFixed(7)}`} />
          <Out label="Latitude (DMS)" value={toDMS(result.lat, 'N', 'S')} />
          <Out label="Longitude (DMS)" value={toDMS(result.lng, 'E', 'W')} />
          <Out label={`UTM ${result.utmZone}${result.lat >= 0 ? 'N' : 'S'} E / N`} value={`${fmt(result.ue, 2)} / ${fmt(result.un, 2)}`} strong />
          <Out label={`MUTM ${result.cm}° E / N`} value={`${fmt(result.me, 2)} / ${fmt(result.mn, 2)}`} strong />
          <p className="text-[9px] text-slate-400 mt-2">MUTM uses Everest 1830 with the Nepal (Nagarkot) 3-parameter datum shift — expect ~1–3 m differences vs. the Survey Department's 7-parameter transformation. Use DoS control points for cadastral work.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Land units (Nepal)
// ---------------------------------------------------------------------------
const AREA_UNITS = {
  m2: { label: 'Square metre (m²)', m2: 1 },
  ft2: { label: 'Square feet (ft²)', m2: 0.09290304 },
  ropani: { label: 'Ropani', m2: 508.72 },
  aana: { label: 'Aana', m2: 31.795 },
  paisa: { label: 'Paisa', m2: 7.94875 },
  daam: { label: 'Daam', m2: 1.9871875 },
  bigha: { label: 'Bigha', m2: 6772.63 },
  kattha: { label: 'Kattha', m2: 338.6315 },
  dhur: { label: 'Dhur', m2: 16.931575 },
  ha: { label: 'Hectare', m2: 10000 },
  acre: { label: 'Acre', m2: 4046.8564224 },
  km2: { label: 'Square km', m2: 1e6 },
};

function rapd(m2) {
  let daam = m2 / AREA_UNITS.daam.m2;
  const r = Math.floor(daam / 256); daam -= r * 256;
  const a = Math.floor(daam / 16); daam -= a * 16;
  const p = Math.floor(daam / 4); daam -= p * 4;
  return `${r}-${a}-${p}-${daam.toFixed(2)}`;
}

function bkd(m2) {
  let dhur = m2 / AREA_UNITS.dhur.m2;
  const bi = Math.floor(dhur / 400); dhur -= bi * 400;
  const k = Math.floor(dhur / 20); dhur -= k * 20;
  return `${bi}-${k}-${dhur.toFixed(2)}`;
}

function LandUnits() {
  const [value, setValue] = useState('1');
  const [unit, setUnit] = useState('ropani');
  const m2 = (num(value) || 0) * AREA_UNITS[unit].m2;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Area" value={value} onChange={setValue} />
        <label className="text-[9px] font-bold uppercase text-slate-400">Unit
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className="mt-1 w-full text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-800">
            {Object.entries(AREA_UNITS).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}
          </select>
        </label>
      </div>
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="Ropani-Aana-Paisa-Daam" value={rapd(m2)} strong />
        <Out label="Bigha-Kattha-Dhur" value={bkd(m2)} strong />
        {Object.entries(AREA_UNITS).filter(([k]) => k !== unit).map(([k, u]) => (
          <Out key={k} label={u.label} value={fmt(m2 / u.m2, 4)} />
        ))}
      </div>
      <p className="text-[9px] text-slate-400">1 ropani = 16 aana = 64 paisa = 256 daam = 508.72 m² (74 × 74 ft) · 1 bigha = 20 kattha = 400 dhur = 6,772.63 m².</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Area & perimeter from coordinates (shoelace)
// ---------------------------------------------------------------------------
function CoordinateArea() {
  const [text, setText] = useState('0,0\n40,0\n40,25\n0,25');
  const pts = text.split('\n').map((l) => l.split(/[,\s\t]+/).map(Number)).filter((p) => p.length >= 2 && p.every(Number.isFinite));
  let area = 0;
  let per = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    area += p[0] * q[1] - q[0] * p[1];
    per += Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  area = Math.abs(area) / 2;
  return (
    <div className="space-y-3">
      <label className="block text-[9px] font-bold uppercase text-slate-400">Easting, Northing per line (metres, in order)
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 w-full font-mono text-[12px] border border-slate-200 rounded-lg p-2 font-normal text-slate-800" />
      </label>
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="Vertices" value={pts.length} />
        <Out label="Area" value={fmt(area, 3)} unit="m²" strong />
        <Out label="Perimeter" value={fmt(per, 3)} unit="m" />
        <Out label="Ropani-Aana-Paisa-Daam" value={rapd(area)} />
        <Out label="Bigha-Kattha-Dhur" value={bkd(area)} />
        <Out label="Hectare" value={fmt(area / 1e4, 4)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Earthwork — average end area & prismoidal
// ---------------------------------------------------------------------------
function Earthwork() {
  const [rows, setRows] = useState([
    { ch: '0', cut: '12.5', fill: '0' },
    { ch: '20', cut: '8.2', fill: '1.5' },
    { ch: '40', cut: '3.1', fill: '6.8' },
    { ch: '60', cut: '0', fill: '10.4' },
  ]);
  const update = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  let cut = 0;
  let fill = 0;
  const seg = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const L = (num(rows[i + 1].ch) ?? 0) - (num(rows[i].ch) ?? 0);
    const vc = (L * ((num(rows[i].cut) || 0) + (num(rows[i + 1].cut) || 0))) / 2;
    const vf = (L * ((num(rows[i].fill) || 0) + (num(rows[i + 1].fill) || 0))) / 2;
    cut += vc;
    fill += vf;
    seg.push({ L, vc, vf });
  }
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-slate-500">Enter cross-section areas at each chainage (from your road/canal cross-sections). Volume = L × (A₁ + A₂) / 2.</p>
      <div className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1 text-[9px] font-bold uppercase text-slate-400">
        <span>Chainage (m)</span><span>Cut area (m²)</span><span>Fill area (m²)</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_24px] gap-1">
          {['ch', 'cut', 'fill'].map((k) => (
            <input key={k} type="number" value={r[k]} onChange={(e) => update(i, k, e.target.value)} className="text-[12px] border border-slate-200 rounded-md px-1.5 py-1" />
          ))}
          <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
        </div>
      ))}
      <button onClick={() => setRows((r) => [...r, { ch: String((num(r[r.length - 1]?.ch) || 0) + 20), cut: '0', fill: '0' }])}
        className="flex items-center gap-1 text-[10px] font-bold text-blue-600"><Plus size={12} /> Add section</button>
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="Total cut" value={fmt(cut, 2)} unit="m³" strong />
        <Out label="Total fill" value={fmt(fill, 2)} unit="m³" strong />
        <Out label="Net (cut − fill)" value={fmt(cut - fill, 2)} unit="m³" />
        <Out label="Fill with 15% shrinkage needs cut of" value={fmt(fill * 1.15, 2)} unit="m³" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rational method + Kirpich time of concentration
// ---------------------------------------------------------------------------
const C_TABLE = [
  ['Concrete / asphalt roads, roofs', 0.85], ['Dense urban / commercial', 0.8], ['Residential (medium density)', 0.5],
  ['Barren / rocky hill slopes', 0.6], ['Cultivated land', 0.4], ['Grassland / pasture', 0.3], ['Forest', 0.2],
];

function RationalMethod() {
  const [c, setC] = useState('0.5');
  const [i, setI] = useState('100');
  const [a, setA] = useState('25');
  const [L, setL] = useState('1200');
  const [H, setH] = useState('60');
  const q = ((num(c) || 0) * (num(i) || 0) * (num(a) || 0)) / 360;
  const S = (num(H) || 0) / (num(L) || 1);
  const tc = S > 0 ? 0.0195 * (num(L) || 0) ** 0.77 * S ** -0.385 : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Runoff coeff. C" value={c} onChange={setC} />
        <Field label="Intensity i" value={i} onChange={setI} unit="mm/h" />
        <Field label="Area A" value={a} onChange={setA} unit="ha" />
      </div>
      <div className="flex flex-wrap gap-1">
        {C_TABLE.map(([l, v]) => (
          <button key={l} onClick={() => setC(String(v))} className="text-[9px] px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600">{l} ({v})</button>
        ))}
      </div>
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="Peak discharge Q = CiA/360" value={fmt(q, 3)} unit="m³/s" strong />
        <Out label="In litres per second" value={fmt(q * 1000, 1)} unit="L/s" />
      </div>
      <p className="text-[10px] font-bold text-slate-500">Time of concentration (Kirpich)</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Flow length L" value={L} onChange={setL} unit="m" />
        <Field label="Fall H" value={H} onChange={setH} unit="m" />
      </div>
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="Slope S" value={fmt(S * 100, 2)} unit="%" />
        <Out label="tc = 0.0195 L^0.77 S^-0.385" value={fmt(tc, 1)} unit="min" strong />
      </div>
      <p className="text-[9px] text-slate-400">Pick i from the IDF curve for a storm duration equal to tc (use DHM station data). The rational method suits small catchments (&lt; ~80 ha; some guides allow up to a few km²).</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manning's equation — trapezoidal / rectangular channel
// ---------------------------------------------------------------------------
const N_TABLE = [['Concrete lined', 0.015], ['Stone masonry', 0.025], ['Earth, clean', 0.022], ['Earth, weedy', 0.035], ['Natural stream', 0.04], ['PVC / HDPE pipe', 0.011]];

function Manning() {
  const [b, setB] = useState('1.0');
  const [y, setY] = useState('0.6');
  const [z, setZ] = useState('1');
  const [n, setN] = useState('0.022');
  const [s, setS] = useState('0.002');
  const B = num(b) || 0;
  const Y = num(y) || 0;
  const Z = num(z) || 0;
  const A = (B + Z * Y) * Y;
  const P = B + 2 * Y * Math.sqrt(1 + Z * Z);
  const R = P ? A / P : 0;
  const V = (num(n) ? (1 / num(n)) : 0) * R ** (2 / 3) * Math.sqrt(num(s) || 0);
  const T = B + 2 * Z * Y;
  const Fr = T && A ? V / Math.sqrt(9.81 * (A / T)) : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Bed width b" value={b} onChange={setB} unit="m" />
        <Field label="Depth y" value={y} onChange={setY} unit="m" />
        <Field label="Side slope z (H:1V)" value={z} onChange={setZ} />
        <Field label="Manning n" value={n} onChange={setN} />
        <Field label="Bed slope S" value={s} onChange={setS} unit="m/m" />
      </div>
      <div className="flex flex-wrap gap-1">
        {N_TABLE.map(([l, v]) => (
          <button key={l} onClick={() => setN(String(v))} className="text-[9px] px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600">{l} ({v})</button>
        ))}
      </div>
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="Flow area A" value={fmt(A, 3)} unit="m²" />
        <Out label="Wetted perimeter P" value={fmt(P, 3)} unit="m" />
        <Out label="Hydraulic radius R" value={fmt(R, 3)} unit="m" />
        <Out label="Velocity V" value={fmt(V, 3)} unit="m/s" strong />
        <Out label="Discharge Q = AV" value={fmt(A * V, 3)} unit="m³/s" strong />
        <Out label="Froude number" value={fmt(Fr, 2)} unit={Fr == null ? '' : Fr < 1 ? '(subcritical)' : '(supercritical)'} />
      </div>
      <p className="text-[9px] text-slate-400">Set z = 0 for a rectangular channel. Check V against non-silting (~0.6 m/s) and non-scouring limits for the lining.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Levelling — rise & fall
// ---------------------------------------------------------------------------
function Levelling() {
  const [startRL, setStartRL] = useState('100.000');
  const [rows, setRows] = useState([
    { bs: '1.525', is: '', fs: '' },
    { bs: '', is: '1.820', fs: '' },
    { bs: '2.010', is: '', fs: '0.985' },
    { bs: '', is: '', fs: '1.445' },
  ]);
  const update = (i, k, v) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));

  const table = [];
  let prevReading = null;
  let rl = num(startRL) || 0;
  let sumBS = 0;
  let sumFS = 0;
  let sumRise = 0;
  let sumFall = 0;
  rows.forEach((r, i) => {
    const bs = num(r.bs);
    const is = num(r.is);
    const fs = num(r.fs);
    let rise = null;
    let fall = null;
    const current = fs ?? is;
    if (i > 0 && prevReading != null && current != null) {
      const d = prevReading - current;
      if (d >= 0) { rise = d; sumRise += d; } else { fall = -d; sumFall -= d; }
      rl = rl + d;
    }
    if (bs != null) sumBS += bs;
    if (fs != null) sumFS += fs;
    table.push({ rise, fall, rl });
    prevReading = bs ?? current;
  });
  const lastRL = table.length ? table[table.length - 1].rl : 0;
  const first = num(startRL) || 0;
  const ok = Math.abs(sumBS - sumFS - (sumRise - sumFall)) < 1e-6 && Math.abs(sumRise - sumFall - (lastRL - first)) < 1e-6;

  return (
    <div className="space-y-3">
      <Field label="RL of first station (BM)" value={startRL} onChange={setStartRL} unit="m" />
      <div className="grid grid-cols-[1fr_1fr_1fr_0.9fr_0.9fr_1.1fr_20px] gap-1 text-[8px] font-bold uppercase text-slate-400">
        <span>BS</span><span>IS</span><span>FS</span><span>Rise</span><span>Fall</span><span>RL</span><span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_0.9fr_0.9fr_1.1fr_20px] gap-1 items-center">
          {['bs', 'is', 'fs'].map((k) => (
            <input key={k} type="number" step="0.001" value={r[k]} onChange={(e) => update(i, k, e.target.value)} className="text-[11px] border border-slate-200 rounded-md px-1 py-1 w-full" />
          ))}
          <span className="text-[10px] font-mono text-emerald-700">{table[i].rise != null ? table[i].rise.toFixed(3) : ''}</span>
          <span className="text-[10px] font-mono text-red-600">{table[i].fall != null ? table[i].fall.toFixed(3) : ''}</span>
          <span className="text-[10px] font-mono font-bold">{table[i].rl.toFixed(3)}</span>
          <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
        </div>
      ))}
      <button onClick={() => setRows((r) => [...r, { bs: '', is: '', fs: '' }])} className="flex items-center gap-1 text-[10px] font-bold text-blue-600"><Plus size={12} /> Add reading</button>
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="ΣBS − ΣFS" value={(sumBS - sumFS).toFixed(3)} />
        <Out label="ΣRise − ΣFall" value={(sumRise - sumFall).toFixed(3)} />
        <Out label="Last RL − First RL" value={(lastRL - first).toFixed(3)} />
        <Out label="Arithmetic check" value={ok ? '✓ OK' : '✗ Mismatch'} strong />
      </div>
      <p className="text-[9px] text-slate-400">Enter a BS and FS on the same row at a change point. Arithmetic check confirms the reductions only — closing error must still be compared with the allowable (e.g. ±12√K mm).</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Simple horizontal curve
// ---------------------------------------------------------------------------
function HorizontalCurve() {
  const [R, setR] = useState('50');
  const [delta, setDelta] = useState('60');
  const [pi, setPi] = useState('1250');
  const r = num(R) || 0;
  const d = ((num(delta) || 0) * Math.PI) / 180;
  const T = r * Math.tan(d / 2);
  const L = r * d;
  const E = r * (1 / Math.cos(d / 2) - 1);
  const M = r * (1 - Math.cos(d / 2));
  const LC = 2 * r * Math.sin(d / 2);
  const pc = (num(pi) || 0) - T;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Radius R" value={R} onChange={setR} unit="m" />
        <Field label="Deflection Δ" value={delta} onChange={setDelta} unit="°" />
        <Field label="Chainage of PI" value={pi} onChange={setPi} unit="m" />
      </div>
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="Tangent length T = R tan(Δ/2)" value={fmt(T, 3)} unit="m" strong />
        <Out label="Curve length L = RΔ" value={fmt(L, 3)} unit="m" strong />
        <Out label="External E" value={fmt(E, 3)} unit="m" />
        <Out label="Mid-ordinate M" value={fmt(M, 3)} unit="m" />
        <Out label="Long chord" value={fmt(LC, 3)} unit="m" />
        <Out label="Chainage PC (T1)" value={fmt(pc, 3)} unit="m" />
        <Out label="Chainage PT (T2)" value={fmt(pc + L, 3)} unit="m" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slope / gradient + bearing & distance
// ---------------------------------------------------------------------------
function SlopeBearing() {
  const [pct, setPct] = useState('8');
  const p = num(pct) || 0;
  const [e1, setE1] = useState('335000');
  const [n1, setN1] = useState('3065000');
  const [e2, setE2] = useState('335420.5');
  const [n2, setN2] = useState('3065310.2');
  const dE = (num(e2) || 0) - (num(e1) || 0);
  const dN = (num(n2) || 0) - (num(n1) || 0);
  const dist = Math.hypot(dE, dN);
  let brg = (Math.atan2(dE, dN) * 180) / Math.PI;
  if (brg < 0) brg += 360;
  const bD = Math.floor(brg);
  const bM = Math.floor((brg - bD) * 60);
  const bS = ((brg - bD - bM / 60) * 3600).toFixed(1);
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-bold text-slate-500">Gradient converter</p>
      <Field label="Gradient" value={pct} onChange={setPct} unit="%" />
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="Angle" value={fmt((Math.atan(p / 100) * 180) / Math.PI, 3)} unit="°" />
        <Out label="Ratio" value={p ? `1 in ${fmt(100 / p, 2)}` : '—'} />
        <Out label="Rise per 100 m horizontal" value={fmt(p, 2)} unit="m" />
      </div>
      <p className="text-[10px] font-bold text-slate-500">Bearing & distance (plane coordinates)</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="E1" value={e1} onChange={setE1} />
        <Field label="N1" value={n1} onChange={setN1} />
        <Field label="E2" value={e2} onChange={setE2} />
        <Field label="N2" value={n2} onChange={setN2} />
      </div>
      <div className="p-3 rounded-xl bg-slate-50">
        <Out label="Horizontal distance" value={fmt(dist, 3)} unit="m" strong />
        <Out label="Whole-circle bearing" value={`${bD}° ${bM}' ${bS}"`} strong />
        <Out label="ΔE / ΔN" value={`${fmt(dE, 3)} / ${fmt(dN, 3)}`} />
      </div>
    </div>
  );
}

export const CALCULATORS = [
  { id: 'coords', label: 'Coordinate converter', desc: 'WGS84 ↔ UTM ↔ Nepal MUTM, DMS', Comp: CoordinateConverter },
  { id: 'land', label: 'Land units (Nepal)', desc: 'Ropani-Aana-Paisa-Daam, Bigha-Kattha-Dhur', Comp: LandUnits },
  { id: 'area', label: 'Area from coordinates', desc: 'Shoelace area & perimeter of a plot', Comp: CoordinateArea },
  { id: 'earthwork', label: 'Earthwork volume', desc: 'Cut / fill by average end area', Comp: Earthwork },
  { id: 'rational', label: 'Rational method runoff', desc: 'Q = CiA/360 + Kirpich tc', Comp: RationalMethod },
  { id: 'manning', label: "Manning's channel flow", desc: 'Trapezoidal / rectangular channels', Comp: Manning },
  { id: 'levelling', label: 'Levelling (rise & fall)', desc: 'Reduce levels with arithmetic check', Comp: Levelling },
  { id: 'curve', label: 'Horizontal curve', desc: 'T, L, E, M, chainages of PC/PT', Comp: HorizontalCurve },
  { id: 'slope', label: 'Gradient, bearing & distance', desc: '% ↔ degrees, WCB from coordinates', Comp: SlopeBearing },
];
