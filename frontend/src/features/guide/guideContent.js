// Content for the public GIS Guide page (/gis-guide).

export const SECTORS = [
  { title: 'Roads & transport', items: ['Alignment options and grade checks from DEMs', 'Cut/fill and land-acquisition estimates', 'Road condition inventories and network connectivity', 'Accessibility: how many people live within 30 min of a hospital'], tool: ['Engineer Toolkit → Elevation Profile', 'engineer'] },
  { title: 'Water resources & hydrology', items: ['Watershed & stream delineation', 'Design discharge (rational method, SCS-CN), culvert sizing', 'Flood hazard and inundation mapping', 'Hydropower head / catchment pre-feasibility'], tool: ['Hydrology tools', 'hydrology'] },
  { title: 'Urban planning & building', items: ['Land use / land cover and urban growth', 'Zoning, bylaw compliance, building permits', 'Site suitability for schools, landfills, housing', 'Infrastructure (water, sewer) network maps'], tool: ['Urban Planning tools', 'urban'] },
  { title: 'Disaster risk management', items: ['Landslide, flood and fire susceptibility', 'Earthquake exposure and building inventories', 'Rapid damage assessment with satellite radar', 'Evacuation routes and shelter planning'], tool: ['Disaster Risk tools', 'disaster'] },
  { title: 'Agriculture & food security', items: ['Crop suitability and soil fertility', 'Irrigation coverage and command areas', 'Drought monitoring with NDVI / VCI', 'Yield and crop-area estimation'], tool: ['Agriculture tools', 'agriculture'] },
  { title: 'Surveying & land administration', items: ['Cadastral mapping (MUTM) and parcel area checks', 'Control networks, GNSS/RTK processing', 'Georeferencing scanned sheets', 'Drone orthophotos and DSMs'], tool: ['Engineer Toolkit calculators', 'engineer'] },
  { title: 'Environment & forestry', items: ['Forest cover change (Hansen / Dynamic World)', 'Protected-area and EIA baseline maps', 'Air quality (Sentinel-5P NO₂)', 'Glacier lakes and snow cover'], tool: ['GEE Data Hub', 'gee-hub'] },
  { title: 'Energy & utilities', items: ['Solar and wind siting', 'Transmission line routing (least-cost path)', 'Hydropower reservoir area-capacity curves', 'Electrification planning with night-lights data'], tool: ['GEE Data Hub', 'gee-hub'] },
];

export const CONCEPTS = [
  ['Coordinate Reference System (CRS)', 'The definition that ties coordinates to the Earth: datum + ellipsoid + projection. Every layer must declare one.'],
  ['Datum', 'Reference model of the Earth\'s shape and position (WGS84 for GPS; Everest 1830/Nagarkot for Nepal\'s MUTM cadastral maps).'],
  ['Projection', 'Mathematical flattening of the ellipsoid onto a plane (UTM, Transverse Mercator). Needed for metric measurement.'],
  ['Vector data', 'Points, lines and polygons with attribute tables — parcels, roads, rivers.'],
  ['Raster data', 'Grid of cells, each with a value — DEMs, satellite images, rainfall surfaces.'],
  ['Spatial resolution', 'Ground size of a raster cell: Sentinel-2 = 10 m, SRTM = 30 m, MODIS = 250 m–1 km.'],
  ['DEM / DSM / DTM', 'Elevation models: DSM includes trees and buildings; DTM is bare ground. SRTM/ALOS are close to DSM.'],
  ['Topology', 'Rules about how features relate (no gaps/overlaps between parcels, lines that connect at nodes).'],
  ['Georeferencing', 'Assigning real-world coordinates to a scanned map or image using control points.'],
  ['Geocoding', 'Converting addresses or place names to coordinates (and back).'],
  ['Buffer / overlay', 'Zones at a distance around features; combining layers (intersect, union, clip).'],
  ['Zonal statistics', 'Summarising a raster inside polygons — e.g. mean slope per ward.'],
  ['Interpolation', 'Estimating values between measured points — IDW, kriging, TIN.'],
  ['Spectral index', 'Band-math that highlights a surface: NDVI (vegetation), NDWI (water), NDBI (built-up).'],
  ['SAR (radar)', 'Active microwave imaging (Sentinel-1, NISAR) — works through clouds and at night.'],
  ['LiDAR', 'Laser scanning producing dense 3D point clouds; the best source of bare-earth DTMs.'],
  ['Photogrammetry', 'Measuring from overlapping photos — how drones make orthophotos and DSMs.'],
  ['WMS / WFS / XYZ', 'Web standards for serving map images, vector features and tiles.'],
  ['COG / STAC / GeoParquet', 'Cloud-native formats and catalogues that let software read only what it needs over the internet.'],
  ['Map algebra', 'Cell-by-cell maths between rasters — the basis of suitability and hazard models.'],
];

