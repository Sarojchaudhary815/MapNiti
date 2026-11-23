Python lets you create your own **types** of objects with a **class**. A class bundles data (called **attributes**) together with the functions that work on that data (called **methods**). You may not write many classes yourself at first, but every library you use is built from them: a GeoPandas `GeoDataFrame`, a Shapely `Polygon` and a QGIS `QgsVectorLayer` are all classes. Understanding classes makes their documentation much easier to read.

## A first class

```python
class Station:
    def __init__(self, name, elevation_m):
        self.name = name
        self.elevation_m = elevation_m

ktm = Station("Kathmandu Airport", 1337)
jum = Station("Jumla", 2300)

print(ktm.name, ktm.elevation_m)
print(jum.name, jum.elevation_m)
```

- `class Station:` defines a new type called `Station`.
- `__init__` is a special method that runs when a new object is created. It sets up the object's attributes.
- `self` means *"this particular object"*. `self.name = name` stores the name inside the object.
- `Station("Jumla", 2300)` creates an **object** (also called an *instance*) of the class.

## Methods: functions that belong to the object

```python
import math

class SurveyPoint:
    def __init__(self, name, easting, northing, rl=None):
        self.name = name
        self.easting = easting
        self.northing = northing
        self.rl = rl

    def distance_to(self, other):
        return math.hypot(other.easting - self.easting, other.northing - self.northing)

    def bearing_to(self, other):
        angle = math.degrees(math.atan2(other.easting - self.easting, other.northing - self.northing))
        return angle % 360

a = SurveyPoint("BM1", 334500.000, 3066800.000, 1301.250)
b = SurveyPoint("TP1", 334548.120, 3066821.450, 1303.804)

print(f"{a.name} → {b.name}: {a.distance_to(b):.3f} m at {a.bearing_to(b):.2f}°")
```

A method is called with a dot: `a.distance_to(b)`. Python passes `a` in as `self` automatically, so you only give the other point.

## A readable printout: __repr__

By default, printing an object shows something unhelpful like `<SurveyPoint object at 0x…>`. The `__repr__` method controls what is shown:

```python
class SurveyPoint:
    def __init__(self, name, easting, northing):
        self.name, self.easting, self.northing = name, easting, northing

    def __repr__(self):
        return f"SurveyPoint({self.name!r}, E={self.easting:.3f}, N={self.northing:.3f})"

p = SurveyPoint("BM1", 334500, 3066800)
print(p)
points = [p, SurveyPoint("TP1", 334548.12, 3066821.45)]
print(points)
```

## Properties: values computed on demand

A **property** looks like an attribute but is calculated each time you read it. GeoPandas uses this a lot: `gdf.area` is a property.

```python
class Parcel:
    ROPANI_M2 = 508.72                       # a class attribute, shared by all parcels

    def __init__(self, parcel_id, corners):
        self.parcel_id = parcel_id
        self.corners = corners

    @property
    def area(self):
        pts = self.corners
        s = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
                for i in range(len(pts)))
        return abs(s) / 2

    @property
    def ropani(self):
        return self.area / self.ROPANI_M2

p = Parcel("P-101", [(0, 0), (25, 0), (25, 20), (0, 20)])
print(f"{p.parcel_id}: {p.area:.1f} m² = {p.ropani:.3f} ropani")

p.corners[1] = (30, 0)                       # move a corner...
print(f"After edit: {p.area:.1f} m²")       # ...and the area updates by itself
```

## Inheritance: building on another class

A class can **inherit** from another, reusing its code and adding more. Here a benchmark is a survey point with an extra attribute:

```python
class Point:
    def __init__(self, name, e, n):
        self.name, self.e, self.n = name, e, n

    def describe(self):
        return f"{self.name} at E {self.e}, N {self.n}"

class Benchmark(Point):
    def __init__(self, name, e, n, rl, source):
        super().__init__(name, e, n)      # let Point set name, e, n
        self.rl = rl
        self.source = source

    def describe(self):
        return super().describe() + f", RL {self.rl} m ({self.source})"

bm = Benchmark("BM-12", 334500, 3066800, 1301.250, "levelled from GPS-07")
print(bm.describe())
print(isinstance(bm, Point))
```

`super()` calls the parent class. `isinstance(bm, Point)` is `True` because a benchmark *is a* point.

## Seeing classes in libraries

Now look at a library object with the same eyes. A Shapely polygon is an object with attributes and methods:

```python
from shapely.geometry import Polygon

plot = Polygon([(0, 0), (25, 0), (25, 20), (0, 20)])

print(type(plot))
print("area:", plot.area)                  # a property
print("length:", plot.length)              # perimeter, also a property
print("centroid:", plot.centroid)          # returns another object, a Point
print("buffered area:", round(plot.buffer(2).area, 1))   # a method that returns a new polygon
```

Everything you learned here applies: `Polygon(...)` creates an object, `.area` is a property and `.buffer(2)` is a method.

## Key points

- `class Name:` defines a type; `__init__` sets up each new object; `self` is the object itself.
- Methods are functions inside the class, called with `obj.method()`.
- `__repr__` controls printing; `@property` makes computed attributes.
- Inheritance (`class Benchmark(Point)`) reuses and extends another class.
- Library objects like `Polygon` and `GeoDataFrame` work exactly the same way.
