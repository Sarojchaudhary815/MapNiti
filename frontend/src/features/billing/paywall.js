// Exports cost credits. Call `requireExport()` right before building a file in the
// browser (CSV, GeoJSON, PDF report…): it charges the user and resolves true, or
// shows the "buy credits" popup and resolves false. Files that come from the server
// arrive as /download/<token> links, handled by DownloadPage.
import { payExport } from '../../api/hubApi';

const listeners = new Set();
let balance = null;

export const onPaywall = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const showPaywall = (info) => listeners.forEach((fn) => fn(info));

const balanceListeners = new Set();
export const onBalance = (fn) => { balanceListeners.add(fn); fn(balance); return () => balanceListeners.delete(fn); };
export const setBalance = (b) => { balance = b; balanceListeners.forEach((fn) => fn(b)); };

export const KIND = { raster: 'raster', vector: 'vector', table: 'table', report: 'report', cad: 'cad' };

/**
 * Charge for one export. `ref` identifies the item, so downloading the same
 * thing again within 24 h is free. Resolves true when the export may go ahead.
 */
export async function requireExport({ kind, ref, label }) {
  if (!localStorage.getItem('token')) {
    showPaywall({ reason: 'login', label });
    return false;
  }
  try {
    const res = await payExport({ kind, ref: String(ref || label || kind).slice(0, 110), label });
    setBalance(res.balance);
    return true;
  } catch (err) {
    const d = err.response?.data?.detail;
    if (err.response?.status === 402) {
      showPaywall({ reason: 'credits', label, needed: d?.needed, balance: d?.balance });
    } else if (err.response?.status === 401) {
      showPaywall({ reason: 'login', label });
    } else {
      showPaywall({ reason: 'error', label, message: typeof d === 'string' ? d : 'Could not start the export. Check your connection.' });
    }
    return false;
  }
}

/** Wrap an export function: `paid({kind, ref, label}, () => exportCSV(...))`. */
export async function paid(opts, fn) {
  if (await requireExport(opts)) return fn();
  return undefined;
}

/** Short fingerprint of a result, so the same export is recognised again. */
export const hashRef = (value) => {
  const s = typeof value === 'string' ? value : JSON.stringify(value) || '';
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${(h >>> 0).toString(36)}${s.length.toString(36)}`;
};

export const isPaidLink = (href) => typeof href === 'string' && /\/download\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(href);
