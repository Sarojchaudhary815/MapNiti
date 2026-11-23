import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { SYSTEM_PROPS } from './constants';

export default function AttributeTable({ group, features, onUpdateProperty, onAddField, onDeleteField, onDeleteFeature, onClose }) {
  const [newField, setNewField] = useState('');

  const columns = useMemo(() => {
    const keys = new Set();
    features.forEach((f) => Object.keys(f.properties || {}).forEach((k) => { if (!SYSTEM_PROPS.includes(k)) keys.add(k); }));
    return Array.from(keys);
  }, [features]);

  const addField = () => {
    const key = newField.trim();
    if (!key || columns.includes(key)) return;
    onAddField(key);
    setNewField('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">Attribute Table</p>
            <p className="text-[10px] font-bold text-slate-400">{group.name} &middot; {features.length} feature{features.length === 1 ? '' : 's'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="p-3 flex items-center gap-2 border-b border-slate-100">
          <input
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addField(); }}
            placeholder="New field name"
            className="text-[11px] font-bold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 flex-1"
          />
          <button
            onClick={addField}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase tracking-wide"
          >
            <Plus size={12} /> Field
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {features.length === 0 ? (
            <p className="p-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No features in this layer yet.</p>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="text-left p-2 font-black text-slate-500 uppercase text-[9px]">#</th>
                  {columns.map((col) => (
                    <th key={col} className="text-left p-2 font-black text-slate-500 uppercase text-[9px]">
                      <div className="flex items-center gap-1">
                        {col}
                        <button onClick={() => onDeleteField(col)} className="text-slate-300 hover:text-rose-500">
                          <X size={10} />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {features.map((f, i) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="p-2 text-slate-400 font-bold">{i + 1}</td>
                    {columns.map((col) => (
                      <td key={col} className="p-1">
                        <input
                          value={f.properties?.[col] ?? ''}
                          onChange={(e) => onUpdateProperty(f.id, col, e.target.value)}
                          className="w-full text-[11px] text-slate-700 border border-transparent hover:border-slate-200 focus:border-slate-400 rounded-md px-1.5 py-1 bg-transparent focus:bg-white"
                        />
                      </td>
                    ))}
                    <td className="p-1 text-right">
                      <button
                        onClick={() => onDeleteFeature(f.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md"
                        title="Delete feature"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
