// Printable analysis report: a clean A4 page shown in an in-app preview; its Print
// button opens the browser's print dialog, where "Save as PDF" produces the file. Doing it this way
// needs no PDF library, keeps text selectable and prints sharp at any size.

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function chartSvg(chart) {
  const data = (chart?.data || []).filter((d) => Number.isFinite(Number(d[chart.yKey])));
  if (!data.length) return '';
  const W = 640; const H = 220; const L = 48; const B = 46; const T = 10; const R = 10;
  const vals = data.map((d) => Number(d[chart.yKey]));
  const max = Math.max(...vals, 0) || 1;
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const y = (v) => T + (H - T - B) * (1 - (v - min) / span);
  const step = (W - L - R) / data.length;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + span * f);
  const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : Number(v.toFixed(2)).toString());
  let marks = '';
  if (chart.type === 'line') {
    const pts = data.map((d, i) => `${L + step * (i + 0.5)},${y(Number(d[chart.yKey]))}`).join(' ');
    marks = `<polyline fill="none" stroke="#0047AB" stroke-width="2" points="${pts}"/>`
      + data.map((d, i) => `<circle cx="${L + step * (i + 0.5)}" cy="${y(Number(d[chart.yKey]))}" r="2.5" fill="#0047AB"/>`).join('');
  } else {
    marks = data.map((d, i) => {
      const v = Number(d[chart.yKey]);
      const top = y(Math.max(v, 0)); const bottom = y(Math.min(v, 0));
      const w = Math.min(36, step * 0.7);
      return `<rect x="${L + step * i + (step - w) / 2}" y="${top}" width="${w}" height="${Math.max(1, bottom - top)}" rx="2" fill="${esc(d.color || (d.projected ? '#93c5fd' : '#0047AB'))}"/>`;
    }).join('');
  }
  const every = Math.ceil(data.length / 14);
  const labels = data.map((d, i) => (i % every ? '' : `<text x="${L + step * (i + 0.5)}" y="${H - B + 14}" font-size="9" fill="#64748b" text-anchor="end" transform="rotate(-30 ${L + step * (i + 0.5)} ${H - B + 14})">${esc(d[chart.xKey])}</text>`)).join('');
  const grid = ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="#e2e8f0"/><text x="${L - 6}" y="${y(t) + 3}" font-size="9" fill="#64748b" text-anchor="end">${fmt(t)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">${grid}${marks}${labels}</svg>`;
}

function legendHtml(legend) {
  if (!legend) return '';
  if (legend.type === 'classes') {
    return `<div class="legend">${legend.items.map((c) => `<span><i style="background:${esc(c.color)}"></i>${esc(c.label)}</span>`).join('')}</div>`;
  }
  return `<div class="ramp" style="background:linear-gradient(to right, ${(legend.palette || []).map(esc).join(',')})"></div>
    <div class="ramp-l"><span>${esc(legend.min)}</span><span>${esc(legend.units)}</span><span>${esc(legend.max)}</span></div>`;
}

/**
 * @param {object} o
 * @param {object} o.result   tool response (title/stats/table/chart/legend/notes)
 * @param {string} o.toolLabel
 * @param {object} [o.aoi]    selectedAOI ({ name, bbox })
 * @param {string} [o.image]  JPEG data URL of the map
 * @param {object} [o.params] parameter values with their labels: [{ label, value }]
 * @param {string} [o.author]
 * @param {string} [o.project]
 */
