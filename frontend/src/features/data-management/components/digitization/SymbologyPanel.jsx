import React from 'react';
import { X } from 'lucide-react';
import { POINT_SHAPES } from './drawStyles';

const FIELD = 'flex flex-col gap-1';
const LABEL = 'text-[9px] font-black uppercase tracking-widest text-slate-400';

export default function SymbologyPanel({ group, availableFields, onChange, onClose }) {
  const isLine = group.geomType === 'LineString' || group.geomType === 'Polygon';
  const isPoint = group.geomType === 'Point';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Symbolize</p>
            <p className="text-[10px] font-bold text-slate-400">{group.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={FIELD}>
            <span className={LABEL}>Color</span>
            <input
              type="color"
              value={group.color}
              onChange={(e) => onChange({ color: e.target.value })}
              className="h-8 w-full rounded-lg border border-slate-200 cursor-pointer"
            />
          </div>

          <div className={FIELD}>
            <span className={LABEL}>Opacity ({Math.round(group.opacity * 100)}%)</span>
            <input
              type="range" min="0.05" max="1" step="0.05"
              value={group.opacity}
              onChange={(e) => onChange({ opacity: Number(e.target.value) })}
              className="w-full accent-slate-800"
            />
          </div>

          {isLine && (
            <div className={FIELD}>
              <span className={LABEL}>Line width ({group.lineWidth}px)</span>
              <input
                type="range" min="1" max="12" step="1"
                value={group.lineWidth}
                onChange={(e) => onChange({ lineWidth: Number(e.target.value) })}
                className="w-full accent-slate-800"
              />
            </div>
          )}

          {isPoint && (
            <div className={FIELD}>
              <span className={LABEL}>Point size ({group.pointRadius}px)</span>
              <input
                type="range" min="2" max="16" step="1"
                value={group.pointRadius}
                onChange={(e) => onChange({ pointRadius: Number(e.target.value) })}
                className="w-full accent-slate-800"
              />
            </div>
          )}

          {isLine && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={group.dashed}
                onChange={(e) => onChange({ dashed: e.target.checked })}
                className="w-4 h-4 accent-slate-800 rounded cursor-pointer"
              />
              <span className="text-[10px] font-bold text-slate-600">Dashed line</span>
            </label>
          )}

          {isPoint && (
            <div className={FIELD}>
              <span className={LABEL}>Shape</span>
              <select
                value={group.pointShape}
                onChange={(e) => onChange({ pointShape: e.target.value })}
                className="text-[11px] font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5"
              >
                {POINT_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div className={`${FIELD} col-span-2`}>
            <span className={LABEL}>Label from field</span>
            <select
              value={group.labelField || ''}
              onChange={(e) => onChange({ labelField: e.target.value || null })}
              className="text-[11px] font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5"
            >
              <option value="">None</option>
              {availableFields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
