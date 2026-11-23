import { COURSES, LEVELS } from './courses';
import { MORE_COURSES } from './moreCourses';
import { EXTRA_COURSES } from './extraCourses';
import { GEO_PYTHON_COURSES, PYTHON_BASICS_MORE } from './geoPythonCourses';

export { LEVELS };

export const TRACKS = [
  { id: 'GIS Science', desc: 'Concepts, desktop GIS, maps, remote sensing, analysis, Earth Engine, GeoAI and cloud-native GIS.' },
  { id: 'Programming & Web', desc: 'Python from zero, HTML → JavaScript → Leaflet → MapLibre, and SQL for GIS.' },
  { id: 'Engineering', desc: 'Surveying, GNSS, hydrology and GIS workflows for civil & geomatics engineers.' },
];

const TRACK_OF = {
  'gis-fundamentals': 'GIS Science', 'qgis-desktop': 'GIS Science', cartography: 'GIS Science', 'remote-sensing': 'GIS Science',
  'spatial-analysis': 'GIS Science', 'earth-engine': 'GIS Science', geoai: 'GIS Science', 'cloud-native': 'GIS Science',
  'python-basics': 'Programming & Web', 'html-css': 'Programming & Web', javascript: 'Programming & Web',
  leaflet: 'Programming & Web', maplibre: 'Programming & Web', 'python-gis': 'Programming & Web', 'spatial-sql': 'Programming & Web',
  'pandas-data': 'Programming & Web', 'geo-python': 'Programming & Web', 'dem-analysis': 'Engineering',
  surveying: 'Engineering', 'hydrology-gis': 'Engineering', 'gis-civil': 'Engineering',
};

// What you will be able to do after each course.
const OUTCOMES = {
  'gis-fundamentals': ['Explain vector vs raster and pick the right one', 'Choose WGS84, UTM or Nepal MUTM correctly', 'Read map scale and common GIS file formats'],
  'qgis-desktop': ['Set up a QGIS project with the right CRS', 'Import GPS points, CSV, shapefiles, KML and DEMs', 'Style, label and export a print-ready map', 'Run buffer, clip, slope and contour tools'],
  cartography: ['Put every required element on an engineering map', 'Choose equal interval, quantile or natural breaks', 'Avoid misleading classifications'],
  'html-css': ['Write a web page with HTML and CSS', 'Build a small calculator form with JavaScript', 'Prepare a page to hold a web map'],
  javascript: ['Use variables, arrays, loops and functions', 'Read and write JSON and GeoJSON', 'Fetch live data from an API'],
  'python-basics': ['Write and run Python with no prior experience', 'Use variables, lists, loops, if and functions', 'Build a plot-area calculator from coordinates', 'Read and write files, use classes and handle errors'],
  'pandas-data': ['Explore and filter tables with pandas', 'Clean, merge, group and pivot data', 'Plot report-quality charts with matplotlib'],
  'geo-python': ['Set up a conda GIS environment', 'Read and write rasters and vectors with GDAL/OGR', 'Run spatial joins, overlays and buffers with GeoPandas', 'Analyse rasters, make Folium maps and script QGIS'],
  'dem-analysis': ['Pick the right DEM and vertical datum', 'Make slope, aspect, hillshade and contours', 'Compute cut-fill volumes and a balanced level'],
  'remote-sensing': ['Know which free satellites to use', 'Compute NDVI, NDWI and NDBI', 'Understand image classification and land cover'],
  'python-gis': ['Handle survey data with pandas', 'Do geometry with shapely', 'Run a Gumbel design-rainfall analysis'],
  'spatial-analysis': ['Buffer, clip, intersect and dissolve', 'Derive slope, aspect and contours', 'Build a weighted-overlay suitability map', 'Interpolate surfaces from points'],
  'hydrology-gis': ['Turn a DEM into streams and catchments', 'Compute tc and rational-method peak flow', 'Estimate runoff with SCS-CN', 'Size drains and channels with Manning'],
  'spatial-sql': ['Query survey and parcel tables with SQL', 'Use PostGIS spatial functions'],
  leaflet: ['Build web maps with basemaps and layer control', 'Make a choropleth with a legend', 'Show live data and measure distances'],
  surveying: ['Understand GNSS, RTK and PPK', 'Reduce total station observations to coordinates', 'Transform coordinates with Helmert and least squares'],
  'earth-engine': ['Use Image, ImageCollection and reducers', 'Make rainfall and NDVI time series', 'Map floods with Sentinel-1 and export results'],
  'gis-civil': ['Plan road alignments and profiles', 'Size culverts from watersheds and runoff', 'Screen landslide and flood hazard'],
  maplibre: ['Style data with expressions', 'Show 3D terrain and buildings', 'Display Earth Engine results in your own map'],
  geoai: ['Classify land cover with random forest', 'Cluster pixels with k-means', 'Use foundation models and satellite embeddings'],
  'cloud-native': ['Search imagery with STAC and read COGs', 'Run spatial SQL on huge GeoParquet files with DuckDB'],
};

// Recommended order from zero to advanced.
export const LEARNING_PATH = [
  'gis-fundamentals', 'qgis-desktop', 'cartography', 'html-css', 'javascript', 'python-basics',
  'pandas-data', 'remote-sensing', 'python-gis', 'geo-python', 'spatial-analysis', 'dem-analysis', 'hydrology-gis', 'spatial-sql', 'leaflet',
  'surveying', 'earth-engine', 'gis-civil', 'maplibre', 'geoai', 'cloud-native',
];

export const ALL_COURSES = LEARNING_PATH
  .map((id) => [...COURSES, ...MORE_COURSES, ...EXTRA_COURSES, ...GEO_PYTHON_COURSES].find((c) => c.id === id))
  .filter(Boolean)
  .map((c) => (c.id === 'python-basics' ? { ...c, lessons: [...c.lessons, ...PYTHON_BASICS_MORE] } : c))
  .map((c) => ({ ...c, track: TRACK_OF[c.id] || 'GIS Science', outcomes: OUTCOMES[c.id] || [] }));

export const courseById = (id) => ALL_COURSES.find((c) => c.id === id);
