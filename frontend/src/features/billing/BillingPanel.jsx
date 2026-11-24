import React, { useCallback, useEffect, useState } from 'react';
import { Coins, Infinity as InfinityIcon, Loader2, CheckCircle2, Clock, XCircle, Upload, Copy, AlertCircle } from 'lucide-react';
import { getBillingPlans, getMyBilling, submitPayment } from '../../api/hubApi';
import { compressPhoto } from '../field/fieldQueue';
import { setBalance } from './paywall';

const STATUS = {
  pending: { icon: Clock, cls: 'text-amber-700 bg-amber-50', label: 'Checking' },
  approved: { icon: CheckCircle2, cls: 'text-emerald-700 bg-emerald-50', label: 'Approved' },
  rejected: { icon: XCircle, cls: 'text-red-600 bg-red-50', label: 'Rejected' },
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Tool panel: credit balance, packs, pay by QR / wallet, and history. */
export default function BillingPanel() {
  const [plans, setPlans] = useState(null);
  const [me, setMe] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [pack, setPack] = useState('standard');
  const [method, setMethod] = useState('esewa');
  const [txn, setTxn] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);   // { ok, text }
  const [copied, setCopied] = useState(false);

  const loadMe = useCallback(() => getMyBilling().then((m) => { setMe(m); setBalance(m.balance); }), []);

  useEffect(() => {
    Promise.all([getBillingPlans().then(setPlans), loadMe()])
      .catch(() => setLoadError('Could not load your credits. Check your connection and try again.'));
  }, [loadMe]);

  const onProof = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { setProof(await compressPhoto(f, 1600, 0.8)); } catch (err) { setMsg({ ok: false, text: err.message || 'Could not read that image.' }); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await submitPayment({ pack_id: pack, method, txn_id: txn.trim(), note: note.trim() || null, proof_data_url: proof });
      setTxn(''); setNote(''); setProof(null);
      setMsg({ ok: true, text: 'Thanks! We will check the payment and add your credits, usually within a few hours.' });
      loadMe();
    } catch (err) {
      const d = err.response?.data?.detail;
      setMsg({ ok: false, text: typeof d === 'string' ? d : Array.isArray(d) ? 'Please check the transaction ID (at least 4 characters).' : 'Could not send the payment. Try again.' });
    } finally { setBusy(false); }
  };

  const copyNumber = () => {
    navigator.clipboard?.writeText(plans.payment.wallet_number).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  if (loadError) return <p className="text-[11px] text-red-600 flex gap-1.5"><AlertCircle size={14} className="shrink-0" />{loadError}</p>;
  if (!plans || !me) return <Loader2 className="animate-spin text-slate-400" size={18} />;

  const chosen = plans.packs.find((p) => p.id === pack);
  const pay = plans.payment;

  return (
    <div className="p-5 space-y-5">
      {/* balance */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0047AB] to-[#0a5fd1] text-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Your credits</p>
        <p className="text-3xl font-black mt-1 flex items-center gap-2"><Coins size={24} className="text-yellow-300" />{me.balance}</p>
        {me.unlimited && (
          <p className="mt-2 text-[11px] font-bold bg-white/15 rounded-lg px-2 py-1 inline-flex items-center gap-1">
            <InfinityIcon size={13} /> Unlimited exports until {fmtDate(me.unlimited_until)}
          </p>
        )}
        <p className="mt-2 text-[10.5px] text-white/80 leading-snug">Tools and analyses are free. Credits are used only when you download or export, and the same file is free again for 24 hours.</p>
      </div>

      {/* price list */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Cost per export</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(plans.prices).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[11px] bg-slate-50 rounded-lg px-2.5 py-1.5">
              <span className="text-slate-600">{plans.kind_labels[k]}</span><b className="text-slate-800">{v}</b>
            </div>
          ))}
        </div>
      </div>

      {/* packs */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Buy credits</p>
        <div className="space-y-1.5">
          {plans.packs.map((p) => (
            <button key={p.id} type="button" onClick={() => setPack(p.id)}
              className={`w-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${pack === p.id ? 'border-[#0047AB] bg-blue-50/60' : 'border-slate-100 hover:border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-black text-slate-800">
                  {p.name}{p.popular && <span className="ml-1.5 text-[9px] font-bold uppercase text-white bg-amber-500 rounded px-1.5 py-0.5 align-middle">Popular</span>}
                </span>
                <span className="text-[13px] font-black text-[#0047AB]">Rs {p.price.toLocaleString()}</span>
              </div>
              <p className="text-[10.5px] text-slate-500 mt-0.5">
                {p.days ? `No credit limit for ${p.days} days` : `${p.credits} credits · Rs ${(p.price / p.credits).toFixed(0)} each`} — {p.blurb}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* how to pay */}
      <form onSubmit={submit} className="rounded-2xl border border-slate-100 p-3.5 space-y-3">
        <p className="text-[12px] font-black text-slate-800">Pay Rs {chosen?.price.toLocaleString()} for {chosen?.name}</p>
        <p className="text-[10.5px] text-slate-500 leading-snug">{pay.instructions}</p>
        {pay.qr_url && <img src={pay.qr_url} alt="Payment QR code" className="w-44 h-44 object-contain mx-auto rounded-xl border border-slate-100 bg-white" />}
        <div className="text-[11px] bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-slate-500">Send to <b className="text-slate-700">{pay.account_name}</b></p>
          <p className="flex items-center gap-2 mt-0.5">
            <b className="text-slate-800 text-[13px] tracking-wide">{pay.wallet_number}</b>
            <button type="button" onClick={copyNumber} className="text-slate-400 hover:text-slate-700" title="Copy number"><Copy size={12} /></button>
            {copied && <span className="text-emerald-600 text-[10px] font-bold">Copied</span>}
          </p>
        </div>

        <label className="block">
          <span className="text-[10px] font-bold text-slate-500">Paid with</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-2 bg-white">
            {Object.entries(plans.methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-slate-500">Transaction ID</span>
          <input value={txn} onChange={(e) => setTxn(e.target.value)} required minLength={4} maxLength={80} placeholder="e.g. 0A1B2C3D"
            className="mt-1 w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-2" />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-slate-500">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Sender name or anything we should know"
            className="mt-1 w-full text-[12px] border border-slate-200 rounded-lg px-2.5 py-2" />
        </label>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2">
            <Upload size={12} /> {proof ? 'Change screenshot' : 'Add screenshot'}
            <input type="file" accept="image/*" onChange={onProof} className="hidden" />
          </label>
          {proof && <img src={proof} alt="Payment screenshot" className="h-9 w-9 object-cover rounded-md border" />}
          {proof && <button type="button" onClick={() => setProof(null)} className="text-[10px] text-slate-400 hover:text-red-500">Remove</button>}
        </div>

        {msg && <p className={`text-[11px] font-semibold ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
        <button disabled={busy || txn.trim().length < 4}
          className="w-full rounded-xl bg-theme-700 hover:bg-theme-600 disabled:opacity-40 text-white text-[12px] font-bold py-2.5 flex items-center justify-center gap-2">
          {busy && <Loader2 size={14} className="animate-spin" />} I have paid — send for approval
        </button>
      </form>

      {/* payments */}
      {me.payments.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Your payments</p>
          <div className="space-y-1.5">
            {me.payments.map((p) => {
              const s = STATUS[p.status] || STATUS.pending;
              return (
                <div key={p.id} className="text-[11px] border border-slate-100 rounded-lg px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">{p.pack_name} · Rs {p.amount_npr.toLocaleString()}</span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold rounded px-1.5 py-0.5 ${s.cls}`}><s.icon size={11} />{s.label}</span>
                  </div>
                  <p className="text-slate-400 mt-0.5">{p.method_label} · {p.txn_id} · {fmtDate(p.created_at)}</p>
                  {p.admin_note && <p className="text-slate-500 mt-0.5 italic">{p.admin_note}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* credit history */}
      {me.history.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Credit history</p>
          <div className="divide-y divide-slate-100">
            {me.history.map((h, i) => (
              <div key={i} className="flex justify-between gap-2 text-[11px] py-1.5">
                <span className="text-slate-600 truncate">{h.note || h.reason}<span className="text-slate-400"> · {fmtDate(h.at)}</span></span>
                {h.delta !== 0 && <b className={h.delta > 0 ? 'text-emerald-700' : 'text-slate-700'}>{h.delta > 0 ? `+${h.delta}` : h.delta}</b>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
