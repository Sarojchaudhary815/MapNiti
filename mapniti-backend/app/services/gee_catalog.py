"""
GEE Data Hub
============
A curated catalog of Google Earth Engine datasets that engineers actually
reach for (terrain, land cover, rainfall, temperature, soil, water,
population, night lights, air quality, fire), plus a "custom asset" path so
any public GEE image / image collection can be fetched by its asset ID.

For every dataset the hub can:
  * render map tiles for an AOI              -> fetch_layer()
  * compute AOI statistics / class areas     -> fetch_layer()
  * build a monthly / yearly time series     -> fetch_timeseries()
  * give a GeoTIFF download link             -> fetch_layer()

Each catalog entry's `build(start, end)` returns a single-band ee.Image named
"value" (or a 3-band RGB image for true-colour entries), so every operation
below works the same way regardless of the source dataset.
"""
import logging
from datetime import date

import ee
from app.services.hydrology_engine import init_earth_engine, get_roi, worldpop_image, WORLDPOP_ASSET

logger = logging.getLogger("mapniti.gee_catalog")

TERRAIN = ["#006147", "#107a2f", "#e8d77d", "#a14300", "#9e0000", "#6e6e6e", "#ffffff"]
RAIN = ["#fffdcd", "#e1cd73", "#aaac20", "#5f920c", "#187328", "#144b2a", "#172313"]
HEAT = ["#040274", "#0502ce", "#0a8fff", "#30c8e2", "#86e26f", "#fff705", "#ffb613", "#ff6e08", "#de0101", "#910000"]
BLUES = ["#ffffff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"]
MAGMA = ["#000004", "#3b0f70", "#8c2981", "#de4968", "#fe9f6d", "#fcfdbf"]
SOIL = ["#fff7ec", "#fdd49e", "#fc8d59", "#d7301f", "#7f0000"]
GREENS = ["#f7fcf5", "#c7e9c0", "#74c476", "#238b45", "#00441b"]


def _last_year():
    y = date.today().year - 1
    return f"{y}-01-01", f"{y}-12-31"


def _recent(months=3):
    today = date.today()
    m = today.month - months
    y = today.year
    while m <= 0:
        m += 12
        y -= 1
    return f"{y}-{m:02d}-01", today.isoformat()


# --------------------------------------------------------------------------
# Builders — each returns ee.Image with band "value" (or RGB bands)
# --------------------------------------------------------------------------

def _s2_rgb(start, end):
    col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
           .filterDate(start, end)
           .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30)))
    return col.median().select(["B4", "B3", "B2"])


def _l9_rgb(start, end):
    col = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2").filterDate(start, end).filter(ee.Filter.lt("CLOUD_COVER", 30))
    return col.median().select(["SR_B4", "SR_B3", "SR_B2"]).multiply(0.0000275).add(-0.2)


def _slope(_s, _e):
    return ee.Terrain.slope(ee.Image("USGS/SRTMGL1_003")).rename("value")


def _hillshade(_s, _e):
    return ee.Terrain.hillshade(ee.Image("USGS/SRTMGL1_003")).rename("value")


def _aspect(_s, _e):
    return ee.Terrain.aspect(ee.Image("USGS/SRTMGL1_003")).rename("value")


def _dynamic_world(start, end):
    return (ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterDate(start, end)
            .select("label").mode().rename("value"))


def _worldpop(start, _e):
    return worldpop_image(int(start[:4])).rename("value")


def _hansen_loss(_s, _e):
    img = ee.Image("UMD/hansen/global_forest_change_2025_v1_13")
    return img.select("lossyear").selfMask().rename("value")


# --------------------------------------------------------------------------
# Catalog
# --------------------------------------------------------------------------
# kind: "continuous" | "categorical" | "rgb"
# collection/band/scale_factor/offset/reducer: used for time series
# (collection-backed, time-aware entries only)

