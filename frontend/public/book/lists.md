One value per variable is not enough for real data: a levelling line has dozens of readings, a road has hundreds of chainages. A **list** holds many values, in order, under one name. Lists are the most-used data structure in Python.

## Creating a list

Put values inside square brackets, separated by commas:

```python
stations = ["Kathmandu", "Pokhara", "Biratnagar", "Jumla"]
elevations = [1337, 827, 72, 2300]

print(stations)
print(elevations)
print("Number of stations:", len(stations))
```

A list can hold any type, even a mix, but in practice each list usually holds one kind of thing.

## Indexing: getting one item

Each item has a position called an **index**. Python counts from **0**, not 1.

| Index | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Item | Kathmandu | Pokhara | Biratnagar | Jumla |
| Negative index | -4 | -3 | -2 | -1 |

```python
stations = ["Kathmandu", "Pokhara", "Biratnagar", "Jumla"]

print(stations[0])      # first item
print(stations[2])      # third item
print(stations[-1])     # last item
print(stations[-2])     # second to last
```

Negative indexes count from the end, so `[-1]` is always the last item, however long the list.

## Slicing: getting several items

`list[start:stop]` returns the items from `start` up to, but **not including**, `stop`:

```python
readings = [1.452, 2.810, 0.975, 3.120, 1.665, 2.004]

print(readings[0:3])     # items 0, 1, 2
print(readings[:2])      # from the start: first two
print(readings[3:])      # from index 3 to the end
print(readings[-2:])     # the last two
print(readings[::2])     # every second item
```

## Changing a list

Lists can be changed after they are created:

```python
levels = [1301.25, 1303.80, 1306.42]

levels.append(1308.12)          # add one item at the end
print(levels)

levels.insert(0, 1300.00)       # insert at position 0
print(levels)

levels[2] = 1303.81             # replace the item at index 2
print(levels)

removed = levels.pop()          # remove and return the last item
print("Removed", removed, "→", levels)
```

## Working with numbers in a list

Python has built-in functions for the most common summaries:

```python
rain = [14, 18, 34, 61, 124, 236, 363, 331, 199, 51, 8, 13]   # mm per month

print("Total:", sum(rain), "mm")
print("Wettest month:", max(rain), "mm")
print("Driest month:", min(rain), "mm")
print("Average:", round(sum(rain) / len(rain), 1), "mm")

monsoon = rain[5:9]            # June to September (indexes 5, 6, 7, 8)
share = sum(monsoon) / sum(rain) * 100
print(f"Monsoon share: {share:.1f} % of the annual rain")
```

- Index 5 is June because January is index 0.
- Slicing `[5:9]` takes June, July, August and September.

## Sorting and searching

```python
elevations = [1337, 827, 72, 2300, 1848]

print(sorted(elevations))                  # new sorted list, original unchanged
print(sorted(elevations, reverse=True))    # highest first
print(827 in elevations)                   # is a value in the list?
print(elevations.index(2300))              # position of a value
```

`sorted()` returns a new list. `elevations.sort()` sorts the list itself instead.

## Lists of pairs: coordinates

A coordinate is two numbers. A list of **tuples** (round brackets) is the natural way to store a line or a polygon:

```python
traverse = [(334500.0, 3066800.0), (334548.1, 3066821.5), (334601.3, 3066840.0)]

first = traverse[0]
print("First point:", first)

e, n = traverse[-1]                 # unpack the last point into two variables
print(f"Last point: E={e}, N={n}")

eastings = [p[0] for p in traverse]
print("All eastings:", eastings)
```

- A **tuple** is like a list that cannot be changed. That suits a coordinate pair: a point's E and N belong together.
- `e, n = ...` unpacks the pair into two variables.
- The last line is a **list comprehension**, a short way to build a list. It is explained next.

## List comprehensions

A list comprehension builds a new list from an old one in one line: `[expression for item in list]`.

```python
lengths_ft = [100, 250, 330, 1200]
lengths_m = [round(ft * 0.3048, 2) for ft in lengths_ft]
print(lengths_m)

elevations = [1337, 827, 72, 2300, 1848, 130]
hill_stations = [e for e in elevations if e > 1000]
print("Above 1000 m:", hill_stations)
```

Read the first one as: *"for each `ft` in `lengths_ft`, compute `ft * 0.3048`, and collect the results"*. The `if` at the end keeps only some items.

## Copying a list

> **Warning:** `b = a` does **not** copy a list. Both names then point to the same list, so changing one changes the other.

```python
a = [1, 2, 3]
b = a            # same list, two names
c = a.copy()     # a real copy

a.append(4)
print("a:", a)
print("b:", b, "← changed too!")
print("c:", c, "← independent copy")
```

## Practice

> **Try it:** Levelling readings from a staff are in the list below. Using slicing and `sum()`, compute the total of the back-sights (positions 0, 2, 4) and the fore-sights (positions 1, 3, 5), and the difference between them (the rise or fall over the line).

```python
staff = [1.452, 2.810, 0.975, 3.120, 1.665, 2.004]

back_sights = staff[0::2]
fore_sights = staff[1::2]
print("BS:", back_sights, "sum", round(sum(back_sights), 3))
print("FS:", fore_sights, "sum", round(sum(fore_sights), 3))
print("Rise (+) / fall (-):", round(sum(back_sights) - sum(fore_sights), 3), "m")
```

## Key points

- Lists hold many values in order: `[a, b, c]`. Indexes start at 0; `[-1]` is the last item.
- Slices `[start:stop]` exclude `stop`. `[::2]` takes every second item.
- `append`, `insert`, `pop`; `sum`, `min`, `max`, `len`, `sorted`.
- Tuples `(e, n)` are fixed lists, ideal for coordinates.
- `[f(x) for x in items if condition]` builds lists in one line.
