So far every line of code ran once, top to bottom. Real programs make **decisions** (is this slope too steep?) and **repeat** work (do this for every parcel). This chapter covers `if` statements and the two kinds of loops, `for` and `while`.

## Making decisions with if

An `if` statement runs a block of code only when a condition is `True`. The block is the **indented** lines under it.

```python
slope_deg = 34

if slope_deg > 30:
    print("Steep slope: geotechnical check needed")

print("This line always runs")
```

> **Remember:** Python uses **indentation** (4 spaces) to show which lines belong to the `if`. The colon `:` at the end of the `if` line is required.

## if, elif and else

Use `elif` ("else if") for more cases and `else` for everything left over. Python checks the conditions from top to bottom and runs only the **first** matching block.

```python
slope_deg = 22

if slope_deg < 5:
    category = "Flat"
elif slope_deg < 15:
    category = "Gentle"
elif slope_deg < 30:
    category = "Moderate"
else:
    category = "Steep"

print(f"{slope_deg}° is {category}")
```

Change `slope_deg` to 3, 12 or 40 and run the cell again to see each branch.

## Combining conditions: and, or, not

```python
rain_mm = 145
river_level_m = 4.2
danger_level_m = 4.0

if rain_mm > 100 and river_level_m > danger_level_m:
    print("Flood warning: heavy rain AND river above danger level")
elif rain_mm > 100 or river_level_m > danger_level_m:
    print("Watch: one of the two conditions is met")
else:
    print("Normal")

is_dry = not (rain_mm > 0)
print("Dry day?", is_dry)
```

- `and`: both conditions must be true.
- `or`: at least one must be true.
- `not`: flips `True` and `False`.

## Repeating with a for loop

A `for` loop runs its block once for **each item** in a list (or any other collection):

```python
districts = ["Kathmandu", "Lalitpur", "Bhaktapur"]

for d in districts:
    print("Processing", d)

print("All done")
```

On each pass, the variable `d` holds the next item. The name `d` is your choice.

## Looping over numbers with range()

`range(n)` produces the numbers 0, 1, … n−1. `range(start, stop, step)` gives more control. This is how you generate chainages along a road:

```python
for ch in range(0, 201, 50):          # 0 to 200 in steps of 50
    print(f"Chainage 0+{ch:03d}")
```

`range` stops **before** the stop value, so we write 201 to include 200.

## Keeping a running result

A loop often builds up a result, such as reduced levels along a levelling line (rise-and-fall method):

```python
start_rl = 1301.250              # benchmark level, m
rises_falls = [+2.554, -0.870, +3.120, -1.665, +0.410]

rl = start_rl
print(f"BM   RL = {rl:.3f}")
for i, change in enumerate(rises_falls, start=1):
    rl += change
    print(f"TP{i}  {change:+.3f}  RL = {rl:.3f}")

print(f"Total change: {rl - start_rl:+.3f} m")
```

- `enumerate()` gives a counter (`i`) together with each item, so we can label the points TP1, TP2, ….
- `{change:+.3f}` always shows the sign, which makes rises and falls easy to read.

## Loops with decisions inside

Loops and `if` statements work together. Here we classify each station and count the results:

```python
elevations = {"Biratnagar": 72, "Pokhara": 827, "Kathmandu": 1337,
               "Dadeldhura": 1848, "Jumla": 2300, "Simara": 130}

counts = {"Terai": 0, "Hill": 0, "Mountain": 0}
for name, h in elevations.items():
    if h < 300:
        zone = "Terai"
    elif h < 2000:
        zone = "Hill"
    else:
        zone = "Mountain"
    counts[zone] += 1
    print(f"{name:<11} {h:>5} m  {zone}")

print(counts)
```

(These elevation bands are a simplification for the exercise, not an official physiographic division.)

## break and continue

- `continue` skips the rest of the current pass and moves to the next item.
- `break` leaves the loop completely.

```python
readings = [1.45, 2.81, None, 0.97, -1.0, 3.12, 1.66]

for r in readings:
    if r is None:
        print("  missing reading, skipped")
        continue
    if r < 0:
        print("  negative staff reading! stopping to check the field book")
        break
    print("Reading:", r)
```

## while loops

A `while` loop repeats **as long as** a condition is true. Use it when you do not know in advance how many passes you need, for example when solving an equation step by step:

```python
# Find the normal depth y of a wide channel where the flow per metre width
# q = (1/n) * y^(5/3) * S^(1/2) equals the design value (Manning's equation).
n, S, q_target = 0.030, 0.002, 1.8       # roughness, slope, m³/s per m

y = 0.1
step = 0.001
while (1 / n) * y ** (5 / 3) * S ** 0.5 < q_target:
    y += step

print(f"Normal depth ≈ {y:.3f} m")
```

> **Warning:** Make sure the condition eventually becomes false, or the loop never ends. In the book, a stuck cell can be stopped by reloading the page.

## Practice

> **Try it:** Below is a list of road segment gradients in percent. Loop over them and print *OK* if the gradient is at most 7 %, *Check* if it is between 7 % and 12 %, and *Too steep* above 12 %. At the end, print how many segments need checking. (The limits are illustrative; use the standard that applies to your road class.)

```python
gradients = [3.2, 6.8, 7.5, 11.9, 12.4, 4.1, 9.0]

to_check = 0
for i, g in enumerate(gradients, start=1):
    if g <= 7:
        verdict = "OK"
    elif g <= 12:
        verdict = "Check"
        to_check += 1
    else:
        verdict = "Too steep"
        to_check += 1
    print(f"Segment {i}: {g:4.1f} %  {verdict}")

print("Segments needing attention:", to_check)
```

## Key points

- `if / elif / else` choose what to run; indentation defines the blocks.
- Combine conditions with `and`, `or`, `not`.
- `for item in collection:` repeats for each item; `range()` makes number sequences; `enumerate()` adds a counter.
- `while condition:` repeats until the condition is false; `break` and `continue` control loops.
