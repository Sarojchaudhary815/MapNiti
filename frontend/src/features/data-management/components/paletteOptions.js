// Gradient color ramps offered for continuous-value raster results
// (NDVI/NDWI/NDBI/Raster Calculator) — ids must match the backend's
// PALETTE_PRESETS keys in raster_service.py.
export const PALETTE_OPTIONS = [
  { id: 'default', label: 'Default', colors: null }, // null = use the tool's built-in palette
  { id: 'spectral', label: 'Spectral', colors: ['#9e0142', '#f46d43', '#ffffbf', '#abdda4', '#3288bd'] },
  { id: 'ndvi_classic', label: 'NDVI Classic', colors: ['#a52a2a', '#ffff99', '#9acd32', '#006400'] },
  { id: 'blues', label: 'Blues', colors: ['#f7fbff', '#9ecae1', '#4292c6', '#08306b'] },
  { id: 'viridis', label: 'Viridis', colors: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'] },
  { id: 'grayscale', label: 'Grayscale', colors: ['#000000', '#808080', '#ffffff'] },
];
