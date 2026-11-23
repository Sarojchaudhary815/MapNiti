// Custom MapboxDraw style array: extends the library's default theme
// (node_modules/@mapbox/mapbox-gl-draw/src/lib/theme.js) with data-driven
// paint pulled from per-feature `user_*` properties (requires the Draw
// instance to be constructed with `userProperties: true`) so each
// digitized layer group can carry its own color/width/opacity/dash/shape
// instead of every feature sharing one hardcoded style.

const ACTIVE = '#fbb03b';
const DEFAULT_COLOR = '#3bb2d0';
const WHITE = '#fff';
const CASING_COLOR = '#1e293b';

export const POINT_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'star'];

const colorExpr = ['case', ['==', ['get', 'active'], 'true'], ACTIVE, ['coalesce', ['get', 'user_color'], DEFAULT_COLOR]];
const opacityExpr = ['coalesce', ['get', 'user_opacity'], 1];
const lineWidthExpr = ['case',
  ['==', ['get', 'active'], 'true'], ['+', ['coalesce', ['get', 'user_lineWidth'], 2], 1],
  ['coalesce', ['get', 'user_lineWidth'], 2],
];
const pointRadiusExpr = ['coalesce', ['get', 'user_pointRadius'], 5];

export default function buildDrawStyles() {
  return [
    // Polygon fill
    {
      id: 'gl-draw-polygon-fill',
      type: 'fill',
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': colorExpr,
        'fill-opacity': ['case', ['==', ['get', 'active'], 'true'], 0.35, ['*', opacityExpr, 0.25]],
      },
    },
    // Dark casing under every line (road-style: bright centerline over a
    // dark outline) — drawn once here, ahead of the solid/dashed variants
    // below, so it renders underneath them regardless of the line's own
    // dash setting.
    {
      id: 'gl-draw-lines-casing',
      type: 'line',
      filter: ['==', '$type', 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': CASING_COLOR,
        'line-width': ['+', lineWidthExpr, 4],
        'line-opacity': opacityExpr,
      },
    },
    // Solid-line variant (lines + polygon outlines that are NOT dashed)
    {
      id: 'gl-draw-lines-solid',
      type: 'line',
      filter: ['all',
        ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
        ['!=', 'user_dashed', 'true'],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colorExpr,
        'line-width': lineWidthExpr,
        'line-opacity': opacityExpr,
      },
    },
    // Dashed-line variant
    {
      id: 'gl-draw-lines-dashed',
      type: 'line',
      filter: ['all',
        ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
        ['==', 'user_dashed', 'true'],
      ],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': colorExpr,
        'line-width': lineWidthExpr,
        'line-opacity': opacityExpr,
        'line-dasharray': [2, 2],
      },
    },
    // Direction arrows along a *selected* line only, echoing the reference
    // road-editor look — reuses the triangle SDF image already registered
    // for point shapes (apex points "up", so symbol-placement: 'line' can
    // auto-rotate it to each segment's bearing) rather than adding a
    // second icon just for this.
    {
      id: 'gl-draw-line-direction-arrows',
      type: 'symbol',
      // Legacy filter syntax throughout: mixing it with expression syntax
      // (['get', 'active']) is rejected by the map's style validator.
      filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 60,
        'icon-image': 'digitize-shape-triangle',
        'icon-size': 0.5,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': '#2563eb',
        'icon-opacity': 1,
      },
    },
    // Points — colored halo + inner dot (always shown; carries hit-testing)
    {
      id: 'gl-draw-point-outer',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
      paint: {
        'circle-radius': ['+', pointRadiusExpr, 2],
        'circle-color': WHITE,
        'circle-opacity': opacityExpr,
      },
    },
    {
      id: 'gl-draw-point-inner',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
      paint: {
        'circle-radius': pointRadiusExpr,
        'circle-color': colorExpr,
        'circle-opacity': opacityExpr,
      },
    },
    // Point shape overlay — only rendered when a non-circle shape is chosen
    {
      id: 'gl-draw-point-shape',
      type: 'symbol',
      filter: ['all',
        ['==', '$type', 'Point'], ['==', 'meta', 'feature'],
        ['has', 'user_pointShape'], ['!=', 'user_pointShape', 'circle'],
      ],
      layout: {
        'icon-image': ['concat', 'digitize-shape-', ['coalesce', ['get', 'user_pointShape'], 'circle']],
        'icon-size': ['/', ['+', pointRadiusExpr, 2], 8],
        'icon-allow-overlap': true,
      },
      paint: {
        'icon-color': colorExpr,
        'icon-opacity': opacityExpr,
      },
    },
    // Feature label (from whichever attribute the layer's "label field" points at)
    {
      id: 'gl-draw-feature-label',
      type: 'symbol',
      filter: ['all', ['==', 'meta', 'feature'], ['has', 'user_label']],
      layout: {
        'text-field': ['get', 'user_label'],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#1e293b',
        'text-halo-color': '#fff',
        'text-halo-width': 1.2,
      },
    },
    // Vertex handles (editing)
    {
      id: 'gl-draw-vertex-outer',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
      paint: {
        'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 7, 5],
        'circle-color': WHITE,
      },
    },
    {
      id: 'gl-draw-vertex-inner',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
      paint: {
        'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
        'circle-color': ACTIVE,
      },
    },
    // Midpoints (click/drag to insert a vertex)
    {
      id: 'gl-draw-midpoint',
      type: 'circle',
      filter: ['==', 'meta', 'midpoint'],
      paint: {
        'circle-radius': 3,
        'circle-color': ACTIVE,
      },
    },
  ];
}

// Small canvas-drawn alpha-mask icons registered once as SDF images so
// `icon-color` can tint them per layer group. Not true signed-distance
// fields (edges aren't sub-pixel smooth) — a solid alpha shape is enough
// for a small point marker and avoids pulling in an SDF-generation lib.
export function registerPointShapeImages(map) {
  const SIZE = 32;
  const mid = SIZE / 2;

  const shapes = {
    square: (ctx) => { ctx.fillRect(mid - 10, mid - 10, 20, 20); },
    triangle: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(mid, mid - 12);
      ctx.lineTo(mid + 11, mid + 9);
      ctx.lineTo(mid - 11, mid + 9);
      ctx.closePath();
      ctx.fill();
    },
    diamond: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(mid, mid - 12);
      ctx.lineTo(mid + 12, mid);
      ctx.lineTo(mid, mid + 12);
      ctx.lineTo(mid - 12, mid);
      ctx.closePath();
      ctx.fill();
    },
    star: (ctx) => {
      const spikes = 5, outerR = 12, innerR = 5;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / spikes) * i - Math.PI / 2;
        const x = mid + Math.cos(angle) * r;
        const y = mid + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    },
  };

  Object.entries(shapes).forEach(([name, draw]) => {
    const id = `digitize-shape-${name}`;
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    draw(ctx);
    map.addImage(id, ctx.getImageData(0, 0, SIZE, SIZE), { sdf: true });
  });
}
