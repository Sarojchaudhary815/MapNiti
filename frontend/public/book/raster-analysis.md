Once a raster is a NumPy array, analysis is maths on arrays: band ratios such as NDVI, thresholds, reclassification, and summaries inside zones. This chapter does each of these first with NumPy (runnable here, on arrays we build in the browser), then shows the same workflow on real GeoTIFF files with Rasterio (desktop).

## Rasters are arrays

A single-band raster is a 2-D grid of numbers. Here we build a small synthetic "satellite scene" with forest on the left, a town in the middle and a river on the right:

```python
import numpy as np
import matplotlib.pyplot as plt

rng = np.random.default_rng(7)
rows, cols, pixel = 60, 90, 50.0                       # 50 m pixels
yy, xx = np.mgrid[0:rows, 0:cols]

red = np.where(xx < 35, 0.04, np.where(xx < 65, 0.16, 0.05)) + rng.normal(0, 0.01, (rows, cols))
nir = np.where(xx < 35, 0.40, np.where(xx < 65, 0.22, 0.03)) + rng.normal(0, 0.01, (rows, cols))
red, nir = np.clip(red, 0.005, None), np.clip(nir, 0.005, None)     # reflectance can't be negative
print("Shape:", red.shape, "| pixel area:", pixel * pixel, "m²")
```

- `np.mgrid` creates row and column index grids, handy for building test rasters.
- `np.where(condition, a, b)` picks `a` where the condition is true and `b` elsewhere, pixel by pixel.
- `np.clip` keeps the simulated reflectance above zero, as real reflectance always is. Without it, the random noise could make NDVI fall outside its valid range of −1 to +1.
- Healthy vegetation reflects strongly in near-infrared (NIR) and absorbs red light; water absorbs NIR.

## Band maths: NDVI

The Normalised Difference Vegetation Index is (NIR − Red) / (NIR + Red). With arrays it is one line, applied to every pixel at once:

```python
ndvi = (nir - red) / (nir + red)
print(f"NDVI from {ndvi.min():.2f} to {ndvi.max():.2f}, mean {ndvi.mean():.2f}")

fig, ax = plt.subplots(figsize=(7, 4))
im = ax.imshow(ndvi, cmap="RdYlGn", vmin=-0.6, vmax=0.9)
fig.colorbar(im, ax=ax, label="NDVI")
ax.set_title("NDVI")
```

Other indices work the same way. NDWI uses green and NIR for water, and NDBI uses SWIR and NIR for built-up areas.

## Thresholds and masks

A comparison on an array gives a **mask**: True where the condition holds. Counting True pixels and multiplying by the pixel area gives an area:

```python
vegetation = ndvi > 0.4
water = ndvi < 0
pixel_ha = pixel * pixel / 1e4

print(f"Vegetation: {vegetation.sum() * pixel_ha:.1f} ha ({vegetation.mean():.0%} of the scene)")
print(f"Water:      {water.sum() * pixel_ha:.1f} ha")
```

`mask.mean()` is the share of True pixels, because True counts as 1 and False as 0.

## Reclassification

Reclassification turns continuous values into classes. `np.digitize` assigns each pixel to a bin:

```python
breaks = [0.0, 0.2, 0.4]                         # class edges
classes = np.digitize(ndvi, breaks)               # 0: <0, 1: 0–0.2, 2: 0.2–0.4, 3: >0.4
names = ["Water", "Bare / built", "Sparse vegetation", "Dense vegetation"]

for code, name in enumerate(names):
    print(f"{code}  {name:<18} {np.sum(classes == code) * pixel_ha:6.1f} ha")

plt.figure(figsize=(7, 4))
plt.imshow(classes, cmap=plt.matplotlib.colors.ListedColormap(["#2563eb", "#d6d3d1", "#bef264", "#15803d"]))
plt.title("NDVI classes")
```

## Zonal statistics

**Zonal statistics** summarise raster values inside zones (wards, catchments, parcels). With a zone raster on the same grid, it is a loop over the zone codes:

