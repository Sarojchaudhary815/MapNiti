A chart shows in seconds what a table hides. **matplotlib** is Python's main plotting library, and pandas has a `.plot()` shortcut that calls it for you. This chapter builds the charts you need most in engineering reports, using the rainfall data.

## Prepare the data

```python
import pandas as pd
import matplotlib.pyplot as plt

rain = pd.read_csv("data/rainfall_monthly.csv").drop_duplicates()
rain["rain_mm"] = rain["rain_mm"].fillna(rain.groupby(["station", "month"])["rain_mm"].transform("mean"))
r23 = rain[rain["year"] == 2023]
print(len(r23), "rows for 2023")
```

## A line chart

A line chart shows how a value changes over time:

```python
ktm = r23[r23["station"] == "Kathmandu Airport"]

fig, ax = plt.subplots(figsize=(8, 4))
ax.plot(ktm["month"], ktm["rain_mm"], marker="o", color="#0047AB")
ax.set_title("Kathmandu Airport, monthly rainfall 2023 (sample data)")
ax.set_xlabel("Month")
ax.set_ylabel("Rainfall (mm)")
ax.set_xticks(range(1, 13))
ax.grid(alpha=0.3)
```

- `plt.subplots()` creates a **figure** (the whole image) and an **axes** (the chart area). You then draw on `ax`.
- `marker="o"` puts a dot on each data point.
- Always label the axes **with units** and give the chart a title.

## Several lines on one chart

Use `pivot` to get one column per station; pandas then draws one line per column:

```python
three = r23[r23["station"].isin(["Pokhara Airport", "Kathmandu Airport", "Jumla"])]
wide = three.pivot(index="month", columns="station", values="rain_mm")

ax = wide.plot(figsize=(8, 4), marker="o")
ax.set_ylabel("Rainfall (mm)")
ax.set_title("Monthly rainfall 2023 (sample data)")
ax.grid(alpha=0.3)
```

## A bar chart

Bars compare totals between categories. Sorting the bars makes the chart much easier to read:

```python
annual = r23.groupby("station")["rain_mm"].sum().sort_values()

ax = annual.plot.barh(figsize=(8, 5), color="#5483b3")
ax.set_xlabel("Annual rainfall 2023 (mm)")
ax.set_ylabel("")
ax.set_title("Annual rainfall by station (sample data)")
for i, v in enumerate(annual):
    ax.text(v + 40, i, f"{v:,.0f}", va="center", fontsize=8)
```

- `barh` draws horizontal bars, which leaves room for long station names.
- The loop writes each value at the end of its bar with `ax.text(x, y, text)`.

## A histogram

A histogram shows how values are **distributed**: how many months fall in each rainfall range.

```python
ax = r23["rain_mm"].plot.hist(bins=15, figsize=(7, 4), color="#64748b", edgecolor="white")
ax.set_xlabel("Monthly rainfall (mm)")
ax.set_ylabel("Number of station-months")
ax.set_title("Distribution of monthly rainfall, 2023")
```

Most months are dry (the tall bars on the left) and a few monsoon months are very wet: a strongly skewed distribution, typical for rainfall.

## A scatter plot

A scatter plot shows the relationship between two variables. Does elevation explain annual rainfall at these stations?

```python
stations = pd.read_csv("data/stations.csv")
df = r23.groupby("station", as_index=False)["rain_mm"].sum().merge(stations, on="station")

fig, ax = plt.subplots(figsize=(7, 4.5))
ax.scatter(df["elevation_m"], df["rain_mm"], s=60, color="#dc2626")
for _, row in df.iterrows():
    ax.annotate(row["station"].replace(" Airport", ""), (row["elevation_m"], row["rain_mm"]),
                fontsize=7, xytext=(4, 4), textcoords="offset points")
ax.set_xlabel("Elevation (m)")
ax.set_ylabel("Annual rainfall 2023 (mm)")
ax.set_title("Elevation vs rainfall")
ax.grid(alpha=0.3)
```

There is no simple pattern: in Nepal, a station's position relative to the mountains and the monsoon winds matters more than its height alone.

## Several charts in one figure

`plt.subplots(rows, cols)` makes a grid of charts, useful for a report page:

```python
fig, axes = plt.subplots(1, 2, figsize=(11, 4))

wide.plot(ax=axes[0], marker="o")
axes[0].set_title("Monthly rainfall")
axes[0].set_ylabel("mm")

season = r23.assign(monsoon=r23["month"].between(6, 9)).groupby("monsoon")["rain_mm"].sum()
axes[1].pie(season, labels=["Rest of year", "Monsoon (Jun–Sep)"], autopct="%1.0f%%", colors=["#cbd5e1", "#0047AB"])
axes[1].set_title("Share of 2023 rainfall")

fig.tight_layout()
```

`tight_layout()` adjusts the spacing so titles and labels do not overlap.

## Saving a figure

On your computer, save a chart for a report with `savefig`. Use a high `dpi` for print:

```python
fig.savefig("rainfall_summary.png", dpi=200, bbox_inches="tight")
print("Saved rainfall_summary.png")
```

## Good charts for engineering reports

| Do | Avoid |
|---|---|
| Label both axes with units | Unlabelled numbers |
| Start bar charts at zero | Cut-off bars that exaggerate differences |
| Sort bars by value | Random order |
| State the data source and period | Charts with no source |
| Use one colour per series, consistently | Rainbow colours with no meaning |

## Key points

- `fig, ax = plt.subplots()` then draw on `ax`; or use `df.plot(...)` for speed.
- Line = change over time; bar = compare categories; histogram = distribution; scatter = relationship.
- Label axes with units, add a title, and save with `fig.savefig(..., dpi=200)`.
