// "Learn Programming: Python for Geospatial" — table of contents.
// Each chapter's text lives in public/book/<id>.md (plain Markdown, fetched on demand).

export const BOOK_TITLE = 'Learn Programming';
export const BOOK_SUBTITLE = 'Python for Geospatial Analysis';

export const BOOK = [
  {
    part: 'Overview and Setup',
    chapters: [
      { id: 'why-python', title: 'Why Python for Geospatial', minutes: 8 },
      { id: 'setup', title: 'Environment Setup', minutes: 10 },
      { id: 'datasets', title: 'Practice Datasets', minutes: 6 },
    ],
  },
  {
    part: 'Basic Elements of Python',
    chapters: [
      { id: 'variables', title: 'Data Types and Variables', minutes: 14 },
      { id: 'operators', title: 'Operators, Math and Comments', minutes: 12 },
      { id: 'lists', title: 'Lists and Indexing', minutes: 14 },
      { id: 'dictionaries', title: 'Dictionaries', minutes: 12 },
      { id: 'conditions-loops', title: 'Conditions and Loops', minutes: 16 },
      { id: 'functions', title: 'Functions', minutes: 14 },
      { id: 'files', title: 'Reading and Writing Files', minutes: 14 },
      { id: 'classes', title: 'Classes and Objects', minutes: 14 },
      { id: 'exceptions', title: 'Exceptions and Error Handling', minutes: 12 },
    ],
  },
  {
    part: 'Data Analysis with Pandas',
    chapters: [
      { id: 'pandas-intro', title: 'What is pandas?', minutes: 12 },
      { id: 'pandas-explore', title: 'Exploring Data', minutes: 14 },
      { id: 'pandas-process', title: 'Cleaning and Processing Data', minutes: 16 },
      { id: 'pandas-plot', title: 'Plotting with Matplotlib', minutes: 14 },
    ],
  },
  {
    part: 'Exploring Geospatial Data',
    chapters: [
      { id: 'shapely', title: 'Geometry with Shapely', minutes: 14 },
      { id: 'crs', title: 'Coordinate Systems with pyproj', minutes: 12 },
      { id: 'geopandas', title: 'GeoPandas', minutes: 16 },
      { id: 'gdal-ogr', title: 'GDAL and OGR', minutes: 16 },
      { id: 'rasterio', title: 'Rasterio', minutes: 14 },
      { id: 'folium', title: 'Web Maps with Folium', minutes: 10 },
    ],
  },
  {
    part: 'Geospatial Data Analysis',
    chapters: [
      { id: 'vector-analysis', title: 'Vector Analysis with GeoPandas', minutes: 18 },
      { id: 'raster-analysis', title: 'Raster Analysis', minutes: 16 },
      { id: 'pyqgis', title: 'Python and QGIS', minutes: 14 },
    ],
  },
  {
    part: 'DEM Analysis',
    chapters: [
      { id: 'dem-intro', title: 'Introduction to DEMs', minutes: 12 },
      { id: 'dem-products', title: 'Slope, Aspect and Hillshade', minutes: 14 },
      { id: 'cut-fill', title: 'Cut and Fill Analysis', minutes: 14 },
    ],
  },
];

export const CHAPTERS = BOOK.flatMap((p, pi) => p.chapters.map((c) => ({ ...c, part: p.part, partIndex: pi })));
export const chapterById = (id) => CHAPTERS.find((c) => c.id === id);
