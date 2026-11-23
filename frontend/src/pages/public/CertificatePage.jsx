import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer, ShieldCheck, Loader2, SearchX, ArrowLeft } from 'lucide-react';
import { verifyCertificate } from '../../api/hubApi';
import { API_ORIGIN } from '../../config';
import ShareButtons from '../../features/articles/ShareButtons';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** Public page: shows and verifies a Learn certificate by its code, with print and share. */
export default function CertificatePage() {
  const { code } = useParams();
  const [cert, setCert] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    setState('loading');
    verifyCertificate(code).then((c) => { setCert(c); setState('ok'); }).catch(() => setState('missing'));
  }, [code]);

  useEffect(() => {
    if (cert) document.title = `${cert.name} · ${cert.course_title} | MapNiti certificate`;
  }, [cert]);

  if (state === 'loading') {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>;
  }
  if (state === 'missing') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <SearchX size={40} className="text-slate-300" />
        <h1 className="font-display text-2xl font-semibold text-slate-800 mt-4">No certificate with code “{code}”</h1>
        <p className="text-slate-500 mt-1">Check the code and try again.</p>
        <Link to="/learn" className="mt-6 text-theme-700 font-semibold underline">Go to MapNiti Learn</Link>
      </div>
    );
  }

  const shareUrl = `${API_ORIGIN || window.location.origin}/share/certificates/${cert.code}`;
  return (
    <div className="bg-[#f6f7f9] min-h-screen py-10 px-4 print:bg-white print:p-0">
      <style>{'@media print { @page { size: A4 landscape; margin: 0 } nav, header, footer, .no-print { display: none !important } }'}</style>
      <div className="max-w-5xl mx-auto">
        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link to="/learn" className="text-[13px] text-slate-500 hover:text-slate-800 flex items-center gap-1"><ArrowLeft size={14} /> MapNiti Learn</Link>
          <p className="text-[13px] text-emerald-700 flex items-center gap-1.5 font-semibold"><ShieldCheck size={16} /> Verified certificate</p>
        </div>

        {/* the certificate */}
        <div className="relative bg-white aspect-[1.414/1] w-full rounded-2xl print:rounded-none shadow-xl print:shadow-none overflow-hidden">
          <div className="absolute inset-3 md:inset-5 border-[3px] border-[#0047AB]/80 rounded-xl print:rounded-none" />
          <div className="absolute inset-5 md:inset-8 border border-amber-400/70 rounded-lg print:rounded-none" />
          <div className="relative h-full flex flex-col items-center justify-center text-center px-8 md:px-20">
            <img src="/assets/MapNiti_logo_transparent.png" alt="MapNiti" className="h-10 md:h-14 object-contain" />
            <p className="mt-3 md:mt-5 font-mono text-[9px] md:text-[12px] tracking-[0.35em] text-amber-600">CERTIFICATE OF COMPLETION</p>
            <p className="mt-3 md:mt-6 text-[11px] md:text-[15px] text-slate-500">This certifies that</p>
            <p className="mt-1 md:mt-2 font-display text-2xl md:text-5xl font-semibold text-slate-900">{cert.name}</p>
            <div className="mt-2 md:mt-3 h-px w-40 md:w-72 bg-slate-300" />
            <p className="mt-3 md:mt-5 text-[11px] md:text-[15px] text-slate-500">has completed every lesson and passed the final quiz of</p>
            <p className="mt-1 md:mt-2 font-display text-base md:text-3xl font-semibold text-[#0047AB] leading-tight">{cert.course_title}</p>
            <p className="mt-2 md:mt-3 text-[11px] md:text-[14px] text-slate-600">with a score of <b>{cert.score}%</b></p>
            <div className="mt-5 md:mt-10 w-full flex items-end justify-between text-left text-[9px] md:text-[12px] text-slate-500">
              <div>
                <p className="font-semibold text-slate-700">{fmtDate(cert.issued_at)}</p>
                <p>Date issued</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-slate-700">{cert.code}</p>
                <p>Verify at {window.location.host}/certificate/{cert.code}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-4">
          <ShareButtons shareUrl={shareUrl} title={`I completed ${cert.course_title} on MapNiti Learn`} />
          <button onClick={() => window.print()} className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-semibold px-4 py-2 flex items-center gap-1.5">
            <Printer size={15} /> Print / save as PDF
          </button>
        </div>
      </div>
    </div>
  );
}
