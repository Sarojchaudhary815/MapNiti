Every GIS feature has a **geometry**: a point, a line or a polygon. **Shapely** is the Python library for creating and analysing geometries: area, length, distance, buffer, intersection and much more. GeoPandas uses Shapely for every geometry in its tables, so learning Shapely first makes GeoPandas easy.

> **Note:** Shapely works on flat x/y coordinates and knows nothing about map projections. Give it coordinates in **metres** (a projected system such as UTM) when you want areas and distances in m² and m. The next chapter covers projections.

## The three basic geometries

```python
from shapely.geometry import Point, LineString, Polygon

well = Point(334520, 3066810)
pipe = LineString([(334500, 3066800), (334560, 3066830), (334640, 3066835)])
plot = Polygon([(334480, 3066780), (334540, 3066780), (334540, 3066830), (334480, 3066830)])

print(well)
print(pipe)
print(plot)
```

When you print a geometry you see its **WKT** (Well-Known Text), a standard text format that QGIS, PostGIS and many other tools understand.

## Measuring

```python
print(f"Pipe length: {pipe.length:.2f} m")
print(f"Plot area:   {plot.area:.1f} m²")
print(f"Plot perimeter: {plot.length:.1f} m")
print(f"Plot centroid:  {plot.centroid}")
print("Bounding box (minx, miny, maxx, maxy):", plot.bounds)
```

For a polygon, `.length` is the perimeter. `.bounds` is the smallest rectangle around the shape, often used to set a map extent.

## Distances between geometries

```python
print(f"Well to pipe: {well.distance(pipe):.2f} m")
print(f"Well to plot: {well.distance(plot):.2f} m (0 means inside or touching)")
```

`distance` always returns the **shortest** distance between two geometries.

## Spatial relationships

Shapely answers yes/no questions about how two geometries relate. These are the same tests used by *Select by Location* in QGIS:

| Method | True when… |
|---|---|
| `a.contains(b)` | b is completely inside a |
| `a.within(b)` | a is completely inside b |
| `a.intersects(b)` | they share at least one point |
| `a.touches(b)` | they touch at the boundary only |
| `a.crosses(b)` | a line crosses through the other geometry |
| `a.disjoint(b)` | they share no point at all |

```python
print("Plot contains well?", plot.contains(well))
print("Well within plot?", well.within(plot))
print("Pipe intersects plot?", pipe.intersects(plot))
print("Pipe crosses plot?", pipe.crosses(plot))
```

## Buffers

A **buffer** is the area within a given distance of a geometry. It is how you make setback zones, protection zones and service areas:

```python
setback = pipe.buffer(10)            # 10 m each side of the pipe
print(f"Area within 10 m of the pipe: {setback.area:.0f} m²")
print("Is the well inside the setback?", setback.contains(well))

flat_end = pipe.buffer(10, cap_style="flat")
print(f"Same with flat ends: {flat_end.area:.0f} m²")
```

By default the buffer has round ends; `cap_style="flat"` cuts them square, which suits corridors along a road or canal.

## Overlay operations

These create **new** geometries from two existing ones:

```python
from shapely.geometry import Polygon

parcel = Polygon([(0, 0), (60, 0), (60, 40), (0, 40)])
flood_zone = Polygon([(40, -10), (90, -10), (90, 60), (40, 60)])

wet = parcel.intersection(flood_zone)        # part of the parcel in the flood zone
dry = parcel.difference(flood_zone)          # part outside it
both = parcel.union(flood_zone)              # everything together

print(f"Parcel {parcel.area:.0f} m², flooded {wet.area:.0f} m² ({wet.area / parcel.area:.0%}), dry {dry.area:.0f} m²")
print(f"Union area: {both.area:.0f} m²")
```

## Drawing geometries

Shapely does not draw by itself, but its coordinates go straight into matplotlib:

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(6, 4))
for geom, color, label in [(parcel, "#94a3b8", "Parcel"), (flood_zone, "#93c5fd", "Flood zone"), (wet, "#ef4444", "Flooded part")]:
    x, y = geom.exterior.xy
    ax.fill(x, y, alpha=0.55, color=color, label=label)
    ax.plot(x, y, color="black", linewidth=0.8)
ax.set_aspect("equal")
ax.legend(loc="upper right")
ax.set_title("Intersection of a parcel and a flood zone")
```

`geom.exterior.xy` gives the x and y coordinates of a polygon's outer ring. `set_aspect("equal")` keeps 1 m in x the same length as 1 m in y.

## Reading and writing WKT

```python
from shapely import wkt

text = "POLYGON ((0 0, 25 0, 25 20, 0 20, 0 0))"
shape = wkt.loads(text)            # text → geometry
print(shape.area)
print(shape.buffer(1).wkt[:80], "...")   # geometry → text
```

## Validity

A polygon whose edges cross itself (a "bow-tie") is **invalid**. Invalid geometries give wrong areas and make overlays fail, so check and repair them:

```python
from shapely.validation import explain_validity, make_valid

bowtie = Polygon([(0, 0), (10, 10), (10, 0), (0, 10)])
print("Valid?", bowtie.is_valid, "-", explain_validity(bowtie))
print("Area reported:", bowtie.area, "← wrong!")

fixed = make_valid(bowtie)
print("Fixed:", fixed.geom_type, "area", fixed.area)
```

Digitised parcels and data exported from CAD often contain such errors. Check `is_valid` before analysis.

## Key points

- `Point`, `LineString`, `Polygon` from `shapely.geometry`; use projected (metre) coordinates.
- `.area`, `.length`, `.centroid`, `.bounds`, `.distance()` measure.
- `contains`, `within`, `intersects`, `touches` test relationships.
- `buffer`, `intersection`, `difference`, `union` build new geometries.
- Check `is_valid` and repair with `make_valid`.
