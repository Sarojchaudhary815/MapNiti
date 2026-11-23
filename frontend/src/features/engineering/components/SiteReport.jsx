import React, { useEffect, useState } from 'react';
import { Loader2, FileText, AlertTriangle, Info, AlertCircle, Printer, Download, Save } from 'lucide-react';
import AoiPicker from '../../../components/common/AoiPicker';
import { downloadCsv } from '../../../components/common/MapLegend';
import { fetchSiteReport } from '../../../api/hubApi';
import { saveResult } from '../../../api/projectApi';

const FLAG_STYLE = {
  high: { cls: 'bg-red-50 border-red-200 text-red-800', Icon: AlertTriangle, label: 'High' },
  medium: { cls: 'bg-amber-50 border-amber-200 text-amber-800', Icon: AlertCircle, label: 'Check' },
  info: { cls: 'bg-blue-50 border-blue-200 text-blue-800', Icon: Info, label: 'Note' },
};

function Kv({ label, value, unit }) {
  return (
    <div className="flex justify-between py-1 border-b border-slate-50 text-[11px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-800">{value ?? '—'}{value != null && unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="p-3 rounded-xl border border-slate-100 bg-white">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{title}</p>
      {children}
    </div>
  );
}

function Bars({ rows }) {
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-[10px] text-slate-600">
            <span>{r.label}</span><span className="font-mono">{r.percent}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max(r.percent || 0, 0.5)}%`, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function flatten(report) {
  const rows = [];
  const add = (group, obj) => Object.entries(obj || {}).forEach(([k, v]) => rows.push({ group, item: k, value: v }));
  add('site', { area_km2: report.area_km2, area_ha: report.area_ha, area_ropani: report.area_ropani, area_bigha: report.area_bigha, ...report.centroid });
  add('terrain', report.terrain);
  add('climate', report.climate);
  add('soil', report.soil);
  add('water', report.water);
  add('people', report.people);
  report.slope_classes.forEach((s) => rows.push({ group: 'slope_class', item: s.label, value: `${s.area_km2} km2 (${s.percent}%)` }));
  report.land_cover.forEach((s) => rows.push({ group: 'land_cover', item: s.label, value: `${s.area_km2} km2 (${s.percent}%)` }));
  report.flags.forEach((f) => rows.push({ group: `flag_${f.level}`, item: f.topic, value: f.text }));
  return rows;
}

function printReport(report) {
  const rows = flatten(report);
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>MapNiti Site Report</title>
    <style>body{font-family:system-ui,sans-serif;padding:32px;color:#1e293b}h1{margin:0}table{border-collapse:collapse;width:100%;margin-top:16px;font-size:12px}
    td,th{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}th{background:#f8fafc}.g{color:#64748b;text-transform:uppercase;font-size:10px}</style></head>
    <body><h1>MapNiti — Site Desk-Study Report</h1><p class="g">Generated ${new Date().toLocaleString()} · Sources: SRTM, ESA WorldCover, CHIRPS, ERA5-Land, OpenLandMap, JRC GSW, WorldPop, GHSL, Google Open Buildings</p>
    <table><tr><th>Group</th><th>Item</th><th>Value</th></tr>${rows.map((r) => `<tr><td class="g">${esc(r.group)}</td><td>${esc(r.item)}</td><td>${esc(r.value)}</td></tr>`).join('')}</table>
    <p class="g" style="margin-top:16px">Desk-study screening from global datasets. Confirm with field survey and geotechnical investigation.</p>
    <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

export default function SiteReport({ selectedAOI, setSelectedAOI, onStartDrawing, setMapLayers, projectInfo }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => () => setMapLayers([]), [setMapLayers]);

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchSiteReport(selectedAOI.geojson);
      if (res.status === 'success') {
        setReport(res);
        setMapLayers(res.layers);
      } else setError(res.message);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Site report failed.');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      const { layers, ...data } = report;
      await saveResult(projectInfo.id, 'engineering', 'site-report', selectedAOI?.geojson, data);
      setSaveMsg('Saved ✓');
    } catch {
      setSaveMsg('Could not save');
    }
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const t = report?.terrain;
  const c = report?.climate;
  const s = report?.soil;
  const p = report?.people;

  return (
    <div className="p-5 space-y-4">
      <p className="text-[11px] text-slate-500 leading-relaxed">
        One-click desk study for any site: terrain, slope classes, land cover, rainfall (annual + design 1-day max),
        temperature, soil, water, population and buildings — with engineering screening notes.
      </p>
      <AoiPicker selectedAOI={selectedAOI} setSelectedAOI={setSelectedAOI} onStartDrawing={onStartDrawing} />
      <button onClick={run} disabled={!selectedAOI || loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-40">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
        {loading ? 'Analysing (15–40 s)…' : 'Generate site report'}
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}

      {report && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-orange-50">
              <p className="text-[9px] font-black uppercase text-orange-500">Area</p>
              <p className="text-lg font-black text-orange-900">{report.area_ha} ha</p>
              <p className="text-[10px] text-orange-700">{report.area_ropani} ropani · {report.area_bigha} bigha</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50">
              <p className="text-[9px] font-black uppercase text-slate-400">Centroid</p>
              <p className="text-[11px] font-bold text-slate-800">{report.centroid.lat}, {report.centroid.lng}</p>
              <p className="text-[10px] text-slate-500">UTM {report.centroid.zone} · EPSG:{report.centroid.epsg}</p>
            </div>
          </div>

          <Section title="Screening notes">
            <div className="space-y-1.5">
              {report.flags.map((f, i) => {
                const st = FLAG_STYLE[f.level] || FLAG_STYLE.info;
                return (
                  <div key={i} className={`p-2 rounded-lg border text-[11px] ${st.cls}`}>
                    <p className="font-black flex items-center gap-1"><st.Icon size={12} /> {st.label} · {f.topic}</p>
                    <p className="mt-0.5 leading-snug">{f.text}</p>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Terrain (SRTM 30 m)">
            <Kv label="Elevation min / max" value={`${t.elev_min} / ${t.elev_max}`} unit="m" />
            <Kv label="Mean elevation" value={t.elev_mean} unit="m" />
            <Kv label="Relief" value={t.relief} unit="m" />
            <Kv label="Mean slope" value={`${t.slope_mean}° (${t.slope_mean_percent}%)`} />
            <Kv label="90th percentile slope" value={t.slope_p90} unit="°" />
            <Kv label="Dominant aspect" value={t.dominant_aspect} />
            <p className="text-[10px] font-bold text-slate-400 mt-2 mb-1">Slope classes (shown on map)</p>
            <Bars rows={report.slope_classes} />
          </Section>

          <Section title="Land cover (ESA WorldCover 2021)">
            <Bars rows={report.land_cover} />
          </Section>

          <Section title={`Climate (CHIRPS / ERA5, ${c.period})`}>
            <Kv label="Mean annual rainfall" value={c.annual_rain_mm} unit="mm" />
            <Kv label="Monsoon (Jun–Sep)" value={c.monsoon_rain_mm != null ? `${c.monsoon_rain_mm} mm (${c.monsoon_share_pct}%)` : null} />
            <Kv label="Max 1-day rainfall" value={c.max_1day_rain_mm} unit="mm" />
            <Kv label="Mean air temperature" value={c.temp_mean_c} unit="°C" />
            <Kv label="Coldest / warmest month" value={`${c.temp_coldest_month_c} / ${c.temp_warmest_month_c}`} unit="°C" />
          </Section>

          <Section title="Soil (OpenLandMap, surface)">
            <Kv label="Texture class" value={s.texture} />
            <Kv label="Clay / silt / sand" value={`${s.clay_pct} / ${s.silt_pct} / ${s.sand_pct}`} unit="%" />
            <Kv label="pH" value={s.ph} />
          </Section>

          <Section title="Water & people">
            <Kv label="Permanent water (>50% of time)" value={report.water.permanent_water_km2} unit="km²" />
            <Kv label="Occasional water" value={report.water.occasional_water_km2} unit="km²" />
            <Kv label={`Population ${p.population_year || ""} (WorldPop est.)`} value={(p.population_est ?? p.population_2020_est)?.toLocaleString()} />
            <Kv label="Density" value={p.density_per_km2} unit="/km²" />
            <Kv label="Built-up area" value={`${p.built_up_km2} km² (${p.built_up_pct}%)`} />
            <Kv label="Buildings (Google Open Buildings)" value={p.buildings != null ? p.buildings.toLocaleString() : 'AOI > 200 km²'} />
            <Kv label="Tree canopy (2000)" value={p.tree_cover_pct_2000} unit="%" />
          </Section>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => printReport(report)} className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg py-2">
              <Printer size={11} /> Print / PDF
            </button>
            <button onClick={() => downloadCsv('site_report.csv', flatten(report))} className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg py-2">
              <Download size={11} /> CSV
            </button>
            <button onClick={save} disabled={!projectInfo} className="flex items-center justify-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 rounded-lg py-2">
              <Save size={11} /> {saveMsg || 'Save'}
            </button>
          </div>
          <p className="text-[9px] text-slate-400 leading-snug">
            Desk-study screening from global datasets (30 m – 11 km resolution). Always confirm with field survey, soil tests and local records (DHM, DoS).
          </p>
        </div>
      )}
    </div>
  );
}
