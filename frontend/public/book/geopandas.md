**GeoPandas** combines the two previous parts: a pandas table where one column holds Shapely geometries, plus a CRS that says what the coordinates mean. This table is called a **GeoDataFrame**. Each row is a feature, exactly like a row in a QGIS attribute table, and you can filter, join and summarise it with everything you learned about pandas.

## Reading a vector file

```python
import geopandas as gpd

wards = gpd.read_file("data/demo_wards.geojson")
print(type(wards))
print("CRS:", wards.crs)
wards
```

`read_file` reads GeoJSON, GeoPackage, Shapefile, KML and many other formats. The `geometry` column holds a Shapely polygon for each ward.

## Inspecting the data

```python
print("Rows:", len(wards))
print("Geometry type:", wards.geom_type.unique())
print("Extent (minx, miny, maxx, maxy):", wards.total_bounds.round(4))
wards.drop(columns="geometry").describe()
```

## A quick map

```python
ax = wards.plot(edgecolor="black", color="#dbeafe", figsize=(7, 4))
for _, row in wards.iterrows():
    c = row.geometry.centroid
    ax.annotate(str(row["ward"]), xy=(c.x, c.y), ha="center", fontsize=11)
ax.set_title("Demo Nagar wards")
```

The loop writes each ward number at its polygon's centroid. `iterrows()` gives the rows one by one; `row.geometry` is that ward's Shapely polygon.

## Reprojecting before measuring

The file is in WGS84 degrees, so `.area` would be in "square degrees", which is meaningless. Convert to UTM 45N first with `to_crs`:

```python
wards_utm = wards.to_crs("EPSG:32645")
wards_utm["area_km2"] = (wards_utm.area / 1e6).round(3)
wards_utm["density"] = (wards_utm["population"] / wards_utm["area_km2"]).round(0)
wards_utm[["ward", "population", "area_km2", "density"]]
```

> **Remember:** Measure in a projected CRS: `.to_crs(...)` first, then `.area`, `.length`, `.distance()` or `.buffer()`.

## A choropleth map

A **choropleth** colours each polygon by a value. GeoPandas makes one in a single call:

```python
ax = wards_utm.plot(column="density", cmap="OrRd", legend=True, edgecolor="black", figsize=(8, 4),
                    legend_kwds={"label": "People per km²"})
ax.set_title("Population density, Demo Nagar")
ax.set_axis_off()
```

## Points from a table

Many datasets arrive as a table with latitude and longitude columns. `points_from_xy` turns them into point geometries:

```python
import pandas as pd

df = pd.read_csv("data/stations.csv")
stations = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df["lon"], df["lat"]), crs="EPSG:4326")
stations[["station", "province", "geometry"]].head()
```

Pass **longitude first** (x), then latitude (y), and say which CRS the numbers are in.

```python
ax = stations.plot(column="elevation_m", cmap="viridis", markersize=60, legend=True, figsize=(9, 4),
                   legend_kwds={"label": "Elevation (m)"})
for _, s in stations.iterrows():
    ax.annotate(s["station"].replace(" Airport", ""), (s.geometry.x, s.geometry.y), fontsize=7,
                xytext=(3, 3), textcoords="offset points")
ax.set_title("Practice stations")
```

## Filtering features

Filtering works exactly as in pandas:

```python
big = wards_utm[wards_utm["population"] > 9000]
print("Wards with more than 9,000 people:", big["ward"].tolist())

koshi = stations[stations["province"] == "Koshi"]
koshi[["station", "elevation_m"]]
```

## Working with the geometry column

Each geometry is a Shapely object, so all of Shapely's tools work, on the whole column at once:

```python
cent = wards_utm.copy()
cent["geometry"] = wards_utm.centroid
print(cent[["ward", "geometry"]].head(3))

town_centre = wards_utm.union_all().centroid if hasattr(wards_utm, "union_all") else wards_utm.unary_union.centroid
wards_utm["km_to_centre"] = (wards_utm.centroid.distance(town_centre) / 1000).round(2)
wards_utm[["ward", "km_to_centre"]]
```

`unary_union` (called `union_all()` in newer GeoPandas) merges all wards into one shape; its centroid is the town centre.

## Several layers on one map

Draw layers on the same `ax`, from the bottom layer up:

```python
roads = gpd.read_file("data/demo_roads.geojson").to_crs(32645)
river = gpd.read_file("data/demo_river.geojson").to_crs(32645)
schools = gpd.read_file("data/demo_schools.geojson").to_crs(32645)

ax = wards_utm.plot(color="#f1f5f9", edgecolor="#64748b", figsize=(9, 5))
river.plot(ax=ax, color="#0284c7", linewidth=3, label="River")
roads.plot(ax=ax, column="class", linewidth=1.8, legend=True, cmap="Dark2")
schools.plot(ax=ax, color="#dc2626", markersize=schools["students"] / 12, alpha=0.8)
ax.set_title("Demo Nagar: roads, river and schools (size = students)")
ax.set_axis_off()
```

## Saving

```python
wards_utm.to_file("wards_with_density.geojson", driver="GeoJSON")
wards_utm.to_file("demo_nagar.gpkg", layer="wards", driver="GPKG")
print(gpd.read_file("demo_nagar.gpkg", layer="wards")[["ward", "density"]].head(3))
```

**GeoPackage** (`.gpkg`) is the best general-purpose format: one file, many layers, no 10-character column-name limit like Shapefiles.

## Key points

- `gpd.read_file()` reads vector files into a GeoDataFrame (pandas + geometry + CRS).
- `.to_crs("EPSG:32645")` before `.area`, `.length`, `.distance()`.
- `.plot(column=...)` makes choropleths; layers share one `ax`.
- `points_from_xy(lon, lat)` turns tables into points.
- Save with `.to_file()`; prefer GeoPackage.
