import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Crosshair, MapPin, Camera, CloudUpload, Loader2, Wifi, WifiOff, Download, ArrowLeft, X, CheckCircle2,
} from 'lucide-react';
import {
  listSurveys, createSurvey, deleteSurvey, getSurveyRecords, syncFieldRecords, deleteFieldRecord, exportSurvey,
} from '../../api/hubApi';
import { queueRecord, removeQueued, pendingFor, newClientId, compressPhoto } from './fieldQueue';
import { useT } from '../../i18n';

const SURVEYS_CACHE = 'mn_field_surveys';   // so the forms still open with no signal
const BATCH = 10;
const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-blue-400';
const label = 'text-[10px] font-bold uppercase tracking-widest text-slate-400';

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(SURVEYS_CACHE)) || []; } catch { return []; }
};

function NewSurvey({ onCreated, onCancel }) {
  const t = useT();
  const [name, setName] = useState('');
  const [custom, setCustom] = useState(false);
  const [fields, setFields] = useState([{ label: '', type: 'text', options: '' }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const defs = custom
        ? fields.filter((f) => f.label.trim()).map((f) => ({
          key: f.label, label: f.label.trim(), type: f.type,
          options: f.type === 'select' ? f.options.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
        }))
        : undefined;
      onCreated(await createSurvey({ name: name.trim(), fields: defs }));
    } catch (e) {
      setErr(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || 'Could not create the survey.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3 space-y-3">
      <input className={input} placeholder={t('Survey name, e.g. Ward 5 drain condition')} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2 text-[11px] font-bold">
        <button type="button" onClick={() => setCustom(false)} className={`flex-1 rounded-lg py-1.5 ${!custom ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border'}`}>{t('Standard form')}</button>
        <button type="button" onClick={() => setCustom(true)} className={`flex-1 rounded-lg py-1.5 ${custom ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 border'}`}>{t('My own fields')}</button>
      </div>
      {!custom ? (
        <p className="text-[11px] text-slate-500">{t('Category (building, road, bridge, drain, landslide…), condition and notes, plus GPS and a photo.')}</p>
      ) : (
        <div className="space-y-2">
          {fields.map((f, i) => (
            <div key={i} className="rounded-xl bg-white border p-2 space-y-1.5">
              <div className="flex gap-1.5">
                <input className={input} placeholder={t('Field name')} value={f.label}
                  onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <select className="rounded-xl border border-slate-200 px-2 text-[12px]" value={f.type}
                  onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>
                  <option value="text">{t('Text')}</option>
                  <option value="number">{t('Number')}</option>
                  <option value="select">{t('Choice')}</option>
                </select>
                <button type="button" onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500"><X size={14} /></button>
              </div>
              {f.type === 'select' && (
                <input className={input} placeholder={t('Choices, separated by commas')} value={f.options}
                  onChange={(e) => setFields((fs) => fs.map((x, j) => (j === i ? { ...x, options: e.target.value } : x)))} />
              )}
            </div>
          ))}
          <button type="button" onClick={() => setFields((fs) => [...fs, { label: '', type: 'text', options: '' }])}
            className="text-[11px] font-bold text-blue-600 flex items-center gap-1"><Plus size={12} /> {t('Add field')}</button>
        </div>
      )}
      {err && <p className="text-[11px] text-red-600">{String(err)}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border bg-white py-2 text-[12px] font-bold text-slate-500">{t('Cancel')}</button>
        <button type="button" disabled={busy || name.trim().length < 2} onClick={save}
          className="flex-1 rounded-xl bg-blue-600 py-2 text-[12px] font-bold text-white disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin mx-auto" /> : t('Create survey')}
        </button>
      </div>
    </div>
  );
}

/**
 * Field Collect: survey forms filled on a phone at the site. Each record is a
 * GPS point (or a point picked on the map) with answers and a photo. Records
 * are queued on the device first, so it works with no signal, and are synced
 * to the server when back online. Exports to GeoJSON / CSV.
 */
export default function FieldCollect({ setVectorLayers, mapRef, activeStep, setActiveStep, sampleClicks, setSampleClicks }) {
  const t = useT();
  const [surveys, setSurveys] = useState(readCache);
  const [creating, setCreating] = useState(false);
  const [survey, setSurvey] = useState(null);
  const [synced, setSynced] = useState([]);       // features from the server
  const [pending, setPending] = useState([]);     // records still on this device
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');

  const [pos, setPos] = useState(null);           // {lat, lng, accuracy, altitude, source}
  const [watching, setWatching] = useState(false);
  const [gpsErr, setGpsErr] = useState('');
  const [answers, setAnswers] = useState({});
  const [photo, setPhoto] = useState(null);
  const watchId = useRef(null);
  const fileRef = useRef(null);
  const syncingRef = useRef(false);

  // --- surveys ---
  const loadSurveys = useCallback(async () => {
    try {
      const s = await listSurveys();
      setSurveys(s);
      localStorage.setItem(SURVEYS_CACHE, JSON.stringify(s));
    } catch {
      // offline: keep the cached list
    }
  }, []);
  useEffect(() => { loadSurveys(); }, [loadSurveys]);

  const refreshRecords = useCallback(async (s = survey) => {
    if (!s) return;
    setPending(await pendingFor(s.id));
    try {
      const d = await getSurveyRecords(s.id);
      setSynced(d.geojson.features);
    } catch {
      // offline: show what is on the device
    }
  }, [survey]);

  const sync = useCallback(async () => {
    if (!survey || syncingRef.current || !navigator.onLine) return;
    const queued = await pendingFor(survey.id);
    if (!queued.length) return;
    syncingRef.current = true;
    setSyncing(true);
    setMsg('');
    let sent = 0;
    let badPhotos = 0;
    try {
      for (let i = 0; i < queued.length; i += BATCH) {
        const batch = queued.slice(i, i + BATCH);
        const res = await syncFieldRecords(survey.id, batch.map(({ survey_id: _s, ...r }) => r));
        await removeQueued([...res.saved, ...res.skipped]);
        sent += res.saved.length;
        badPhotos += res.photo_errors?.length || 0;
      }
      setMsg(`${sent} ${t('record(s) synced.')}${badPhotos ? ` ${badPhotos} ${t('photo(s) could not be read and were left out.')}` : ''}`);
    } catch (e) {
      setMsg(e.response?.data?.detail || t('Sync failed — records stay on this device and will retry.'));
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      refreshRecords();
    }
  }, [survey, refreshRecords, t]);

  // online / offline, and sync as soon as the signal returns
  useEffect(() => {
    const up = () => { setOnline(true); sync(); };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, [sync]);

  useEffect(() => {
    if (!survey) return;
    refreshRecords(survey).then(() => sync());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey?.id]);

  // --- location: GPS ---
  const stopGps = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setWatching(false);
  };
  const startGps = () => {
    setGpsErr('');
    if (!navigator.geolocation) { setGpsErr(t('This device has no GPS / location access.')); return; }
    stopGps();
    setActiveStep?.('none');
    setWatching(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, altitude: p.coords.altitude, source: 'gps' }),
      (e) => { setGpsErr(e.code === 1 ? t('Location permission was denied.') : t('Could not get a GPS fix. Try outside, or pick the point on the map.')); stopGps(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  };
  useEffect(() => () => stopGps(), []);

  // --- location: pick on map (reuses the map's point-placing click) ---
  const picking = activeStep === 'place-sample';
  const startPick = () => { stopGps(); setSampleClicks?.([]); setActiveStep?.('place-sample'); };
  useEffect(() => {
    if (!picking || !sampleClicks?.length) return;
    const c = sampleClicks[sampleClicks.length - 1];
    setPos({ lat: c.lat, lng: c.lng, accuracy: null, altitude: null, source: 'map' });
    setActiveStep?.('none');
    setSampleClicks?.([]);
  }, [picking, sampleClicks, setActiveStep, setSampleClicks]);
  useEffect(() => () => setActiveStep?.('none'), [setActiveStep]);

  // --- save a record (always to the device first) ---
  const missing = (survey?.fields || []).filter((f) => f.required && !String(answers[f.key] ?? '').trim());
  const saveRecord = async () => {
    if (!pos || missing.length) return;
    const rec = {
      client_id: newClientId(), survey_id: survey.id, lat: pos.lat, lng: pos.lng,
      accuracy_m: pos.accuracy ?? null, altitude_m: pos.altitude ?? null,
      data: answers, photo_data_url: photo, recorded_at: new Date().toISOString(),
    };
    await queueRecord(rec);
    stopGps();
    setAnswers({});
    setPhoto(null);
    setPos(null);
    if (fileRef.current) fileRef.current.value = '';
    setMsg(navigator.onLine ? t('Saved. Syncing…') : t('Saved on this device. It will sync when you are online.'));
    setPending(await pendingFor(survey.id));
    sync();
  };

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { setPhoto(await compressPhoto(f)); } catch (err) { setMsg(err.message); }
  };

  // --- map ---
  const pendingFeatures = useMemo(() => pending.map((r) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: { status: 'not synced yet', ...r.data, color: '#f59e0b', radius: 7 },
  })), [pending]);
  useEffect(() => {
    const layers = [];
    if (synced.length) {
      layers.push({ id: 'field-records', name: survey?.name, type: 'circle', colorProp: 'color', radiusProp: 'radius',
        data: { type: 'FeatureCollection', features: synced.map((f) => ({ ...f, properties: { ...f.properties, color: '#2563eb', radius: 7 } })) } });
    }
    if (pendingFeatures.length) {
      layers.push({ id: 'field-pending', name: 'Not synced yet', type: 'circle', colorProp: 'color', radiusProp: 'radius',
        data: { type: 'FeatureCollection', features: pendingFeatures } });
    }
    if (pos) {
      layers.push({ id: 'field-here', name: 'New point', type: 'circle', color: '#ef4444', radius: 9,
        data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [pos.lng, pos.lat] }, properties: {} }] } });
    }
    setVectorLayers?.(layers);
  }, [synced, pendingFeatures, pos, survey, setVectorLayers]);
  useEffect(() => () => setVectorLayers?.([]), [setVectorLayers]);

  useEffect(() => {
    if (pos?.source === 'gps') mapRef?.current?.flyTo?.(pos.lng, pos.lat, 17);
    // only on the first fix of each capture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos != null && pos.source]);

  const download = async (fmt) => {
    try {
      const blob = await exportSurvey(survey.id, fmt);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${survey.name.replace(/[^\w-]+/g, '_')}.${fmt}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      setMsg(t('Export needs an internet connection.'));
    }
  };

  const removeSurvey = async (s) => {
    if (!window.confirm(`${t('Delete the survey')} "${s.name}" ${t('and all its records? This cannot be undone.')}`)) return;
    await deleteSurvey(s.id);
    loadSurveys();
  };
  const removeRecord = async (id) => {
    if (!window.confirm(t('Delete this record?'))) return;
    await deleteFieldRecord(id);
    refreshRecords();
  };

  const header = (
    <div className="border-b pb-4 flex items-start justify-between gap-2">
      <div>
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">{t('Field Collect')}</h2>
        <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-emerald-600">{t('GPS · photo · works offline')}</p>
      </div>
      <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
        {online ? <Wifi size={12} /> : <WifiOff size={12} />} {online ? t('Online') : t('Offline')}
      </span>
    </div>
  );

  // ---------- survey list ----------
  if (!survey) {
    return (
      <div className="p-5 space-y-4">
        {header}
        {creating ? (
          <NewSurvey onCancel={() => setCreating(false)} onCreated={(s) => { setCreating(false); loadSurveys(); setSurvey(s); }} />
        ) : (
          <button type="button" onClick={() => setCreating(true)} disabled={!online}
            className="w-full rounded-2xl border-2 border-dashed border-blue-200 py-3 text-[12px] font-bold text-blue-600 flex items-center justify-center gap-2 hover:bg-blue-50 disabled:opacity-40">
            <Plus size={14} /> {t('New survey')}
          </button>
        )}
        {surveys.length === 0 && !creating && (
          <p className="text-[12px] text-slate-500 leading-relaxed">
            {t('Make a survey, open this page on your phone at the site, and record points with GPS, answers and a photo. No signal? Records stay on the phone and sync later.')}
          </p>
        )}
        <div className="space-y-2">
          {surveys.map((s) => (
            <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3 hover:border-blue-300">
              <button type="button" onClick={() => setSurvey(s)} className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-bold text-slate-700 truncate">{s.name}</p>
                <p className="text-[10px] text-slate-400">{s.records} {t('records')} · {s.fields.length} {t('fields')}</p>
              </button>
              <button type="button" onClick={() => removeSurvey(s)} disabled={!online} className="text-slate-300 hover:text-red-500 disabled:opacity-30" title={t('Delete')}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- one survey: capture + records ----------
  return (
    <div className="p-5 space-y-4">
      {header}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { stopGps(); setSurvey(null); setSynced([]); setPending([]); setPos(null); setMsg(''); loadSurveys(); }}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><ArrowLeft size={16} /></button>
        <p className="text-[14px] font-black text-slate-700 truncate">{survey.name}</p>
      </div>

      {/* location */}
      <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
        <p className={label}>1 · {t('Location')}</p>
        <div className="flex gap-2">
          <button type="button" onClick={watching ? stopGps : startGps}
            className={`flex-1 rounded-xl py-2 text-[12px] font-bold flex items-center justify-center gap-1.5 ${watching ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            {watching ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />} {watching ? t('Reading GPS…') : t('Use my GPS')}
          </button>
          <button type="button" onClick={picking ? () => setActiveStep('none') : startPick}
            className={`flex-1 rounded-xl py-2 text-[12px] font-bold flex items-center justify-center gap-1.5 ${picking ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <MapPin size={14} /> {picking ? t('Click the map…') : t('Pick on map')}
          </button>
        </div>
        {gpsErr && <p className="text-[11px] text-red-600">{gpsErr}</p>}
        {pos && (
          <p className="text-[11px] text-slate-600 font-mono">
            {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
            {pos.accuracy != null && (
              <span className={`ml-2 font-sans font-bold ${pos.accuracy <= 10 ? 'text-emerald-600' : pos.accuracy <= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                ±{Math.round(pos.accuracy)} m
              </span>
            )}
            {pos.source === 'map' && <span className="ml-2 font-sans text-slate-400">({t('from map')})</span>}
          </p>
        )}
      </div>

      {/* answers */}
      <div className="rounded-2xl border border-slate-200 p-3 space-y-2.5">
        <p className={label}>2 · {t('Details')}</p>
        {survey.fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <p className="text-[11px] font-bold text-slate-600">{f.label}{f.required && <span className="text-red-500"> *</span>}</p>
            {f.type === 'select' ? (
              <select className={input} value={answers[f.key] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}>
                <option value="">—</option>
                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input className={input} type={f.type === 'number' ? 'number' : 'text'} value={answers[f.key] || ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))} />
            )}
          </div>
        ))}
        <div className="space-y-1">
          <p className="text-[11px] font-bold text-slate-600">{t('Photo')}</p>
          {photo ? (
            <div className="relative">
              <img src={photo} alt="" className="w-full h-36 object-cover rounded-xl" />
              <button type="button" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = ''; }}
                className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white"><X size={12} /></button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-[12px] font-bold text-slate-500 cursor-pointer hover:bg-slate-50">
              <Camera size={14} /> {t('Take / choose photo')}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
            </label>
          )}
        </div>
      </div>

      <button type="button" onClick={saveRecord} disabled={!pos || missing.length > 0}
        className="w-full rounded-2xl bg-emerald-600 py-3 text-[13px] font-black text-white flex items-center justify-center gap-2 disabled:opacity-40">
        <CheckCircle2 size={16} /> {pos ? t('Save record') : t('Set a location first')}
      </button>

      {msg && <p className="text-[11px] text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{msg}</p>}

      {/* sync + export */}
      <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-slate-600">
            <b>{synced.length}</b> {t('synced')} · <b className={pending.length ? 'text-amber-600' : ''}>{pending.length}</b> {t('on this device')}
          </p>
          <button type="button" onClick={sync} disabled={!pending.length || !online || syncing}
            className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white flex items-center gap-1 disabled:opacity-30">
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <CloudUpload size={12} />} {t('Sync now')}
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => download('geojson')} disabled={!synced.length}
            className="flex-1 rounded-lg border py-1.5 text-[11px] font-bold text-slate-600 flex items-center justify-center gap-1 disabled:opacity-30"><Download size={12} /> GeoJSON</button>
          <button type="button" onClick={() => download('csv')} disabled={!synced.length}
            className="flex-1 rounded-lg border py-1.5 text-[11px] font-bold text-slate-600 flex items-center justify-center gap-1 disabled:opacity-30"><Download size={12} /> CSV</button>
        </div>
      </div>

      {/* records */}
      {synced.length > 0 && (
        <div className="space-y-1.5">
          <p className={label}>{t('Records')}</p>
          {synced.slice(0, 50).map((f) => {
            const p = f.properties;
            const title = survey.fields.map((d) => p[d.key]).filter(Boolean).slice(0, 2).join(' · ') || `#${p.id}`;
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2">
                {p.photo_url ? <img src={p.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-slate-100" />}
                <button type="button" onClick={() => mapRef?.current?.flyTo?.(f.geometry.coordinates[0], f.geometry.coordinates[1], 18)} className="flex-1 min-w-0 text-left">
                  <p className="text-[12px] font-bold text-slate-700 truncate">{title}</p>
                  <p className="text-[10px] text-slate-400">{p.recorded_at ? new Date(p.recorded_at).toLocaleString('en-GB') : ''}{p.accuracy_m != null ? ` · ±${Math.round(p.accuracy_m)} m` : ''}</p>
                </button>
                <button type="button" onClick={() => removeRecord(p.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
