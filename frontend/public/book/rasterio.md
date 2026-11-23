**Rasterio** reads and writes raster data with GDAL underneath, but with a cleaner, more "Pythonic" interface: files open with `with`, metadata comes as dictionaries, and data comes as NumPy arrays. For day-to-day raster work most people use Rasterio rather than raw GDAL.

> **Note:** Rasterio is not available in the browser, so these cells are marked **Desktop** and show the output of a real run. Install it with `conda install -c conda-forge rasterio`, or use Google Colab. Put `demo_dem.tif`, `demo_red.tif` and `demo_nir.tif` from *Practice Datasets* into your `data/` folder.

## Opening a raster

```python-desktop
import rasterio

with rasterio.open("data/demo_dem.tif") as src:
    print("Size:", src.width, "x", src.height, "| bands:", src.count)
    print("CRS:", src.crs)
    print("Pixel size:", src.res)
    print("Bounds:", src.bounds)
    print("NoData:", src.nodata)
```

```output
Size: 150 x 80 | bands: 1
CRS: EPSG:32645
Pixel size: (30.0, 30.0)
Bounds: BoundingBox(left=299700.0, bottom=3040300.0, right=304200.0, top=3042700.0)
NoData: -9999.0
```

- `with rasterio.open(...) as src:` opens the file and closes it at the end of the block.
- `src.res` is the pixel size (x, y) in CRS units, here metres.
- `src.bounds` gives the left, bottom, right and top edges of the raster.

## The profile: all metadata in one dictionary

```python-desktop
with rasterio.open("data/demo_dem.tif") as src:
    profile = src.profile
    transform = src.transform

for key, value in profile.items():
    print(f"{key:>10}: {value}")
```

```output
    driver: GTiff
     dtype: float32
    nodata: -9999.0
     width: 150
    height: 80
     count: 1
       crs: EPSG:32645
 transform: | 30.00, 0.00, 299700.00|
| 0.00,-30.00, 3042700.00|
| 0.00, 0.00, 1.00|
blockxsize: 150
blockysize: 13
     tiled: False
  compress: deflate
interleave: band
```

The **profile** holds everything needed to write a new file with the same grid. The **transform** is Rasterio's version of GDAL's geotransform, stored as an affine matrix.

## Reading data

```python-desktop
import numpy as np

with rasterio.open("data/demo_dem.tif") as src:
    dem = src.read(1, masked=True)      # band 1, with NoData pixels masked out

print(type(dem).__name__, dem.shape, dem.dtype)
print(f"Min {dem.min():.1f}  Max {dem.max():.1f}  Mean {dem.mean():.1f} m")
```

```output
MaskedArray (80, 150) float32
Min 902.4  Max 1370.0  Mean 1067.1 m
```

`masked=True` returns a *masked array*: NoData pixels are hidden, so `min()`, `mean()` and other statistics ignore them automatically.

## Map coordinates ↔ pixels

```python-desktop
with rasterio.open("data/demo_dem.tif") as src:
    row, col = src.index(302900.0, 3041050.0)       # map → pixel
    x, y = src.xy(row, col)                         # pixel → map (pixel centre)
    print(f"Pixel row {row}, col {col}; centre at E {x:.1f}, N {y:.1f}")
    print(f"Elevation there: {dem[row, col]:.1f} m")

    # Sample several points at once
    points = [(300500.0, 3040500.0), (302000.0, 3041800.0), (303700.0, 3041300.0)]
    for (e, n), value in zip(points, src.sample(points)):
        print(f"  E {e:.0f}, N {n:.0f}: {value[0]:.1f} m")
```

```output
Pixel row 55, col 106; centre at E 302895.0, N 3041035.0
Elevation there: 1042.4 m
  E 300500, N 3040500: 916.9 m
  E 302000, N 3041800: 1166.0 m
  E 303700, N 3041300: 1046.1 m
```

`src.sample()` reads values at a list of coordinates, which is how you would extract DEM heights at survey points or boreholes.

## Calculating with arrays and writing the result

Compute NDVI from the red and near-infrared bands and save it as a new GeoTIFF:

