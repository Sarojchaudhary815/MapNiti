import React from 'react';

export default function MapLegend({ legend }) {
  if (!legend) return null;
  if (legend.type === 'classes') {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {legend.items.map((c) => (
          <div key={c.value} className="flex items-center gap-1.5 text-[10px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm border border-slate-200 shrink-0" style={{ background: c.color }} />
            {c.label}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div>
      <div className="h-2.5 rounded-full" style={{ background: `linear-gradient(to right, ${legend.palette.join(',')})` }} />
      <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
        <span>{legend.min}</span>
        <span>{legend.units}</span>
        <span>{legend.max}</span>
      </div>
    </div>
  );
}

// Tiny CSV export helper shared by the hub + toolkit panels.
export function downloadCsv(filename, rows) {
  if (!rows?.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
