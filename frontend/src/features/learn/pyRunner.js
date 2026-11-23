// Shared in-browser Python (Pyodide) used by the Code Lab and the
// "Learn Programming" book. One Pyodide instance per page load.

export const PYODIDE_VERSION = '0.26.4';
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src} — check your internet connection.`));
    document.head.appendChild(s);
  });
}

let pyodidePromise = null;
export function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadScript(`${PYODIDE_URL}pyodide.js`)
      .then(() => window.loadPyodide({ indexURL: PYODIDE_URL }))
      .catch((e) => {
        pyodidePromise = null;
        throw e;
      });
  }
  return pyodidePromise;
}

// Library deprecation notices (e.g. pandas → pyarrow) print in red and look
// like errors to beginners; they are not about the user's code, so hide them.
export const PY_PRELUDE = `import os, sys, warnings
os.environ["MPLBACKEND"] = "AGG"
warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
`;
export const PY_FIGURES = `
_mapniti_imgs = []
if "matplotlib.pyplot" in sys.modules:
    import io, base64
    import matplotlib.pyplot as _plt
    for _n in _plt.get_fignums():
        _buf = io.BytesIO()
        _plt.figure(_n).savefig(_buf, format="png", dpi=90, bbox_inches="tight")
        _mapniti_imgs.append(base64.b64encode(_buf.getvalue()).decode())
    _plt.close("all")
_mapniti_imgs
`;

// Code Lab: one script, fresh run each time.
export async function runPython(code, log) {
  const py = await getPyodide();
  py.setStdout({ batched: (s) => log('out', s) });
  py.setStderr({ batched: (s) => log('err', s) });
  await ensureData(py, code, log);
  await py.loadPackagesFromImports(code, { messageCallback: (m) => log('info', m) });
  await loadExtras(py, code);
  await py.runPythonAsync(PY_PRELUDE);
  const result = await py.runPythonAsync(code);
  // Echo a bare trailing value like a REPL, but skip Python objects (e.g. the
  // Text returned by plt.title) which would only be noise.
  if (result !== undefined && result !== null && typeof result !== 'object' && typeof result !== 'function') {
    log('out', String(result));
  } else if (result?.destroy) {
    result.destroy();
  }
  const imgs = await py.runPythonAsync(PY_FIGURES);
  const list = imgs.toJs ? imgs.toJs() : [];
  list.forEach((b64) => log('img', b64));
}

// ---- Notebook mode (the book) ---------------------------------------------
// Each chapter gets its own namespace, so cells share variables like Jupyter.

const SHOW_HELPER = `
def _mn_show(x):
    if x is None:
        return None
    mod = type(x).__module__ or ""
    if mod.startswith("matplotlib"):
        return None
    if isinstance(x, (list, tuple)) and x and (type(x[0]).__module__ or "").startswith("matplotlib"):
        return None
    if mod.startswith(("pandas", "geopandas")) and hasattr(x, "_repr_html_") and hasattr(x, "columns"):
        try:
            return ["html", x._repr_html_()]
        except Exception:
            pass
    return ["value", repr(x)]
`;

export async function newNamespace() {
  const py = await getPyodide();
  return py.globals.get('dict')();
}

// Files under data/… that a cell mentions are copied from /book-data/ into the
// Python file system first, so the code reads them with normal relative paths.
async function ensureData(py, code, log) {
  const names = [...new Set([...code.matchAll(/data\/([\w.-]+\.(?:csv|geojson|json|txt))/g)].map((m) => m[1]))];
  if (!names.length) return;
  const dir = '/home/pyodide/data';
  if (!py.FS.analyzePath(dir).exists) py.FS.mkdir(dir);
  for (const name of names) {
    const path = `${dir}/${name}`;
    if (py.FS.analyzePath(path).exists) continue;
    const res = await fetch(`/book-data/${name}`);
    if (!res.ok) { log('info', `Dataset data/${name} was not found.`); continue; }
    py.FS.writeFile(path, new Uint8Array(await res.arrayBuffer()));
  }
}

// GeoPandas reads/writes files through fiona and plots through matplotlib,
// both imported lazily, so import scanning alone does not load them.
async function loadExtras(py, code) {
  const extra = [];
  if (/read_file|to_file/.test(code)) extra.push('fiona');
  if (/\.plot\(|\.hist\(|matplotlib/.test(code)) extra.push('matplotlib');
  if (extra.length) await py.loadPackage(extra);
}

// Keep only the part of a traceback that points at the learner's code.
export function cleanPythonError(message) {
  const lines = String(message).split('\n');
  const start = lines.findIndex((l) => l.includes('File "<exec>"'));
  const kept = (start >= 0 ? lines.slice(start) : lines.slice(-3)).filter((l) => l.trim());
  let text = kept.join('\n').replace(/File "<exec>", /g, '');
  if (/NameError/.test(text)) text += '\n\nTip: this cell uses something defined in a cell above. Run the cells above first, or press "Run all".';
  return text;
}

export async function runCell(code, ns, log) {
  const py = await getPyodide();
  py.setStdout({ batched: (s) => log('out', s) });
  py.setStderr({ batched: (s) => log('err', s) });
  await py.runPythonAsync('import os; os.chdir("/home/pyodide")');
  await ensureData(py, code, log);
  await py.loadPackagesFromImports(code, { messageCallback: () => {} });
  await loadExtras(py, code);
  await py.runPythonAsync(PY_PRELUDE + SHOW_HELPER, { globals: ns });
  try {
    const result = await py.runPythonAsync(code, { globals: ns });
    if (result !== undefined && result !== null) {
      if (typeof result === 'object' || typeof result === 'function') {
        const shown = ns.get('_mn_show')(result);
        if (shown) {
          const [kind, text] = shown.toJs();
          log(kind === 'html' ? 'html' : 'value', text);
          shown.destroy();
        }
        if (result.destroy) result.destroy();
      } else {
        log('value', typeof result === 'string' ? `'${result}'` : String(result));
      }
    }
  } finally {
    const imgs = await py.runPythonAsync(PY_FIGURES, { globals: ns });
    const list = imgs.toJs ? imgs.toJs() : [];
    list.forEach((b64) => log('img', b64));
  }
}
