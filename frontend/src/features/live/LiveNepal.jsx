import React, { useCallback, useEffect, useState } from 'react';
import { Waves, CloudRain, Siren, RefreshCw, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { getLiveFeed } from '../../api/hubApi';
import { useT } from '../../i18n';

const REFRESH_MS = 5 * 60 * 1000;
const FEEDS = [
  { id: 'rivers', label: 'River levels', icon: Waves, color: 'text-sky-600', note: 'DHM stations, newest reading (last 6 h)' },
  { id: 'rainfall', label: 'Rainfall', icon: CloudRain, color: 'text-blue-600', note: 'DHM rain gauges, 1–24 h totals' },
  { id: 'incidents', label: 'Disaster incidents', icon: Siren, color: 'text-red-600', note: 'Reported on BIPAD' },
];
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');

/**
 * Live Nepal: DHM river levels and rainfall and BIPAD incidents on the map,
 * refreshed every 5 minutes, with the stations in alert listed first.
 */
export default function LiveNepal({ setVectorLayers, mapRef }) {
  const [on, setOn] = useState({ rivers: true, rainfall: false, incidents: false });
  const [days, setDays] = useState(7);
  const [data, setData] = useState({});
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  const t = useT();

  const load = useCallback(async (kind) => {
    setBusy((b) => ({ ...b, [kind]: true }));
    try {
      const d = await getLiveFeed(kind, kind === 'incidents' ? { days } : {});
      if (d.status === 'error') throw new Error(d.message);
      setData((x) => ({ ...x, [kind]: d }));
      setErrors((e) => ({ ...e, [kind]: '' }));
    } catch (err) {
      setErrors((e) => ({ ...e, [kind]: err.message || 'Could not load.' }));
    } finally {
      setBusy((b) => ({ ...b, [kind]: false }));
    }
  }, [days]);

  // load what is switched on, and refresh it every few minutes
  useEffect(() => {
    FEEDS.forEach((f) => { if (on[f.id]) load(f.id); });
    const t = setInterval(() => FEEDS.forEach((f) => { if (on[f.id]) load(f.id); }), REFRESH_MS);
    return () => clearInterval(t);
  }, [on, load]);

  // draw the switched-on feeds
  useEffect(() => {
    const layers = FEEDS.filter((f) => on[f.id] && data[f.id]?.geojson).map((f) => ({
      id: `live-${f.id}`, type: 'circle', data: data[f.id].geojson, colorProp: 'color', radiusProp: 'radius', opacity: 0.9,
    }));
    setVectorLayers?.(layers);
  }, [on, data, setVectorLayers]);
  useEffect(() => () => setVectorLayers?.([]), [setVectorLayers]);

  const flyTo = (kind, name) => {
    const f = data[kind]?.geojson?.features?.find((x) => x.properties.name === name);
    if (f) mapRef?.current?.flyTo?.(f.geometry.coordinates[0], f.geometry.coordinates[1], 11);
  };

  const r = data.rivers;
  const rain = data.rainfall;
  const inc = data.incidents;

  return (
    <div className="p-5 space-y-4">
      <div className="border-b pb-4">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">{t('Live Nepal')}</h2>
        <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-red-600">Rivers · rain · incidents · every 5 min</p>
      </div>

      {FEEDS.map((f) => (
        <div key={f.id} className={`rounded-2xl border p-3 ${on[f.id] ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <f.icon size={18} className={f.color} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-700">{t(f.label)}</p>
              <p className="text-[10px] text-slate-400">
                {f.note}{data[f.id]?.updated ? ` · updated ${fmtTime(data[f.id].updated)}` : ''}
              </p>
            </div>
            {on[f.id] && (
              <button onClick={() => load(f.id)} title="Refresh" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                {busy[f.id] ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
            )}
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={on[f.id]} onChange={(e) => setOn((o) => ({ ...o, [f.id]: e.target.checked }))} />
              <span className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-[#0047AB] transition-colors" />
              <span className="absolute left-0.5 top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
            </label>
          </div>
          {on[f.id] && errors[f.id] && <p className="mt-2 text-[11px] text-red-600">{errors[f.id]}</p>}

          {on[f.id] && f.id === 'rivers' && r && (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-lg bg-slate-50 py-1.5"><p className="text-[15px] font-black text-slate-800">{r.summary.stations}</p><p className="text-[9px] uppercase text-slate-400">{t('stations')}</p></div>
                <div className="rounded-lg bg-amber-50 py-1.5"><p className="text-[15px] font-black text-amber-600">{r.summary.warning}</p><p className="text-[9px] uppercase text-amber-500">{t('warning')}</p></div>
                <div className="rounded-lg bg-red-50 py-1.5"><p className="text-[15px] font-black text-red-600">{r.summary.danger}</p><p className="text-[9px] uppercase text-red-500">{t('danger')}</p></div>
              </div>
              {r.alerts.length === 0
                ? <p className="text-[11px] text-emerald-600">{t('All rivers are below their warning level.')}</p>
                : r.alerts.map((a) => (
                  <button key={a.name} onClick={() => flyTo('rivers', a.name)} className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-slate-50">
                    <AlertTriangle size={13} style={{ color: a.color }} className="shrink-0" />
                    <span className="flex-1 min-w-0 text-[11px] text-slate-700 truncate">{a.name}</span>
                    <span className="text-[11px] font-bold" style={{ color: a.color }}>{a.water_level_m} m</span>
                  </button>
                ))}
              <p className="text-[10px] text-slate-400"><span className="text-emerald-600">●</span> below warning · <span className="text-amber-500">●</span> above warning · <span className="text-red-600">●</span> above danger</p>
            </div>
          )}

          {on[f.id] && f.id === 'rainfall' && rain && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-slate-600">
                {rain.summary.raining} of {rain.summary.stations} gauges had rain in the last 24 h · highest {rain.summary.max_24h_mm} mm
              </p>
              {rain.alerts.slice(0, 8).map((a) => (
                <button key={a.name} onClick={() => flyTo('rainfall', a.name)} className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1 hover:bg-slate-50">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: a.color }} />
                  <span className="flex-1 min-w-0 text-[11px] text-slate-700 truncate">{a.name}</span>
                  <span className="text-[11px] font-bold text-slate-700">{a.rain_24h_mm} mm</span>
                </button>
              ))}
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {rain.legend.map(([label, color]) => (
                  <span key={label} className="flex items-center gap-1 text-[9px] text-slate-500"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>
                ))}
              </div>
            </div>
          )}

          {on[f.id] && f.id === 'incidents' && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-1">
                {[1, 7, 30, 90].map((d) => (
                  <button key={d} onClick={() => setDays(d)}
                    className={`flex-1 text-[10px] font-bold py-1 rounded-md ${days === d ? 'bg-[#0047AB] text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {d === 1 ? '24 h' : `${d} days`}
                  </button>
                ))}
              </div>
              {inc && (
                <>
                  <div className="grid grid-cols-4 gap-1 text-center">
                    {[['incidents', 'text-slate-800'], ['deaths', 'text-red-600'], ['injured', 'text-amber-600'], ['missing', 'text-slate-600']].map(([k, c]) => (
                      <div key={k} className="rounded-lg bg-slate-50 py-1.5"><p className={`text-[14px] font-black ${c}`}>{inc.summary[k]}</p><p className="text-[9px] uppercase text-slate-400">{t(k)}</p></div>
                    ))}
                  </div>
                  <div className="space-y-0.5">
                    {inc.by_hazard.slice(0, 8).map((h) => (
                      <div key={h.hazard} className="flex items-center gap-2 text-[11px]">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: h.color }} />
                        <span className="flex-1 text-slate-700">{h.hazard}</span>
                        <span className="font-bold text-slate-700">{h.count}</span>
                        {h.deaths > 0 && <span className="text-red-600 text-[10px]">{h.deaths} died</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      <p className="text-[10px] text-slate-400 leading-relaxed">
        Data: BIPAD Portal (National Disaster Risk Reduction and Management Authority) and the Department of Hydrology and Meteorology.
        Readings are as reported and may be delayed or unverified. Click a point on the map for details.
        {' '}<a href="https://bipadportal.gov.np" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">bipadportal.gov.np <ExternalLink size={9} /></a>
      </p>
    </div>
  );
}
