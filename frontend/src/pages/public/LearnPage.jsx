import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2, Check, Clock, ArrowRight, ArrowLeft, Code2, BookOpen, Target, ListChecks, Search, X,
  Globe2, Map as MapIcon, Palette, FileCode2, Braces, Terminal, Table2, Satellite, Layers, Mountain, Droplets,
  Database, MapPinned, Compass, Cloud, HardHat, Box, Brain, Ruler, GraduationCap, PlayCircle,
} from 'lucide-react';
import Markdown from '../../components/common/Markdown';
import ContourLines from '../../components/ContourLines';
import { ALL_COURSES, TRACKS, LEVELS, courseById } from '../../features/learn/catalog';
import { getLearnProgress, setLessonProgress } from '../../api/hubApi';
import { isAuthenticated } from '../../api/authApi';

// "## " headings of a lesson (outside code blocks) → the lesson outline.
function lessonOutline(body) {
  let inCode = false;
  const out = [];
  body.split('\n').forEach((line) => {
    if (line.startsWith('```')) inCode = !inCode;
    else if (!inCode && line.startsWith('## ')) out.push(line.slice(3).trim());
  });
  return out;
}

// ---- Visual identity ------------------------------------------------------
// One deep colour per track (so the catalogue reads as three families, not a
// rainbow), one icon per course, and a seeded topographic pattern per cover.
const TRACK_LOOK = {
  'GIS Science': { cover: 'bg-[#0a2a5e]', text: 'text-[#0a2a5e]', soft: 'bg-[#e8eef8]', dot: 'bg-[#0a2a5e]', icon: Globe2, short: 'GIS' },
  'Programming & Web': { cover: 'bg-[#0b4f5c]', text: 'text-[#0b4f5c]', soft: 'bg-[#e3f1f2]', dot: 'bg-[#0b4f5c]', icon: Braces, short: 'Code' },
  Engineering: { cover: 'bg-[#3a2a63]', text: 'text-[#3a2a63]', soft: 'bg-[#eeeaf7]', dot: 'bg-[#3a2a63]', icon: HardHat, short: 'Engineering' },
};
const COURSE_ICON = {
  'gis-fundamentals': Globe2, 'qgis-desktop': MapIcon, cartography: Palette, 'html-css': FileCode2, javascript: Braces,
  'python-basics': Terminal, 'pandas-data': Table2, 'remote-sensing': Satellite, 'python-gis': Code2, 'geo-python': Layers,
  'spatial-analysis': MapPinned, 'dem-analysis': Mountain, 'hydrology-gis': Droplets, 'spatial-sql': Database, leaflet: MapIcon,
  surveying: Compass, 'earth-engine': Cloud, 'gis-civil': Ruler, maplibre: Box, geoai: Brain, 'cloud-native': Cloud,
};
const STAGES = [
  { name: 'Foundations', desc: 'GIS concepts, QGIS, maps and your first code', size: 6 },
  { name: 'Core analysis', desc: 'Data, satellites and spatial analysis in Python', size: 6 },
  { name: 'Engineering & web', desc: 'Hydrology, SQL, web maps, surveying, Earth Engine', size: 5 },
  { name: 'Advanced', desc: 'Civil workflows, 3D maps, GeoAI, cloud-native', size: 4 },
];
const LEVEL_RANK = { Beginner: 1, Intermediate: 2, Advanced: 3 };

