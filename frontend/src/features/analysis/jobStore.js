// Background analysis jobs, shared by every tool panel.
//
// A run is submitted to /api/analysis/jobs and then polled here, outside any
// component, so it keeps going when the user switches tools or modules. When a
// job ends, subscribers hear about it (the tool panel shows the result, the jobs
// tray shows a toast) and, if the tab is in the background, a browser
// notification is shown. Active job ids survive a page reload (sessionStorage).
import { getJob } from '../../api/hubApi';
import { TOOL_CONFIGS } from './toolConfigs';

const POLL_MS = 3000;
const KEY = 'mn_active_jobs';
const jobs = new Map(); // id -> { id, toolId, label, aoiName, status, startedAt, result?, error?, seen? }
const listeners = new Set();
let timer = null;

const emit = () => listeners.forEach((fn) => { try { fn(); } catch { /* listener errors stay local */ } });

const persist = () => {
  try {
    const active = [...jobs.values()].filter((j) => j.status === 'queued' || j.status === 'running')
      .map(({ id, toolId, label, aoiName, startedAt }) => ({ id, toolId, label, aoiName, startedAt }));
    sessionStorage.setItem(KEY, JSON.stringify(active));
  } catch { /* storage blocked: jobs just won't survive a reload */ }
};

export const toolLabel = (toolId) => TOOL_CONFIGS[toolId]?.label || toolId;

function notifyBrowser(job) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
    const n = new Notification(job.status === 'done' ? 'Analysis finished' : 'Analysis failed', {
      body: `${job.label}${job.aoiName ? ` · ${job.aoiName}` : ''}`,
      icon: '/assets/MapNiti_logo_transparent.png',
      tag: `mn-job-${job.id}`,
    });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* notifications unsupported */ }
}

async function pollOnce() {
  const active = [...jobs.values()].filter((j) => j.status === 'queued' || j.status === 'running');
  if (!active.length) { clearInterval(timer); timer = null; return; }
  await Promise.all(active.map(async (j) => {
    try {
      const r = await getJob(j.id);
      if (r.status === j.status) return;
      Object.assign(j, { status: r.status, result: r.result, error: r.error, seconds: r.seconds });
      if (r.status === 'done' || r.status === 'error') notifyBrowser(j);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 401) {
        Object.assign(j, { status: 'error', error: 'This run is no longer available.' });
      } // network blips: try again next tick
    }
  }));
  persist();
  emit();
}

function ensurePolling() {
  if (!timer) timer = setInterval(pollOnce, POLL_MS);
}

/** Start tracking a submitted job (the /jobs response). */
export function trackJob(res, { toolId, aoiName }) {
  const job = {
    id: res.id, toolId, label: toolLabel(toolId), aoiName,
    status: res.status, result: res.result, error: res.error, startedAt: Date.now(), seen: false,
  };
  jobs.set(job.id, job);
  persist();
  emit();
  if (job.status === 'queued' || job.status === 'running') ensurePolling();
  return job;
}

export const getJobState = (id) => jobs.get(id);
export const allJobs = () => [...jobs.values()].sort((a, b) => b.startedAt - a.startedAt);
export const activeJobFor = (toolId) => allJobs().find((j) => j.toolId === toolId && (j.status === 'queued' || j.status === 'running'));

/** Mark a finished job as handled (its tool panel showed it, or the user dismissed the toast). */
export function markSeen(id) {
  const j = jobs.get(id);
  if (j && !j.seen) { j.seen = true; emit(); }
}

export function forget(id) {
  jobs.delete(id);
  persist();
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function askNotificationPermission() {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
  } catch { /* unsupported */ }
}

// ---- "open this run in its tool" (from the history list or a toast) ----------
let pendingOpen = null;
const openListeners = new Set();
export const MODULE_OF_TOOL = { urban: 'urban', disaster: 'disaster', agri: 'agriculture', hydro: 'hydrology' };

export function requestOpenRun(toolId, runId) {
  pendingOpen = { toolId, runId };
  openListeners.forEach((fn) => fn(pendingOpen));
}
export const peekOpenRun = () => pendingOpen;
export function takeOpenRun(toolId) {
  if (pendingOpen?.toolId !== toolId) return null;
  const p = pendingOpen;
  pendingOpen = null;
  return p;
}
export function onOpenRun(fn) {
  openListeners.add(fn);
  return () => openListeners.delete(fn);
}

// Resume jobs that were running before a page reload.
try {
  JSON.parse(sessionStorage.getItem(KEY) || '[]').forEach((j) => jobs.set(j.id, { ...j, status: 'running', seen: false }));
  if (jobs.size) ensurePolling();
} catch { /* nothing to resume */ }
