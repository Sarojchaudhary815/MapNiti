import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, BookOpen, Wrench, ListChecks, ChevronDown, ExternalLink, ArrowRight, Lightbulb } from 'lucide-react';
import { SECTORS, CONCEPTS, TOOL_GROUPS, GUIDES } from '../../features/guide/guideContent';
import { isAuthenticated } from '../../api/authApi';

const NAV = [
  ['what', 'What GIS can do', Compass],
  ['concepts', 'Core concepts', BookOpen],
  ['tools', 'Advanced tools', Wrench],
  ['guides', 'Analysis guides', ListChecks],
];

function GuideCard({ g, open, onToggle }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 p-5 text-left">
        <div>
          <p className="text-base font-black text-slate-800">{g.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{g.level} · {g.time} · {g.tools}</p>
        </div>
        <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          <ol className="space-y-2">
            {g.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="h-6 w-6 rounded-full bg-theme-700 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2"><Lightbulb size={16} className="shrink-0 mt-0.5" />{g.tip}</p>
        </div>
      )}
    </div>
  );
}

export default function GisGuidePage() {
  const navigate = useNavigate();
  const [openGuide, setOpenGuide] = useState(GUIDES[0].id);
  const openTool = (module) => navigate(isAuthenticated() ? `/tool?module=${module}` : '/login');

  return (
    <div className="bg-slate-50">
      <section className="bg-gradient-to-br from-theme-900 via-theme-800 to-theme-600 text-white">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-theme-200">GIS Guide</p>
          <h1 className="text-3xl md:text-5xl font-black mt-3 max-w-4xl">Everything GIS can do — and how to do it</h1>
          <p className="text-theme-100 mt-3 max-w-3xl">A practical reference for civil, geomatics and environmental engineers: what GIS is used for, the concepts you must know, the most powerful tools in 2026, and step-by-step guides for common analyses.</p>
          <div className="flex flex-wrap gap-2 mt-6">
            {NAV.map(([id, label, Icon]) => (
              <a key={id} href={`#${id}`} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20"><Icon size={13} /> {label}</a>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        <section id="what" className="scroll-mt-24">
          <h2 className="text-2xl font-black text-slate-800">What is GIS — and what can it do?</h2>
          <p className="text-slate-600 mt-2 max-w-4xl">
            A <b>Geographic Information System</b> captures, stores, analyses and presents data tied to locations on Earth. It answers <i>where</i> questions
            (where is the best site? where will it flood?) and <i>what-if</i> questions (what happens if the river rises 2 m?). Combined with satellite remote sensing,
            GPS/GNSS surveying and drones, it is now a core skill for every engineer.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {SECTORS.map((s) => (
              <div key={s.title} className="p-5 bg-white rounded-2xl border border-slate-100 flex flex-col">
                <p className="font-black text-slate-800">{s.title}</p>
                <ul className="mt-2 space-y-1 flex-grow">{s.items.map((i) => <li key={i} className="text-[13px] text-slate-600 flex gap-1.5"><span className="text-theme-500">•</span>{i}</li>)}</ul>
                <button onClick={() => openTool(s.tool[1])} className="mt-3 text-xs font-bold text-theme-700 flex items-center gap-1 hover:underline">Try: {s.tool[0]} <ArrowRight size={12} /></button>
              </div>
            ))}
          </div>
        </section>

        <section id="concepts" className="scroll-mt-24">
          <h2 className="text-2xl font-black text-slate-800">Core concepts in one page</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
            {CONCEPTS.map(([term, def]) => (
              <div key={term} className="p-4 bg-white rounded-xl border border-slate-100">
                <p className="font-bold text-slate-800 text-sm">{term}</p>
                <p className="text-[13px] text-slate-600 mt-0.5">{def}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-4">Want to learn these properly? Start the free <Link to="/learn/gis-fundamentals" className="text-theme-700 font-bold underline">GIS Fundamentals</Link> course.</p>
        </section>

        <section id="tools" className="scroll-mt-24">
          <h2 className="text-2xl font-black text-slate-800">The most powerful GIS tools (2026)</h2>
          <p className="text-slate-600 mt-2">What each is best at, how hard it is and what it costs. See <Link to="/whats-new" className="text-theme-700 font-bold underline">What's New</Link> for this year's releases.</p>
          <div className="space-y-8 mt-6">
            {TOOL_GROUPS.map((g) => (
              <div key={g.group}>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{g.group}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {g.tools.map((t) => (
                    <a key={t.name} href={t.url} target="_blank" rel="noopener noreferrer" className="group p-4 bg-white rounded-2xl border border-slate-100 hover:border-theme-400 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black text-slate-800 group-hover:text-theme-700">{t.name}</p>
                        <ExternalLink size={14} className="text-slate-300 shrink-0" />
                      </div>
                      <div className="flex gap-1.5 mt-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{t.cost}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{t.level}</span>
                      </div>
                      <p className="text-[13px] text-slate-600 mt-2">{t.power}</p>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="guides" className="scroll-mt-24">
          <h2 className="text-2xl font-black text-slate-800">Step-by-step analysis guides</h2>
          <p className="text-slate-600 mt-2">Proven workflows with the tools to use and the mistakes to avoid. Most of them run in MapNiti directly.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-6 items-start">
            {GUIDES.map((g) => <GuideCard key={g.id} g={g} open={openGuide === g.id} onToggle={() => setOpenGuide(openGuide === g.id ? null : g.id)} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
