import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Play, Download, Save, AlertCircle, Info, ChevronDown, Layers, Globe2, FileText, MoveHorizontal } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import AoiPicker from '../../components/common/AoiPicker';
import MapLegend, { downloadCsv } from '../../components/common/MapLegend';
import { submitJob, getJob } from '../../api/hubApi';
import { featureToAoi } from '../../components/common/AoiPicker';
import {
  trackJob, getJobState, activeJobFor, subscribe, markSeen, askNotificationPermission, takeOpenRun, onOpenRun,
} from './jobStore';
import { saveResult } from '../../api/projectApi';
import { TOOL_CONFIGS } from './toolConfigs';
import PublishArticleModal from '../articles/PublishArticleModal';
import { buildReportHtml } from './analysisReport';
import ReportPreview from './ReportPreview';
import { paid, requireExport } from '../billing/paywall';
import SwipeCompare from './SwipeCompare';
import { useT } from '../../i18n';
import { getCurrentUser } from '../../api/authApi';

const MODULE_OF = { urban: 'Urban Planning', disaster: 'Disaster Risk', agri: 'Agriculture', hydro: 'Hydrology' };

const defaultsFor = (cfg) => {
  const out = {};
  cfg.params.forEach((p) => {
    if (p.type === 'weights') p.items.forEach((i) => { out[i.key] = i.default; });
    else out[p.key] = p.default;
  });
  return out;
};

const fmtElapsed = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function downloadGeoJson(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/geo+json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}

function Param({ p, values, setValues }) {
  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));
  const base = 'mt-1 w-full text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 font-normal text-slate-800';
  if (p.type === 'weights') {
    const total = p.items.reduce((s, i) => s + Number(values[i.key] || 0), 0) || 1;
    return (
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase text-slate-400">{p.label}</p>
        {p.items.map((i) => (
          <label key={i.key} className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="w-28 shrink-0">{i.label}</span>
            <input type="range" min="0" max="100" value={values[i.key]} onChange={(e) => set(i.key, Number(e.target.value))} className="flex-1" />
            <span className="w-10 text-right font-mono text-[10px]">{Math.round((100 * values[i.key]) / total)}%</span>
          </label>
        ))}
      </div>
    );
  }
  if (p.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-[11px] text-slate-600">
        <input type="checkbox" checked={!!values[p.key]} onChange={(e) => set(p.key, e.target.checked)} /> {p.label}
      </label>
    );
  }
  return (
    <label className="block text-[9px] font-bold uppercase text-slate-400">
      {p.label}{p.unit ? ` (${p.unit})` : ''}
      {p.type === 'select' ? (
        <select value={values[p.key]} onChange={(e) => set(p.key, e.target.value)} className={base}>
          {p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input type={p.type === 'date' ? 'date' : 'number'} min={p.min} max={p.max} step={p.step || 1}
          value={values[p.key]} onChange={(e) => set(p.key, e.target.value)} className={base} />
      )}
    </label>
  );
}

