Field books, total-station exports, rainfall records and coordinate lists all arrive as **files**. This chapter shows how to read and write plain text, CSV and JSON/GeoJSON files with Python's built-in tools, before we hand the job to pandas and GeoPandas in later parts.

## Opening a file

`open(path, mode)` opens a file. The mode says what you want to do:

| Mode | Meaning |
|---|---|
| `"r"` | Read (the default) |
| `"w"` | Write: creates the file, or **erases** it if it exists |
| `"a"` | Append: adds to the end of the file |

Always open files with `with`. It closes the file automatically when the block ends, even if an error happens:

```python
with open("levels.txt", "w") as f:
    f.write("BM1 1301.250\n")
    f.write("TP1 1303.804\n")
    f.write("TP2 1306.421\n")

print("File written")
```

`\n` is the **newline** character. Without it, all three records would end up on one line.

## Reading a whole file, or line by line

```python
with open("levels.txt") as f:
    text = f.read()            # the whole file as one string
print(text)

with open("levels.txt") as f:
    for line in f:             # one line at a time (good for big files)
        name, rl = line.split()
        print(f"{name}: {float(rl):.3f} m")
```

- `split()` cuts a line at spaces: `"BM1 1301.250"` becomes `["BM1", "1301.250"]`.
- Each piece is text, so `float(rl)` converts the level to a number.

## Appending to a file

```python
with open("levels.txt", "a") as f:
    f.write("BM2 1308.115\n")

with open("levels.txt") as f:
    print(f.read())
```

## CSV files with the csv module

CSV (comma-separated values) is the most common format for tables. The `csv` module handles commas inside quotes and other details for you. `DictReader` turns each row into a dictionary using the header line:

```python
import csv

with open("data/stations.csv") as f:
    rows = list(csv.DictReader(f))

print("Columns:", list(rows[0].keys()))
print("First row:", rows[0])

for r in rows[:5]:
    print(f"{r['station']:<18} {r['province']:<14} {r['elevation_m']:>5} m")
```

> **Remember:** Every value from a CSV file is **text**, including `'1337'`. Convert with `float()` or `int()` before calculating.

```python
high = [r["station"] for r in rows if float(r["elevation_m"]) > 1000]
print("Stations above 1000 m:", high)

mean_elev = sum(float(r["elevation_m"]) for r in rows) / len(rows)
print(f"Mean elevation: {mean_elev:.0f} m")
```

## Writing a CSV file

`DictWriter` writes a list of dictionaries as a table. Here we save the Koshi stations with their elevation in feet added:

```python
import csv

koshi = [r for r in rows if r["province"] == "Koshi"]
for r in koshi:
    r["elevation_ft"] = round(float(r["elevation_m"]) / 0.3048)

with open("koshi_stations.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["station", "district", "elevation_m", "elevation_ft"], extrasaction="ignore")
    writer.writeheader()
    writer.writerows(koshi)

print(open("koshi_stations.csv").read())
```

- `newline=""` stops blank lines appearing between rows on Windows.
- `extrasaction="ignore"` skips columns that are not in `fieldnames` (like `lat` and `lon`).

## JSON and GeoJSON

JSON stores dictionaries and lists as text. The `json` module converts in both directions. Because GeoJSON is JSON, you can build a GeoJSON file from the station table with no GIS library at all:

```python
import json

features = []
for r in rows:
    features.append({
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [float(r["lon"]), float(r["lat"])]},
        "properties": {"station": r["station"], "elevation_m": int(r["elevation_m"])},
    })

collection = {"type": "FeatureCollection", "features": features}
with open("stations.geojson", "w") as f:
    json.dump(collection, f, indent=2)

print("Saved", len(features), "points")
print(open("stations.geojson").read()[:300], "...")
```

`json.dump` writes; `indent=2` makes the file readable. The result opens directly in QGIS or any web map.

Reading it back is just as short:

```python
with open("stations.geojson") as f:
    data = json.load(f)

first = data["features"][0]
print(first["properties"]["station"], first["geometry"]["coordinates"])
```

## Paths and folders

The `os` module works with folders and file names. It is useful when processing every file in a folder:

```python
import os

print("Working folder:", os.getcwd())
for name in sorted(os.listdir(".")):
    if name.endswith((".txt", ".csv", ".geojson")):
        size = os.path.getsize(name)
        print(f"  {name:<22} {size:>6} bytes")

print(os.path.join("data", "stations.csv"))
print(os.path.splitext("roads_2024.shp"))
```

- `os.path.join` builds a path with the right separator for your system (`\` on Windows, `/` elsewhere).
- `os.path.splitext` splits a file name into name and extension.

## Practice

> **Try it:** Read `data/rainfall_monthly.csv` with `csv.DictReader` and add up the 2023 rainfall for *Pokhara Airport*. Some values are empty (missing data); skip those rows.

```python
import csv

total, missing = 0.0, 0
with open("data/rainfall_monthly.csv") as f:
    for r in csv.DictReader(f):
        if r["station"] == "Pokhara Airport" and r["year"] == "2023":
            if r["rain_mm"] == "":
                missing += 1
                continue
            total += float(r["rain_mm"])

print(f"Pokhara Airport 2023: {total:.1f} mm ({missing} missing months)")
```

## Key points

- Use `with open(path, mode) as f:`; modes `"r"`, `"w"` (overwrites!) and `"a"`.
- `csv.DictReader` / `csv.DictWriter` for tables; values come in as text.
- `json.load` / `json.dump` for JSON and GeoJSON.
- `os.listdir`, `os.path.join`, `os.path.splitext` for working with folders.
