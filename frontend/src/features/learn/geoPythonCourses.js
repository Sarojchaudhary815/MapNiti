// Python-for-geospatial track: extra Python basics, pandas, the geospatial
// library stack (GDAL/OGR, GeoPandas, Rasterio, Folium, PyQGIS) and DEM analysis.
// Original MapNiti material. The syllabus follows the common "Python for
// geospatial analysis" outline (see the credit in the setup lesson).
//
// Fences: ```python runs in the browser Code Lab (Pyodide: numpy, pandas,
// matplotlib, shapely, pyproj, geopandas, scipy). ```python-desktop needs a local
// install or Google Colab (GDAL's osgeo bindings, rasterio, folium). ```pyqgis runs in QGIS.
// Pyodide 0.26 has libgdal but no osgeo module, and its PROJ fails inside dissolve().

export const PYTHON_BASICS_MORE = [
  {
    id: 'files',
    title: 'Reading and writing files',
    minutes: 12,
    body: `# Files: where real data lives
Survey data, rainfall records and coordinate lists usually arrive as text or CSV files. Python reads and writes them with \`open()\`.

## Write a file, then read it back
\`with open(...)\` opens the file and closes it automatically, even if something goes wrong.
\`\`\`python
# "w" = write (creates or overwrites), "a" = append, "r" = read (default)
with open("levels.txt", "w") as f:
    f.write("BM1 1301.250\\n")
    f.write("TP1 1303.804\\n")
    f.write("TP2 1306.421\\n")

with open("levels.txt") as f:
    for line in f:
        name, rl = line.split()
        print(f"{name}: {float(rl):.3f} m")
\`\`\`
(In the Code Lab the file lives in a temporary folder inside your browser.)

## CSV files with the csv module
\`\`\`python
import csv

points = [
    {"name": "BM1", "easting": 334500.000, "northing": 3066800.000, "rl": 1301.250},
    {"name": "TP1", "easting": 334548.120, "northing": 3066821.450, "rl": 1303.804},
    {"name": "TP2", "easting": 334601.335, "northing": 3066840.020, "rl": 1306.421},
]

with open("points.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["name", "easting", "northing", "rl"])
    writer.writeheader()
    writer.writerows(points)

with open("points.csv") as f:
    rows = list(csv.DictReader(f))      # each row is a dictionary of TEXT values

print(open("points.csv").read())
highest = max(rows, key=lambda r: float(r["rl"]))
print("Highest point:", highest["name"], highest["rl"])
\`\`\`

## JSON and GeoJSON
GeoJSON is just JSON with a fixed structure, so the \`json\` module can write it. QGIS and web maps open the result directly.
\`\`\`python
import json

features = [
    {"type": "Feature",
     "properties": {"name": "BM1", "rl": 1301.25},
     "geometry": {"type": "Point", "coordinates": [85.3240, 27.7172]}},
    {"type": "Feature",
     "properties": {"name": "BM2", "rl": 1308.12},
     "geometry": {"type": "Point", "coordinates": [85.3301, 27.7150]}},
]
with open("benchmarks.geojson", "w") as f:
    json.dump({"type": "FeatureCollection", "features": features}, f, indent=2)

with open("benchmarks.geojson") as f:
    data = json.load(f)
for feat in data["features"]:
    lon, lat = feat["geometry"]["coordinates"]
    print(feat["properties"]["name"], lat, lon)
\`\`\`

## Key points
- Always use \`with open(...) as f:\`; the file closes itself.
- \`csv.DictReader\` gives text values; convert them with \`float()\`.
- GeoJSON = JSON; coordinates are **[longitude, latitude]**.`,
  },
  {
    id: 'classes',
    title: 'Classes and objects',
    minutes: 12,
    body: `# Your own data types
A **class** bundles data (attributes) and the functions that work on it (methods). GeoPandas, Shapely and QGIS are all built from classes. Knowing them helps you read their documentation.

## A survey point class
\`\`\`python
import math

class SurveyPoint:
    def __init__(self, name, easting, northing, rl=None):
        # __init__ runs when you create a point; self is the point itself
        self.name = name
        self.easting = easting
        self.northing = northing
        self.rl = rl

    def distance_to(self, other):
        return math.hypot(other.easting - self.easting, other.northing - self.northing)

    def bearing_to(self, other):
        ang = math.degrees(math.atan2(other.easting - self.easting, other.northing - self.northing))
        return ang % 360

    def __repr__(self):
        return f"SurveyPoint({self.name}, E={self.easting:.3f}, N={self.northing:.3f})"

a = SurveyPoint("BM1", 334500.000, 3066800.000, 1301.25)
b = SurveyPoint("TP1", 334548.120, 3066821.450, 1303.80)
print(a)
print(f"{a.name} → {b.name}: {a.distance_to(b):.3f} m at {a.bearing_to(b):.2f}°")
\`\`\`

## A parcel class that uses the point class
\`\`\`python
import math

class Point:
    def __init__(self, e, n):
        self.e, self.n = e, n

class Parcel:
    ROPANI = 508.72

    def __init__(self, parcel_id, corners):
        self.parcel_id = parcel_id
        self.corners = corners             # list of Point objects

    @property
    def area(self):
        pts = self.corners
        s = sum(pts[i].e * pts[(i + 1) % len(pts)].n - pts[(i + 1) % len(pts)].e * pts[i].n
                for i in range(len(pts)))
        return abs(s) / 2

    def summary(self):
        return f"Parcel {self.parcel_id}: {self.area:.2f} m² = {self.area / self.ROPANI:.3f} ropani"

p = Parcel("P-101", [Point(0, 0), Point(25, 0), Point(25, 20), Point(0, 20)])
print(p.summary())
\`\`\`
\`@property\` lets you write \`p.area\` without brackets, just like \`gdf.area\` in GeoPandas.

## Key points
- \`class Name:\` defines a type; \`__init__\` sets up each new object.
- Methods are functions inside the class; their first argument is \`self\`.
- Libraries are made of classes: \`GeoDataFrame\`, \`Polygon\`, \`QgsVectorLayer\`.`,
  },
  {
    id: 'exceptions',
    title: 'Errors and exception handling',
    minutes: 10,
    body: `# When things go wrong
Field data always has mistakes: a missing reading, a letter where a number should be, a coordinate outside Nepal. Instead of letting the whole script crash, catch the error with \`try / except\`.

## Read the error message
\`\`\`python
reading = "1.52O"        # a letter O instead of a zero
try:
    value = float(reading)
except ValueError as err:
    print("Could not read the staff reading:", err)
\`\`\`
The last line of any error (traceback) tells you its **type** (\`ValueError\`, \`KeyError\`, \`ZeroDivisionError\`, \`FileNotFoundError\`…) and the reason.

## Skip bad rows, keep good ones
\`\`\`python
raw = """BM1,334500.000,3066800.000
TP1,334548.120,3066821.450
TP2,33460l.335,3066840.020
TP3,334702.410
BM2,334655.900,3066812.770"""

good, bad = [], []
for line_no, line in enumerate(raw.splitlines(), start=1):
    try:
        name, e, n = line.split(",")
        good.append((name, float(e), float(n)))
    except ValueError as err:
        bad.append((line_no, line, str(err)))

print(f"{len(good)} good rows")
for line_no, line, why in bad:
    print(f"  line {line_no} skipped: {line!r} ({why})")
\`\`\`

## Raise your own errors to stop bad input early
\`\`\`python
def check_nepal(lat, lon):
    if not (26.3 <= lat <= 30.5 and 80.0 <= lon <= 88.3):
        raise ValueError(f"({lat}, {lon}) is outside Nepal. Are latitude and longitude swapped?")
    return True

for lat, lon in [(27.7172, 85.3240), (85.3240, 27.7172)]:
    try:
        check_nepal(lat, lon)
        print(lat, lon, "OK")
    except ValueError as err:
        print("Error:", err)
    finally:
        pass   # code here always runs, e.g. closing a connection
\`\`\`

## Key points
- \`try:\` the risky line, \`except SomeError as err:\` to handle it.
- Catch specific errors (\`ValueError\`), not everything, so real bugs still show.
- \`raise\` your own error with a helpful message when input is clearly wrong.`,
  },
];