CATALOG = {
    # ---------------- Elevation & terrain ----------------
    "srtm": {
        "name": "SRTM DEM 30m", "category": "Elevation & Terrain", "provider": "NASA / USGS",
        "asset": "USGS/SRTMGL1_003", "resolution": 30, "units": "m", "kind": "continuous",
        "desc": "Global elevation at 30 m. Standard base for contours, slope, watershed and cut/fill.",
        "build": lambda s, e: ee.Image("USGS/SRTMGL1_003").select("elevation").rename("value"),
        "vis": {"min": 0, "max": 6000, "palette": TERRAIN},
    },
    "copernicus_dem": {
        "name": "Copernicus GLO-30 DEM", "category": "Elevation & Terrain", "provider": "ESA",
        "asset": "COPERNICUS/DEM/GLO30_2024_1", "resolution": 30, "units": "m", "kind": "continuous",
        "desc": "Newer, more accurate 30 m DSM (TanDEM-X). Good choice for mountains.",
        "build": lambda s, e: ee.ImageCollection("COPERNICUS/DEM/GLO30_2024_1").select("DEM").mosaic().rename("value"),
        "vis": {"min": 0, "max": 6000, "palette": TERRAIN},
    },
    "alos_dsm": {
        "name": "ALOS AW3D30 DSM", "category": "Elevation & Terrain", "provider": "JAXA",
        "asset": "JAXA/ALOS/AW3D30/V4_1", "resolution": 30, "units": "m", "kind": "continuous",
        "desc": "ALOS World 3D surface model — strong in steep Himalayan terrain.",
        "build": lambda s, e: ee.ImageCollection("JAXA/ALOS/AW3D30/V4_1").select("DSM").mosaic().rename("value"),
        "vis": {"min": 0, "max": 6000, "palette": TERRAIN},
    },
    "slope": {
        "name": "Slope (degrees)", "category": "Elevation & Terrain", "provider": "Derived from SRTM",
        "asset": "USGS/SRTMGL1_003", "resolution": 30, "units": "°", "kind": "continuous",
        "desc": "Terrain slope — road alignment, landslide screening, site grading.",
        "build": _slope, "vis": {"min": 0, "max": 60, "palette": ["#1a9850", "#91cf60", "#fee08b", "#fc8d59", "#d73027"]},
    },
    "aspect": {
        "name": "Aspect (degrees)", "category": "Elevation & Terrain", "provider": "Derived from SRTM",
        "asset": "USGS/SRTMGL1_003", "resolution": 30, "units": "°", "kind": "continuous",
        "desc": "Slope facing direction (0°=N). Solar siting, snow melt, microclimate.",
        "build": _aspect, "vis": {"min": 0, "max": 360, "palette": ["#e41a1c", "#ffff33", "#4daf4a", "#377eb8", "#e41a1c"]},
    },
    "hillshade": {
        "name": "Hillshade", "category": "Elevation & Terrain", "provider": "Derived from SRTM",
        "asset": "USGS/SRTMGL1_003", "resolution": 30, "units": "", "kind": "continuous",
        "desc": "Shaded relief for cartographic backdrops.",
        "build": _hillshade, "vis": {"min": 0, "max": 255, "palette": ["#000000", "#ffffff"]},
    },

    # ---------------- Land cover ----------------
    "esa_worldcover": {
        "name": "ESA WorldCover 10m (2021)", "category": "Land Cover", "provider": "ESA",
        "asset": "ESA/WorldCover/v200", "resolution": 10, "units": "class", "kind": "categorical",
        "desc": "10 m global land cover, 11 classes. Best free LULC baseline.",
        "build": lambda s, e: ee.ImageCollection("ESA/WorldCover/v200").first().select("Map").rename("value"),
        "classes": {
            10: ("Tree cover", "#006400"), 20: ("Shrubland", "#ffbb22"), 30: ("Grassland", "#ffff4c"),
            40: ("Cropland", "#f096ff"), 50: ("Built-up", "#fa0000"), 60: ("Bare / sparse", "#b4b4b4"),
            70: ("Snow & ice", "#f0f0f0"), 80: ("Water", "#0064c8"), 90: ("Herbaceous wetland", "#0096a0"),
            95: ("Mangroves", "#00cf75"), 100: ("Moss & lichen", "#fae6a0"),
        },
    },
    "dynamic_world": {
        "name": "Dynamic World (near real-time)", "category": "Land Cover", "provider": "Google / WRI",
        "asset": "GOOGLE/DYNAMICWORLD/V1", "resolution": 10, "units": "class", "kind": "categorical", "time_aware": True,
        "desc": "10 m land cover for ANY date range (from Sentinel-2). Track change over time.",
        "build": _dynamic_world,
        "classes": {
            0: ("Water", "#419bdf"), 1: ("Trees", "#397d49"), 2: ("Grass", "#88b053"), 3: ("Flooded vegetation", "#7a87c6"),
            4: ("Crops", "#e49635"), 5: ("Shrub & scrub", "#dfc35a"), 6: ("Built", "#c4281b"),
            7: ("Bare", "#a59b8f"), 8: ("Snow & ice", "#b39fe1"),
        },
    },

    # ---------------- Imagery ----------------
    "s2_rgb": {
        "name": "Sentinel-2 True Colour", "category": "Satellite Imagery", "provider": "ESA Copernicus",
        "asset": "COPERNICUS/S2_SR_HARMONIZED", "resolution": 10, "units": "", "kind": "rgb", "time_aware": True,
        "desc": "10 m cloud-filtered median composite for your dates.",
        "build": _s2_rgb, "vis": {"min": 0, "max": 3000},
    },
    "l9_rgb": {
        "name": "Landsat 9 True Colour", "category": "Satellite Imagery", "provider": "USGS / NASA",
        "asset": "LANDSAT/LC09/C02/T1_L2", "resolution": 30, "units": "", "kind": "rgb", "time_aware": True,
        "desc": "30 m surface reflectance composite.",
        "build": _l9_rgb, "vis": {"min": 0, "max": 0.3},
    },
    "s1_vv": {
        "name": "Sentinel-1 SAR (VV)", "category": "Satellite Imagery", "provider": "ESA Copernicus",
        "asset": "COPERNICUS/S1_GRD", "resolution": 10, "units": "dB", "kind": "continuous", "time_aware": True,
        "desc": "Radar backscatter — sees through clouds. Flood & water mapping in monsoon.",
        "build": lambda s, e: (ee.ImageCollection("COPERNICUS/S1_GRD").filterDate(s, e)
                               .filter(ee.Filter.eq("instrumentMode", "IW"))
                               .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
                               .select("VV").median().rename("value")),
        "vis": {"min": -25, "max": 0, "palette": ["#000000", "#ffffff"]},
        "collection": "COPERNICUS/S1_GRD", "band": "VV", "reducer": "mean",
    },

    # ---------------- Vegetation ----------------
    "modis_ndvi": {
        "name": "MODIS NDVI 250m", "category": "Vegetation", "provider": "NASA",
        "asset": "MODIS/061/MOD13Q1", "resolution": 250, "units": "NDVI", "kind": "continuous", "time_aware": True,
        "desc": "16-day vegetation index since 2000 — crop seasons, drought, greening trends.",
        "build": lambda s, e: ee.ImageCollection("MODIS/061/MOD13Q1").filterDate(s, e).select("NDVI").mean().multiply(0.0001).rename("value"),
        "vis": {"min": 0, "max": 0.9, "palette": ["#ce7e45", "#df923d", "#f1b555", "#fcd163", "#99b718", "#74a901", "#529400", "#3e8601", "#207401", "#056201", "#004c00"]},
        "collection": "MODIS/061/MOD13Q1", "band": "NDVI", "scale_factor": 0.0001, "reducer": "mean",
    },
    "forest_loss": {
        "name": "Forest Loss Year (Hansen)", "category": "Vegetation", "provider": "Univ. of Maryland",
        "asset": "UMD/hansen/global_forest_change_2025_v1_13", "resolution": 30, "units": "year (2000+)", "kind": "continuous",
        "desc": "Where and when forest was lost, 2001–2025.",
        "build": _hansen_loss, "vis": {"min": 1, "max": 25, "palette": ["#ffff00", "#ff0000"]},
    },
    "tree_cover": {
        "name": "Tree Canopy Cover 2000", "category": "Vegetation", "provider": "Univ. of Maryland",
        "asset": "UMD/hansen/global_forest_change_2025_v1_13", "resolution": 30, "units": "%", "kind": "continuous",
        "desc": "Percent tree canopy per 30 m pixel (baseline year 2000).",
        "build": lambda s, e: ee.Image("UMD/hansen/global_forest_change_2025_v1_13").select("treecover2000").rename("value"),
        "vis": {"min": 0, "max": 100, "palette": GREENS},
    },

    # ---------------- Climate & weather ----------------
    "chirps_rain": {
        "name": "CHIRPS Rainfall (total)", "category": "Climate & Weather", "provider": "UCSB / CHG",
        "asset": "UCSB-CHG/CHIRPS/DAILY", "resolution": 5566, "units": "mm", "kind": "continuous", "time_aware": True,
        "desc": "Daily rainfall since 1981. Total over your dates — design storms, runoff, irrigation.",
        "build": lambda s, e: ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate(s, e).select("precipitation").sum().rename("value"),
        "vis": {"min": 0, "max": 3000, "palette": RAIN},
        "collection": "UCSB-CHG/CHIRPS/DAILY", "band": "precipitation", "reducer": "sum",
    },
    "chirps_max": {
        "name": "CHIRPS Max 1-day Rainfall", "category": "Climate & Weather", "provider": "UCSB / CHG",
        "asset": "UCSB-CHG/CHIRPS/DAILY", "resolution": 5566, "units": "mm/day", "kind": "continuous", "time_aware": True,
        "desc": "Heaviest single-day rain in your dates — input for drainage & culvert design.",
        "build": lambda s, e: ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterDate(s, e).select("precipitation").max().rename("value"),
        "vis": {"min": 0, "max": 250, "palette": RAIN},
        "collection": "UCSB-CHG/CHIRPS/DAILY", "band": "precipitation", "reducer": "max",
    },
    "era5_temp": {
        "name": "ERA5-Land Air Temperature", "category": "Climate & Weather", "provider": "ECMWF",
        "asset": "ECMWF/ERA5_LAND/MONTHLY_AGGR", "resolution": 11132, "units": "°C", "kind": "continuous", "time_aware": True,
        "desc": "Monthly 2 m air temperature since 1950.",
        "build": lambda s, e: ee.ImageCollection("ECMWF/ERA5_LAND/MONTHLY_AGGR").filterDate(s, e).select("temperature_2m").mean().subtract(273.15).rename("value"),
        "vis": {"min": -20, "max": 35, "palette": HEAT},
        "collection": "ECMWF/ERA5_LAND/MONTHLY_AGGR", "band": "temperature_2m", "offset": -273.15, "reducer": "mean",
    },
    "modis_lst": {
        "name": "MODIS Land Surface Temp (day)", "category": "Climate & Weather", "provider": "NASA",
        "asset": "MODIS/061/MOD11A2", "resolution": 1000, "units": "°C", "kind": "continuous", "time_aware": True,
        "desc": "8-day land surface temperature — urban heat islands, pavement design.",
        "build": lambda s, e: ee.ImageCollection("MODIS/061/MOD11A2").filterDate(s, e).select("LST_Day_1km").mean().multiply(0.02).subtract(273.15).rename("value"),
        "vis": {"min": -10, "max": 45, "palette": HEAT},
        "collection": "MODIS/061/MOD11A2", "band": "LST_Day_1km", "scale_factor": 0.02, "offset": -273.15, "reducer": "mean",
    },
    "snow_cover": {
        "name": "MODIS Snow Cover", "category": "Climate & Weather", "provider": "NASA",
        "asset": "MODIS/061/MOD10A1", "resolution": 500, "units": "% (NDSI)", "kind": "continuous", "time_aware": True,
        "desc": "Daily snow cover — Himalayan snowline, hydropower inflow.",
        "build": lambda s, e: ee.ImageCollection("MODIS/061/MOD10A1").filterDate(s, e).select("NDSI_Snow_Cover").mean().rename("value"),
        "vis": {"min": 0, "max": 100, "palette": ["#000000", "#0dffff", "#0524ff", "#ffffff"]},
        "collection": "MODIS/061/MOD10A1", "band": "NDSI_Snow_Cover", "reducer": "mean",
    },

    # ---------------- Water ----------------
    "surface_water": {
        "name": "Surface Water Occurrence", "category": "Water", "provider": "EC JRC / Google",
        "asset": "JRC/GSW1_4/GlobalSurfaceWater", "resolution": 30, "units": "%", "kind": "continuous",
        "desc": "How often each pixel was water (1984–2021). River shifts, floodplain limits.",
        "build": lambda s, e: ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence").rename("value"),
        "vis": {"min": 0, "max": 100, "palette": BLUES},
    },

    # ---------------- Soil ----------------
    "soil_clay": {
        "name": "Soil Clay Content (surface)", "category": "Soil", "provider": "OpenLandMap",
        "asset": "OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02", "resolution": 250, "units": "%", "kind": "continuous",
        "desc": "Clay % at 0 cm. >35% clay → check for expansive / weak subgrade.",
        "build": lambda s, e: ee.Image("OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02").select("b0").rename("value"),
        "vis": {"min": 0, "max": 60, "palette": SOIL},
    },
    "soil_sand": {
        "name": "Soil Sand Content (surface)", "category": "Soil", "provider": "OpenLandMap",
        "asset": "OpenLandMap/SOL/SOL_SAND-WFRACTION_USDA-3A1A1A_M/v02", "resolution": 250, "units": "%", "kind": "continuous",
        "desc": "Sand % at 0 cm — drainage, infiltration, foundation screening.",
        "build": lambda s, e: ee.Image("OpenLandMap/SOL/SOL_SAND-WFRACTION_USDA-3A1A1A_M/v02").select("b0").rename("value"),
        "vis": {"min": 0, "max": 90, "palette": ["#f7fcb9", "#d9f0a3", "#addd8e", "#fed976", "#fd8d3c"]},
    },
    "soil_ph": {
        "name": "Soil pH (surface)", "category": "Soil", "provider": "OpenLandMap",
        "asset": "OpenLandMap/SOL/SOL_PH-H2O_USDA-4C1A2A_M/v02", "resolution": 250, "units": "pH", "kind": "continuous",
        "desc": "Soil pH in water. Stored as pH×10, converted here.",
        "build": lambda s, e: ee.Image("OpenLandMap/SOL/SOL_PH-H2O_USDA-4C1A2A_M/v02").select("b0").divide(10).rename("value"),
        "vis": {"min": 4, "max": 9, "palette": ["#ff0000", "#ffff00", "#00ff00", "#0000ff"]},
    },
    "soil_carbon": {
        "name": "Soil Organic Carbon", "category": "Soil", "provider": "OpenLandMap",
        "asset": "OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02", "resolution": 250, "units": "g/kg ×5", "kind": "continuous",
        "desc": "Organic carbon at surface — agriculture & carbon studies.",
        "build": lambda s, e: ee.Image("OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02").select("b0").rename("value"),
        "vis": {"min": 0, "max": 120, "palette": ["#ffffa0", "#c9a36b", "#7b4a1b", "#2e1a05"]},
    },
    "soil_texture": {
        "name": "USDA Soil Texture Class", "category": "Soil", "provider": "OpenLandMap",
        "asset": "OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02", "resolution": 250, "units": "class", "kind": "categorical",
        "desc": "USDA texture triangle class at 0 cm.",
        "build": lambda s, e: ee.Image("OpenLandMap/SOL/SOL_TEXTURE-CLASS_USDA-TT_M/v02").select("b0").rename("value"),
        "classes": {
            1: ("Clay", "#d5c36b"), 2: ("Silty clay", "#b96947"), 3: ("Sandy clay", "#9d3706"), 4: ("Clay loam", "#ae868f"),
            5: ("Silty clay loam", "#f86714"), 6: ("Sandy clay loam", "#46d143"), 7: ("Loam", "#368f20"),
            8: ("Silty loam", "#3e5a14"), 9: ("Sandy loam", "#ffd557"), 10: ("Silt", "#fff72e"),
            11: ("Loamy sand", "#ff5a9d"), 12: ("Sand", "#ff005b"),
        },
    },

    # ---------------- People & infrastructure ----------------
    "worldpop": {
        "name": "Population (WorldPop 100m)", "category": "People & Infrastructure", "provider": "WorldPop",
        "asset": WORLDPOP_ASSET, "resolution": 100, "units": "people / pixel", "kind": "continuous", "time_aware": True,
        "desc": "Modelled people per ~100 m cell, WorldPop R2025A, 2015–2030 (uses the start-date year; years after 2021 are projections). A model estimate — can differ from census counts.",
        "build": _worldpop, "vis": {"min": 0, "max": 50, "palette": ["#ffffcc", "#fed976", "#fd8d3c", "#e31a1c", "#800026"]},
    },
    "built_surface": {
        "name": "Built-up Surface (GHSL 2020)", "category": "People & Infrastructure", "provider": "EC JRC",
        "asset": "JRC/GHSL/P2023A/GHS_BUILT_S/2020", "resolution": 100, "units": "m² / cell", "kind": "continuous",
        "desc": "Built-up area per 100 m cell — urban expansion and density.",
        "build": lambda s, e: ee.Image("JRC/GHSL/P2023A/GHS_BUILT_S/2020").select("built_surface").rename("value"),
        "vis": {"min": 0, "max": 8000, "palette": ["#000000", "#400000", "#a00000", "#ff0000", "#ffff00"]},
    },
    "night_lights": {
        "name": "Night Lights (VIIRS)", "category": "People & Infrastructure", "provider": "NOAA",
        "asset": "NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG", "resolution": 463, "units": "nW/cm²/sr", "kind": "continuous", "time_aware": True,
        "desc": "Monthly night-time radiance — electrification & economic activity.",
        "build": lambda s, e: ee.ImageCollection("NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG").filterDate(s, e).select("avg_rad").mean().rename("value"),
        "vis": {"min": 0, "max": 40, "palette": MAGMA},
        "collection": "NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG", "band": "avg_rad", "reducer": "mean",
    },

    # ---------------- Air quality & hazards ----------------
    "no2": {
        "name": "NO₂ Air Pollution (Sentinel-5P)", "category": "Air Quality & Hazards", "provider": "ESA Copernicus",
        "asset": "COPERNICUS/S5P/OFFL/L3_NO2", "resolution": 1113, "units": "µmol/m²", "kind": "continuous", "time_aware": True,
        "desc": "Tropospheric NO₂ — traffic & industrial pollution hotspots.",
        "build": lambda s, e: ee.ImageCollection("COPERNICUS/S5P/OFFL/L3_NO2").filterDate(s, e).select("tropospheric_NO2_column_number_density").mean().multiply(1e6).rename("value"),
        "vis": {"min": 0, "max": 200, "palette": ["#000000", "#0000ff", "#800080", "#00ffff", "#008000", "#ffff00", "#ff0000"]},
        "collection": "COPERNICUS/S5P/OFFL/L3_NO2", "band": "tropospheric_NO2_column_number_density", "scale_factor": 1e6, "reducer": "mean",
    },
    "burned_area": {
        "name": "Burned Area (MODIS)", "category": "Air Quality & Hazards", "provider": "NASA",
        "asset": "MODIS/061/MCD64A1", "resolution": 500, "units": "day of year", "kind": "continuous", "time_aware": True,
        "desc": "Monthly burned-area product — forest fire extent.",
        "build": lambda s, e: ee.ImageCollection("MODIS/061/MCD64A1").filterDate(s, e).select("BurnDate").max().rename("value"),
        "vis": {"min": 1, "max": 366, "palette": ["#ffff00", "#ff8000", "#ff0000"]},
    },
    "fires": {
        "name": "Active Fires (FIRMS)", "category": "Air Quality & Hazards", "provider": "NASA",
        "asset": "FIRMS", "resolution": 1000, "units": "K (brightness)", "kind": "continuous", "time_aware": True,
        "desc": "Fire hotspots detected by MODIS — wildfire monitoring.",
        "build": lambda s, e: ee.ImageCollection("FIRMS").filterDate(s, e).select("T21").max().rename("value"),
        "vis": {"min": 325, "max": 400, "palette": ["#ff0000", "#ff8800", "#ffff00"]},
    },
}


