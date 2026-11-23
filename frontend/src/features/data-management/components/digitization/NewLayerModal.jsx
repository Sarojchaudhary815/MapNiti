import React, { useState } from 'react';
import { X, MapPin, Spline, Hexagon } from 'lucide-react';

const GEOM_OPTIONS = [
  { value: 'Point', label: 'Point', icon: MapPin },
  { value: 'LineString', label: 'Line', icon: Spline },
  { value: 'Polygon', label: 'Polygon', icon: Hexagon },
];

export default function NewLayerModal({ defaultGeomType = 'LineString', onCreate, onClose }) {
  const [name, setName] = useState('');
  const [geomType, setGeomType] = useState(defaultGeomType);

  const canCreate = name.trim().length > 0;

  const submit = () => {
    if (!canCreate) return;
    onCreate({ name: name.trim(), geomType });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">New Layer</p>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Layer name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="e.g. Road"
            className="w-full text-[12px] font-bold text-slate-700 border border-slate-200 rounded-lg px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Geometry type</span>
          <div className="flex gap-1.5">
            {GEOM_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setGeomType(value)}
                className={`flex-1 flex flex-col items-center gap-1 px-2 py-2 rounded-xl border transition-all ${
                  geomType === value ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                <Icon size={15} />
                <span className="text-[8px] font-black uppercase tracking-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!canCreate}
          className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
        >
          Create Layer
        </button>
      </div>
    </div>
  );
}
