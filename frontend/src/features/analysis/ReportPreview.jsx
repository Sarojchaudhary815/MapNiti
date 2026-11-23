import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';

/** Full-screen preview of the printable report with a Print / Save as PDF button. */
export default function ReportPreview({ html, onClose }) {
  const frame = useRef(null);
  const print = () => frame.current?.contentWindow?.print();
  return createPortal(
    <div className="fixed inset-0 z-[2100] flex flex-col bg-slate-900/60 backdrop-blur-sm p-2 md:p-6" onClick={onClose}>
      <div className="flex flex-col w-full max-w-4xl mx-auto h-full bg-white rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
          <p className="text-sm font-black text-slate-800">Analysis report</p>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] text-slate-500">Choose <b>Save as PDF</b> as the printer to keep a file.</span>
            <button onClick={print} className="flex items-center gap-1.5 rounded-lg bg-[#0047AB] hover:bg-blue-800 text-white px-3 py-2 text-[12px] font-bold">
              <Printer size={14} /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
          </div>
        </div>
        <iframe ref={frame} title="Analysis report" srcDoc={html} className="flex-1 w-full border-0 bg-slate-200" />
      </div>
    </div>,
    document.body,
  );
}