# Default date windows so the UI can prefill sensible ranges per dataset.
def _default_dates(key):
    if key in ("s2_rgb", "l9_rgb", "s1_vv", "dynamic_world", "no2", "fires"):
        return _recent(3)
    if key == "worldpop":
        return "2025-01-01", "2025-12-31"
    return _last_year()


def list_catalog():
    items = []
    for key, d in CATALOG.items():
        start, end = _default_dates(key)
        items.append({
            "id": key,
            "name": d["name"],
            "category": d["category"],
            "provider": d["provider"],
            "asset": d["asset"],
            "resolution_m": d["resolution"],
            "units": d["units"],
            "kind": d["kind"],
            "description": d["desc"],
            "time_aware": bool(d.get("time_aware")),
            "timeseries": bool(d.get("collection")),
            "default_start": start,
            "default_end": end,
            "legend": _legend(d),
            "code_snippet": _code_snippet(key, d),
        })
    return {"status": "success", "datasets": items}


def _legend(d):
    if d["kind"] == "categorical":
        return {"type": "classes", "items": [{"value": k, "label": v[0], "color": v[1]} for k, v in d["classes"].items()]}
    if d["kind"] == "continuous":
        v = d["vis"]
        return {"type": "gradient", "min": v["min"], "max": v["max"], "palette": v["palette"], "units": d["units"]}
    return None