export const GEO_PYTHON_COURSES = [
  // =======================================================================
  {
    id: 'pandas-data',
    title: 'Data Analysis with pandas',
    level: 'Intermediate',
    color: 'indigo',
    summary: 'Explore, clean, combine, summarise and plot tables of survey, rainfall and census data with pandas and matplotlib.',
    lessons: [
      {
        id: 'pandas-explore',
        title: 'What is pandas? Exploring a table',
        minutes: 14,
        body: `# pandas: Excel inside Python
**pandas** handles tables. A **DataFrame** is a table and each column is a **Series**. It reads CSV, Excel, SQL and many more formats, and GeoPandas is built on top of it.

## Load a table and look at it
\`\`\`python
import pandas as pd
from io import StringIO

csv_text = """station,district,elevation_m,year,annual_rain_mm
Kathmandu Airport,Kathmandu,1337,2021,1685
Kathmandu Airport,Kathmandu,1337,2022,1452
Pokhara Airport,Kaski,827,2021,4120
Pokhara Airport,Kaski,827,2022,3640
Biratnagar,Morang,72,2021,2210
Biratnagar,Morang,72,2022,1890
Jumla,Jumla,2300,2021,820
Jumla,Jumla,2300,2022,760"""

df = pd.read_csv(StringIO(csv_text))   # for a real file: pd.read_csv("rain.csv")

print(df.head(3))          # first rows
print(df.shape)            # (rows, columns)
print(df.dtypes)           # column types
print(df.describe().round(1))   # count, mean, std, min, quartiles, max
\`\`\`

## Select columns and rows
\`\`\`python
import pandas as pd
df = pd.DataFrame({
    "station": ["Kathmandu", "Pokhara", "Biratnagar", "Jumla"],
    "elevation_m": [1337, 827, 72, 2300],
    "annual_rain_mm": [1568, 3880, 2050, 790],
})

print(df["station"])                         # one column → Series
print(df[["station", "annual_rain_mm"]])     # several columns → DataFrame
print(df.loc[1, "station"])                  # by label: row 1, column "station"
print(df.iloc[0:2])                          # by position: first two rows

wet = df[df["annual_rain_mm"] > 2000]        # filter rows with a condition
print(wet)
print(df.sort_values("elevation_m", ascending=False))
\`\`\`

## Key points
- \`pd.read_csv\`, \`.head()\`, \`.shape\`, \`.dtypes\`, \`.describe()\` are the first things to run on any table.
- \`df["col"]\` for columns, \`.loc\` by label, \`.iloc\` by position.
- Filter with a condition inside \`df[...]\`; combine conditions with \`&\` and \`|\` in brackets.`,
      },
      {
        id: 'pandas-process',
        title: 'Cleaning, combining and summarising data',
        minutes: 16,
        body: `# Turning messy data into answers
## Missing values and duplicates
\`\`\`python
import pandas as pd
import numpy as np

df = pd.DataFrame({
    "station": ["KTM", "KTM", "PKR", "PKR", "BRT", "BRT", "BRT"],
    "month":   [6, 7, 6, 7, 6, 7, 7],
    "rain_mm": [245, np.nan, 640, 905, 330, 520, 520],
})
print("Missing per column:\\n", df.isna().sum())
print("Duplicate rows:", df.duplicated().sum())

clean = df.drop_duplicates().copy()
clean["rain_mm"] = clean["rain_mm"].fillna(clean.groupby("station")["rain_mm"].transform("mean"))
print(clean)
\`\`\`
Decide how to fill gaps on engineering grounds. A station mean is fine for teaching, but for design use a nearby station or a proper infilling method.

## New columns, types and groups
\`\`\`python
import pandas as pd

parcels = pd.DataFrame({
    "parcel_id": ["P1", "P2", "P3", "P4", "P5"],
    "ward": [5, 5, 6, 6, 7],
    "land_use": ["Residential", "Agriculture", "Residential", "Agriculture", "Commercial"],
    "area_m2": ["508.7", "1017.4", "254.4", "2034.9", "762.9"],    # text by mistake
})
parcels["area_m2"] = parcels["area_m2"].astype(float)
parcels = parcels.assign(ropani=lambda d: (d["area_m2"] / 508.72).round(3))

summary = parcels.groupby("ward").agg(parcels=("parcel_id", "count"),
                                      total_m2=("area_m2", "sum"),
                                      mean_m2=("area_m2", "mean"))
print(summary.round(1))
print(parcels.pivot_table(index="ward", columns="land_use", values="area_m2", aggfunc="sum", fill_value=0))
\`\`\`

## Join two tables (merge) and stack tables (concat)
\`\`\`python
import pandas as pd

wards = pd.DataFrame({"ward": [5, 6, 7], "population": [12500, 23800, 8400], "area_km2": [3.1, 4.6, 2.2]})
houses_2021 = pd.DataFrame({"ward": [5, 6, 7], "houses": [2900, 5400, 1750], "year": 2021})
houses_2024 = pd.DataFrame({"ward": [5, 6, 7], "houses": [3150, 5900, 1820], "year": 2024})

houses = pd.concat([houses_2021, houses_2024], ignore_index=True)    # rows on top of rows
latest = houses[houses["year"] == 2024]
table = wards.merge(latest, on="ward", how="left")                   # columns side by side
table["density_per_km2"] = (table["population"] / table["area_km2"]).round(0)
table["people_per_house"] = (table["population"] / table["houses"]).round(2)
print(table)

wide = houses.pivot(index="ward", columns="year", values="houses")
wide["growth_%"] = ((wide[2024] / wide[2021] - 1) * 100).round(1)
print(wide)
print(wide.reset_index().melt(id_vars="ward", value_vars=[2021, 2024], value_name="houses"))
\`\`\`

## Key points
- \`isna\`, \`fillna\`, \`dropna\`, \`drop_duplicates\` for cleaning; \`astype\` to fix types.
- \`groupby().agg()\` and \`pivot_table\` for summaries.
- \`merge\` joins on a key column; \`concat\` stacks; \`pivot\` / \`melt\` reshape wide ↔ long.`,
      },
      {
        id: 'pandas-plot',
        title: 'Plotting data with matplotlib',
        minutes: 12,
        body: `# Charts for reports
**matplotlib** draws every chart type. pandas has \`.plot()\` shortcuts that call matplotlib for you.

## Line, bar, histogram and scatter in one figure
\`\`\`python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
rain = pd.DataFrame({
    "Kathmandu": [14, 18, 34, 61, 124, 236, 363, 331, 199, 51, 8, 13],
    "Pokhara":   [23, 28, 60, 128, 302, 637, 892, 802, 597, 164, 14, 21],
}, index=months)

rng = np.random.default_rng(1)
daily_max = rng.gumbel(95, 25, 40)                  # 40 years of 1-day maxima (synthetic)
stations = pd.DataFrame({"elevation_m": [72, 827, 1337, 2300, 2744],
                         "annual_mm":   [2050, 3880, 1568, 790, 1050]})

fig, ax = plt.subplots(2, 2, figsize=(10, 7))
rain.plot(ax=ax[0, 0], marker="o", title="Monthly rainfall (mm)")
rain.sum().plot.bar(ax=ax[0, 1], color=["#0047AB", "#0ea5e9"], title="Annual total (mm)", rot=0)
ax[1, 0].hist(daily_max, bins=10, color="#64748b", edgecolor="white")
ax[1, 0].set_title("Annual max 1-day rain"); ax[1, 0].set_xlabel("mm")
ax[1, 1].scatter(stations["elevation_m"], stations["annual_mm"], color="#dc2626")
ax[1, 1].set_title("Elevation vs rainfall"); ax[1, 1].set_xlabel("Elevation (m)"); ax[1, 1].set_ylabel("mm/yr")
for a in ax.flat:
    a.grid(alpha=0.3)
fig.tight_layout()
# fig.savefig("rainfall.png", dpi=200)   # save for your report
\`\`\`

## Rules for honest engineering charts
| Do | Avoid |
|---|---|
| Label both axes with units | Unlabelled numbers |
| Start bar charts at zero | Cut-off bars that exaggerate change |
| Use one colour per series, consistently | Rainbow colours with no meaning |
| State the data source and period | Charts with no source |

## Key points
- \`fig, ax = plt.subplots(rows, cols)\` gives a grid of charts.
- \`df.plot()\`, \`.plot.bar()\`, \`ax.hist()\`, \`ax.scatter()\` cover most report charts.
- \`fig.savefig("name.png", dpi=200)\` for print quality.`,
      },
    ],
  },

  // =======================================================================
  {
    id: 'geo-python',
    title: 'Geospatial Python: GDAL, GeoPandas, Rasterio & Folium',
    level: 'Intermediate',
    color: 'teal',
    summary: 'The core open-source geospatial stack: set up an environment, then work with GDAL/OGR, GeoPandas vector analysis, raster analysis, Folium web maps and Python inside QGIS.',
    lessons: [
      {
        id: 'geo-setup',
        title: 'Why Python for geospatial, and setting up your computer',
        minutes: 12,
        body: `# The geospatial Python stack
Python automates what you would otherwise click through hundreds of times in a GIS, and makes your analysis repeatable. Earth Engine, QGIS, ArcGIS and most cloud platforms all speak Python.

| Library | What it does | Desktop GIS equivalent |
|---|---|---|
| **GDAL / OGR** | Read, write and convert almost every raster (GDAL) and vector (OGR) format | The engine under QGIS |
| **Shapely** | Geometry operations: buffer, intersect, area, distance | Geoprocessing tools |
| **pyproj** | Coordinate systems and transformations | Project CRS / Reproject |
| **GeoPandas** | Tables with a geometry column; spatial joins and overlays | Attribute table + vector tools |
| **Rasterio** | Clean Pythonic raster reading and writing (built on GDAL) | Raster tools |
| **Folium** | Interactive Leaflet web maps from Python | Web map export |
| **PyQGIS** | Control QGIS itself from Python | Python Console |

## Install (once) with conda
Geospatial libraries depend on compiled C libraries (GDAL, PROJ, GEOS). **conda-forge** ships them pre-built for Windows, macOS and Linux, so install everything from it in a separate environment.
\`\`\`bash
# 1. Install Miniforge (conda with conda-forge as default): https://github.com/conda-forge/miniforge
# 2. Create and activate an environment for GIS work
conda create -n gis python=3.11
conda activate gis
# 3. Install the stack in one go
conda install -c conda-forge gdal geopandas rasterio folium matplotlib jupyterlab
# 4. Start a notebook
jupyter lab
\`\`\`
**No install option:** Google Colab already has pandas and matplotlib. Run \`!pip install geopandas rasterio folium\` in the first cell.

**Right here:** MapNiti's Code Lab runs Python in your browser with numpy, pandas, matplotlib, shapely, pyproj and **GeoPandas**. Code marked *python* in these lessons has a **Try it** button. Code marked *python-desktop* (GDAL, Rasterio, Folium) needs your own computer or Colab, where it runs as written.

## Data for practice
- MapNiti **Data Download** (login): boundaries, DEMs, OSM roads and buildings, rainfall and land-cover rasters for your own area of interest.
- The **Data Sources** page: Nepal government portals and global datasets.

## Further reading
This track covers the same topics as Aditya Kushwaha's free book [Python For Geospatial Analysis](https://pga.kaditya97.com.np/intro.html), a good companion with its own datasets. The MapNiti lessons are written separately, with runnable examples on Nepal data.

## Key points
- Use conda-forge in a separate environment; don't mix pip and conda for GDAL.
- GDAL is the foundation; GeoPandas and Rasterio are friendlier layers on top.
- Code Lab, Colab or a local Jupyter: pick one and practise daily.`,
      },
      {
        id: 'gdal-ogr',
        title: 'GDAL and OGR: rasters and vectors at the lowest level',
        minutes: 15,
        body: `# GDAL (rasters) and OGR (vectors)
Every raster has three things: a grid of **values**, a **geotransform** (where the grid sits on the Earth) and a **CRS**.

The geotransform is 6 numbers: \`(x_origin, pixel_width, 0, y_origin, 0, -pixel_height)\`, where the origin is the **top-left** corner.

Run these examples on your computer, in Colab, or in the QGIS Python Console (GDAL is already included in QGIS).

## Create, save and read a GeoTIFF
\`\`\`python-desktop
from osgeo import gdal, osr
import numpy as np
gdal.UseExceptions()

# A 4 x 5 elevation grid, 30 m pixels, in UTM 45N
dem = np.array([[1310, 1305, 1302, 1300, 1298],
                [1306, 1301, 1297, 1294, 1293],
                [1303, 1298, 1292, 1289, 1290],
                [1301, 1295, 1290, 1285, 1287]], dtype="float32")
x0, y0, px = 334500.0, 3066900.0, 30.0

drv = gdal.GetDriverByName("GTiff")
ds = drv.Create("/vsimem/dem.tif", dem.shape[1], dem.shape[0], 1, gdal.GDT_Float32)
ds.SetGeoTransform((x0, px, 0, y0, 0, -px))
srs = osr.SpatialReference(); srs.ImportFromEPSG(32645)
ds.SetProjection(srs.ExportToWkt())
ds.GetRasterBand(1).WriteArray(dem)
ds.GetRasterBand(1).SetNoDataValue(-9999)
ds = None                                  # closing the dataset writes the file

ds = gdal.Open("/vsimem/dem.tif")
gt = ds.GetGeoTransform()
arr = ds.GetRasterBand(1).ReadAsArray()
print("Size:", ds.RasterXSize, "x", ds.RasterYSize, "| CRS:", osr.SpatialReference(wkt=ds.GetProjection()).GetName())
print("Geotransform:", gt)
print("Min / max elevation:", arr.min(), arr.max())

# Pixel (row, col) ↔ map coordinate
row, col = 2, 3
x = gt[0] + (col + 0.5) * gt[1]
y = gt[3] + (row + 0.5) * gt[5]
print(f"Centre of pixel (row {row}, col {col}) = E {x:.1f}, N {y:.1f}, elevation {arr[row, col]} m")
e, n = 334590.0, 3066840.0
c, r = int((e - gt[0]) / gt[1]), int((n - gt[3]) / gt[5])
print(f"E {e}, N {n} falls in row {r}, col {c} → {arr[r, c]} m")
\`\`\`
\`/vsimem/\` is GDAL's in-memory disk. On your computer use a normal path like \`"C:/data/dem.tif"\`.

## Vectors with OGR
\`\`\`python-desktop
from osgeo import ogr, osr
ogr.UseExceptions()

srs = osr.SpatialReference(); srs.ImportFromEPSG(32645)
ds = ogr.GetDriverByName("GeoJSON").CreateDataSource("/vsimem/parcels.geojson")
layer = ds.CreateLayer("parcels", srs, ogr.wkbPolygon)
layer.CreateField(ogr.FieldDefn("parcel_id", ogr.OFTString))
layer.CreateField(ogr.FieldDefn("area_m2", ogr.OFTReal))

for pid, wkt in [("P-101", "POLYGON ((0 0, 25 0, 25 20, 0 20, 0 0))"),
                 ("P-102", "POLYGON ((25 0, 60 0, 60 30, 25 20, 25 0))")]:
    geom = ogr.CreateGeometryFromWkt(wkt)
    feat = ogr.Feature(layer.GetLayerDefn())
    feat.SetField("parcel_id", pid)
    feat.SetField("area_m2", geom.GetArea())
    feat.SetGeometry(geom)
    layer.CreateFeature(feat)
ds = None

ds = ogr.Open("/vsimem/parcels.geojson")
for f in ds.GetLayer():
    print(f.GetField("parcel_id"), f"{f.GetField('area_m2'):.1f} m²", f.GetGeometryRef().Centroid().ExportToWkt())
\`\`\`

## The command-line tools (run in a terminal)
\`\`\`bash
gdalinfo dem.tif                                   # size, CRS, extent, statistics
gdalwarp -t_srs EPSG:32645 -tr 30 30 dem_wgs84.tif dem_utm.tif     # reproject + resample
gdalwarp -cutline ward.gpkg -crop_to_cutline dem.tif dem_ward.tif  # clip to a polygon
gdal_translate -of COG dem.tif dem_cog.tif         # convert to Cloud-Optimised GeoTIFF
gdaldem slope dem_utm.tif slope.tif                # slope in degrees
gdal_contour -a elev -i 10 dem_utm.tif contours.gpkg               # 10 m contours
ogr2ogr -f GPKG roads.gpkg roads.shp -t_srs EPSG:32645             # convert + reproject vectors
\`\`\`

## Key points
- Raster = values + geotransform + CRS. Origin is top-left; pixel height is negative.
- \`gdal.Open\` → \`GetRasterBand(1).ReadAsArray()\` gives a numpy array.
- \`gdalwarp\`, \`gdal_translate\`, \`gdaldem\`, \`ogr2ogr\` do most conversion jobs in one line.`,
      },
      {
        id: 'geopandas-basics',
        title: 'GeoPandas: tables with geometry',
        minutes: 15,
        body: `# GeoPandas
A **GeoDataFrame** is a pandas table with a special **geometry** column (Shapely objects) and a **CRS**. Each row is a feature.

## Points from a table, CRS and reprojection
\`\`\`python
import pandas as pd
import geopandas as gpd

df = pd.DataFrame({
    "name": ["Kathmandu", "Pokhara", "Biratnagar", "Nepalgunj", "Dhangadhi"],
    "lat":  [27.7172, 28.2096, 26.4525, 28.0500, 28.6852],
    "lon":  [85.3240, 83.9856, 87.2718, 81.6167, 80.5932],
    "population": [862000, 518000, 244000, 152000, 204000],
})
gdf = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df["lon"], df["lat"]), crs="EPSG:4326")
print(gdf.head())
print("CRS:", gdf.crs)

utm = gdf.to_crs("EPSG:32645")                 # degrees → metres
print(utm[["name", "geometry"]])
ktm = utm.loc[utm["name"] == "Kathmandu", "geometry"].iloc[0]
utm["km_from_ktm"] = (utm.distance(ktm) / 1000).round(1)
print(utm[["name", "km_from_ktm"]].sort_values("km_from_ktm"))
\`\`\`
> Measure distances and areas in a **projected CRS** (UTM 44N/45N), never in EPSG:4326 degrees.

## Polygons: area, perimeter, centroid, and saving files
\`\`\`python
import geopandas as gpd
from shapely.geometry import Polygon

wards = gpd.GeoDataFrame({
    "ward": [1, 2, 3],
    "population": [12500, 23800, 8400],
    "geometry": [Polygon([(0, 0), (2000, 0), (2000, 1500), (0, 1500)]),
                 Polygon([(2000, 0), (4200, 0), (4200, 1500), (2000, 1500)]),
                 Polygon([(0, 1500), (4200, 1500), (4200, 2600), (0, 2600)])],
}, crs="EPSG:32645")

wards["area_km2"] = (wards.area / 1e6).round(2)
wards["perimeter_km"] = (wards.length / 1000).round(2)
wards["density"] = (wards["population"] / wards["area_km2"]).round(0)
print(wards.drop(columns="geometry"))
print(wards.centroid)

wards.to_file("wards.geojson", driver="GeoJSON")    # or "wards.gpkg" (GeoPackage), "wards.shp"
back = gpd.read_file("wards.geojson")
print("Read back:", len(back), "features, CRS", back.crs)

ax = wards.plot(column="density", cmap="OrRd", legend=True, edgecolor="black", figsize=(6, 4))
ax.set_title("Population density (people/km²)")
\`\`\`

## Reading real files (on your computer)
\`\`\`python-desktop
import geopandas as gpd

roads = gpd.read_file("roads.shp")                       # Shapefile
wards = gpd.read_file("municipality.gpkg", layer="wards")  # one layer of a GeoPackage
rivers = gpd.read_file("https://example.org/rivers.geojson")  # straight from a URL
print(roads.crs, len(roads))
\`\`\`

## Key points
- \`gpd.GeoDataFrame(df, geometry=points_from_xy(lon, lat), crs="EPSG:4326")\` turns a table into points.
- \`.to_crs()\` reprojects; \`.area\`, \`.length\`, \`.distance()\`, \`.centroid\` work per row.
- \`read_file\` / \`to_file\` handle GeoJSON, GeoPackage and Shapefile.`,
      },
      {
        id: 'geopandas-analysis',
        title: 'Spatial analysis with GeoPandas',
        minutes: 16,
        body: `# The vector analysis toolbox
| Question | GeoPandas tool |
|---|---|
| Which ward is each house in? | \`gpd.sjoin(houses, wards, predicate="within")\` |
| Which parcels are in the flood zone, and how much of each? | \`gpd.overlay(parcels, flood, how="intersection")\` |
| Merge wards into a municipality | \`wards.dissolve(by="municipality")\` |
| 30 m river setback | \`rivers.buffer(30)\` |
| Nearest health post to each house | \`gpd.sjoin_nearest(houses, posts, distance_col="dist_m")\` |

## A complete small analysis
\`\`\`python
import geopandas as gpd
from shapely.geometry import Point, Polygon, LineString

crs = "EPSG:32645"
wards = gpd.GeoDataFrame({"ward": [1, 2],
    "geometry": [Polygon([(0, 0), (500, 0), (500, 400), (0, 400)]),
                 Polygon([(500, 0), (1000, 0), (1000, 400), (500, 400)])]}, crs=crs)
houses = gpd.GeoDataFrame({"house_id": range(1, 7),
    "geometry": [Point(120, 80), Point(300, 350), Point(460, 120), Point(620, 60), Point(780, 300), Point(950, 200)]}, crs=crs)
river = gpd.GeoDataFrame({"name": ["Khola"], "geometry": [LineString([(0, 180), (400, 220), (1000, 160)])]}, crs=crs)
posts = gpd.GeoDataFrame({"post": ["HP-A", "HP-B"], "geometry": [Point(200, 300), Point(850, 100)]}, crs=crs)

# 1) Spatial join: ward of each house
hw = gpd.sjoin(houses, wards, predicate="within", how="left").drop(columns="index_right")
print("Houses per ward:\\n", hw.groupby("ward").size())

# 2) Buffer: 50 m river hazard zone, and houses inside it
zone = river.buffer(50).union_all() if hasattr(river.buffer(50), "union_all") else river.buffer(50).unary_union
hw["in_river_zone"] = hw.within(zone)
print("Houses within 50 m of the river:", hw.loc[hw["in_river_zone"], "house_id"].tolist())

# 3) Overlay: how much of each ward is in the zone
zone_gdf = gpd.GeoDataFrame({"zone": ["river 50 m"]}, geometry=[zone], crs=crs)
inter = gpd.overlay(wards, zone_gdf, how="intersection")
inter["zone_m2"] = inter.area.round(0)
inter["share_%"] = (inter.area / wards.set_index("ward").loc[inter["ward"]].area.values * 100).round(1)
print(inter[["ward", "zone_m2", "share_%"]])

# 4) Nearest health post
near = gpd.sjoin_nearest(houses, posts, distance_col="dist_m")
print(near[["house_id", "post", "dist_m"]].round(1))

# 5) Dissolve wards into one municipality boundary
#    On your computer simply: muni = wards.assign(municipality="Demo Municipality").dissolve(by="municipality")
#    The browser build of PROJ fails inside dissolve(), so here we drop the CRS first and set it again after.
tmp = gpd.GeoDataFrame(wards.drop(columns="geometry").assign(municipality="Demo Municipality"),
                       geometry=list(wards.geometry))
muni = tmp.dissolve(by="municipality").set_crs(crs)
print("Municipality area:", round(muni.area.iloc[0] / 1e6, 3), "km²")

ax = wards.plot(color="#e0f2fe", edgecolor="black", figsize=(7, 3.5))
zone_gdf.plot(ax=ax, color="#fca5a5", alpha=0.6)
river.plot(ax=ax, color="#0284c7", linewidth=2)
hw.plot(ax=ax, color=hw["in_river_zone"].map({True: "red", False: "black"}), markersize=30)
posts.plot(ax=ax, color="green", marker="^", markersize=80)
ax.set_title("Houses, river hazard zone and health posts")
\`\`\`

## Key points
- \`sjoin\` = attribute transfer by location; \`overlay\` = cut geometries and keep both attribute sets.
- Always work in a projected CRS for buffers and areas.
- \`dissolve\` merges features that share a value; \`sjoin_nearest\` finds the closest feature.`,
      },
      {
        id: 'raster-analysis',
        title: 'Raster analysis with GDAL and Rasterio',
        minutes: 16,
        body: `# Working with rasters as arrays
Once a raster is a numpy array, analysis is just maths on arrays: band ratios, thresholds, reclassification and zonal statistics.

## NDVI, reclassification and zonal statistics with GDAL
\`\`\`python-desktop
from osgeo import gdal, osr
import numpy as np
import matplotlib.pyplot as plt
gdal.UseExceptions()

rng = np.random.default_rng(7)
rows, cols, px = 60, 80, 10.0
yy, xx = np.mgrid[0:rows, 0:cols]
# Synthetic Sentinel-2 reflectance: forest on the left, town in the middle, river on the right
red = np.where(xx < 30, 0.04, np.where(xx < 60, 0.16, 0.05)) + rng.normal(0, 0.01, (rows, cols))
nir = np.where(xx < 30, 0.40, np.where(xx < 60, 0.22, 0.03)) + rng.normal(0, 0.01, (rows, cols))

def save(path, arr, dtype=gdal.GDT_Float32):
    ds = gdal.GetDriverByName("GTiff").Create(path, cols, rows, 1, dtype)
    ds.SetGeoTransform((334000, px, 0, 3067000, 0, -px))
    s = osr.SpatialReference(); s.ImportFromEPSG(32645); ds.SetProjection(s.ExportToWkt())
    ds.GetRasterBand(1).WriteArray(arr); ds = None

save("/vsimem/red.tif", red); save("/vsimem/nir.tif", nir)

# Read back and compute NDVI
r = gdal.Open("/vsimem/red.tif").ReadAsArray().astype(float)
n = gdal.Open("/vsimem/nir.tif").ReadAsArray().astype(float)
ndvi = (n - r) / (n + r)
save("/vsimem/ndvi.tif", ndvi)

# Reclassify: 1 water (<0), 2 built/bare (0–0.3), 3 vegetation (>0.3)
classes = np.digitize(ndvi, [0.0, 0.3]) + 1
pixel_ha = px * px / 1e4
for c, name in [(1, "Water"), (2, "Built/bare"), (3, "Vegetation")]:
    print(f"{name:11s}: {np.sum(classes == c) * pixel_ha:6.2f} ha")

# Zonal statistics: mean NDVI in two zones (e.g. two wards)
zones = np.where(xx < 40, 1, 2)            # west half vs east half
for z in (1, 2):
    print(f"Zone {z}: mean NDVI {ndvi[zones == z].mean():.3f}")

fig, ax = plt.subplots(1, 2, figsize=(9, 3.5))
im = ax[0].imshow(ndvi, cmap="RdYlGn", vmin=-0.5, vmax=0.9); ax[0].set_title("NDVI"); fig.colorbar(im, ax=ax[0])
ax[1].imshow(classes, cmap="viridis"); ax[1].set_title("Classes")
\`\`\`

## The same with Rasterio (on your computer)
Rasterio wraps GDAL in a cleaner interface. This is how you would process a real Sentinel-2 download:
\`\`\`python-desktop
import rasterio
from rasterio.mask import mask
import geopandas as gpd
import numpy as np

with rasterio.open("S2_B04.tif") as red_src, rasterio.open("S2_B08.tif") as nir_src:
    red = red_src.read(1).astype("float32")
    nir = nir_src.read(1).astype("float32")
    profile = red_src.profile                       # CRS, transform, size, dtype…

ndvi = np.where((nir + red) > 0, (nir - red) / (nir + red), np.nan)
profile.update(dtype="float32", count=1, nodata=np.nan, compress="deflate")
with rasterio.open("ndvi.tif", "w", **profile) as dst:
    dst.write(ndvi, 1)

# Clip to a ward polygon
ward = gpd.read_file("wards.gpkg").query("ward == 5").to_crs(profile["crs"])
with rasterio.open("ndvi.tif") as src:
    clipped, transform = mask(src, ward.geometry, crop=True)
print("Mean NDVI in ward 5:", np.nanmean(clipped))
\`\`\`
For zonal statistics over many polygons use the \`rasterstats\` package: \`zonal_stats(wards, "ndvi.tif", stats=["mean", "max"])\`.

## Key points
- Read bands to arrays, do numpy maths, write back with the same geotransform and CRS.
- \`np.digitize\` or \`np.where\` for reclassification; boolean masks for zonal statistics.
- Rasterio: \`with rasterio.open(...) as src\`, \`src.read(1)\`, \`src.profile\`, \`rasterio.mask.mask\`.`,
      },
      {
        id: 'folium-maps',
        title: 'Interactive web maps with Folium',
        minutes: 10,
        body: `# Folium: Leaflet maps from Python
**Folium** writes a Leaflet web map (an HTML file) from Python. It is ideal for sharing results with people who don't have GIS software: they just open the HTML file.

## Folium (on your computer or in Colab / Jupyter)
\`\`\`python-desktop
import folium
import geopandas as gpd

m = folium.Map(location=[27.7172, 85.3240], zoom_start=12, tiles=None)
folium.TileLayer(
    tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attr="Tiles © Esri", name="Street").add_to(m)
folium.TileLayer(
    tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr="Imagery © Esri", name="Satellite").add_to(m)

folium.Marker([27.7172, 85.3240], popup="<b>Kathmandu</b>", tooltip="Click me").add_to(m)
folium.Circle([27.7056, 85.3143], radius=500, color="red", fill=True, popup="500 m buffer").add_to(m)

wards = gpd.read_file("wards.geojson").to_crs("EPSG:4326")
folium.Choropleth(geo_data=wards, data=wards, columns=["ward", "population"],
                  key_on="feature.properties.ward", fill_color="YlOrRd", legend_name="Population").add_to(m)
folium.LayerControl().add_to(m)
m.save("map.html")      # open in any browser; in Jupyter just put m on the last line
\`\`\`

## The same map in plain Leaflet (runs here)
Folium produces Leaflet code like this. Press **Try it** to see it live:
\`\`\`html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
<div id="map"></div>
<script>
  const street = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Imagery &copy; Esri' });
  const map = L.map('map', { layers: [street] }).setView([27.7172, 85.3240], 12);
  L.marker([27.7172, 85.3240]).addTo(map).bindPopup('<b>Kathmandu</b>').bindTooltip('Click me');
  L.circle([27.7056, 85.3143], { radius: 500, color: 'red' }).addTo(map).bindPopup('500 m buffer');
  L.control.layers({ 'Street': street, 'Satellite': sat }).addTo(map);
  console.log('Map ready');
</script>
</body>
</html>
\`\`\`

## Key points
- \`folium.Map\` → add markers, shapes, GeoJSON, choropleths → \`m.save("map.html")\`.
- Always set \`attr\` (attribution) for custom tiles.
- For bigger, styled web maps continue with the *Leaflet* and *MapLibre* courses.`,
      },
      {
        id: 'pyqgis',
        title: 'Python and QGIS (PyQGIS)',
        minutes: 14,
        body: `# Automating QGIS
Every QGIS tool can be run from Python. Open **Plugins ▸ Python Console** (Ctrl+Alt+P), or the **Show Editor** button there to write longer scripts. All the code below runs **inside QGIS**.

## Layers: load, inspect, loop over features
\`\`\`pyqgis
# Load a vector layer and add it to the map
layer = iface.addVectorLayer("C:/data/parcels.gpkg|layername=parcels", "Parcels", "ogr")
print(layer.crs().authid(), layer.featureCount(), "features")
print([f.name() for f in layer.fields()])

# Loop over features (like rows of a GeoDataFrame)
for f in layer.getFeatures():
    print(f["parcel_id"], round(f.geometry().area(), 1))

# Select by expression, like the "Select by Expression" dialog
layer.selectByExpression('"land_use" = \\'Residential\\' AND $area > 500')
print(layer.selectedFeatureCount(), "selected")
\`\`\`

## Run Processing tools from Python
Find a tool's ID and parameters with \`processing.algorithmHelp("native:buffer")\`, or run it once from the toolbox and copy the command from **Processing ▸ History**.
\`\`\`pyqgis
import processing

buf = processing.run("native:buffer", {
    "INPUT": "C:/data/rivers.gpkg", "DISTANCE": 30, "SEGMENTS": 8,
    "DISSOLVE": True, "OUTPUT": "C:/data/river_setback_30m.gpkg"})
iface.addVectorLayer(buf["OUTPUT"], "River setback 30 m", "ogr")

processing.run("native:clip", {"INPUT": "C:/data/buildings.gpkg",
    "OVERLAY": "C:/data/river_setback_30m.gpkg", "OUTPUT": "C:/data/buildings_in_setback.gpkg"})

processing.run("gdal:slope", {"INPUT": "C:/data/dem_utm.tif", "BAND": 1,
    "SCALE": 1, "AS_PERCENT": False, "OUTPUT": "C:/data/slope.tif"})
\`\`\`

## Batch: the same job for every file in a folder
\`\`\`pyqgis
import glob, os, processing

for path in glob.glob("C:/data/wards/*.gpkg"):
    out = path.replace(".gpkg", "_area.gpkg")
    processing.run("native:fieldcalculator", {
        "INPUT": path, "FIELD_NAME": "ropani", "FIELD_TYPE": 0, "FIELD_LENGTH": 12, "FIELD_PRECISION": 3,
        "FORMULA": "$area / 508.72", "OUTPUT": out})
    print("done:", os.path.basename(out))
\`\`\`

## Key points
- \`iface\` controls the QGIS window; \`QgsVectorLayer\` / \`QgsRasterLayer\` are the data.
- \`processing.run("provider:tool", {params})\` runs any toolbox tool.
- Copy commands from Processing ▸ History, then loop them over many files.`,
      },
    ],
  },

  // =======================================================================
  {
    id: 'dem-analysis',
    title: 'DEM Analysis: Slope, Hillshade & Cut-Fill',
    level: 'Intermediate',
    color: 'stone',
    summary: 'Where DEMs come from and how accurate they are, terrain products (slope, aspect, hillshade, contours) and earthwork cut-fill volumes, with runnable Python and GDAL.',
    lessons: [
      {
        id: 'dem-intro',
        title: 'Introduction to DEMs: types, sources and accuracy',
        minutes: 12,
        body: `# What is a DEM?
A **Digital Elevation Model** is a raster where each cell stores a height.

| Term | Surface it shows | Example |
|---|---|---|
| **DSM** (surface model) | Top of everything: roofs, trees | Drone photogrammetry, SRTM in forests |
| **DTM** (terrain model) | Bare ground | LiDAR ground points, surveyed contours |
| **DEM** | General term; often means DTM | |

## Free DEMs for Nepal
| DEM | Cell size | Notes |
|---|---|---|
| Copernicus GLO-30 | 30 m | Usually the most accurate free global DEM; DSM (includes canopy) |
| NASADEM / SRTM | 30 m | Year 2000 radar; voids filled; good, older |
| ALOS AW3D30 | 30 m | Optical stereo; good in steep terrain |
| MERIT DEM / Hydro | 90 m | Errors removed for hydrology (watersheds) |
| Survey Department topo maps | 20 m or 40 m contours | Digitise contours → interpolate; official base |
| Drone / LiDAR | 5 cm – 1 m | Needed for detailed design and earthwork |

Download in MapNiti (**Data Download ▸ DEM**) or from OpenTopography.

## Heights: which zero?
GNSS gives **ellipsoidal** heights (WGS84). Maps and DEMs use heights above **mean sea level**, through a geoid (EGM96 or EGM2008). In Nepal the difference is roughly −25 to −40 m, so never mix the two without converting.

## Accuracy you can expect
Global 30 m DEMs typically have vertical errors of a few metres on open, gentle ground, and much larger errors on steep slopes and under forest. They are fine for planning and catchments, not for detailed design, which needs a ground survey or LiDAR.

## Explore a DEM's statistics
\`\`\`python
import numpy as np
import matplotlib.pyplot as plt

# Synthetic 90 x 90 hill-valley DEM, 30 m cells
y, x = np.mgrid[0:90, 0:90] * 30.0
dem = 1400 + 250 * np.exp(-((x - 900) ** 2 + (y - 1300) ** 2) / 6e5) \\
      - 120 * np.exp(-((x - 1800) ** 2) / 2e5) + 0.04 * y

print(f"Min {dem.min():.0f} m, max {dem.max():.0f} m, mean {dem.mean():.0f} m, relief {np.ptp(dem):.0f} m")
for p in (10, 50, 90):
    print(f"{p}% of the area is below {np.percentile(dem, p):.0f} m")

fig, ax = plt.subplots(1, 2, figsize=(10, 4))
im = ax[0].imshow(dem, cmap="terrain"); ax[0].set_title("DEM (m)"); fig.colorbar(im, ax=ax[0])
ax[1].hist(dem.ravel(), bins=40, color="#78716c"); ax[1].set_title("Elevation histogram"); ax[1].set_xlabel("m")
\`\`\`

## Key points
- DSM includes trees and buildings; DTM is bare ground.
- Copernicus 30 m for general work, MERIT for hydrology, survey or LiDAR for design.
- Keep track of the vertical datum: ellipsoid vs geoid (MSL).`,
      },
      {
        id: 'dem-products',
        title: 'DEM products: slope, aspect, hillshade and contours',
        minutes: 15,
        body: `# Terrain products
| Product | Meaning | Used for |
|---|---|---|
| **Slope** | Steepness (° or %) | Road gradients, landslide screening, building suitability |
| **Aspect** | Direction the slope faces (0° = north) | Solar exposure, snow, vegetation |
| **Hillshade** | Shaded relief from a light source | Map backgrounds |
| **Contours** | Lines of equal height | Engineering drawings |

## Slope, aspect and hillshade with numpy
\`\`\`python
import numpy as np
import matplotlib.pyplot as plt

cell = 30.0
y, x = np.mgrid[0:80, 0:80] * cell
dem = 1400 + 250 * np.exp(-((x - 900) ** 2 + (y - 1100) ** 2) / 5e5) + 0.05 * y

# Gradients: rows increase SOUTHWARD in a north-up raster, so north = -dz/drow
dz_drow, dz_dcol = np.gradient(dem, cell)
dz_dx, dz_dy = dz_dcol, -dz_drow
slope = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
aspect = (np.degrees(np.arctan2(-dz_dx, -dz_dy)) + 360) % 360   # downslope direction, 0 = north

az, alt = np.radians(315), np.radians(45)                       # light from the north-west
slope_r, aspect_r = np.radians(slope), np.radians(aspect)
hill = 255 * (np.sin(alt) * np.cos(slope_r) + np.cos(alt) * np.sin(slope_r) * np.cos(az - aspect_r))
hill = np.clip(hill, 0, 255)

print(f"Slope: mean {slope.mean():.1f}°, max {slope.max():.1f}°")
print(f"Share steeper than 15°: {(slope > 15).mean() * 100:.1f}%")

fig, ax = plt.subplots(1, 3, figsize=(12, 3.8))
ax[0].imshow(hill, cmap="gray"); ax[0].set_title("Hillshade")
im = ax[1].imshow(slope, cmap="YlOrRd"); ax[1].set_title("Slope (°)"); fig.colorbar(im, ax=ax[1])
cs = ax[2].contour(dem, levels=np.arange(1400, 1700, 20), cmap="terrain")
ax[2].clabel(cs, fontsize=7); ax[2].invert_yaxis(); ax[2].set_title("20 m contours"); ax[2].set_aspect("equal")
\`\`\`

## The professional way: gdaldem (on your computer, Colab or QGIS)
\`\`\`python-desktop
from osgeo import gdal, osr
import numpy as np
gdal.UseExceptions()

cell = 30.0
y, x = np.mgrid[0:80, 0:80] * cell
dem = (1400 + 250 * np.exp(-((x - 900) ** 2 + (y - 1100) ** 2) / 5e5) + 0.05 * y).astype("float32")

ds = gdal.GetDriverByName("GTiff").Create("/vsimem/dem.tif", 80, 80, 1, gdal.GDT_Float32)
ds.SetGeoTransform((334000, cell, 0, 3068000, 0, -cell))
s = osr.SpatialReference(); s.ImportFromEPSG(32645); ds.SetProjection(s.ExportToWkt())
ds.GetRasterBand(1).WriteArray(dem); ds = None

gdal.DEMProcessing("/vsimem/slope.tif", "/vsimem/dem.tif", "slope")           # degrees
gdal.DEMProcessing("/vsimem/aspect.tif", "/vsimem/dem.tif", "aspect")
gdal.DEMProcessing("/vsimem/hill.tif", "/vsimem/dem.tif", "hillshade", azimuth=315, altitude=45)

slope = gdal.Open("/vsimem/slope.tif").ReadAsArray()
valid = slope[slope >= 0]                       # edge cells are nodata (-9999)
print(f"gdaldem slope: mean {valid.mean():.1f}°, max {valid.max():.1f}°")
for lo, hi in [(0, 5), (5, 15), (15, 30), (30, 90)]:
    print(f"  {lo:>2}–{hi:<2}°: {((valid >= lo) & (valid < hi)).mean() * 100:5.1f}% of the area")
\`\`\`
On your computer the same is one command: \`gdaldem slope dem.tif slope.tif\`. For a DEM in degrees (EPSG:4326) add \`-s 111120\`, or better, reproject to UTM first.

## Key points
- Slope and aspect come from the elevation gradient in x and y.
- Hillshade = slope + aspect lit from 315° at 45° altitude.
- \`gdal.DEMProcessing\` / \`gdaldem\` gives standard results; compute in a projected CRS.`,
      },
      {
        id: 'cut-fill',
        title: 'Cut and fill volume analysis',
        minutes: 15,
        body: `# Earthwork volumes from DEMs
For a building platform, road or pond, compare the **existing ground** with the **design surface** cell by cell:

- Difference d = design − existing
- d < 0 → **cut** (remove soil), d > 0 → **fill** (bring soil)
- Volume = Σ |d| × cell area, summed separately for cut and fill

This is the **grid method**, the same one used by Civil 3D and QGIS volume tools.

## Platform at a fixed level, and the balanced level
\`\`\`python
import numpy as np
import matplotlib.pyplot as plt

cell = 1.0                                    # 1 m grid (from a drone or total-station survey)
y, x = np.mgrid[0:40, 0:60] * cell            # 60 m × 40 m site
existing = 1302 + 0.08 * x - 0.05 * y + 0.6 * np.sin(x / 7) * np.cos(y / 9)

def volumes(design_level, shrink=1.0):
    d = design_level - existing
    cut = -d[d < 0].sum() * cell * cell
    fill = d[d > 0].sum() * cell * cell
    return cut, fill, cut * shrink - fill      # positive = surplus soil after compaction

for level in [1303.0, 1303.5, 1304.0]:
    c, f, net = volumes(level)
    print(f"Level {level:.1f} m: cut {c:7.1f} m³, fill {f:7.1f} m³, net {net:+7.1f} m³")

# Balanced level: cut = fill (bisection), with 10% loss of volume when cut soil is compacted
lo, hi = existing.min(), existing.max()
for _ in range(60):
    mid = (lo + hi) / 2
    if volumes(mid, shrink=0.9)[2] > 0:
        lo = mid
    else:
        hi = mid
c, f, _ = volumes(mid, 0.9)
print(f"\\nBalanced formation level (shrinkage 10%): {mid:.3f} m  →  cut {c:.0f} m³, fill {f:.0f} m³")

d = mid - existing
plt.figure(figsize=(7, 4))
im = plt.imshow(d, cmap="RdBu", vmin=-np.abs(d).max(), vmax=np.abs(d).max())
plt.colorbar(im, label="design − existing (m): blue = fill, red = cut")
plt.contour(d, levels=[0], colors="black", linewidths=1.5)
plt.title(f"Cut / fill at {mid:.2f} m (black line = no cut, no fill)")
\`\`\`
The volume of soil changes when it is moved: it **bulks** when dug up and **shrinks** when compacted in fill. Use factors from your geotechnical report, not the 10% in the example.

## Two real surfaces (on your computer)
For a sloped road or a designed surface, export the design as a raster on the **same grid** as the survey DEM:
\`\`\`python-desktop
import rasterio
import numpy as np

with rasterio.open("existing_dtm.tif") as e, rasterio.open("design_surface.tif") as d:
    assert e.transform == d.transform and e.shape == d.shape, "Resample to the same grid first (gdalwarp -tr -te)"
    ex, de = e.read(1, masked=True), d.read(1, masked=True)
    cell_area = abs(e.transform.a * e.transform.e)

diff = de - ex
cut = float(-diff[diff < 0].sum() * cell_area)
fill = float(diff[diff > 0].sum() * cell_area)
print(f"Cut {cut:,.0f} m³ | Fill {fill:,.0f} m³ | Net {cut - fill:+,.0f} m³")
\`\`\`

## Accuracy check
- Cell size: 0.5–1 m for building sites; a 30 m global DEM is **not** suitable for earthwork quantities.
- A vertical error of 10 cm over 2,400 m² is 240 m³. Survey accuracy matters more than the formula.
- Compare with the cross-section (end-area) method along a road as an independent check.

## Key points
- Grid method: volume = Σ (design − existing) × cell area, cut and fill separately.
- Find the balanced level by trial (bisection), including shrink/bulk factors.
- Both surfaces must share the same grid; use survey-grade DTMs for quantities.`,
      },
    ],
  },
];
