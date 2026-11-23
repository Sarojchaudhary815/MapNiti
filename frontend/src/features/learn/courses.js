// Course content for "Learn GIS". Lessons are Markdown; ```python / ```javascript
// / ```sql blocks get a "Try it" button that opens them in the Code Lab.
// ```gee blocks are Earth Engine Code Editor scripts (copy → code.earthengine.google.com).

export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export const COURSES = [
  // =======================================================================
  {
    id: 'gis-fundamentals',
    title: 'GIS Fundamentals',
    level: 'Beginner',
    color: 'emerald',
    summary: 'What GIS is, vector vs raster, coordinate systems (incl. Nepal MUTM), scale and file formats.',
    lessons: [
      {
        id: 'what-is-gis',
        title: 'What is GIS and why engineers need it',
        minutes: 8,
        body: `# What is GIS?
A **Geographic Information System (GIS)** stores, analyses and displays data that has a **location**. Every record answers "what" *and* "where".

## Where engineers use it every day
- **Road & highway**: alignment selection, slope analysis, cut/fill, land acquisition maps.
- **Water resources**: watershed delineation, flood mapping, irrigation command areas.
- **Urban planning**: land-use zoning, building permits, infrastructure networks.
- **Surveying / cadastral**: parcel maps, control points, area verification.
- **Disaster risk**: landslide and flood hazard maps, evacuation planning.

## The 5 components of GIS
1. **Data** – maps, satellite images, survey points, tables
2. **Software** – QGIS, ArcGIS, Google Earth Engine, MapNiti
3. **Hardware** – computers, GNSS receivers, drones, total stations
4. **People** – analysts, engineers, planners
5. **Methods** – the analysis workflows you apply

> Tip: QGIS is free and professional-grade. Install it alongside MapNiti to practise desktop GIS.

## Your first spatial calculation
Distance between two places on Earth uses the **haversine** formula (the Earth is a sphere, not a flat sheet):

\`\`\`python
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0088  # mean Earth radius, km
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

kathmandu = (27.7172, 85.3240)
pokhara   = (28.2096, 83.9856)
print(f"Kathmandu → Pokhara (straight line): {haversine(*kathmandu, *pokhara):.1f} km")
\`\`\``,
      },
      {
        id: 'vector-raster',
        title: 'Vector vs raster data',
        minutes: 10,
        body: `# Two ways to represent the world

## Vector — points, lines, polygons
| Type | Engineering examples |
|---|---|
| Point | Survey stations, bridges, boreholes, electric poles |
| Line | Roads, rivers, canals, pipelines, contours |
| Polygon | Parcels, buildings, wards, watersheds |

Vectors are precise and carry **attribute tables** (road width, surface type, owner name).

## Raster — a grid of cells (pixels)
Each cell holds a value: elevation (DEM), rainfall, land cover class, NDVI.
- **Resolution** = cell size. SRTM DEM = 30 m, Sentinel-2 = 10 m, CHIRPS rainfall ≈ 5.5 km.
- Great for continuous surfaces and satellite imagery.

## Which to use?
- Parcel boundaries → **vector**
- Terrain slope for a whole municipality → **raster**
- Often you **combine** them: clip a DEM (raster) with a ward boundary (vector).

## Try it: a tiny raster in Python
\`\`\`python
import numpy as np

# 5x5 DEM (metres) — each cell 30 m
dem = np.array([
    [1300, 1305, 1312, 1320, 1330],
    [1298, 1302, 1308, 1318, 1326],
    [1295, 1299, 1304, 1312, 1321],
    [1291, 1296, 1300, 1307, 1315],
    [1288, 1292, 1297, 1303, 1310],
], dtype=float)
cell = 30.0
dz_dy, dz_dx = np.gradient(dem, cell)
slope_deg = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
print("Mean elevation:", dem.mean().round(1), "m")
print("Slope (degrees):")
print(slope_deg.round(1))
\`\`\``,
      },
      {
        id: 'crs',
        title: 'Coordinate systems: WGS84, UTM and Nepal MUTM',
        minutes: 14,
        body: `# Coordinate Reference Systems (CRS)

## Geographic vs projected
- **Geographic (lat/long)** — angles on an ellipsoid. GPS gives **WGS84** (EPSG:4326). Not good for measuring distance/area directly.
- **Projected (metres)** — the ellipsoid is flattened onto a plane. Use these for engineering measurements.

## Systems you'll meet in Nepal
| CRS | Use | Details |
|---|---|---|
| WGS84 (EPSG:4326) | GPS, web maps, GEE | lat/long degrees |
| UTM 44N (EPSG:32644) | West of 84°E | metres, WGS84 |
| UTM 45N (EPSG:32645) | East of 84°E | metres, WGS84 |
| **MUTM 81 / 84 / 87** | Survey Department cadastral maps | Everest 1830 ellipsoid, Transverse Mercator, k₀ = 0.9999, FE 500 000 m |

> Mixing CRSs is the #1 beginner mistake: a layer in MUTM will land in the wrong place if QGIS thinks it is WGS84. Always check the CRS of every layer.

## Datum shift
MUTM uses the **Everest 1830** ellipsoid with the Nepal (Nagarkot) datum. Converting to WGS84 needs a datum transformation. A common 3-parameter shift is dX=293.17, dY=726.18, dZ=245.36 m. The Survey Department publishes more precise parameters for cadastral work.

MapNiti's **Engineer Toolkit → Coordinate converter** does WGS84 ↔ UTM ↔ MUTM for you.

## Try it: pyproj
\`\`\`python
from pyproj import Transformer

mutm84 = ("+proj=tmerc +lat_0=0 +lon_0=84 +k=0.9999 +x_0=500000 +y_0=0 "
          "+a=6377276.345 +rf=300.8017 +towgs84=293.17,726.18,245.36,0,0,0,0 +units=m")
to_mutm = Transformer.from_crs("EPSG:4326", mutm84, always_xy=True)
to_utm  = Transformer.from_crs("EPSG:4326", "EPSG:32645", always_xy=True)

lon, lat = 85.3240, 27.7172  # Kathmandu
print("MUTM 84 :", [round(v, 2) for v in to_mutm.transform(lon, lat)])
print("UTM 45N :", [round(v, 2) for v in to_utm.transform(lon, lat)])
\`\`\``,
      },
      {
        id: 'formats',
        title: 'Map scale and GIS file formats',
        minutes: 8,
        body: `# Scale
Map scale 1:25 000 means 1 cm on the map = 250 m on the ground. Nepal's national topographic sheets are 1:25 000 (Terai and hills) and 1:50 000 (mountains). Cadastral sheets are typically 1:500 – 1:2 500.

**Rule of thumb:** don't use data at a larger scale than it was made for. A 30 m DEM cannot design a 5 m-wide drain.

# Common formats
| Format | Type | Notes |
|---|---|---|
| Shapefile (.shp + .shx + .dbf + .prj) | Vector | Old but everywhere; keep all files together; 10-char field names |
| **GeoPackage (.gpkg)** | Vector + raster | Modern single file — prefer this |
| GeoJSON (.geojson) | Vector | Web-friendly, always WGS84. MapNiti uploads use this |
| KML / KMZ | Vector | Google Earth |
| **GeoTIFF (.tif)** | Raster | DEMs, imagery; MapNiti/GEE downloads |
| CSV with X,Y | Points | Survey exports — import as delimited text in QGIS |
| DXF / DWG | CAD | AutoCAD / Civil 3D — QGIS can read DXF |

## Try it: build GeoJSON in JavaScript
\`\`\`javascript
const survey = [
  { id: 'BM1', lat: 27.7001, lon: 85.3102, rl: 1301.25 },
  { id: 'TP1', lat: 27.7012, lon: 85.3125, rl: 1303.80 },
  { id: 'TP2', lat: 27.7030, lon: 85.3141, rl: 1306.42 },
];
const geojson = {
  type: 'FeatureCollection',
  features: survey.map(p => ({
    type: 'Feature',
    properties: { id: p.id, rl: p.rl },
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, // [lon, lat] order!
  })),
};
console.log(JSON.stringify(geojson, null, 2));
\`\`\``,
      },
    ],
  },

  // =======================================================================
  {
    id: 'remote-sensing',
    title: 'Remote Sensing Basics',
    level: 'Beginner',
    color: 'sky',
    summary: 'Satellites, spectral bands, NDVI/NDWI/NDBI, radar, and choosing the right imagery.',
    lessons: [
      {
        id: 'em-spectrum',
        title: 'Bands, spectrum and the satellites you can use for free',
        minutes: 10,
        body: `# How satellites "see"
Sensors record reflected energy in **bands** (wavelength ranges). Plants reflect strongly in **near-infrared (NIR)**, water absorbs NIR, and built-up areas are bright in **short-wave infrared (SWIR)**.

| Satellite | Resolution | Revisit | Best for |
|---|---|---|---|
| **Sentinel-2** | 10 m | 5 days | Land cover, crops, NDVI, urban |
| **Landsat 8/9** | 30 m | 8 days (combined) | Long history since 1984, change detection |
| **Sentinel-1 (radar)** | 10 m | 6–12 days | Floods & cloudy monsoon, sees through clouds |
| MODIS | 250 m – 1 km | Daily | Regional vegetation, temperature, snow |
| SRTM / Copernicus DEM | 30 m | — | Terrain |

## Sentinel-2 band names
B2 = Blue, B3 = Green, B4 = Red, **B8 = NIR**, B11/B12 = SWIR.

> In MapNiti the **GEE Data Hub** loads Sentinel-2, Landsat and Sentinel-1 for any AOI and dates without downloading anything.`,
      },
      {
        id: 'indices',
        title: 'Spectral indices: NDVI, NDWI, NDBI',
        minutes: 12,
        body: `# Normalised difference indices
All three use the same idea: **(A − B) / (A + B)**, giving values from −1 to +1.

| Index | Formula (Sentinel-2) | High value means |
|---|---|---|
| NDVI | (NIR − Red)/(NIR + Red) = (B8−B4)/(B8+B4) | Healthy vegetation (> 0.5 dense) |
| NDWI | (Green − NIR)/(Green + NIR) = (B3−B8)/(B3+B8) | Open water (> 0) |
| NDBI | (SWIR − NIR)/(SWIR + NIR) = (B11−B8)/(B11+B8) | Built-up / bare |

## Try it: NDVI from pixel values
\`\`\`python
import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(1)
red = rng.uniform(0.03, 0.25, (60, 60))
nir = rng.uniform(0.15, 0.55, (60, 60))
nir[20:40, 20:40] = 0.05     # a pond
red[20:40, 20:40] = 0.04

ndvi = (nir - red) / (nir + red)
print("Mean NDVI:", ndvi.mean().round(3))
print("Vegetated share (NDVI>0.4):", f"{(ndvi > 0.4).mean()*100:.1f}%")

plt.imshow(ndvi, cmap="RdYlGn", vmin=-0.2, vmax=0.8)
plt.colorbar(label="NDVI")
plt.title("Synthetic NDVI")
\`\`\`

## The same in Google Earth Engine
\`\`\`gee
var aoi = ee.Geometry.Rectangle([85.25, 27.65, 85.40, 27.75]);
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi).filterDate('2024-10-01', '2024-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .median().clip(aoi);
var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');
Map.centerObject(aoi, 12);
Map.addLayer(ndvi, {min: -0.2, max: 0.8, palette: ['brown', 'yellow', 'green']}, 'NDVI');
\`\`\``,
      },
      {
        id: 'classification',
        title: 'Image classification & land cover',
        minutes: 10,
        body: `# Turning pixels into classes
**Land Use / Land Cover (LULC)** maps label each pixel: water, forest, cropland, built-up...

## Two approaches
- **Supervised** — you digitise training samples per class, then an algorithm (Random Forest, SVM) learns and classifies. Most accurate.
- **Unsupervised** — the algorithm (k-means) groups similar pixels; you name clusters afterwards.

## Ready-made global maps (no training needed)
- **ESA WorldCover 10 m** (2020/2021) — 11 classes
- **Dynamic World** — 10 m, any date, near real-time
- Both are in MapNiti's GEE Data Hub with area per class.

## Accuracy assessment
Always check results against ground truth with a **confusion matrix**: overall accuracy, producer's / user's accuracy and Kappa. Aim for > 85% overall accuracy for engineering use.

\`\`\`python
import numpy as np
# rows = reference, cols = classified   (water, forest, built, crop)
cm = np.array([[48, 1, 0, 1],
               [ 2,90, 3, 5],
               [ 0, 2,60, 8],
               [ 1, 6, 4,79]])
overall = np.trace(cm) / cm.sum()
producers = np.diag(cm) / cm.sum(axis=1)
users = np.diag(cm) / cm.sum(axis=0)
pe = (cm.sum(0) * cm.sum(1)).sum() / cm.sum()**2
kappa = (overall - pe) / (1 - pe)
print(f"Overall accuracy: {overall:.2%}   Kappa: {kappa:.3f}")
for n, p, u in zip(["Water","Forest","Built","Crop"], producers, users):
    print(f"{n:7s} producer {p:.2%}  user {u:.2%}")
\`\`\``,
      },
    ],
  },

  // =======================================================================
  {
    id: 'spatial-analysis',
    title: 'Spatial Analysis Toolkit',
    level: 'Intermediate',
    color: 'indigo',
    summary: 'Buffers, overlays, terrain analysis, map algebra, interpolation and suitability analysis.',
    lessons: [
      {
        id: 'buffer-overlay',
        title: 'Buffer, clip, intersect & dissolve',
        minutes: 12,
        body: `# The core vector operations
| Tool | Question it answers | Example |
|---|---|---|
| **Buffer** | What is within X m? | 6 m road right-of-way, 30 m river setback |
| **Clip** | Keep only what's inside a boundary | Roads inside Ward 5 |
| **Intersect** | Where do two layers overlap (keep both attributes)? | Parcels affected by a new road buffer |
| **Union** | Combine everything | Merge two land-use maps |
| **Dissolve** | Merge features by attribute | Wards → municipality |

## Try it with Turf.js (runs in your browser)
\`\`\`javascript
// A road centreline and a parcel; find the land needed for a 10 m wide road (5 m each side)
const road = turf.lineString([[85.3100, 27.7000], [85.3160, 27.7030]]);
const parcel = turf.polygon([[[85.3120, 27.7000], [85.3140, 27.7000], [85.3140, 27.7025], [85.3120, 27.7025], [85.3120, 27.7000]]]);

const row = turf.buffer(road, 5, { units: 'meters' });
const affected = turf.intersect(turf.featureCollection([row, parcel]));

console.log('Parcel area (m²):', turf.area(parcel).toFixed(1));
console.log('Land to acquire (m²):', affected ? turf.area(affected).toFixed(1) : 0);
console.log('Road length (m):', (turf.length(road) * 1000).toFixed(1));
\`\`\``,
      },
      {
        id: 'terrain',
        title: 'Terrain analysis: slope, aspect, contours, hillshade',
        minutes: 12,
        body: `# Working with DEMs
- **Slope** — steepness (degrees or %). % = tan(degrees) × 100.
- **Aspect** — direction a slope faces (0° = north).
- **Contours** — lines of equal elevation (e.g. every 5 m for planning, 1 m for design).
- **Hillshade** — shaded relief for maps.
- **Flow direction / accumulation** — basis of watershed and stream delineation.

## Slope classes engineers use
| Slope | Typical implication |
|---|---|
| 0–5° | Flat — drainage/ponding is the concern |
| 5–15° | Gentle — good for settlements and roads |
| 15–25° | Moderate — terracing, retaining structures |
| 25–35° | Steep — landslide checks, bio-engineering |
| > 35° | Very steep — avoid construction without detailed geotech |

MapNiti **Engineer Toolkit → Site Report** computes these class areas for any AOI.

\`\`\`python
import numpy as np
deg = np.array([2, 8, 14, 22, 30, 41])
pct = np.tan(np.radians(deg)) * 100
for d, p in zip(deg, pct):
    print(f"{d:>3}°  = {p:6.1f} %   = 1 in {100/p:5.1f}")
\`\`\``,
      },
      {
        id: 'map-algebra',
        title: 'Map algebra & weighted overlay (site suitability)',
        minutes: 14,
        body: `# Map algebra
Rasters of the same grid can be combined cell-by-cell with maths: \`NDVI = (NIR - RED)/(NIR + RED)\`, \`suitable = slope < 15 AND distance_to_road < 500\`.

# Weighted overlay (multi-criteria)
1. Choose criteria (slope, distance to road, land cover, flood risk...)
2. **Reclassify** each into a common score (e.g. 1 = poor … 5 = best)
3. Assign **weights** summing to 1 (AHP pairwise comparison is common)
4. Suitability = Σ (weight × score)

\`\`\`python
import numpy as np
rng = np.random.default_rng(7)
slope = rng.uniform(0, 40, (8, 8))        # degrees
dist_road = rng.uniform(0, 2000, (8, 8))  # m
flood = rng.integers(0, 2, (8, 8))        # 1 = flood-prone

score_slope = np.select([slope < 5, slope < 15, slope < 25], [5, 4, 2], 1)
score_road  = np.select([dist_road < 250, dist_road < 750, dist_road < 1500], [5, 4, 2], 1)
score_flood = np.where(flood == 1, 1, 5)

w = {"slope": 0.45, "road": 0.30, "flood": 0.25}
suit = w["slope"]*score_slope + w["road"]*score_road + w["flood"]*score_flood
print("Suitability (1–5):")
print(suit.round(1))
print("Best cell (row, col):", np.unravel_index(suit.argmax(), suit.shape))
\`\`\``,
      },
      {
        id: 'interpolation',
        title: 'Interpolation: from survey points to surfaces',
        minutes: 12,
        body: `# Interpolation
You surveyed spot heights or rain gauges — how do you estimate values between them?

| Method | Idea | Use |
|---|---|---|
| **IDW** (inverse distance) | Closer points matter more | Quick rainfall / level surfaces |
| **TIN** | Triangles between points | Survey DTMs, contours in Civil 3D |
| **Kriging** | Statistical, models spatial correlation | Soil properties, groundwater |
| Thiessen polygons | Nearest station wins | Catchment rainfall averaging |

\`\`\`python
import numpy as np
# rain gauges: x (km), y (km), annual rainfall (mm)
g = np.array([[0, 0, 1450], [10, 2, 1720], [4, 9, 2100], [12, 11, 1890]])

def idw(x, y, power=2):
    d = np.hypot(g[:, 0] - x, g[:, 1] - y)
    if (d < 1e-9).any():
        return g[d.argmin(), 2]
    w = 1 / d**power
    return (w * g[:, 2]).sum() / w.sum()

for x, y in [(5, 5), (2, 1), (11, 9)]:
    print(f"Estimated rainfall at ({x},{y}) km: {idw(x, y):.0f} mm")
\`\`\``,
      },
    ],
  },

  // =======================================================================
  {
    id: 'python-gis',
    title: 'Python for GIS & Engineering',
    level: 'Intermediate',
    color: 'amber',
    summary: 'Python basics, pandas for survey data, shapely geometry, and hydrology statistics.',
    lessons: [
      {
        id: 'python-basics',
        title: 'Python essentials for engineers',
        minutes: 12,
        body: `# Why Python?
Automate repetitive calculations, process thousands of survey points, and drive QGIS, GDAL and Earth Engine.

## Variables, lists, loops, functions
\`\`\`python
# Rational method for several catchments
catchments = [
    {"name": "C1", "C": 0.45, "i": 110, "A_ha": 12.0},
    {"name": "C2", "C": 0.70, "i": 125, "A_ha": 4.5},
    {"name": "C3", "C": 0.30, "i": 95,  "A_ha": 30.0},
]

def peak_q(C, i, A_ha):
    """Q (m3/s) = C * i (mm/h) * A (ha) / 360"""
    return C * i * A_ha / 360

for c in catchments:
    q = peak_q(c["C"], c["i"], c["A_ha"])
    pipe = "600 mm" if q < 0.5 else "900 mm" if q < 1.2 else "box culvert"
    print(f'{c["name"]}: Q = {q:.3f} m³/s  → suggested {pipe}')
\`\`\`

> Next: the same data as a **pandas DataFrame** makes filtering and exporting to Excel trivial.`,
      },
      {
        id: 'pandas-survey',
        title: 'pandas: survey data & traverse adjustment',
        minutes: 15,
        body: `# Closed traverse — Bowditch (compass rule)
\`\`\`python
import math
import pandas as pd

# line, WCB (deg), distance (m)
legs = pd.DataFrame({
    "line": ["AB", "BC", "CD", "DA"],
    "wcb":  [30.0, 120.5, 210.2, 299.8],
    "dist": [120.35, 98.60, 121.10, 99.20],
})
legs["lat"] = legs.dist * [math.cos(math.radians(b)) for b in legs.wcb]
legs["dep"] = legs.dist * [math.sin(math.radians(b)) for b in legs.wcb]

err_lat, err_dep = legs.lat.sum(), legs.dep.sum()
perimeter = legs.dist.sum()
closing = math.hypot(err_lat, err_dep)
print(f"Closing error = {closing:.3f} m  →  precision 1 : {perimeter/closing:,.0f}")

legs["lat_c"] = legs.lat - err_lat * legs.dist / perimeter
legs["dep_c"] = legs.dep - err_dep * legs.dist / perimeter

E, N = 5000.0, 5000.0
coords = []
for _, r in legs.iterrows():
    coords.append((r.line[0], round(E, 3), round(N, 3)))
    E += r.dep_c; N += r.lat_c
print(pd.DataFrame(coords, columns=["stn", "E", "N"]))
\`\`\``,
      },
      {
        id: 'shapely',
        title: 'Geometry with shapely',
        minutes: 12,
        body: `# shapely — geometry operations in Python
\`\`\`python
from shapely.geometry import Polygon, LineString, Point

plot = Polygon([(0, 0), (40, 0), (42, 28), (-2, 30)])   # metres (local / UTM)
road = LineString([(-10, 25), (60, 32)])

area = plot.area
ropani = area / 508.72
print(f"Plot area: {area:.2f} m²  = {ropani:.3f} ropani")

row = road.buffer(4)                 # 8 m wide road corridor
lost = plot.intersection(row).area
print(f"Area inside road corridor: {lost:.2f} m² ({lost/area:.1%} of plot)")

well = Point(20, 10)
print("Well inside plot:", plot.contains(well), "| distance to road:", round(well.distance(road), 2), "m")
\`\`\`

With **geopandas** the same operations run on whole shapefiles: \`gpd.read_file("parcels.gpkg").overlay(roads_buffer, how="intersection")\`.`,
      },
      {
        id: 'hydro-stats',
        title: 'Design rainfall: Gumbel frequency analysis',
        minutes: 15,
        body: `# From annual maxima to design storm
Culverts, drains and bridges are designed for a **return period** (e.g. 25, 50, 100 yr). With annual maximum 1-day rainfall from a DHM station (or CHIRPS via the GEE Data Hub), fit **Gumbel (EV1)**:

x_T = x̄ + K_T · s,   K_T = −(√6/π) · [0.5772 + ln(ln(T/(T−1)))]

\`\`\`python
import math
import statistics as st

annual_max = [98, 121, 87, 143, 110, 156, 102, 131, 95, 168, 117, 124, 139, 108, 150]
mean, sd = st.mean(annual_max), st.stdev(annual_max)

def gumbel(T):
    K = -(math.sqrt(6) / math.pi) * (0.5772 + math.log(math.log(T / (T - 1))))
    return mean + K * sd

print(f"n = {len(annual_max)}, mean = {mean:.1f} mm, sd = {sd:.1f} mm")
for T in [2, 10, 25, 50, 100]:
    print(f"{T:>4}-year 1-day rainfall ≈ {gumbel(T):6.1f} mm")
\`\`\`

> Use ≥ 20–30 years of record where possible and compare with neighbouring stations.`,
      },
    ],
  },

  // =======================================================================
  {
    id: 'spatial-sql',
    title: 'SQL & Spatial Databases',
    level: 'Intermediate',
    color: 'rose',
    summary: 'SQL from zero, then PostGIS spatial queries — the language behind every GIS server.',
    lessons: [
      {
        id: 'sql-basics',
        title: 'SQL basics with survey & parcel tables',
        minutes: 12,
        body: `# SQL = asking questions of tables
The Code Lab's SQL mode has three sample tables: **survey_points**, **parcels** and **rainfall**.

\`\`\`sql
-- Benchmarks and their reduced levels
SELECT name, easting, northing, rl
FROM survey_points
WHERE type = 'BM'
ORDER BY rl DESC;
\`\`\`

\`\`\`sql
-- Total parcel area per ward, in ropani
SELECT ward,
       COUNT(*)                     AS parcels,
       ROUND(SUM(area_m2), 1)       AS total_m2,
       ROUND(SUM(area_m2)/508.72,2) AS total_ropani
FROM parcels
GROUP BY ward
ORDER BY total_m2 DESC;
\`\`\`

\`\`\`sql
-- Wettest month per station
SELECT station, month, MAX(rain_mm) AS max_mm
FROM rainfall
GROUP BY station;
\`\`\``,
      },
      {
        id: 'postgis',
        title: 'PostGIS spatial SQL',
        minutes: 14,
        body: `# PostGIS — spatial superpowers for PostgreSQL
PostGIS adds a \`geometry\` column type and hundreds of \`ST_\` functions. It is what powers GeoServer, QGIS server projects and many national geoportals.

| Function | Meaning |
|---|---|
| \`ST_Area(geom)\` | Area (in CRS units — use a metric CRS!) |
| \`ST_Length(geom)\` | Line length |
| \`ST_Buffer(geom, 30)\` | 30 m buffer |
| \`ST_Intersects(a, b)\` | Do they touch/overlap? |
| \`ST_Transform(geom, 32645)\` | Reproject to UTM 45N |
| \`ST_DWithin(a, b, 500)\` | Within 500 m (uses index) |

\`\`\`postgresql
-- Parcels affected by a 15 m river setback
SELECT p.parcel_id, p.owner,
       ROUND(ST_Area(ST_Intersection(p.geom, ST_Buffer(r.geom, 15)))::numeric, 1) AS setback_m2
FROM parcels p
JOIN rivers  r ON ST_DWithin(p.geom, r.geom, 15)
WHERE r.name = 'Bagmati';
\`\`\`

\`\`\`postgresql
-- Schools farther than 2 km from any health post
SELECT s.name
FROM schools s
WHERE NOT EXISTS (
  SELECT 1 FROM health_posts h WHERE ST_DWithin(s.geom, h.geom, 2000)
);
\`\`\`

> Tip: always create a spatial index — \`CREATE INDEX ON parcels USING GIST (geom);\``,
      },
    ],
  },

  // =======================================================================
  {
    id: 'earth-engine',
    title: 'Google Earth Engine',
    level: 'Advanced',
    color: 'blue',
    summary: 'Planet-scale analysis: images, collections, reducers, time series, flood mapping and export.',
    lessons: [
      {
        id: 'gee-concepts',
        title: 'Core concepts: Image, ImageCollection, Reducer',
        minutes: 12,
        body: `# How Earth Engine thinks
- **ee.Image** — one raster with bands (a DEM, one Sentinel-2 scene)
- **ee.ImageCollection** — a stack of images over time (all Sentinel-2 scenes)
- **ee.Feature / FeatureCollection** — vector data
- **Reducer** — summarises pixels: mean, sum, max, histogram…
- Everything runs on Google's servers; you only get results with \`print()\` / \`.getInfo()\`.

Sign up free for non-commercial use at code.earthengine.google.com.

\`\`\`gee
var aoi = ee.Geometry.Rectangle([85.25, 27.65, 85.40, 27.75]);
var dem = ee.Image('USGS/SRTMGL1_003').clip(aoi);
var slope = ee.Terrain.slope(dem);

var stats = dem.reduceRegion({
  reducer: ee.Reducer.mean().combine(ee.Reducer.minMax(), '', true),
  geometry: aoi, scale: 30, maxPixels: 1e9
});
print('Elevation stats', stats);
Map.centerObject(aoi, 12);
Map.addLayer(slope, {min: 0, max: 45, palette: ['green', 'yellow', 'red']}, 'Slope');
\`\`\`

The Python API (\`earthengine-api\`, \`geemap\`) uses the same names — MapNiti's backend is built on it. Every dataset in the **GEE Data Hub** has a "Code" tab with a ready Python snippet.`,
      },
      {
        id: 'gee-timeseries',
        title: 'Time series: rainfall & NDVI trends',
        minutes: 14,
        body: `# Monthly rainfall chart (CHIRPS)
\`\`\`gee
var aoi = ee.Geometry.Point([85.32, 27.70]).buffer(10000);
var chirps = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY').select('precipitation');

var months = ee.List.sequence(0, 11);
var start = ee.Date('2023-01-01');
var monthly = ee.ImageCollection(months.map(function (m) {
  var s = start.advance(m, 'month');
  return chirps.filterDate(s, s.advance(1, 'month')).sum().set('system:time_start', s.millis());
}));

print(ui.Chart.image.series(monthly, aoi, ee.Reducer.mean(), 5000)
  .setOptions({title: 'Monthly rainfall 2023 (mm)'}));
\`\`\`

# NDVI trend with Python + geemap
\`\`\`python-colab
# Run in Colab / Jupyter (needs internet + GEE account, not the in-browser Code Lab)
import ee
import pandas as pd
ee.Initialize(project="YOUR-PROJECT")
aoi = ee.Geometry.Point([84.43, 27.62]).buffer(2000)
col = (ee.ImageCollection("MODIS/061/MOD13Q1").select("NDVI")
       .filterDate("2018-01-01", "2024-12-31"))
series = col.map(lambda img: ee.Feature(None, {
    "date": img.date().format("YYYY-MM-dd"),
    "ndvi": ee.Number(img.reduceRegion(ee.Reducer.mean(), aoi, 250).get("NDVI")).multiply(0.0001)}))
df = pd.DataFrame([f["properties"] for f in series.getInfo()["features"]])
df["date"] = pd.to_datetime(df["date"])
df.set_index("date")["ndvi"].plot(title="MODIS NDVI")
\`\`\`

MapNiti shortcut: **GEE Data Hub → MODIS NDVI / CHIRPS → Time series** tab builds these charts with a click and exports CSV.`,
      },
      {
        id: 'gee-flood',
        title: 'Flood mapping with Sentinel-1 radar',
        minutes: 15,
        body: `# Change detection with SAR
Water is smooth → low radar backscatter (dark). Compare a **before** and **after** image; big drops in VV backscatter = new water.

\`\`\`gee
var aoi = ee.Geometry.Rectangle([86.85, 26.45, 87.20, 26.80]); // Koshi area
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(aoi)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .select('VV');

var before = s1.filterDate('2024-04-01', '2024-05-15').median().clip(aoi);
var after  = s1.filterDate('2024-08-01', '2024-08-31').median().clip(aoi);

var smooth = function (img) { return img.focal_median(30, 'circle', 'meters'); };
var diff = smooth(after).subtract(smooth(before));
var flood = diff.lt(-3).and(smooth(after).lt(-16));

// remove permanent water and steep slopes
var perm = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('seasonality').gte(10);
var slope = ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003'));
flood = flood.updateMask(perm.unmask(0).not()).updateMask(slope.lt(5)).selfMask();

var areaKm2 = flood.multiply(ee.Image.pixelArea()).divide(1e6)
  .reduceRegion({reducer: ee.Reducer.sum(), geometry: aoi, scale: 10, maxPixels: 1e10});
print('Flooded area (km²)', areaKm2);
Map.centerObject(aoi, 10);
Map.addLayer(flood, {palette: ['0000ff']}, 'Flood extent');
\`\`\`

MapNiti's **Hydrology → Flood Inundation** runs this workflow for you.`,
      },
      {
        id: 'gee-export',
        title: 'Exporting results',
        minutes: 8,
        body: `# Getting data out of Earth Engine
\`\`\`gee
Export.image.toDrive({
  image: ee.Image('USGS/SRTMGL1_003').clip(aoi),
  description: 'dem_aoi',
  region: aoi,
  scale: 30,
  crs: 'EPSG:32645',      // UTM 45N — ready for engineering use
  maxPixels: 1e10
});
\`\`\`
- Small areas: MapNiti gives a direct **GeoTIFF** link for every Data Hub layer.
- Large areas: use \`Export.image.toDrive\` and download from Google Drive.
- Vectors: \`Export.table.toDrive\` with \`fileFormat: 'SHP'\` or \`'GeoJSON'\`.`,
      },
    ],
  },

  // =======================================================================
  {
    id: 'gis-civil',
    title: 'GIS for Civil Engineers',
    level: 'Advanced',
    color: 'orange',
    summary: 'Road alignment, watershed hydrology, earthwork, drainage design and hazard screening workflows.',
    lessons: [
      {
        id: 'road-alignment',
        title: 'Road alignment & longitudinal profile',
        minutes: 14,
        body: `# Desk-study alignment workflow
1. **Get terrain** — SRTM / Copernicus / ALOS 30 m DEM (GEE Data Hub) or a drone DSM for detail.
2. **Slope map** — mark zones > 25–30° as "avoid" (landslide, high cut).
3. **Constraints** — rivers (setbacks), settlements, forests, geology, land ownership.
4. **Trial alignments** — keep within the limiting gradient; use switchbacks in steep hills.
5. **Profile** — MapNiti **Engineer Toolkit → Elevation Profile** gives chainage vs RL, max grade and rise/fall.
6. **Field verification** — total station / GNSS survey for detailed design.

## Grade check along a profile
\`\`\`python
chainage = [0, 100, 200, 300, 400, 500, 600]
rl       = [1210.0, 1216.5, 1224.0, 1236.8, 1241.0, 1250.2, 1262.9]
limit = 10.0  # % ruling gradient (check the standard for your road class)
for (c1, z1), (c2, z2) in zip(zip(chainage, rl), zip(chainage[1:], rl[1:])):
    g = (z2 - z1) / (c2 - c1) * 100
    flag = "  ← exceeds limit" if abs(g) > limit else ""
    print(f"Ch {c1:>4}–{c2:<4}  grade {g:5.2f}%{flag}")
\`\`\``,
      },
      {
        id: 'watershed',
        title: 'Watershed, runoff & culvert sizing',
        minutes: 15,
        body: `# From DEM to design discharge
1. **Delineate the catchment** upstream of the crossing (MapNiti **Hydrology → Watershed Delineation**).
2. Get **area A**, **longest flow path L** and **fall H**.
3. **Time of concentration** (Kirpich): tc = 0.0195 · L^0.77 · S^−0.385 (min).
4. **Design intensity i** for duration = tc and the chosen return period (IDF curve / Gumbel).
5. **Runoff coefficient C** — weighted by land cover (GEE Data Hub → WorldCover gives the areas).
6. Q = C·i·A / 360 (A in ha) → size the culvert with Manning or culvert charts.

\`\`\`python
import math
# catchment from GIS
A_ha, L, H = 42.0, 1450.0, 95.0
landcover = {"forest": (0.55, 0.20), "crop": (0.30, 0.40), "built": (0.15, 0.80)}  # share, C
C = sum(s * c for s, c in landcover.values())

S = H / L
tc = 0.0195 * L**0.77 * S**-0.385          # minutes
i = 1100 / (tc + 15) ** 0.75               # example IDF: replace with station curve
Q = C * i * A_ha / 360

# pipe culvert flowing full, Manning n = 0.013, slope 2%
n, s = 0.013, 0.02
for D in [0.6, 0.9, 1.2, 1.5]:
    Af = math.pi * D**2 / 4; R = D / 4
    Qcap = Af * R**(2/3) * math.sqrt(s) / n
    print(f"D = {D} m  capacity {Qcap:.2f} m³/s  {'OK' if Qcap >= Q else ''}")
print(f"C = {C:.2f}, tc = {tc:.1f} min, i = {i:.0f} mm/h → Q = {Q:.2f} m³/s")
\`\`\``,
      },
      {
        id: 'hazard',
        title: 'Landslide & flood hazard screening',
        minutes: 12,
        body: `# Landslide susceptibility (heuristic)
Common factors: **slope**, geology/lithology, distance to faults, distance to rivers/roads, land cover, rainfall, soil. Score each 1–5, weight them (AHP), overlay (see *Map algebra*), then validate with a landslide inventory (Bipad portal, NASA Global Landslide Catalog).

# Flood screening
- **Historical water** — JRC Surface Water occurrence (GEE Data Hub)
- **Observed events** — Sentinel-1 change detection
- **Terrain-based** — Height Above Nearest Drainage (HAND); cells < 5 m above the channel are candidates
- **Hydraulic model** — HEC-RAS 2D for design (MapNiti Hydrology tools export inputs)

> MapNiti **Site Report** flags steep ground, clay-rich soils, heavy 1-day rainfall, surface water and Nepal's seismic zone automatically — a quick desk study before your field visit.`,
      },
    ],
  },
];
