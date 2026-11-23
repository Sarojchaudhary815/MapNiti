**GDAL** (Geospatial Data Abstraction Library) is the engine underneath almost every GIS program: QGIS, ArcGIS, Google Earth and GeoPandas all use it to read and write files. GDAL handles **rasters** (grids such as DEMs and satellite images) and its vector half, **OGR**, handles points, lines and polygons. It can read and write well over 200 formats.

You will often use friendlier libraries on top of GDAL (Rasterio, GeoPandas), but knowing GDAL itself helps when you need full control, and its command-line tools convert files in one line.

> **Note:** GDAL's Python bindings (`from osgeo import gdal`) are not available in the browser, so the cells in this chapter are marked **Desktop**. Each shows the output from a real run. Run them on your computer with the `gis` environment from *Environment Setup*, in Google Colab, or in the **QGIS Python Console**, where GDAL is already installed. Download `demo_dem.tif` from *Practice Datasets* into your `data/` folder first.

## What is inside a raster?

Every raster file has three parts:

| Part | What it is |
|---|---|
| **Values** | A grid of numbers (one grid per **band**): elevations, reflectance, class codes |
| **Geotransform** | Where the grid sits on Earth: origin and pixel size |
| **CRS** | What the coordinates mean, e.g. UTM 45N |

## Opening a raster and reading its metadata

```python-desktop
from osgeo import gdal
gdal.UseExceptions()

ds = gdal.Open("data/demo_dem.tif")
print("Driver:", ds.GetDriver().ShortName)
print("Size:", ds.RasterXSize, "columns x", ds.RasterYSize, "rows,", ds.RasterCount, "band(s)")
print("Geotransform:", ds.GetGeoTransform())
```

```output
Driver: GTiff
Size: 150 columns x 80 rows, 1 band(s)
Geotransform: (299700.0, 30.0, 0.0, 3042700.0, 0.0, -30.0)
```

- `gdal.UseExceptions()` makes GDAL raise normal Python errors instead of silently returning `None`.
- `gdal.Open` opens the file; nothing is read into memory yet.

The **geotransform** is six numbers: `(x_origin, pixel_width, row_rotation, y_origin, column_rotation, -pixel_height)`. The origin is the **top-left corner** of the top-left pixel, and the pixel height is negative because rows go *down* (southwards) while northing goes *up*. Here each pixel is 30 m × 30 m.

## The coordinate reference system

```python-desktop
from osgeo import osr

srs = osr.SpatialReference(wkt=ds.GetProjection())
print("CRS name:", srs.GetName())
print("EPSG:", srs.GetAuthorityCode(None))
print("Units:", srs.GetLinearUnitsName())
```

```output
CRS name: WGS 84 / UTM zone 45N
EPSG: 32645
Units: metre
```

## Reading the values as a NumPy array

```python-desktop
band = ds.GetRasterBand(1)
dem = band.ReadAsArray()
print("Array shape:", dem.shape, "| type:", dem.dtype)
print("NoData value:", band.GetNoDataValue())
print(f"Min {dem.min():.1f} m, max {dem.max():.1f} m, mean {dem.mean():.1f} m")
```

```output
Array shape: (80, 150) | type: float32
NoData value: -9999.0
Min 902.4 m, max 1370.0 m, mean 1067.1 m
```

- Bands are numbered from **1**, not 0.
- `ReadAsArray()` returns a NumPy array of shape (rows, columns). From here on it is ordinary NumPy maths.
- The **NoData** value marks empty pixels. Always exclude it before computing statistics on real data.

## From pixel to map coordinates and back

The geotransform converts between a pixel position (row, column) and a map position (easting, northing):

```python-desktop
gt = ds.GetGeoTransform()

row, col = 40, 100
x = gt[0] + (col + 0.5) * gt[1]      # +0.5 = centre of the pixel
y = gt[3] + (row + 0.5) * gt[5]
print(f"Pixel (row {row}, col {col}) centre = E {x:.1f}, N {y:.1f}, elevation {dem[row, col]:.1f} m")

e, n = 302900.0, 3041050.0
c = int((e - gt[0]) / gt[1])
r = int((n - gt[3]) / gt[5])
print(f"E {e}, N {n} is pixel row {r}, col {c}: elevation {dem[r, c]:.1f} m")
```

```output
Pixel (row 40, col 100) centre = E 302715.0, N 3041485.0, elevation 1205.8 m
E 302900.0, N 3041050.0 is pixel row 55, col 106: elevation 1042.4 m
```

This is exactly what a "point inspector" tool does when you click on a DEM.

## Writing a new raster

To save a result, create a file with the same size, geotransform and CRS as the input. Here we save the elevation above the lowest point:

```python-desktop
import numpy as np

relief = (dem - dem.min()).astype("float32")

driver = gdal.GetDriverByName("GTiff")
out = driver.Create("relief.tif", ds.RasterXSize, ds.RasterYSize, 1, gdal.GDT_Float32, options=["COMPRESS=DEFLATE"])
out.SetGeoTransform(ds.GetGeoTransform())
out.SetProjection(ds.GetProjection())
out.GetRasterBand(1).WriteArray(relief)
out.GetRasterBand(1).SetNoDataValue(-9999)
out = None          # closing the dataset writes it to disk

check = gdal.Open("relief.tif")
print("Saved relief.tif, max relief:", round(float(check.GetRasterBand(1).ReadAsArray().max()), 1), "m")
```

