Real data is messy. A level is typed as `1.52O` (letter O), a coordinate is missing, a file is not where you expected. When Python meets a problem it cannot handle, it raises an **exception** and stops. This chapter shows how to read error messages and how to handle errors so one bad row does not stop the processing of a thousand good ones.

## Reading an error message

Run this cell. It fails on purpose:

```python-error
reading = "1.52O"
value = float(reading)
```

The last line of the message is the important part. It has two pieces:

- the **type** of error, here `ValueError`;
- the **reason**: the text could not be converted to a number.

The lines above it (the *traceback*) show where the error happened. Read errors from the bottom up.

## Common exceptions

| Exception | Typical cause |
|---|---|
| `ValueError` | Right type, wrong value: `float("abc")` |
| `TypeError` | Wrong type: `"10" + 5` |
| `KeyError` | Missing dictionary key: `station["district"]` |
| `IndexError` | List position does not exist: `points[10]` in a 3-item list |
| `ZeroDivisionError` | Dividing by zero, e.g. a gradient with zero run |
| `FileNotFoundError` | Wrong path or file name |
| `NameError` | Using a variable before creating it (or a typo in its name) |

## Catching an error with try / except

Put the risky code in `try`. If it raises the named exception, Python runs the `except` block instead of stopping:

```python
reading = "1.52O"
try:
    value = float(reading)
    print("Reading:", value)
except ValueError as err:
    print("Could not read the staff reading:", reading)
    print("Python said:", err)

print("The program continues.")
```

`as err` stores the error object, so you can show or log its message.

## Skipping bad rows, keeping good ones

This is the pattern you will use most: process every row, collect the problems, and report them at the end.

```python
raw = """BM1,334500.000,3066800.000
TP1,334548.120,3066821.450
TP2,33460l.335,3066840.020
TP3,334702.410
BM2,334655.900,3066812.770"""

good, bad = [], []
for line_no, line in enumerate(raw.splitlines(), start=1):
    try:
        name, e, n = line.split(",")
        good.append((name, float(e), float(n)))
    except ValueError as err:
        bad.append((line_no, line, str(err)))

print(f"{len(good)} rows imported")
for line_no, line, why in bad:
    print(f"  line {line_no} skipped: {line!r}  ({why})")
```

- Line 3 has the letter `l` in `33460l.335`, so `float()` fails.
- Line 4 has only two values, so `name, e, n = ...` fails ("not enough values to unpack").
- Both are `ValueError`s, so one `except` catches both. The other rows import normally.

## Handling different errors differently

You can have several `except` blocks, one per kind of error:

```python
stations = {"Kathmandu": 1337, "Pokhara": 827}

def elevation_difference(a, b):
    try:
        return stations[a] - stations[b]
    except KeyError as err:
        return f"unknown station {err}"
    except TypeError:
        return "station names must be text"

print(elevation_difference("Kathmandu", "Pokhara"))
print(elevation_difference("Kathmandu", "Jumla"))
```

> **Warning:** Avoid a bare `except:` that catches everything. It also hides real bugs, such as a misspelled variable name, and makes problems very hard to find.

## else and finally

- `else` runs only if **no** error happened.
- `finally` runs **always**, error or not. It is used for clean-up, such as closing a connection.

```python
def safe_gradient(rise, run):
    try:
        g = rise / run * 100
    except ZeroDivisionError:
        print("  run is zero: vertical segment?")
        return None
    else:
        print(f"  gradient {g:.2f} %")
        return g
    finally:
        print("  (checked)")

safe_gradient(5, 120)
safe_gradient(5, 0)
```

## Raising your own errors

When input is clearly wrong, stop early with a clear message using `raise`. A good error message saves hours of debugging later.

```python
def check_nepal(lat, lon):
    """Stop if a point is clearly outside Nepal's bounding box."""
    if not (26.3 <= lat <= 30.5 and 80.0 <= lon <= 88.3):
        raise ValueError(f"({lat}, {lon}) is outside Nepal. Are latitude and longitude swapped?")
    return True

for lat, lon in [(27.7172, 85.3240), (85.3240, 27.7172)]:
    try:
        check_nepal(lat, lon)
        print(lat, lon, "OK")
    except ValueError as err:
        print("Error:", err)
```

## Files that might not exist

```python
import os

for path in ["data/stations.csv", "data/old_stations.csv"]:
    try:
        with open(path) as f:
            n = len(f.readlines()) - 1
        print(f"{path}: {n} records")
    except FileNotFoundError:
        print(f"{path}: not found. Check the folder and spelling.")

print("Files in data/:", sorted(os.listdir("data")))
```

## Key points

- Read error messages from the bottom: error **type** and **reason**.
- `try / except SomeError as err:` handles an expected problem and keeps going.
- Catch specific errors; never use a bare `except:`.
- `else` runs when nothing failed, `finally` always runs.
- `raise ValueError("clear message")` stops bad input early.
