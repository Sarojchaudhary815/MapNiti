import React from 'react';
import { Wrench } from 'lucide-react';

// Shared placeholder for any sub-tool that isn't backed by a real analysis
// engine yet. Follows the dashed-border empty-state convention already used
// elsewhere in this codebase (AoiManager, RiverCorridorRisk).
export default function ComingSoon({ icon: Icon = Wrench, label, description }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-6 md:p-10">
      <div className="max-w-md w-full border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center flex flex-col items-center gap-4 bg-slate-50/60">
        <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center">
          <Icon className="text-slate-300" size={28} />
        </div>
        <div>
          {label && <h3 className="text-sm font-black text-slate-600 uppercase tracking-tight mb-2">{label}</h3>}
          <span className="inline-block px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest">
            Coming Soon
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
          {description || "This service isn't active yet. We're building it out and it'll be available soon."}
        </p>
      </div>
    </div>
  );
}