```output
Saved relief.tif, max relief: 467.6 m
```

> **Remember:** GDAL writes the file when the dataset is closed. Setting it to `None` (or ending the script) closes it. Forgetting this gives empty or incomplete files.

## Vectors with OGR

OGR works the same way for vector data: a **data source** contains **layers**, a layer contains **features**, and each feature has **fields** and a **geometry**.

```python-desktop
from osgeo import ogr
ogr.UseExceptions()

src = ogr.Open("data/demo_wards.geojson")
layer = src.GetLayer(0)
print("Layer:", layer.GetName(), "|", layer.GetFeatureCount(), "features")
print("Fields:", [layer.GetLayerDefn().GetFieldDefn(i).GetName() for i in range(layer.GetLayerDefn().GetFieldCount())])

for feat in layer:
    geom = feat.GetGeometryRef()
    print(f"  ward {feat.GetField('ward')}: population {feat.GetField('population'):>6}, centroid {geom.Centroid().ExportToWkt()}")
```

```output
Layer: demo_wards | 6 features
Fields: ['ward', 'municipality', 'population', 'households']
  ward 1: population   8200, centroid POINT (84.9834475674064 27.4744063725477)
  ward 2: population  12400, centroid POINT (84.998621096672 27.4746253898156)
  ward 3: population   6100, centroid POINT (85.0137947968369 27.4748427551041)
  ward 4: population  15300, centroid POINT (84.98325032661 27.4852332066251)
  ward 5: population   9800, centroid POINT (84.9984253375872 27.4854523245587)
  ward 6: population   4700, centroid POINT (85.0136005195355 27.485669789754)
```

## Writing vectors with OGR

```python-desktop
from osgeo import osr

srs = osr.SpatialReference()
srs.ImportFromEPSG(32645)

out = ogr.GetDriverByName("GPKG").CreateDataSource("survey.gpkg")
lyr = out.CreateLayer("benchmarks", srs, ogr.wkbPoint)
lyr.CreateField(ogr.FieldDefn("name", ogr.OFTString))
lyr.CreateField(ogr.FieldDefn("rl", ogr.OFTReal))

for name, e, n, rl in [("BM1", 300450.0, 3040380.0, 912.40), ("BM2", 302800.0, 3041120.0, 931.75)]:
    f = ogr.Feature(lyr.GetLayerDefn())
    f.SetField("name", name)
    f.SetField("rl", rl)
    f.SetGeometry(ogr.CreateGeometryFromWkt(f"POINT ({e} {n})"))
    lyr.CreateFeature(f)
out = None

check = ogr.Open("survey.gpkg")      # keep the data source in a variable while using its layers
print("Features written:", check.GetLayer("benchmarks").GetFeatureCount())
```

```output
Features written: 2
```

Keep the opened data source in a variable (`check`) while you use its layers: if Python discards the data source, its layers become invalid. In practice GeoPandas does this in two lines, which is why most people use it for vectors. OGR is useful when you need streaming access to very large files.

## The GDAL command-line tools

GDAL also installs command-line programs. They do common jobs in one line and are perfect for batch scripts. Run them in the Miniforge Prompt or a terminal:

```bash
gdalinfo data/demo_dem.tif                                            # size, CRS, extent, statistics
gdalwarp -t_srs EPSG:4326 data/demo_dem.tif dem_wgs84.tif             # reproject
gdalwarp -tr 90 90 -r average data/demo_dem.tif dem_90m.tif           # resample to 90 m
gdalwarp -cutline data/demo_wards.geojson -crop_to_cutline data/demo_dem.tif dem_town.tif   # clip
gdal_translate -of COG data/demo_dem.tif dem_cog.tif                  # Cloud-Optimised GeoTIFF
gdaldem hillshade data/demo_dem.tif hillshade.tif                     # hillshade
gdal_contour -a elev -i 20 data/demo_dem.tif contours.gpkg            # 20 m contours
ogr2ogr -f GPKG wards_utm.gpkg data/demo_wards.geojson -t_srs EPSG:32645   # convert + reproject vectors
```

The same tools are available from Python as functions, for example `gdal.Warp(...)`, `gdal.Translate(...)` and `gdal.DEMProcessing(...)`:

```python-desktop
gdal.Warp("dem_90m.tif", "data/demo_dem.tif", xRes=90, yRes=90, resampleAlg="average")
small = gdal.Open("dem_90m.tif")
print("Resampled size:", small.RasterXSize, "x", small.RasterYSize)
```

```output
Resampled size: 50 x 27
```

## Key points

- Raster = values + geotransform + CRS. The origin is the top-left corner; pixel height is negative.
- `gdal.Open` → `GetRasterBand(1).ReadAsArray()` gives a NumPy array; bands start at 1.
- To write: `Create`, set geotransform and projection, `WriteArray`, then close with `= None`.
- OGR: data source → layer → features with fields and geometry.
- `gdalwarp`, `gdal_translate`, `gdaldem`, `ogr2ogr` do most conversions in one line.
