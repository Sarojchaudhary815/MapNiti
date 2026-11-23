import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock, Database, Droplets, Building2,
  ExternalLink, Lightbulb, AlertTriangle, ListOrdered, MapPin, Target, UserRound, Zap, Send,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { CASE_STUDIES, caseStudyBySlug } from '../../features/casestudies/caseStudies';

const ICONS = { droplets: Droplets, building: Building2, zap: Zap };

function Section({ icon: Icon, title, children }) {
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
        <span className="p-1.5 rounded-lg bg-theme-50 text-theme-700"><Icon size={16} /></span>{title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bullets({ items, icon: Icon = CheckCircle2, color = 'text-emerald-600' }) {
  return (
    <ul className="space-y-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2 text-[15px] text-slate-700 leading-relaxed">
          <Icon size={17} className={`${color} shrink-0 mt-0.5`} /><span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function CaseList() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <section className="bg-gradient-to-br from-slate-900 via-theme-900 to-theme-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-300">Case studies</p>
          <h1 className="text-3xl md:text-5xl font-black mt-3 max-w-4xl">What people are analyzing on MapNiti</h1>
          <p className="text-theme-100 mt-3 max-w-3xl">
            Real analyses run with MapNiti tools. Each one shows the question, the data, every step, the actual results and how an engineer can use them.
          </p>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        {CASE_STUDIES.map((c) => <CaseCard key={c.slug} c={c} />)}
      </div>
      <ShareYours />
    </div>
  );
}

export function CaseCard({ c }) {
  const Icon = ICONS[c.icon] || Droplets;
  return (
    <Link to={`/case-studies/${c.slug}`}
      className="group flex flex-col bg-white rounded-3xl p-7 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="h-12 w-12 rounded-2xl bg-theme-200 flex items-center justify-center mb-5">
        <Icon className="text-theme-900" size={22} />
      </div>
      <span className="text-theme-500 font-black text-xs uppercase tracking-widest">{c.module}</span>
      <h3 className="text-xl font-bold mt-2 mb-1 text-slate-900">{c.title}</h3>
      <p className="text-theme-700 text-sm font-semibold mb-3">{c.location}</p>
      <p className="text-slate-500 text-sm leading-relaxed flex-grow">{c.card}</p>
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 text-[12px] text-slate-400">
        <span>{c.analyst} · {c.date}</span>
        <span className="inline-flex items-center gap-1 font-bold text-theme-700 group-hover:gap-2 transition-all">Read <ArrowRight size={14} /></span>
      </div>
    </Link>
  );
}

function ShareYours() {
  return (
    <div className="max-w-7xl mx-auto px-6 pb-16">
      <div className="rounded-3xl bg-white border border-slate-100 p-8 flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-800">Did an analysis on MapNiti?</h3>
          <p className="text-sm text-slate-500 mt-1">Send us your study area, tools and results. Good studies are published here with your name.</p>
        </div>
        <Link to="/contact" className="inline-flex items-center gap-2 bg-theme-700 hover:bg-theme-800 text-white px-5 py-3 rounded-xl text-sm font-bold shrink-0">
          <Send size={15} /> Share your analysis
        </Link>
      </div>
    </div>
  );
}

function CaseArticle({ c }) {
  const Icon = ICONS[c.icon] || Droplets;
  const others = CASE_STUDIES.filter((x) => x.slug !== c.slug);
  return (
    <div className="bg-slate-50 min-h-screen">
      <section className="bg-gradient-to-br from-slate-900 via-theme-900 to-theme-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Link to="/case-studies" className="inline-flex items-center gap-1 text-sm text-theme-100 hover:text-white"><ArrowLeft size={15} /> All case studies</Link>
          <p className="mt-5 text-xs font-bold uppercase tracking-widest text-yellow-300 flex items-center gap-2"><Icon size={15} /> {c.module}</p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">{c.title}</h1>
          <p className="text-lg text-theme-100 mt-1 flex items-center gap-1.5"><MapPin size={17} /> {c.location}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-5 text-sm text-theme-100">
            <span className="flex items-center gap-1.5"><UserRound size={15} /> {c.analyst} ({c.analystRole})</span>
            <span className="flex items-center gap-1.5"><CalendarDays size={15} /> Run on {c.date}</span>
            <span className="flex items-center gap-1.5"><Clock size={15} /> {c.readMinutes} min read</span>
          </div>
        </div>
      </section>

      <article className="max-w-4xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {c.stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
              <p className="text-2xl font-black text-theme-800 mt-1">{s.value}</p>
              <p className="text-[12px] text-slate-500">{s.note}</p>
            </div>
          ))}
        </div>

        <Section icon={Target} title="The question">
          <p className="text-[15px] text-slate-700 leading-relaxed">{c.question}</p>
          <p className="text-sm text-slate-500 mt-2"><b>Study area:</b> {c.aoi}</p>
          <p className="text-sm text-slate-500 mt-1"><b>MapNiti tools used:</b> {c.tools.join(', ')}</p>
        </Section>

        <Section icon={Database} title="Data used">
          <div className="space-y-2">
            {c.data.map(([name, what, href]) => (
              <a key={name} href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-start justify-between gap-3 bg-white rounded-xl border border-slate-100 p-3 hover:border-theme-300">
                <span><span className="font-bold text-slate-800 text-sm">{name}</span><span className="block text-[13px] text-slate-500">{what}</span></span>
                <ExternalLink size={14} className="text-slate-400 shrink-0 mt-1" />
              </a>
            ))}
          </div>
        </Section>

        <Section icon={ListOrdered} title="Step by step">
          <ol className="space-y-3">
            {c.steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-[15px] text-slate-700 leading-relaxed">
                <span className="h-7 w-7 rounded-full bg-theme-700 text-white text-sm font-black flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </Section>

        {c.chart && (
          <Section icon={Icon} title={c.chart.title}>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={c.chart.data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" km²" width={70} />
                  <Tooltip formatter={(v) => [`${v} km²`, 'Built-up']} />
                  <Area type="monotone" dataKey="km2" stroke="#0047AB" fill="#93c5fd" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[12px] text-slate-400 mt-1">{c.chart.note}</p>
          </Section>
        )}

        {c.table && (
          <Section icon={Database} title={c.table.title}>
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>{c.table.columns.map((h) => <th key={h} className="px-4 py-2 text-left font-bold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {c.table.rows.map((r) => (
                    <tr key={r[0]} className="border-t border-slate-100">{r.map((v, j) => <td key={j} className="px-4 py-2 text-slate-700">{v}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        <Section icon={CheckCircle2} title="What we found">
          <Bullets items={c.findings} />
        </Section>

        <Section icon={Lightbulb} title="How to use these results">
          <Bullets items={c.useIt} icon={ArrowRight} color="text-theme-600" />
        </Section>

        <Section icon={AlertTriangle} title="Limits to keep in mind">
          <Bullets items={c.limits} icon={AlertTriangle} color="text-amber-500" />
        </Section>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to={`/tool?module=${c.toolModule}`}
            className="rounded-2xl bg-theme-700 hover:bg-theme-800 text-white p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-theme-100">Try it yourself</p>
            <p className="text-lg font-black mt-1">Run this analysis on your own area</p>
            <span className="inline-flex items-center gap-1 text-sm font-bold mt-3">Open {c.module} tools <ArrowRight size={15} /></span>
          </Link>
          <div className="rounded-2xl bg-white border border-slate-100 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><BookOpen size={13} /> Learn the method</p>
            <div className="mt-2 space-y-1.5">
              {c.lessons.map(([label, to]) => (
                <Link key={to + label} to={to} className="block text-sm font-semibold text-theme-700 hover:underline">{label}</Link>
              ))}
            </div>
          </div>
        </div>

        <h2 className="text-lg font-black text-slate-800 mt-14 mb-4">More case studies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {others.map((o) => <CaseCard key={o.slug} c={o} />)}
        </div>
      </article>
      <ShareYours />
    </div>
  );
}

export default function CaseStudiesPage() {
  const { slug } = useParams();
  const c = slug ? caseStudyBySlug(slug) : null;
  useEffect(() => { window.scrollTo(0, 0); }, [slug]);
  if (slug && !c) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <p className="text-slate-500">This case study was not found.</p>
        <Link to="/case-studies" className="text-theme-700 font-bold underline">See all case studies</Link>
      </div>
    );
  }
  return c ? <CaseArticle c={c} /> : <CaseList />;
}
