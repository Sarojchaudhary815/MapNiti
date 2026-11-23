import React, { useEffect, useRef, useState } from 'react';
import { Play, Loader2, RotateCcw, Copy, Check, Terminal, Lightbulb, MousePointerClick, BookOpen } from 'lucide-react';
import CodeEditor from '../../components/common/CodeEditor';
import { EXAMPLES, LEVEL_STYLE, groupByTopic, fixBlockedTiles } from './labExamples';
import { loadScript, runPython } from './pyRunner';

// In-browser code runner. Nothing executes on the MapNiti server:
//  * HTML    → live preview in a sandboxed iframe (Leaflet / MapLibre from CDN)
//  * Python  → Pyodide (CPython compiled to WebAssembly) with numpy, pandas,
//              shapely, pyproj, matplotlib loaded on demand
//  * JS      → a sandboxed iframe (no access to the app / token) with Turf.js
//  * SQL     → sql.js (SQLite in WebAssembly) seeded with sample GIS tables

const SQLJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
const TURF_URL = 'https://cdn.jsdelivr.net/npm/@turf/turf@7/turf.min.js';

const SQL_SEED = `
CREATE TABLE survey_points (id INTEGER PRIMARY KEY, name TEXT, type TEXT, easting REAL, northing REAL, rl REAL);
INSERT INTO survey_points VALUES
 (1,'BM1','BM',334500.000,3066800.000,1301.250),(2,'TP1','TP',334548.120,3066821.450,1303.804),
 (3,'TP2','TP',334601.335,3066840.020,1306.421),(4,'BM2','BM',334655.900,3066812.770,1308.115),
 (5,'TP3','TP',334702.410,3066790.300,1305.980),(6,'BM3','BM',334748.050,3066760.510,1302.600);
CREATE TABLE parcels (parcel_id TEXT, owner TEXT, ward INTEGER, area_m2 REAL, land_use TEXT);
INSERT INTO parcels VALUES
 ('P-101','Ram Shrestha',5,508.7,'Residential'),('P-102','Sita Gurung',5,1017.4,'Agriculture'),
 ('P-103','Hari Karki',6,254.4,'Residential'),('P-104','Gita Tamang',6,2034.9,'Agriculture'),
 ('P-105','Municipality',5,3200.0,'Public'),('P-106','Bikash Rai',7,762.9,'Commercial'),
 ('P-107','Maya Thapa',7,1271.8,'Residential');
CREATE TABLE rainfall (station TEXT, district TEXT, year INTEGER, month INTEGER, rain_mm REAL);
INSERT INTO rainfall VALUES
 ('Kathmandu Airport','Kathmandu',2023,5,120),('Kathmandu Airport','Kathmandu',2023,6,245),('Kathmandu Airport','Kathmandu',2023,7,380),
 ('Kathmandu Airport','Kathmandu',2023,8,352),('Kathmandu Airport','Kathmandu',2023,9,188),
 ('Pokhara Airport','Kaski',2023,5,260),('Pokhara Airport','Kaski',2023,6,640),('Pokhara Airport','Kaski',2023,7,905),
 ('Pokhara Airport','Kaski',2023,8,770),('Pokhara Airport','Kaski',2023,9,495),
 ('Biratnagar','Morang',2023,5,150),('Biratnagar','Morang',2023,6,330),('Biratnagar','Morang',2023,7,520),
 ('Biratnagar','Morang',2023,8,410),('Biratnagar','Morang',2023,9,300);
`;

let sqlPromise = null;
function getSqlDb() {
  if (!sqlPromise) {
    sqlPromise = loadScript(`${SQLJS_URL}sql-wasm.js`)
      .then(() => window.initSqlJs({ locateFile: (f) => `${SQLJS_URL}${f}` }))
      .catch((e) => {
        sqlPromise = null;
        throw e;
      });
  }
  return sqlPromise.then((SQL) => {
    const db = new SQL.Database();
    db.run(SQL_SEED);
    return db;
  });
}

