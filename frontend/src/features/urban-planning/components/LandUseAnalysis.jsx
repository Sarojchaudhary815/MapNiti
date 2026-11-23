import React, { useState, useEffect } from 'react';
import { 
  Play, Info, Loader2, CheckCircle, 
  Database, Upload, Download, FileJson, ArrowLeft 
} from 'lucide-react';

const LandUseAnalysis = ({ selectedAOI, setSelectedAOI, onRasterGenerated }) => {
  const [status, setStatus] = useState('idle');
  const [fileName, setFileName] = useState("");
  const [showSuccess, setShowSuccess] = useState(false); // Success message को लागि नयाँ स्टेट
  const [params, setParams] = useState({
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    provider: 'Sentinel-2',
    cloudCover: 10
  });

  // १. बाउन्ड्री फाइल अपलोड ह्यान्डलर
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const geojson = JSON.parse(event.target.result);
          setSelectedAOI(geojson); // यसले म्यापमा बाउन्ड्री देखाउँछ र जुम गर्छ
          
          // फाइल लोड भएपछि मेसेज देखाउने
          setShowSuccess(true);
        } catch (err) {
          alert("Invalid GeoJSON file!");
        }
      };
      reader.readAsText(file);
    }
  };

  // मेसेज ३ सेकेण्ड पछि लुकाउने Logic
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000); // ३ सेकेण्ड
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  // २. एनालिसिस रन गर्ने
  const handleRunAnalysis = () => {
    if (!selectedAOI) {
      alert("Please upload a GeoJSON file or draw on the map first!");
      return;
    }
    setStatus('processing');
    
    setTimeout(() => {
      setStatus('completed');
      onRasterGenerated({
        type: 'lulc_result',
        url: 'https://your-api.com/output_raster.tif', 
        bbox: selectedAOI.bbox || null 
      });
    }, 3000);
  };

  return (
    <div className="p-5 space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 1. Boundary Upload Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b pb-2">
          <Upload size={14} className="text-blue-600" />
          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Boundary Upload</h4>
        </div>
        
        <div className="group relative border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-blue-400 transition-all bg-slate-50/50 cursor-pointer">
          <input 
            type="file" 
            className="absolute inset-0 opacity-0 cursor-pointer" 
            accept=".geojson" 
            onChange={handleFileUpload}
          />
          <div className="flex flex-col items-center gap-2">
            <div className="p-2 bg-white rounded-full shadow-sm text-blue-500 group-hover:scale-110 transition-transform">
              <FileJson size={20} />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">
              {fileName ? fileName : "Upload GeoJSON"}
            </p>
            <p className="text-[8px] text-slate-400 italic text-center">Click to browse boundary file</p>
          </div>
        </div>

        {/* ३ सेकेण्ड पछि हराउने मेसेज */}
        {showSuccess && (
          <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100 animate-in fade-in zoom-in duration-300">
            <CheckCircle size={12} className="text-emerald-500" />
            <span className="text-[9px] font-bold text-emerald-700 uppercase">AOI Loaded & Ready</span>
          </div>
        )}
      </div>

      {/* 2. Parameters */}
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
      </div>

      {/* 3. Run Action */}
      <button 
        onClick={handleRunAnalysis}
        disabled={status === 'processing'}
        className={`w-full py-4 rounded-2xl text-xs font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl 
          ${status === 'completed' ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'}`}
      >
        {status === 'idle' && <><Play size={16} fill="currentColor" /> RUN CLASSIFICATION</>}
        {status === 'processing' && <><Loader2 size={16} className="animate-spin" /> ANALYZING IMAGERY...</>}
        {status === 'completed' && <><CheckCircle size={16} /> ANALYSIS COMPLETE</>}
      </button>

      {/* 4. Results Legend */}
      {status === 'completed' && (
        <div className="animate-in slide-in-from-bottom-4 duration-700 space-y-4">
          <div className="p-5 rounded-2xl bg-white border-2 border-emerald-100 shadow-2xl">
             <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest border-b pb-2 mb-3">Map Legend</p>
             <div className="grid grid-cols-2 gap-y-3">
                <LegendItem label="Forest" color="#1A5924" />
                <LegendItem label="Urban" color="#E31A1C" />
                <LegendItem label="Water" color="#1F78B4" />
                <LegendItem label="Agriculture" color="#33A02C" />
             </div>
          </div>
          <button className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
            <Download size={14} /> Download Results (.TIF)
          </button>
        </div>
      )}
    </div>
  );
};

const LegendItem = ({ label, color }) => (
  <div className="flex items-center gap-2">
    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }}></div>
    <span className="text-[10px] font-bold text-slate-600 uppercase">{label}</span>
  </div>
);

export default LandUseAnalysis;