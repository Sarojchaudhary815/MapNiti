import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ExternalLink, Rocket, Satellite, Brain, Cloud, Monitor, Rss, CheckCircle2 } from 'lucide-react';
import { CodeBlock } from '../../components/common/Markdown';

// Researched September 2026 — each item links to its primary source.
const UPDATES = [
  {
    date: 'Jul 2026', tag: 'Satellite data', icon: Satellite,
    title: 'NISAR L-band radar data now public',
    text: 'NASA–ISRO\'s NISAR mission began its public data release on 20 July 2026 (observations from 17 June 2026 onward), with the full science record expected by the end of 2026. It images every landmass every 12 days at 5–10 m, and its L-band penetrates vegetation, which is useful for landslides, subsidence, forest biomass and flood mapping in Nepal\'s hills.',
    links: [['NASA Earthdata announcement', 'https://www.earthdata.nasa.gov/news/nisar-l-band-data-released-expanding-record-surface-changes'], ['NISAR data access (Earthdata)', 'https://www.earthdata.nasa.gov/data/platforms/space-based-platforms/nisar/data-access-tools']],
  },
  {
    date: 'Jul 2026', tag: 'GeoAI', icon: Brain,
    title: 'Custom Satellite Embeddings (AlphaEarth Foundations)',
    text: 'Google announced an Enterprise Private Preview of Custom Satellite Embeddings powered by DeepMind\'s AlphaEarth Foundations. It generates on-demand embeddings for custom regions at intervals as short as 5 days. The free annual Satellite Embedding dataset (64 values per 10 m pixel, 2017–2024, with 2025 in progress) is already in Earth Engine.',
    links: [['Google Maps Platform blog', 'https://mapsplatform.google.com/resources/blog/introducing-custom-satellite-embeddings-powered-by-alphaearth-foundations/'], ['Earth Engine dataset', 'https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL']],
  },
  {
    date: 'Jun 2026', tag: 'New software', icon: Rocket,
    title: 'GeoLibre 1.0 — free cloud-native GIS that runs anywhere',
    text: 'Released on 10 June 2026 by Qiusheng Wu (opengeos). It runs in the browser, on desktop, on mobile and in Jupyter, with 1,000+ geoprocessing tools compiled to WebAssembly. See the full section below.',
    links: [['Release blog', 'https://gishub.org/blog/geolibre/'], ['GitHub', 'https://github.com/opengeos/GeoLibre']],
  },
  {
    date: 'Apr 2026', tag: 'Satellite data', icon: Satellite,
    title: 'Sentinel-1D data opens to users',
    text: 'Sentinel-1D launched on 4 November 2025 on Ariane 6 and opened for user data from 17 April 2026. It takes over from Sentinel-1A, keeping free C-band radar coverage for flood and deformation monitoring.',
    links: [['Copernicus Data Space news', 'https://dataspace.copernicus.eu/news/2026-4-2-sentinel-1d-user-data-opening-and-future-plans']],
  },
  {
    date: 'Mar 2026', tag: 'Desktop GIS', icon: Monitor,
    title: 'QGIS 4.0 "Norrköping" released',
    text: 'Released on 6 March 2026, the first QGIS on Qt 6. It brings a modernised interface, a new welcome page, performance and security improvements, and 100+ new features. Most plugins keep working because deprecated APIs were kept where possible.',
    links: [['QGIS blog', 'https://blog.qgis.org/2026/03/09/qgis-4-0-norrkoping-is-released/'], ['Visual changelog', 'https://changelog.qgis.org/en/version/4.0/']],
  },
  {
    date: '2025–2026', tag: 'Open data', icon: Cloud,
    title: 'Overture Maps + GeoParquet + DuckDB go mainstream',
    text: 'Overture Maps publishes global buildings, roads, places, addresses and boundaries as GeoParquet on cloud storage, with regular releases through 2026 (e.g. 2026-08-19.0). DuckDB\'s spatial extension queries only the needed part over HTTP, so a city extract no longer means downloading gigabytes.',
    links: [['Overture + DuckDB docs', 'https://docs.overturemaps.org/getting-data/duckdb/'], ['GeoParquet', 'https://geoparquet.org/']],
  },
  {
    date: '2025', tag: 'GeoAI', icon: Brain,
    title: 'Open Earth-observation foundation models: Prithvi-EO-2.0 & TerraMind',
    text: 'Prithvi-EO-2.0 (NASA, IBM and Jülich) is open on Hugging Face and received AGU\'s 2025 Open Science Recognition Prize. TerraMind (IBM with ESA) is a multimodal EO model. Fine-tune them for floods, burn scars and crop mapping with far less training data.',
    links: [['Prithvi-EO-2.0 on GitHub', 'https://github.com/NASA-IMPACT/Prithvi-EO-2.0'], ['IBM Research blog', 'https://research.ibm.com/blog/earth-observation-leadership']],
  },
  {
    date: 'Nov 2025', tag: 'Desktop GIS', icon: Monitor,
    title: 'ArcGIS Pro 3.6',
    text: 'Released on 13 November 2025 with a redesigned ModelBuilder, a single map time zone, a geodatabase schema-comparison tool and no more name-length limits for databases.',
    links: [['What\'s new in ArcGIS Pro 3.6', 'https://pro.arcgis.com/en/pro-app/3.6/get-started/whats-new-in-arcgis-pro.htm']],
  },
];

