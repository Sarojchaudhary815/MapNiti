Every chapter uses the same small set of practice files, so you can concentrate on the code instead of hunting for data. They are small enough to load instantly in the browser, and you can download them to use on your own computer.

## The practice datasets

| File | Type | What it contains | Download |
|---|---|---|---|
| `stations.csv` | Table | 12 weather stations: district, province, latitude, longitude, elevation | [stations.csv](/book-data/stations.csv) |
| `rainfall_monthly.csv` | Table | Monthly rainfall for the 12 stations, 2022–2023 | [rainfall_monthly.csv](/book-data/rainfall_monthly.csv) |
| `demo_wards.geojson` | Polygons | 6 wards of *Demo Nagar* with population and households | [demo_wards.geojson](/book-data/demo_wards.geojson) |
| `demo_roads.geojson` | Lines | 4 roads of Demo Nagar with a road class | [demo_roads.geojson](/book-data/demo_roads.geojson) |
| `demo_river.geojson` | Line | Demo Khola, the river through the town | [demo_river.geojson](/book-data/demo_river.geojson) |
| `demo_schools.geojson` | Points | 14 schools with number of students | [demo_schools.geojson](/book-data/demo_schools.geojson) |
| `demo_dem.tif` | Raster | 30 m elevation model of the area (UTM 45N) | [demo_dem.tif](/book-data/demo_dem.tif) |
| `demo_red.tif`, `demo_nir.tif` | Raster | Red and near-infrared bands, 50 m (UTM 45N) | [red](/book-data/demo_red.tif) · [nir](/book-data/demo_nir.tif) |

> **Warning:** These are **teaching datasets**. Station locations and elevations are approximate. The rainfall numbers are *synthetic*: they follow the shape of Nepal's monsoon but are not DHM records. Demo Nagar is a **fictional** municipality. Never use these files for design or reports. For real data, see MapNiti's **Data Sources** page and **Data Download** tool.

## Where the files live

In this book a file is always read with a path like `data/stations.csv`. The browser copies the file into Python's working folder for you the first time a cell mentions it.

On your computer, make a project folder like this and put the downloads in `data/`:

```text
my-gis-project/
├── data/
│   ├── stations.csv
│   ├── rainfall_monthly.csv
│   ├── demo_wards.geojson
│   └── demo_dem.tif
└── analysis.ipynb
```

Then the same code works without any change, because the paths are *relative* to the notebook.

## A first look at a file

The cell below reads `stations.csv` as plain text, without any library, and prints the first lines. It is a good habit to look at a file before analysing it.

```python
with open("data/stations.csv") as f:
    lines = f.readlines()

print("Number of lines:", len(lines))
for line in lines[:4]:
    print(line.strip())
```

- `open(...)` opens the file; `with` closes it again automatically.
- `readlines()` returns a list with one item per line.
- `lines[:4]` takes the first four lines: the header plus three stations.
- `strip()` removes the invisible line-break at the end of each line.

## The same file as a table

Part 3 introduces **pandas**, which turns a CSV file into a table in one line:

```python
import pandas as pd

stations = pd.read_csv("data/stations.csv")
stations.head()
```

When a cell ends with a value (here `stations.head()`), the book shows it like Jupyter does: as a formatted table. `head()` returns the first five rows.

## And as a map

`demo_wards.geojson` contains polygons. GeoPandas reads it and can draw it straight away (Part 4 explains every step):

```python
import geopandas as gpd

wards = gpd.read_file("data/demo_wards.geojson")
ax = wards.plot(column="population", cmap="Blues", edgecolor="black", legend=True, figsize=(7, 4))
ax.set_title("Demo Nagar: population by ward")
```
