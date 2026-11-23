// Additional courses: web development for maps (HTML → Leaflet → MapLibre),
// cartography, surveying & GNSS, GeoAI / machine learning and cloud-native GIS.
// ```html blocks open as live previews in the Code Lab.

const LF = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist';

export const MORE_COURSES = [
  // =======================================================================
  {
    id: 'html-css',
    track: 'Web & Coding',
    title: 'HTML & CSS for Map Makers',
    level: 'Beginner',
    summary: 'Start from zero: how web pages work, HTML structure, CSS styling and layout — the base for every web map.',
    lessons: [
      {
        id: 'first-page',
        title: 'How the web works & your first HTML page',
        minutes: 10,
        body: `# The three languages of the web
| Language | Job | Example |
|---|---|---|
| **HTML** | Structure — what is on the page | headings, paragraphs, a \`<div id="map">\` |
| **CSS** | Style — how it looks | colours, sizes, layout |
| **JavaScript** | Behaviour — what it does | load data, draw a map, react to clicks |

A browser downloads these files from a server and renders them. Every web GIS (including MapNiti) is built from these three.

## Anatomy of an HTML page
Tags come in pairs: \`<p>…</p>\`. Attributes add details: \`<a href="https://qgis.org">\`.

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <title>My first GIS page</title>
</head>
<body>
  <h1>Kathmandu Valley Survey</h1>
  <p>This page will soon show a <strong>web map</strong>.</p>
  <h2>Survey team</h2>
  <ul>
    <li>Surveyor: Ram</li>
    <li>Instrument: Total station</li>
    <li>Date: 2026-09-01</li>
  </ul>
  <a href="https://qgis.org" target="_blank">Download QGIS</a>
</body>
</html>
\`\`\`

> Click **Try it**, change the heading text and press Run again. That edit → run loop is how all developers work.`,
      },
      {
        id: 'css-styling',
        title: 'CSS: styling and layout (flexbox)',
        minutes: 12,
        body: `# CSS selectors and properties
\`selector { property: value; }\` — select by tag (\`h1\`), class (\`.card\`) or id (\`#map\`).

## Flexbox layout — sidebar + map
Almost every GIS app is "panel on the left, map on the right". Flexbox makes this easy.

\`\`\`html
<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; }
  .app { display: flex; height: 100vh; }
  .sidebar { width: 260px; background: #0047AB; color: white; padding: 16px; }
  .sidebar h2 { margin-top: 0; font-size: 18px; }
  .card { background: rgba(255,255,255,.12); border-radius: 10px; padding: 10px; margin-bottom: 10px; }
  .map { flex: 1; background: linear-gradient(135deg, #bae6fd, #bbf7d0);
         display: flex; align-items: center; justify-content: center; font-size: 22px; color: #0f172a; }
</style>
</head>
<body>
  <div class="app">
    <div class="sidebar">
      <h2>Layers</h2>
      <div class="card">Roads</div>
      <div class="card">Rivers</div>
      <div class="card">Ward boundaries</div>
    </div>
    <div class="map">Map goes here</div>
  </div>
</body>
</html>
\`\`\`

**Key ideas:** \`display:flex\` puts children side by side; \`flex:1\` lets the map take the remaining space; \`height:100vh\` = full screen height.`,
      },
      {
        id: 'forms-js',
        title: 'Forms + a little JavaScript: a plot-area calculator',
        minutes: 12,
        body: `# Making pages interactive
Inputs collect data; JavaScript reads them and writes results. This mini app converts plot area to Nepali units.

\`\`\`html
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: system-ui; padding: 20px; max-width: 420px; }
  input, button { font-size: 16px; padding: 6px 10px; margin: 4px 0; }
  table { border-collapse: collapse; margin-top: 12px; width: 100%; }
  td { border-bottom: 1px solid #e2e8f0; padding: 6px; }
</style>
</head>
<body>
  <h2>Plot area converter</h2>
  <label>Area in m²: <input id="area" type="number" value="1017.44"></label>
  <button onclick="convert()">Convert</button>
  <table id="out"></table>
<script>
  function convert() {
    const m2 = Number(document.getElementById('area').value);
    const rows = {
      'Ropani (508.72 m²)': m2 / 508.72,
      'Aana (31.80 m²)': m2 / 31.795,
      'Bigha (6772.63 m²)': m2 / 6772.63,
      'Kattha (338.63 m²)': m2 / 338.63,
      'Hectare': m2 / 10000,
      'Square feet': m2 * 10.7639
    };
    document.getElementById('out').innerHTML = Object.entries(rows)
      .map(([k, v]) => '<tr><td>' + k + '</td><td><b>' + v.toFixed(3) + '</b></td></tr>').join('');
    console.log('Converted', m2, 'm²');
  }
  convert();
</script>
</body>
</html>
\`\`\``,
      },
    ],
  },

  // =======================================================================
  {
    id: 'javascript',
    track: 'Web & Coding',
    title: 'JavaScript Fundamentals for GIS',
    level: 'Beginner',
    summary: 'Variables, arrays, objects, functions, JSON/GeoJSON and fetching live data from APIs.',
    lessons: [
      {
        id: 'js-basics',
        title: 'Variables, arrays, loops and functions',
        minutes: 12,
        body: `# Core syntax
\`\`\`javascript
// const = never reassigned, let = can change
const stationName = 'BM-12';
let reducedLevel = 1301.250;          // metres
const readings = [1.525, 1.820, 0.985, 1.445];

// loop through an array
let total = 0;
for (const r of readings) {
  total += r;
}
console.log('Sum of readings:', total.toFixed(3));

// a function with a default parameter
function slopePercent(rise, run = 100) {
  return (rise / run) * 100;
}
console.log('Grade over 250 m with 12 m rise:', slopePercent(12, 250).toFixed(2) + ' %');

// array methods: map, filter, reduce
const inMetres = readings.map(r => r * 1000);          // to mm
const high = readings.filter(r => r > 1.5);
const avg = readings.reduce((a, b) => a + b, 0) / readings.length;
console.log('In mm:', inMetres);
console.log('Readings > 1.5 m:', high);
console.log('Average:', avg.toFixed(3));
console.log(stationName, 'RL =', reducedLevel);
\`\`\``,
      },
      {
        id: 'objects-geojson',
        title: 'Objects, JSON and GeoJSON',
        minutes: 12,
        body: `# Objects hold named properties
GeoJSON — the web's standard GIS format — is just JavaScript objects written as JSON text. **Coordinates are always [longitude, latitude].**

\`\`\`javascript
const school = {
  type: 'Feature',
  properties: { name: 'Shree Janata School', students: 420, ward: 5 },
  geometry: { type: 'Point', coordinates: [85.3240, 27.7172] }
};

const collection = { type: 'FeatureCollection', features: [school] };

// add another feature
collection.features.push({
  type: 'Feature',
  properties: { name: 'Health Post', students: 0, ward: 5 },
  geometry: { type: 'Point', coordinates: [85.3301, 27.7120] }
});

// read properties
for (const f of collection.features) {
  const [lon, lat] = f.geometry.coordinates;
  console.log(f.properties.name, '→ lat', lat, 'lon', lon);
}

// object -> JSON text (to save / send) and back
const text = JSON.stringify(collection);
console.log('JSON length:', text.length, 'characters');
const parsed = JSON.parse(text);
console.log('Features after parse:', parsed.features.length);
\`\`\``,
      },
      {
        id: 'fetch-api',
        title: 'Fetching live data from an API',
        minutes: 12,
        body: `# async / await + fetch
Web maps load data from APIs. The USGS publishes live earthquake data as GeoJSON — no key needed.

\`\`\`javascript
const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
  '&latitude=28.2&longitude=84.1&maxradiuskm=500&minmagnitude=4.5&starttime=2015-01-01&orderby=magnitude&limit=10';

const res = await fetch(url);
if (!res.ok) throw new Error('Request failed: ' + res.status);
const data = await res.json();

console.log('Largest earthquakes near Nepal since 2015:');
for (const f of data.features) {
  const p = f.properties;
  const date = new Date(p.time).toISOString().slice(0, 10);
  console.log('M' + p.mag.toFixed(1), date, '-', p.place);
}
\`\`\`

> \`await\` pauses until the network answers. Always check \`res.ok\` — real APIs fail sometimes.`,
      },
    ],
  },

  // =======================================================================
  {
    id: 'leaflet',
    track: 'Web & Coding',
    title: 'Web Maps with Leaflet',
    level: 'Intermediate',
    summary: 'Build real interactive maps: basemaps, layer control, GeoJSON choropleths, legends, live data and measurement.',
    lessons: [
      {
        id: 'leaflet-first',
        title: 'Basemaps, markers and layer control',
        minutes: 12,
        body: `# Leaflet — the most popular open web-map library
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${LF}/leaflet.css">
  <script src="${LF}/leaflet.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
<div id="map"></div>
<script>
  const osm = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' });
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: 'OpenTopoMap' });

  const map = L.map('map', { layers: [osm] }).setView([28.2096, 83.9856], 13);   // Pokhara

  const places = L.layerGroup([
    L.marker([28.2096, 83.9856]).bindPopup('Pokhara'),
    L.marker([28.2380, 83.9956]).bindPopup('Sarangkot'),
    L.marker([28.2120, 83.9590]).bindPopup('Phewa Lake')
  ]).addTo(map);

  L.control.layers({ 'OpenStreetMap': osm, 'Satellite': sat, 'Topographic': topo }, { 'Places': places }).addTo(map);
  L.control.scale({ metric: true, imperial: false }).addTo(map);
  console.log('Use the layer control (top-right) to switch basemaps');
</script>
</body>
</html>
\`\`\``,
      },
      {
        id: 'leaflet-choropleth',
        title: 'Choropleth map with legend',
        minutes: 15,
        body: `# Thematic mapping
A choropleth colours areas by a value (population density, rainfall…). Always add a **legend**.

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${LF}/leaflet.css">
  <script src="${LF}/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; font-family: system-ui; }
    .legend { background: white; padding: 8px 10px; border-radius: 6px; line-height: 20px; font-size: 12px; }
    .legend i { width: 14px; height: 14px; float: left; margin-right: 6px; opacity: .85; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  // Simplified example zones with density (people / km²)
  const zones = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { name: 'Zone A', density: 250 },  geometry: { type: 'Polygon', coordinates: [[[85.20,27.60],[85.30,27.60],[85.30,27.68],[85.20,27.68],[85.20,27.60]]] } },
    { type: 'Feature', properties: { name: 'Zone B', density: 1800 }, geometry: { type: 'Polygon', coordinates: [[[85.30,27.60],[85.40,27.60],[85.40,27.68],[85.30,27.68],[85.30,27.60]]] } },
    { type: 'Feature', properties: { name: 'Zone C', density: 6200 }, geometry: { type: 'Polygon', coordinates: [[[85.25,27.68],[85.40,27.68],[85.40,27.76],[85.25,27.76],[85.25,27.68]]] } },
    { type: 'Feature', properties: { name: 'Zone D', density: 700 },  geometry: { type: 'Polygon', coordinates: [[[85.40,27.60],[85.50,27.60],[85.50,27.76],[85.40,27.76],[85.40,27.60]]] } }
  ]};
  const breaks = [0, 500, 1000, 5000];
  const colors = ['#fef3c7', '#fcd34d', '#f97316', '#b91c1c'];
  const colorFor = d => colors[breaks.filter(b => d >= b).length - 1];

  const map = L.map('map');
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' }).addTo(map);
  const layer = L.geoJSON(zones, {
    style: f => ({ fillColor: colorFor(f.properties.density), color: '#fff', weight: 2, fillOpacity: 0.75 }),
    onEachFeature: (f, l) => {
      l.bindTooltip(f.properties.name + ': ' + f.properties.density + ' /km²');
      l.on('mouseover', () => l.setStyle({ weight: 4, color: '#0f172a' }));
      l.on('mouseout', () => layer.resetStyle(l));
    }
  }).addTo(map);
  map.fitBounds(layer.getBounds());

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = '<b>People / km²</b><br>' + breaks.map((b, i) =>
      '<i style="background:' + colors[i] + '"></i>' + b + (breaks[i + 1] ? '–' + breaks[i + 1] : '+')).join('<br>');
    return div;
  };
  legend.addTo(map);
</script>
</body>
</html>
\`\`\``,
      },
      {
        id: 'leaflet-live',
        title: 'Live data: earthquakes on a map',
        minutes: 12,
        body: `# Combine fetch + GeoJSON + styling
Circle size by magnitude, colour by depth — a classic data-driven map.

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${LF}/leaflet.css">
  <script src="${LF}/leaflet.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
<div id="map"></div>
<script>
  const map = L.map('map').setView([28.3, 84.1], 6);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' }).addTo(map);

  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minlatitude=25&maxlatitude=31.5&minlongitude=79&maxlongitude=89.5&minmagnitude=4.5&starttime=2000-01-01';
  fetch(url).then(r => r.json()).then(data => {
    L.geoJSON(data, {
      pointToLayer: (f, latlng) => L.circleMarker(latlng, {
        radius: Math.pow(f.properties.mag, 1.6),
        color: '#fff', weight: 1,
        fillColor: f.geometry.coordinates[2] > 30 ? '#7c3aed' : '#ef4444',
        fillOpacity: 0.7
      }).bindPopup('M' + f.properties.mag + '<br>' + f.properties.place + '<br>' + new Date(f.properties.time).toDateString())
    }).addTo(map);
    console.log(data.features.length, 'earthquakes (M4.5+) since 2000 loaded');
  }).catch(e => console.error('Could not load data:', e.message));
</script>
</body>
</html>
\`\`\``,
      },
      {
        id: 'leaflet-measure',
        title: 'Click-to-measure distance tool',
        minutes: 12,
        body: `# Handling map events
Leaflet's \`map.distance()\` gives the geodesic distance between two points in metres.

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${LF}/leaflet.css">
  <script src="${LF}/leaflet.js"></script>
  <style>
    html, body, #map { height: 100%; margin: 0; font-family: system-ui; }
    #info { position: absolute; top: 10px; left: 50px; z-index: 1000; background: white; padding: 8px 12px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
  </style>
</head>
<body>
<div id="info">Click on the map to measure. Double-click to reset.</div>
<div id="map"></div>
<script>
  const map = L.map('map', { doubleClickZoom: false }).setView([27.6710, 85.4298], 16);   // Bhaktapur
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' }).addTo(map);

  let pts = [];
  const line = L.polyline([], { color: '#facc15', weight: 3 }).addTo(map);
  const info = document.getElementById('info');

  map.on('click', e => {
    pts.push(e.latlng);
    line.setLatLngs(pts);
    L.circleMarker(e.latlng, { radius: 4, color: '#facc15' }).addTo(map);
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += map.distance(pts[i - 1], pts[i]);
    info.textContent = pts.length + ' points · ' + total.toFixed(1) + ' m (' + (total / 1000).toFixed(3) + ' km)';
  });
  map.on('dblclick', () => location.reload());
</script>
</body>
</html>
\`\`\``,
      },
    ],
  },

  // =======================================================================
  {
    id: 'maplibre',
    track: 'Web & Coding',
    title: 'Advanced Web GIS with MapLibre GL',
    level: 'Advanced',
    summary: 'GPU-rendered maps: vector styles, data-driven styling, 3D terrain and buildings, and how to plug in Earth Engine tiles.',
    lessons: [
      {
        id: 'ml-data-driven',
        title: 'Data-driven styling with expressions',
        minutes: 15,
        body: `# MapLibre GL JS
The engine behind MapNiti's map. It renders with WebGL, so it handles hundreds of thousands of features and 3D.

**Expressions** style features from their attributes: \`['get', 'field']\`, \`['interpolate', ...]\`, \`['match', ...]\`.

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css">
  <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
<div id="map"></div>
<script>
  // 400 random "boreholes" with a depth-to-rock attribute
  const features = [];
  for (let i = 0; i < 400; i++) {
    features.push({ type: 'Feature', properties: { depth: Math.round(Math.random() * 30) },
      geometry: { type: 'Point', coordinates: [85.28 + Math.random() * 0.1, 27.66 + Math.random() * 0.08] } });
  }
  const map = new maplibregl.Map({
    container: 'map',
    style: { version: 8, sources: { osm: { type: 'raster', tileSize: 256, tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'], attribution: 'Tiles &copy; Esri' } },
             layers: [{ id: 'osm', type: 'raster', source: 'osm' }] },
    center: [85.33, 27.70], zoom: 12
  });
  map.on('load', () => {
    map.addSource('bh', { type: 'geojson', data: { type: 'FeatureCollection', features } });
    map.addLayer({ id: 'bh', type: 'circle', source: 'bh', paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'depth'], 0, 3, 30, 10],
      'circle-color': ['interpolate', ['linear'], ['get', 'depth'], 0, '#22c55e', 15, '#eab308', 30, '#dc2626'],
      'circle-stroke-color': '#fff', 'circle-stroke-width': 1
    }});
    map.on('click', 'bh', e => new maplibregl.Popup().setLngLat(e.lngLat)
      .setHTML('Depth to rock: <b>' + e.features[0].properties.depth + ' m</b>').addTo(map));
    console.log('Styled', features.length, 'boreholes by depth');
  });
</script>
</body>
</html>
\`\`\``,
      },
      {
        id: 'ml-3d',
        title: '3D terrain & extruded buildings',
        minutes: 15,
        body: `# 3D in the browser
- **raster-dem** source + \`terrain\` = real 3D mountains.
- **fill-extrusion** layer = 3D buildings from a height attribute.

\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css">
  <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
<div id="map"></div>
<script>
  const buildings = { type: 'FeatureCollection', features: [] };
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const x = 85.3150 + c * 0.0006, y = 27.7050 + r * 0.0006, s = 0.00025;
    buildings.features.push({ type: 'Feature', properties: { floors: 1 + ((r * 7 + c * 3) % 9) },
      geometry: { type: 'Polygon', coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] } });
  }
  const map = new maplibregl.Map({
    container: 'map',
    style: { version: 8,
      sources: {
        sat: { type: 'raster', tileSize: 256, tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
        dem: { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'] }
      },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }] },
    center: [85.3172, 27.7072], zoom: 16, pitch: 60, bearing: 30
  });
  map.on('load', () => {
    map.addSource('b', { type: 'geojson', data: buildings });
    map.addLayer({ id: 'b3d', type: 'fill-extrusion', source: 'b', paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'floors'], 1, '#93c5fd', 9, '#1e3a8a'],
      'fill-extrusion-height': ['*', ['get', 'floors'], 3.2],   // 3.2 m per floor
      'fill-extrusion-opacity': 0.85
    }});
    console.log('Buildings extruded by floor count (3.2 m per floor)');
  });
</script>
</body>
</html>
\`\`\``,
      },
      {
        id: 'ml-gee-tiles',
        title: 'Showing Earth Engine results in your own web map',
        minutes: 10,
        body: `# The pattern MapNiti uses
1. Backend (Python) builds an \`ee.Image\` and calls \`image.getMapId(vis)\`.
2. Earth Engine returns a **tile URL template** (\`…/tiles/{z}/{x}/{y}\`).
3. Frontend adds it as a raster source — MapLibre or Leaflet, exactly like a basemap.

\`\`\`python-colab
# backend (FastAPI + earthengine-api)
import ee
ee.Initialize(project="YOUR-PROJECT")
ndvi = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate("2025-10-01", "2025-12-31").median()
        .normalizedDifference(["B8", "B4"]))
map_id = ndvi.getMapId({"min": 0, "max": 0.8, "palette": ["brown", "yellow", "green"]})
print(map_id["tile_fetcher"].url_format)   # send this URL to the browser
\`\`\`

\`\`\`gee
// frontend (MapLibre) — url comes from the backend response
map.addSource('ndvi', { type: 'raster', tiles: [url], tileSize: 256 });
map.addLayer({ id: 'ndvi', type: 'raster', source: 'ndvi', paint: { 'raster-opacity': 0.8 } });
\`\`\`

> Tile URLs from getMapId expire after some hours — request a fresh one per session. Never put a service-account key in frontend code.`,
      },
    ],
  },

  // =======================================================================
  {
    id: 'cartography',
    track: 'GIS Science',
    title: 'Cartography & Map Design',
    level: 'Beginner',
    summary: 'Make maps people understand: map elements, symbology, colour, and data classification methods.',
    lessons: [
      {
        id: 'map-elements',
        title: 'Map elements every engineering map needs',
        minutes: 8,
        body: `# The checklist
1. **Title** — what, where, when ("Landslide susceptibility, Ward 3, 2026")
2. **Legend** — every symbol and colour explained
3. **Scale bar** (and scale 1:x on printed sheets)
4. **North arrow**
5. **Coordinate grid / CRS note** — e.g. "MUTM 84, Everest 1830" or "UTM 45N, WGS84"
6. **Data sources & date** — "SRTM 30 m, ESA WorldCover 2021, field survey Sep 2026"
7. **Author / organisation, map number**
8. **Inset / location map** for context

## Visual hierarchy
Important things bold and saturated (the road alignment); background things light and grey (basemap). Use at most 2 fonts.

## Colour rules
- **Sequential** (light → dark) for amounts: rainfall, population.
- **Diverging** (red ← white → blue) for above/below a midpoint: change, anomaly.
- **Qualitative** (distinct hues) for categories: land use.
- ~8% of men are colour-blind — avoid red/green only; test with ColorBrewer's "colorblind safe" option.`,
      },
      {
        id: 'classification',
        title: 'Data classification: equal interval, quantile, natural breaks',
        minutes: 14,
        body: `# The same data, three different maps
How you split values into classes changes the story.

| Method | How | Good for |
|---|---|---|
| Equal interval | Same range per class | Familiar ranges (0–10, 10–20 °) — slope classes |
| Quantile | Same **count** per class | Ranking, evenly spread colours |
| Natural breaks (Jenks) | Minimise variance inside classes | Clustered data — default in QGIS/ArcGIS |

\`\`\`python
import numpy as np

rain = np.array([820, 910, 950, 1010, 1180, 1250, 1390, 1420, 1510, 1880, 2050, 2400, 2650, 3100, 3600])
k = 4

equal = np.linspace(rain.min(), rain.max(), k + 1)
quant = np.quantile(rain, np.linspace(0, 1, k + 1))

def jenks(data, k):
    """Fisher-Jenks optimal breaks by dynamic programming (fine for small arrays)."""
    x = np.sort(data); n = len(x)
    cost = lambda i, j: ((x[i:j] - x[i:j].mean()) ** 2).sum()
    best = {(0, j): (cost(0, j), [0]) for j in range(1, n + 1)}
    for c in range(1, k):
        for j in range(c + 1, n + 1):
            best[(c, j)] = min(((best[(c - 1, i)][0] + cost(i, j), best[(c - 1, i)][1] + [i])
                                for i in range(c, j)), key=lambda t: t[0])
    starts = best[(k - 1, n)][1]
    return [x[0]] + [x[s - 1] for s in starts[1:]] + [x[-1]]

print("Equal interval:", equal.round(0))
print("Quantile      :", quant.round(0))
print("Natural breaks:", np.round(jenks(rain, k), 0))
\`\`\``,
      },
    ],
  },

  // =======================================================================
  {
    id: 'surveying',
    track: 'Engineering',
    title: 'Surveying, GNSS & Coordinate Computations',
    level: 'Intermediate',
    summary: 'Total station reductions, GNSS/RTK concepts, coordinate transformation and area computation in Python.',
    lessons: [
      {
        id: 'gnss',
        title: 'GNSS, RTK and PPK explained',
        minutes: 10,
        body: `# How GNSS positioning works
Receivers measure distances to satellites (GPS, GLONASS, Galileo, BeiDou). 4+ satellites → 3D position + clock error.

| Method | Accuracy | Use |
|---|---|---|
| Handheld / phone | 3–10 m | Reconnaissance, field photos |
| DGPS / SBAS | 0.5–2 m | Mapping, asset inventory |
| **RTK** (base + rover, radio/NTRIP) | 1–3 cm | Topographic & stake-out surveys |
| **PPK** (post-processed) | 1–3 cm | Drone mapping, remote sites |
| Static (hours, post-processed) | mm–cm | Control networks |

## Good practice in Nepal's terrain
- Open sky: avoid steep valleys, tall buildings, dense forest (multipath).
- Tie surveys to Survey Department control points or a CORS station; record the **datum and epoch**.
- GNSS heights are ellipsoidal — convert to orthometric (mean sea level) with a geoid model (EGM2008) before comparing with DEMs or design levels.`,
      },
      {
        id: 'total-station',
        title: 'Total station reduction to coordinates',
        minutes: 14,
        body: `# From field observations to E, N, RL
A total station measures **horizontal angle / bearing**, **zenith angle** and **slope distance**.

- Horizontal distance: HD = SD · sin(Z)
- Height difference: ΔH = SD · cos(Z) + HI − HT
- ΔE = HD · sin(bearing), ΔN = HD · cos(bearing)

\`\`\`python
import math

station = {"E": 334500.000, "N": 3066800.000, "RL": 1301.250, "HI": 1.520}
obs = [  # point, bearing (deg), zenith (deg), slope distance (m), target height (m)
    ("P1",  45.2510,  88.3021, 52.418, 1.800),
    ("P2", 112.1033,  91.1504, 38.905, 1.800),
    ("P3", 201.5547,  86.4210, 61.230, 2.000),
]

print(f"{'Pt':4} {'Easting':>12} {'Northing':>13} {'RL':>9}")
for name, brg, zen, sd, ht in obs:
    z = math.radians(zen)
    hd = sd * math.sin(z)
    dh = sd * math.cos(z) + station["HI"] - ht
    e = station["E"] + hd * math.sin(math.radians(brg))
    n = station["N"] + hd * math.cos(math.radians(brg))
    print(f"{name:4} {e:12.3f} {n:13.3f} {station['RL'] + dh:9.3f}")
\`\`\``,
      },
      {
        id: 'helmert',
        title: 'Coordinate transformation (2D Helmert, least squares)',
        minutes: 15,
        body: `# Fitting local coordinates to a national grid
When a site survey uses an assumed local grid, you transform it to UTM/MUTM using **common control points** measured in both systems. The 4-parameter Helmert transformation: shift (tx, ty), rotation θ and scale s.

E = a·x − b·y + tx, N = b·x + a·y + ty, where a = s·cosθ, b = s·sinθ.

\`\`\`python
import numpy as np

local = np.array([[1000.000, 1000.000], [1150.320, 1012.110], [1142.870, 1178.450], [995.410, 1165.900]])
grid  = np.array([[334508.183, 3066860.641], [334658.229, 3066876.012], [334647.161, 3067042.185], [334499.981, 3067026.441]])

A, L = [], []
for (x, y), (E, N) in zip(local, grid):
    A += [[x, -y, 1, 0], [y, x, 0, 1]]
    L += [E, N]
A, L = np.array(A), np.array(L)
params, *_ = np.linalg.lstsq(A, L, rcond=None)
a, b, tx, ty = params
scale, rot = np.hypot(a, b), np.degrees(np.arctan2(b, a))
res = (A @ params - L).reshape(-1, 2)

print(f"scale = {scale:.6f}, rotation = {rot:.4f}°, tx = {tx:.3f}, ty = {ty:.3f}")
print("Residuals (m):"); print(res.round(3))
print(f"RMSE = {np.sqrt((res**2).mean()):.3f} m")

new_pt = np.array([1080.0, 1090.0])
E = a*new_pt[0] - b*new_pt[1] + tx; N = b*new_pt[0] + a*new_pt[1] + ty
print(f"Local {new_pt} -> grid E={E:.3f}, N={N:.3f}")
\`\`\``,
      },
    ],
  },

  // =======================================================================
  {
    id: 'geoai',
    track: 'GIS Science',
    title: 'GeoAI & Machine Learning for Remote Sensing',
    level: 'Advanced',
    summary: 'Random forest classification, clustering, accuracy assessment and geospatial foundation models (Prithvi, AlphaEarth).',
    lessons: [
      {
        id: 'rf-classification',
        title: 'Random forest land-cover classification',
        minutes: 18,
        body: `# Supervised ML on spectral bands
Each pixel = a row of band values (features); the class is the label. Random Forest is the workhorse for LULC in GEE and QGIS.

\`\`\`python
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, accuracy_score, cohen_kappa_score

rng = np.random.default_rng(42)
# synthetic Sentinel-2 reflectance: [blue, green, red, NIR, SWIR1]
centres = {
    "water":  [0.06, 0.07, 0.05, 0.03, 0.02],
    "forest": [0.03, 0.06, 0.04, 0.35, 0.16],
    "crop":   [0.05, 0.09, 0.07, 0.28, 0.22],
    "built":  [0.12, 0.13, 0.15, 0.22, 0.28],
}
X, y = [], []
for label, c in centres.items():
    X.append(rng.normal(c, 0.025, size=(300, 5))); y += [label] * 300
X = np.clip(np.vstack(X), 0, 1); y = np.array(y)

# add NDVI and NDBI as extra features — they help a lot
ndvi = (X[:, 3] - X[:, 2]) / (X[:, 3] + X[:, 2] + 1e-9)
ndbi = (X[:, 4] - X[:, 3]) / (X[:, 4] + X[:, 3] + 1e-9)
X = np.column_stack([X, ndvi, ndbi])

Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.3, random_state=0, stratify=y)
rf = RandomForestClassifier(n_estimators=150, random_state=0).fit(Xtr, ytr)
pred = rf.predict(Xte)

labels = list(centres)
print("Overall accuracy:", round(accuracy_score(yte, pred), 3), " Kappa:", round(cohen_kappa_score(yte, pred), 3))
print("Confusion matrix (rows = truth):", labels)
print(confusion_matrix(yte, pred, labels=labels))
names = ["blue", "green", "red", "NIR", "SWIR1", "NDVI", "NDBI"]
print("Feature importance:", {n: round(v, 3) for n, v in zip(names, rf.feature_importances_)})
\`\`\`

The same model in Earth Engine: \`ee.Classifier.smileRandomForest(150).train(samples, 'class', bands)\`.`,
      },
      {
        id: 'kmeans',
        title: 'Unsupervised clustering (k-means)',
        minutes: 12,
        body: `# When you have no training data
k-means groups pixels into k spectral clusters; you name them afterwards by looking at imagery.

\`\`\`python
import numpy as np
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt

rng = np.random.default_rng(3)
img = np.zeros((80, 80, 2))                      # 2 bands: red, NIR
img[:] = rng.normal([0.07, 0.28], 0.02, (80, 80, 2))          # crops
img[10:40, 45:78] = rng.normal([0.04, 0.38], 0.02, (30, 33, 2))  # forest
img[50:70, 10:60] = rng.normal([0.05, 0.03], 0.01, (20, 50, 2))  # water
img[5:25, 5:30] = rng.normal([0.15, 0.22], 0.02, (20, 25, 2))    # built

pixels = img.reshape(-1, 2)
km = KMeans(n_clusters=4, n_init=10, random_state=0).fit(pixels)
clusters = km.labels_.reshape(80, 80)
for i, c in enumerate(km.cluster_centers_):
    ndvi = (c[1] - c[0]) / (c[1] + c[0])
    print(f"cluster {i}: red={c[0]:.3f} NIR={c[1]:.3f} NDVI={ndvi:.2f}  pixels={np.sum(clusters == i)}")

plt.imshow(clusters, cmap="tab10"); plt.title("k-means clusters (k=4)"); plt.colorbar()
\`\`\``,
      },
      {
        id: 'foundation-models',
        title: 'Geospatial foundation models & satellite embeddings',
        minutes: 12,
        body: `# The 2025–2026 shift in GeoAI
Instead of training from scratch, you start from a model pre-trained on millions of satellite images.

| Model | From | What you get |
|---|---|---|
| **AlphaEarth Foundations — Satellite Embedding** | Google DeepMind | 64-number "embedding" per 10 m pixel per year (2017–2024; 2025 in progress), in Earth Engine |
| **Prithvi-EO-2.0** | NASA + IBM | Open model (Hugging Face) fine-tuned for floods, burn scars, crops |
| **TerraMind** | IBM + ESA | Any-to-any multimodal EO model (optical, SAR, DEM) |
| **Segment Anything (SAMGeo)** | Meta / opengeos | Prompt-based segmentation of buildings, fields, water |

## Similarity search with AlphaEarth embeddings (Earth Engine)
Pick a pixel you care about (e.g. a brick kiln) and find similar pixels everywhere — no training needed.

\`\`\`gee
var emb = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')
  .filterDate('2024-01-01', '2025-01-01').mosaic();
var sample = ee.Geometry.Point([85.40, 27.63]);          // a known example location
var ref = emb.reduceRegion(ee.Reducer.first(), sample, 10);
var refImg = ee.Image.constant(ref.values(emb.bandNames())).rename(emb.bandNames());
var similarity = emb.multiply(refImg).reduce('sum');     // dot product (embeddings are unit length)
Map.centerObject(sample, 12);
Map.addLayer(similarity, {min: 0.5, max: 1, palette: ['black', 'yellow', 'red']}, 'Similarity');
\`\`\`

Embeddings also make classification easy: train \`smileRandomForest\` on the 64 embedding bands with a handful of labelled points.`,
      },
    ],
  },

  // =======================================================================
  {
    id: 'cloud-native',
    track: 'GIS Science',
    title: 'Cloud-Native Geospatial (COG, STAC, GeoParquet, DuckDB)',
    level: 'Advanced',
    summary: 'Work with huge datasets without downloading them: Cloud Optimized GeoTIFF, STAC catalogues, GeoParquet and spatial SQL in DuckDB.',
    lessons: [
      {
        id: 'cog-stac',
        title: 'COG and STAC: search imagery like a database',
        minutes: 14,
        body: `# Formats built for the cloud
- **COG (Cloud Optimized GeoTIFF)** — a GeoTIFF with internal tiles + overviews, so software reads only the part it needs over HTTP.
- **STAC (SpatioTemporal Asset Catalog)** — a standard JSON API to search imagery by area, date and cloud cover.
- **Zarr** — chunked arrays for climate data cubes.

## Try it: search Sentinel-2 over Kathmandu with a STAC API
\`\`\`javascript
const body = {
  collections: ['sentinel-2-l2a'],
  bbox: [85.25, 27.65, 85.40, 27.75],
  datetime: '2025-10-01T00:00:00Z/2025-12-31T23:59:59Z',
  query: { 'eo:cloud_cover': { lt: 10 } },
  limit: 5
};
const res = await fetch('https://earth-search.aws.element84.com/v1/search', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
const data = await res.json();
console.log('Scenes found:', data.features.length);
for (const f of data.features) {
  console.log(f.properties.datetime.slice(0, 10), '| cloud', f.properties['eo:cloud_cover'].toFixed(1) + '%', '|', f.id);
  console.log('   red band COG:', f.assets.red.href);
}
\`\`\`

Each \`href\` is a COG you can open directly in QGIS (Layer → Add Raster → Protocol HTTP) or read a window from with rasterio.`,
      },
      {
        id: 'geoparquet-duckdb',
        title: 'GeoParquet + DuckDB: spatial SQL on huge files',
        minutes: 14,
        body: `# The new "shapefile" for big data
**GeoParquet** stores vector data in columnar Parquet files — small, fast, and readable in parts. **Overture Maps** publishes worldwide buildings, roads and places this way. **DuckDB** queries them with SQL directly from cloud storage.

\`\`\`python-colab
# pip install duckdb   (run in Colab / Jupyter)
import duckdb
con = duckdb.connect()
con.sql("INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;")
con.sql("SET s3_region='us-west-2';")

# Buildings in central Kathmandu from Overture (use the latest release folder name)
release = "2026-08-19.0"
df = con.sql(f"""
  SELECT id, height, num_floors, ST_Area_Spheroid(geometry) AS area_m2
  FROM read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=buildings/type=building/*', hive_partitioning=1)
  WHERE bbox.xmin > 85.30 AND bbox.xmax < 85.34 AND bbox.ymin > 27.69 AND bbox.ymax < 27.72
""").df()
print(len(df), "buildings; mean footprint", round(df.area_m2.mean(), 1), "m²")
\`\`\`

## The same SQL ideas, runnable here
\`\`\`sql
-- Spatial-style filtering with a bounding box on plain coordinates
SELECT name, easting, northing, rl
FROM survey_points
WHERE easting BETWEEN 334540 AND 334710
  AND northing BETWEEN 3066780 AND 3066850
ORDER BY easting;
\`\`\``,
      },
    ],
  },
];
