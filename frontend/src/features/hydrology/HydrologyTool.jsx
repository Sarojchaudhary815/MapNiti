import React, { useEffect, useState } from 'react';
import { Waves, Mountain, Droplets, Activity, AlertTriangle, ChevronRight, ArrowLeft, Save, GitBranch } from 'lucide-react';
import WatershedDelineation from './components/WatershedDelineation';
import FloodHazardMapping from './components/FloodHazardMapping';
import RainfallRunoffModeling from './components/RainfallRunoffModeling';
import FloodInundation from './components/FloodInundation';
import AnalysisRunner from '../analysis/AnalysisRunner';
import { onOpenRun, peekOpenRun } from '../analysis/jobStore';

const SUBTOOL_OF_RUN = { 'hydro-drainage': 'drainage', 'hydro-corridor': 'corridor' };

export default function HydrologyTool(props) {
  const { projectInfo } = props;
  const [activeSubTool, setActiveSubTool] = useState(() => SUBTOOL_OF_RUN[peekOpenRun()?.toolId] || null);
  useEffect(() => onOpenRun((req) => { if (SUBTOOL_OF_RUN[req.toolId]) setActiveSubTool(SUBTOOL_OF_RUN[req.toolId]); }), []);

  const hydrologyFeatures = [
    { id: 'watershed', label: 'Watershed Delineation', icon: Mountain, color: 'text-cyan-500', desc: 'Identify drainage basins and catchments.' },
    { id: 'flood', label: 'Flood Hazard Mapping', icon: Waves, color: 'text-blue-500', desc: 'SAR-based flood extent from Sentinel-1 imagery.' },
    { id: 'runoff', label: 'Rainfall-Runoff Modeling', icon: Activity, color: 'text-emerald-500', desc: 'HEC-HMS style: SCS Curve Number + Unit Hydrograph.' },
    { id: 'hydraulic', label: 'Hydraulic Flood Routing', icon: GitBranch, color: 'text-blue-600', desc: 'HEC-RAS style: HAND + Manning\'s rating curve routing.' },
    { id: 'drainage', label: 'Drainage Network Analysis', icon: Droplets, color: 'text-indigo-500', desc: 'Map river channels and flow paths.' },
    { id: 'corridor', label: 'River Corridor Risk', icon: AlertTriangle, color: 'text-orange-500', desc: 'Assess bank erosion and settlement risks.' },
  ];

  const handleToolSelect = (id) => {
    setActiveSubTool(id);
  };

  if (!activeSubTool) {
    return (
      <div className="p-5 space-y-6">
        <div className="border-b pb-4 flex justify-between items-end">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Hydrology Engine</h2>
            <p className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest mt-1">Terrain & Water Analysis</p>
          </div>
          {projectInfo && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase">
              <Save size={10}/> {projectInfo.name}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {hydrologyFeatures.map((feature) => (
            <button key={feature.id} onClick={() => handleToolSelect(feature.id)} className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-cyan-500 hover:shadow-md transition-all group text-left">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-cyan-50 transition-colors">
                  <feature.icon size={20} className={feature.color} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-700 group-hover:text-cyan-700">{feature.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{feature.desc}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-cyan-500" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      <div className="p-4 border-b flex items-center justify-between bg-cyan-50/30">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveSubTool(null)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-cyan-200 transition-all text-slate-500 hover:text-cyan-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight italic">{hydrologyFeatures.find(f => f.id === activeSubTool)?.label}</h3>
            <p className="text-[9px] text-cyan-600 font-bold uppercase tracking-widest">{projectInfo ? `Project: ${projectInfo.name}` : 'No project · results are not saved'}</p>
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        {activeSubTool === 'watershed' && <WatershedDelineation {...props} />}
        {activeSubTool === 'flood' && <FloodHazardMapping {...props} />}
        {activeSubTool === 'runoff' && <RainfallRunoffModeling {...props} />}
        {activeSubTool === 'hydraulic' && <FloodInundation {...props} />}
        {activeSubTool === 'drainage' && <AnalysisRunner key="drainage" toolId="hydro-drainage" {...props} />}
        {activeSubTool === 'corridor' && <AnalysisRunner key="corridor" toolId="hydro-corridor" {...props} />}
      </div>
    </div>
  );
}