export function buildReportHtml({ result, toolLabel, aoi, image, params = [], author, project }) {
  const now = new Date();
  const b = aoi?.bbox;
  const bboxTxt = b ? `${b.west.toFixed(4)}, ${b.south.toFixed(4)} – ${b.east.toFixed(4)}, ${b.north.toFixed(4)} (WGS84)` : '';
  const stats = (result.stats || []).map((s) => `<div class="stat"><p>${esc(s.label)}</p><b>${esc(s.value ?? '—')} <small>${esc(s.unit)}</small></b></div>`).join('');
  const table = result.table?.rows?.length ? `
    <h2>${esc(result.table.title || 'Table')}</h2>
    <table><thead><tr>${result.table.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${result.table.rows.slice(0, 300).map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    ${result.table.rows.length > 300 ? `<p class="muted">First 300 of ${result.table.rows.length} rows. Download the CSV for all of them.</p>` : ''}` : '';
  const chart = result.chart?.data?.length ? `<h2>${esc(result.chart.title || 'Chart')}</h2><div class="chart">${chartSvg(result.chart)}</div>
    ${result.chart.unit ? `<p class="muted">Values in ${esc(result.chart.unit)}</p>` : ''}` : '';
  const notes = result.notes?.length ? `<h2>Notes and data sources</h2><ul>${result.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '';
  const paramRows = params.filter((p) => p.value !== undefined && p.value !== '').map((p) => `<tr><th>${esc(p.label)}</th><td>${esc(p.value)}</td></tr>`).join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(result.title || toolLabel)} – MapNiti report</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 0; font-size: 11pt; }
  .page { max-width: 190mm; margin: 0 auto; padding: 8mm 0; }
  header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0047AB; padding-bottom: 8px; }
  header img { height: 34px; }
  header .meta { text-align: right; font-size: 9pt; color: #475569; }
  h1 { font-size: 19pt; margin: 14px 0 2px; }
  .sub { color: #0047AB; font-weight: 600; margin: 0 0 10px; }
  h2 { font-size: 12.5pt; margin: 18px 0 6px; color: #0047AB; break-after: avoid; }
  .info { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 4px; }
  .info th { text-align: left; width: 34%; color: #475569; font-weight: 600; padding: 3px 0; }
  .info td { padding: 3px 0; }
  .map { width: 100%; border: 1px solid #cbd5e1; border-radius: 6px; margin-top: 10px; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .stat { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; break-inside: avoid; }
  .stat p { margin: 0; font-size: 8pt; text-transform: uppercase; color: #64748b; letter-spacing: .03em; }
  .stat b { font-size: 12.5pt; } .stat small { font-size: 8pt; color: #64748b; font-weight: 400; }
  table:not(.info) { width: 100%; border-collapse: collapse; font-size: 9pt; }
  table:not(.info) th { background: #f1f5f9; text-align: left; padding: 4px 6px; }
  table:not(.info) td { border-top: 1px solid #e2e8f0; padding: 3px 6px; }
  tr { break-inside: avoid; }
  .chart { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; break-inside: avoid; }
  .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 9pt; margin-top: 8px; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; border: 1px solid #cbd5e1; vertical-align: -1px; }
  .ramp { height: 10px; border-radius: 5px; margin-top: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .ramp-l { display: flex; justify-content: space-between; font-size: 8.5pt; color: #475569; }
  ul { padding-left: 18px; font-size: 9.5pt; } li { margin: 3px 0; }
  .muted { color: #64748b; font-size: 8.5pt; }
  footer { margin-top: 22px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 8pt; color: #64748b; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media screen { body { background: #e2e8f0; } .page { background: #fff; padding: 12mm; margin: 12px auto; box-shadow: 0 2px 12px rgba(0,0,0,.12); } }
  @media print { .page { padding: 0; } }
</style></head><body>
<div class="page">
  <header>
    <img src="${esc(window.location.origin)}/assets/MapNiti_logo_transparent.png" alt="MapNiti">
    <div class="meta">Analysis report<br>${esc(now.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))}</div>
  </header>
  <h1>${esc(result.title || toolLabel)}</h1>
  <p class="sub">${esc(toolLabel)}${aoi?.name ? ` · ${esc(aoi.name)}` : ''}</p>
  <table class="info">
    ${aoi?.name ? `<tr><th>Study area</th><td>${esc(aoi.name)}</td></tr>` : ''}
    ${bboxTxt ? `<tr><th>Extent</th><td>${esc(bboxTxt)}</td></tr>` : ''}
    ${paramRows}
    ${project ? `<tr><th>Project</th><td>${esc(project)}</td></tr>` : ''}
    ${author ? `<tr><th>Prepared by</th><td>${esc(author)}</td></tr>` : ''}
  </table>
  ${image ? `<img class="map" src="${image}" alt="Map of the study area">` : ''}
  ${legendHtml(result.legend)}
  ${stats ? `<h2>Key figures</h2><div class="stats">${stats}</div>` : ''}
  ${chart}
  ${table}
  ${notes}
  <footer>Generated with MapNiti (mapniti.com) from open global datasets via Google Earth Engine and OpenStreetMap.
  Results are for planning and screening; verify on the ground before design or legal use.</footer>
</div>
</body></html>`;
}
