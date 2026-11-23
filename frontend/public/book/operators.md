Most engineering calculations are arithmetic: gradients, areas, volumes, unit conversions. This chapter shows Python's operators, the `math` module for things like square roots and trigonometry, and how to write comments that make your calculations readable.

## Arithmetic operators

| Operator | Meaning | Example | Result |
|---|---|---|---|
| `+` | Add | `1301.25 + 1.45` | `1302.7` |
| `-` | Subtract | `1308.1 - 1301.2` | `6.9` |
| `*` | Multiply | `25 * 20` | `500` |
| `/` | Divide (always gives a float) | `7 / 2` | `3.5` |
| `//` | Whole-number division | `7 // 2` | `3` |
| `%` | Remainder (modulo) | `370 % 360` | `10` |
| `**` | Power | `3 ** 2` | `9` |

```python
length = 25.0          # m
width = 20.0           # m

area = length * width
perimeter = 2 * (length + width)
diagonal = (length ** 2 + width ** 2) ** 0.5

print("Area:", area, "m²")
print("Perimeter:", perimeter, "m")
print("Diagonal:", round(diagonal, 3), "m")
```

- `** 0.5` is the same as a square root.
- `round(value, 3)` rounds to 3 decimal places for display.

## Order of operations

Python follows the usual maths order: brackets first, then powers, then `*` and `/`, then `+` and `-`. When in doubt, add brackets; they cost nothing and make the formula clear.

```python
rise = 12.5            # m
run = 250.0            # m

gradient_percent = (rise / run) * 100
print(f"Road gradient = {gradient_percent:.2f} %")

# 1 in N notation used on drawings
print(f"That is 1 in {run / rise:.0f}")
```

## Useful operators: modulo and whole division

`%` and `//` look odd at first, but they solve real problems. A bearing must stay between 0° and 360°, and a chainage is written as km + m:

```python
bearing = 372.5
print("Bearing:", bearing % 360, "degrees")

chainage_m = 12345.6
km = int(chainage_m // 1000)
m = chainage_m % 1000
print(f"Chainage {km}+{m:06.2f}")
```

- `372.5 % 360` gives the remainder after removing full circles: `12.5`.
- `12345.6 // 1000` gives `12.0` full kilometres; `% 1000` gives the remaining metres.
- `:06.2f` pads the metres to `345.60` so it reads like a real chainage, `12+345.60`.

## Updating a variable in place

Very often you add to a running total. Python has short forms for this:

```python
total_rain = 0
total_rain += 245      # June
total_rain += 380      # July
total_rain += 352      # August
print("Monsoon total so far:", total_rain, "mm")

level = 1301.250
level -= 1.452         # fall
print("New level:", round(level, 3))
```

`a += b` means `a = a + b`. There are also `-=`, `*=` and `/=`.

## The math module

Python's built-in `math` module adds square roots, trigonometry, logarithms and constants such as π. You load it once with `import math`.

```python
import math

print("pi =", math.pi)
print("sqrt(2) =", math.sqrt(2))
print("log10(1000) =", math.log10(1000))

# Trigonometry uses RADIANS, not degrees
angle_deg = 30
angle_rad = math.radians(angle_deg)
print("sin(30°) =", round(math.sin(angle_rad), 4))
```

> **Warning:** `math.sin`, `math.cos` and `math.tan` expect **radians**. Forgetting `math.radians()` is the most common bug in survey and road calculations.

## Worked example: distance and bearing between two points

Two survey stations have UTM coordinates. Find the horizontal distance and the whole-circle bearing from A to B:

```python
import math

e_a, n_a = 334500.000, 3066800.000
e_b, n_b = 334548.120, 3066821.450

d_e = e_b - e_a          # change in easting
d_n = n_b - n_a          # change in northing

distance = math.hypot(d_e, d_n)
bearing = math.degrees(math.atan2(d_e, d_n)) % 360

print(f"ΔE = {d_e:.3f} m, ΔN = {d_n:.3f} m")
print(f"Distance AB = {distance:.3f} m")
print(f"Bearing AB  = {bearing:.4f}°")
```

- `math.hypot(x, y)` is √(x² + y²), the straight-line distance.
- `math.atan2(ΔE, ΔN)` gives the angle from north, in the correct quadrant. Note the order: easting first.
- `% 360` turns a negative angle into a 0–360° bearing.

## Converting decimal degrees to degrees-minutes-seconds

```python
bearing = 65.9671

d = int(bearing)
minutes_full = (bearing - d) * 60
m = int(minutes_full)
s = (minutes_full - m) * 60

print(f"{bearing}° = {d}° {m}' {s:.1f}\"")
```

## Comparison operators

Comparisons give a boolean (`True` or `False`). You will use them in the chapter on conditions.

```python
slope_deg = 32
print(slope_deg > 30)       # greater than
print(slope_deg <= 30)      # less than or equal
print(slope_deg == 32)      # equal (two = signs!)
print(slope_deg != 32)      # not equal

# Chained comparison, as in maths
print(15 <= slope_deg < 35)
```

## Comments and readable formulas

Comments explain *why*, not *what*. Use them to record units, sources of constants and assumptions:

```python
# Rational method peak flow: Q = C i A / 360
# Q in m³/s, i in mm/h, A in hectares (metric form of the formula)
C = 0.45        # runoff coefficient, mixed residential (check local guidelines)
i = 110         # rainfall intensity for the time of concentration, mm/h
A = 12.5        # catchment area, ha

Q = C * i * A / 360
print(f"Peak flow Q = {Q:.3f} m³/s")
```

## Key points

- `+ - * /` work as expected; `**` is power, `//` whole division and `%` remainder.
- Use brackets to make formulas clear.
- `import math` for `sqrt`, `sin`, `atan2`, `hypot`, `pi`; trigonometry uses radians.
- Comments start with `#`; use them for units, sources and assumptions.
