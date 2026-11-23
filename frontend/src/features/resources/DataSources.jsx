import React, { useMemo, useState } from 'react';
import { Search, ExternalLink, Landmark, Globe2, Wrench, Sparkles, Compass, ArrowRight } from 'lucide-react';

// Links were checked reachable when this list was written (2026-09). Government
// sites in particular change often — report broken links to the admin.
const SOURCES = [
  // ---------------- Nepal ----------------
  { cat: 'nepal', name: 'Survey Department (Napi Bibhag)', url: 'https://dos.gov.np', tags: ['topo maps', 'control points', 'boundaries', 'cadastral', 'MUTM'], desc: 'Official topographic sheets (1:25k / 1:50k), geodetic control points, administrative boundaries and cadastral mapping.' },
  { cat: 'nepal', name: 'Nepal National Geoportal (NGIIS)', url: 'https://nationalgeoportal.gov.np', tags: ['boundaries', 'roads', 'rivers', 'settlements', 'WMS'], desc: "Survey Department's geoportal: view/download national base layers and web services." },
  { cat: 'nepal', name: 'Department of Hydrology & Meteorology (DHM)', url: 'https://www.dhm.gov.np', tags: ['rainfall', 'temperature', 'climate', 'stations', 'IDF'], desc: 'Station rainfall/temperature records (request data), forecasts, climate normals — the source for design rainfall and IDF curves.' },
  { cat: 'nepal', name: 'DHM Real-time Hydrology', url: 'https://hydrology.gov.np', tags: ['river level', 'discharge', 'flood warning', 'real-time'], desc: 'Real-time river water level, discharge and rainfall stations with flood warning thresholds.' },
  { cat: 'nepal', name: 'National Statistics Office (Census)', url: 'https://www.nsonepal.gov.np', tags: ['census', 'population', 'households', 'socio-economic'], desc: 'National Population and Housing Census 2021 and surveys by province, district and local level.' },
  { cat: 'nepal', name: 'Bipad Portal (Disaster Information)', url: 'https://bipadportal.gov.np', tags: ['landslide', 'flood', 'incidents', 'hazard', 'risk'], desc: 'National disaster incident database, hazard layers, real-time alerts and resources — landslide/flood inventories.' },
  { cat: 'nepal', name: 'Department of Mines & Geology', url: 'https://dmgnepal.gov.np', tags: ['geology', 'faults', 'seismic', 'engineering geology'], desc: 'Geological maps, active faults, seismic monitoring and engineering-geology reports.' },
  { cat: 'nepal', name: 'Department of Roads', url: 'https://dor.gov.np', tags: ['roads', 'bridges', 'standards', 'SRN'], desc: 'Strategic road network, bridge inventory, design standards and norms.' },
  { cat: 'nepal', name: 'Ministry of Federal Affairs & General Administration', url: 'https://mofaga.gov.np', tags: ['local levels', 'municipality', 'wards'], desc: 'Local-level (palika) information, profiles and contacts for all 753 local governments.' },
  { cat: 'nepal', name: 'Open Data Nepal', url: 'https://opendatanepal.com', tags: ['open data', 'tables', 'budget', 'education', 'health'], desc: 'Community portal collecting open datasets about Nepal in machine-readable form.' },
  { cat: 'nepal', name: 'ICIMOD Regional Database System', url: 'https://rds.icimod.org', tags: ['land cover', 'glaciers', 'snow', 'HKH', 'Himalaya'], desc: 'Hindu Kush Himalaya datasets: land cover, glaciers, glacial lakes, snow, climate and more.' },
  { cat: 'nepal', name: 'HDX — Nepal', url: 'https://data.humdata.org/group/npl', tags: ['boundaries', 'health facilities', 'schools', 'humanitarian'], desc: 'Humanitarian Data Exchange: admin boundaries (COD), facilities, population and response datasets.' },
  { cat: 'nepal', name: 'Nepal GeoJSON boundaries (GitHub)', url: 'https://github.com/mesaugat/geoJSON-Nepal', tags: ['GeoJSON', 'provinces', 'districts', 'municipalities'], desc: 'Free GeoJSON of provinces, districts and local levels — drop straight into MapNiti as an AOI.' },

  // ---------------- Global ----------------
  { cat: 'global', name: 'Google Earth Engine Data Catalog', url: 'https://developers.google.com/earth-engine/datasets', tags: ['satellite', 'climate', 'DEM', 'catalog'], desc: 'Petabytes of analysis-ready data. Use any asset ID in MapNiti GEE Data Hub → "Any GEE asset".' },
  { cat: 'global', name: 'USGS EarthExplorer', url: 'https://earthexplorer.usgs.gov', tags: ['Landsat', 'SRTM', 'aerial', 'download'], desc: 'Download Landsat scenes, SRTM DEM, declassified imagery and more (free account).' },
  { cat: 'global', name: 'Copernicus Browser', url: 'https://browser.dataspace.copernicus.eu', tags: ['Sentinel-1', 'Sentinel-2', 'Sentinel-5P', 'download'], desc: 'View and download Sentinel data with on-the-fly indices and time-lapses.' },
  { cat: 'global', name: 'NASA Earthdata Search', url: 'https://search.earthdata.nasa.gov', tags: ['MODIS', 'GPM', 'SMAP', 'ICESat'], desc: "Search every NASA Earth-science dataset (MODIS, GPM rainfall, soil moisture...)." },
  { cat: 'global', name: 'OpenTopography', url: 'https://opentopography.org', tags: ['DEM', 'lidar', 'Copernicus', 'ALOS'], desc: 'High-resolution lidar and global DEMs (SRTM, Copernicus, ALOS, NASADEM) clipped to your area.' },
  { cat: 'global', name: 'Microsoft Planetary Computer', url: 'https://planetarycomputer.microsoft.com', tags: ['STAC', 'Sentinel', 'Landsat', 'cloud-native'], desc: 'Cloud-optimized Earth data catalog with Python/STAC access.' },
  { cat: 'global', name: 'Geofabrik — OpenStreetMap Nepal', url: 'https://download.geofabrik.de/asia/nepal.html', tags: ['OSM', 'roads', 'buildings', 'shapefile'], desc: 'Daily OSM extracts for Nepal as shapefile / PBF: roads, buildings, waterways, POIs.' },
  { cat: 'global', name: 'HOT Export Tool', url: 'https://export.hotosm.org', tags: ['OSM', 'custom area', 'GeoPackage', 'KML'], desc: 'Export OSM data for any drawn area in GeoPackage, shapefile, KML, Garmin...' },
  { cat: 'global', name: 'OpenStreetMap', url: 'https://www.openstreetmap.org', tags: ['base map', 'editing', 'roads'], desc: 'The free world map — you can also add missing roads and buildings for your municipality.' },
  { cat: 'global', name: 'NASA POWER', url: 'https://power.larc.nasa.gov', tags: ['solar', 'temperature', 'wind', 'daily climate'], desc: 'Daily solar radiation, temperature, humidity and wind for any point since 1981 — CSV downloads.' },
  { cat: 'global', name: 'CHIRPS Rainfall', url: 'https://www.chc.ucsb.edu/data/chirps', tags: ['rainfall', 'daily', 'drought'], desc: 'Daily/monthly rainfall since 1981 at ~5 km (also in MapNiti GEE Data Hub).' },
  { cat: 'global', name: 'WorldClim', url: 'https://www.worldclim.org', tags: ['climate normals', 'future climate', 'bioclim'], desc: 'Climate normals and CMIP6 future projections at up to 1 km.' },
  { cat: 'global', name: 'SoilGrids', url: 'https://soilgrids.org', tags: ['soil', 'clay', 'sand', 'pH', 'organic carbon'], desc: 'Global soil properties at 250 m for six depths.' },
  { cat: 'global', name: 'ESA WorldCover', url: 'https://esa-worldcover.org', tags: ['land cover', '10 m'], desc: '10 m global land cover (2020, 2021) — downloadable tiles.' },
  { cat: 'global', name: 'Google Open Buildings', url: 'https://sites.research.google/open-buildings', tags: ['buildings', 'footprints', 'AI'], desc: 'AI-detected building footprints with confidence scores (also used in MapNiti Site Report).' },
  { cat: 'global', name: 'WorldPop', url: 'https://www.worldpop.org', tags: ['population', 'age', 'density'], desc: '100 m gridded population estimates and age/sex structure.' },
  { cat: 'global', name: 'GADM', url: 'https://gadm.org', tags: ['boundaries', 'admin'], desc: 'Administrative boundaries for every country (free for non-commercial use).' },
  { cat: 'global', name: 'Natural Earth', url: 'https://www.naturalearthdata.com', tags: ['small-scale', 'cartography', 'countries'], desc: 'Public-domain small-scale base layers for regional maps.' },
  { cat: 'global', name: 'Global Solar Atlas', url: 'https://globalsolaratlas.info', tags: ['solar', 'PV potential', 'GHI'], desc: 'Solar irradiation and PV yield for any site — rooftop and solar farm pre-feasibility.' },
  { cat: 'global', name: 'Global Wind Atlas', url: 'https://globalwindatlas.info', tags: ['wind', 'energy'], desc: 'Wind speed and power density at 50–200 m heights.' },
  { cat: 'global', name: 'GloFAS — Global Flood Awareness', url: 'https://global-flood.emergency.copernicus.eu', tags: ['flood forecast', 'river discharge', 'reanalysis'], desc: 'River discharge forecasts and historical reanalysis — useful where gauges are missing.' },
  { cat: 'global', name: 'NASA FIRMS', url: 'https://firms.modaps.eosdis.nasa.gov', tags: ['forest fire', 'hotspots', 'real-time'], desc: 'Near real-time active fire detections (MODIS/VIIRS).' },
  { cat: 'global', name: 'USGS Earthquake Hazards', url: 'https://earthquake.usgs.gov', tags: ['earthquake', 'seismic', 'ShakeMap'], desc: 'Earthquake catalog, ShakeMaps and seismic hazard data.' },
  { cat: 'global', name: 'ArcGIS Living Atlas', url: 'https://livingatlas.arcgis.com', tags: ['basemaps', 'imagery', 'layers'], desc: 'Curated web layers and imagery (many are free to view).' },

  // ---------------- Tools ----------------
  { cat: 'tools', name: 'QGIS', url: 'https://qgis.org', tags: ['desktop GIS', 'free', 'open source'], desc: 'Free professional desktop GIS — digitising, analysis, cartography, 1000+ plugins.' },
  { cat: 'tools', name: 'GRASS GIS', url: 'https://grass.osgeo.org', tags: ['hydrology', 'raster', 'terrain'], desc: 'Powerful raster/terrain/hydrology engine (also inside QGIS Processing).' },
  { cat: 'tools', name: 'WhiteboxTools', url: 'https://www.whiteboxgeo.com', tags: ['hydrology', 'lidar', 'terrain'], desc: '450+ geomorphometry and hydrology tools; MapNiti uses it for watershed analysis.' },
  { cat: 'tools', name: 'GDAL / OGR', url: 'https://gdal.org', tags: ['conversion', 'reprojection', 'command line'], desc: 'The Swiss-army knife for converting and reprojecting any raster/vector format.' },
  { cat: 'tools', name: 'PostGIS', url: 'https://postgis.net', tags: ['spatial database', 'SQL'], desc: 'Spatial database for multi-user GIS, web maps and big vector data.' },
  { cat: 'tools', name: 'GeoServer', url: 'https://geoserver.org', tags: ['WMS', 'WFS', 'web GIS'], desc: 'Publish your layers as standard OGC web services.' },
  { cat: 'tools', name: 'ESA SNAP', url: 'https://step.esa.int/main/download/snap-download/', tags: ['Sentinel', 'SAR', 'InSAR'], desc: 'Sentinel toolbox — SAR processing, InSAR deformation, optical pre-processing.' },
  { cat: 'tools', name: 'HEC-RAS', url: 'https://www.hec.usace.army.mil/software/hec-ras/', tags: ['hydraulics', 'flood', '1D/2D'], desc: 'River hydraulics and 2D flood modelling — industry standard, free.' },
  { cat: 'tools', name: 'HEC-HMS', url: 'https://www.hec.usace.army.mil/software/hec-hms/', tags: ['hydrology', 'rainfall-runoff'], desc: 'Rainfall-runoff modelling of catchments — free.' },
  { cat: 'tools', name: 'Google Earth Pro', url: 'https://www.google.com/earth/about/versions/', tags: ['imagery', 'KML', 'historical'], desc: 'Historical imagery slider, KML drawing, quick site reconnaissance.' },
  { cat: 'tools', name: 'OpenDroneMap', url: 'https://opendronemap.org', tags: ['drone', 'photogrammetry', 'orthophoto', 'DSM'], desc: 'Turn drone photos into orthomosaics, DSMs and 3D models — free.' },
  { cat: 'tools', name: 'CloudCompare', url: 'https://www.cloudcompare.org', tags: ['point cloud', 'lidar', 'volume'], desc: 'Point-cloud processing, cut/fill volume and change detection.' },
  { cat: 'tools', name: 'QField', url: 'https://qfield.org', tags: ['field survey', 'mobile', 'QGIS'], desc: 'Take QGIS projects to the field on Android/iOS; GNSS data collection.' },
  { cat: 'tools', name: 'KoboToolbox', url: 'https://www.kobotoolbox.org', tags: ['field forms', 'survey', 'GPS'], desc: 'Free mobile forms with GPS for household, building and asset surveys.' },
  { cat: 'tools', name: 'geemap', url: 'https://geemap.org', tags: ['Python', 'Earth Engine', 'Jupyter'], desc: 'Interactive Earth Engine mapping in Python/Jupyter/Colab.' },
  { cat: 'tools', name: 'leafmap', url: 'https://leafmap.org', tags: ['Python', 'web maps', 'COG'], desc: 'Quick interactive maps and cloud-native raster/vector viewing in Python.' },
  { cat: 'tools', name: 'Earth Engine Code Editor', url: 'https://code.earthengine.google.com', tags: ['JavaScript', 'GEE', 'scripts'], desc: 'Run the GEE scripts from the Learn GIS lessons here (free sign-up for non-commercial use).' },

  // ---------------- AI ----------------
  { cat: 'ai', name: 'MapNiti AI Assistant', url: null, module: 'ai', tags: ['chat', 'GIS', 'code', 'civil'], desc: 'Built in: ask for GEE / Python code, drainage design steps, CRS help and data sources.' },
  { cat: 'ai', name: 'Claude', url: 'https://claude.ai', tags: ['AI assistant', 'code', 'reports'], desc: 'General AI assistant — long reports, code review, document analysis.' },
  { cat: 'ai', name: 'Segment Geospatial (SAM)', url: 'https://samgeo.gishub.org', tags: ['segmentation', 'buildings', 'AI'], desc: 'Meta\'s Segment Anything for satellite/drone imagery — extract buildings, fields, water.' },
  { cat: 'ai', name: 'GeoAI', url: 'https://opengeoai.org', tags: ['deep learning', 'object detection', 'Python'], desc: 'Python package for AI on geospatial data: detection, classification, change detection.' },
  { cat: 'ai', name: 'NASA-IBM Prithvi models', url: 'https://huggingface.co/ibm-nasa-geospatial', tags: ['foundation model', 'flood', 'crops', 'burn scars'], desc: 'Open geospatial foundation models fine-tuned for floods, crops and burn scars.' },
  { cat: 'ai', name: 'TorchGeo', url: 'https://github.com/microsoft/torchgeo', tags: ['PyTorch', 'datasets', 'models'], desc: 'PyTorch library with geospatial datasets, samplers and pre-trained models.' },
  { cat: 'ai', name: 'Deepness (QGIS plugin)', url: 'https://plugins.qgis.org/plugins/deepness/', tags: ['QGIS', 'ONNX', 'segmentation'], desc: 'Run deep-learning models (segmentation, detection) directly inside QGIS.' },
];