// level: Beginner / Intermediate / Advanced; cost: Free / Paid / Freemium
export const TOOL_GROUPS = [
  {
    group: 'Desktop GIS',
    tools: [
      { name: 'QGIS 4.0', url: 'https://qgis.org', cost: 'Free', level: 'Beginner → Advanced', power: 'Released March 2026 on Qt 6. Processing toolbox with GDAL, GRASS, SAGA and WhiteboxTools algorithms, graphical modeler, Python console, 1000+ plugins, 3D views, mesh and point-cloud support.' },
      { name: 'ArcGIS Pro 3.6', url: 'https://pro.arcgis.com/en/pro-app/latest/get-started/whats-new-in-arcgis-pro.htm', cost: 'Paid', level: 'Intermediate → Advanced', power: 'Industry standard in many agencies. Spatial Analyst / Image Analyst extensions, deep-learning tools, redesigned ModelBuilder (3.6), BIM/CAD integration.' },
      { name: 'GRASS GIS', url: 'https://grass.osgeo.org', cost: 'Free', level: 'Advanced', power: 'Scientific raster and hydrology engine — r.watershed, r.sun solar radiation, r.sim hydrology.' },
    ],
  },
  {
    group: 'Cloud & remote sensing',
    tools: [
      { name: 'Google Earth Engine', url: 'https://earthengine.google.com', cost: 'Free (non-commercial)', level: 'Intermediate → Advanced', power: 'Petabyte catalogue (Landsat since 1984, Sentinel, MODIS, climate, DEMs) processed on Google servers; AlphaEarth satellite embeddings for GeoAI.' },
      { name: 'Copernicus Data Space', url: 'https://browser.dataspace.copernicus.eu', cost: 'Free', level: 'Beginner', power: 'Browse and download all Sentinel missions, on-the-fly indices, time-lapses and cloud processing APIs.' },
      { name: 'ESA SNAP', url: 'https://step.esa.int/main/download/snap-download/', cost: 'Free', level: 'Advanced', power: 'SAR processing and InSAR — measure ground deformation from landslides, subsidence and earthquakes to millimetres.' },
      { name: 'Microsoft Planetary Computer', url: 'https://planetarycomputer.microsoft.com', cost: 'Free', level: 'Advanced', power: 'STAC catalogue of analysis-ready data for Python/Dask workflows.' },
    ],
  },
  {
    group: 'Web & browser GIS',
    tools: [
      { name: 'GeoLibre', url: 'https://geolibre.app', cost: 'Free (MIT)', level: 'Beginner → Advanced', power: 'New in 2026: cloud-native GIS that runs in the browser, desktop, mobile and Jupyter with 1,000+ geoprocessing tools in WebAssembly — your data never leaves your machine.' },
      { name: 'Leaflet', url: 'https://leafletjs.com', cost: 'Free', level: 'Beginner', power: 'Lightweight library for interactive web maps — the fastest way to publish a project map.' },
      { name: 'MapLibre GL JS', url: 'https://maplibre.org', cost: 'Free', level: 'Intermediate', power: 'GPU-rendered vector maps, 3D terrain, data-driven styling (MapNiti\'s map engine).' },
      { name: 'CesiumJS', url: 'https://cesium.com/platform/cesiumjs/', cost: 'Free', level: 'Advanced', power: 'Global 3D globe with 3D Tiles — digital twins, city models, drone meshes.' },
      { name: 'GeoServer', url: 'https://geoserver.org', cost: 'Free', level: 'Advanced', power: 'Publish PostGIS/raster layers as WMS/WFS/WMTS services for your organisation.' },
    ],
  },
  {
    group: 'Databases & big data',
    tools: [
      { name: 'PostGIS', url: 'https://postgis.net', cost: 'Free', level: 'Intermediate → Advanced', power: 'Spatial SQL database — multi-user editing, topology, routing (pgRouting), rasters.' },
      { name: 'DuckDB Spatial', url: 'https://duckdb.org/docs/stable/core_extensions/spatial/overview', cost: 'Free', level: 'Intermediate', power: 'Analytical SQL on GeoParquet/Overture data straight from cloud storage — millions of features on a laptop.' },
    ],
  },
  {
    group: 'Python geospatial stack',
    tools: [
      { name: 'GDAL / rasterio / geopandas', url: 'https://gdal.org', cost: 'Free', level: 'Intermediate', power: 'Read/write every format, reproject, clip, mosaic; geopandas = pandas with geometry.' },
      { name: 'geemap & leafmap', url: 'https://geemap.org', cost: 'Free', level: 'Intermediate', power: 'Interactive Earth Engine and cloud-native mapping in Jupyter/Colab.' },
      { name: 'WhiteboxTools', url: 'https://www.whiteboxgeo.com', cost: 'Free (core)', level: 'Advanced', power: '450+ terrain, hydrology and LiDAR tools with a Python API.' },
      { name: 'SAMGeo / GeoAI / TorchGeo', url: 'https://samgeo.gishub.org', cost: 'Free', level: 'Advanced', power: 'Deep learning on imagery: segment buildings, fields and water; train and fine-tune models.' },
    ],
  },
  {
    group: 'Engineering & field',
    tools: [
      { name: 'HEC-RAS / HEC-HMS', url: 'https://www.hec.usace.army.mil/software/', cost: 'Free', level: 'Advanced', power: '1D/2D river hydraulics and rainfall-runoff modelling — built on GIS terrain and land cover.' },
      { name: 'EPANET', url: 'https://www.epa.gov/water-research/epanet', cost: 'Free', level: 'Intermediate', power: 'Water-supply pipe network hydraulics; QGIS plugins (e.g. QWater) build networks from GIS layers.' },
      { name: 'OpenDroneMap', url: 'https://opendronemap.org', cost: 'Free', level: 'Intermediate', power: 'Drone photos → orthomosaic, DSM/DTM, point cloud, 3D mesh.' },
      { name: 'CloudCompare', url: 'https://www.cloudcompare.org', cost: 'Free', level: 'Intermediate', power: 'Point-cloud cleaning, volume and change detection (cut/fill between surveys).' },
      { name: 'QField / KoboToolbox', url: 'https://qfield.org', cost: 'Free', level: 'Beginner', power: 'Mobile field data collection with GPS, forms and photos, syncing back to QGIS.' },
    ],
  },
];

