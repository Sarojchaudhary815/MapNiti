A coordinate like `(85.324, 27.717)` means nothing until you know its **coordinate reference system** (CRS). The same place in Kathmandu can be written in degrees, in UTM metres or in Nepal's MUTM metres. Mixing them up is the most common GIS error of all. **pyproj** is the Python library that knows thousands of CRSs and converts between them.

## Two families of CRS

| Kind | Units | Example | Use for |
|---|---|---|---|
| **Geographic** | degrees | WGS84, `EPSG:4326` (GPS, GeoJSON, web maps) | Storing and exchanging locations |
| **Projected** | metres | UTM 44N `EPSG:32644`, UTM 45N `EPSG:32645` | Measuring distances, areas, buffers |

Nepal spans two UTM zones: **44N** west of 84° E and **45N** east of 84° E. Nepal's national system **MUTM** (Modified UTM, on the Everest 1830 datum) uses 3° zones with central meridians at 81°, 84° and 87° E.

## Looking up a CRS

```python
from pyproj import CRS

wgs84 = CRS.from_epsg(4326)
utm45 = CRS.from_epsg(32645)

print(wgs84.name, "| units:", wgs84.axis_info[0].unit_name)
print(utm45.name, "| units:", utm45.axis_info[0].unit_name)
print("Projected?", wgs84.is_projected, utm45.is_projected)
```

**EPSG codes** are short numbers that identify a CRS. Remember 4326 (WGS84) and 32644/32645 (UTM in Nepal).

## Converting coordinates with a Transformer

```python
from pyproj import Transformer

to_utm = Transformer.from_crs("EPSG:4326", "EPSG:32645", always_xy=True)

lon, lat = 85.3240, 27.7172          # Kathmandu
e, n = to_utm.transform(lon, lat)
print(f"UTM 45N: E = {e:.2f} m, N = {n:.2f} m")
```

> **Warning:** Always pass `always_xy=True`. Without it, pyproj follows the official axis order of EPSG:4326, which is **latitude first**, and your points end up in the wrong place.

Converting back works the same way:

```python
to_wgs = Transformer.from_crs("EPSG:32645", "EPSG:4326", always_xy=True)
lon2, lat2 = to_wgs.transform(e, n)
print(f"Back to degrees: {lat2:.6f} N, {lon2:.6f} E")
```

## Many points at once

`transform` also accepts lists, which is much faster than a loop:

```python
import pandas as pd

stations = pd.read_csv("data/stations.csv")
e, n = to_utm.transform(stations["lon"].values, stations["lat"].values)
stations["e_utm45"] = e.round(1)
stations["n_utm45"] = n.round(1)
stations[["station", "lon", "lat", "e_utm45", "n_utm45"]].head()
```

## Which UTM zone?

The zone number comes from the longitude: zone = floor((lon + 180) / 6) + 1.

```python
import math

def utm_epsg(lon, lat):
    zone = math.floor((lon + 180) / 6) + 1
    return (32600 if lat >= 0 else 32700) + zone

for _, s in stations.iterrows():
    print(f"{s['station']:<18} lon {s['lon']:7.3f} → EPSG:{utm_epsg(s['lon'], s['lat'])}")
```

For a project area that crosses 84° E, pick one zone for the whole project rather than splitting it.

## Nepal's MUTM

MUTM coordinates are used on Survey Department maps and cadastral data. pyproj can describe it from its parameters (a **PROJ string**). This example builds the zone with central meridian 84° E:

```python
mutm84 = CRS.from_proj4("+proj=tmerc +lat_0=0 +lon_0=84 +k=0.9999 +x_0=500000 +y_0=0 +a=6377276.345 +rf=300.8017 +units=m +no_defs")
print(mutm84.name)

to_mutm = Transformer.from_crs("EPSG:4326", mutm84, always_xy=True)
e_m, n_m = to_mutm.transform(83.9821, 28.2009)    # Pokhara
print(f"Pokhara in MUTM (CM 84°): E = {e_m:.1f}, N = {n_m:.1f}")
```

> **Warning:** This simple definition ignores the datum shift between Everest 1830 and WGS84, so results can be off by tens to a few hundred metres. For cadastral work, use the official transformation parameters published by the Survey Department of Nepal, or the CRS definitions in a recent QGIS.

## Distance on the ellipsoid

When you only have degrees, `pyproj.Geod` measures distances on the curved Earth directly, with no projection:

```python
from pyproj import Geod

geod = Geod(ellps="WGS84")
az12, az21, dist = geod.inv(85.3240, 27.7172, 83.9856, 28.2096)   # Kathmandu → Pokhara
print(f"Kathmandu → Pokhara: {dist / 1000:.1f} km, initial bearing {az12 % 360:.1f}°")
```

## Why projections matter: a test

Measure the same distance three ways and compare:

```python
import math

lon1, lat1, lon2, lat2 = 85.3240, 27.7172, 83.9856, 28.2096

naive = math.hypot(lon2 - lon1, lat2 - lat1)
print(f"Pythagoras on degrees: {naive:.4f} … degrees, not metres! Useless.")

e1, n1 = to_utm.transform(lon1, lat1)
e2, n2 = to_utm.transform(lon2, lat2)
print(f"In UTM 45N: {math.hypot(e2 - e1, n2 - n1) / 1000:.2f} km")

print(f"On the ellipsoid: {geod.inv(lon1, lat1, lon2, lat2)[2] / 1000:.2f} km")
```

The UTM and ellipsoid results agree closely. Pokhara lies in zone 44, outside zone 45, which is why there is a small difference.

## Key points

- Geographic CRS (degrees, EPSG:4326) for storing; projected CRS (metres, UTM 44N/45N) for measuring.
- `Transformer.from_crs(src, dst, always_xy=True).transform(x, y)` converts coordinates.
- Zone 44N west of 84° E, 45N east of it; MUTM uses central meridians 81°, 84°, 87°.
- `Geod.inv` measures true distances directly from degrees.