```python-desktop
with rasterio.open("data/demo_red.tif") as r, rasterio.open("data/demo_nir.tif") as n:
    red = r.read(1).astype("float32")
    nir = n.read(1).astype("float32")
    profile = r.profile

ndvi = (nir - red) / (nir + red)
print(f"NDVI range {ndvi.min():.2f} to {ndvi.max():.2f}")

profile.update(dtype="float32", nodata=-9999, compress="deflate")
with rasterio.open("ndvi.tif", "w", **profile) as dst:
    dst.write(ndvi, 1)
print("Saved ndvi.tif")
```

```output
NDVI range -0.86 to 0.98
Saved ndvi.tif
```

`profile.update(...)` copies the input's grid and CRS and changes only what differs. `**profile` passes every key as an argument to `rasterio.open`.

## Plotting a raster

```python-desktop
import matplotlib.pyplot as plt
from rasterio.plot import show

fig, ax = plt.subplots(figsize=(8, 4))
with rasterio.open("data/demo_dem.tif") as src:
    show(src, ax=ax, cmap="terrain", title="Demo DEM (m)")
plt.show()
```

`rasterio.plot.show` uses the transform, so the axes show real map coordinates (eastings and northings), not pixel numbers.

## Clipping a raster to a polygon

`rasterio.mask.mask` cuts a raster to a polygon, for example to get the DEM of one ward:

```python-desktop
import geopandas as gpd
from rasterio.mask import mask

wards = gpd.read_file("data/demo_wards.geojson").to_crs(32645)
ward5 = wards[wards["ward"] == 5]

with rasterio.open("data/demo_dem.tif") as src:
    clipped, clip_transform = mask(src, ward5.geometry, crop=True, nodata=-9999)
    meta = src.profile

clipped = np.ma.masked_equal(clipped[0], -9999)
print("Clipped shape:", clipped.shape)
print(f"Ward 5 elevation: min {clipped.min():.1f}, mean {clipped.mean():.1f}, max {clipped.max():.1f} m")
```

```output
Clipped shape: (42, 51)
Ward 5 elevation: min 948.3, mean 1191.0, max 1370.0 m
```

> **Remember:** The polygon must be in the **same CRS** as the raster. Reproject the vector with `.to_crs(src.crs)` first.

## Reprojecting a raster

```python-desktop
from rasterio.warp import calculate_default_transform, reproject, Resampling

with rasterio.open("data/demo_dem.tif") as src:
    dst_crs = "EPSG:4326"
    t, w, h = calculate_default_transform(src.crs, dst_crs, src.width, src.height, *src.bounds)
    out_profile = src.profile.copy()
    out_profile.update(crs=dst_crs, transform=t, width=w, height=h)
    with rasterio.open("dem_wgs84.tif", "w", **out_profile) as dst:
        reproject(source=rasterio.band(src, 1), destination=rasterio.band(dst, 1),
                  src_transform=src.transform, src_crs=src.crs,
                  dst_transform=t, dst_crs=dst_crs, resampling=Resampling.bilinear)

with rasterio.open("dem_wgs84.tif") as check:
    print(check.crs, check.width, "x", check.height, "| pixel size (degrees):", [round(v, 6) for v in check.res])
```

```output
EPSG:4326 155 x 75 | pixel size (degrees): [0.000297, 0.000297]
```

Use `Resampling.bilinear` (or `cubic`) for continuous data such as elevation, and `Resampling.nearest` for categories such as land-cover classes, so class codes are never averaged.

## Key points

- `with rasterio.open(path) as src:`; `src.read(1, masked=True)` gives a masked NumPy array.
- `src.profile`, `src.transform`, `src.crs`, `src.bounds`, `src.res` describe the grid.
- `src.index(x, y)` and `src.xy(row, col)` convert coordinates; `src.sample(points)` extracts values.
- Write with `rasterio.open(path, "w", **profile)` after `profile.update(...)`.
- `rasterio.mask.mask` clips; `rasterio.warp.reproject` reprojects (nearest for classes).
