import React, { useEffect, useRef, useState } from 'react';
import {
  MoreVertical, Eye, EyeOff, Pencil, Palette, Table2,
  Download, ScanSearch, Copy, Trash2, Check, X,
} from 'lucide-react';

// Per-layer-group row: visibility checkbox + color swatch + name + kebab
// menu (Rename / Symbolize / Attribute Table / Export ▸ / Zoom to Layer /
// Duplicate / Delete). Modeled on the LayerRow pattern in
// frontend/src/features/hydrology/components/FloodHazardMapping.jsx.
export default function LayerGroupRow({
  group, isActive, onSetActive, onToggleVisible, onRename,
  onOpenSymbology, onOpenAttributes, onExport, onZoomTo, onDuplicate, onDelete,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => { setNameDraft(group.name); }, [group.name]);

  const commitRename = () => {
    const trimmed = nameDraft.trim();
    if (trimmed) onRename(trimmed);
    else setNameDraft(group.name);
    setRenaming(false);
  };

  const menuItems = [
    { label: 'Rename', icon: <Pencil size={12} />, onClick: () => setRenaming(true) },
    { label: 'Symbolize', icon: <Palette size={12} />, onClick: onOpenSymbology },
    { label: 'Attribute Table', icon: <Table2 size={12} />, onClick: onOpenAttributes },
    { label: 'Zoom to Layer', icon: <ScanSearch size={12} />, onClick: onZoomTo },
    { label: 'Export GeoJSON', icon: <Download size={12} />, onClick: () => onExport('geojson') },
    { label: 'Export Shapefile', icon: <Download size={12} />, onClick: () => onExport('shapefile') },
    { label: 'Export KML', icon: <Download size={12} />, onClick: () => onExport('kml') },
    { label: 'Duplicate', icon: <Copy size={12} />, onClick: onDuplicate },
    { label: 'Delete Layer', icon: <Trash2 size={12} />, onClick: onDelete, danger: true },
  ];

  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-xl border relative transition-colors ${
        isActive ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100'
      }`}
    >
      <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1" onClick={(e) => { if (!renaming) onSetActive(); }}>
        <input
          type="checkbox"
          checked={group.visible}
          onChange={(e) => { e.stopPropagation(); onToggleVisible(); }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 accent-slate-800 rounded cursor-pointer shrink-0"
        />
        <span className="w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ backgroundColor: group.color }} />
        {group.visible ? <Eye size={12} className="text-slate-400 shrink-0" /> : <EyeOff size={12} className="text-slate-300 shrink-0" />}

        {renaming ? (
          <span className="flex items-center gap-1 min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setNameDraft(group.name); setRenaming(false); } }}
              className="min-w-0 flex-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-md px-1.5 py-0.5"
            />
            <button onClick={commitRename} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md shrink-0"><Check size={12} /></button>
            <button onClick={() => { setNameDraft(group.name); setRenaming(false); }} className="p-1 text-slate-400 hover:bg-slate-100 rounded-md shrink-0"><X size={12} /></button>
          </span>
        ) : (
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-700 truncate">{group.name}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase">{group.geomType} &middot; {group.featureIds.length} feature{group.featureIds.length === 1 ? '' : 's'}</p>
          </div>
        )}
      </label>

      {!renaming && (
        <div className="relative shrink-0" ref={containerRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-80 overflow-y-auto">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => { item.onClick(); setMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[10px] font-bold flex items-center gap-2 hover:bg-slate-50 ${item.danger ? 'text-rose-600' : 'text-slate-700'}`}
                >
                  {item.icon}{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