export function ResultView({ result, toolId, opacity, setOpacity }) {
  const chart = result.chart;
  const vectorNames = (result.vectors || []).map((v) => v.name).join(', ');
  // identifies this result, so exporting it again within 24 h is free
  const refBase = `${toolId}:${result.computed_at || ''}:${result.title || ''}`;
  return (
    <div className="space-y-4">
      <p className="text-[13px] font-black text-slate-800">{result.title}</p>

      {(result.legend || result.layers?.length > 0) && (
        <div className="p-3 rounded-xl border border-slate-100 space-y-2">
          <MapLegend legend={result.legend} />
          {result.layers?.length > 0 && (
            <label className="flex items-center gap-2 text-[10px] text-slate-500">
              <Layers size={12} /> Opacity
              <input type="range" min="0.1" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="flex-1" />
            </label>
          )}
        </div>
      )}

      {result.stats?.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {result.stats.map((s) => (
            <div key={s.label} className={`p-2.5 rounded-xl bg-slate-50 border border-slate-100 ${String(s.value).length + String(s.unit || '').length > 28 ? 'col-span-2' : ''}`}>
              <p className="text-[9px] font-bold uppercase text-slate-400 leading-tight">{s.label}</p>
              <p className="text-[13px] font-black text-slate-800 leading-tight mt-0.5 break-words">
                {s.value ?? '—'} <span className="text-[9px] font-medium text-slate-500">{s.unit}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {chart?.data?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 mb-1">{chart.title}</p>
          <div className="h-48 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              {chart.type === 'line' ? (
                <LineChart data={chart.data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey={chart.xKey} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => [`${v} ${chart.unit || ''}`, '']} />
                  <Line dataKey={chart.yKey} stroke="#0047AB" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              ) : (
                <BarChart data={chart.data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey={chart.xKey} tick={{ fontSize: 8, fill: '#94a3b8' }} tickLine={false} interval={0} angle={chart.data.length > 6 ? -35 : 0} textAnchor={chart.data.length > 6 ? 'end' : 'middle'} height={chart.data.length > 6 ? 50 : 20} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} cursor={{ fill: '#f8fafc' }} formatter={(v) => [`${v} ${chart.unit || ''}`, '']} />
                  <Bar dataKey={chart.yKey} radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {chart.data.map((d, i) => <Cell key={i} fill={d.color || (d.projected ? '#93c5fd' : '#0047AB')} />)}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {result.table?.rows?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-slate-500">{result.table.title}</p>
            <button onClick={() => paid({ kind: 'table', ref: `csv:${refBase}`, label: `${result.table.title || toolId} (CSV)` },
              () => downloadCsv(`${toolId}.csv`, result.table.rows.map((r) => Object.fromEntries(result.table.columns.map((c, i) => [c, r[i]])))))}
              className="text-[9px] font-bold text-blue-600 flex items-center gap-0.5"><Download size={10} /> CSV</button>
          </div>
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50"><tr>{result.table.columns.map((c) => <th key={c} className="px-2 py-1 text-left font-bold text-slate-500">{c}</th>)}</tr></thead>
              <tbody>{result.table.rows.map((r, i) => <tr key={i} className="border-t border-slate-50">{r.map((v, j) => <td key={j} className="px-2 py-1 text-slate-700">{String(v)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(result.layers || []).filter((l) => l.download_url).map((l) => (
          <a key={l.layerId} href={l.download_url} className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-2">
            <Download size={11} /> {l.name} (GeoTIFF)
          </a>
        ))}
        {(result.vectors || []).map((v) => (
          <button key={v.id} onClick={() => paid({ kind: 'vector', ref: `geojson:${v.id}:${refBase}`, label: `${v.name} (GeoJSON)` }, () => downloadGeoJson(v.id, v.data))} className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-2">
            <Download size={11} /> {v.name} (GeoJSON)
          </button>
        ))}
      </div>
      {vectorNames && <p className="text-[9px] text-slate-400">Tip: click features on the map ({vectorNames}) to see their attributes.</p>}

      {result.notes?.length > 0 && (
        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1.5">
          {result.notes.map((n, i) => <p key={i} className="text-[10px] text-slate-600 leading-snug flex gap-1.5"><Info size={11} className="text-blue-500 shrink-0 mt-0.5" />{n}</p>)}
        </div>
      )}
    </div>
  );
}

export default function AnalysisRunner({ toolId, selectedAOI, setSelectedAOI, onStartDrawing, setMapLayers, setVectorLayers, projectInfo, mapRef }) {
  const cfg = TOOL_CONFIGS[toolId];
  const t = useT();
  const [values, setValues] = useState(() => defaultsFor(cfg));
  // The run itself lives in jobStore, so it survives switching tools; this panel
  // just follows the job it started (or the one still running for this tool).
  const [jobId, setJobId] = useState(() => activeJobFor(toolId)?.id || null);
  const loading = !!jobId;
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!jobId) return undefined;
    const started = getJobState(jobId)?.startedAt || Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [jobId]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [opacity, setOpacity] = useState(0.8);
  const [showHow, setShowHow] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => () => { setMapLayers([]); setVectorLayers?.([]); }, [setMapLayers, setVectorLayers]);

  useEffect(() => {
    if (!result) return;
    setMapLayers((result.layers || []).map((l) => ({ ...l, opacity })));
  }, [result, opacity, setMapLayers]);

  useEffect(() => {
    if (!result) return;
    setVectorLayers?.((result.vectors || []).map((v, i) => ({ ...v, fit: i === result.vectors.length - 1 })));
  }, [result, setVectorLayers]);

  const payload = useMemo(() => {
    const out = { geometry: selectedAOI?.geojson };
    Object.entries(values).forEach(([k, v]) => { out[k] = v; });
    return out;
  }, [values, selectedAOI]);

  const clearAoi = (v) => {
    setSelectedAOI(v);
    if (!v) {
      setResult(null);
      setMapLayers([]);
      setVectorLayers?.([]);
    }
  };

  // Follow our job: show its result (or error) when the store says it ended.
  useEffect(() => {
    if (!jobId) return undefined;
    const check = () => {
      const j = getJobState(jobId);
      if (!j || j.status === 'queued' || j.status === 'running') return;
      if (j.status === 'done' && j.result) setResult(j.result);
      else setError(j.error || 'Analysis failed.');
      markSeen(jobId);
      setJobId(null);
    };
    check();
    return subscribe(check);
  }, [jobId]);

  // Open a past run from the history list / a finished-job toast.
  const openRun = useCallback(async (runId) => {
    setError('');
    try {
      const r = await getJob(runId);
      if (r.status !== 'done' || !r.result) { setError(r.error || 'That run has no result.'); return; }
      if (r.aoi_geojson) {
        const aoi = featureToAoi(r.aoi_geojson.type === 'Feature' ? r.aoi_geojson : { type: 'Feature', properties: {}, geometry: r.aoi_geojson });
        if (r.aoi_name) aoi.name = r.aoi_name;
        setSelectedAOI(aoi);
      }
      setValues((v) => ({ ...v, ...r.params }));
      setResult(r.result);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not open that run.');
    }
  }, [setSelectedAOI]);
  useEffect(() => {
    const p = takeOpenRun(toolId);
    if (p) openRun(p.runId);
    return onOpenRun((req) => { if (req.toolId === toolId && takeOpenRun(toolId)) openRun(req.runId); });
  }, [toolId, openRun]);

  const run = async (refresh = false) => {
    setError('');
    setResult(null);
    askNotificationPermission();
    try {
      const res = await submitJob(toolId, { ...payload, aoi_name: selectedAOI?.name, refresh: refresh === true });
      const job = trackJob(res, { toolId, aoiName: selectedAOI?.name });
      if (res.status === 'done') { setResult(res.result); markSeen(job.id); } else setJobId(job.id);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed.');
    }
  };

  const [reporting, setReporting] = useState(false);
  const [reportHtml, setReportHtml] = useState('');
  const [swipeOpen, setSwipeOpen] = useState(false);
  const report = async () => {
    setReporting(true);
    try {
      const ok = await requireExport({ kind: 'report', ref: `pdf:${toolId}:${result?.computed_at || ''}:${result?.title || ''}`, label: `${cfg?.label || toolId} report (PDF)` });
      if (!ok) return;
      const image = await mapRef?.current?.snapshot?.({ bbox: selectedAOI?.bbox });
      const params = (cfg?.params || []).map((p) => {
        const v = values[p.key];
        const opt = p.options?.find((o) => String(o.value) === String(v));
        return { label: p.label, value: opt ? opt.label : v };
      });
      setReportHtml(buildReportHtml({
        result, toolLabel: cfg?.label || toolId, aoi: selectedAOI, image, params,
        author: getCurrentUser()?.full_name, project: projectInfo?.name,
      }));
    } finally {
      setReporting(false);
    }
  };

  const save = async () => {
    try {
      const { layers, vectors, ...rest } = result;
      await saveResult(projectInfo.id, toolId.split('-')[0], toolId, selectedAOI?.geojson, { params: values, ...rest });
      setSaveMsg('Saved ✓');
    } catch {
      setSaveMsg('Could not save');
    }
    setTimeout(() => setSaveMsg(''), 2500);
  };

  return (
    <div className="p-5 space-y-4">
      <p className="text-[11px] text-slate-500 leading-relaxed">{cfg.desc}</p>
      <button onClick={() => setShowHow((s) => !s)} className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
        {t('How to use · data sources')} <ChevronDown size={12} className={showHow ? 'rotate-180' : ''} />
      </button>
      {showHow && (
        <div className="text-[10px] text-slate-600 space-y-1 px-1">
          <ol className="list-decimal pl-4 space-y-0.5">{cfg.how.map((h) => <li key={h}>{h}</li>)}</ol>
          <p className="text-slate-400"><b>Data:</b> {cfg.data}</p>
        </div>
      )}

      <AoiPicker selectedAOI={selectedAOI} setSelectedAOI={clearAoi} onStartDrawing={onStartDrawing} />

      {cfg.params.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {cfg.params.map((p) => (
            <div key={p.key} className={p.type === 'weights' || p.type === 'checkbox' ? 'col-span-2' : ''}>
              <Param p={p} values={values} setValues={setValues} />
            </div>
          ))}
        </div>
      )}

      <button onClick={run} disabled={!selectedAOI || loading}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black text-white bg-[#0047AB] hover:bg-blue-800 disabled:opacity-40">
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        {loading ? `${t('Running on Earth Engine…')} ${fmtElapsed(elapsed)}` : selectedAOI ? t('Run analysis') : t('Select an AOI first')}
      </button>
      {loading && (
        <div className="space-y-1.5">
          <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
            {/* Indeterminate bar: Earth Engine gives no progress, so this only shows it's alive. */}
            <div className="h-full w-1/3 rounded-full bg-[#0047AB]/70 animate-[mnslide_1.4s_ease-in-out_infinite]" />
          </div>
          <p className="text-[10.5px] text-slate-400 leading-snug">
            {elapsed < 30
              ? 'Usually 5–30 seconds.'
              : elapsed < 120
                ? 'Large areas, long date ranges and external catalogues (OSM, USGS) take longer. Still working…'
                : 'Big jobs can take up to 3–4 minutes. A smaller area runs much faster.'}
          </p>
          <style>{'@keyframes mnslide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style>
        </div>
      )}
      {error && <p className="text-[11px] text-red-600 flex gap-1.5 bg-red-50 rounded-lg p-2"><AlertCircle size={13} className="shrink-0 mt-0.5" />{error}</p>}

      {result && (
        <>
          {(result.cached || result.layers_expired) && (
            <div className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[10px] ${result.layers_expired ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <span>
                {result.layers_expired
                  ? 'Saved result: the map layer has expired. Run again to see it on the map.'
                  : `Instant result from the cache (computed ${new Date(result.computed_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}).`}
              </span>
              <button onClick={() => run(true)} disabled={loading} className="font-bold underline shrink-0">{t('Run again')}</button>
            </div>
          )}
          <ResultView result={result} toolId={toolId} opacity={opacity} setOpacity={setOpacity} />
          {projectInfo && (
            <button onClick={save} className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg py-2">
              <Save size={12} /> {saveMsg || `Save to "${projectInfo.name}"`}
            </button>
          )}
          {result.layers?.length > 0 && !result.layers_expired && (
            <button onClick={() => setSwipeOpen(true)}
              className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl py-2.5">
              <MoveHorizontal size={14} /> {t('Before / after swipe')}
            </button>
          )}
          <button onClick={report} disabled={reporting}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 rounded-xl py-2.5">
            {reporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} {t('PDF report')}
          </button>
          <button onClick={() => setPublishOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 text-[12px] font-black text-white bg-gradient-to-r from-[#0047AB] to-[#1877F2] hover:opacity-90 rounded-xl py-2.5">
            <Globe2 size={14} /> {t('Publish as article & share')}
          </button>
        </>
      )}
      {swipeOpen && result && (
        <SwipeCompare onClose={() => setSwipeOpen(false)} toolId={toolId} cfg={cfg} values={values}
          result={result} selectedAOI={selectedAOI} />
      )}
      {reportHtml && <ReportPreview html={reportHtml} onClose={() => setReportHtml('')} />}
      {publishOpen && result && (
        <PublishArticleModal onClose={() => setPublishOpen(false)} result={result} toolId={toolId}
          toolLabel={cfg?.label} module={MODULE_OF[toolId.split('-')[0]]}
          selectedAOI={selectedAOI} mapRef={mapRef} />
      )}
    </div>
  );
}
