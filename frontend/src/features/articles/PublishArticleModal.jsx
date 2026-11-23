import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Globe2, ImageOff, CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react';
import { publishArticle } from '../../api/hubApi';
import ShareButtons from './ShareButtons';

const field = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-[#0047AB] focus:ring-2 focus:ring-blue-100';

/**
 * Turns a finished analysis into a public article on the website (Case Studies)
 * and offers share buttons once it is live.
 * `result` is the tool's response (stats/table/chart/legend/notes); the map image
 * is captured from the live map, framed on the AOI.
 */
export default function PublishArticleModal({ onClose, result, toolId, toolLabel, module, selectedAOI, mapRef }) {
  const [title, setTitle] = useState(result?.title || toolLabel || '');
  const [location, setLocation] = useState('');
  const [question, setQuestion] = useState('');
  const [findings, setFindings] = useState('');
  const [image, setImage] = useState(null);
  const [useImage, setUseImage] = useState(true);
  const [capturing, setCapturing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [published, setPublished] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const img = await mapRef?.current?.snapshot?.({ bbox: selectedAOI?.bbox });
      if (alive) { setImage(img || null); setCapturing(false); }
    })();
    return () => { alive = false; };
  }, [mapRef, selectedAOI]);

  const submit = async () => {
    setError('');
    if (title.trim().length < 5) return setError('Give the article a title (at least 5 characters).');
    if (!location.trim()) return setError('Where is the study area? (e.g. "Bharatpur Metropolitan City, Chitwan")');
    setBusy(true);
    try {
      const res = await publishArticle({
        title: title.trim(), location: location.trim(), question: question.trim(), findings: findings.trim(),
        tool_id: toolId, tool_label: toolLabel, module,
        result, aoi_geojson: selectedAOI?.geojson || null,
        image_data_url: useImage ? image : null,
      });
      setPublished(res.article);
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(Array.isArray(d) ? d.map((x) => x.msg).join('; ') : d || err.message || 'Could not publish.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2">
            <Globe2 size={18} className="text-[#0047AB]" />
            <h3 className="font-black text-slate-800">{published ? 'Your article is live' : 'Publish to the website'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        {published ? (
          <div className="p-6 space-y-5">
            <div className="flex gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-emerald-800">{published.title}</p>
                <p className="text-[13px] text-emerald-700 mt-0.5">Published under Case Studies with your name.</p>
              </div>
            </div>
            {published.image_url && <img src={published.image_url} alt="" className="w-full rounded-2xl border" />}
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Share it</p>
              <ShareButtons shareUrl={published.share_url} title={published.title} />
            </div>
            <a href={`/case-studies/${published.slug}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#0047AB] hover:bg-blue-800 text-white py-3 text-sm font-bold">
              Open the article <ExternalLink size={15} />
            </a>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <p className="text-[13px] text-slate-500">
              Your results ({result?.stats?.length || 0} figures{result?.table ? ', the table' : ''}{result?.chart ? ' and the chart' : ''}) and a picture of the map
              become a public article under <b>Case Studies</b>, with your name. Add a few lines so readers understand it.
            </p>

            <div className="rounded-2xl overflow-hidden border bg-slate-50 h-56 flex items-center justify-center">
              {capturing ? (
                <span className="flex items-center gap-2 text-[12px] text-slate-400"><Loader2 size={14} className="animate-spin" /> Capturing the map…</span>
              ) : image && useImage ? (
                <img src={image} alt="Map snapshot" className="w-full h-full object-cover" />
              ) : (
                <span className="flex items-center gap-2 text-[12px] text-slate-400"><ImageOff size={14} /> {image ? 'Map picture not included' : 'Could not capture the map'}</span>
              )}
            </div>
            {image && (
              <label className="flex items-center gap-2 text-[12px] text-slate-600">
                <input type="checkbox" checked={useImage} onChange={(e) => setUseImage(e.target.checked)} /> Include this map picture
              </label>
            )}

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Title *</span>
              <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
                placeholder="e.g. Flood risk in Bharatpur's Narayani floodplain" />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Study area *</span>
              <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={200}
                placeholder="e.g. Ward 21–25, Bharatpur Metropolitan City, Chitwan" />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Why did you run this analysis?</span>
              <textarea className={field} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={3000}
                placeholder="The question you wanted to answer, and who it helps." />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">What did you find?</span>
              <textarea className={field} rows={4} value={findings} onChange={(e) => setFindings(e.target.value)} maxLength={8000}
                placeholder={'One finding per line, e.g.\n12% of the ward is in the high-hazard class.\nMost exposed houses are along the east bank.'} />
            </label>

            {error && <p className="flex gap-1.5 text-[12px] text-red-600 bg-red-50 rounded-lg p-2.5"><AlertCircle size={14} className="shrink-0 mt-0.5" />{error}</p>}

            <button onClick={submit} disabled={busy || capturing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0047AB] hover:bg-blue-800 disabled:opacity-50 text-white py-3 text-sm font-black">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Globe2 size={16} />} {busy ? 'Publishing…' : 'Publish article'}
            </button>
            <p className="text-[11px] text-slate-400 text-center">Anyone can read published articles. You can delete yours at any time.</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