const TRENDS = [
  ['GIS in the browser', 'WebAssembly lets full geoprocessing (GeoLibre, DuckDB-WASM) run locally in a web page — no installs, and data stays private.'],
  ['Cloud-native formats', 'COG, STAC, GeoParquet, Zarr and PMTiles replace "download then open". You stream only the tiles or rows you need.'],
  ['Foundation models & embeddings', 'Pre-trained EO models and satellite embeddings make land-cover mapping and change detection possible with a handful of labels.'],
  ['More free radar', 'NISAR (L-band) plus Sentinel-1C/D (C-band) give frequent, cloud-proof monitoring for monsoon floods and landslides.'],
  ['AI assistants for GIS', 'Chat assistants now write Earth Engine/Python code and explain workflows. Treat their output as a draft and verify it (see MapNiti AI).'],
  ['3D & digital twins', '3D Tiles, Gaussian splats and drone meshes are moving into mainstream viewers such as CesiumJS, ArcGIS and GeoLibre.'],
];

const FEEDS = [
  ['QGIS blog', 'https://blog.qgis.org'], ['Google Earth & Earth Engine (Medium)', 'https://medium.com/google-earth'],
  ['NASA Earthdata news', 'https://www.earthdata.nasa.gov/news'], ['Copernicus Data Space news', 'https://dataspace.copernicus.eu/news'],
  ['GIS Hub — Qiusheng Wu', 'https://gishub.org'], ['Spatialists (geospatial news)', 'https://spatialists.ch'],
];

