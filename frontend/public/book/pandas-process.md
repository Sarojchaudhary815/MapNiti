Raw data almost always needs cleaning before it can be trusted: duplicate rows, missing values, wrong types, inconsistent spelling. This chapter cleans the rainfall table step by step, then reshapes it into the forms you need for reports and charts.

## Start from the raw file

```python
import pandas as pd

rain = pd.read_csv("data/rainfall_monthly.csv")
print("Rows:", len(rain))
print("Missing values per column:")
print(rain.isna().sum())
print("Duplicate rows:", rain.duplicated().sum())
```

- `isna()` marks each missing cell as True; `.sum()` counts them per column.
- `duplicated()` marks rows that are exact copies of an earlier row.

## Remove duplicates

```python
rain = rain.drop_duplicates().reset_index(drop=True)
print("Rows after removing duplicates:", len(rain))
```

`reset_index(drop=True)` renumbers the rows 0, 1, 2, … after the removal.

## Find and fill missing values

First look at the gaps, so you know what you are dealing with:

```python
rain[rain["rain_mm"].isna()]
```

There are three ways to deal with missing values. Which one is right depends on the use:

| Method | Code | When it is reasonable |
|---|---|---|
| Drop the rows | `df.dropna(subset=["rain_mm"])` | Few gaps, and totals are not needed |
| Fill with a constant | `df["rain_mm"].fillna(0)` | Only if a gap really means zero (rarely true for rain!) |
| Fill with an estimate | `fillna(...)` with a mean or a neighbour's value | Totals are needed; record that values were estimated |

Here we fill each gap with the mean for the same station and month in the other year, and keep a flag column so the estimate is never mistaken for a measurement:

```python
rain["estimated"] = rain["rain_mm"].isna()
same_month_mean = rain.groupby(["station", "month"])["rain_mm"].transform("mean")
rain["rain_mm"] = rain["rain_mm"].fillna(same_month_mean).round(1)

print("Missing now:", rain["rain_mm"].isna().sum())
rain[rain["estimated"]]
```

`transform("mean")` calculates the group mean but returns it **aligned to every row**, so it can fill the gaps directly.

> **Warning:** For design work, infill missing records with an accepted hydrological method (e.g. from nearby stations) and document it. A simple mean is used here only to teach the pandas mechanics.

## Fixing types and text

Data typed by people often has inconsistent spelling and spaces, and numbers stored as text. These small fixes are very common:

```python
messy = pd.DataFrame({
    "district": [" kaski", "Kaski ", "KASKI", "Kathmandu"],
    "area_ha": ["12.5", "8", "n/a", "30.25"],
})
messy["district"] = messy["district"].str.strip().str.title()
messy["area_ha"] = pd.to_numeric(messy["area_ha"], errors="coerce")
print(messy)
print(messy.dtypes)
```

- `.str` gives access to text methods for a whole column: `strip`, `title`, `upper`, `replace`, `contains`.
- `pd.to_numeric(..., errors="coerce")` converts to numbers and turns anything unreadable (`"n/a"`) into a proper missing value instead of crashing.

## New columns from rules

```python
import numpy as np

rain["season"] = np.select(
    [rain["month"].isin([6, 7, 8, 9]), rain["month"].isin([3, 4, 5])],
    ["Monsoon", "Pre-monsoon"],
    default="Dry",
)
rain["heavy_month"] = rain["rain_mm"] > 400
rain.sample(5, random_state=1)
```

`np.select` is a column-wide `if / elif / else`: a list of conditions, a list of results, and a default.

## Summaries with pivot tables

A pivot table turns a long list into a compact grid: one row per station, one column per season:

```python
season_totals = rain[rain["year"] == 2023].pivot_table(
    index="station", columns="season", values="rain_mm", aggfunc="sum").round(0)
season_totals["Monsoon share %"] = (season_totals["Monsoon"] / season_totals.sum(axis=1) * 100).round(1)
season_totals.sort_values("Monsoon share %", ascending=False)
```

`sum(axis=1)` adds across the columns of each row (axis 0 would add down each column).

## Long and wide formats

Data is either **long** (one row per observation) or **wide** (one column per month or year). Charts and databases prefer long; reports and Excel users prefer wide. `pivot` and `melt` convert between them:

```python
wide = rain[rain["station"] == "Jumla"].pivot(index="month", columns="year", values="rain_mm")
wide
```

```python
long_again = wide.reset_index().melt(id_vars="month", var_name="year", value_name="rain_mm")
long_again.head()
```

## Stacking and joining tables

`pd.concat` stacks tables with the same columns on top of each other, for example two years of data that came in two files:

```python
y2022 = rain[rain["year"] == 2022]
y2023 = rain[rain["year"] == 2023]
both = pd.concat([y2022, y2023], ignore_index=True)
print(len(y2022), "+", len(y2023), "=", len(both), "rows")
```

## Saving the cleaned data

```python
rain.to_csv("rainfall_clean.csv", index=False)
print("Saved", len(rain), "rows,", int(rain["estimated"].sum()), "of them estimated")
```

## Key points

- Check with `isna().sum()` and `duplicated().sum()`; fix with `drop_duplicates`, `dropna`, `fillna`.
- Keep a flag column whenever you estimate values.
- `.str` methods clean text; `pd.to_numeric(errors="coerce")` fixes numbers stored as text.
- `np.select` for rule-based columns; `pivot_table`, `pivot`, `melt`, `concat` to reshape.
