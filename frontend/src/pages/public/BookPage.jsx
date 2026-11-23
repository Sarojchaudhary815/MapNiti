import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Play, Loader2, Copy, Check, RotateCcw, Code2, Monitor, Menu, Sun, Moon, Search, ArrowLeft, ArrowRight,
  ListTree, PlayCircle, Power, Terminal, Clock, BookOpenText,
} from 'lucide-react';
import CodeEditor from '../../components/common/CodeEditor';
import { inline } from '../../components/common/Markdown';
import { highlight } from '../../components/common/highlight';
import { BOOK, BOOK_TITLE, BOOK_SUBTITLE, CHAPTERS, chapterById } from '../../features/book/bookIndex';
import { getPyodide, newNamespace, runCell, cleanPythonError } from '../../features/learn/pyRunner';
import { openInCodeLab } from './LearnPage';
import '../../features/book/book.css';

const THEME_KEY = 'mapniti_book_theme';
const VISITED_KEY = 'mapniti_book_visited';
const NAV_H = 64; // sticky site navbar

const slug = (s) => s.toLowerCase().replace(/[`*]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ---- Markdown → blocks ---------------------------------------------------------
// Like the site's Markdown renderer, plus: heading ids, callouts, and code cells
// (an ```output fence right after a code fence is that cell's recorded output).
function parseBook(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks = [];
  let i = 0;
  const isList = (l) => /^\s*([-*]|\d+\.)\s+/.test(l);
  const isTable = (l) => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```([\w-]*)/);
    if (fence) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i += 1;
      const lang = fence[1] || 'text';
      const code = buf.join('\n');
      const prev = blocks[blocks.length - 1];
      if (lang === 'output' && prev?.type === 'code') prev.output = code;
      else blocks.push({ type: 'code', lang, code });
      continue;
    }
    const h = line.match(/^(#{2,3})\s+(.*)/);
    if (h) { blocks.push({ type: `h${h[1].length}`, text: h[2], id: slug(h[2]) }); i += 1; continue; }
    if (isTable(line)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().slice(1, -1).split('|').map((c) => c.trim()));
        i += 1;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }
    if (isList(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && isList(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      const m = buf[0].match(/^\*\*(Note|Tip|Warning|Further reading|Try it|Remember):?\*\*:?\s*/i);
      const kind = m ? m[1].toLowerCase() : 'note';
      const variant = kind === 'warning' ? 'warning' : (kind === 'tip' || kind === 'try it') ? 'tip' : 'note';
      if (m) buf[0] = buf[0].slice(m[0].length);
      blocks.push({ type: 'callout', variant, title: m ? m[1] : 'Note', text: buf.join(' ') });
      continue;
    }
    if (line.trim() === '') { i += 1; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(```|#{2,3}\s|>|\s*\|)/.test(lines[i]) && !isList(lines[i])) para.push(lines[i++]);
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

// ---- Output area -------------------------------------------------------------------
function Output({ items, recorded }) {
  if (!items.length) return null;
  return (
    <div className="bk-out border-t px-4 py-3 space-y-2 overflow-x-auto bk-scroll">
      {recorded && <p className="text-[10.5px] font-semibold uppercase tracking-widest bk-muted">Output from a desktop run</p>}
      {items.map((o, i) => {
        if (o.kind === 'img') return <img key={i} src={`data:image/png;base64,${o.text}`} alt="Figure output" className="max-w-full rounded-md bg-white" />;
        // pandas' own HTML table (escaped by pandas) for the learner's own data.
        if (o.kind === 'html') return <div key={i} className="bk-df overflow-x-auto" dangerouslySetInnerHTML={{ __html: o.text }} />;
        const color = o.kind === 'err' ? 'text-red-500' : o.kind === 'info' ? 'bk-muted italic text-[12px]' : '';
        return <pre key={i} className={`font-mono text-[13px] leading-[1.6] whitespace-pre-wrap m-0 ${color}`}>{o.text}</pre>;
      })}
    </div>
  );
}

// ---- One code cell --------------------------------------------------------------------
const RUNNABLE = ['python', 'python-error'];
const LANG_LABEL = { python: 'Python', 'python-desktop': 'Python · Desktop', pyqgis: 'QGIS Python Console', bash: 'Terminal', text: 'Text' };

function Cell({ block, index, notebook, epoch }) {
  const navigate = useNavigate();
  const [code, setCode] = useState(block.code);
  const [outputs, setOutputs] = useState(block.output ? [{ kind: 'out', text: block.output }] : []);
  const [status, setStatus] = useState('idle');
  const [count, setCount] = useState(null);
  const [copied, setCopied] = useState(false);
  const runnable = RUNNABLE.includes(block.lang);
  const desktop = block.lang === 'python-desktop';
  const expectError = block.lang === 'python-error';
  const editable = runnable || desktop;

  useEffect(() => { if (epoch) { setOutputs(block.output ? [{ kind: 'out', text: block.output }] : []); setCount(null); setStatus('idle'); } }, [epoch, block.output]);

  const run = useCallback(async () => {
    if (!runnable) return true;
    setStatus('running');
    const got = [];
    const push = (kind, text) => {
      const last = got[got.length - 1];
      if (last && last.kind === kind && (kind === 'out' || kind === 'err')) last.text += `\n${text}`;
      else got.push({ kind, text });
      setOutputs([...got]);
    };
    setOutputs([]);
    let ok = true;
    try {
      const ns = await notebook.getNamespace();
      await runCell(code, ns, push);
      if (expectError) push('info', 'It works now. (The original version of this cell fails on purpose.)');
      if (!got.length) push('info', 'Done (no output).');
    } catch (e) {
      ok = false;
      push('err', cleanPythonError(e.message || e));
      if (expectError) { push('info', 'This error is expected: it is the point of this example.'); ok = true; }
    }
    setCount(notebook.nextCount());
    setStatus(ok ? 'done' : 'error');
    return ok;
  }, [code, notebook, runnable, expectError]);

  useEffect(() => notebook.register(index, { run, getCode: () => code, runnable, inLab: runnable && !expectError }), [notebook, index, run, code, runnable, expectError]);

  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const toLab = () => openInCodeLab(navigate, 'python', notebook.codeUpTo(index));

  if (!editable) {
    return (
      <div className="bk-cell bk-cell-static">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] text-[11px] text-[#cccccc]">
          <span className="flex items-center gap-1.5 font-semibold">{block.lang === 'bash' ? <Terminal size={12} /> : <Code2 size={12} />}{LANG_LABEL[block.lang] || block.lang}</span>
          <button onClick={copy} className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <pre className="code-hl m-0 px-4 py-3.5 overflow-x-auto text-[13.5px] leading-[21px] font-mono bg-[#1e1e1e] bk-scroll">
          <code dangerouslySetInnerHTML={{ __html: highlight(code, block.lang === 'pyqgis' ? 'python' : block.lang) }} />
        </pre>
      </div>
    );
  }

  return (
    <div className={`bk-cell ${desktop ? 'bk-cell-desktop' : ''}`}>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#252526] text-[11px] text-[#cccccc]">
        <span className="flex items-center gap-2 font-semibold min-w-0">
          <span className="font-mono text-[#858585]">[{status === 'running' ? '*' : (count ?? ' ')}]</span>
          {desktop
            ? <span className="flex items-center gap-1 text-[#c4b5fd]"><Monitor size={12} /> Desktop · your computer, Colab or QGIS</span>
            : expectError
              ? <span className="text-[#f0a35e]">Python · fails on purpose</span>
              : <span className="text-[#89d185]">Python</span>}
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          {code !== block.code && (
            <button onClick={() => setCode(block.code)} title="Undo my edits" className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"><RotateCcw size={12} /> Reset</button>
          )}
          <button onClick={copy} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10">{copied ? <Check size={12} /> : <Copy size={12} />}<span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span></button>
          {runnable && (
            <>
              <button onClick={toLab} title="Open this cell and the ones above it in the Code Lab" className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"><Code2 size={12} /><span className="hidden sm:inline">Code Lab</span></button>
              <button onClick={run} disabled={status === 'running'}
                className="ml-1 flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2ea043] hover:bg-[#3fb950] disabled:opacity-60 text-white font-semibold">
                {status === 'running' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Run
              </button>
            </>
          )}
        </span>
      </div>
      <CodeEditor value={code} onChange={setCode} lang="python" minHeight={0} maxHeight={520}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.shiftKey && runnable) { e.preventDefault(); run(); } }} />
      <Output items={outputs} recorded={desktop && outputs.length > 0} />
    </div>
  );
}

// ---- Notebook state per chapter ----------------------------------------------------------
function useNotebook(chapterId) {
  const cells = useRef(new Map());
  const nsRef = useRef(null);
  const counter = useRef(0);
  const [kernel, setKernel] = useState('idle'); // idle | loading | ready
  const [epoch, setEpoch] = useState(0);

  useEffect(() => { nsRef.current = null; counter.current = 0; cells.current = new Map(); }, [chapterId]);

  const notebook = useMemo(() => ({
    register(i, api) { cells.current.set(i, api); return () => cells.current.delete(i); },
    async getNamespace() {
      if (!nsRef.current) {
        setKernel('loading');
        nsRef.current = getPyodide().then(() => newNamespace());
        nsRef.current.catch(() => { nsRef.current = null; setKernel('idle'); });
      }
      const ns = await nsRef.current;
      setKernel('ready');
      return ns;
    },
    nextCount() { counter.current += 1; return counter.current; },
    codeUpTo(i) {
      return [...cells.current.entries()].sort((a, b) => a[0] - b[0])
        .filter(([k, c]) => k === i || (k < i && c.inLab)).map(([, c]) => c.getCode()).join('\n\n');
    },
  }), []);

  const runAll = async () => {
    for (const [, c] of [...cells.current.entries()].sort((a, b) => a[0] - b[0])) {
      if (c.runnable && !(await c.run())) break; // stop at the first error, like Jupyter
    }
  };
  const restart = () => { nsRef.current = null; counter.current = 0; setKernel('idle'); setEpoch((e) => e + 1); };
  return { notebook, kernel, epoch, runAll, restart };
}

// ---- Page ------------------------------------------------------------------------------------
export default function BookPage() {
  const { chapterId } = useParams();
  const chapter = chapterById(chapterId) || CHAPTERS[0];
  const idx = CHAPTERS.indexOf(chapter);
  const [dark, setDark] = useState(() => { try { return localStorage.getItem(THEME_KEY) !== 'light'; } catch { return true; } });
  const [sideOpen, setSideOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [text, setText] = useState(null);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [visited, setVisited] = useState(() => { try { return JSON.parse(localStorage.getItem(VISITED_KEY)) || []; } catch { return []; } });
  const [running, setRunning] = useState(false);
  const { notebook, kernel, epoch, runAll, restart } = useNotebook(chapter.id);

  useEffect(() => { try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch { /* storage blocked */ } }, [dark]);

  useEffect(() => {
    let alive = true;
    setText(null); setError(null); setSideOpen(false);
    window.scrollTo(0, 0);
    fetch(`/book/${chapter.id}.md`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((t) => { if (alive) setText(t); })
      .catch(() => { if (alive) setError('This chapter could not be loaded. Check your connection and try again.'); });
    setVisited((v) => {
      const next = v.includes(chapter.id) ? v : [...v, chapter.id];
      try { localStorage.setItem(VISITED_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
    return () => { alive = false; };
  }, [chapter.id]);

  const blocks = useMemo(() => (text ? parseBook(text) : []), [text]);
  const toc = blocks.filter((b) => b.type === 'h2');
  const runnableCount = blocks.filter((b) => b.type === 'code' && RUNNABLE.includes(b.lang)).length;

  // Highlight the section being read in the right-hand "Contents".
  useEffect(() => {
    if (!toc.length) return undefined;
    const els = toc.map((t) => document.getElementById(t.id)).filter(Boolean);
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActiveId(vis[0].target.id);
    }, { rootMargin: `-${NAV_H + 40}px 0px -65% 0px` });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [toc]);

  const doRunAll = async () => { setRunning(true); try { await runAll(); } finally { setRunning(false); } };
  const q = filter.trim().toLowerCase();
  const prev = CHAPTERS[idx - 1];
  const next = CHAPTERS[idx + 1];
  let cellIndex = 0;

  const sidebar = (
    <div className="flex flex-col h-full">
      <Link to="/learn-programming" className="flex items-center gap-3 px-5 pt-6 pb-5">
        <span className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#3776ab] to-[#ffd43b] flex items-center justify-center shadow-sm">
          <Terminal size={20} className="text-white" />
        </span>
        <span>
          <span className="block font-display text-[17px] font-semibold bk-head leading-tight">{BOOK_TITLE}</span>
          <span className="block text-[12px] bk-muted">{BOOK_SUBTITLE}</span>
        </span>
      </Link>
      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 bk-muted" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a chapter"
            className="bk-input w-full rounded-lg pl-8 pr-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[color:var(--bk-accent)]" />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto bk-scroll px-3 pb-8">
        {BOOK.map((p, pi) => {
          const items = p.chapters.filter((c) => !q || c.title.toLowerCase().includes(q) || p.part.toLowerCase().includes(q));
          if (!items.length) return null;
          return (
            <div key={p.part} className="mt-4">
              <p className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] bk-muted">
                <span className="bk-accent mr-1.5">{String(pi + 1).padStart(2, '0')}</span>{p.part}
              </p>
              {items.map((c) => {
                const active = c.id === chapter.id;
                return (
                  <Link key={c.id} to={`/learn-programming/${c.id}`}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-[7px] text-[14px] transition ${active ? 'bk-active font-semibold' : 'bk-hover'}`}>
                    <span className="truncate">{c.title}</span>
                    {visited.includes(c.id) && !active && <Check size={13} className="shrink-0 bk-muted" />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="book min-h-screen" data-theme={dark ? 'dark' : 'light'}>
      <div className="flex">
        {/* Left: chapters */}
        <aside className="hidden lg:block w-[290px] shrink-0 border-r bk-side sticky self-start" style={{ top: NAV_H, height: `calc(100vh - ${NAV_H}px)` }}>
          {sidebar}
        </aside>
        {sideOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex" style={{ top: NAV_H }}>
            <div className="w-[290px] max-w-[85vw] h-full border-r bk-side shadow-2xl">{sidebar}</div>
            <button className="flex-1 bg-black/40" onClick={() => setSideOpen(false)} aria-label="Close chapters" />
          </div>
        )}

        {/* Middle: chapter */}
        <main className="flex-1 min-w-0">
          <div className="sticky z-30 border-b bk-border backdrop-blur" style={{ top: NAV_H, background: 'color-mix(in srgb, var(--bk-bg) 88%, transparent)' }}>
            <div className="flex items-center gap-1.5 px-4 md:px-8 h-12">
              <button onClick={() => setSideOpen(true)} className="lg:hidden p-2 rounded-lg bk-hover" aria-label="Chapters"><Menu size={18} /></button>
              <p className="hidden sm:block text-[13px] bk-muted truncate">{chapter.part}</p>
              <div className="flex-1" />
              <span className="hidden md:flex items-center gap-1.5 text-[12px] bk-muted mr-2" title="Python in your browser">
                <span className={`h-2 w-2 rounded-full ${kernel === 'ready' ? 'bg-emerald-500' : kernel === 'loading' ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'}`} />
                {kernel === 'ready' ? 'Python ready' : kernel === 'loading' ? 'Starting Python…' : 'Python idle'}
              </span>
              {runnableCount > 0 && (
                <>
                  <button onClick={doRunAll} disabled={running} className="bk-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium disabled:opacity-60">
                    {running ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}<span className="hidden sm:inline">Run all</span>
                  </button>
                  <button onClick={restart} title="Clear all variables and outputs" className="bk-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium">
                    <Power size={14} /><span className="hidden sm:inline">Restart</span>
                  </button>
                </>
              )}
              <Link to="/code-lab" className="bk-btn hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium"><Code2 size={14} /> Code Lab</Link>
              <button onClick={() => setDark((d) => !d)} className="p-2 rounded-lg bk-hover" aria-label="Switch light or dark">{dark ? <Sun size={17} /> : <Moon size={17} />}</button>
            </div>
          </div>

          <article className="max-w-[860px] mx-auto px-5 md:px-10 pt-10 pb-20">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] bk-accent">
              Part {chapter.partIndex + 1} · Chapter {idx + 1} of {CHAPTERS.length}
            </p>
            <h1 className="font-display text-[34px] md:text-[44px] leading-[1.1] font-semibold bk-head mt-2">{chapter.title}</h1>
            <div className="mt-3 mb-8 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] bk-muted">
              <span className="flex items-center gap-1.5"><Clock size={14} /> {chapter.minutes} min</span>
              {runnableCount > 0 && <span className="flex items-center gap-1.5"><Play size={13} /> {runnableCount} runnable cells</span>}
              <span className="flex items-center gap-1.5"><BookOpenText size={14} /> Shift + Enter runs a cell</span>
            </div>

            {error && <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-500">{error}</p>}
            {!text && !error && (
              <div className="space-y-3 animate-pulse">{[90, 75, 82, 40, 95].map((w) => <div key={w} className="h-4 rounded" style={{ width: `${w}%`, background: 'var(--bk-hover)' }} />)}</div>
            )}

            <div className="bk-content">
              {blocks.map((b, i) => {
                switch (b.type) {
                  case 'h2': return <h2 key={i} id={b.id}>{inline(b.text, `h${i}`)}</h2>;
                  case 'h3': return <h3 key={i} id={b.id}>{inline(b.text, `h${i}`)}</h3>;
                  case 'p': return <p key={i}>{inline(b.text, `p${i}`)}</p>;
                  case 'ul': return <ul key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}</ul>;
                  case 'ol': return <ol key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, `${i}-${j}`)}</li>)}</ol>;
                  case 'callout':
                    return (
                      <div key={i} className={`bk-callout bk-callout-${b.variant}`}>
                        <p className="bk-callout-title">{b.title}</p>
                        <p>{inline(b.text, `c${i}`)}</p>
                      </div>
                    );
                  case 'table': {
                    const [head, ...rows] = b.rows;
                    return (
                      <div key={i} className="overflow-x-auto bk-scroll">
                        <table>
                          <thead><tr>{head.map((c, j) => <th key={j}>{inline(c, `t${i}h${j}`)}</th>)}</tr></thead>
                          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, `t${i}-${ri}-${j}`)}</td>)}</tr>)}</tbody>
                        </table>
                      </div>
                    );
                  }
                  case 'code': {
                    const ci = cellIndex;
                    cellIndex += 1;
                    return <Cell key={`${chapter.id}-${ci}`} block={b} index={ci} notebook={notebook} epoch={epoch} />;
                  }
                  default: return null;
                }
              })}
            </div>

            {text && (
              <div className="mt-14 grid sm:grid-cols-2 gap-4">
                {prev ? (
                  <Link to={`/learn-programming/${prev.id}`} className="group bk-btn rounded-xl p-4">
                    <span className="text-[12px] bk-muted flex items-center gap-1"><ArrowLeft size={13} /> Previous</span>
                    <span className="block mt-1 font-semibold bk-head">{prev.title}</span>
                  </Link>
                ) : <span />}
                {next && (
                  <Link to={`/learn-programming/${next.id}`} className="group bk-btn rounded-xl p-4 text-right">
                    <span className="text-[12px] bk-muted flex items-center justify-end gap-1">Next <ArrowRight size={13} /></span>
                    <span className="block mt-1 font-semibold bk-accent">{next.title}</span>
                  </Link>
                )}
              </div>
            )}
          </article>
        </main>

        {/* Right: on this page */}
        <aside className="hidden xl:block w-[240px] shrink-0 sticky self-start" style={{ top: NAV_H + 48, height: `calc(100vh - ${NAV_H + 48}px)` }}>
          <div className="h-full overflow-y-auto bk-scroll border-l bk-border pl-5 pr-4 pt-10">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] bk-muted"><ListTree size={14} /> Contents</p>
            <ul className="mt-3 space-y-0.5">
              {toc.map((t) => (
                <li key={t.id}>
                  <a href={`#${t.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' }); }}
                    className={`block border-l-2 -ml-[22px] pl-[20px] py-1 text-[13px] leading-snug transition ${activeId === t.id ? 'border-[color:var(--bk-accent)] bk-accent font-medium' : 'border-transparent bk-muted hover:opacity-80'}`}>
                    {t.text.replace(/`/g, '')}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
