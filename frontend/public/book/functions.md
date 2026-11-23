When you find yourself copying the same lines of code again and again, it is time to write a **function**. A function is a named, reusable piece of code: you give it inputs, it does its job and gives back a result. Every library you will use (pandas, GeoPandas, GDAL) is simply a large collection of functions.

## Defining and calling a function

```python
def ropani_to_m2(ropani):
    return ropani * 508.72

print(ropani_to_m2(1))
print(ropani_to_m2(2.5))
area = ropani_to_m2(4)
print(f"4 ropani = {area:.1f} m²")
```

- `def` starts a function definition, followed by its **name** and its **parameters** in brackets.
- The indented block is the function's body.
- `return` sends a value back to whoever called the function.
- Defining the function does nothing by itself; it runs only when you **call** it: `ropani_to_m2(2.5)`.

## Several parameters

```python
import math

def distance(e1, n1, e2, n2):
    """Horizontal distance between two points in a projected CRS (metres)."""
    return math.hypot(e2 - e1, n2 - n1)

d = distance(334500.0, 3066800.0, 334548.12, 3066821.45)
print(f"{d:.3f} m")
```

The text in triple quotes is a **docstring**. It documents what the function does, and `help(distance)` will show it. Write one for every function you share.

## Default values and keyword arguments

A parameter can have a **default**, used when the caller leaves it out. When calling, you can name the arguments, which makes calls easier to read:

```python
def rational_peak_flow(C, i_mm_per_h, area_ha, unit="m3/s"):
    """Rational method, Q = C·i·A/360 (m³/s) with i in mm/h and A in ha."""
    q = C * i_mm_per_h * area_ha / 360
    if unit == "l/s":
        return q * 1000
    return q

print(rational_peak_flow(0.45, 110, 12.5))
print(rational_peak_flow(0.45, 110, 12.5, unit="l/s"))
print(rational_peak_flow(C=0.6, area_ha=3.2, i_mm_per_h=95))
```

With keyword arguments (`C=0.6`), the order does not matter, and nobody has to remember which number is which.

## Returning several values

A function can return several values at once as a tuple, which you unpack on the other side:

```python
import math

def distance_bearing(e1, n1, e2, n2):
    de, dn = e2 - e1, n2 - n1
    dist = math.hypot(de, dn)
    brg = math.degrees(math.atan2(de, dn)) % 360
    return dist, brg

d, b = distance_bearing(334500.0, 3066800.0, 334548.12, 3066821.45)
print(f"Distance {d:.3f} m, bearing {b:.2f}°")
```

## Functions that use other functions

Small functions combine into bigger ones. Here, a polygon area function and a unit formatter work together:

```python
def polygon_area(points):
    """Shoelace formula. points = [(x, y), ...] in metres, any order around the edge."""
    s = 0
    for i in range(len(points)):
        x1, y1 = points[i]
        x2, y2 = points[(i + 1) % len(points)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2

def to_rapd(area_m2):
    """Convert m² to ropani-aana-paisa-daam (1 ropani = 16 aana = 64 paisa = 256 daam)."""
    daam_total = area_m2 / 508.72 * 256
    r, rest = divmod(daam_total, 256)
    a, rest = divmod(rest, 16)
    p, d = divmod(rest, 4)
    return f"{int(r)}-{int(a)}-{int(p)}-{d:.1f}"

parcel = [(0, 0), (32.5, 0), (35.0, 18.2), (2.0, 21.0)]
area = polygon_area(parcel)
print(f"{area:.2f} m² = {to_rapd(area)} (R-A-P-D)")
```

`divmod(a, b)` returns the whole-number quotient and the remainder in one go.

## Variable scope

Variables created **inside** a function exist only inside it. This keeps functions independent: they cannot accidentally overwrite your other variables.

```python
def area_of_square(side):
    result = side * side      # 'result' lives only inside the function
    return result

print(area_of_square(12))

try:
    print(result)
except NameError:
    print("'result' does not exist outside the function")
```

## Short functions with lambda

A `lambda` is a one-line function without a name. It is mostly used to tell `sorted`, `max` or pandas *how* to compare things:

```python
stations = [("Jumla", 2300), ("Biratnagar", 72), ("Pokhara", 827)]

by_height = sorted(stations, key=lambda s: s[1])
print(by_height)

highest = max(stations, key=lambda s: s[1])
print("Highest:", highest[0])
```

`lambda s: s[1]` means *"given a station `s`, use its second item (the elevation)"*.

## Practice

> **Try it:** Write a function `gradient(chainage1, rl1, chainage2, rl2)` that returns the gradient in percent between two points on a road profile. Use it to print the gradient of each segment of the profile below.

```python
def gradient(ch1, rl1, ch2, rl2):
    return (rl2 - rl1) / (ch2 - ch1) * 100

profile = [(0, 1302.40), (60, 1305.10), (140, 1311.70), (200, 1312.30)]

for (c1, h1), (c2, h2) in zip(profile, profile[1:]):
    print(f"Ch {c1:>3}–{c2:>3}: {gradient(c1, h1, c2, h2):+.2f} %")
```

`zip(profile, profile[1:])` pairs each point with the next one, which is the standard trick for working on consecutive pairs.

## Key points

- `def name(params):` defines a function; `return` gives back the result.
- Use defaults (`unit="m3/s"`) and keyword arguments for clear calls.
- Return several values as a tuple and unpack them.
- Variables inside a function stay inside it.
- Write a docstring for every function you will reuse.
