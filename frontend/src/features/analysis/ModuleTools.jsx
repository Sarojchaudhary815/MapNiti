import React, { useState } from 'react';
import { ChevronRight, ArrowLeft } from 'lucide-react';
import AnalysisRunner from './AnalysisRunner';
import { TOOL_CONFIGS } from './toolConfigs';

// Shared list → tool layout for the Urban, Disaster and Agriculture modules.
// `tools` = [{ id, icon, color }] (label/desc come from TOOL_CONFIGS unless
// a custom `Comp` is given for tools that aren't Earth Engine runners).
export default function ModuleTools({ title, subtitle, accent, tools, ...props }) {
  const [active, setActive] = useState(null);
  const meta = (t) => ({ label: t.label || TOOL_CONFIGS[t.id]?.label, desc: t.desc || TOOL_CONFIGS[t.id]?.desc });

  if (!active) {
    return (
      <div className="p-5 space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">{title}</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: accent }}>{subtitle}</p>
        </div>
        <div className="space-y-3">
          {tools.map((t) => (
            <button key={t.id} onClick={() => setActive(t)}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:shadow-md transition-all group text-left"
              style={{ '--accent': accent }}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl"><t.icon size={20} className={t.color} /></div>
                <div>
                  <p className="text-[13px] font-bold text-slate-700">{meta(t).label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{meta(t).desc}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const Comp = active.Comp;
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center gap-3 bg-slate-50/60">
        <button onClick={() => setActive(null)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 text-slate-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight italic">{meta(active).label}</h3>
          <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: accent }}>{title}</p>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        {Comp ? <Comp {...props} /> : <AnalysisRunner key={active.id} toolId={active.id} {...props} />}
      </div>
    </div>
  );
}
