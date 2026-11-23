// More courses: Python from zero, QGIS step by step, hydrology with GIS.
// ```python blocks get a "Try it" button (Code Lab). ```pyqgis blocks run in
// the QGIS Python Console, not in the browser.

export const EXTRA_COURSES = [
  // =======================================================================
  {
    id: 'python-basics',
    title: 'Python from Zero',
    level: 'Beginner',
    color: 'sky',
    summary: 'Never coded before? Learn print, variables, numbers, lists, loops, if and functions with engineering examples.',
    lessons: [
      {
        id: 'print-variables',
        title: 'print, variables and comments',
        minutes: 8,
        body: `# Your first Python program
Python is the most used language in GIS (QGIS, ArcGIS, Earth Engine and data science all use it). You can run every example here: press **Try it**, change something, press **Run**.

## print() shows something on the screen
\`\`\`python
print("Namaste!")
print("I am learning Python for GIS.")
print(25 * 4)
\`\`\`
Text goes inside quotes. Numbers and calculations do not need quotes.

## A variable is a named box for a value
\`\`\`python
name = "Ram"            # text (a "string")
plot_length = 25.0      # a number with a decimal point (a "float")
plot_width = 20.0
storeys = 3             # a whole number (an "integer")

area = plot_length * plot_width
print(name, "has a plot of", area, "m²")
print("Floor area of", storeys, "storeys:", area * storeys, "m²")
\`\`\`

## Comments
Anything after \`#\` is a **comment**: Python ignores it. Use comments to explain *why*, for example \`# 1 ropani = 508.72 m²\`.

## f-strings: the neat way to print
Put \`f\` before the quotes and variables inside \`{ }\`. Add \`:.2f\` to round to 2 decimals.
\`\`\`python
name = "Sita"
area = 1017.44
ropani = area / 508.72
print(f"{name}'s plot is {area:.1f} m² = {ropani:.2f} ropani")
\`\`\`

## Key points
- \`print()\` shows output; text needs quotes.
- \`name = value\` stores a value; the name goes on the left.
- Variable names: lowercase with underscores, no spaces (\`plot_area\`, not \`plot area\`).
- Use f-strings: \`f"{value:.2f}"\`.`,
      },
      {
        id: 'numbers-text',
        title: 'Numbers, text and unit conversions',
        minutes: 10,
        body: `# Numbers and maths
| Symbol | Meaning | Example | Result |
|---|---|---|---|
| \`+ - * /\` | add, subtract, multiply, divide | \`7 / 2\` | 3.5 |
| \`//\` | whole-number division | \`7 // 2\` | 3 |
| \`%\` | remainder | \`7 % 2\` | 1 |
| \`**\` | power | \`2 ** 3\` | 8 |

For square roots, trigonometry and π, import the \`math\` module:
\`\`\`python
import math

# Slope length from horizontal distance and height difference
horizontal = 48.0   # m
rise = 6.5          # m
slope_length = math.sqrt(horizontal**2 + rise**2)
angle = math.degrees(math.atan(rise / horizontal))
print(f"Slope length: {slope_length:.3f} m")
print(f"Slope angle: {angle:.2f}°  |  gradient: {rise / horizontal * 100:.1f}%")

# Area of a circular tank
d = 6.0
print(f"Tank area: {math.pi * d**2 / 4:.2f} m²")
\`\`\`
> Trigonometry functions in Python use **radians**. Convert with \`math.radians()\` and \`math.degrees()\`.

## Text (strings)
\`\`\`python
station = "bm-12"
print(station.upper())          # BM-12
print(len(station))             # 5 characters
print("BM" in station.upper())  # True

line = "TP3,334702.41,3066790.30,1305.98"
parts = line.split(",")         # cut text at each comma
print(parts)
rl = float(parts[3])            # text → number
print(f"RL of {parts[0]} is {rl} m")
\`\`\`
\`split()\` and \`float()\` are how you read survey data from text files.

## Practice: a unit converter
\`\`\`python
area_m2 = 2500

ropani = area_m2 / 508.72
bigha = area_m2 / 6772.63
kattha = area_m2 / 338.63
sq_ft = area_m2 * 10.7639

print(f"{area_m2} m² =")
print(f"  {ropani:.3f} ropani")
print(f"  {bigha:.4f} bigha  ({kattha:.2f} kattha)")
print(f"  {sq_ft:,.0f} sq ft")
\`\`\`

## Key points
- \`/\` always gives a decimal; \`//\` and \`%\` split into whole part and remainder.
- \`import math\` for \`sqrt\`, \`sin\`, \`pi\`… angles in radians.
- \`.split(",")\` cuts text; \`float()\` and \`int()\` turn text into numbers.`,
      },
      {
        id: 'lists-loops-if',
        title: 'Lists, loops and if',
        minutes: 12,
        body: `# Working with many values
## Lists
A list holds many values in order, inside \`[ ]\`. Counting starts at **0**.
\`\`\`python
rainfall = [120, 245, 380, 352, 188]     # May–Sep (mm)
print(rainfall[0])        # first item → 120
print(rainfall[-1])       # last item  → 188
print(len(rainfall), "months")
print("Total:", sum(rainfall), "mm | max:", max(rainfall), "mm")

rainfall.append(60)       # add October
print(rainfall)
\`\`\`

## for loops repeat work for each item
\`\`\`python
months = ["May", "Jun", "Jul", "Aug", "Sep"]
rainfall = [120, 245, 380, 352, 188]

for month, rain in zip(months, rainfall):
    print(f"{month}: {rain} mm")
\`\`\`
The indented lines (4 spaces) belong to the loop. \`zip()\` walks through two lists together.

## if / elif / else make decisions
\`\`\`python
slopes = [3.5, 8.0, 14.2, 22.0, 31.5]    # degrees

for s in slopes:
    if s < 5:
        cls = "Flat: OK for building"
    elif s < 15:
        cls = "Gentle: OK with drainage"
    elif s < 30:
        cls = "Steep: needs retaining walls"
    else:
        cls = "Very steep: avoid"
    print(f"{s:5.1f}° → {cls}")
\`\`\`

## range() counts for you
\`\`\`python
# Chainage every 20 m on a 150 m road
for ch in range(0, 151, 20):
    print(f"Ch {ch:>3} m")
\`\`\`
\`range(start, stop, step)\` stops **before** \`stop\`, so use 151 to include 150.

## Practice: count wet months
\`\`\`python
rainfall = {"May": 120, "Jun": 245, "Jul": 380, "Aug": 352, "Sep": 188, "Oct": 60}

wet = []
for month, rain in rainfall.items():
    if rain >= 200:
        wet.append(month)

print("Months with 200 mm or more:", ", ".join(wet))
print(f"Share of total rain in those months: {sum(rainfall[m] for m in wet) / sum(rainfall.values()) * 100:.0f}%")
\`\`\`

## Key points
- Lists: \`[a, b, c]\`, first item is \`[0]\`, last is \`[-1]\`.
- \`for x in list:\` repeats the indented block; indentation matters in Python.
- \`if / elif / else\` checks conditions top to bottom and runs the first true one.`,
      },
      {
        id: 'functions-dicts',
        title: 'Functions and dictionaries: a mini survey calculator',
        minutes: 14,
        body: `# Reusable code
## Functions
A function is a named recipe. Write it once with \`def\`, use it many times. \`return\` sends the answer back.
\`\`\`python
def to_ropani(area_m2):
    return area_m2 / 508.72

def gradient(rise, run):
    """Return gradient in percent."""
    return rise / run * 100

print(f"{to_ropani(1500):.3f} ropani")
print(f"{gradient(4.2, 60):.1f}% gradient")
\`\`\`

## Dictionaries: values with names
A dictionary stores **key: value** pairs inside \`{ }\`. Perfect for a survey station or a GIS feature's attributes.
\`\`\`python
station = {"name": "BM1", "easting": 334500.0, "northing": 3066800.0, "rl": 1301.25}
print(station["name"], "RL =", station["rl"])
station["remarks"] = "On culvert parapet"
for key, value in station.items():
    print(f"{key:9}: {value}")
\`\`\`

## Mini project: plot area from corner coordinates
The **shoelace formula** gives the area of any polygon from its corner coordinates (E, N), the same method a total station program uses.
\`\`\`python
def shoelace_area(points):
    """Area of a polygon from a list of (E, N) corners, in the same units squared."""
    total = 0.0
    n = len(points)
    for i in range(n):
        e1, n1 = points[i]
        e2, n2 = points[(i + 1) % n]    # wrap around to the first point
        total += e1 * n2 - e2 * n1
    return abs(total) / 2

def perimeter(points):
    n = len(points)
    return sum(((points[(i+1) % n][0] - points[i][0])**2 + (points[(i+1) % n][1] - points[i][1])**2) ** 0.5
               for i in range(n))

def to_rapd(area_m2):
    """Ropani-Aana-Paisa-Daam (1 daam = 1.9871875 m²)."""
    daam = area_m2 / 1.9871875
    r, daam = divmod(daam, 256)
    a, daam = divmod(daam, 16)
    p, d = divmod(daam, 4)
    return f"{int(r)}-{int(a)}-{int(p)}-{d:.2f}"

plot = [(334512.10, 3066820.44), (334548.72, 3066824.10),
        (334551.05, 3066790.33), (334515.60, 3066785.90)]

area = shoelace_area(plot)
print(f"Area:      {area:.2f} m²")
print(f"Perimeter: {perimeter(plot):.2f} m")
print(f"R-A-P-D:   {to_rapd(area)}")
\`\`\`
Change the corner coordinates to your own plot and run it again.

## Where to go next
You now know enough Python to follow **Python for GIS & Engineering** (pandas, shapely, design rainfall) and **Hydrology with GIS**.

## Key points
- \`def name(inputs):\` defines a function; \`return\` gives back the result.
- Dictionaries map names to values: \`d["rl"]\`.
- Break a job into small functions: area, perimeter, unit conversion.`,
      },
    ],
  },

  // =======================================================================
  {
    id: 'qgis-desktop',
    title: 'QGIS Step by Step',
    level: 'Beginner',
    color: 'lime',
    summary: 'The free desktop GIS used across Nepal: projects and CRS, importing GPS/CSV/shapefiles, styling, print layouts and everyday analysis tools.',
    lessons: [
      {
        id: 'qgis-start',
        title: 'Install QGIS and set up your first project',
        minutes: 10,
        body: `# Getting started with QGIS
**QGIS** is free, open-source and professional. Government offices, consultants and universities in Nepal use it daily. Download it from [qgis.org](https://qgis.org/download/). Choose the **LTR** (long-term release) for stable office work.

## The main window
| Part | What it is for |
|---|---|
| **Browser** panel | Find files, databases and online basemaps |
| **Layers** panel | The layers in your map; drag to change drawing order |
| **Map canvas** | The map itself |
| **Status bar** (bottom) | Mouse coordinates, scale and the project **CRS** button |
| **Processing Toolbox** | 1,000+ analysis tools (Ctrl+Alt+T) |

## Step 1: set the project CRS first
1. **Project ▸ Properties ▸ CRS**.
2. Search \`32645\` for **WGS 84 / UTM zone 45N** (eastern and central Nepal, east of 84° E) or \`32644\` for **UTM zone 44N** (western Nepal).
3. Click **OK**. Measurements are now in metres.

> Nepal's cadastral maps use **MUTM** (Everest 1830 datum, central meridians 81°, 84°, 87°). It is not a built-in EPSG code. Create it once under **Settings ▸ Custom Projections** with the parameters from the *GIS Fundamentals* course.

## Step 2: add a basemap
In the Browser panel open **XYZ Tiles ▸ OpenStreetMap** and double-click it. To add satellite imagery, right-click **XYZ Tiles ▸ New Connection** and enter:
\`\`\`text
https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}
\`\`\`

## Step 3: save the project
**Project ▸ Save As** → a \`.qgz\` file. Keep the project file and its data in **one folder**. Then you can copy the folder to another computer and every layer still opens.

## Key points
- Set the project CRS before you measure anything.
- UTM 44N / 45N (EPSG 32644 / 32645) for metric work in Nepal; MUTM for cadastral data.
- One folder per project: \`.qgz\` + data.`,
      },
      {
        id: 'qgis-data',
        title: 'Bring in your data: GPS points, CSV, shapefile, KML, DEM',
        minutes: 12,
        body: `# Loading data
## Survey points from a CSV / Excel sheet
Save your sheet as CSV with columns such as \`name, easting, northing, rl\` (or \`lat, lon\` from a GPS).
1. **Layer ▸ Add Layer ▸ Add Delimited Text Layer…**
2. Pick the file and set **Point coordinates**: X field = easting (or lon), Y field = northing (or lat).
3. Geometry CRS: \`EPSG:32645\` for UTM, \`EPSG:4326\` for GPS latitude/longitude.
4. **Add**. Then right-click the layer ▸ **Export ▸ Save Features As… ▸ GeoPackage** to keep it as real GIS data.

Example CSV:
\`\`\`text
name,easting,northing,rl
BM1,334500.000,3066800.000,1301.250
TP1,334548.120,3066821.450,1303.804
TP2,334601.335,3066840.020,1306.421
\`\`\`

## Vector files
Drag a \`.shp\`, \`.gpkg\`, \`.kml\` or \`.geojson\` file from the Browser panel onto the map.

| Format | Use it for | Note |
|---|---|---|
| **GeoPackage (.gpkg)** | Everyday work | One file, many layers, no 10-character field limit. Best choice |
| Shapefile (.shp) | Sharing with older software | Needs .shp + .shx + .dbf + .prj together |
| KML / KMZ | Google Earth | Always WGS84 |
| GeoJSON | Web maps | Always WGS84 |

## Rasters: DEM and satellite images
Drag a GeoTIFF in. Free DEMs: download from MapNiti **Data Download** (Copernicus 30 m, SRTM, ALOS) or from **OpenTopography**.

## Reprojecting
If a layer is in another CRS, QGIS shows it in the right place on screen but stores it unchanged. To convert the file, use **Processing Toolbox ▸ Vector general ▸ Reproject layer** (or **Raster ▸ Projections ▸ Warp** for rasters).

## Key points
- CSV → *Add Delimited Text Layer* → choose X/Y fields and the CRS they are in.
- Save edited data as **GeoPackage**.
- Reproject files with *Reproject layer* / *Warp*; don't just change the CRS label.`,
      },
      {
        id: 'qgis-style-print',
        title: 'Styling, labels and a print-ready map',
        minutes: 12,
        body: `# Make a professional map
## Symbology
Double-click a layer ▸ **Symbology**:
- **Single symbol**: every feature the same (roads, boundary).
- **Categorized**: a colour per class (land use, ward number).
- **Graduated**: colour ramp by value (population, slope). Choose **Natural Breaks (Jenks)** or **Equal Interval**, and 4–6 classes.
- For DEMs: **Singleband pseudocolor**, and set **Blending mode: Multiply** on a hillshade layer above it for a 3D look.

## Labels
Layer properties ▸ **Labels ▸ Single labels**, pick the field, and add a white **Buffer** so text is readable over imagery.

## Print layout (the map you submit)
1. **Project ▸ New Print Layout…**, give it a name.
2. **Add Item ▸ Add Map**, then drag a rectangle.
3. Add a **Legend**, **Scale Bar**, **North Arrow** and a **Label** for the title.
4. Add a text box with: data sources, CRS (e.g. *WGS 84 / UTM 45N*), author and date.
5. **Layout ▸ Export as PDF** (vector, sharp) or **Export as Image** at 300 dpi.

## Checklist for an engineering map
| Item | Why |
|---|---|
| Title + project name | What and where |
| Scale bar (and scale like 1:5,000 if printed at fixed size) | Measure from the paper |
| North arrow | Orientation |
| Legend with units | Read the colours |
| CRS + data sources + date | Others can trust and reuse it |

## Key points
- Categorized for classes, Graduated for numbers.
- A good map always has title, scale, north arrow, legend, CRS and sources.
- Export PDF for reports, 300 dpi PNG for slides.`,
      },
      {
        id: 'qgis-tools',
        title: 'Everyday analysis tools (with menu paths)',
        minutes: 14,
        body: `# The tools engineers use most
| Task | Menu path | Example use |
|---|---|---|
| **Buffer** | Vector ▸ Geoprocessing Tools ▸ Buffer | 6 m road right-of-way, 30 m river setback |
| **Clip** | Vector ▸ Geoprocessing Tools ▸ Clip | Cut national roads to your municipality |
| **Intersection** | Vector ▸ Geoprocessing Tools ▸ Intersection | Which parcels fall in the flood zone |
| **Dissolve** | Vector ▸ Geoprocessing Tools ▸ Dissolve | Merge wards into one boundary |
| **Field Calculator** | Attribute table ▸ Open field calculator | \`$area\`, \`$length\`, \`$area / 508.72\` (ropani) |
| **Slope** | Raster ▸ Analysis ▸ Slope | Find land steeper than 30° |
| **Hillshade** | Raster ▸ Analysis ▸ Hillshade | Background relief |
| **Contours** | Raster ▸ Extraction ▸ Contour | 5 m or 10 m contour lines |
| **Clip raster** | Raster ▸ Extraction ▸ Clip Raster by Mask Layer | DEM for your AOI only |
| **Raster Calculator** | Raster ▸ Raster Calculator | \`"slope@1" > 30\` |
| **Zonal statistics** | Processing ▸ Raster analysis ▸ Zonal statistics | Mean slope per ward |

## Worked example: land steeper than 30° in a ward
1. Clip the DEM to the ward (**Clip Raster by Mask Layer**).
2. **Slope** on the clipped DEM. Use a projected DEM in metres, or set the scale (111120 for degree DEMs).
3. **Raster Calculator**: \`"slope@1" >= 30\` → a 0/1 raster.
4. **Raster ▸ Conversion ▸ Polygonize**, then keep features where the value = 1.
5. **Field Calculator**: \`$area / 10000\` → hectares.

## Automate with Python (QGIS Python Console)
Open **Plugins ▸ Python Console** and run code like this. It runs inside QGIS, not in the browser:
\`\`\`pyqgis
layer = iface.activeLayer()            # the layer selected in the Layers panel
total = 0
for f in layer.getFeatures():
    total += f.geometry().area()
print(f"{layer.featureCount()} features, total area {total:.1f} m² = {total / 508.72:.2f} ropani")
\`\`\`
(The area is in m² only when the layer CRS is projected, e.g. UTM.)

## Key points
- Vector ▸ Geoprocessing for buffer/clip/intersect/dissolve; Raster ▸ Analysis for slope/hillshade.
- \`$area\` and \`$length\` in the Field Calculator use the project's measurement settings.
- Every Processing tool can be chained in the **Graphical Modeler** or scripted in Python.`,
      },
    ],
  },

  // =======================================================================
  {
    id: 'hydrology-gis',
    title: 'Hydrology with GIS',
    level: 'Intermediate',
    color: 'cyan',
    summary: 'From DEM to streams, time of concentration and rational method, SCS-CN runoff, and channel capacity with Manning, all with runnable Python.',
    lessons: [
      {
        id: 'dem-to-streams',
        title: 'From DEM to streams: flow direction and accumulation',
        minutes: 14,
        body: `# How GIS finds rivers
Water flows downhill. A GIS turns a DEM into a drainage network in four steps:

1. **Fill sinks**: remove small pits so water doesn't get trapped (they are usually DEM errors).
2. **Flow direction (D8)**: each cell sends its water to the **steepest** of its 8 neighbours.
3. **Flow accumulation**: count how many cells drain *through* each cell.
4. **Threshold**: cells with accumulation above a limit (e.g. 1 km² upstream) are **streams**. The catchment of any outlet is every cell that drains to it.

## Try D8 on a tiny 5 × 5 DEM
\`\`\`python
import numpy as np

dem = np.array([
    [50, 49, 48, 47, 46],
    [49, 47, 45, 44, 45],
    [48, 45, 42, 41, 43],
    [47, 44, 41, 38, 40],
    [46, 43, 40, 36, 35],
], dtype=float)
cell = 30.0                       # cell size in metres
rows, cols = dem.shape
moves = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

# 1) Flow direction: steepest downhill neighbour
down = {}
for r in range(rows):
    for c in range(cols):
        best, target = 0.0, None
        for dr, dc in moves:
            rr, cc = r + dr, c + dc
            if 0 <= rr < rows and 0 <= cc < cols:
                dist = cell * (2 ** 0.5 if dr and dc else 1)
                drop = (dem[r, c] - dem[rr, cc]) / dist
                if drop > best:
                    best, target = drop, (rr, cc)
        down[(r, c)] = target

# 2) Flow accumulation: visit cells from highest to lowest and pass the water on
acc = np.ones_like(dem)
for r, c in sorted(down, key=lambda rc: -dem[rc]):
    if down[(r, c)] is not None:
        acc[down[(r, c)]] += acc[r, c]

print("Cells draining through each cell:")
print(acc.astype(int))
r, c = (int(i) for i in np.unravel_index(acc.argmax(), acc.shape))
print(f"Outlet at row {r}, col {c}: {acc.max():.0f} cells = {acc.max() * cell * cell / 1e4:.2f} ha")
print("Stream cells (5 or more cells upstream):")
print(np.where(acc >= 5, "S", "."))
\`\`\`
Change a DEM value (e.g. make the centre cell 30) and watch the flow paths change.

## Real data
- **MERIT Hydro** (90 m) and **HydroSHEDS** already contain flow direction and accumulation for the whole world. MapNiti's *Watershed* and *Drainage Network* tools use them.
- For detailed work use a 30 m (Copernicus) or drone DEM in QGIS: **Processing ▸ GRASS ▸ r.watershed** or the **WhiteboxTools** plugin.
- See the *Bagmati watershed* case study for a real run.

## Key points
- Fill → flow direction (D8) → accumulation → threshold → streams and catchments.
- Upstream area = accumulation × cell area.
- Lower thresholds show smaller gullies; road drainage needs 0.1–0.5 km².`,
      },
      {
        id: 'tc-rational',
        title: 'Time of concentration and the rational method',
        minutes: 12,
        body: `# Peak flow for small catchments
The **rational method** suits small catchments (up to about 50 ha in Nepal road practice; check the code your client uses):

**Q = C × i × A / 360**  with Q in m³/s, i in mm/hr and A in hectares.

- **C**: runoff coefficient (forest 0.1–0.3, cultivated 0.3–0.5, paved 0.7–0.95).
- **i**: rainfall intensity for a duration equal to the **time of concentration (tc)**.
- **A**: catchment area from GIS.

## Time of concentration (Kirpich)
tc (minutes) = 0.0195 × L^0.77 × S^−0.385, with L = longest flow path (m) and S = average slope (m/m) along it. Measure both in GIS: L from the flow path, S = elevation drop / L.

## Worked example
\`\`\`python
L = 1200.0       # longest flow path (m), measured in GIS
H = 96.0         # elevation drop along it (m)
A = 32.0         # catchment area (ha)
C = 0.35         # weighted runoff coefficient

S = H / L
tc = 0.0195 * L**0.77 * S**-0.385          # minutes (Kirpich)
print(f"Slope S = {S:.3f} m/m, tc = {tc:.1f} min")

# Rainfall intensity from an IDF relation  i = K·T^x / (t + b)^n
# These coefficients are an EXAMPLE only — derive yours from DHM rainfall data.
K, x, b, n = 1100.0, 0.20, 10.0, 0.75
for T in [10, 25, 50, 100]:
    i = K * T**x / (tc + b)**n             # mm/hr
    Q = C * i * A / 360                    # m³/s
    print(f"T = {T:>3} yr: i = {i:6.1f} mm/hr  →  Q = {Q:.3f} m³/s")
\`\`\`

## Getting the inputs with GIS
| Input | How |
|---|---|
| A | Delineate the catchment at the crossing (MapNiti Watershed tool / QGIS r.watershed) |
| L, H | Longest flow path and DEM elevations at its two ends |
| C | Area-weighted from land cover (MapNiti LULC tool or ESA WorldCover) |
| i | IDF curve from DHM station data (Gumbel analysis, see *Python for GIS*) |

## Key points
- Rational method only for small catchments; use SCS-CN or a hydrological model for larger ones.
- tc controls i: shorter tc means higher intensity and a bigger peak.
- Never use example IDF coefficients for design.`,
      },
      {
        id: 'scs-cn',
        title: 'SCS Curve Number runoff',
        minutes: 12,
        body: `# How much rain becomes runoff?
The **SCS-CN** (NRCS) method estimates runoff depth from rainfall depth and a **Curve Number** (30–100) that depends on land cover and soil.

- S = 25400 / CN − 254   (potential retention, mm)
- Ia = 0.2 × S            (initial abstraction, mm)
- Q = (P − Ia)² / (P − Ia + S)  when P > Ia, otherwise 0

| Land cover | Soil group A | B | C | D |
|---|---|---|---|---|
| Forest (good) | 30 | 55 | 70 | 77 |
| Cultivated (terraced) | 62 | 71 | 78 | 81 |
| Residential (¼ acre lots) | 61 | 75 | 83 | 87 |
| Paved / roofs | 98 | 98 | 98 | 98 |

(Typical TR-55 values. Soil group A = sandy, fast-draining; D = clay.)

## Composite CN and runoff for a design storm
\`\`\`python
import matplotlib.pyplot as plt

# (land cover, area in ha, CN) — areas from a land-cover map, CN for soil group C
parts = [("Forest", 120, 70), ("Cultivated", 80, 78), ("Settlement", 35, 83), ("Roads", 5, 98)]

A = sum(a for _, a, _ in parts)
CN = sum(a * cn for _, a, cn in parts) / A
print(f"Area {A} ha, composite CN = {CN:.1f}")

def runoff_mm(P, CN):
    S = 25400 / CN - 254
    Ia = 0.2 * S
    return (P - Ia) ** 2 / (P - Ia + S) if P > Ia else 0.0

P = 150.0   # 1-day design rainfall (mm)
Q = runoff_mm(P, CN)
volume = Q / 1000 * A * 10000            # m³
print(f"Rain {P} mm → runoff {Q:.1f} mm ({Q / P * 100:.0f}%), volume {volume:,.0f} m³")

rains = list(range(0, 301, 10))
for cn in [60, 75, 90]:
    plt.plot(rains, [runoff_mm(p, cn) for p in rains], label=f"CN {cn}")
plt.xlabel("Rainfall P (mm)"); plt.ylabel("Runoff Q (mm)")
plt.title("SCS-CN runoff curves"); plt.legend(); plt.grid(alpha=0.3)
\`\`\`

## With GIS
1. Land cover: MapNiti **Land Use / Land Cover** (Dynamic World) or ESA WorldCover.
2. Soil group: from soil texture (SoilGrids sand/clay in the GEE Data Hub).
3. Overlay them (Intersection), give each polygon a CN, area-weight it.

## Key points
- Higher CN = more runoff. Urbanisation raises CN and flood peaks.
- Use composite CN weighted by area.
- Q is a depth (mm); multiply by area for volume.`,
      },
      {
        id: 'manning-channel',
        title: 'Channel and drain capacity with Manning',
        minutes: 14,
        body: `# Will the drain carry the flow?
**Manning's equation** (SI units):

**Q = (1/n) × A × R^(2/3) × S^(1/2)**, with R = A / P (hydraulic radius)

- n: roughness. Concrete 0.013–0.015, stone masonry 0.017–0.025, earth 0.022–0.030, natural streams 0.030–0.050.
- S: bed slope (m/m), from the DEM or a longitudinal survey.

## Normal depth of a trapezoidal drain for the design flow
\`\`\`python
import math

Q_design = 1.20     # m³/s (from rational method / SCS-CN)
b = 0.60            # bottom width (m)
z = 1.0             # side slope, 1 vertical : z horizontal
n = 0.017           # stone masonry
S = 0.01            # bed slope (m/m)

def flow(y):
    A = (b + z * y) * y
    P = b + 2 * y * math.sqrt(1 + z * z)
    return (1 / n) * A * (A / P) ** (2 / 3) * math.sqrt(S)

# Solve flow(y) = Q_design by bisection
lo, hi = 0.0, 5.0
for _ in range(60):
    mid = (lo + hi) / 2
    if flow(mid) < Q_design:
        lo = mid
    else:
        hi = mid
y = (lo + hi) / 2
A = (b + z * y) * y
V = Q_design / A
Fr = V / math.sqrt(9.81 * A / (b + 2 * z * y))   # Froude number (hydraulic depth = A / top width)

print(f"Normal depth y = {y:.3f} m, velocity V = {V:.2f} m/s, Froude = {Fr:.2f}")
print(f"Depth with 0.15 m freeboard: {y + 0.15:.2f} m")
print("Velocity check:", "OK" if 0.6 <= V <= 3.0 else "outside 0.6–3.0 m/s, revise the section or the lining")
\`\`\`
Change the slope S to 0.08 (a steep hill road) and see the velocity and Froude number rise. Steep drains need cascades or energy dissipators.

## GIS workflow for road drainage
1. Streams and catchments at each crossing from the DEM (lesson 1).
2. Peak flow per catchment (lessons 2–3).
3. Bed slope from the DEM profile along the drain (MapNiti **Elevation profile**).
4. Size each drain or culvert with Manning, and tabulate them all in a spreadsheet or pandas.

## Key points
- Manning links flow, section, roughness and slope.
- Solve for depth by trial (bisection), then add freeboard.
- Check velocity: too low → silting, too high → scour.`,
      },
    ],
  },
];
