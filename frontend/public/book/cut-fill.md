Earthwork is often one of the biggest costs on a site, road or embankment. **Cut and fill analysis** compares the existing ground with the design surface and tells you how much soil must be dug out (cut) and how much must be brought in (fill). With DEMs this is done cell by cell, which is exactly what Civil 3D and QGIS volume tools do internally.

## The grid method

For every cell of a grid:

- difference **d = design level − existing level**
- if d < 0 the ground must be lowered: **cut**
- if d > 0 the ground must be raised: **fill**
- volume of the cell = |d| × cell area

Adding up all cut cells and all fill cells gives the two volumes. The finer the grid, the more accurate the result, as long as the survey behind it is accurate.

## The existing ground

A 60 m × 40 m building site, surveyed on a 1 m grid (for example from a drone or total-station survey). The ground slopes gently with some undulation:

```python
import numpy as np
import matplotlib.pyplot as plt

cell = 1.0                                     # m
y, x = np.mgrid[0:40, 0:60] * cell             # 40 rows × 60 columns
existing = 1302 + 0.08 * x - 0.05 * y + 0.6 * np.sin(x / 7) * np.cos(y / 9)

print(f"Site: {x.max() + cell:.0f} m × {y.max() + cell:.0f} m, {existing.size} cells of {cell * cell} m²")
print(f"Existing levels {existing.min():.2f} to {existing.max():.2f} m")
```

## Volumes for a flat platform

A function that returns the cut and fill volumes for a flat formation level:

```python
def cut_fill(design, ground, cell_area):
    d = design - ground
    cut = -d[d < 0].sum() * cell_area
    fill = d[d > 0].sum() * cell_area
    return cut, fill

for level in [1302.5, 1303.0, 1303.5, 1304.0]:
    c, f = cut_fill(level, existing, cell * cell)
    print(f"Level {level:.1f} m: cut {c:7.1f} m³   fill {f:7.1f} m³   net {c - f:+8.1f} m³")
```

- `d[d < 0]` keeps only the cells that need cutting; their (negative) sum times the cell area is the cut volume.
- *net* positive means surplus soil to remove from site; negative means soil must be imported.

## Finding the balanced level

The cheapest platform level is usually where cut equals fill, so no soil is carted on or off site. Soil does not keep its volume when it is moved: it **bulks** when dug and **shrinks** when compacted. If 1 m³ of cut makes only 0.9 m³ of compacted fill, the balance condition is 0.9 × cut = fill. A simple **bisection** search finds the level:

```python
shrink = 0.90          # 1 m³ of cut gives 0.9 m³ of compacted fill (use your geotechnical value)

lo, hi = existing.min(), existing.max()
for _ in range(50):
    mid = (lo + hi) / 2
    c, f = cut_fill(mid, existing, cell * cell)
    if c * shrink > f:      # too much cut: raise the level
        lo = mid
    else:                   # too much fill: lower the level
        hi = mid

balanced = mid
c, f = cut_fill(balanced, existing, cell * cell)
print(f"Balanced formation level: {balanced:.3f} m")
print(f"Cut {c:.0f} m³ × {shrink} = {c * shrink:.0f} m³ compacted ≈ fill {f:.0f} m³")
```

Each pass halves the search range, so 50 passes give a level accurate to far less than a millimetre.

## Cut and fill map

A map shows the contractor **where** to cut and where to fill. The black line is where design meets existing ground (no cut, no fill):

```python
d = balanced - existing
v = np.abs(d).max()

fig, ax = plt.subplots(figsize=(8, 5))
im = ax.imshow(d, cmap="RdBu", vmin=-v, vmax=v, extent=(0, 60, 40, 0))
fig.colorbar(im, ax=ax, label="design − existing (m):  red = cut,  blue = fill")
cs = ax.contour(x + 0.5, y + 0.5, d, levels=[0], colors="black", linewidths=1.5)
ax.set_title(f"Cut / fill for a platform at {balanced:.2f} m")
ax.set_xlabel("m"); ax.set_ylabel("m")
```

## A sloping design surface

Platforms are often given a small fall for drainage. Here the design falls 1 % from west to east, from the balanced level at the western edge:

```python
design = balanced + 0.30 - 0.01 * x            # 1 % fall to the east
c, f = cut_fill(design, existing, cell * cell)
print(f"Sloping platform: cut {c:.0f} m³, fill {f:.0f} m³, net {c * shrink - f:+.0f} m³ after shrinkage")
```

Any design surface works the same way, as long as it is an array on the **same grid** as the existing ground.

## How accurate is the volume?

The formula is exact; the **data** is not. A level error of just 5 cm over the whole site changes the volume noticeably:

```python
area = existing.size * cell * cell
for err in [0.02, 0.05, 0.10]:
    print(f"A {err * 100:.0f} cm systematic level error changes the volume by about {err * area:,.0f} m³")
```

- Use a survey-grade DTM with 0.5–1 m cells for building sites. A 30 m global DEM is **not** suitable for earthwork quantities.
- Check the result independently, for example with cross-sections and the end-area method along a road.
- Remember stripping of topsoil and the bulking and shrinkage factors from the geotechnical report.

## Two real surfaces (desktop)

With real data you would compare the surveyed DTM with a design surface exported as a raster on the same grid. The practice DEM has 30 m cells, far too coarse for real quantities, but it shows the mechanics: here we level a 300 m × 600 m area at its median height and compute the volumes.

```python-desktop
import numpy as np
import rasterio

with rasterio.open("data/demo_dem.tif") as src:
    ground = src.read(1).astype("float64")
    t = src.transform
    cell_area = abs(t.a * t.e)

area = (slice(30, 40), slice(20, 40))            # rows 30–39, columns 20–39: 10 × 20 cells
level = float(np.median(ground[area]))

design = ground.copy()
design[area] = level

d = design - ground
cut = -d[d < 0].sum() * cell_area
fill = d[d > 0].sum() * cell_area
print(f"Cell area {cell_area:.0f} m², platform of {ground[area].size} cells at {level:.1f} m")
print(f"Cut {cut:,.0f} m³ | Fill {fill:,.0f} m³ | Net {cut - fill:+,.0f} m³")
```

```output
Cell area 900 m², platform of 200 cells at 1008.8 m
Cut 782,712 m³ | Fill 1,048,165 m³ | Net -265,453 m³
```

> **Remember:** Both rasters must have exactly the same grid: same CRS, cell size and alignment. If they do not, resample one onto the other first, for example with `gdalwarp -tr 1 1 -te <xmin ymin xmax ymax>`.

## Key points

- Grid method: d = design − existing; cut = Σ|d < 0| × cell area, fill = Σ(d > 0) × cell area.
- Find the balanced level by bisection, including shrinkage/bulking factors.
- Map d with a red–blue colour scale and the zero contour.
- Accuracy depends on the survey: use 0.5–1 m DTMs and check with cross-sections.
