import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, Loader2, Coins, AlertCircle, CheckCircle2, Infinity as InfinityIcon } from 'lucide-react';
import { payExport } from '../../api/hubApi';

/**
 * Opens a paid download link (/download/<token>). Shows the file and its price,
 * charges on confirm, then hands over the real file URL.
 */
export default function DownloadPage() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [state, setState] = useState('loading');   // loading | ready | paying | done | error
  const [error, setError] = useState('');

  useEffect(() => {
    payExport({ token, dry_run: true })
      .then((q) => { setQuote(q); setState('ready'); })
      .catch((e) => { setError(e.response?.data?.detail || 'Could not open this download.'); setState('error'); });
  }, [token]);

  const download = async () => {
    setState('paying');
    try {
      const res = await payExport({ token });
      setState('done');
      window.location.href = res.url;
    } catch (e) {
      const d = e.response?.data?.detail;
      if (e.response?.status === 402) {
        setQuote((q) => ({ ...q, balance: d?.balance ?? q.balance, enough: false }));
        setState('ready');
      } else {
        setError(typeof d === 'string' ? d : 'The download could not start.');
        setState('error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f9] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md p-8">
        <Link to="/" className="block mb-6"><img src="/assets/MapNiti_logo_transparent.png" alt="MapNiti" className="h-9" /></Link>

        {state === 'loading' && <Loader2 className="animate-spin text-slate-400" />}

        {state === 'error' && (
          <div>
            <p className="flex items-center gap-2 font-black text-slate-800"><AlertCircle className="text-red-500" size={20} /> Download not available</p>
            <p className="text-sm text-slate-600 mt-2">{String(error)}</p>
            <Link to="/tool" className="inline-block mt-5 text-sm font-bold text-theme-700 underline">Back to MapNiti Tool</Link>
          </div>
        )}

        {quote && (state === 'ready' || state === 'paying' || state === 'done') && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{quote.kind_label}</p>
            <h1 className="text-xl font-black text-slate-800 mt-1 break-words">{quote.label || 'Your file'}</h1>

            <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm space-y-1.5">
              {quote.unlimited ? (
                <p className="flex items-center gap-2 text-emerald-700 font-semibold"><InfinityIcon size={16} /> Free with your unlimited plan</p>
              ) : quote.already_paid ? (
                <p className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 size={16} /> Already paid — free again for 24 hours</p>
              ) : (
                <p className="flex items-center gap-2 text-slate-700"><Coins size={16} className="text-amber-600" /> Costs <b>{quote.cost} credit{quote.cost === 1 ? '' : 's'}</b></p>
              )}
              <p className="text-slate-500">Your balance: <b className="text-slate-700">{quote.balance}</b> credits</p>
            </div>

            {state === 'done' ? (
              <p className="mt-6 text-sm text-emerald-700 font-semibold flex items-center gap-2"><CheckCircle2 size={16} /> Your download has started. You can close this tab.</p>
            ) : quote.enough ? (
              <button onClick={download} disabled={state === 'paying'}
                className="mt-6 w-full rounded-xl bg-theme-700 hover:bg-theme-600 disabled:opacity-50 text-white font-bold py-3 flex items-center justify-center gap-2">
                {state === 'paying' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {quote.due ? `Download · ${quote.due} credit${quote.due === 1 ? '' : 's'}` : 'Download'}
              </button>
            ) : (
              <div className="mt-6">
                <p className="text-sm text-slate-600">You need {quote.due} credits for this file. Buy a pack and come back to this link — it works for 24 hours.</p>
                <a href="/tool?module=billing" className="mt-4 block text-center rounded-xl bg-theme-700 hover:bg-theme-600 text-white font-bold py-3">Buy credits</a>
              </div>
            )}
            <p className="mt-4 text-[11.5px] text-slate-400">Running tools and analyses is free. Credits are only used for downloads and exports, and the same file is free again for 24 hours.</p>
          </div>
        )}
      </div>
    </div>
  );
}