_SINGLE_IMAGE_ASSETS = {
    "USGS/SRTMGL1_003", "JRC/GSW1_4/GlobalSurfaceWater",
    "UMD/hansen/global_forest_change_2025_v1_13", "JRC/GHSL/P2023A/GHS_BUILT_S/2020",
}


def _code_snippet(key, d):
    """Python (earthengine-api) snippet so engineers can reproduce the layer
    in their own notebooks / scripts."""
    asset = d["asset"]
    if asset in _SINGLE_IMAGE_ASSETS or asset.startswith("OpenLandMap/"):
        load = f"img = ee.Image('{asset}')"
    elif d.get("time_aware"):
        load = (f"img = (ee.ImageCollection('{asset}')\n"
                "       .filterDate('2024-01-01', '2024-12-31')\n"
                "       .filterBounds(aoi)\n"
                "       .median())")
    else:
        load = f"img = ee.ImageCollection('{asset}').mosaic()"
    return (
        "import ee\n"
        "ee.Initialize(project='YOUR-GEE-PROJECT')\n\n"
        "aoi = ee.Geometry.Rectangle([85.25, 27.65, 85.40, 27.75])  # Kathmandu example\n"
        f"# {d['name']}\n"
        f"{load}\n"
        f"stats = img.reduceRegion(ee.Reducer.mean(), aoi, scale={d['resolution']}, bestEffort=True)\n"
        "print(stats.getInfo())\n"
    )


