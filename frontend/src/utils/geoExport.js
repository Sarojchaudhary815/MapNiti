import shpwrite from '@mapbox/shp-write';
import tokml from 'tokml';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportGeoJSON(geojson, filename = 'layer.geojson') {
  downloadBlob(new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' }), filename);
}

export function exportKML(geojson, filename = 'layer.kml') {
  const kml = tokml(geojson);
  downloadBlob(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }), filename);
}

export async function exportShapefile(geojson, filename = 'layer') {
  const blob = await shpwrite.zip(geojson, { outputType: 'blob', compression: 'DEFLATE' });
  downloadBlob(blob, `${filename}.zip`);
}

export function exportText(content, filename, type = 'text/plain') {
  downloadBlob(new Blob([content], { type }), filename);
}

// Converts any FeatureCollection to CSV: point features get lon/lat columns,
// everything else gets its WKT-free attributes only.
export function exportCSV(geojson, filename = 'layer.csv') {
  const feats = geojson.features || [];
  const keys = [...new Set(feats.flatMap((f) => Object.keys(f.properties || {})))];
  const hasPoints = feats.some((f) => f.geometry?.type === 'Point');
  const cols = hasPoints ? ['lon', 'lat', ...keys] : keys;
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const rows = feats.map((f) => {
    const base = hasPoints && f.geometry?.type === 'Point' ? f.geometry.coordinates.slice(0, 2) : hasPoints ? ['', ''] : [];
    return [...base, ...keys.map((k) => f.properties?.[k])].map(esc).join(',');
  });
  exportText([cols.join(','), ...rows].join('\n'), filename, 'text/csv');
}
