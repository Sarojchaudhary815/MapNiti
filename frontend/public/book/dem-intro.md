A **Digital Elevation Model** (DEM) is a raster where every cell holds a height. DEMs are behind almost every terrain-related engineering task: catchments and drainage, road profiles, slope stability screening, earthwork volumes, flood mapping and line-of-sight. This chapter explains the kinds of DEMs, where to get them for Nepal, how accurate they are, and how to explore one with Python.

## DEM, DSM and DTM

| Term | Surface it shows | Typical source |
|---|---|---|
| **DSM** (Digital Surface Model) | The top of everything: roofs, tree canopy | Radar and optical satellites, drone photogrammetry |
| **DTM** (Digital Terrain Model) | Bare ground, with buildings and trees removed | LiDAR ground points, surveyed spot heights and contours |
| **DEM** | General word for either; often used for bare-earth models | — |

For flood or drainage work the difference matters a lot: in a forested valley a DSM can be 20–30 m above the real ground.

## Free DEMs for Nepal

| DEM | Cell size | Notes |
|---|---|---|
| **Copernicus GLO-30** | 30 m | Usually the most accurate free global DEM; a surface model |
| **NASADEM / SRTM** | 30 m | Radar from the year 2000, voids filled |
| **ALOS AW3D30** | 30 m | From optical stereo images; good in steep terrain |
| **MERIT DEM / MERIT Hydro** | 90 m | Errors and trees removed; built for hydrology |
| **Survey Department topographic maps** | 20 m / 40 m contours | Official base; digitise and interpolate |
| **Drone or LiDAR survey** | 5 cm – 1 m | Needed for detailed design and quantities |

MapNiti's **Data Download** tool (login) exports these DEMs for your own area of interest; OpenTopography is another source.

## Which height? Ellipsoid versus mean sea level

GNSS receivers measure heights above the **WGS84 ellipsoid**, a smooth mathematical shape. Maps and DEMs give heights above **mean sea level**, through a **geoid** model (EGM96 or EGM2008). The difference between them, called the *geoid undulation*, is roughly −25 to −40 m across Nepal.

> **Warning:** Never mix ellipsoidal GNSS heights with DEM or benchmark heights without converting. A 30 m vertical error ruins any drainage or earthwork design.

## How accurate is a 30 m DEM?

Global 30 m DEMs typically have vertical errors of a few metres on open, gentle ground, and much larger errors on steep slopes, in narrow valleys and under forest. They are fine for planning, catchment delineation and screening studies. For detailed design and quantities you need a ground survey or LiDAR.

## Exploring a DEM

To keep this chapter runnable in the browser, we build a DEM-like surface with NumPy: a hill, a valley and a gentle regional slope, on a 30 m grid. (On your computer you would read a real file with Rasterio: `src.read(1, masked=True)`.)

```python
import numpy as np
import matplotlib.pyplot as plt

cell = 30.0
ny, nx = 90, 120
y, x = np.mgrid[0:ny, 0:nx] * cell

dem = (1400
       + 260 * np.exp(-((x - 1100) ** 2 + (y - 1200) ** 2) / 4e5)    # a hill
       - 110 * np.exp(-((x - 2600) ** 2) / 1.5e5)                     # a valley running north–south
       + 0.05 * y)                                                     # regional slope
print("DEM shape:", dem.shape, "| area:", nx * cell / 1000, "km x", ny * cell / 1000, "km")
```

## Summary statistics

```python
print(f"Lowest point:  {dem.min():.1f} m")
print(f"Highest point: {dem.max():.1f} m")
print(f"Mean height:   {dem.mean():.1f} m")
print(f"Relief:        {np.ptp(dem):.1f} m")

for p in (10, 50, 90):
    print(f"{p}% of the area lies below {np.percentile(dem, p):.0f} m")
```

`np.ptp` ("peak to peak") is max − min, the total **relief** of the area.

## Where is the highest point?

```python
r, c = np.unravel_index(np.argmax(dem), dem.shape)
print(f"Highest cell: row {r}, column {c} → about {c * cell:.0f} m east, {r * cell:.0f} m south of the top-left corner")
```

`np.argmax` gives the position in the flattened array; `np.unravel_index` turns it back into (row, column).

## Visualising the DEM

```python
fig, ax = plt.subplots(1, 2, figsize=(11, 4))

im = ax[0].imshow(dem, cmap="terrain")
fig.colorbar(im, ax=ax[0], label="Elevation (m)")
ax[0].set_title("DEM")

ax[1].hist(dem.ravel(), bins=40, color="#78716c", edgecolor="white")
ax[1].set_xlabel("Elevation (m)")
ax[1].set_ylabel("Number of cells")
ax[1].set_title("Elevation histogram")
fig.tight_layout()
```

The histogram is the DEM's *hypsometry*: how much of the area lies at each height.

## Elevation zones

Classify the DEM into height bands and measure their area, for example to see how much of a catchment lies above the snow line or in a particular climate zone:

```python
bands = [1400, 1450, 1500, 1550, 1600]
zone = np.digitize(dem, bands)
cell_km2 = cell * cell / 1e6

for z in np.unique(zone):
    lo = bands[z - 1] if z > 0 else dem.min()
    hi = bands[z] if z < len(bands) else dem.max()
    print(f"{lo:6.0f}–{hi:6.0f} m: {np.sum(zone == z) * cell_km2:6.2f} km²")
```

## An elevation profile

A profile shows the terrain along a line, such as a proposed road or pipeline. Here we take the profile along row 40, west to east:

```python
row = 40
distance = np.arange(nx) * cell
profile = dem[row, :]

plt.figure(figsize=(9, 3.5))
plt.fill_between(distance, profile, profile.min() - 20, color="#a8a29e")
plt.plot(distance, profile, color="#44403c")
plt.xlabel("Distance along the line (m)")
plt.ylabel("Elevation (m)")
plt.title(f"Elevation profile along row {row}")
plt.grid(alpha=0.3)

grad = np.diff(profile) / cell * 100
print(f"Steepest rise {grad.max():.1f} %, steepest fall {grad.min():.1f} %")
```

`np.diff` gives the change between neighbouring cells; dividing by the cell size and multiplying by 100 gives the gradient in percent.

## Key points

- DSM includes trees and buildings; DTM is bare ground.
- Copernicus 30 m for general work, MERIT for hydrology, survey or LiDAR for design.
- Keep track of the vertical datum: ellipsoid (GNSS) versus geoid (mean sea level).
- A DEM is an array: `min`, `max`, `percentile`, `argmax`, `digitize` and `diff` answer most first questions.
