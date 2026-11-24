import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Coins, X, LogIn, AlertCircle } from 'lucide-react';
import { onPaywall, isPaidLink } from './paywall';

/**
 * Global pieces of the export paywall, mounted once in App:
 * - the "not enough credits / log in" popup that requireExport() opens
 * - paid download links (/download/<token>) always open in a new tab,
 *   so the user never loses the map and results they are working on.
 */
export default function PaywallModal() {
  const [info, setInfo] = useState(null);

  useEffect(() => onPaywall(setInfo), []);

  useEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest?.('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0) return;
      if (isPaidLink(a.getAttribute('href'))) {
        e.preventDefault();
        window.open(a.href, '_blank', 'noopener');
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  if (!info) return null;
  const close = () => setInfo(null);
  const next = encodeURIComponent(window.location.pathname + window.location.search);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/50 flex items-center justify-center p-4" onClick={close}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
        {info.reason === 'credits' && (
          <>
            <div className="h-11 w-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><Coins size={22} /></div>
            <h3 className="mt-4 font-black text-slate-800 text-lg">Not enough credits</h3>
            <p className="mt-1 text-sm text-slate-600">
              {info.label ? <><b>{info.label}</b> needs </> : 'This export needs '}
              {info.needed} credit{info.needed === 1 ? '' : 's'}. You have {info.balance ?? 0}.
            </p>
            <p className="mt-2 text-[12.5px] text-slate-500">Running tools and analyses is free — credits are only used when you download or export a result.</p>
            <a href="/tool?module=billing" className="mt-5 block text-center rounded-xl bg-theme-700 hover:bg-theme-600 text-white text-sm font-bold py-3">Buy credits</a>
          </>
        )}
        {info.reason === 'login' && (
          <>
            <div className="h-11 w-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"><LogIn size={22} /></div>
            <h3 className="mt-4 font-black text-slate-800 text-lg">Log in to export</h3>
            <p className="mt-1 text-sm text-slate-600">Downloads and exports need a free account. New accounts get free credits to start.</p>
            <a href={`/login?next=${next}`} className="mt-5 block text-center rounded-xl bg-theme-700 hover:bg-theme-600 text-white text-sm font-bold py-3">Log in</a>
          </>
        )}
        {info.reason === 'error' && (
          <>
            <div className="h-11 w-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center"><AlertCircle size={22} /></div>
            <h3 className="mt-4 font-black text-slate-800 text-lg">Export failed</h3>
            <p className="mt-1 text-sm text-slate-600">{info.message}</p>
            <button onClick={close} className="mt-5 w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold py-3">Close</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