# --------------------------------------------------------------------------
# Operations
# --------------------------------------------------------------------------

def _download_url(image, roi, scale):
    try:
        return image.getDownloadURL({"region": roi, "scale": max(scale, 10), "format": "GEO_TIFF", "crs": "EPSG:4326"})
    except Exception:
        # Common for big AOIs (>32 MB request limit) — the map layer still works.
        logger.info("GeoTIFF download URL unavailable (area likely too large).")
        return None


def _categorical_vis(classes):
    keys = sorted(classes.keys())
    # remap arbitrary class codes to 0..n-1 so a simple palette lines up
    return keys, [classes[k][1] for k in keys]


def fetch_layer(data: dict) -> dict:
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "Draw or upload an Area of Interest first."}

    key = data.get("dataset_id")
    d = CATALOG.get(key)
    if not d:
        return {"status": "error", "message": f"Unknown dataset '{key}'."}

    default_start, default_end = _default_dates(key)
    start = data.get("start_date") or default_start
    end = data.get("end_date") or default_end
    scale = d["resolution"]

    try:
        image = d["build"](start, end).clip(roi)
        area_km2 = roi.area(maxError=10).divide(1e6).getInfo()

        if d["kind"] == "rgb":
            map_id = image.getMapId(d["vis"])
            stats = {"area_km2": round(area_km2, 3)}
        elif d["kind"] == "categorical":
            keys, palette = _categorical_vis(d["classes"])
            display = image.remap(keys, list(range(len(keys))))
            map_id = display.getMapId({"min": 0, "max": len(keys) - 1, "palette": palette})
            stats = {"area_km2": round(area_km2, 3), "classes": _class_areas(image, d["classes"], roi, scale)}
        else:
            vis = dict(d["vis"])
            if data.get("vis_min") is not None and data.get("vis_max") is not None:
                vis["min"], vis["max"] = float(data["vis_min"]), float(data["vis_max"])
            map_id = image.getMapId(vis)
            stats = {"area_km2": round(area_km2, 3), **_continuous_stats(image, roi, scale, key)}

        if not map_id:
            return {"status": "error", "message": "No data for this area / date range."}

        return {
            "status": "success",
            "dataset_id": key,
            "layers": [{
                "layerId": f"hub-{key}",
                "name": d["name"],
                "visual_url": map_id["tile_fetcher"].url_format,
                "download_url": _download_url(image, roi, scale),
            }],
            "stats": stats,
            "units": d["units"],
            "start_date": start,
            "end_date": end,
            "legend": _legend(d),
        }
    except ee.EEException as exc:
        logger.warning("fetch_layer(%s) EE error: %s", key, exc)
        return {"status": "error", "message": f"Earth Engine: {exc}"}
    except Exception as exc:
        logger.exception("fetch_layer failed")
        return {"status": "error", "message": str(exc)}


