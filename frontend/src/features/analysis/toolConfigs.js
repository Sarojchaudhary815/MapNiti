// Declarative configs for every Earth-Engine analysis tool. AnalysisRunner
// renders the form from `params`, posts to /api/analysis/{id} and draws the
// standard result (layers, vectors, legend, stats, chart, table, notes).

const thisYear = new Date().getFullYear();
const EPOCHS = [1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025, 2030];

export const TOOL_CONFIGS = {
  // ------------------------------------------------------------------ Urban
  'urban-lulc': {
    label: 'Land Use Land Cover',
    desc: '10 m land cover for any year since 2016 with area per class.',
    params: [{ key: 'year', label: 'Year', type: 'number', min: 2016, max: thisYear, default: thisYear - 1 }],
    how: ['Draw or upload your municipality / ward boundary.', 'Pick a year and run.', 'Run again with an older year to compare change.'],
    data: 'Google Dynamic World (Sentinel-2, 10 m)',
  },
  'urban-growth': {
    label: 'Urban Growth Analysis',
    desc: 'Built-up expansion between two epochs (1975–2030) with growth rate and projection.',
    params: [
      { key: 'start_epoch', label: 'From', type: 'select', options: EPOCHS.slice(0, -1).map((y) => ({ value: y, label: String(y) })), default: 2000 },
      { key: 'end_epoch', label: 'To', type: 'select', options: EPOCHS.slice(1).map((y) => ({ value: y, label: `${y}${y > 2020 ? ' (projected)' : ''}` })), default: 2020 },
    ],
    how: ['Select your city or municipality.', 'Choose the two epochs — 2025/2030 are JRC projections.', 'Red on the map = land that became built-up.'],
    data: 'JRC GHSL built-up surface P2023A (100 m)',
  },
  'urban-roads': {
    label: 'Road Network Analysis',
    desc: 'Road length by class, density and area served within a walking/driving buffer.',
    params: [{ key: 'buffer_m', label: 'Service buffer', type: 'number', min: 50, max: 5000, step: 50, unit: 'm', default: 500 }],
    how: ['Draw an AOI up to 400 km².', 'Set the buffer (e.g. 500 m walking access, 2000 m rural road access).', 'Click a road on the map to see its name and class.'],
    data: 'OpenStreetMap (Overpass API)',
  },
  'urban-suitability': {
    label: 'Suitability Analysis',
    desc: 'Weighted overlay for development: slope, access, land cover, flood proneness.',
    params: [
      { key: 'weights', type: 'weights', label: 'Criteria weights', items: [
        { key: 'w_slope', label: 'Slope', default: 35 },
        { key: 'w_access', label: 'Access to built-up', default: 25 },
        { key: 'w_landcover', label: 'Land cover', default: 20 },
        { key: 'w_flood', label: 'Flood safety', default: 20 },
      ] },
    ],
    how: ['Draw the planning area.', 'Adjust weights to your priorities (they are normalised to 100%).', 'Green = most suitable. Water, snow, wetlands and slopes > 35° are excluded.'],
    data: 'SRTM, GHSL 2020, ESA WorldCover, JRC water, MERIT HAND',
  },

  // --------------------------------------------------------------- Disaster
  'disaster-flood': {
    label: 'Flood Risk Analysis',
    desc: 'Flood hazard index with people, built-up and cropland exposed per class.',
    params: [],
    how: ['Draw a floodplain / municipality AOI (≤ 3000 km²).', 'Run — hazard classes appear on the map.', 'Use the exposure table to prioritise embankments, early warning and relocation.'],
    data: 'MERIT HAND, JRC Global Surface Water, SRTM, WorldPop, GHSL, ESA WorldCover',
  },
  'disaster-wildfire': {
    label: 'Wildfire Analysis',
    desc: 'Fire susceptibility from burn history, fuel, dryness and terrain + burned area by year.',
    params: [],
    how: ['Draw a forest / municipality AOI.', 'Run to see susceptibility and the 2001–present burned-area chart.'],
    data: 'MODIS MCD64A1 burned area, FIRMS, MODIS NDVI & LST, ESA WorldCover, SRTM',
  },
  'disaster-landslide': {
    label: 'Landslide Susceptibility',
    desc: 'Heuristic landslide susceptibility with adjustable factor weights and exposure.',
    params: [
      { key: 'weights', type: 'weights', label: 'Factor weights', items: [
        { key: 'w_slope', label: 'Slope', default: 35 },
        { key: 'w_relief', label: 'Local relief', default: 15 },
        { key: 'w_streams', label: 'Near streams', default: 15 },
        { key: 'w_landcover', label: 'Land cover', default: 15 },
        { key: 'w_rainfall', label: 'Rainfall', default: 10 },
        { key: 'w_soil', label: 'Clay soil', default: 10 },
      ] },
    ],
    how: ['Draw a hill municipality / road corridor AOI.', 'Keep default weights or tune them from local experience.', 'Validate high classes against the Bipad landslide inventory.'],
    data: 'SRTM, MERIT Hydro, ESA WorldCover, CHIRPS, OpenLandMap',
  },
  'disaster-earthquake': {
    label: 'Earthquake Assessment',
    desc: 'Historical earthquakes around your site, annual rates and exposure.',
    params: [
      { key: 'radius_km', label: 'Search radius', type: 'number', min: 20, max: 500, step: 10, unit: 'km', default: 150 },
      { key: 'min_mag', label: 'Minimum magnitude', type: 'number', min: 2.5, max: 7, step: 0.5, default: 4 },
    ],
    how: ['Draw your site / municipality.', 'Set radius and magnitude.', 'Click a circle for the event details.'],
    data: 'USGS ComCat earthquake catalogue, WorldPop, GHSL',
  },
  'disaster-multi': {
    label: 'Multi-Hazard Risk',
    desc: 'Combined flood + landslide + wildfire index with people exposed.',
    params: [
      { key: 'weights', type: 'weights', label: 'Hazard weights', items: [
        { key: 'w_flood', label: 'Flood', default: 35 },
        { key: 'w_landslide', label: 'Landslide', default: 40 },
        { key: 'w_wildfire', label: 'Wildfire', default: 25 },
      ] },
    ],
    how: ['Draw a municipality AOI.', 'Weight hazards for your area (Terai: flood ↑, hills: landslide ↑).'],
    data: 'Flood, landslide and wildfire indices above',
  },
  'disaster-impact': {
    label: 'Disaster Impact Assessment',
    desc: 'Flood event impact: flooded area, people, cropland, built-up and buildings.',
    params: [
      { key: 'pre_start', label: 'Before event — from', type: 'date', default: `${thisYear - 1}-04-01` },
      { key: 'pre_end', label: 'Before event — to', type: 'date', default: `${thisYear - 1}-05-15` },
      { key: 'post_start', label: 'After event — from', type: 'date', default: `${thisYear - 1}-09-25` },
      { key: 'post_end', label: 'After event — to', type: 'date', default: `${thisYear - 1}-10-10` },
      { key: 'threshold_db', label: 'Change threshold', type: 'number', min: 1, max: 6, step: 0.5, unit: 'dB', default: 3 },
    ],
    how: ['Draw the affected area (≤ 2000 km²).', 'Choose a dry "before" window and a window right after the flood peak (≥ 12 days each).', 'Buildings are counted for AOIs ≤ 200 km².'],
    data: 'Sentinel-1 SAR, WorldPop, ESA WorldCover, Google Open Buildings',
  },

  // ------------------------------------------------------------- Agriculture
  'agri-crop': {
    label: 'Crop Suitability Analysis',
    desc: 'FAO-style land evaluation (S1/S2/S3/N) for major crops of Nepal.',
    params: [
      { key: 'crop', label: 'Crop', type: 'select', default: 'rice', options: [
        { value: 'rice', label: 'Rice (paddy)' }, { value: 'maize', label: 'Maize' }, { value: 'wheat', label: 'Wheat' },
        { value: 'millet', label: 'Finger millet' }, { value: 'potato', label: 'Potato' }, { value: 'tea', label: 'Tea' },
        { value: 'coffee', label: 'Coffee (arabica)' }, { value: 'sugarcane', label: 'Sugarcane' }, { value: 'cardamom', label: 'Large cardamom' },
      ] },
      { key: 'include_forest', label: 'Also assess forest land', type: 'checkbox', default: false },
    ],
    how: ['Draw a farm, VDC or municipality.', 'Pick a crop.', 'The table shows which factor limits suitability.'],
    data: 'ERA5-Land, CHIRPS, SRTM, OpenLandMap pH, ESA WorldCover',
  },
  'agri-soil': {
    label: 'Soil Fertility Analysis',
    desc: 'Organic carbon, nitrogen, CEC, pH → fertility index with recommendations.',
    params: [],
    how: ['Draw a farm / area.', 'Run to get the fertility map, soil property table and management advice.'],
    data: 'ISRIC SoilGrids 250 m, OpenLandMap',
  },
  'agri-irrigation': {
    label: 'Irrigation Coverage',
    desc: 'Cropland green in the dry season (likely irrigated) vs rainfed, and extension candidates.',
    params: [
      { key: 'year', label: 'Year', type: 'number', min: 2017, max: thisYear, default: thisYear - 1 },
      { key: 'ndvi_threshold', label: 'Dry-season NDVI threshold', type: 'number', min: 0.2, max: 0.8, step: 0.05, default: 0.45 },
    ],
    how: ['Draw an irrigation command area or municipality.', 'Adjust the NDVI threshold if orchards/forests appear irrigated.'],
    data: 'Sentinel-2 (Feb–Apr), ESA WorldCover, JRC water, MERIT Hydro',
  },
  'agri-risk': {
    label: 'Agricultural Risk (Flood/Drought)',
    desc: 'Vegetation Condition Index on cropland, rainfall anomaly and flood-exposed farmland.',
    params: [
      { key: 'year', label: 'Season year', type: 'number', min: 2002, max: thisYear, default: thisYear - 1 },
      { key: 'month_start', label: 'Season start month', type: 'number', min: 1, max: 12, default: 6 },
      { key: 'month_end', label: 'Season end month', type: 'number', min: 1, max: 12, default: 9 },
    ],
    how: ['Draw a district / municipality.', 'Monsoon paddy: months 6–9; winter wheat: 11–3 (use 1–3).'],
    data: 'MODIS NDVI 2001–present, CHIRPS 1991–present, JRC water',
  },

  // -------------------------------------------------------------- Hydrology
  'hydro-drainage': {
    label: 'Drainage Network Analysis',
    desc: 'Stream network, drainage density and river order with mean discharge.',
    params: [{ key: 'threshold_km2', label: 'Stream threshold (upstream area)', type: 'number', min: 0.1, max: 500, step: 0.1, unit: 'km²', default: 1 }],
    how: ['Draw a catchment AOI.', 'Lower threshold = more small streams.', 'Click a river for its order and long-term mean discharge.'],
    data: 'MERIT Hydro (90 m), WWF HydroSHEDS Free-Flowing Rivers',
  },
  'hydro-corridor': {
    label: 'River Corridor Risk',
    desc: 'Bank erosion / channel shift since 1984 and people, buildings, farmland in the corridor.',
    params: [{ key: 'corridor_m', label: 'Corridor buffer', type: 'number', min: 50, max: 2000, step: 50, unit: 'm', default: 250 }],
    how: ['Draw an AOI along the river.', 'Red = land lost to the river (erosion), green = land gained.'],
    data: 'JRC Global Surface Water 1984–2021, WorldPop, GHSL, Open Buildings',
  },
};
