import React, { useState } from 'react';
import { 
  Play, Info, Loader2, CheckCircle, List, 
  Calendar, Database, Upload, Download, FileJson 
} from 'lucide-react';

const LandUseAnalysis = ({ selectedAOI }) => {
  const [status, setStatus] = useState('idle'); // States: idle, processing, completed
  const [params, setParams] = useState({
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    provider: 'Sentinel-2',
    cloudCover: 10
  });

  const handleRunAnalysis = () => {
    if (!selectedAOI) {
      alert("Please draw a boundary on the map or upload a file first!");
      return;
    }
    setStatus('processing');
    
    // Simulating Geospatial Processing
    setTimeout(() => {
      setStatus('completed');
    }, 5000);
  };

  return (
    <div className="p-5 space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 1. Area of Interest (AOI) Upload */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">
          <Upload size={14} className="text-blue-600" />
          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Boundary Upload</h4>
        </div>
        
        <div className="group relative border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-blue-400 transition-all bg-slate-50/50 cursor-pointer">
          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".geojson,.kml" />
          <div className="flex flex-col items-center gap-2">
            <div className="p-2 bg-white rounded-full shadow-sm text-blue-500 group-hover:scale-110 transition-transform">
              <FileJson size={20} />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Upload GeoJSON / KML</p>
            <p className="text-[8px] text-slate-400 tracking-tighter italic text-center">Drag and drop or click to browse</p>
          </div>
        </div>

        {selectedAOI && (
          <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
            <CheckCircle size={12} className="text-emerald-500" />
            <span className="text-[9px] font-bold text-emerald-700 uppercase">AOI Detected: Active</span>
          </div>
        )}
      </div>

      {/* 2. Parameters Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b pb-2">
          <Database size={14} className="text-blue-600" />
          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Analysis Settings</h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase">Start Date</label>
            <input 
              type="date" 
              className="w-full text-[11px] font-bold p-2.5 bg-white border border-slate-200 rounded-xl outline-none" 
              value={params.startDate}
              onChange={(e) => setParams({...params, startDate: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-400 uppercase">End Date</label>
            <input 
              type="date" 
              className="w-full text-[11px] font-bold p-2.5 bg-white border border-slate-200 rounded-xl outline-none" 
              value={params.endDate}
              onChange={(e) => setParams({...params, endDate: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-black text-slate-400 uppercase">Imagery Source</label>
          <select 
            className="w-full text-[11px] font-bold p-2.5 bg-white border border-slate-200 rounded-xl"
            value={params.provider}
            onChange={(e) => setParams({...params, provider: e.target.value})}
          >
            <option>Sentinel-2 (10m Resolution)</option>
            <option>Landsat 9 (30m Resolution)</option>
          </select>
        </div>
      </div>

      {/* 3. Execution Action */}
      <button 
        onClick={handleRunAnalysis}
        disabled={status === 'processing'}
        className={`w-full py-4 rounded-2xl text-xs font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl 
          ${status === 'completed' ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'}`}
      >
        {status === 'idle' && <><Play size={16} fill="currentColor" /> RUN CLASSIFICATION</>}
        {status === 'processing' && <><Loader2 size={16} className="animate-spin" /> PROCESSING IMAGERY...</>}
        {status === 'completed' && <><CheckCircle size={16} /> ANALYSIS COMPLETE</>}
      </button>

      {/* 4. Results Section: Legend & Downloads (Hidden until completed) */}
      {status === 'completed' && (
        <div className="animate-in slide-in-from-bottom-4 duration-700 space-y-4 pt-4">
          
          {/* Classification Legend */}
          <div className="p-5 rounded-2xl bg-white border-2 border-emerald-100 shadow-2xl">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Map Legend</p>
              <span className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase">Layer Active</span>
            </div>
            <div className="grid grid-cols-2 gap-y-4">
              {[
                { label: 'Forest', color: '#1A5924' },
                { label: 'Cropland', color: '#33A02C' },
                { label: 'Urban Area', color: '#E31A1C' },
                { label: 'Water Body', color: '#1F78B4' },
                { label: 'Barren Soil', color: '#FDBF6F' },
                { label: 'Grassland', color: '#B2DF8A' }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-md shadow-sm border border-black/5" style={{ backgroundColor: item.color }}></div>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Export Options */}
          <div className="grid grid-cols-2 gap-2">
            <button className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-[9px] font-black transition-all">
              <Download size={14} /> DOWNLOAD TIFF
            </button>
            <button className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl text-[9px] font-black transition-all">
              <Download size={14} /> EXPORT PNG
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default LandUseAnalysis;