def _continuous_stats(image, roi, scale, key):
    reducer = (ee.Reducer.mean()
               .combine(ee.Reducer.minMax(), sharedInputs=True)
               .combine(ee.Reducer.stdDev(), sharedInputs=True)
               .combine(ee.Reducer.percentile([10, 50, 90]), sharedInputs=True))
    result = image.reduceRegion(reducer=reducer, geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True).getInfo() or {}
    out = {}
    for src, dst in (("value_mean", "mean"), ("value_min", "min"), ("value_max", "max"), ("value_stdDev", "std"),
                     ("value_p10", "p10"), ("value_p50", "median"), ("value_p90", "p90")):
        v = result.get(src)
        out[dst] = round(v, 3) if isinstance(v, (int, float)) else None
    if key == "worldpop":
        # native 3-arc-second grid; a coarser scale undercounts the sum
        total = image.reduceRegion(ee.Reducer.sum(), roi, 92.77, maxPixels=1e10, bestEffort=True).get("value").getInfo()
        out["total_population"] = int(round(total or 0))
    return out


def _class_areas(image, classes, roi, scale):
    area = ee.Image.pixelArea().divide(1e6).addBands(image.rename("class"))
    grouped = area.reduceRegion(
        reducer=ee.Reducer.sum().group(groupField=1, groupName="class"),
        geometry=roi, scale=scale, maxPixels=1e10, bestEffort=True,
    ).get("groups").getInfo() or []
    total = sum(g["sum"] for g in grouped) or 1
    rows = []
    for g in grouped:
        cls = int(g["class"])
        label, color = classes.get(cls, (f"Class {cls}", "#999999"))
        rows.append({"class": cls, "label": label, "color": color,
                     "area_km2": round(g["sum"], 3), "percent": round(100 * g["sum"] / total, 2)})
    return sorted(rows, key=lambda r: -r["area_km2"])


