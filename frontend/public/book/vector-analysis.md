This chapter answers real planning questions for Demo Nagar with GeoPandas: Which ward is each school in? Which buildings lie within the river setback? How much of each ward is near a main road? Where is the nearest school for each ward? These are the same tools you would use in QGIS (*Join by location*, *Buffer*, *Intersection*, *Dissolve*), but written once and repeatable.

| Question | GeoPandas tool | QGIS equivalent |
|---|---|---|
| Which polygon is each point in? | `gpd.sjoin(points, polygons)` | Join attributes by location |
| Zone around a line or point | `.buffer(distance)` | Buffer |
| Area of overlap between layers | `gpd.overlay(a, b, how="intersection")` | Intersection |
| Merge features by an attribute | `.dissolve(by=...)` | Dissolve |
| Nearest feature and its distance | `gpd.sjoin_nearest(a, b)` | Join by nearest |

## Load the layers in a metric CRS

All analysis is done in UTM 45N, so buffers and areas are in metres:

```python
import geopandas as gpd
import pandas as pd

crs = "EPSG:32645"
wards = gpd.read_file("data/demo_wards.geojson").to_crs(crs)
roads = gpd.read_file("data/demo_roads.geojson").to_crs(crs)
river = gpd.read_file("data/demo_river.geojson").to_crs(crs)
schools = gpd.read_file("data/demo_schools.geojson").to_crs(crs)

for name, layer in [("wards", wards), ("roads", roads), ("river", river), ("schools", schools)]:
    print(f"{name:<8} {len(layer):>3} features  {layer.geom_type.iloc[0]}")
```

## 1. Spatial join: which ward is each school in?

`sjoin` copies the attributes of the polygon each point falls in:

```python
schools_w = gpd.sjoin(schools, wards[["ward", "geometry"]], how="left", predicate="within")
schools_w = schools_w.drop(columns="index_right")
schools_w[["school", "students", "ward"]].head(8)
```

- `predicate="within"` keeps the match when the school is inside the ward.
- `how="left"` keeps every school, even one outside all wards (its `ward` would be empty).

Now summarise per ward with ordinary pandas:

```python
per_ward = schools_w.groupby("ward").agg(schools=("school", "count"), students=("students", "sum"))
summary = wards[["ward", "population"]].merge(per_ward, on="ward", how="left").fillna(0)
summary["students_per_1000_people"] = (summary["students"] / summary["population"] * 1000).round(1)
summary
```

Wards with no school get 0 thanks to `fillna(0)`. A low *students per 1000 people* value may point to a ward that needs a new school.

## 2. Buffer: river setback zone

Many bylaws require a setback from rivers. We use 50 m here as an example value; check the rule that applies to your river and municipality.

```python
setback_m = 50
zone = gpd.GeoDataFrame(geometry=river.buffer(setback_m), crs=crs)

schools_w["in_setback"] = schools_w.within(zone.geometry.iloc[0])
print("Schools inside the river setback:", schools_w.loc[schools_w["in_setback"], "school"].tolist())
print(f"Setback zone area: {zone.area.iloc[0] / 1e4:.1f} ha")
```

## 3. Overlay: how much of each ward is in the setback?

`overlay(..., how="intersection")` cuts the wards by the zone and keeps the attributes of both:

```python
inside = gpd.overlay(wards, zone, how="intersection")
inside["setback_ha"] = (inside.area / 1e4).round(2)

result = wards[["ward"]].assign(ward_ha=(wards.area / 1e4).round(1)).merge(inside[["ward", "setback_ha"]], on="ward", how="left").fillna(0)
result["share_%"] = (result["setback_ha"] / result["ward_ha"] * 100).round(1)
result
```

## 4. Road access: area within 200 m of a main road

```python
main = roads[roads["class"].isin(["highway", "local"])]
access = gpd.GeoDataFrame(geometry=[main.buffer(200).unary_union], crs=crs)

served = gpd.overlay(wards, access, how="intersection")
served["served_ha"] = served.area / 1e4
cov = wards[["ward", "population"]].assign(ward_ha=wards.area / 1e4).merge(served[["ward", "served_ha"]], on="ward", how="left").fillna(0)
cov["served_%"] = (cov["served_ha"] / cov["ward_ha"] * 100).round(0)
cov[["ward", "population", "served_%"]]
```

`unary_union` merges the buffers of all roads into one shape first, so overlapping buffers are not counted twice.

## 5. Nearest school for each ward centre

`sjoin_nearest` finds the closest feature and can report the distance:

```python
centres = wards[["ward"]].copy()
centres["geometry"] = wards.centroid
centres = gpd.GeoDataFrame(centres, geometry="geometry", crs=crs)

nearest = gpd.sjoin_nearest(centres, schools[["school", "geometry"]], distance_col="distance_m")
nearest[["ward", "school", "distance_m"]].round(0)
```

## 6. Dissolve: merge wards into zones

Suppose wards 1–3 form the *South zone* and 4–6 the *North zone*. `dissolve` merges the polygons and sums the population:

```python
wards["zone"] = wards["ward"].map(lambda w: "South" if w <= 3 else "North")

# Browser note: dissolve() on a frame with a CRS fails in this browser build of PROJ,
# so we drop the CRS, dissolve, and set it back. On your computer, simply use:
#   zones = wards.dissolve(by="zone", aggfunc={"population": "sum"})
plain = gpd.GeoDataFrame(wards.drop(columns="geometry"), geometry=list(wards.geometry))
zones = plain.dissolve(by="zone", aggfunc={"population": "sum"}).set_crs(crs)
zones["area_km2"] = (zones.area / 1e6).round(2)
zones[["population", "area_km2"]]
```

## Put it on one map

```python
ax = wards.plot(column="zone", cmap="Pastel1", edgecolor="#475569", figsize=(10, 5.5))
zone.plot(ax=ax, color="#ef4444", alpha=0.25)
access.boundary.plot(ax=ax, color="#f59e0b", linestyle="--", linewidth=1)
river.plot(ax=ax, color="#0284c7", linewidth=3)
roads.plot(ax=ax, color="#334155", linewidth=1.5)
schools_w.plot(ax=ax, color=schools_w["in_setback"].map({True: "red", False: "black"}), markersize=35)
for _, w in wards.iterrows():
    c = w.geometry.centroid
    ax.annotate(f"W{w['ward']}", (c.x, c.y), ha="center", fontsize=10, weight="bold", color="#475569")
ax.set_title("Demo Nagar: river setback (red), 200 m road access (dashed), schools")
ax.set_axis_off()
```

## Save the results

```python
schools_w.to_file("analysis.gpkg", layer="schools_with_ward", driver="GPKG")
gpd.GeoDataFrame(result.merge(wards[["ward", "geometry"]], on="ward"), crs=crs).to_file("analysis.gpkg", layer="ward_setback", driver="GPKG")
print(gpd.read_file("analysis.gpkg", layer="ward_setback")[["ward", "share_%"]])
```

One GeoPackage now holds all result layers, ready to open in QGIS for a final map.

## Key points

- Reproject everything to one metric CRS before analysis.
- `sjoin` transfers attributes by location; `sjoin_nearest` finds the closest feature.
- `buffer` makes zones; `overlay` cuts layers and keeps both sets of attributes.
- `dissolve` merges features by an attribute; summarise with pandas `groupby` and `merge`.