function runJavaScript(code, log) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.display = 'none';
    const done = () => {
      window.removeEventListener('message', onMsg);
      iframe.remove();
      resolve();
    };
    const timer = setTimeout(() => {
      log('err', 'Stopped after 10 s (infinite loop?).');
      done();
    }, 10000);
    function onMsg(e) {
      if (e.source !== iframe.contentWindow) return;
      const { kind, text } = e.data || {};
      if (kind === 'done') {
        clearTimeout(timer);
        done();
      } else if (kind) log(kind, text);
    }
    window.addEventListener('message', onMsg);
    const userCode = JSON.stringify(code);
    iframe.srcdoc = `<!doctype html><script src="${TURF_URL}"></script><script>
      const send = (kind, args) => parent.postMessage({ kind, text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') }, '*');
      console.log = (...a) => send('out', a); console.info = console.log;
      console.warn = (...a) => send('info', a); console.error = (...a) => send('err', a);
      (async () => {
        try { await (new Function('return (async () => {' + ${userCode} + '\\n})()'))(); }
        catch (e) { send('err', [e.name + ': ' + e.message]); }
        parent.postMessage({ kind: 'done' }, '*');
      })();
    </script>`;
    document.body.appendChild(iframe);
  });
}

async function runSql(code, log) {
  const db = await getSqlDb();
  try {
    const results = db.exec(code);
    if (!results.length) log('out', 'Query OK — no rows returned.');
    results.forEach((r) => log('table', r));
  } finally {
    db.close();
  }
}

function runHtml(code, log) {
  const { html, changed } = fixBlockedTiles(code);
  if (changed) {
    log('info', 'OpenStreetMap\'s tile servers block embedded previews, so this preview shows Esri street tiles instead. Your code was not changed.');
  }
  log('html', html);
  return Promise.resolve();
}

// Injected at the top of every HTML preview so console output and errors
// show up in the lab's output panel.
const HTML_BRIDGE = `<script>
(function () {
  var send = function (kind, args) {
    try { parent.postMessage({ mapnitiLab: true, kind: kind, text: Array.prototype.map.call(args, function (a) {
      return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ') }, '*'); } catch (e) {}
  };
  console.log = function () { send('out', arguments); };
  console.info = console.log;
  console.warn = function () { send('info', arguments); };
  console.error = function () { send('err', arguments); };
  window.addEventListener('error', function (e) { send('err', [e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '')]); });
})();
</script>`;

function HtmlPreview({ code }) {
  const ref = useRef(null);
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    const onMsg = (e) => {
      if (e.source !== ref.current?.contentWindow || !e.data?.mapnitiLab) return;
      setLogs((l) => [...l, e.data]);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const doc = /<head[^>]*>/i.test(code) ? code.replace(/<head[^>]*>/i, (m) => `${m}${HTML_BRIDGE}`) : HTML_BRIDGE + code;
  return (
    <div className="space-y-1">
      <iframe ref={ref} title="HTML preview" sandbox="allow-scripts" srcDoc={doc}
        className="w-full h-[420px] rounded-xl border border-slate-200 bg-white" />
      {logs.map((l, i) => (
        <pre key={i} className={`text-[12px] font-mono whitespace-pre-wrap ${l.kind === 'err' ? 'text-red-600' : l.kind === 'info' ? 'text-slate-400' : 'text-slate-800'}`}>{l.text}</pre>
      ))}
    </div>
  );
}

const LANGS = [
  { id: 'html', label: 'HTML / Web map', note: 'HTML · CSS · JS · Leaflet · MapLibre' },
  { id: 'python', label: 'Python', note: 'numpy · pandas · shapely · pyproj · matplotlib · scikit-learn' },
  { id: 'javascript', label: 'JavaScript', note: 'Turf.js geospatial library' },
  { id: 'sql', label: 'SQL', note: 'SQLite · tables: survey_points, parcels, rainfall' },
];

// AI answers and lessons often use libraries that need a server or an account
// (Earth Engine, GDAL…). Explain that instead of leaving a bare traceback.
function missingLibraryHint(text) {
  const py = text.match(/ModuleNotFoundError: No module named '([^']+)'/);
  if (py) {
    return py[1] === 'ee' || py[1] === 'geemap'
      ? 'Earth Engine code cannot run here because it needs your Google account. Run it in Google Colab, or use the JavaScript version at code.earthengine.google.com.'
      : `The library "${py[1]}" is not available in this browser Python. Run this code in Google Colab or on your own computer.`;
  }
  if (/\bee is not defined/.test(text)) {
    return 'This is Earth Engine code. Paste it at code.earthengine.google.com to run it. It cannot run here.';
  }
  return null;
}

