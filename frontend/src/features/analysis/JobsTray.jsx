import React, { useEffect, useReducer, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Loader2, X, History, Trash2, Zap } from 'lucide-react';
import { getRunHistory, deleteRun } from '../../api/hubApi';
import { allJobs, subscribe, markSeen, forget, requestOpenRun, toolLabel, MODULE_OF_TOOL } from './jobStore';

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const isActive = (j) => j.status === 'queued' || j.status === 'running';

function HistoryModal({ onClose, onOpen }) {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState('');
  const load = () => getRunHistory(100).then(setRuns).catch(() => setError('Could not load your history.'));
  useEffect(() => { load(); }, []);
  const remove = async (id) => {
    try { await deleteRun(id); setRuns((r) => r.filter((x) => x.id !== id)); } catch (err) { setError(err.response?.data?.detail || 'Could not delete.'); }
  };
  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2"><History size={18} className="text-[#0047AB]" /><h3 className="font-black text-slate-800">Analysis history</h3></div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="text-[12px] text-red-600 mb-2">{error}</p>}
          {!runs && !error && <p className="flex items-center gap-2 text-sm text-slate-400 p-6 justify-center"><Loader2 size={16} className="animate-spin" /> Loading…</p>}
          {runs && !runs.length && <p className="text-sm text-slate-400 text-center p-8">No analyses yet. Every run you start is listed here, and the same run again comes back instantly.</p>}
          <div className="space-y-1.5">
            {runs?.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50">
                <span className="shrink-0">
                  {r.status === 'done' ? <CheckCircle2 size={16} className="text-emerald-500" />
                    : r.status === 'error' ? <AlertCircle size={16} className="text-red-500" />
                      : <Loader2 size={16} className="animate-spin text-blue-500" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-700 truncate">{toolLabel(r.tool_id)}{r.aoi_name ? <span className="font-medium text-slate-500"> · {r.aoi_name}</span> : null}</p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {fmtDate(r.created_at)}
                    {Object.keys(r.params || {}).length > 0 && ` · ${Object.entries(r.params).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ')}`}
                    {r.cached ? ' · from cache' : r.seconds ? ` · ${fmtTime(r.seconds)}` : ''}
                    {r.status === 'error' && r.error ? ` · ${r.error}` : ''}
                  </p>
                </div>
                {r.status === 'done' && (
                  <button onClick={() => onOpen(r.tool_id, r.id)} className="shrink-0 text-[12px] font-bold text-white bg-[#0047AB] hover:bg-blue-800 rounded-lg px-3 py-1.5">Open</button>
                )}
                {r.status !== 'queued' && r.status !== 'running' && (
                  <button onClick={() => remove(r.id)} title="Remove from history" className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Floating status for background analyses (over the map): running jobs with a
 * timer, a card when one finishes while its tool is closed, and the history.
 * `onOpenModule(moduleId)` switches the dashboard to the tool's module.
 */
export default function JobsTray({ onOpenModule }) {
  const [, rerender] = useReducer((x) => x + 1, 0);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => subscribe(rerender), []);
  const jobs = allJobs();
  const running = jobs.filter(isActive);
  useEffect(() => {
    if (!running.length) return undefined;
    const t = setInterval(rerender, 1000);
    return () => clearInterval(t);
  }, [running.length]);
  const finished = jobs.filter((j) => !isActive(j) && !j.seen);

  const open = (toolId, runId) => {
    setHistoryOpen(false);
    onOpenModule?.(MODULE_OF_TOOL[toolId.split('-')[0]]);
    // let the module mount before the tool panel picks the request up
    setTimeout(() => requestOpenRun(toolId, runId), 0);
  };

  return (
    <>
      <div className="absolute bottom-4 left-4 z-[1000] flex flex-col items-start gap-2 max-w-[calc(100%-6rem)] pointer-events-none">
        {finished.map((j) => (
          <div key={j.id} className={`pointer-events-auto flex items-center gap-2 rounded-xl shadow-xl border px-3 py-2 text-[12px] bg-white ${j.status === 'done' ? 'border-emerald-200' : 'border-red-200'}`}>
            {j.status === 'done' ? <CheckCircle2 size={15} className="text-emerald-500 shrink-0" /> : <AlertCircle size={15} className="text-red-500 shrink-0" />}
            <span className="min-w-0 truncate">
              <b>{j.label}</b>{j.aoiName ? ` · ${j.aoiName}` : ''} {j.status === 'done' ? 'is ready' : 'failed'}
            </span>
            {j.status === 'done' && (
              <button onClick={() => { markSeen(j.id); open(j.toolId, j.id); }} className="font-bold text-[#0047AB] hover:underline shrink-0">Open</button>
            )}
            <button onClick={() => forget(j.id)} className="text-slate-400 hover:text-slate-700 shrink-0"><X size={13} /></button>
          </div>
        ))}
        {running.map((j) => (
          <div key={j.id} className="pointer-events-auto flex items-center gap-2 rounded-xl bg-slate-900/85 text-white shadow-xl px-3 py-2 text-[11px]">
            <Loader2 size={13} className="animate-spin shrink-0" />
            <span className="min-w-0 truncate">{j.label}{j.aoiName ? ` · ${j.aoiName}` : ''}</span>
            <span className="font-mono text-white/70 shrink-0">{fmtTime((Date.now() - j.startedAt) / 1000)}</span>
          </div>
        ))}
        <button onClick={() => setHistoryOpen(true)}
          className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-white/95 hover:bg-white shadow-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700">
          <History size={13} /> History
          {running.length > 0 && <span className="flex items-center gap-0.5 text-blue-600"><Zap size={11} />{running.length} running</span>}
        </button>
      </div>
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} onOpen={open} />}
    </>
  );
}