export default function WhatsNewPage() {
  return (
    <div className="bg-slate-50">
      <section className="bg-gradient-to-br from-slate-900 via-theme-900 to-theme-700 text-white">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-yellow-300 flex items-center gap-2"><Sparkles size={15} /> What's new in GIS · updated September 2026</p>
          <h1 className="text-3xl md:text-5xl font-black mt-3 max-w-4xl">New tools, satellites and AI changing geospatial work</h1>
          <p className="text-theme-100 mt-3 max-w-3xl">The releases and trends that matter most for engineers and GIS professionals, each with links to the original source.</p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        <section>
          <h2 className="text-2xl font-black text-slate-800">Latest updates</h2>
          <div className="mt-6 space-y-4">
            {UPDATES.map((u) => (
              <div key={u.title} className="p-5 bg-white rounded-2xl border border-slate-100 flex gap-4">
                <div className="hidden sm:flex flex-col items-center gap-2 w-20 shrink-0">
                  <div className="p-3 rounded-xl bg-theme-50 text-theme-700"><u.icon size={20} /></div>
                  <span className="text-[11px] font-bold text-slate-400 text-center">{u.date}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-theme-600">{u.tag}</span>
                  <h3 className="text-lg font-black text-slate-800">{u.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{u.text}</p>
                  <div className="flex flex-wrap gap-3 mt-2">
                    {u.links.map(([l, href]) => (
                      <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-theme-700 hover:underline flex items-center gap-1">{l} <ExternalLink size={11} /></a>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="geolibre" className="scroll-mt-24">
          <div className="rounded-3xl overflow-hidden border border-slate-200 bg-white">
            <div className="p-8 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">Spotlight</p>
              <h2 className="text-3xl font-black mt-1">GeoLibre</h2>
              <p className="mt-2 max-w-3xl text-emerald-50">A free, open-source (MIT) cloud-native GIS for viewing, exploring and analysing geospatial data. It runs in the web browser, as a desktop app, on mobile and inside Jupyter notebooks, and keeps your data local and private.</p>
              <div className="flex flex-wrap gap-2 mt-5">
                <a href="https://web.geolibre.app/" target="_blank" rel="noopener noreferrer" className="text-sm font-bold bg-white text-emerald-700 px-4 py-2 rounded-xl">Launch GeoLibre Web ↗</a>
                <a href="https://geolibre.app/getting-started/" target="_blank" rel="noopener noreferrer" className="text-sm font-bold bg-white/15 border border-white/30 px-4 py-2 rounded-xl">Getting started guide ↗</a>
                <a href="https://github.com/opengeos/GeoLibre" target="_blank" rel="noopener noreferrer" className="text-sm font-bold bg-white/15 border border-white/30 px-4 py-2 rounded-xl">GitHub ↗</a>
              </div>
            </div>
            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div>
                  <h3 className="font-black text-slate-800">Key facts</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    {[
                      'Version 1.0 released 10 June 2026 by Qiusheng Wu (creator of geemap and leafmap).',
                      '1,000+ geoprocessing tools running in WebAssembly: vector analysis, raster processing, remote sensing, hydrology, terrain and LiDAR.',
                      'Opens GeoJSON, Shapefile, GeoPackage, GeoParquet, FlatGeobuf, KML/KMZ, GPX, GeoTIFF/COG, Zarr, PMTiles/MBTiles, LiDAR point clouds, 3D Tiles and ArcGIS services.',
                      'Built with Tauri v2, React, TypeScript, MapLibre GL JS, DuckDB-WASM Spatial and deck.gl.',
                      'Features include attribute tables and editing, measurement, bookmarks, a SQL workspace, a Python console, AI segmentation, story maps and plugins.',
                      'No account, no server, no cost. Desktop builds for Windows, macOS and Linux, plus Android and iOS apps.',
                    ].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />{t}</li>)}
                  </ul>
                </div>
                <div>
                  <h3 className="font-black text-slate-800">When to use GeoLibre vs QGIS vs MapNiti</h3>
                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-[13px] border border-slate-100">
                      <thead className="bg-slate-50"><tr><th className="p-2 text-left">Need</th><th className="p-2 text-left">Best choice</th></tr></thead>
                      <tbody>
                        {[
                          ['Quickly view / inspect a file on any computer, no install', 'GeoLibre Web'],
                          ['Big cloud datasets (COG, GeoParquet, PMTiles) without downloading', 'GeoLibre'],
                          ['Full desktop cartography, print layouts, plugins ecosystem', 'QGIS 4'],
                          ['Satellite analysis on Google Earth Engine, engineering reports, Nepal datasets', 'MapNiti'],
                          ['Notebook workflows (Python / R)', 'GeoLibre in Jupyter, geemap, leafmap'],
                        ].map(([a, b]) => <tr key={a} className="border-t border-slate-100"><td className="p-2">{a}</td><td className="p-2 font-bold">{b}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-black text-slate-800">Install & use it</h3>
                <p className="text-sm text-slate-600"><b>Web:</b> open web.geolibre.app, then drag a GeoTIFF or GeoJSON onto the map. <b>Desktop:</b> installers from the downloads page, Microsoft Store, Mac App Store, winget, Homebrew or Flatpak. <b>Mobile:</b> Google Play and the App Store.</p>
                <p className="text-sm text-slate-600"><b>Python / Jupyter</b> (it embeds the full app with a leafmap-style API that syncs both ways):</p>
                <CodeBlock lang="bash" code={'pip install geolibre\n# or\nconda install -c conda-forge geolibre'} />
                <CodeBlock lang="python-notebook" code={'import geolibre\n\nm = geolibre.Map()\nm   # the GeoLibre app appears in the notebook cell'} />
                <p className="text-sm text-slate-600"><b>R:</b> <code className="px-1 bg-slate-100 rounded">install.packages("geolibre")</code> — works in RStudio, Quarto, R Markdown and Shiny.</p>
                <p className="text-sm text-slate-600"><b>Developers:</b></p>
                <CodeBlock lang="bash" code={'git clone https://github.com/opengeos/GeoLibre.git\ncd GeoLibre\nnpm install\nnpm run dev        # browser UI at http://localhost:5173\nnpm run tauri:dev  # desktop app (needs Node 22+ and Rust)'} />
                <p className="text-xs text-slate-400">Sources: <a className="underline" href="https://gishub.org/blog/geolibre/" target="_blank" rel="noopener noreferrer">GeoLibre 1.0 blog</a>, <a className="underline" href="https://geolibre.app/getting-started/" target="_blank" rel="noopener noreferrer">Getting started</a>, <a className="underline" href="https://github.com/opengeos/GeoLibre" target="_blank" rel="noopener noreferrer">GitHub README</a>.</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-black text-slate-800">Big trends to follow</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {TRENDS.map(([t, d]) => (
              <div key={t} className="p-5 bg-white rounded-2xl border border-slate-100">
                <p className="font-black text-slate-800">{t}</p>
                <p className="text-[13px] text-slate-600 mt-1">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 p-5 rounded-2xl bg-theme-50 border border-theme-100">
            <p className="font-black text-theme-900">What this means for engineers in Nepal</p>
            <ul className="mt-2 space-y-1 text-sm text-theme-900/80 list-disc pl-5">
              <li>Monsoon flood and landslide monitoring gets better. Radar from NISAR and Sentinel-1 sees through clouds; try it in <Link className="underline font-bold" to="/learn/earth-engine">Earth Engine lessons</Link>.</li>
              <li>You can do serious GIS on any laptop or even a phone (GeoLibre, MapNiti), with no expensive licences.</li>
              <li>Learn Python + one web-mapping library. Most new tools are scriptable and notebook-friendly. Start with the <Link className="underline font-bold" to="/learn">learning path</Link>.</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Rss size={18} /> Stay updated</h2>
          <div className="flex flex-wrap gap-2 mt-4">
            {FEEDS.map(([l, h]) => <a key={h} href={h} target="_blank" rel="noopener noreferrer" className="text-sm font-bold px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-theme-400 text-slate-700 flex items-center gap-1">{l} <ExternalLink size={12} /></a>)}
          </div>
        </section>
      </div>
    </div>
  );
}