const normalizeLang = (lang) => {
  const l = (lang || '').toLowerCase();
  if (l === 'py') return 'python';
  if (l === 'js') return 'javascript';
  if (l === 'htm') return 'html';
  return LANGS.some((x) => x.id === l) ? l : 'python';
};

export default function CodeLab({ seed }) {
  const startLang = normalizeLang(seed?.lang);
  const [lang, setLang] = useState(startLang);
  const [exIndex, setExIndex] = useState(seed?.code ? null : 0);
  const [code, setCode] = useState(seed?.code || EXAMPLES[startLang][0].code);
  const [output, setOutput] = useState([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    if (seed?.code) {
      setLang(normalizeLang(seed.lang));
      setCode(seed.code);
      setExIndex(null);
      setOutput([]);
    }
  }, [seed]);

  const pickExample = (l, i) => {
    setLang(l);
    setExIndex(i);
    setCode(EXAMPLES[l][i].code);
    setOutput([]);
  };

  const example = exIndex !== null ? EXAMPLES[lang][exIndex] : null;

  const run = async () => {
    setRunning(true);
    setOutput([]);
    const log = (kind, text) => {
      setOutput((o) => [...o, { kind, text }]);
      const hint = kind === 'err' && missingLibraryHint(String(text));
      if (hint) setOutput((o) => [...o, { kind: 'hint', text: hint }]);
    };
    const t0 = performance.now();
    try {
      if (lang === 'python') {
        log('info', 'Starting Python (the first run downloads ~10 MB, then it is cached)…');
        await runPython(code, log);
      } else if (lang === 'javascript') await runJavaScript(code, log);
      else if (lang === 'html') await runHtml(code, log);
      else await runSql(code, log);
      log('info', `Finished in ${((performance.now() - t0) / 1000).toFixed(2)} s`);
    } catch (err) {
      const msg = String(err.message || err);
      log('err', msg.includes('Traceback') ? msg.slice(msg.indexOf('Traceback')) : msg);
    } finally {
      setRunning(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = textRef.current;
      const { selectionStart: s, selectionEnd: en } = el;
      const next = `${code.slice(0, s)}    ${code.slice(en)}`;
      setCode(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      run();
    }
  };

  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reset = () => {
    setCode(example ? example.code : EXAMPLES[lang][0].code);
    setOutput([]);
  };

  const current = LANGS.find((l) => l.id === lang);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 h-full">
      <aside className="space-y-4 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto lg:sticky lg:top-4 pr-1">
        <a href="/learn-programming"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#0d1117] text-white hover:bg-[#161b22] transition-colors">
          <BookOpen size={18} className="text-[#3fb950] shrink-0" />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-bold">Learn Programming</span>
            <span className="block text-[10px] text-slate-400 leading-tight">Step-by-step Python book, every cell explained</span>
          </span>
        </a>
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-1">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => pickExample(l.id, 0)}
              className={`text-left px-3 py-2 rounded-xl text-[13px] font-bold ${lang === l.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-100 hover:border-slate-300'}`}>
              {l.label}
              <span className={`block text-[10px] font-normal ${lang === l.id ? 'text-slate-300' : 'text-slate-400'}`}>{EXAMPLES[l.id].length} examples</span>
            </button>
          ))}
        </div>

        {groupByTopic(EXAMPLES[lang]).map((g) => (
          <div key={g.topic}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{g.topic}</p>
            <div className="space-y-1">
              {g.items.map((ex) => (
                <button key={ex.title} onClick={() => pickExample(lang, ex.index)}
                  className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${exIndex === ex.index ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-slate-100 hover:border-emerald-300'}`}>
                  <span className="block text-[12.5px] font-semibold text-slate-700 leading-snug">{ex.title}</span>
                  <span className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${LEVEL_STYLE[ex.level]}`}>{ex.level}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <div className="flex flex-col gap-3 min-w-0">
        {example ? (
          <div className="rounded-2xl bg-white border border-slate-100 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${LEVEL_STYLE[example.level]}`}>{example.level}</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{example.topic}</span>
            </div>
            <h2 className="text-lg font-black text-slate-800 mt-1">{example.title}</h2>
            <p className="text-sm text-slate-600">{example.what}</p>
            <p className="mt-2 text-[13px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex gap-2">
              <Lightbulb size={16} className="shrink-0 mt-0.5" /><span><b>Try this:</b> {example.tip}</span>
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-slate-100 p-4 text-sm text-slate-600 flex gap-2">
            <MousePointerClick size={16} className="shrink-0 mt-0.5 text-emerald-600" />
            <span>Code sent from a lesson or the AI. Edit it, then press <b>Run</b>. Pick an example on the left to start over.</span>
          </div>
        )}

        <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#1e1e1e] flex flex-col">
          <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#252526] text-[11px] text-slate-300 border-b border-black/40">
            <span className="font-bold uppercase tracking-wider truncate">{current.label} <span className="normal-case font-normal text-slate-400 hidden sm:inline">· {current.note}</span></span>
            <div className="flex gap-1 shrink-0">
              <button onClick={copy} title="Copy code" className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10">{copied ? <Check size={12} /> : <Copy size={12} />}</button>
              <button onClick={reset} title="Undo my changes" className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10"><RotateCcw size={12} /></button>
              <button onClick={run} disabled={running} className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold">
                {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Run <span className="opacity-60 font-normal hidden sm:inline">Ctrl+↵</span>
              </button>
            </div>
          </div>
          <CodeEditor ref={textRef} value={code} onChange={setCode} onKeyDown={onKeyDown} lang={lang} />
          <p className="px-3 py-1.5 text-[10.5px] text-slate-500 bg-[#252526] border-t border-black/40">
            Click anywhere in the code to edit it. Coloured values such as <span className="text-[#ce9178]">"text"</span> and <span className="text-[#b5cea8]">numbers</span> are the easiest things to change.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white min-h-[160px]">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b text-[10px] font-black uppercase tracking-widest text-slate-400">
            <Terminal size={12} /> Output
          </div>
          <div className="p-3 space-y-1 overflow-x-auto">
            {output.length === 0 && <p className="text-[12px] text-slate-400">Press Run to execute. Code runs in your browser, so it is safe to experiment.</p>}
            {output.map((o, i) => {
              if (o.kind === 'hint') return <p key={i} className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2">{o.text}</p>;
              if (o.kind === 'html') return <HtmlPreview key={`${i}-${o.text.length}`} code={o.text} />;
              if (o.kind === 'img') return <img key={i} src={`data:image/png;base64,${o.text}`} alt="plot" className="max-w-full rounded-lg border" />;
              if (o.kind === 'table') {
                return (
                  <table key={i} className="text-[11px] border border-slate-200 my-1">
                    <thead className="bg-slate-50"><tr>{o.text.columns.map((c) => <th key={c} className="px-2 py-1 text-left font-bold border-b">{c}</th>)}</tr></thead>
                    <tbody>{o.text.values.map((row, r) => <tr key={r} className="border-b border-slate-50">{row.map((v, c) => <td key={c} className="px-2 py-1 font-mono">{v === null ? 'NULL' : String(v)}</td>)}</tr>)}</tbody>
                  </table>
                );
              }
              const color = o.kind === 'err' ? 'text-red-600' : o.kind === 'info' ? 'text-slate-400' : 'text-slate-800';
              return <pre key={i} className={`text-[12px] font-mono whitespace-pre-wrap ${color}`}>{o.text}</pre>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
