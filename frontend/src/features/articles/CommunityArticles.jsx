import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Eye, Loader2, MapPin, Target, Trash2, UserRound, Wrench, Share2, Map as MapIcon,
} from 'lucide-react';
import { listArticles, getArticle, deleteArticle } from '../../api/hubApi';
import { getCurrentUser } from '../../api/authApi';
import { ResultView } from '../analysis/AnalysisRunner';
import ShareButtons from './ShareButtons';

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function CommunityCard({ a }) {
  return (
    <Link to={`/case-studies/${a.slug}`}
      className="group flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="h-48 shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center">
        {a.image_url
          ? <img src={a.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
          : <MapIcon size={28} className="text-slate-300" />}
      </div>
      <div className="flex flex-col flex-grow p-6">
        <span className="text-theme-500 font-black text-xs uppercase tracking-widest">{a.module || 'Analysis'}</span>
        <h3 className="text-lg font-bold mt-1.5 text-slate-900 line-clamp-2">{a.title}</h3>
        {a.location && <p className="text-theme-700 text-sm font-semibold mt-1">{a.location}</p>}
        {a.summary && <p className="text-slate-500 text-sm leading-relaxed mt-2 line-clamp-3 flex-grow">{a.summary}</p>}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-[12px] text-slate-400">
          <span className="truncate">{a.author?.name} · {fmtDate(a.created_at)}</span>
          <span className="inline-flex items-center gap-1 font-bold text-theme-700 group-hover:gap-2 transition-all shrink-0">Read <ArrowRight size={14} /></span>
        </div>
      </div>
    </Link>
  );
}

/** Articles published by users from their analyses (newest first). */
export function CommunityList() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    listArticles(30).then((r) => setItems(r.articles || [])).catch(() => setItems([]));
  }, []);
  if (items === null) {
    return <div className="flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin" /></div>;
  }
  if (!items.length) return null;
  return (
    <div className="max-w-7xl mx-auto px-6 pb-12">
      <h2 className="text-2xl font-black text-slate-800">From the community</h2>
      <p className="text-sm text-slate-500 mt-1">Analyses that MapNiti users ran and published themselves.</p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((a) => <CommunityCard key={a.slug} a={a} />)}
      </div>
    </div>
  );
}

/** One user-published article, loaded by slug. `notFound` renders when it does not exist. */
export function CommunityArticle({ slug, notFound }) {
  const [a, setA] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const me = getCurrentUser();

  useEffect(() => {
    setA(undefined);
    getArticle(slug).then(setA).catch(() => setA(null));
  }, [slug]);

  if (a === undefined) {
    return <div className="flex justify-center py-32 text-slate-400"><Loader2 className="animate-spin" /></div>;
  }
  if (a === null) return notFound;

  const canDelete = me && (me.id === a.author_id || me.is_admin);
  const remove = async () => {
    if (!window.confirm('Delete this article? It will be removed from the website and shared links will stop working.')) return;
    setBusy(true);
    try {
      await deleteArticle(a.slug);
      navigate('/case-studies');
    } catch (err) {
      window.alert(err.response?.data?.detail || 'Could not delete the article.');
      setBusy(false);
    }
  };
  const findings = (a.findings || '').split('\n').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="bg-slate-50 min-h-screen">
      <section className="bg-gradient-to-br from-slate-900 via-theme-900 to-theme-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link to="/case-studies" className="inline-flex items-center gap-1 text-sm text-theme-100 hover:text-white"><ArrowLeft size={15} /> All case studies</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-widest text-yellow-300">{a.module || 'Analysis'} · Community article</p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">{a.title}</h1>
          {a.location && <p className="text-lg text-theme-100 mt-1 flex items-center gap-1.5"><MapPin size={17} /> {a.location}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-5 text-sm text-theme-100">
            <span className="flex items-center gap-1.5"><UserRound size={15} /> {a.author?.name}{a.author?.organization ? ` (${a.author.organization})` : ''}</span>
            <span className="flex items-center gap-1.5"><CalendarDays size={15} /> {fmtDate(a.created_at)}</span>
            <span className="flex items-center gap-1.5"><Eye size={15} /> {a.views} views</span>
            {a.tool_label && <span className="flex items-center gap-1.5"><Wrench size={15} /> {a.tool_label}</span>}
          </div>
          <div className="mt-6"><ShareButtons shareUrl={a.share_url} title={a.title} dark /></div>
        </div>
      </section>

      <article className="max-w-4xl mx-auto px-6 py-10">
        {a.image_url && <img src={a.image_url} alt={`Map of ${a.location || a.title}`} className="w-full rounded-3xl border border-slate-200 shadow-sm" />}

        {a.question && (
          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
              <span className="p-1.5 rounded-lg bg-theme-50 text-theme-700"><Target size={16} /></span>The question
            </h2>
            <p className="mt-3 text-[15px] text-slate-700 leading-relaxed whitespace-pre-line">{a.question}</p>
          </section>
        )}

        {findings.length > 0 && (
          <section className="mt-10">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
              <span className="p-1.5 rounded-lg bg-theme-50 text-theme-700"><CheckCircle2 size={16} /></span>What was found
            </h2>
            <ul className="mt-3 space-y-2">
              {findings.map((t, i) => (
                <li key={i} className="flex gap-2 text-[15px] text-slate-700 leading-relaxed">
                  <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" /><span>{t}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {a.result && Object.keys(a.result).length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-black text-slate-800 mb-3">Results from MapNiti</h2>
            <div className="bg-white rounded-3xl border border-slate-100 p-5 md:p-6">
              <ResultView result={a.result} toolId={a.tool_id || 'article'} opacity={1} setOpacity={() => {}} />
            </div>
          </section>
        )}

        <div className="mt-12 rounded-3xl bg-white border border-slate-100 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Share2 size={13} /> Share this article</p>
          <div className="mt-3"><ShareButtons shareUrl={a.share_url} title={a.title} /></div>
        </div>

        <div className="mt-6 flex flex-col md:flex-row gap-4">
          <Link to="/tool" className="flex-1 rounded-2xl bg-theme-700 hover:bg-theme-800 text-white p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-theme-100">Try it yourself</p>
            <p className="text-lg font-black mt-1">Run {a.tool_label || 'this analysis'} on your own area</p>
            <span className="inline-flex items-center gap-1 text-sm font-bold mt-3">Open MapNiti tools <ArrowRight size={15} /></span>
          </Link>
          {canDelete && (
            <button onClick={remove} disabled={busy}
              className="md:w-56 rounded-2xl border border-red-200 bg-white hover:bg-red-50 text-red-600 p-6 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete article
            </button>
          )}
        </div>
        <p className="text-[12px] text-slate-400 mt-6">
          Published by a MapNiti user. Results come from open global datasets and are meant for screening, not final design. Check them on the ground before using them.
        </p>
      </article>
    </div>
  );
}