const look = (c) => TRACK_LOOK[c.track] || TRACK_LOOK['GIS Science'];
const pad = (n) => String(n).padStart(2, '0');
const minutesOf = (c) => c.lessons.reduce((s, l) => s + l.minutes, 0);
const fmtTime = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`);

// Concentric "hill" contours, seeded so each course cover is slightly different.
function TopoRings({ seed = 1, className = '' }) {
  const paths = useMemo(() => {
    const cx = 260 + ((seed * 53) % 120);
    const cy = 40 + ((seed * 37) % 90);
    return Array.from({ length: 11 }, (_, k) => {
      const r = 14 + k * 19;
      let d = '';
      for (let i = 0; i <= 72; i += 1) {
        const a = (i / 72) * Math.PI * 2;
        const rr = r * (1 + 0.13 * Math.sin(3 * a + seed) + 0.07 * Math.sin(5 * a + seed * 1.7) * (k / 10));
        d += `${i ? 'L' : 'M'}${(cx + rr * 1.35 * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
      }
      return `${d}Z`;
    });
  }, [seed]);
  return (
    <svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice" className={`absolute inset-0 w-full h-full ${className}`} aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="white" strokeWidth={i % 5 === 4 ? 1.4 : 0.7} />)}
    </svg>
  );
}

function LevelDots({ level, light }) {
  const n = LEVEL_RANK[level] || 1;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${light ? 'text-white/80' : 'text-slate-500'}`}>
      <span className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 w-3 rounded-full ${i <= n ? (light ? 'bg-pop-400' : 'bg-pop-500') : (light ? 'bg-white/25' : 'bg-slate-200')}`} />
        ))}
      </span>
      {level}
    </span>
  );
}

function ProgressRing({ pct, size = 84, stroke = 7 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F2994A" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  );
}

// ---- Progress ---------------------------------------------------------------
const LOCAL_KEY = 'mapniti_learn_progress';

function useProgress() {
  const loggedIn = isAuthenticated();
  const [progress, setProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; }
  });
  useEffect(() => {
    if (!loggedIn) return;
    getLearnProgress().then((server) => setProgress((local) => {
      const merged = { ...server };
      Object.entries(local).forEach(([c, ls]) => { merged[c] = [...new Set([...(merged[c] || []), ...ls])]; });
      return merged;
    })).catch(() => {});
  }, [loggedIn]);
  useEffect(() => {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(progress)); } catch { /* storage blocked */ }
  }, [progress]);
  const isDone = (c, l) => (progress[c] || []).includes(l);
  const toggle = (c, l, force) => {
    const completed = force ?? !isDone(c, l);
    setProgress((p) => {
      const s = new Set(p[c] || []);
      if (completed) s.add(l); else s.delete(l);
      return { ...p, [c]: [...s] };
    });
    if (loggedIn) setLessonProgress(c, l, completed).catch(() => {});
  };
  return { isDone, toggle, loggedIn };
}

export function openInCodeLab(navigate, lang, code) {
  try {
    localStorage.setItem('mapniti_codelab_seed', JSON.stringify({ lang, code, t: Date.now() }));
  } catch { /* storage blocked */ }
  navigate('/code-lab');
}

