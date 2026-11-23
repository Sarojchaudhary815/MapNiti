QGIS has Python built in. Everything you can click in QGIS can also be done with code, called **PyQGIS**: loading layers, reading attributes, running any Processing tool, styling layers and exporting maps. It is the best way to repeat a QGIS workflow on many files, or to share an exact method with colleagues.

> **Note:** The code in this chapter runs **inside QGIS**, not in the browser. Open QGIS, then **Plugins ▸ Python Console** (Ctrl + Alt + P). For longer scripts, click **Show Editor** in the console, paste the code, and press the Run button. Replace `C:/project/data/` with the folder where you saved the practice datasets.

## The Python Console and iface

In the console, two objects are always ready:

- `iface` controls the QGIS window: the map canvas, the layer panel, messages.
- `QgsProject.instance()` is the current project: its layers and settings.

```pyqgis
print(Qgis.QGIS_VERSION)
print("Layers in this project:", len(QgsProject.instance().mapLayers()))
iface.messageBar().pushMessage("Hello", "Python is talking to QGIS", level=Qgis.Info)
```

## Loading layers

```pyqgis
data = "C:/project/data/"

wards = iface.addVectorLayer(data + "demo_wards.geojson", "Wards", "ogr")
roads = iface.addVectorLayer(data + "demo_roads.geojson", "Roads", "ogr")
dem = iface.addRasterLayer(data + "demo_dem.tif", "DEM")

print(wards.featureCount(), "wards,", wards.crs().authid())
print("DEM size:", dem.width(), "x", dem.height())
```

`addVectorLayer(path, name, provider)` loads the file **and** adds it to the map. To load without showing it, create `QgsVectorLayer(path, name, "ogr")` instead.

## Reading attributes and geometry

A layer is a collection of **features**; each has attributes and a geometry, just like a row of a GeoDataFrame:

```pyqgis
print([f.name() for f in wards.fields()])

for f in wards.getFeatures():
    geom = f.geometry()
    print(f"Ward {f['ward']}: population {f['population']}, area {geom.area():.6f} (layer units)")
```

The wards are stored in degrees (EPSG:4326), so `geom.area()` is in square degrees. For real areas, reproject the layer first (see below), or use `QgsDistanceArea` for ellipsoidal measurements.

## Selecting with an expression

QGIS expressions (the same as in the *Select by Expression* dialog) work from Python:

```pyqgis
wards.selectByExpression('"population" > 9000')
print("Selected wards:", [f["ward"] for f in wards.selectedFeatures()])

wards.removeSelection()
```

## Running Processing tools

Every tool in the Processing Toolbox can be run with `processing.run(tool_id, parameters)`. The easiest way to get the exact call is to run the tool once from the toolbox, then open **Processing ▸ History** and copy the Python command.

```pyqgis
import processing

utm = processing.run("native:reprojectlayer", {
    "INPUT": wards, "TARGET_CRS": "EPSG:32645", "OUTPUT": "memory:wards_utm"})["OUTPUT"]
river_utm = processing.run("native:reprojectlayer", {
    "INPUT": data + "demo_river.geojson", "TARGET_CRS": "EPSG:32645", "OUTPUT": "memory:"})["OUTPUT"]

zone = processing.run("native:buffer", {
    "INPUT": river_utm, "DISTANCE": 50, "SEGMENTS": 8,
    "DISSOLVE": True, "OUTPUT": "memory:river_setback_50m"})["OUTPUT"]

QgsProject.instance().addMapLayer(utm)
QgsProject.instance().addMapLayer(zone)
print("Ward areas (m²):", [round(f.geometry().area()) for f in utm.getFeatures()])
print("Setback zone (ha):", round(next(zone.getFeatures()).geometry().area() / 1e4, 1))
```

- `"OUTPUT": "memory:"` keeps the result in memory; give a file path such as `data + "wards_utm.gpkg"` to save it.
- `processing.algorithmHelp("native:buffer")` prints every parameter of a tool.

> **Warning:** A buffer distance is in the **layer's units**. On a layer in degrees, a distance of 50 means 50 degrees! That is why the river is reprojected to UTM 45N (metres) before buffering.

## Raster tools: slope from the DEM

```pyqgis
slope = processing.run("native:slope", {
    "INPUT": data + "demo_dem.tif", "Z_FACTOR": 1, "OUTPUT": data + "demo_slope.tif"})["OUTPUT"]
iface.addRasterLayer(slope, "Slope (degrees)")

stats = processing.run("native:zonalstatisticsfb", {
    "INPUT": utm, "INPUT_RASTER": slope, "RASTER_BAND": 1, "COLUMN_PREFIX": "slope_",
    "STATISTICS": [2, 6], "OUTPUT": "memory:ward_slope"})["OUTPUT"]
for f in stats.getFeatures():
    print(f"Ward {f['ward']}: mean slope {f['slope_mean']:.1f}°, max {f['slope_max']:.1f}°")
```

`STATISTICS: [2, 6]` asks for the mean (2) and the maximum (6); `algorithmHelp` lists all the codes.

## Batch processing a folder

The real power: the same steps for every file in a folder. This reprojects and clips every GeoJSON in `data/` to the ward boundary:

```pyqgis
import glob, os

out_dir = data + "clipped/"
os.makedirs(out_dir, exist_ok=True)

for path in glob.glob(data + "*.geojson"):
    name = os.path.splitext(os.path.basename(path))[0]
    if name == "demo_wards":
        continue
    processing.run("native:clip", {
        "INPUT": path, "OVERLAY": data + "demo_wards.geojson",
        "OUTPUT": out_dir + name + "_clip.gpkg"})
    print("clipped:", name)
```

## Styling a layer

```pyqgis
renderer = QgsGraduatedSymbolRenderer("population")
renderer.setClassificationMethod(QgsClassificationJenks())
renderer.updateClasses(utm, 5)
renderer.updateColorRamp(QgsStyle().defaultStyle().colorRamp("Reds"))
utm.setRenderer(renderer)
utm.triggerRepaint()
iface.layerTreeView().refreshLayerSymbology(utm.id())
```

This creates a graduated (choropleth) style with 5 natural-breaks classes, the same as *Symbology ▸ Graduated* in the layer properties.

## Running PyQGIS outside QGIS

Scripts can also run without opening the QGIS window, for example on a schedule. Use the Python that ships with QGIS (on Windows, the **OSGeo4W Shell** or `python-qgis.bat` in the QGIS `bin` folder):

```pyqgis
from qgis.core import QgsApplication, QgsVectorLayer

app = QgsApplication([], False)       # False = no graphical interface
app.initQgis()

layer = QgsVectorLayer("C:/project/data/demo_wards.geojson", "wards", "ogr")
print("Valid:", layer.isValid(), "| features:", layer.featureCount())

app.exitQgis()
```

## Key points

- Open **Plugins ▸ Python Console**; `iface` controls the window, `QgsProject.instance()` the project.
- `iface.addVectorLayer` / `addRasterLayer` load data; `getFeatures()` loops over features.
- `processing.run("provider:tool", {...})` runs any toolbox tool; copy calls from *Processing ▸ History*.
- Reproject to a metric CRS before buffers and areas.
- Loop over files with `glob` for batch processing.
