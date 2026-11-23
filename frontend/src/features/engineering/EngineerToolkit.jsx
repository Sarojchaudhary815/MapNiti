import React, { useState } from 'react';
import { FileText, MapPin, TrendingUp, Calculator, ChevronRight, ArrowLeft } from 'lucide-react';
import SiteReport from './components/SiteReport';
import PointInspector from './components/PointInspector';
import ElevationProfile from './components/ElevationProfile';
import { CALCULATORS } from './components/Calculators';

const TOOLS = [
  { id: 'site', label: 'Site Report', icon: FileText, desc: 'Terrain, slope, soil, rainfall, land cover, population + red flags for any AOI.', Comp: SiteReport },
  { id: 'point', label: 'Point Inspector', icon: MapPin, desc: 'Click the map → elevation, slope, soil, rain at that spot.', Comp: PointInspector },
  { id: 'profile', label: 'Elevation Profile', icon: TrendingUp, desc: 'Ground profile & grades along a road / canal / pipeline alignment.', Comp: ElevationProfile },
];

export default function EngineerToolkit(props) {
  const [active, setActive] = useState(null);

  if (!active) {
    return (
      <div className="p-5 space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Engineer Toolkit</h2>
          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mt-1">Civil · Geomatics · Hydraulics</p>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Map-based (Earth Engine)</p>
          <div className="space-y-2">
            {TOOLS.map((t) => (
              <button key={t.id} onClick={() => setActive(t.id)}
                className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-orange-400 hover:shadow-md transition-all group text-left">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-50 rounded-xl"><t.icon size={20} className="text-orange-600" /></div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-700 group-hover:text-orange-700">{t.label}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{t.desc}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-orange-500 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Calculators (work offline)</p>
          <div className="grid grid-cols-2 gap-2">
            {CALCULATORS.map((c) => (
              <button key={c.id} onClick={() => setActive(`calc-${c.id}`)}
                className="p-3 bg-white border border-slate-100 rounded-xl hover:border-orange-400 hover:shadow-sm text-left">
                <Calculator size={14} className="text-slate-400 mb-1" />
                <p className="text-[11px] font-bold text-slate-700 leading-tight">{c.label}</p>
                <p className="text-[9px] text-slate-400 leading-tight mt-0.5">{c.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isCalc = active.startsWith('calc-');
  const current = isCalc ? CALCULATORS.find((c) => `calc-${c.id}` === active) : TOOLS.find((t) => t.id === active);
  const Comp = current.Comp;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center gap-3 bg-orange-50/40">
        <button onClick={() => setActive(null)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-orange-200 text-slate-500 hover:text-orange-600">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight italic">{current.label}</h3>
          <p className="text-[9px] text-orange-600 font-bold uppercase tracking-widest">Engineer Toolkit</p>
        </div>
      </div>
      <div className={`flex-grow overflow-y-auto ${isCalc ? 'p-5' : ''}`}>
        <Comp {...props} />
      </div>
    </div>
  );
}