const CATS = [
  { id: 'all', label: 'All', icon: Compass },
  { id: 'nepal', label: 'Nepal Government & National', icon: Landmark },
  { id: 'global', label: 'Global Data Portals', icon: Globe2 },
  { id: 'tools', label: 'Software & Tools', icon: Wrench },
  { id: 'ai', label: 'AI Tools', icon: Sparkles },
];

// "What data do I need for …?" — task-first guide
const RECIPES = [
  {
    task: 'Road alignment / feasibility study',
    data: ['DEM & slope (SRTM / Copernicus / ALOS)', 'Geology & faults (DMG)', 'Land cover & settlements (WorldCover, Open Buildings, OSM)', 'Rivers & crossings (OSM, Survey Dept.)', 'Rainfall (DHM, CHIRPS)', 'Landslide inventory (Bipad)'],
    mapniti: [['Site Report', 'engineer'], ['Elevation Profile', 'engineer'], ['GEE Data Hub → Slope', 'gee-hub']],
  },
  {
    task: 'Culvert / drainage design',
    data: ['Catchment from DEM', 'Design rainfall — DHM station IDF or CHIRPS annual maxima', 'Land cover for runoff coefficient', 'Soil texture (infiltration)'],
    mapniti: [['Hydrology → Watershed', 'hydrology'], ['Rational method & Manning calculators', 'engineer'], ['CHIRPS max 1-day', 'gee-hub']],
  },
  {
    task: 'Flood & landslide hazard mapping',
    data: ['Sentinel-1 radar (flood extent)', 'JRC surface water history', 'DEM / slope / HAND', 'Rainfall', 'Geology', 'Event inventory (Bipad)', 'River levels (hydrology.gov.np)'],
    mapniti: [['Hydrology → Flood tools', 'hydrology'], ['Sentinel-1 / Surface Water', 'gee-hub']],
  },
  {
    task: 'Hydropower / water supply pre-feasibility',
    data: ['Catchment & head from DEM', 'Discharge records (DHM hydrology)', 'GloFAS reanalysis where ungauged', 'Snow cover (MODIS)', 'Rainfall & temperature'],
    mapniti: [['Watershed Delineation', 'hydrology'], ['Snow cover / ERA5 time series', 'gee-hub']],
  },
  {
    task: 'Urban planning & building permits',
    data: ['Cadastral parcels (Survey Dept. / land revenue office)', 'Building footprints (Open Buildings, OSM)', 'Population (WorldPop, Census 2021)', 'Built-up growth (GHSL, Dynamic World)', 'Municipal bylaws'],
    mapniti: [['Urban Planning tools', 'urban'], ['Built-up / Population', 'gee-hub']],
  },
  {
    task: 'Agriculture & irrigation planning',
    data: ['NDVI time series (MODIS / Sentinel-2)', 'Soil properties (OpenLandMap / SoilGrids)', 'Rainfall & temperature', 'Land cover / cropland', 'Irrigation canals (OSM)'],
    mapniti: [['NDVI / LULC', 'data-management'], ['Soil & rainfall layers', 'gee-hub']],
  },
  {
    task: 'Solar / wind energy siting',
    data: ['Solar irradiation (Global Solar Atlas, NASA POWER)', 'Wind (Global Wind Atlas)', 'Slope & aspect', 'Land cover & protected areas', 'Grid lines (NEA / OSM)'],
    mapniti: [['Aspect / Slope layers', 'gee-hub'], ['Site Report', 'engineer']],
  },
  {
    task: 'Census & socio-economic analysis',
    data: ['Census 2021 (NSO)', 'Local-level profiles (MoFAGA)', 'Population grids (WorldPop)', 'Night lights (VIIRS)', 'Facilities (HDX, OSM)'],
    mapniti: [['Population / Night lights', 'gee-hub']],
  },
];