```python
zones = np.where(yy < rows // 2, 1, 2) + np.where(xx >= cols // 2, 2, 0)   # four quadrant "wards" 1–4

for z in np.unique(zones):
    values = ndvi[zones == z]
    print(f"Zone {z}: mean NDVI {values.mean():.2f}, vegetation {np.sum(values > 0.4) * pixel_ha:5.1f} ha")
```

## Change detection

Comparing two dates pixel by pixel shows what changed. Here the town grows into the forest between the two dates:

```python
ndvi_after = ndvi.copy()
ndvi_after[:, 28:35] = 0.18 + rng.normal(0, 0.02, (rows, 7))       # new buildings at the forest edge

change = ndvi_after - ndvi
lost = change < -0.2
print(f"Vegetation lost: {lost.sum() * pixel_ha:.1f} ha")

fig, ax = plt.subplots(1, 2, figsize=(10, 3.5))
ax[0].imshow(change, cmap="RdBu", vmin=-0.4, vmax=0.4); ax[0].set_title("NDVI change")
ax[1].imshow(lost, cmap="Reds"); ax[1].set_title("Vegetation loss")
```

## The same on real files with Rasterio

On your computer, the workflow on real GeoTIFFs is: read bands → compute → write with the same profile → summarise per polygon. These cells use the practice files `demo_red.tif`, `demo_nir.tif` and `demo_wards.geojson`.

```python-desktop
import numpy as np
import rasterio

with rasterio.open("data/demo_red.tif") as r, rasterio.open("data/demo_nir.tif") as n:
    red = r.read(1).astype("float32")
    nir = n.read(1).astype("float32")
    profile = r.profile

ndvi = np.where((nir + red) != 0, (nir - red) / (nir + red), -9999).astype("float32")
profile.update(dtype="float32", nodata=-9999, compress="deflate")
with rasterio.open("ndvi.tif", "w", **profile) as dst:
    dst.write(ndvi, 1)

pixel_ha = abs(profile["transform"].a * profile["transform"].e) / 1e4
print(f"Pixel = {pixel_ha} ha; vegetation (NDVI > 0.4): {np.sum(ndvi > 0.4) * pixel_ha:.1f} ha")
```

```output
Pixel = 0.25 ha; vegetation (NDVI > 0.4): 525.2 ha
```

Zonal statistics for real polygons: rasterise the wards onto the raster grid, then summarise per ward.

```python-desktop
import geopandas as gpd
from rasterio.features import rasterize

wards = gpd.read_file("data/demo_wards.geojson").to_crs(profile["crs"])
ward_grid = rasterize(((geom, w) for geom, w in zip(wards.geometry, wards["ward"])),
                      out_shape=ndvi.shape, transform=profile["transform"], fill=0, dtype="int32")

for w in wards["ward"]:
    vals = ndvi[(ward_grid == w) & (ndvi != -9999)]
    print(f"Ward {w}: {vals.size:4d} pixels, mean NDVI {vals.mean():.2f}, vegetation {np.sum(vals > 0.4) * pixel_ha:5.1f} ha")
```

```output
Ward 1:  720 pixels, mean NDVI 0.80, vegetation 174.0 ha
Ward 2:  720 pixels, mean NDVI 0.14, vegetation   0.0 ha
Ward 3:  576 pixels, mean NDVI -0.25, vegetation   0.2 ha
Ward 4:  720 pixels, mean NDVI 0.80, vegetation 174.0 ha
Ward 5:  720 pixels, mean NDVI 0.14, vegetation   0.0 ha
Ward 6:  576 pixels, mean NDVI -0.26, vegetation   0.0 ha
```

For many polygons and statistics, the `rasterstats` package does this in one call: `zonal_stats(wards, "ndvi.tif", stats=["mean", "max"])`.

## Key points

- Rasters are arrays: band maths like NDVI is one line of NumPy.
- Comparisons make masks; `mask.sum() × pixel area` gives areas.
- `np.digitize` / `np.where` reclassify; `zones == z` masks give zonal statistics.
- Subtracting two dates detects change.
- On real files: Rasterio to read and write, `rasterize` or `rasterstats` for zonal statistics.
