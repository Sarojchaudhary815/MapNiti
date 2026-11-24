import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Wallet, Loader2, CheckCircle2, XCircle, Image as ImageIcon, Upload, Gift, Save } from 'lucide-react';
import {
  adminPayments, adminPaymentProof, adminDecidePayment, adminGrantCredits,
  adminBillingSettings, adminSaveBillingSettings, adminBillingSummary,
} from '../../api/hubApi';

const errText = (err, fallback) => {
  const d = err.response?.data?.detail;
  return typeof d === 'string' ? d : fallback;
};

const readFile = (file) => new Promise((resolve, reject) => {
  if (file.size > 3 * 1024 * 1024) { reject(new Error('Image is larger than 3 MB.')); return; }
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error('Could not read that image.'));
  r.readAsDataURL(file);
});

const card = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5';
const input = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2';

/** Admin: approve QR / wallet payments, grant credits, set payment details. */
export default function AdminPayments() {
  const [status, setStatus] = useState('pending');
  const [list, setList] = useState(null);
  const [pending, setPending] = useState(0);
  const [summary, setSummary] = useState(null);
  const [notes, setNotes] = useState({});
  const [proofs, setProofs] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const [grant, setGrant] = useState({ email: '', credits: 10, days: 0, note: '' });
  const [grantMsg, setGrantMsg] = useState('');

  const [settings, setSettings] = useState(null);
  const [qr, setQr] = useState(null);
  const [settingsMsg, setSettingsMsg] = useState('');

  const load = useCallback(() => {
    setError('');
    adminPayments(status).then((r) => { setList(r.payments); setPending(r.pending); }).catch((e) => setError(errText(e, 'Could not load payments.')));
    adminBillingSummary().then(setSummary).catch(() => {});
  }, [status]);

  useEffect(() => { setList(null); load(); }, [load]);
  useEffect(() => { adminBillingSettings().then(setSettings).catch(() => {}); }, []);
  const proofUrls = useRef([]);
  useEffect(() => () => proofUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const showProof = async (id) => {
    try {
      const blob = await adminPaymentProof(id);
      const url = URL.createObjectURL(blob);
      proofUrls.current.push(url);
      setProofs((p) => ({ ...p, [id]: url }));
    } catch (e) { setError('Could not load the screenshot.'); }
  };

  const decide = async (id, action) => {
    setBusyId(id); setError('');
    try { await adminDecidePayment(id, action, notes[id] || null); load(); } catch (e) { setError(errText(e, 'Could not update the payment.')); } finally { setBusyId(null); }
  };

  const doGrant = async (e) => {
    e.preventDefault(); setGrantMsg('');
    try {
      const r = await adminGrantCredits({ ...grant, credits: Number(grant.credits) || 0, days: Number(grant.days) || 0, note: grant.note || null });
      setGrantMsg(`Done — ${r.user.name} now has ${r.balance} credits.`);
      setGrant({ email: '', credits: 10, days: 0, note: '' });
    } catch (err) { setGrantMsg(errText(err, 'Could not grant credits.')); }
  };

  const onQr = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { setQr(await readFile(f)); } catch (err) { setSettingsMsg(err.message); }
  };

  const saveSettings = async (extra = {}) => {
    setSettingsMsg('');
    try {
      const s = await adminSaveBillingSettings({
        account_name: settings.account_name, wallet_number: settings.wallet_number, instructions: settings.instructions,
        ...(qr ? { qr_data_url: qr } : {}), ...extra,
      });
      setSettings(s); setQr(null); setSettingsMsg('Saved.');
    } catch (err) { setSettingsMsg(errText(err, 'Could not save.')); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Wallet className="text-brand-600" size={20} />
        <h2 className="text-sm font-black text-slate-700 uppercase tracking-wide">Payments & credits</h2>
        {pending > 0 && <span className="text-[10px] font-black bg-amber-500 text-white rounded-full px-2 py-0.5">{pending} waiting</span>}
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[['Revenue', `Rs ${summary.revenue_npr.toLocaleString()}`], ['Approved payments', summary.approved_payments],
            ['Exports', summary.exports], ['Paid exports', summary.paid_exports]].map(([l, v]) => (
            <div key={l} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
              <p className="text-lg font-black text-slate-800">{v}</p>
              <p className="text-[10px] font-bold uppercase text-slate-400">{l}</p>
            </div>
          ))}
        </div>
      )}

      <div className={card}>
        <div className="flex gap-1.5 mb-4">
          {['pending', 'approved', 'rejected', 'all'].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`text-[11px] font-bold capitalize rounded-lg px-3 py-1.5 ${status === s ? 'bg-[#0047AB] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s}</button>
          ))}
        </div>
        {error && <p className="text-xs font-bold text-red-600 mb-3">{error}</p>}
        {!list ? <Loader2 className="animate-spin text-slate-400" size={18} /> : list.length === 0 ? (
          <p className="text-sm text-slate-400">No {status === 'all' ? '' : status} payments.</p>
        ) : (
          <div className="space-y-3">
            {list.map((p) => (
              <div key={p.id} className="border border-slate-100 rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-slate-800">{p.pack_name} · Rs {p.amount_npr.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.user?.name} · {p.user?.email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.method_label} · Txn <b className="text-slate-700 select-all">{p.txn_id}</b> · {new Date(p.created_at).toLocaleString()}</p>
                    {p.note && <p className="text-xs text-slate-600 mt-1 italic">"{p.note}"</p>}
                    {p.admin_note && <p className="text-xs text-slate-500 mt-1">Admin note: {p.admin_note}</p>}
                  </div>
                  <span className={`text-[10px] font-black uppercase rounded-full px-2 py-0.5 ${p.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : p.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{p.status}</span>
                </div>
                {p.has_proof && (proofs[p.id]
                  ? <a href={proofs[p.id]} target="_blank" rel="noreferrer"><img src={proofs[p.id]} alt="Payment screenshot" className="mt-3 max-h-64 rounded-lg border" /></a>
                  : <button onClick={() => showProof(p.id)} className="mt-3 text-xs font-bold text-blue-600 flex items-center gap-1"><ImageIcon size={13} /> Show screenshot</button>)}
                {p.status === 'pending' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input value={notes[p.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))} placeholder="Note to the user (optional)"
                      className="flex-1 min-w-[180px] text-xs border border-slate-200 rounded-lg px-3 py-2" />
                    <button disabled={busyId === p.id} onClick={() => decide(p.id, 'approve')}
                      className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg px-3 py-2 flex items-center gap-1"><CheckCircle2 size={13} /> Approve</button>
                    <button disabled={busyId === p.id} onClick={() => decide(p.id, 'reject')}
                      className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg px-3 py-2 flex items-center gap-1"><XCircle size={13} /> Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-4">Check each transaction ID in your eSewa / Khalti / bank app before approving. Approving adds the credits (or the unlimited plan) straight away.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <form onSubmit={doGrant} className={`${card} space-y-3`}>
          <p className="font-black text-slate-800 flex items-center gap-2"><Gift size={16} className="text-brand-600" /> Give credits</p>
          <input type="email" required value={grant.email} onChange={(e) => setGrant({ ...grant, email: e.target.value })} placeholder="User email" className={input} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-bold text-slate-500">Credits (minus to remove)
              <input type="number" value={grant.credits} onChange={(e) => setGrant({ ...grant, credits: e.target.value })} className={`${input} mt-1`} />
            </label>
            <label className="text-[11px] font-bold text-slate-500">Unlimited days
              <input type="number" min="0" max="366" value={grant.days} onChange={(e) => setGrant({ ...grant, days: e.target.value })} className={`${input} mt-1`} />
            </label>
          </div>
          <input value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} placeholder="Reason (optional)" className={input} />
          <button className="text-sm font-bold text-white bg-[#0047AB] hover:bg-blue-800 rounded-lg px-4 py-2">Give</button>
          {grantMsg && <p className="text-xs font-semibold text-slate-600">{grantMsg}</p>}
        </form>

        {settings && (
          <div className={`${card} space-y-3`}>
            <p className="font-black text-slate-800">Payment details shown to users</p>
            <input value={settings.account_name} onChange={(e) => setSettings({ ...settings, account_name: e.target.value })} placeholder="Account name" className={input} />
            <input value={settings.wallet_number} onChange={(e) => setSettings({ ...settings, wallet_number: e.target.value })} placeholder="eSewa / Khalti / account number" className={input} />
            <textarea rows={3} value={settings.instructions} onChange={(e) => setSettings({ ...settings, instructions: e.target.value })} className={input} />
            <div className="flex items-center gap-3">
              {(qr || settings.qr_url) && <img src={qr || settings.qr_url} alt="Payment QR" className="h-20 w-20 object-contain border rounded-lg bg-white" />}
              <label className="cursor-pointer text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-2 flex items-center gap-1">
                <Upload size={13} /> {settings.qr_url ? 'Change QR' : 'Upload QR'}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onQr} className="hidden" />
              </label>
              {settings.qr_url && !qr && <button type="button" onClick={() => saveSettings({ remove_qr: true })} className="text-xs text-slate-400 hover:text-red-500">Remove QR</button>}
            </div>
            <button type="button" onClick={() => saveSettings()} className="text-sm font-bold text-white bg-[#0047AB] hover:bg-blue-800 rounded-lg px-4 py-2 flex items-center gap-1.5"><Save size={14} /> Save</button>
            {settingsMsg && <p className="text-xs font-semibold text-slate-600">{settingsMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
