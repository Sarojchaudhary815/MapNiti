// Code Lab examples, grouped by topic and ordered from easy to hard.
// Each example: title, topic, level, what (one line: what it does), tip (what to
// change and try), code. Every example must run without errors in the lab.

const LEAFLET = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist';
// OpenStreetMap's tile servers block embedded previews like this one ("403 Access
// blocked") and CARTO now needs an API key, so the examples use Esri's keyless
// World Street Map tiles. Note Esri's URL order: {z}/{y}/{x}.
export const STREET_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const STREET_ATTR = 'Tiles &copy; Esri';

export const LEVEL_STYLE = {
  Beginner: 'bg-emerald-50 text-emerald-700',
  Intermediate: 'bg-amber-50 text-amber-700',
  Advanced: 'bg-rose-50 text-rose-700',
};

export const EXAMPLES = {
  html: [
    {
      title: 'Your first web page',
      topic: 'HTML & CSS basics',
      level: 'Beginner',
      what: 'A heading, a list, a styled card and a button that runs JavaScript.',
      tip: 'Change the name in <h1>, add one more <li> item, or change the button colour in the CSS.',
      code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body   { font-family: Arial, sans-serif; padding: 24px; background: #f8fafc; }
    h1     { color: #0047AB; }
    .card  { background: white; padding: 16px; border-radius: 12px; max-width: 420px;
             box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
    button { background: #0047AB; color: white; border: 0; padding: 8px 14px;
             border-radius: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Namaste, I am Ram</h1>
  <div class="card">
    <p>I am a <b>civil engineer</b> learning GIS.</p>
    <ul>
      <li>Surveying</li>
      <li>Hydrology</li>
      <li>Web maps</li>
    </ul>
    <button onclick="greet()">Click me</button>
    <p id="msg"></p>
  </div>
  <script>
    function greet() {
      document.getElementById('msg').textContent = 'Thank you for clicking!';
      console.log('Button clicked');
    }
  </script>
</body>
</html>`,
    },
    {
      title: 'Plot area calculator (form + JS)',
      topic: 'HTML & CSS basics',
      level: 'Beginner',
      what: 'Type length and width; it shows the area in m², ropani and aana.',
      tip: 'Change the default numbers in value="..." or add a "bigha" line (1 bigha = 6772.63 m²).',
      code: `<!DOCTYPE html>
<html>
<head>
  <style>
    body  { font-family: Arial, sans-serif; padding: 24px; }
    input { width: 90px; padding: 6px; margin: 4px 8px 4px 0; }
    .out  { margin-top: 12px; font-size: 18px; color: #0047AB; }
  </style>
</head>
<body>
  <h2>Plot area calculator</h2>
  Length (m) <input id="len" type="number" value="25">
  Width (m)  <input id="wid" type="number" value="20">
  <div class="out" id="out"></div>
  <script>
    function calc() {
      const L = Number(document.getElementById('len').value);
      const W = Number(document.getElementById('wid').value);
      const m2 = L * W;
      const ropani = m2 / 508.72;
      const aana = m2 / 31.795;
      document.getElementById('out').innerHTML =
        m2.toFixed(2) + ' m²<br>' + ropani.toFixed(3) + ' ropani<br>' + aana.toFixed(2) + ' aana';
      console.log('Area:', m2, 'm²');
    }
    document.querySelectorAll('input').forEach((i) => i.addEventListener('input', calc));
    calc();
  </script>
</body>
</html>`,
    },
    {
      title: 'First web map (Leaflet)',
      topic: 'Web maps',
      level: 'Beginner',
      what: 'A street map of Kathmandu with a marker, a popup and a 500 m circle.',
      tip: 'Change the numbers in setView([27.7172, 85.3240], 13) to your own town, or the circle radius.',
      code: `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${LEAFLET}/leaflet.css">
  <script src="${LEAFLET}/leaflet.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map').setView([27.7172, 85.3240], 13);   // Kathmandu
    L.tileLayer('${STREET_TILES}', {
      maxZoom: 19, attribution: '${STREET_ATTR}'
    }).addTo(map);
    L.marker([27.7172, 85.3240]).addTo(map).bindPopup('<b>Kathmandu</b><br>Capital of Nepal').openPopup();
    L.circle([27.7056, 85.3143], { radius: 500, color: 'red' }).addTo(map).bindPopup('500 m buffer');
    console.log('Map ready, zoom', map.getZoom());
  </script>
</body>
</html>`,
    },
    {
      title: 'Click the map to get coordinates',
      topic: 'Web maps',
      level: 'Beginner',
      what: 'Every click adds a marker and prints its latitude and longitude.',
      tip: 'Click a few places, then change toFixed(5) to toFixed(6) for more decimals.',
      code: `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${LEAFLET}/leaflet.css">
  <script src="${LEAFLET}/leaflet.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map').setView([28.2096, 83.9856], 13);   // Pokhara
    L.tileLayer('${STREET_TILES}', { attribution: '${STREET_ATTR}' }).addTo(map);
    L.control.scale({ metric: true, imperial: false }).addTo(map);

    map.on('click', (e) => {
      const lat = e.latlng.lat.toFixed(5);
      const lng = e.latlng.lng.toFixed(5);
      L.marker(e.latlng).addTo(map).bindPopup('Lat ' + lat + '<br>Lng ' + lng).openPopup();
      console.log('Clicked:', lat, lng);
    });
    console.log('Click anywhere on the map');
  </script>
</body>
</html>`,
    },
    {
      title: 'Street / satellite / topo switcher',
      topic: 'Web maps',
      level: 'Intermediate',
      what: 'Three basemaps with a layer switcher and a scale bar.',
      tip: 'Use the switcher at the top right. Change the centre to your project site.',
      code: `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${LEAFLET}/leaflet.css">
  <script src="${LEAFLET}/leaflet.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const street = L.tileLayer('${STREET_TILES}', { attribution: '${STREET_ATTR}' });
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Imagery &copy; Esri' });
    const topo = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Topo &copy; Esri' });

    const map = L.map('map', { layers: [satellite] }).setView([27.6710, 85.4298], 15);   // Bhaktapur
    L.control.layers({ 'Street': street, 'Satellite': satellite, 'Topographic': topo }).addTo(map);
    L.control.scale({ imperial: false }).addTo(map);
    console.log('Switch basemaps with the control at the top right');
  </script>
</body>
</html>`,
    },
    {
      title: 'GeoJSON choropleth with popups',
      topic: 'Web maps',
      level: 'Intermediate',
      what: 'Ward polygons coloured by population, with a popup on each ward.',
      tip: 'Change a population number and run again: the colour of that ward changes.',
      code: `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="${LEAFLET}/leaflet.css">
  <script src="${LEAFLET}/leaflet.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
<div id="map"></div>
<script>
  const wards = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { ward: 1, population: 12500 },
        geometry: { type: 'Polygon', coordinates: [[[85.30,27.69],[85.32,27.69],[85.32,27.71],[85.30,27.71],[85.30,27.69]]] } },
      { type: 'Feature', properties: { ward: 2, population: 23800 },
        geometry: { type: 'Polygon', coordinates: [[[85.32,27.69],[85.34,27.69],[85.34,27.71],[85.32,27.71],[85.32,27.69]]] } },
      { type: 'Feature', properties: { ward: 3, population: 8400 },
        geometry: { type: 'Polygon', coordinates: [[[85.30,27.71],[85.34,27.71],[85.34,27.725],[85.30,27.725],[85.30,27.71]]] } }
    ]
  };
  const map = L.map('map');
  L.tileLayer('${STREET_TILES}', { attribution: '${STREET_ATTR}' }).addTo(map);
  const color = (p) => p > 20000 ? '#b91c1c' : p > 10000 ? '#f97316' : '#fde047';   // 3 classes
  const layer = L.geoJSON(wards, {
    style: (f) => ({ fillColor: color(f.properties.population), weight: 2, color: 'white', fillOpacity: 0.7 }),
    onEachFeature: (f, l) => l.bindPopup('Ward ' + f.properties.ward + ': ' + f.properties.population.toLocaleString() + ' people')
  }).addTo(map);
  map.fitBounds(layer.getBounds());
  console.log('Loaded', wards.features.length, 'wards');
</script>
</body>
</html>`,
    },
    {
      title: '3D terrain map (MapLibre GL)',
      topic: '3D & advanced maps',
      level: 'Advanced',
      what: 'Satellite imagery draped on a 3D elevation model of Mt. Everest.',
      tip: 'Change exaggeration: 1.5 to 3, or the pitch and bearing to change the view angle.',
      code: `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css">
  <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
<div id="map"></div>
<script>
  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        sat: { type: 'raster', tileSize: 256,
               tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
        dem: { type: 'raster-dem', encoding: 'terrarium', tileSize: 256,
               tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'] }
      },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
      terrain: { source: 'dem', exaggeration: 1.5 }
    },
    center: [86.925, 27.988],   // Mt. Everest
    zoom: 12, pitch: 70, bearing: -20
  });
  map.addControl(new maplibregl.NavigationControl());
  map.on('load', () => console.log('3D terrain loaded. Drag with the right mouse button to tilt.'));
</script>
</body>
</html>`,
    },
  ],

  python: [
    {
      title: 'Hello: variables and print',
      topic: 'Python basics',
      level: 'Beginner',
      what: 'Store text and numbers in variables and print a sentence with them.',
      tip: 'Change name = "Ram" to your own name and days = 12 to another number, then press Run.',
      code: `name = "Ram"
project = "Ring road drainage survey"
days = 12

print("Namaste,", name)
print(f"Project: {project}")
print(f"{name} will finish the survey in {days} days ({days * 8} working hours).")`,
    },
    {
      title: 'Unit converter: ropani, aana, bigha',
      topic: 'Python basics',
      level: 'Beginner',
      what: 'Convert an area in m² to Nepali land units, and feet to metres.',
      tip: 'Change area_m2 to your plot area. Add a line for kattha (1 kattha = 338.63 m²).',
      code: `area_m2 = 1250.0          # your plot area in square metres

ropani = area_m2 / 508.72
aana   = area_m2 / 31.795
bigha  = area_m2 / 6772.63
print(f"{area_m2} m² = {ropani:.3f} ropani = {aana:.2f} aana = {bigha:.4f} bigha")

height_ft = 32
print(f"{height_ft} ft = {height_ft * 0.3048:.2f} m")`,
    },
    {
      title: 'Lists and loops: levelling book (HI method)',
      topic: 'Python basics',
      level: 'Beginner',
      what: 'Reduce a levelling field book and run the arithmetic check.',
      tip: 'Change the BM RL (100.000) or any staff reading, and watch the RLs update.',
      code: `bm_rl = 100.000   # reduced level of the starting benchmark (m)

# (station, back sight, intermediate sight, fore sight)  — None = no reading
book = [
    ("BM1", 1.525, None,  None),
    ("A",   None,  1.840, None),
    ("B",   None,  2.105, None),
    ("TP1", 0.985, None,  2.310),
    ("C",   None,  1.450, None),
    ("BM2", None,  None,  1.120),
]

hi = None
rls = []
print(f"{'Station':8}{'HI':>10}{'RL':>10}")
for station, bs, ins, fs in book:
    if hi is None:
        rl = bm_rl
    else:
        rl = hi - (fs if fs is not None else ins)
    if bs is not None:
        hi = rl + bs            # new height of instrument after a back sight
    rls.append(rl)
    print(f"{station:8}{hi:10.3f}{rl:10.3f}")

sum_bs = sum(r[1] for r in book if r[1] is not None)
sum_fs = sum(r[3] for r in book if r[3] is not None)
print(f"\\nCheck: ΣBS − ΣFS = {sum_bs - sum_fs:.3f}   last RL − first RL = {rls[-1] - rls[0]:.3f}")`,
    },
    {
      title: 'Distance & bearing between two GPS points',
      topic: 'Surveying & coordinates',
      level: 'Beginner',
      what: 'Great-circle distance and bearing with the haversine formula.',
      tip: 'Put your own two GPS points in the last call (lat1, lon1, lat2, lon2).',
      code: `import math

def haversine_bearing(lat1, lon1, lat2, lon2):
    R = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    a = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    d = 2 * R * math.asin(math.sqrt(a))
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1)*math.sin(p2) - math.sin(p1)*math.cos(p2)*math.cos(dl)
    brg = (math.degrees(math.atan2(y, x)) + 360) % 360
    return d, brg

d, b = haversine_bearing(27.7172, 85.3240, 27.6710, 85.4298)  # Kathmandu → Bhaktapur
print(f"Distance: {d/1000:.3f} km, initial bearing: {b:.2f}°")`,
    },
    {
      title: 'Closed traverse: closing error and Bowditch',
      topic: 'Surveying & coordinates',
      level: 'Intermediate',
      what: 'Latitudes and departures, closing error, accuracy ratio and Bowditch corrections.',
      tip: 'Change one length or bearing slightly and see how the accuracy ratio changes.',
      code: `import math

# (line, length m, whole-circle bearing in degrees)
legs = [("A-B", 120.50, 45.00), ("B-C", 98.20, 135.50),
        ("C-D", 120.90, 225.20), ("D-A", 97.60, 314.10)]

lat = [L * math.cos(math.radians(b)) for _, L, b in legs]
dep = [L * math.sin(math.radians(b)) for _, L, b in legs]
perimeter = sum(L for _, L, _ in legs)
e_lat, e_dep = sum(lat), sum(dep)
closing = math.hypot(e_lat, e_dep)

print(f"Perimeter: {perimeter:.2f} m")
print(f"Closing error: {closing:.3f} m  (ΣLat {e_lat:+.3f}, ΣDep {e_dep:+.3f})")
print(f"Accuracy: 1 in {perimeter / closing:,.0f}\\n")

print(f"{'Line':5}{'Lat':>10}{'Dep':>10}{'Corr Lat':>11}{'Corr Dep':>11}")
for (name, L, _), la, de in zip(legs, lat, dep):
    c_lat = -e_lat * L / perimeter       # Bowditch: correction ∝ length
    c_dep = -e_dep * L / perimeter
    print(f"{name:5}{la:10.3f}{de:10.3f}{la + c_lat:11.3f}{de + c_dep:11.3f}")`,
    },
    {
      title: 'WGS84 → UTM and Nepal MUTM (pyproj)',
      topic: 'Surveying & coordinates',
      level: 'Intermediate',
      what: 'Convert GPS coordinates to UTM and to the Nepal MUTM grid (Everest 1830).',
      tip: 'Add your own place to the points dictionary as "Name": (longitude, latitude).',
      code: `from pyproj import Transformer

mutm = lambda cm: (f"+proj=tmerc +lat_0=0 +lon_0={cm} +k=0.9999 +x_0=500000 +y_0=0 "
                   "+a=6377276.345 +rf=300.8017 +towgs84=293.17,726.18,245.36,0,0,0,0 +units=m")
points = {"Kathmandu": (85.3240, 27.7172), "Pokhara": (83.9856, 28.2096), "Biratnagar": (87.2718, 26.4525)}
for name, (lon, lat) in points.items():
    cm = 81 if lon < 82.5 else 84 if lon < 85.5 else 87
    zone = int((lon + 180) // 6) + 1
    e, n = Transformer.from_crs("EPSG:4326", f"EPSG:{32600+zone}", always_xy=True).transform(lon, lat)
    me, mn = Transformer.from_crs("EPSG:4326", mutm(cm), always_xy=True).transform(lon, lat)
    print(f"{name:11s} UTM{zone}N {e:12.2f} {n:12.2f} | MUTM{cm} {me:12.2f} {mn:12.2f}")`,
    },
    {
      title: 'Plot area → ropani & bigha (shapely)',
      topic: 'Land & geometry',
      level: 'Intermediate',
      what: 'Area and perimeter of a surveyed plot, reported in R-A-P-D.',
      tip: 'Replace the four corner coordinates with your own total-station points (E, N).',
      code: `from shapely.geometry import Polygon

# Total-station coordinates (E, N) in metres
plot = Polygon([(334512.10, 3066820.44), (334548.72, 3066824.10),
                (334551.05, 3066790.33), (334515.60, 3066785.90)])
a = plot.area
r = a / 508.72
print(f"Area: {a:.2f} m²  |  perimeter: {plot.length:.2f} m")
print(f"Ropani: {r:.4f}  |  Bigha: {a/6772.63:.4f}  |  Kattha: {a/338.63:.3f}")

daam = a / 1.9871875
R, daam = divmod(daam, 256); A, daam = divmod(daam, 16); P, daam = divmod(daam, 4)
print(f"R-A-P-D: {int(R)}-{int(A)}-{int(P)}-{daam:.2f}")`,
    },
    {
      title: 'Peak runoff with the rational method',
      topic: 'Hydrology',
      level: 'Beginner',
      what: 'Q = C·i·A/360 for a small catchment with mixed land cover.',
      tip: 'Change the areas, the C values or the rainfall intensity i and see Q change.',
      code: `# Part areas (ha) and runoff coefficients C
parts = {
    "Forest":       (1.8, 0.20),
    "Cultivated":   (0.9, 0.40),
    "Road & roofs": (0.3, 0.90),
}
i = 85.0     # rainfall intensity (mm/hr) for the time of concentration

A = sum(a for a, c in parts.values())
C = sum(a * c for a, c in parts.values()) / A      # area-weighted C
Q = C * i * A / 360                                # m³/s  (A in ha, i in mm/hr)

print(f"Total area: {A:.2f} ha, weighted C = {C:.3f}")
print(f"Peak runoff Q = {Q:.3f} m³/s")`,
    },
    {
      title: 'Design rainfall (Gumbel) + plot',
      topic: 'Hydrology',
      level: 'Intermediate',
      what: 'Gumbel EV1 frequency analysis of annual maximum rainfall, with a chart.',
      tip: 'Replace annual_max with your station\'s yearly maximum 1-day rainfall.',
      code: `import math, statistics as st
import matplotlib.pyplot as plt

annual_max = [98, 121, 87, 143, 110, 156, 102, 131, 95, 168, 117, 124, 139, 108, 150]
m, s = st.mean(annual_max), st.stdev(annual_max)
K = lambda T: -(math.sqrt(6)/math.pi) * (0.5772 + math.log(math.log(T/(T-1))))
Ts = [2, 5, 10, 25, 50, 100]
xs = [m + K(T)*s for T in Ts]
for T, x in zip(Ts, xs):
    print(f"{T:>3}-yr 1-day rainfall: {x:6.1f} mm")

plt.semilogx(Ts, xs, "o-", color="#0047AB")
plt.xlabel("Return period (years)"); plt.ylabel("1-day rainfall (mm)")
plt.title("Gumbel EV1 frequency curve"); plt.grid(True, alpha=.3)`,
    },
    {
      title: 'pandas: rainfall table statistics',
      topic: 'Data & tables',
      level: 'Intermediate',
      what: 'Group a rainfall table by station and pivot it by month.',
      tip: 'Add a third station (4 more rows) and run again.',
      code: `import pandas as pd

df = pd.DataFrame({
    "station": ["Kathmandu"]*4 + ["Pokhara"]*4,
    "month":   ["Jun", "Jul", "Aug", "Sep"]*2,
    "rain_mm": [240, 380, 350, 190, 620, 890, 760, 480],
})
summary = df.groupby("station")["rain_mm"].agg(["sum", "mean", "max"])
print(summary)
print()
print(df.pivot(index="month", columns="station", values="rain_mm"))`,
    },
    {
      title: 'NDVI from satellite bands (numpy)',
      topic: 'Remote sensing',
      level: 'Intermediate',
      what: 'Compute NDVI from red and near-infrared reflectance and classify it.',
      tip: 'Change some red or nir values: high NIR + low red = healthy vegetation.',
      code: `import numpy as np
import matplotlib.pyplot as plt

# 4 × 4 pixels of surface reflectance (Sentinel-2 bands B4 = red, B8 = NIR)
red = np.array([[0.04, 0.05, 0.12, 0.20],
                [0.05, 0.06, 0.15, 0.22],
                [0.03, 0.08, 0.10, 0.18],
                [0.06, 0.04, 0.09, 0.25]])
nir = np.array([[0.02, 0.03, 0.30, 0.25],
                [0.40, 0.45, 0.32, 0.26],
                [0.42, 0.38, 0.35, 0.24],
                [0.50, 0.48, 0.36, 0.27]])

ndvi = (nir - red) / (nir + red)
print("NDVI:\\n", np.round(ndvi, 2))

classes = np.select([ndvi < 0, ndvi < 0.2, ndvi < 0.5], ["Water", "Bare/built", "Sparse veg"], "Dense veg")
for name in ["Water", "Bare/built", "Sparse veg", "Dense veg"]:
    print(f"{name:11s}: {np.sum(classes == name)} pixels")

plt.imshow(ndvi, cmap="RdYlGn", vmin=-1, vmax=1)
plt.colorbar(label="NDVI"); plt.title("NDVI")`,
    },
    {
      title: 'Land-cover classification (scikit-learn)',
      topic: 'Remote sensing',
      level: 'Advanced',
      what: 'Train a Random Forest on sample pixels, check accuracy and classify a new pixel.',
      tip: 'Change new_pixel to other reflectance values, or n_estimators to 20 and compare accuracy.',
      code: `import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix

rng = np.random.default_rng(42)
# Typical reflectance per class: blue, green, red, NIR, SWIR1
centres = {
    "Water":  [0.06, 0.07, 0.05, 0.03, 0.02],
    "Forest": [0.03, 0.06, 0.04, 0.35, 0.15],
    "Built":  [0.12, 0.13, 0.15, 0.22, 0.25],
    "Crop":   [0.05, 0.09, 0.07, 0.42, 0.22],
}
X = np.vstack([rng.normal(c, 0.02, size=(150, 5)) for c in centres.values()])
y = np.repeat(list(centres), 150)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=0, stratify=y)
model = RandomForestClassifier(n_estimators=100, random_state=0).fit(X_train, y_train)
pred = model.predict(X_test)

print(f"Overall accuracy: {accuracy_score(y_test, pred) * 100:.1f} %")
print("Confusion matrix (rows = true, cols = predicted):", list(centres))
print(confusion_matrix(y_test, pred, labels=list(centres)))

new_pixel = [[0.04, 0.07, 0.05, 0.38, 0.18]]
print("\\nNew pixel is classified as:", model.predict(new_pixel)[0])`,
    },
  ],

  javascript: [
    {
      title: 'Variables, functions and console.log',
      topic: 'JavaScript basics',
      level: 'Beginner',
      what: 'Store values, write a function and print the result.',
      tip: 'Change the name or the slope numbers and run again.',
      code: `const engineer = 'Ram';
const rise = 4.5;      // m
const run = 60;        // m

function slopePercent(rise, run) {
  return (rise / run) * 100;
}

console.log('Hello,', engineer);
console.log('Road gradient:', slopePercent(rise, run).toFixed(2), '%');
console.log('Steeper than 12%?', slopePercent(rise, run) > 12 ? 'yes' : 'no');`,
    },
    {
      title: 'Arrays: filter and sum survey points',
      topic: 'JavaScript basics',
      level: 'Beginner',
      what: 'Use filter, map and reduce on a list of survey points.',
      tip: 'Add another point object to the array, or change the 1305 m cut-off.',
      code: `const points = [
  { name: 'BM1', rl: 1301.25 },
  { name: 'TP1', rl: 1303.80 },
  { name: 'TP2', rl: 1306.42 },
  { name: 'BM2', rl: 1308.12 },
  { name: 'TP3', rl: 1305.98 },
];

const high = points.filter((p) => p.rl > 1305);
console.log('Points above 1305 m:', high.map((p) => p.name).join(', '));

const avg = points.reduce((sum, p) => sum + p.rl, 0) / points.length;
console.log('Average RL:', avg.toFixed(3), 'm');

const highest = points.reduce((a, b) => (b.rl > a.rl ? b : a));
console.log('Highest point:', highest.name, highest.rl);`,
    },
    {
      title: 'Turf: buffer, area & length',
      topic: 'Geospatial with Turf.js',
      level: 'Intermediate',
      what: 'Length of a road, area of a 30 m corridor around it, in m² and ropani.',
      tip: 'Change the buffer from 15 to 25 m and compare the corridor area.',
      code: `const road = turf.lineString([[85.3100, 27.7000], [85.3160, 27.7030], [85.3200, 27.7025]]);
const corridor = turf.buffer(road, 15, { units: 'meters' });
console.log('Road length (m):', (turf.length(road) * 1000).toFixed(1));
console.log('30 m corridor area (m²):', turf.area(corridor).toFixed(0));
console.log('Ropani:', (turf.area(corridor) / 508.72).toFixed(2));`,
    },
    {
      title: 'Which ward is this house in?',
      topic: 'Geospatial with Turf.js',
      level: 'Intermediate',
      what: 'Point-in-polygon test of houses against ward polygons.',
      tip: 'Add a new house coordinate [lng, lat] to the houses list.',
      code: `const wards = turf.featureCollection([
  turf.polygon([[[85.30, 27.69], [85.32, 27.69], [85.32, 27.71], [85.30, 27.71], [85.30, 27.69]]], { ward: 1 }),
  turf.polygon([[[85.32, 27.69], [85.34, 27.69], [85.34, 27.71], [85.32, 27.71], [85.32, 27.69]]], { ward: 2 }),
]);
const houses = [[85.305, 27.70], [85.335, 27.695], [85.36, 27.70]];
houses.forEach(([lng, lat], i) => {
  const hit = wards.features.find((w) => turf.booleanPointInPolygon(turf.point([lng, lat]), w));
  console.log(\`House \${i + 1}: \${hit ? 'Ward ' + hit.properties.ward : 'outside all wards'}\`);
});`,
    },
    {
      title: 'Nearest health post',
      topic: 'Geospatial with Turf.js',
      level: 'Intermediate',
      what: 'Find the closest facility to a site and list all distances.',
      tip: 'Move the site coordinates and see which health post becomes the nearest.',
      code: `const site = turf.point([85.3240, 27.7172], { name: 'Project site' });
const posts = turf.featureCollection([
  turf.point([85.3300, 27.7100], { name: 'Health Post A' }),
  turf.point([85.3100, 27.7250], { name: 'Health Post B' }),
  turf.point([85.3420, 27.7300], { name: 'Health Post C' }),
]);

const nearest = turf.nearestPoint(site, posts);
console.log('Nearest:', nearest.properties.name, '→', nearest.properties.distanceToPoint.toFixed(2), 'km');

posts.features.forEach((p) => {
  const km = turf.distance(site, p);
  console.log(p.properties.name.padEnd(14), km.toFixed(2), 'km');
});`,
    },
    {
      title: 'Chainage points every 50 m',
      topic: 'Geospatial with Turf.js',
      level: 'Advanced',
      what: 'Coordinates of chainage points along a road alignment.',
      tip: 'Change the 50 m interval to 20 m, or add a vertex to the alignment.',
      code: `const line = turf.lineString([[85.300, 27.700], [85.305, 27.703], [85.312, 27.704]]);
const len = turf.length(line, { units: 'meters' });
for (let ch = 0; ch <= len; ch += 50) {
  const p = turf.along(line, ch, { units: 'meters' });
  const [lng, lat] = p.geometry.coordinates;
  console.log(\`Ch \${String(ch).padStart(4)} m  →  \${lat.toFixed(6)}, \${lng.toFixed(6)}\`);
}
console.log('Total length:', len.toFixed(1), 'm');`,
    },
  ],

  sql: [
    {
      title: 'See a whole table',
      topic: 'SQL basics',
      level: 'Beginner',
      what: 'SELECT * shows every column and row of a table.',
      tip: 'Change parcels to survey_points or rainfall to see the other tables.',
      code: `SELECT * FROM parcels;`,
    },
    {
      title: 'Filter and sort: benchmarks by RL',
      topic: 'SQL basics',
      level: 'Beginner',
      what: 'WHERE keeps matching rows; ORDER BY sorts them.',
      tip: "Change 'BM' to 'TP', or DESC to ASC.",
      code: `SELECT name, easting, northing, rl
FROM survey_points
WHERE type = 'BM'
ORDER BY rl DESC;`,
    },
    {
      title: 'Parcel area per ward (ropani)',
      topic: 'Grouping & totals',
      level: 'Intermediate',
      what: 'GROUP BY with COUNT and SUM, converted to ropani.',
      tip: 'Group by land_use instead of ward.',
      code: `SELECT ward,
       COUNT(*) AS parcels,
       ROUND(SUM(area_m2), 1) AS total_m2,
       ROUND(SUM(area_m2) / 508.72, 2) AS ropani
FROM parcels
GROUP BY ward
ORDER BY total_m2 DESC;`,
    },
    {
      title: 'Monsoon rainfall by station',
      topic: 'Grouping & totals',
      level: 'Intermediate',
      what: 'Totals for June–September only, per station.',
      tip: 'Change the months to (5, 6) to see pre-monsoon totals.',
      code: `SELECT station, district,
       SUM(rain_mm) AS monsoon_total_mm,
       MAX(rain_mm) AS wettest_month_mm
FROM rainfall
WHERE month IN (6, 7, 8, 9)
GROUP BY station, district
ORDER BY monsoon_total_mm DESC;`,
    },
    {
      title: 'Classify parcels by size (CASE)',
      topic: 'Grouping & totals',
      level: 'Intermediate',
      what: 'CASE WHEN puts each parcel into a size class.',
      tip: 'Change the 1000 m² limit or add a "Very large" class.',
      code: `SELECT parcel_id, owner, area_m2,
       CASE
         WHEN area_m2 < 508.72 THEN 'Under 1 ropani'
         WHEN area_m2 < 1000   THEN 'Medium'
         ELSE 'Large'
       END AS size_class
FROM parcels
ORDER BY area_m2;`,
    },
    {
      title: 'Distance between survey points (self-join)',
      topic: 'Joins & calculations',
      level: 'Advanced',
      what: 'Join a table to itself to get distance and height difference between stations.',
      tip: 'Remove ROUND to see full precision, or join on b.id = a.id + 2.',
      code: `SELECT a.name AS from_pt, b.name AS to_pt,
       ROUND(sqrt((b.easting - a.easting) * (b.easting - a.easting) +
                  (b.northing - a.northing) * (b.northing - a.northing)), 3) AS dist_m,
       ROUND(b.rl - a.rl, 3) AS dh_m
FROM survey_points a JOIN survey_points b ON b.id = a.id + 1;`,
    },
  ],
};

// Group a language's examples by topic, keeping the order they appear in.
export function groupByTopic(list) {
  const groups = [];
  list.forEach((ex, index) => {
    let g = groups.find((x) => x.topic === ex.topic);
    if (!g) {
      g = { topic: ex.topic, items: [] };
      groups.push(g);
    }
    g.items.push({ ...ex, index });
  });
  return groups;
}

// OpenStreetMap's tile servers return "403 Access blocked" to embedded previews.
// Swap them for Esri street tiles so pasted lesson / AI code still shows a map.
const OSM_TILE_RE = /https?:\/\/(?:\{s\}\.|[abc]\.)?tile\.openstreetmap\.org\/\{z\}\/\{x\}\/\{y\}\.png/g;
export function fixBlockedTiles(html) {
  let changed = false;
  const out = html.replace(OSM_TILE_RE, () => {
    changed = true;
    return STREET_TILES;
  });
  return { html: out, changed };
}