// ---- Catalogue ----------------------------------------------------------------
function CourseCard({ course, index, done }) {
  const L = look(course);
  const Icon = COURSE_ICON[course.id] || L.icon;
  const pct = Math.round((done / course.lessons.length) * 100);
  return (
    <Link to={`/learn/${course.id}`}
      className="group flex flex-col bg-white rounded-2xl border border-slate-200/80 overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
      <div className={`relative h-36 ${L.cover} overflow-hidden`}>
        <TopoRings seed={index + 2} className="opacity-25 transition duration-500 group-hover:opacity-40 group-hover:scale-105" />
        <span className="absolute top-4 left-5 font-mono text-[11px] tracking-[0.2em] text-white/60">COURSE {pad(index + 1)}</span>
        <span className="absolute top-3.5 right-4"><LevelDots level={course.level} light /></span>
        <div className="absolute bottom-4 left-5 h-12 w-12 rounded-xl bg-white/10 ring-1 ring-white/25 backdrop-blur-sm flex items-center justify-center">
          <Icon size={24} className="text-white" strokeWidth={1.75} />
        </div>
        <span className="absolute -bottom-5 right-3 font-display text-[88px] leading-none font-black text-white/[0.07] select-none">{pad(index + 1)}</span>
        {pct === 100 && (
          <span className="absolute bottom-4 right-4 flex items-center gap-1 text-[11px] font-bold bg-emerald-500 text-white rounded-full px-2.5 py-1"><Check size={12} /> Done</span>
        )}
      </div>
      <div className="flex flex-col flex-1 p-5">
        <h3 className="font-display text-[17px] font-semibold leading-snug text-slate-900 group-hover:text-theme-700">{course.title}</h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500 line-clamp-2">{course.summary}</p>
        <div className="mt-auto pt-4 flex items-center gap-4 text-[12px] text-slate-500">
          <span className="flex items-center gap-1.5"><BookOpen size={13} /> {course.lessons.length} lessons</span>
          <span className="flex items-center gap-1.5"><Clock size={13} /> {fmtTime(minutesOf(course))}</span>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
          {pct > 0 && pct < 100 ? (
            <>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-pop-500 rounded-full" style={{ width: `${pct}%` }} /></div>
              <span className="text-[12px] font-bold text-slate-600">{pct}%</span>
            </>
          ) : (
            <span className={`flex-1 text-[13px] font-semibold ${L.text}`}>{pct === 100 ? 'Review course' : 'Start course'}</span>
          )}
          <ArrowRight size={16} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-theme-700" />
        </div>
      </div>
    </Link>
  );
}

