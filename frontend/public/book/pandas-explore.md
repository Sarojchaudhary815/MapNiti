Before you analyse a dataset, explore it: how big is it, what are the columns, what type is each one, are there gaps, what do typical values look like? This chapter uses the monthly rainfall file to show the standard exploration steps and the ways to select exactly the rows and columns you need.

## Load and look

```python
import pandas as pd

rain = pd.read_csv("data/rainfall_monthly.csv")
rain.head()
```

```python
print("Shape:", rain.shape)
print("Columns:", list(rain.columns))
print()
rain.info()
```

- `shape` is (rows, columns).
- `info()` lists every column with its type and the number of **non-null** (non-missing) values. If a column has fewer non-null values than there are rows, data is missing. Here `rain_mm` has gaps.

## Summary statistics

```python
rain.describe().round(1)
```

For text columns, count the distinct values instead:

```python
print("Stations:", rain["station"].nunique())
rain["station"].value_counts().head()
```

`value_counts()` counts how often each value appears. Every station should have 24 rows (12 months × 2 years), but one has 26, which hints at **duplicate** rows. We fix those in the next chapter.

## Selecting rows with conditions

A condition on a column gives a True/False value for every row. Putting it inside `df[...]` keeps only the rows where it is True:

```python
monsoon = rain[rain["month"].between(6, 9)]
print(len(monsoon), "monsoon rows")
monsoon.head()
```

Combine conditions with `&` (and) and `|` (or). Each condition **must** be in brackets:

```python
pokhara_wet = rain[(rain["station"] == "Pokhara Airport") & (rain["rain_mm"] > 500)]
pokhara_wet
```

Selecting from a list of values is easier with `isin`:

```python
west = rain[rain["station"].isin(["Nepalgunj", "Dhangadhi", "Dadeldhura"])]
print(west["station"].unique())
```

## loc and iloc

- `.loc[rows, columns]` selects by **label** (index values and column names).
- `.iloc[rows, columns]` selects by **position** (0, 1, 2…), like a list.

```python
print(rain.loc[0, "station"])                         # row label 0, column "station"
print(rain.loc[0:2, ["station", "month", "rain_mm"]])  # with loc, the end label IS included
print(rain.iloc[0:2, 0:3])                            # with iloc, the end position is NOT included
```

The most useful form combines a condition with a column list:

```python
rain.loc[rain["rain_mm"] > 700, ["station", "year", "month", "rain_mm"]]
```

## Sorting and ranking

```python
top = rain.sort_values("rain_mm", ascending=False).head(5)
top
```

```python
rain.nlargest(3, "rain_mm")[["station", "year", "month", "rain_mm"]]
```

`nlargest` and `nsmallest` are shortcuts for "sort and take the top N".

## Grouping: one number per station

`groupby` splits the table into groups, calculates something for each group and combines the results. It is the pandas version of a pivot table:

```python
annual = rain.groupby(["station", "year"])["rain_mm"].sum().round(0)
annual.head(6)
```

Several statistics at once with `agg`:

```python
per_station = rain.groupby("station")["rain_mm"].agg(["mean", "max", "count"]).round(1)
per_station.sort_values("max", ascending=False)
```

## Joining station details

The rainfall file has only station names. The station file has their province and elevation. `merge` joins two tables on a shared column, like VLOOKUP in Excel:

```python
stations = pd.read_csv("data/stations.csv")
annual_2023 = (rain[rain["year"] == 2023]
               .groupby("station", as_index=False)["rain_mm"].sum())
joined = annual_2023.merge(stations[["station", "province", "elevation_m"]], on="station")
joined.sort_values("rain_mm", ascending=False).round(0)
```

The brackets around the long expression let us split it over several lines. Each line does one step, which keeps it readable.

## Key points

- Explore first: `head()`, `shape`, `info()`, `describe()`, `value_counts()`.
- Filter rows with conditions: `df[(cond1) & (cond2)]`, `isin`, `between`.
- `.loc` selects by label, `.iloc` by position.
- `sort_values`, `nlargest`; `groupby(...).agg(...)` for summaries; `merge` to join tables.
