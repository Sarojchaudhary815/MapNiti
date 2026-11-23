From a single DEM you can derive several **terrain products**. Each one answers a different engineering question:

| Product | Meaning | Used for |
|---|---|---|
| **Slope** | Steepness, in degrees or percent | Road gradients, landslide screening, building suitability |
| **Aspect** | The compass direction a slope faces | Solar exposure, snow melt, vegetation |
| **Hillshade** | Shaded relief, lit from one direction | Map backgrounds that make terrain readable |
| **Contours** | Lines of equal height | Engineering drawings and site plans |
| **Curvature** | Convex ridges versus concave hollows | Where water gathers; landslide source areas |

This chapter computes each of them from first principles with NumPy, so you understand what the GIS tools do.

## The test DEM

We use the same kind of synthetic DEM as in the previous chapter, on a 30 m grid:

```python
import numpy as np
import matplotlib.pyplot as plt

cell = 30.0
y, x = np.mgrid[0:90, 0:120] * cell
dem = (1400 + 260 * np.exp(-((x - 1100) ** 2 + (y - 1200) ** 2) / 4e5)
       - 110 * np.exp(-((x - 2600) ** 2) / 1.5e5) + 0.05 * y)
print("Ready:", dem.shape)
```

## Slope

Slope comes from how fast the height changes in the x (east) and y (north) directions. `np.gradient` estimates these rates of change at every cell:

```python
dz_drow, dz_dcol = np.gradient(dem, cell)     # change per metre along rows and along columns

# Rows increase SOUTHWARD in a north-up raster, so the northward change is minus dz/drow.
dz_dx = dz_dcol
dz_dy = -dz_drow

slope_deg = np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))
slope_pct = np.hypot(dz_dx, dz_dy) * 100

print(f"Mean slope {slope_deg.mean():.1f}°, max {slope_deg.max():.1f}°")
print(f"Max slope in percent: {slope_pct.max():.0f} %")
```

- The total rate of rise is √(dz/dx² + dz/dy²), computed with `np.hypot`.
- `arctan` of that rate gives the angle in radians; `np.degrees` converts it.
- 45° equals 100 %: percent slope is rise over run × 100.

## Slope classes

Engineers usually work with slope classes rather than exact values. The class limits below are an example; use those from the guideline you are following.

```python
limits = [5, 15, 30, 45]
names = ["0–5° flat", "5–15° gentle", "15–30° moderate", "30–45° steep", ">45° very steep"]
cls = np.digitize(slope_deg, limits)
cell_ha = cell * cell / 1e4

for k, name in enumerate(names):
    share = np.mean(cls == k) * 100
    print(f"{name:<18} {np.sum(cls == k) * cell_ha:7.1f} ha  {share:5.1f} %")
```

## Aspect

Aspect is the direction of steepest **descent**, measured clockwise from north (0° = north-facing, 90° = east-facing):

```python
aspect = (np.degrees(np.arctan2(-dz_dx, -dz_dy)) + 360) % 360
aspect[slope_deg < 1] = np.nan          # flat ground has no meaningful aspect

sectors = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
idx = (((aspect + 22.5) % 360) // 45)
for k, s in enumerate(sectors):
    print(f"{s:<3} {np.nansum(idx == k) * cell_ha:6.1f} ha")
```

- `arctan2(-dz_dx, -dz_dy)` points *downhill*, because downhill is the negative of the gradient.
- Adding 22.5° before dividing by 45 centres each of the 8 sectors on its compass direction.

## Hillshade

A hillshade simulates sunlight from a direction (azimuth) and height (altitude). The standard is light from the north-west (315°) at 45° above the horizon:

