A list finds things by **position**. A **dictionary** finds things by **name**. That matches how we think about records: a station *has* a name, a district and an elevation. Dictionaries are also exactly how GeoJSON stores the attributes of a feature, so you will meet them everywhere in GIS.

## Creating a dictionary

A dictionary is written with curly braces. Each entry is a **key**, a colon, and a **value**:

```python
station = {
    "name": "Pokhara Airport",
    "district": "Kaski",
    "lat": 28.2009,
    "lon": 83.9821,
    "elevation_m": 827,
}

print(station)
print(station["name"])
print(station["elevation_m"], "m")
```

- The keys are `"name"`, `"district"` and so on. Keys are usually strings.
- `station["name"]` looks up the value for that key, like looking up a word in a dictionary.

## Adding, changing and removing entries

```python
station = {"name": "Jumla", "elevation_m": 2300}

station["province"] = "Karnali"     # add a new key
station["elevation_m"] = 2366       # change an existing value
print(station)

del station["province"]             # remove a key
print(station)
print("Number of keys:", len(station))
```

## Safe lookups with get()

Asking for a key that does not exist stops the program with a `KeyError`. When a key might be missing, use `get()` with a default value:

```python
station = {"name": "Simara", "elevation_m": 130}

print(station.get("district", "unknown"))
print(station.get("elevation_m", 0))
print("district" in station)        # check before using
```

## Looping over a dictionary

`items()` gives each key together with its value:

```python
annual_rain = {"Kathmandu": 1500, "Pokhara": 3900, "Biratnagar": 2000, "Jumla": 800}

for city, rain in annual_rain.items():
    print(f"{city:<12} {rain:>5} mm")

print("Cities:", list(annual_rain.keys()))
print("Wettest:", max(annual_rain, key=annual_rain.get))
```

- `{city:<12}` pads the name to 12 characters (left-aligned), `{rain:>5}` right-aligns the number, so the output forms neat columns.
- `max(annual_rain, key=annual_rain.get)` returns the **key** with the largest value.

## Counting with a dictionary

A dictionary is the classic way to count things, for example land-use classes in a list of parcels:

```python
land_use = ["Residential", "Agriculture", "Residential", "Forest",
            "Agriculture", "Residential", "Commercial"]

counts = {}
for use in land_use:
    counts[use] = counts.get(use, 0) + 1

print(counts)
```

For each item, `counts.get(use, 0)` returns the count so far (0 the first time), and we add 1.

## Nesting: dictionaries inside lists

Real datasets are usually a **list of dictionaries**: one dictionary per record. This is the shape of a table, of a JSON API response and of GeoJSON features.

```python
stations = [
    {"name": "Kathmandu Airport", "district": "Kathmandu", "elevation_m": 1337},
    {"name": "Pokhara Airport", "district": "Kaski", "elevation_m": 827},
    {"name": "Jumla", "district": "Jumla", "elevation_m": 2300},
]

for s in stations:
    print(f"{s['name']} ({s['district']}): {s['elevation_m']} m")

high = [s["name"] for s in stations if s["elevation_m"] > 1000]
print("Above 1000 m:", high)
```

Notice the single quotes inside the f-string: `s['name']`. Inside `f"..."` you must use the other kind of quote.

## GeoJSON is just dictionaries

A GeoJSON feature is a dictionary with a `type`, a `geometry` and `properties`:

```python
feature = {
    "type": "Feature",
    "geometry": {"type": "Point", "coordinates": [83.9821, 28.2009]},
    "properties": {"name": "Pokhara Airport", "elevation_m": 827},
}

lon, lat = feature["geometry"]["coordinates"]
props = feature["properties"]
print(f"{props['name']} is at lat {lat}, lon {lon}")
print("Geometry type:", feature["geometry"]["type"])
```

> **Remember:** GeoJSON coordinates are **[longitude, latitude]**, x before y. Swapping them puts Pokhara in the Indian Ocean.

## Dictionary comprehensions

Like list comprehensions, but they build a dictionary:

```python
elev_m = {"Kathmandu": 1337, "Pokhara": 827, "Jumla": 2300}

elev_ft = {city: round(m / 0.3048) for city, m in elev_m.items()}
print(elev_ft)

# Swap keys and values: look up a city by its elevation
by_elevation = {m: city for city, m in elev_m.items()}
print(by_elevation[827])
```

## Practice

> **Try it:** The dictionary below converts Nepali land units to square metres. Write code that converts a plot of *2 ropani 5 aana 3 paisa* to m², using the dictionary.

```python
units_m2 = {"ropani": 508.72, "aana": 31.80, "paisa": 7.95, "daam": 1.99}

plot = {"ropani": 2, "aana": 5, "paisa": 3}

area = sum(units_m2[unit] * count for unit, count in plot.items())
print(f"Area = {area:.2f} m²")
```

## Key points

- A dictionary maps **keys** to **values**: `{"name": "Jumla", "elevation_m": 2300}`.
- Read with `d[key]`, or `d.get(key, default)` when the key may be missing.
- Loop with `for key, value in d.items():`.
- A list of dictionaries is a table; GeoJSON features are dictionaries.