def fetch_timeseries(data: dict) -> dict:
    """Monthly or yearly series of the AOI-average value — trend analysis."""
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "Draw or upload an Area of Interest first."}

    key = data.get("dataset_id")
    d = CATALOG.get(key)
    if not d or not d.get("collection"):
        return {"status": "error", "message": "Time series is available only for time-based datasets (rainfall, NDVI, temperature, ...)."}

    start = data.get("start_date") or _default_dates(key)[0]
    end = data.get("end_date") or _default_dates(key)[1]
    interval = data.get("interval", "month")
    if interval not in ("month", "year"):
        interval = "month"

    try:
        col = ee.ImageCollection(d["collection"]).filterDate(start, end).filterBounds(roi).select(d["band"])
        if key == "s1_vv":
            col = col.filter(ee.Filter.eq("instrumentMode", "IW"))
        reducer_name = d.get("reducer", "mean")
        scale_factor = d.get("scale_factor", 1)
        offset = d.get("offset", 0)

        start_ee = ee.Date(start)
        n = ee.Date(end).difference(start_ee, interval).ceil()

        def per_period(i):
            t0 = start_ee.advance(ee.Number(i), interval)
            t1 = t0.advance(1, interval)
            sub = col.filterDate(t0, t1)
            img = ee.Algorithms.If(
                sub.size().gt(0),
                (sub.sum() if reducer_name == "sum" else sub.max() if reducer_name == "max" else sub.mean()),
                ee.Image.constant(0).updateMask(0).rename(d["band"]),
            )
            val = ee.Image(img).multiply(scale_factor).add(offset).reduceRegion(
                reducer=ee.Reducer.mean(), geometry=roi, scale=max(d["resolution"], 250),
                maxPixels=1e9, bestEffort=True,
            ).get(d["band"])
            return ee.Feature(None, {"date": t0.format("YYYY-MM"), "value": val, "n": sub.size()})

        feats = ee.FeatureCollection(ee.List.sequence(0, n.subtract(1)).map(per_period)).getInfo()["features"]
        series = []
        for f in feats:
            p = f["properties"]
            v = p.get("value")
            series.append({"date": p["date"], "value": round(v, 3) if isinstance(v, (int, float)) else None, "images": p.get("n", 0)})

        vals = [s["value"] for s in series if s["value"] is not None]
        summary = None
        if vals:
            summary = {
                "mean": round(sum(vals) / len(vals), 3), "min": min(vals), "max": max(vals),
                "trend_per_step": _linear_trend(vals),
            }
        return {"status": "success", "dataset_id": key, "interval": interval, "units": d["units"],
                "aggregation": reducer_name, "series": series, "summary": summary}
    except ee.EEException as exc:
        return {"status": "error", "message": f"Earth Engine: {exc}"}
    except Exception as exc:
        logger.exception("fetch_timeseries failed")
        return {"status": "error", "message": str(exc)}


