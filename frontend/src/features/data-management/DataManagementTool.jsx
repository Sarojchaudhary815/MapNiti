import React, { useState } from 'react';
import { Layers, MousePointer2, Ruler, BoxSelect, ChevronRight, ArrowLeft } from 'lucide-react';
import DigitizationTool from './components/DigitizationTool';
import RasterDataAnalysis from './components/RasterDataAnalysis';
import VectorDataAnalysis from './components/VectorDataAnalysis';
import MeasurementToolbox from './components/MeasurementToolbox';

const subTools = [
  { id: 'raster', label: 'Raster Data Analysis', icon: BoxSelect, color: 'text-pink-500', desc: 'Inspect and analyze raster layers.' },
  { id: 'vector', label: 'Vector Data Analysis', icon: Layers, color: 'text-indigo-500', desc: 'Load GeoJSON/CSV, buffer, dissolve, clip, measure, export SHP/KML.' },
  { id: 'digitize', label: 'Digitization Tool', icon: MousePointer2, color: 'text-slate-700', desc: 'Draw and edit vector features on the map.' },
  { id: 'measure', label: 'Measurement Toolbox', icon: Ruler, color: 'text-blue-500', desc: 'Measure distance, area (ropani/bigha) and coordinates on the map.' },
];

export default function DataManagementTool(props) {
  const [activeSubTool, setActiveSubTool] = useState(null);

  if (!activeSubTool) {
    return (
      <div className="p-5 space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Data Management</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Raster &amp; Vector Utilities</p>
        </div>

        <div className="space-y-3">
          {subTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveSubTool(tool.id)}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-slate-400 hover:shadow-md transition-all group text-left"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-slate-100 transition-colors">
                  <tool.icon size={20} className={tool.color} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-700 group-hover:text-slate-900">{tool.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{tool.desc}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const current = subTools.find((t) => t.id === activeSubTool);

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      <div className="p-4 border-b flex items-center gap-3 bg-slate-50">
        <button
          onClick={() => setActiveSubTool(null)}
          className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight italic">{current?.label}</h3>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Data Management</p>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        {activeSubTool === 'digitize' && <DigitizationTool mapRef={props.mapRef} projectId={props.projectInfo?.id} />}
        {activeSubTool === 'raster' && <RasterDataAnalysis {...props} />}
        {activeSubTool === 'vector' && <VectorDataAnalysis {...props} />}
        {activeSubTool === 'measure' && <MeasurementToolbox {...props} />}
      </div>
    </div>
  );
}
