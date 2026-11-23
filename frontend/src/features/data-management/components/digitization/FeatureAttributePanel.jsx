import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { SYSTEM_PROPS } from './constants';

// Inline (not modal) form shown in the sidebar itself when exactly one
// digitized feature is selected on the map — mirrors the reference
// road-editor layout: title + close, one label/input pair per attribute the
// feature's own data already carries (whatever the source file had —
// nothing hardcoded), Cancel/Save at the bottom. Edits are kept locally
// until Save so Cancel can discard them without having touched the map.
function guessTitle(feature) {
  const props = feature?.properties || {};
  const nameKey = Object.keys(props).find((k) => !SYSTEM_PROPS.includes(k) && /name/i.test(k) && props[k]);
  return (nameKey && String(props[nameKey])) || 'Feature Attributes';
}

function fieldLabel(key) {
  return key
    .replace(/_+$/, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function FeatureAttributePanel({ feature, onSave, onClose }) {
  const fields = useMemo(
    () => Object.keys(feature?.properties || {}).filter((k) => !SYSTEM_PROPS.includes(k)),
    [feature]
  );
  const [draft, setDraft] = useState(() => ({ ...(feature?.properties || {}) }));

  if (!feature) return null;

  const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const handleSave = () => {
    const changed = {};
    fields.forEach((key) => { if (draft[key] !== feature.properties?.[key]) changed[key] = draft[key]; });
    onSave(feature.id, changed);
    onClose();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <p className="text-sm font-black text-slate-800 truncate">{guessTitle(feature)}</p>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg shrink-0">
          <X size={16} />
        </button>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {fields.length === 0 ? (
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center py-8">
            This feature has no attributes yet.
          </p>
        ) : (
          fields.map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-600">{fieldLabel(key)}</span>
              <input
                value={draft[key] ?? ''}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={fieldLabel(key)}
                className="text-[13px] text-slate-700 border border-slate-200 rounded-lg px-3 py-2 focus:border-slate-400 focus:outline-none"
              />
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-slate-100 flex items-center gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wide hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-[11px] font-black uppercase tracking-wide hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </div>
  );
}
