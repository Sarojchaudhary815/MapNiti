import React, { useState } from 'react';
import { Leaf, Droplets, Building2, Map, Sigma, ChevronRight, ArrowLeft, Save } from 'lucide-react';
import SpectralIndexAnalysis from './SpectralIndexAnalysis';
import LulcClassification from './LulcClassification';
import RasterCalculator from './RasterCalculator';

const rasterFeatures = [
  { id: 'lulc', label: 'LULC Calculation', icon: Map, color: 'text-emerald-600', desc: 'Land Use / Land Cover — supervised, unsupervised, or pre-classified.' },
  { id: 'ndvi', label: 'NDVI', icon: Leaf, color: 'text-green-500', desc: 'Normalized Difference Vegetation Index.' },
  { id: 'ndwi', label: 'NDWI', icon: Droplets, color: 'text-blue-500', desc: 'Normalized Difference Water Index.' },
  { id: 'ndbi', label: 'NDBI', icon: Building2, color: 'text-orange-500', desc: 'Normalized Difference Built-up Index.' },
  { id: 'calculator', label: 'Raster Calculator', icon: Sigma, color: 'text-slate-700', desc: 'Custom band-math on optical imagery.' },
];

export default function RasterDataAnalysis(props) {
  const { projectInfo } = props;
  const [activeSubTool, setActiveSubTool] = useState(null);

  if (!activeSubTool) {
    return (
      <div className="p-5 space-y-6">
        <div className="border-b pb-4 flex justify-between items-end">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Raster Data Analysis</h2>
            <p className="text-[10px] text-pink-600 font-bold uppercase tracking-widest mt-1">Imagery &amp; Land Cover Tools</p>
          </div>
          {projectInfo && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase">
              <Save size={10} /> {projectInfo.name}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {rasterFeatures.map((feature) => (
            <button key={feature.id} onClick={() => setActiveSubTool(feature.id)} className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-pink-500 hover:shadow-md transition-all group text-left">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-pink-50 transition-colors">
                  <feature.icon size={20} className={feature.color} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-700 group-hover:text-pink-700">{feature.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{feature.desc}</p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-pink-500" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const current = rasterFeatures.find((f) => f.id === activeSubTool);

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      <div className="p-4 border-b flex items-center justify-between bg-pink-50/30">
        <div className="flex items-center gap-3">
          <button onClick={() => setActiveSubTool(null)} className="p-2 hover:bg-white rounded-xl border border-transparent hover:border-pink-200 transition-all text-slate-500 hover:text-pink-600">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight italic">{current?.label}</h3>
            <p className="text-[9px] text-pink-600 font-bold uppercase tracking-widest">Project: {projectInfo?.name}</p>
          </div>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        {activeSubTool === 'lulc' && <LulcClassification {...props} />}
        {activeSubTool === 'ndvi' && <SpectralIndexAnalysis {...props} indexType="NDVI" label="NDVI" description="Normalized Difference Vegetation Index" />}
        {activeSubTool === 'ndwi' && <SpectralIndexAnalysis {...props} indexType="NDWI" label="NDWI" description="Normalized Difference Water Index" />}
        {activeSubTool === 'ndbi' && <SpectralIndexAnalysis {...props} indexType="NDBI" label="NDBI" description="Normalized Difference Built-up Index" />}
        {activeSubTool === 'calculator' && <RasterCalculator {...props} />}
      </div>
    </div>
  );
}