```python
def hillshade(slope_deg, aspect_deg, azimuth=315, altitude=45):
    zen = np.radians(90 - altitude)
    az = np.radians(azimuth)
    s = np.radians(slope_deg)
    a = np.radians(np.nan_to_num(aspect_deg))
    shade = np.cos(zen) * np.cos(s) + np.sin(zen) * np.sin(s) * np.cos(az - a)
    return np.clip(shade, 0, 1) * 255

hs = hillshade(slope_deg, aspect)

fig, ax = plt.subplots(1, 2, figsize=(11, 4))
ax[0].imshow(hs, cmap="gray")
ax[0].set_title("Hillshade")
ax[1].imshow(hs, cmap="gray")
ax[1].imshow(dem, cmap="terrain", alpha=0.5)
ax[1].set_title("Hillshade + elevation colours")
```

Laying semi-transparent elevation colours over a hillshade, as on the right, is the classic way to make terrain easy to read on a map.

## Contours

`plt.contour` traces lines of equal height through the grid. Major contours are drawn thicker and labelled:

```python
fig, ax = plt.subplots(figsize=(9, 6))
ax.imshow(hs, cmap="gray", extent=(0, x.max(), y.max(), 0))
minor = ax.contour(x, y, dem, levels=np.arange(1400, 1700, 10), colors="#78350f", linewidths=0.4)
major = ax.contour(x, y, dem, levels=np.arange(1400, 1700, 50), colors="#78350f", linewidths=1.2)
ax.clabel(major, fmt="%d m", fontsize=8)
ax.set_title("10 m contours, labelled every 50 m")
ax.set_aspect("equal")
```

Contour lines close together mean steep ground; widely spaced lines mean gentle ground. Compare this with the slope map.

## Curvature

Curvature shows whether the surface bends upward or downward. Concave cells (hollows) collect water; convex cells (ridges) shed it:

```python
d2z_dx2 = np.gradient(np.gradient(dem, cell, axis=1), cell, axis=1)
d2z_dy2 = np.gradient(np.gradient(dem, cell, axis=0), cell, axis=0)
curv = -(d2z_dx2 + d2z_dy2) * 100          # sign chosen so ridges are positive

v = np.percentile(np.abs(curv), 98)
plt.figure(figsize=(7, 4))
plt.imshow(curv, cmap="RdBu", vmin=-v, vmax=v)
plt.colorbar(label="Curvature (+ ridge, − hollow)")
plt.title("Curvature")
```

## Slope and aspect with GDAL (desktop)

In practice you would use GDAL's `gdaldem`, which implements the standard (Horn) method and handles the georeferencing for you. This works on your computer with the practice DEM:

```python-desktop
from osgeo import gdal
import numpy as np
gdal.UseExceptions()

gdal.DEMProcessing("slope.tif", "data/demo_dem.tif", "slope")                 # degrees
gdal.DEMProcessing("aspect.tif", "data/demo_dem.tif", "aspect")
gdal.DEMProcessing("hillshade.tif", "data/demo_dem.tif", "hillshade", azimuth=315, altitude=45)

slope = gdal.Open("slope.tif").ReadAsArray()
valid = slope[slope >= 0]                 # edge cells are NoData (-9999)
print(f"Mean slope {valid.mean():.1f}°, max {valid.max():.1f}°")
for lo, hi in [(0, 5), (5, 15), (15, 30), (30, 90)]:
    print(f"  {lo:>2}–{hi:<2}°: {np.mean((valid >= lo) & (valid < hi)) * 100:5.1f} % of the area")
```

```output
Mean slope 9.7°, max 26.9°
   0–5 °:  26.4 % of the area
   5–15°:  56.9 % of the area
  15–30°:  16.7 % of the area
  30–90°:   0.0 % of the area
```

The same in a terminal is one line: `gdaldem slope data/demo_dem.tif slope.tif`.

> **Warning:** Slope must be computed in a projected CRS, where x, y and z are all in metres. For a DEM in degrees (EPSG:4326), reproject it to UTM first, or the slopes will be completely wrong.

## Key points

- Slope = arctan(√(dz/dx² + dz/dy²)); rows run southward, so mind the sign of dz/dy.
- Aspect is the downhill direction clockwise from north; flat cells have none.
- Hillshade combines slope and aspect with a light direction (315°, 45°).
- `plt.contour` for contours; second derivatives give curvature.
- `gdaldem` / `gdal.DEMProcessing` for production work, always in a projected CRS.