def _linear_trend(vals):
    n = len(vals)
    if n < 3:
        return None
    xs = range(n)
    mx, my = (n - 1) / 2, sum(vals) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, vals))
    den = sum((x - mx) ** 2 for x in xs)
    return round(num / den, 4) if den else None


def fetch_custom(data: dict) -> dict:
    """Any public GEE asset — Image or ImageCollection — by asset ID."""
    init_earth_engine()
    roi = get_roi(data)
    if not roi:
        return {"status": "error", "message": "Draw or upload an Area of Interest first."}

    asset_id = (data.get("asset_id") or "").strip()
    band = (data.get("band") or "").strip()
    if not asset_id:
        return {"status": "error", "message": "Enter a GEE asset ID, e.g. 'USGS/SRTMGL1_003'."}

    try:
        info = ee.data.getAsset(asset_id)
        asset_type = info.get("type")
        if asset_type == "IMAGE":
            image = ee.Image(asset_id)
        elif asset_type == "IMAGE_COLLECTION":
            col = ee.ImageCollection(asset_id).filterBounds(roi)
            if data.get("start_date") and data.get("end_date"):
                col = col.filterDate(data["start_date"], data["end_date"])
            if col.size().getInfo() == 0:
                return {"status": "error", "message": "No images in that collection for this area / date range."}
            reducer = data.get("reducer", "median")
            image = {"mean": col.mean(), "max": col.max(), "min": col.min(), "sum": col.sum(), "mosaic": col.mosaic()}.get(reducer, col.median())
        else:
            return {"status": "error", "message": f"Asset type '{asset_type}' not supported here — use an Image or ImageCollection."}

        bands = image.bandNames().getInfo()
        if not band:
            band = bands[0]
        if band not in bands:
            return {"status": "error", "message": f"Band '{band}' not found. Available: {', '.join(bands[:40])}"}

        image = image.select(band).rename("value").clip(roi)
        scale = float(data.get("scale") or image.projection().nominalScale().getInfo() or 30)
        scale = max(scale, 10)
        stats = _continuous_stats(image, roi, scale, "custom")
        vmin = data.get("vis_min")
        vmax = data.get("vis_max")
        if vmin is None or vmax is None:
            vmin, vmax = stats.get("p10") or 0, stats.get("p90") or 1
        if vmin == vmax:
            vmax = vmin + 1
        palette = data.get("palette") or ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"]
        map_id = image.getMapId({"min": float(vmin), "max": float(vmax), "palette": palette})
        return {
            "status": "success",
            "bands": bands,
            "layers": [{
                "layerId": "hub-custom",
                "name": f"{asset_id} · {band}",
                "visual_url": map_id["tile_fetcher"].url_format,
                "download_url": _download_url(image, roi, scale),
            }],
            "stats": stats,
            "legend": {"type": "gradient", "min": vmin, "max": vmax, "palette": palette, "units": ""},
        }
    except ee.EEException as exc:
        return {"status": "error", "message": f"Earth Engine: {exc}"}
    except Exception as exc:
        logger.exception("fetch_custom failed")
        return {"status": "error", "message": str(exc)}