export default function DataSources({ onOpenModule }) {
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    const s = q.trim().toLowerCase();
    return SOURCES.filter((x) => (cat === 'all' || x.cat === cat) &&
      (!s || `${x.name} ${x.desc} ${x.tags.join(' ')}`.toLowerCase().includes(s)));
  }, [cat, q]);

  return (
    <div className="h-full w-full overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Data Sources & Tools</h1>
          <p className="text-sm text-slate-500 mt-1">Where to get the data engineers need: Nepal government portals, global datasets, software and AI tools.</p>
        </div>

        <section>
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">What data do I need for…</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {RECIPES.map((r) => (
              <div key={r.task} className="p-4 bg-white rounded-2xl border border-slate-100 flex flex-col">
                <p className="text-[13px] font-black text-slate-800">{r.task}</p>
                <ul className="mt-2 space-y-1 flex-grow">
                  {r.data.map((d) => <li key={d} className="text-[11px] text-slate-600 flex gap-1.5"><span className="text-blue-500">•</span>{d}</li>)}
                </ul>
                <div className="mt-3 pt-2 border-t border-slate-50 flex flex-wrap gap-1">
                  {r.mapniti.map(([label, mod]) => (
                    <button key={label} onClick={() => onOpenModule?.(mod)}
                      className="text-[9px] font-bold px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-0.5">
                      {label} <ArrowRight size={9} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {CATS.map((c) => (
                <button key={c.id} onClick={() => setCat(c.id)}
                  className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full border ${cat === c.id ? 'bg-[#0047AB] text-white border-[#0047AB]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                  <c.icon size={12} /> {c.label}
                </button>
              ))}
            </div>
            <div className="relative md:w-72">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: rainfall, cadastral, lidar…"
                className="w-full pl-9 pr-3 py-2 text-[12px] border border-slate-200 rounded-xl bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((s) => {
              const Inner = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-black text-slate-800 group-hover:text-blue-700">{s.name}</p>
                    <ExternalLink size={13} className="text-slate-300 group-hover:text-blue-500 shrink-0 mt-0.5" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">{s.desc}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.tags.slice(0, 4).map((t) => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t}</span>)}
                  </div>
                  {s.url && <p className="text-[9px] text-slate-400 mt-2 truncate">{s.url.replace(/^https?:\/\//, '')}</p>}
                </>
              );
              return s.url ? (
                <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="group p-4 bg-white rounded-2xl border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all">{Inner}</a>
              ) : (
                <button key={s.name} onClick={() => onOpenModule?.(s.module)} className="group text-left p-4 bg-white rounded-2xl border border-violet-200 hover:shadow-md transition-all">{Inner}</button>
              );
            })}
          </div>
          {!items.length && <p className="text-center text-sm text-slate-400 py-8">No matches. Try a different word.</p>}
          <p className="text-[10px] text-slate-400">Check each provider's licence before commercial use. Government data may need an official request letter.</p>
        </section>
      </div>
    </div>
  );
}