function Roadmap({ isDone }) {
  let start = 0;
  const stages = STAGES.map((s) => {
    const courses = ALL_COURSES.slice(start, start + s.size).map((c, i) => ({ c, n: start + i + 1 }));
    start += s.size;
    return { ...s, courses };
  });
  return (
    <section>
      <SectionHead eyebrow="Learning path" title="From zero to advanced in 4 stages"
        text="Never used GIS? Start at course 01. Each course builds on the ones before it." />
      <div className="mt-6 grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stages.map((s, si) => (
          <div key={s.name} className="relative bg-white rounded-2xl border border-slate-200/80 p-5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[11px] tracking-[0.2em] text-pop-600">STAGE {si + 1}</span>
              <span className="text-[11px] text-slate-400">{s.courses.length} courses</span>
            </div>
            <h3 className="font-display text-lg font-semibold text-slate-900 mt-1">{s.name}</h3>
            <p className="text-[12.5px] text-slate-500 mt-0.5">{s.desc}</p>
            <ol className="relative mt-4 space-y-0.5 before:absolute before:left-[13px] before:top-3 before:bottom-3 before:w-px before:bg-slate-200">
              {s.courses.map(({ c, n }) => {
                const done = c.lessons.filter((l) => isDone(c.id, l.id)).length;
                const finished = done === c.lessons.length;
                return (
                  <li key={c.id}>
                    <Link to={`/learn/${c.id}`} className="relative flex items-center gap-3 rounded-lg py-1.5 pr-2 hover:bg-slate-50 group">
                      <span className={`relative z-10 h-[27px] w-[27px] shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold ring-4 ring-white
                        ${finished ? 'bg-emerald-500 text-white' : done ? 'bg-pop-500 text-white' : 'bg-white text-slate-500 border border-slate-300'}`}>
                        {finished ? <Check size={13} /> : pad(n)}
                      </span>
                      <span className="text-[13px] leading-tight text-slate-700 group-hover:text-theme-700">{c.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, text, right }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-pop-600">{eyebrow}</p>
        <h2 className="font-display text-2xl md:text-[28px] font-semibold text-slate-900 mt-1">{title}</h2>
        {text && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{text}</p>}
      </div>
      {right}
    </div>
  );
}

function Catalog({ isDone, loggedIn }) {
  const [track, setTrack] = useState('all');
  const [level, setLevel] = useState('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const list = ALL_COURSES.filter((c) => (track === 'all' || c.track === track) && (level === 'all' || c.level === level)
    && (!q || [c.title, c.summary, ...c.outcomes, ...c.lessons.map((l) => `${l.title} ${l.body}`)].join(' ').toLowerCase().includes(q)));

  const totalLessons = ALL_COURSES.reduce((s, c) => s + c.lessons.length, 0);
  const totalMin = ALL_COURSES.reduce((s, c) => s + minutesOf(c), 0);
  const doneLessons = ALL_COURSES.reduce((s, c) => s + c.lessons.filter((l) => isDone(c.id, l.id)).length, 0);
  const pct = Math.round((doneLessons / totalLessons) * 100);

  // Where to continue: first unfinished lesson of the first started course, else of course 01.
  const started = ALL_COURSES.find((c) => c.lessons.some((l) => isDone(c.id, l.id)) && c.lessons.some((l) => !isDone(c.id, l.id)));
  const nextCourse = started || ALL_COURSES.find((c) => c.lessons.some((l) => !isDone(c.id, l.id))) || ALL_COURSES[0];
  const nextLesson = nextCourse.lessons.find((l) => !isDone(nextCourse.id, l.id)) || nextCourse.lessons[0];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-theme-900 text-white">
        <ContourLines className="absolute inset-0 w-full h-full text-theme-300 pointer-events-none opacity-60" />
        <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-theme-600/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 pt-14 pb-16 grid lg:grid-cols-[1fr_360px] gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] text-theme-100">
              <GraduationCap size={14} /> MapNiti Academy · free, no sign-up needed
            </span>
            <h1 className="font-display text-4xl md:text-[54px] leading-[1.05] font-semibold mt-5 tracking-tight">
              Learn GIS the way<br /><span className="text-pop-400">engineers</span> use it.
            </h1>
            <p className="text-theme-200 mt-5 max-w-xl text-[15px] leading-relaxed">
              Step-by-step courses on QGIS, remote sensing, Python, Earth Engine, hydrology and surveying, with Nepal examples and code you can run in your browser.
            </p>
            <div className="mt-7 relative max-w-xl">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses and lessons, e.g. NDVI, GeoPandas, cut-fill"
                className="w-full rounded-2xl bg-white text-slate-800 placeholder:text-slate-400 pl-11 pr-10 py-3.5 text-sm shadow-lg shadow-black/20 outline-none focus:ring-4 focus:ring-pop-400/40" />
              {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search"><X size={16} /></button>}
            </div>
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
              {[[ALL_COURSES.length, 'courses'], [totalLessons, 'lessons'], [`${Math.round(totalMin / 60)} h`, 'of material'], ['3', 'tracks']].map(([v, l]) => (
                <div key={l} className="flex items-baseline gap-1.5">
                  <dt className="font-display text-2xl font-semibold">{v}</dt><dd className="text-[13px] text-theme-300">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-6">
            <div className="flex items-center gap-5">
              <div className="relative text-white">
                <ProgressRing pct={pct} />
                <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-semibold">{pct}%</span>
              </div>
              <div>
                <p className="text-[12px] uppercase tracking-widest text-theme-300">Your progress</p>
                <p className="font-display text-xl font-semibold mt-0.5">{doneLessons} / {totalLessons} lessons</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-white/[0.07] p-4">
              <p className="text-[11px] uppercase tracking-widest text-theme-300">{doneLessons ? 'Continue with' : 'Start here'}</p>
              <p className="font-semibold mt-1 leading-snug">{nextLesson.title}</p>
              <p className="text-[12px] text-theme-300 mt-0.5">Course {pad(ALL_COURSES.indexOf(nextCourse) + 1)} · {nextCourse.title}</p>
              <Link to={`/learn/${nextCourse.id}?lesson=${nextLesson.id}`}
                className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-pop-500 hover:bg-pop-600 text-white text-sm font-semibold py-2.5 transition">
                <PlayCircle size={16} /> {doneLessons ? 'Resume' : 'Start learning'}
              </Link>
            </div>
            {!loggedIn && <p className="text-[11.5px] text-theme-300 mt-4">Saved in this browser. <Link to="/login" className="underline text-white">Log in</Link> to keep it on every device.</p>}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-14 space-y-16">
        {!q && <Roadmap isDone={isDone} />}

        <section>
          <SectionHead eyebrow="All courses" title={q ? `Results for “${query.trim()}”` : 'Browse by track'}
            text={q ? `${list.length} course${list.length === 1 ? '' : 's'} found.` : 'Three tracks: the science of GIS, programming for maps, and engineering applications.'} />

          <div className="mt-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200">
            <div className="flex gap-1 overflow-x-auto -mb-px">
              {[{ id: 'all' }, ...TRACKS].map((t) => {
                const count = t.id === 'all' ? ALL_COURSES.length : ALL_COURSES.filter((c) => c.track === t.id).length;
                const active = track === t.id;
                return (
                  <button key={t.id} onClick={() => setTrack(t.id)}
                    className={`whitespace-nowrap px-4 py-3 text-sm font-semibold border-b-2 transition ${active ? 'border-pop-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    {t.id === 'all' ? 'All tracks' : t.id}
                    <span className={`ml-2 text-[11px] rounded-full px-1.5 py-0.5 ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1 pb-2 lg:pb-0">
              {['all', ...LEVELS].map((l) => (
                <button key={l} onClick={() => setLevel(l)}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-lg transition ${level === l ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                  {l === 'all' ? 'Any level' : l}
                </button>
              ))}
            </div>
          </div>

          {TRACKS.filter((t) => list.some((c) => c.track === t.id)).map((t) => {
            const L = TRACK_LOOK[t.id];
            const TIcon = L.icon;
            return (
              <div key={t.id} className="mt-10">
                <div className="flex items-center gap-3 mb-5">
                  <span className={`h-10 w-10 rounded-xl ${L.cover} text-white flex items-center justify-center`}><TIcon size={19} /></span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-slate-900">{t.id}</h3>
                    <p className="text-[13px] text-slate-500">{t.desc}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {list.filter((c) => c.track === t.id).map((c) => (
                    <CourseCard key={c.id} course={c} index={ALL_COURSES.indexOf(c)} done={c.lessons.filter((l) => isDone(c.id, l.id)).length} />
                  ))}
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <div className="mt-10 text-center py-16 rounded-2xl border border-dashed border-slate-300">
              <p className="font-semibold text-slate-700">No course matches.</p>
              <button onClick={() => { setQuery(''); setTrack('all'); setLevel('all'); }} className="mt-2 text-sm text-theme-700 underline">Clear filters</button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

// ---- Course reader ---------------------------------------------------------------
function CourseReader({ course, isDone, toggle }) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(() => {
    const want = new URLSearchParams(window.location.search).get('lesson');
    return Math.max(0, course.lessons.findIndex((l) => l.id === want));
  });
  useEffect(() => { window.scrollTo(0, 0); }, [idx]);

  const L = look(course);
  const Icon = COURSE_ICON[course.id] || L.icon;
  const lesson = course.lessons[idx];
  const pos = ALL_COURSES.findIndex((c) => c.id === course.id);
  const nextCourse = ALL_COURSES[pos + 1];
  const done = course.lessons.filter((l) => isDone(course.id, l.id)).length;
  const pct = Math.round((done / course.lessons.length) * 100);
  const outline = lessonOutline(lesson.body);
  const prev = course.lessons[idx - 1];
  const next = course.lessons[idx + 1];

  return (
    <>
      <section className={`relative overflow-hidden ${L.cover} text-white`}>
        <TopoRings seed={pos + 2} className="opacity-20" />
        <div className="relative max-w-7xl mx-auto px-6 pt-8 pb-10">
          <nav className="flex items-center gap-2 text-[13px] text-white/70">
            <Link to="/learn" className="flex items-center gap-1 hover:text-white"><ArrowLeft size={14} /> All courses</Link>
            <span>/</span><span>{course.track}</span>
          </nav>
          <div className="mt-6 flex flex-col md:flex-row md:items-end gap-6 justify-between">
            <div className="flex gap-5 items-start">
              <div className="hidden sm:flex h-16 w-16 shrink-0 rounded-2xl bg-white/10 ring-1 ring-white/25 items-center justify-center">
                <Icon size={30} strokeWidth={1.6} />
              </div>
              <div>
                <p className="font-mono text-[11px] tracking-[0.2em] text-white/60">COURSE {pad(pos + 1)} OF {ALL_COURSES.length}</p>
                <h1 className="font-display text-3xl md:text-[40px] leading-tight font-semibold mt-1">{course.title}</h1>
                <p className="text-white/75 mt-2 max-w-2xl text-[15px]">{course.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/80">
                  <LevelDots level={course.level} light />
                  <span className="flex items-center gap-1.5"><BookOpen size={14} /> {course.lessons.length} lessons</span>
                  <span className="flex items-center gap-1.5"><Clock size={14} /> {fmtTime(minutesOf(course))}</span>
                </div>
              </div>
            </div>
            <div className="md:w-64 shrink-0">
              <div className="flex justify-between text-[12px] text-white/75 mb-1.5"><span>{done} of {course.lessons.length} done</span><span>{pct}%</span></div>
              <div className="h-2 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-pop-400 transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8">
        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Course content</p>
            <ol className="relative mt-3 before:absolute before:left-[21px] before:top-4 before:bottom-4 before:w-px before:bg-slate-200">
              {course.lessons.map((l, i) => {
                const fin = isDone(course.id, l.id);
                const cur = i === idx;
                return (
                  <li key={l.id}>
                    <button onClick={() => setIdx(i)}
                      className={`relative w-full flex items-start gap-3 text-left rounded-xl px-2 py-2.5 transition ${cur ? L.soft : 'hover:bg-slate-50'}`}>
                      <span className={`relative z-10 mt-0.5 h-[26px] w-[26px] shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold
                        ${fin ? 'bg-emerald-500 text-white' : cur ? `${L.dot} text-white` : 'bg-white border border-slate-300 text-slate-500'}`}>
                        {fin ? <Check size={13} /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[13.5px] leading-snug ${cur ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{l.title}</span>
                        <span className="block text-[11.5px] text-slate-400 mt-0.5">{l.minutes} min</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {course.outcomes.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><Target size={13} /> You will be able to</p>
              <ul className="mt-3 space-y-2">
                {course.outcomes.map((o) => (
                  <li key={o} className="flex gap-2 text-[13px] leading-snug text-slate-600"><CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-px" />{o}</li>
                ))}
              </ul>
            </div>
          )}

          <Link to="/code-lab" className="group flex items-center gap-3 rounded-2xl bg-[#1e1e1e] text-white p-4 hover:bg-[#252526] transition">
            <span className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center"><Code2 size={18} className="text-[#4fc1ff]" /></span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Code Lab</span>
              <span className="block text-[12px] text-white/60">Run Python, JS, SQL & maps</span>
            </span>
            <ArrowRight size={16} className="text-white/50 group-hover:translate-x-1 transition" />
          </Link>
        </aside>

        <article className="min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 md:px-10 py-4 border-b border-slate-100 bg-slate-50/60">
              <p className="text-[13px] text-slate-500 flex items-center gap-2">
                <span className={`font-semibold ${L.text}`}>Lesson {idx + 1} of {course.lessons.length}</span>
                <span className="text-slate-300">•</span><Clock size={13} /> {lesson.minutes} min read
              </p>
              <button onClick={() => toggle(course.id, lesson.id)}
                className={`flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-lg transition ${isDone(course.id, lesson.id) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}>
                <CheckCircle2 size={15} /> {isDone(course.id, lesson.id) ? 'Completed' : 'Mark complete'}
              </button>
            </div>

            <div className="px-6 md:px-10 py-8">
              {outline.length > 1 && (
                <div className="mb-2 rounded-xl border border-slate-200 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><ListChecks size={13} /> In this lesson</p>
                  <ol className="mt-2.5 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {outline.map((h, i) => (
                      <li key={h} className="flex gap-2 text-[13px] text-slate-600"><span className="font-mono text-[11px] text-pop-600 mt-px">{pad(i + 1)}</span>{h}</li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="prose-sm [&_p]:text-[15px] [&_p]:leading-7 [&_li]:text-[15px]
                [&_[data-h='1']]:font-display [&_[data-h='1']]:text-[28px] [&_[data-h='1']]:leading-tight [&_[data-h='1']]:font-semibold [&_[data-h='1']]:text-slate-900 [&_[data-h='1']]:mt-6 [&_[data-h='1']]:mb-3
                [&_[data-h='2']]:font-display [&_[data-h='2']]:text-[20px] [&_[data-h='2']]:leading-snug [&_[data-h='2']]:font-semibold [&_[data-h='2']]:text-slate-900 [&_[data-h='2']]:mt-10 [&_[data-h='2']]:mb-2 [&_[data-h='2']]:pt-6 [&_[data-h='2']]:border-t [&_[data-h='2']]:border-slate-100
                [&_[data-h='3']]:text-[16px] [&_[data-h='3']]:font-bold [&_[data-h='3']]:mt-6">
                <Markdown text={lesson.body} onRunCode={(lang, code) => openInCodeLab(navigate, lang, code)} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            {prev ? (
              <button onClick={() => setIdx(idx - 1)} className="group text-left rounded-2xl border border-slate-200/80 bg-white p-5 hover:border-slate-300 hover:shadow-md transition">
                <span className="text-[12px] text-slate-400 flex items-center gap-1"><ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition" /> Previous</span>
                <span className="block mt-1 font-semibold text-slate-800 leading-snug">{prev.title}</span>
              </button>
            ) : <span className="hidden sm:block" />}
            {next ? (
              <button onClick={() => { toggle(course.id, lesson.id, true); setIdx(idx + 1); }}
                className={`group text-right rounded-2xl ${L.cover} text-white p-5 hover:shadow-lg transition`}>
                <span className="text-[12px] text-white/70 flex items-center justify-end gap-1">Complete & next <ArrowRight size={13} className="group-hover:translate-x-0.5 transition" /></span>
                <span className="block mt-1 font-semibold leading-snug">{next.title}</span>
              </button>
            ) : nextCourse ? (
              <button onClick={() => { toggle(course.id, lesson.id, true); navigate(`/learn/${nextCourse.id}`); }}
                className="group text-right rounded-2xl bg-pop-500 hover:bg-pop-600 text-white p-5 hover:shadow-lg transition">
                <span className="text-[12px] text-white/80 flex items-center justify-end gap-1">Finish course · next is course {pad(pos + 2)} <ArrowRight size={13} /></span>
                <span className="block mt-1 font-semibold leading-snug">{nextCourse.title}</span>
              </button>
            ) : (
              <button onClick={() => toggle(course.id, lesson.id, true)} className="rounded-2xl bg-emerald-600 text-white p-5 font-semibold">Mark course complete</button>
            )}
          </div>
        </article>
      </div>
    </>
  );
}

export default function LearnPage() {
  const { courseId } = useParams();
  const { isDone, toggle, loggedIn } = useProgress();
  const course = useMemo(() => (courseId ? courseById(courseId) : null), [courseId]);

  return (
    <div className="bg-[#f6f7f9] min-h-screen">
      {course
        ? <CourseReader key={course.id} course={course} isDone={isDone} toggle={toggle} />
        : <Catalog isDone={isDone} loggedIn={loggedIn} />}
    </div>
  );
}
