**pandas** is the Python library for tables. If you have used Excel, you already know the idea: rows, columns, filters, sums. pandas does the same with code, so it is repeatable, works on millions of rows and fits into a bigger workflow. GeoPandas, which you will use for maps, is built directly on pandas, so everything in this part carries over.

## The two building blocks

| Object | What it is | Excel equivalent |
|---|---|---|
| **Series** | One column of values with labels | A single column |
| **DataFrame** | A table: several Series sharing the same row labels | A worksheet |

By convention pandas is imported as `pd`:

```python
import pandas as pd
print("pandas version:", pd.__version__)
```

## A Series

```python
elevation = pd.Series([1337, 827, 72, 2300], index=["Kathmandu", "Pokhara", "Biratnagar", "Jumla"], name="elevation_m")
elevation
```

The left column is the **index** (the row labels) and the right column holds the values. You can look values up by label, and do maths on the whole column at once:

```python
print(elevation["Pokhara"])
print(elevation.max(), "m is the highest")
print((elevation / 0.3048).round(0))       # whole column converted to feet
```

There is no loop: `elevation / 0.3048` divides every value. This is called **vectorised** maths and it is one of the main reasons to use pandas.

## A DataFrame from a dictionary

The easiest way to make a small DataFrame is a dictionary of columns:

```python
stations = pd.DataFrame({
    "station": ["Kathmandu Airport", "Pokhara Airport", "Biratnagar", "Jumla"],
    "province": ["Bagmati", "Gandaki", "Koshi", "Karnali"],
    "elevation_m": [1337, 827, 72, 2300],
    "annual_rain_mm": [1500, 3900, 2000, 800],
})
stations
```

Each key becomes a column name, each list becomes the column's values. The numbers on the left (0, 1, 2, 3) are the default index.

## Reading a CSV file

Real data comes from files. `pd.read_csv` reads a CSV into a DataFrame in one line:

```python
stations = pd.read_csv("data/stations.csv")
print(stations.shape)          # (rows, columns)
stations.head()
```

pandas can read many other formats too:

| Function | Reads |
|---|---|
| `pd.read_csv("file.csv")` | CSV and other text tables |
| `pd.read_excel("file.xlsx", sheet_name="2023")` | Excel workbooks (needs `openpyxl`) |
| `pd.read_json("file.json")` | JSON |
| `pd.read_sql(query, connection)` | Databases, including PostGIS |
| `pd.read_parquet("file.parquet")` | Parquet, a fast column format |

## Columns and new columns

Pick a column with `df["name"]`. Create a new column by assigning to a new name:

```python
print(stations["station"].head(3))

stations["elevation_ft"] = (stations["elevation_m"] / 0.3048).round(0)
stations["is_hill"] = stations["elevation_m"] >= 1000
stations[["station", "elevation_m", "elevation_ft", "is_hill"]]
```

- Double brackets `[["a", "b"]]` select **several** columns and give back a DataFrame.
- The comparison `>= 1000` produces a column of `True`/`False`, which we store as `is_hill`.

## Quick statistics

```python
stations["elevation_m"].describe()
```

`describe()` gives the count, mean, standard deviation, minimum, quartiles and maximum in one go. It is usually the first thing to run on a numeric column.

## Saving a table

```python
hill = stations[stations["is_hill"]]
hill.to_csv("hill_stations.csv", index=False)
print(open("hill_stations.csv").read())
```

`index=False` leaves out the row numbers, which you rarely want in the file.

## Key points

- `import pandas as pd`; a **Series** is one column, a **DataFrame** is a table.
- Create with `pd.DataFrame({...})` or read with `pd.read_csv(...)`.
- `df["col"]` selects a column; `df["new"] = ...` adds one; maths applies to the whole column.
- `describe()` summarises; `to_csv(..., index=False)` saves.
