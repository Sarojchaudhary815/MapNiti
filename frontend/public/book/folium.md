A map image in a report is static. An **interactive web map** lets people zoom, switch basemaps and click features for details, and it opens in any browser with no GIS software. **Folium** builds such maps from Python: you add layers in Python, and Folium writes a Leaflet web map (an HTML file) for you.

> **Note:** Folium is not available in the browser runtime, so these cells are marked **Desktop**. Install it with `conda install -c conda-forge folium`, or use Google Colab or Jupyter, where the map appears right under the cell. At the end of this chapter there is a plain Leaflet version you can run here in the Code Lab.

## A first map

```python-desktop
import folium

m = folium.Map(location=[27.7172, 85.3240], zoom_start=12, tiles=None)
folium.TileLayer(
    tiles="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attr="Tiles © Esri", name="Street map",
).add_to(m)
m.save("first_map.html")
print("Saved first_map.html")
```

```output
Saved first_map.html
```

- `location` is **[latitude, longitude]**, the opposite order from GeoJSON.
- `tiles=None` and a `TileLayer` with an `attr` (attribution) lets you choose any basemap. Always credit the tile provider.
- `m.save(...)` writes a stand-alone HTML file. In Jupyter or Colab, just put `m` on the last line of a cell to see the map.

## Markers, popups and circles

```python-desktop
import pandas as pd

stations = pd.read_csv("data/stations.csv")
m = folium.Map(location=[28.3, 84.1], zoom_start=7)

for _, s in stations.iterrows():
    folium.Marker(
        location=[s["lat"], s["lon"]],
        tooltip=s["station"],
        popup=f"<b>{s['station']}</b><br>{s['district']}, {s['province']}<br>{s['elevation_m']} m",
    ).add_to(m)

folium.Circle([27.6966, 85.3591], radius=5000, color="red", fill=True, fill_opacity=0.15,
              popup="5 km around Kathmandu Airport").add_to(m)
m.save("stations_map.html")
print("Markers added:", len(stations))
```

```output
Markers added: 12
```

- A **tooltip** appears on hover; a **popup** opens on click and may contain HTML such as `<b>` and `<br>`.
- `folium.Circle` takes a radius in **metres**; `CircleMarker` uses screen pixels instead.

## GeoJSON layers and choropleths

Folium can show a GeoDataFrame directly. A **choropleth** colours polygons by a value:

```python-desktop
import geopandas as gpd

wards = gpd.read_file("data/demo_wards.geojson")
m = folium.Map(location=[27.481, 85.0], zoom_start=14)

folium.Choropleth(
    geo_data=wards, data=wards, columns=["ward", "population"],
    key_on="feature.properties.ward", fill_color="YlOrRd", fill_opacity=0.7,
    legend_name="Population",
).add_to(m)

folium.GeoJson(
    wards, name="Ward details",
    style_function=lambda f: {"color": "black", "weight": 1, "fillOpacity": 0},
    tooltip=folium.GeoJsonTooltip(fields=["ward", "population", "households"]),
).add_to(m)
m.save("wards_map.html")
print("Choropleth saved")
```

```output
Choropleth saved
```

- `key_on` tells Folium which GeoJSON property matches the `columns[0]` values (`ward`).
- The second, transparent `GeoJson` layer adds a hover tooltip with several fields.
- Folium needs coordinates in **WGS84 (EPSG:4326)**. Use `.to_crs(4326)` if your data is in UTM.

## Several basemaps and a layer switcher

```python-desktop
m = folium.Map(location=[27.481, 85.0], zoom_start=13, tiles=None)
folium.TileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
                 attr="Tiles © Esri", name="Street").add_to(m)
folium.TileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                 attr="Imagery © Esri", name="Satellite").add_to(m)

roads = gpd.read_file("data/demo_roads.geojson")
folium.GeoJson(roads, name="Roads", style_function=lambda f: {"color": "#f97316", "weight": 4},
               tooltip=folium.GeoJsonTooltip(fields=["name", "class"])).add_to(m)
folium.LayerControl(collapsed=False).add_to(m)
m.save("layers_map.html")
print("Layers:", [child.layer_name for child in m._children.values() if hasattr(child, "layer_name")])
```

```output
Layers: ['Street', 'Satellite', 'Roads']
```

## What Folium produces

Folium writes Leaflet JavaScript. The same kind of map in plain Leaflet is short, and you can run it right now in MapNiti's **Code Lab** (choose *HTML* and the example *First Leaflet map*), or copy this into a file called `map.html` and open it in a browser:

```text
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css">
  <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
  <style> html, body, #map { height: 100%; margin: 0; } </style>
</head>
<body>
<div id="map"></div>
<script>
  const map = L.map('map').setView([27.7172, 85.3240], 12);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
              { attribution: 'Tiles &copy; Esri' }).addTo(map);
  L.marker([27.6966, 85.3591]).addTo(map).bindPopup('<b>Kathmandu Airport</b>');
</script>
</body>
</html>
```

For bigger, styled web maps, continue with MapNiti's *Leaflet* and *MapLibre* courses.

## Key points

- `folium.Map(location=[lat, lon], zoom_start=…)`; add layers with `.add_to(m)`; `m.save("map.html")`.
- `Marker`, `Circle`, `GeoJson`, `Choropleth`, `LayerControl` cover most needs.
- Folium needs WGS84 data; set `attr` for every custom basemap.
- The result is a plain HTML file anyone can open.
