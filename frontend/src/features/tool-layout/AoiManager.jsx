import React from 'react';
import { Trash2, MapPin, Layers, Info } from 'lucide-react';

export default function AoiManager({ selectedAOI, setSelectedAOI }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-slate-700 mb-2 border-b pb-2">
        <Layers size={18} className="text-blue-600" />
        <h4 className="font-black text-xs uppercase tracking-widest">Dashboard Overview</h4>
      </div>

      {!selectedAOI ? (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
              No active area selected
            </p>
            <p className="text-[9px] text-slate-400 mt-1">Select a tool to start drawing or upload data</p>
          </div>
          
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex gap-3">
             <Info size={16} className="text-blue-500 shrink-0" />
             <p className="text-[10px] text-blue-700 leading-tight">
                Welcome to <b>MapNiti v2.0</b>. Please use the sidebar to select a planning module or draw your study area on the map.
             </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-in fade-in zoom-in slide-in-from-top-2">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <MapPin size={14} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-700">Selected Study Area</p>
                <p className="text-[9px] text-slate-400 font-mono italic">Status: Ready for Analysis</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedAOI(null)}
              className="p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
          
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
             <p className="text-[9px] text-slate-500 font-medium truncate uppercase tracking-widest">
                ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
             </p>
          </div>
        </div>
      )}
    </div>
  );
}