export const GUIDES = [
  {
    id: 'watershed', title: 'Watershed delineation & design discharge', level: 'Intermediate', time: '30 min',
    tools: 'MapNiti Hydrology or QGIS + WhiteboxTools',
    steps: [
      'Get a DEM for an area larger than the catchment (MapNiti Data Download → SRTM or Copernicus, UTM CRS).',
      'Fill sinks / breach depressions so water can flow to the outlet (Whitebox: BreachDepressionsLeastCost).',
      'Compute D8 flow direction and flow accumulation.',
      'Extract streams with an accumulation threshold (e.g. 1 km²) and snap your outlet point (bridge/culvert site) onto the stream.',
      'Delineate the watershed from the snapped outlet; convert to polygon and calculate area.',
      'Measure longest flow path length (L) and fall (H) → time of concentration (Kirpich).',
      'Get land cover (ESA WorldCover) for a weighted runoff coefficient, and design rainfall intensity from an IDF curve.',
      'Q = C·i·A/360 (A in ha) — then size the structure with Manning or culvert charts.',
    ],
    tip: 'Snap the outlet to the highest-accumulation cell within ~100 m — a pour point 1 pixel off the stream gives a tiny wrong catchment.',
  },
  {
    id: 'flood-sar', title: 'Flood mapping with Sentinel-1 radar', level: 'Intermediate', time: '20 min',
    tools: 'MapNiti Disaster → Impact Assessment, or Earth Engine',
    steps: [
      'Choose a "before" period in the dry season and an "after" period right after the flood peak (≥ 12 days each for coverage).',
      'Use VV polarisation, IW mode; median-composite each period and apply a speckle filter (focal median).',
      'Difference after − before: a drop of more than ~3 dB with after < −15 dB indicates new water.',
      'Mask permanent water (JRC), steep slopes (> 5°) and high ground (HAND > 20 m) to remove false positives.',
      'Overlay with population, cropland and buildings to estimate impact.',
    ],
    tip: 'Radar cannot see water under dense forest or between tall buildings — report results as minimum extents.',
  },
  {
    id: 'lulc', title: 'Supervised land-cover classification', level: 'Intermediate', time: '45 min',
    tools: 'MapNiti Data Management → LULC, Earth Engine or QGIS (SCP plugin)',
    steps: [
      'Build a cloud-free Sentinel-2 composite for the season you care about.',
      'Define classes (water, forest, crop, built-up, bare, snow…) and digitise 30–100 training points/polygons per class spread across the area.',
      'Add helpful features: NDVI, NDWI, NDBI, slope and elevation.',
      'Train a Random Forest (100–300 trees) and classify.',
      'Collect independent validation points; build a confusion matrix; report overall accuracy and kappa (target > 85%).',
      'Clean up with a majority filter, then compute class areas.',
    ],
    tip: 'Most accuracy problems come from too few or clustered training samples, not from the algorithm.',
  },
  {
    id: 'landslide', title: 'Landslide susceptibility mapping', level: 'Advanced', time: '1–2 h',
    tools: 'MapNiti Disaster → Landslide, QGIS, or Python',
    steps: [
      'Compile an inventory of past landslides (Bipad portal, field survey, Google Earth history, NASA catalog).',
      'Prepare factor rasters on one grid: slope, aspect, curvature, relief, distance to streams/roads/faults, lithology, land cover, rainfall.',
      'Heuristic approach: reclassify each factor to 1–5 and weight (AHP) → weighted overlay.',
      'Statistical approach: frequency ratio or logistic regression / random forest using the inventory (70% train, 30% test).',
      'Validate with ROC curve / AUC (> 0.8 is good) and check class percentages are sensible.',
      'Overlay settlements and roads to map risk, not only hazard.',
    ],
    tip: 'Always include geology/faults from DMG maps where available — slope alone over-predicts in hard rock.',
  },
  {
    id: 'suitability', title: 'Site suitability with weighted overlay (AHP)', level: 'Intermediate', time: '40 min',
    tools: 'MapNiti Urban → Suitability, QGIS Raster Calculator',
    steps: [
      'Define the decision (e.g. landfill site) and criteria with constraints (exclusions) and factors (scores).',
      'Build criterion rasters: slope, distance to roads, distance from rivers/settlements, land cover, geology.',
      'Reclassify factors to a common 1–5 scale; set constraints to 0.',
      'Derive weights with AHP pairwise comparison (check consistency ratio < 0.1).',
      'Suitability = Σ weight × score, multiplied by constraint mask.',
      'Keep only contiguous areas above a minimum size, then field-verify the top candidates.',
    ],
    tip: 'Run a sensitivity test — change each weight ±10% and see if the best sites stay the same.',
  },
  {
    id: 'road', title: 'Road alignment & longitudinal profile', level: 'Intermediate', time: '30 min',
    tools: 'MapNiti Engineer Toolkit + Data Download (contours DXF)',
    steps: [
      'Download contours (e.g. 5–10 m interval) for the corridor as DXF and load them in AutoCAD / Civil 3D or QGIS.',
      'Map constraints: slope > 30°, landslide zones, rivers (setback), settlements and forests.',
      'Sketch 2–3 trial alignments keeping the ruling gradient; use switchbacks where needed.',
      'Run Elevation Profile for each option; compare length, max grade, total rise/fall.',
      'Estimate earthwork from cross-sections (Earthwork calculator) and choose the best option.',
      'Confirm with a detailed total-station / drone survey before design.',
    ],
    tip: '30 m DEM contours are for route selection — not for final design levels.',
  },
  {
    id: 'georef', title: 'Georeferencing a scanned map or cadastral sheet', level: 'Beginner', time: '20 min',
    tools: 'QGIS Georeferencer',
    steps: [
      'Scan at ≥ 300 dpi; note the sheet\'s CRS (e.g. MUTM 84) and grid values.',
      'Open Layer → Georeferencer, load the scan.',
      'Add ≥ 6 control points at grid intersections spread over the sheet; type their map coordinates.',
      'Choose transformation (Polynomial 1 for good scans, Thin Plate Spline for distorted ones) and the target CRS.',
      'Check residuals (RMSE ideally < 1 pixel), then run to create a GeoTIFF.',
      'Digitise parcels on top; calculate area in a projected CRS.',
    ],
    tip: 'Use grid intersections, not features like road corners — they are the most accurate points on the sheet.',
  },
  {
    id: 'mutm', title: 'Converting MUTM cadastral data to WGS84 / UTM', level: 'Intermediate', time: '15 min',
    tools: 'QGIS, pyproj, MapNiti coordinate converter',
    steps: [
      'Identify the zone: MUTM 81° (west), 84° (central), 87° (east).',
      'Define the CRS: Transverse Mercator, k₀ = 0.9999, false easting 500 000, Everest 1830 ellipsoid (a = 6377276.345, 1/f = 300.8017).',
      'Apply the datum transformation to WGS84 (towgs84 parameters) — use the Survey Department\'s official parameters for legal work.',
      'Reproject (QGIS: Export → Save Features As… with target CRS) and check against known control points.',
    ],
    tip: 'A wrong datum shift moves data by 100+ metres — always verify with a known point.',
  },
  {
    id: 'drone', title: 'Drone survey to orthophoto & DSM', level: 'Intermediate', time: 'half day',
    tools: 'Flight app + OpenDroneMap (or Pix4D/Agisoft) + QGIS',
    steps: [
      'Plan the flight: 70–80% front and 60–70% side overlap; altitude for your target GSD (e.g. 3 cm/px).',
      'Place and survey 5+ ground control points (GCPs) with RTK/GNSS.',
      'Fly in stable light; check photos for blur.',
      'Process in OpenDroneMap with GCPs → orthomosaic, DSM, DTM, point cloud.',
      'Check accuracy against independent checkpoints; export contours and volumes.',
    ],
    tip: 'Follow Civil Aviation Authority of Nepal (CAAN) drone rules and get permission before flying.',
  },
  {
    id: 'ndvi-monitor', title: 'Crop / vegetation monitoring with NDVI time series', level: 'Beginner', time: '15 min',
    tools: 'MapNiti GEE Data Hub → MODIS NDVI → Time series',
    steps: [
      'Draw your farm or district.',
      'Choose MODIS NDVI (250 m) for regional or Sentinel-2 NDVI for field level.',
      'Build a monthly series for several years; compare the current season with previous ones.',
      'Low NDVI at the usual peak time → check for drought, flood, pests or late planting.',
    ],
    tip: 'Agriculture → Agricultural Risk computes the Vegetation Condition Index automatically.',
  },
  {
    id: 'uhi', title: 'Urban heat island mapping', level: 'Intermediate', time: '20 min',
    tools: 'MapNiti GEE Data Hub → MODIS LST, or Landsat thermal band',
    steps: [
      'Select the city and the hot season (Apr–Jun).',
      'Load land surface temperature (MODIS 1 km or Landsat 30 m band ST_B10).',
      'Compare built-up vs vegetated areas (overlay Dynamic World built class).',
      'Correlate LST with NDVI — greener wards are cooler; plan tree planting where LST is highest.',
    ],
    tip: 'LST is surface temperature, not air temperature — mention this when reporting.',
  },
  {
    id: 'service-area', title: 'Service areas: who is far from a health post?', level: 'Intermediate', time: '30 min',
    tools: 'QGIS Network Analysis / QNEAT3 + OSM roads + WorldPop',
    steps: [
      'Download OSM roads (MapNiti Data Download → OSM) and facility points (HDX / OSM amenities).',
      'Clean the network (snap nodes, fix gaps).',
      'Run service areas for 2 km / 5 km along roads from each facility.',
      'Sum WorldPop population outside the service areas → underserved people.',
      'Propose new facility sites where the underserved population is largest.',
    ],
    tip: 'In hills, walking time depends on slope — use Tobler\'s hiking function for realistic travel times.',
  },
];
