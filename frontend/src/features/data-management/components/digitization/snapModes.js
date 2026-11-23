// Custom MapboxDraw modes: vertex/edge snapping (wrapping the built-in
// draw_point / draw_line_string / draw_polygon / direct_select modes) plus
// Rectangle and Circle drawing modes. Registered under NEW mode names
// (snap_point, snap_line_string, snap_polygon, snap_direct_select,
// draw_rectangle, draw_circle) — the built-in mode names are left untouched
// so the AOI-selection flow elsewhere in the app (which calls
// `changeMode('draw_polygon')` on this same shared Draw instance) is
// unaffected by snapping.
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';

const { constants: Constants, lib: { CommonSelectors, doubleClickZoom } } = MapboxDraw;

const SNAP_PIXEL_THRESHOLD = 12;

function nearestPointOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return { x: a.x, y: a.y };
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

// Finds the nearest vertex/edge (in screen-pixel space) across a set of
// GeoJSON features and returns a snapped LngLat, or null if nothing is
// within `threshold` pixels.
export function findSnapPoint(map, lngLat, features, threshold = SNAP_PIXEL_THRESHOLD) {
  if (!features || !features.length) return null;
  const p = map.project([lngLat.lng, lngLat.lat]);
  let bestPixel = null;
  let bestDist = threshold;

  const considerRing = (ring) => {
    if (!ring || !ring.length) return;
    const projected = ring.map((c) => map.project(c));
    projected.forEach((pt) => {
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < bestDist) { bestDist = d; bestPixel = pt; }
    });
    for (let i = 0; i < projected.length - 1; i++) {
      const proj = nearestPointOnSegment(p, projected[i], projected[i + 1]);
      const d = Math.hypot(proj.x - p.x, proj.y - p.y);
      if (d < bestDist) { bestDist = d; bestPixel = proj; }
    }
  };

  features.forEach((f) => {
    const g = f && f.geometry;
    if (!g) return;
    if (g.type === 'Point') considerRing([g.coordinates]);
    else if (g.type === 'LineString') considerRing(g.coordinates);
    else if (g.type === 'Polygon') g.coordinates.forEach(considerRing);
    else if (g.type === 'MultiLineString') g.coordinates.forEach(considerRing);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach(considerRing));
  });

  if (!bestPixel) return null;
  return map.unproject([bestPixel.x, bestPixel.y]);
}

// snapState = { enabled: boolean, getFeatures: () => GeoJSON.Feature[] } — a
// plain mutable object (kept in a ref by the caller) so the wrapped modes
// always read the *current* snapping toggle/target list, not whatever was
// current when the mode object was constructed.
export function makeSnapMode(baseMode, snapState) {
  const wrapped = { ...baseMode };

  const wrapHandler = (name) => {
    const original = baseMode[name];
    if (!original) return;
    wrapped[name] = function snapWrapped(state, e) {
      if (snapState.enabled && e && e.lngLat) {
        const snapped = findSnapPoint(this.map, e.lngLat, snapState.getFeatures());
        if (snapped) e = Object.assign({}, e, { lngLat: snapped });
      }
      return original.call(this, state, e);
    };
  };

  ['onClick', 'onTap', 'onMouseMove', 'onDrag'].forEach(wrapHandler);
  return wrapped;
}

// --- Rectangle (click first corner, click opposite corner to finish) ---
export function makeRectangleMode() {
  return {
    onSetup() {
      const rectangle = this.newFeature({
        type: Constants.geojsonTypes.FEATURE,
        properties: {},
        geometry: { type: Constants.geojsonTypes.POLYGON, coordinates: [[]] },
      });
      this.addFeature(rectangle);
      this.clearSelectedFeatures();
      doubleClickZoom.disable(this);
      this.updateUIClasses({ mouse: Constants.cursors.ADD });
      this.setActionableState({ trash: true });
      return { rectangle, origin: null };
    },
    updateRectangle(state, corner) {
      const [x0, y0] = state.origin;
      const [x1, y1] = corner;
      state.rectangle.setCoordinates([[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]]);
    },
    onClick(state, e) {
      const corner = [e.lngLat.lng, e.lngLat.lat];
      if (!state.origin) {
        state.origin = corner;
        this.updateRectangle(state, corner);
        return;
      }
      this.updateRectangle(state, corner);
      this.fire(Constants.events.CREATE, { features: [state.rectangle.toGeoJSON()] });
      this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.rectangle.id] });
    },
    onMouseMove(state, e) {
      if (!state.origin) return;
      this.updateRectangle(state, [e.lngLat.lng, e.lngLat.lat]);
    },
    onStop(state) {
      doubleClickZoom.enable(this);
      this.activateUIButton();
      if (this.getFeature(state.rectangle.id) === undefined) return;
      if (!state.origin || !state.rectangle.isValid()) {
        this.deleteFeature([state.rectangle.id], { silent: true });
      }
    },
    onTrash(state) {
      this.deleteFeature([state.rectangle.id], { silent: true });
      this.changeMode(Constants.modes.SIMPLE_SELECT);
    },
    onKeyUp(state, e) {
      if (CommonSelectors.isEscapeKey(e)) {
        this.deleteFeature([state.rectangle.id], { silent: true });
        this.changeMode(Constants.modes.SIMPLE_SELECT);
      } else if (CommonSelectors.isEnterKey(e) && state.origin) {
        this.fire(Constants.events.CREATE, { features: [state.rectangle.toGeoJSON()] });
        this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.rectangle.id] });
      }
    },
    toDisplayFeatures(state, geojson, display) {
      const isActive = geojson.properties.id === state.rectangle.id;
      geojson.properties.active = isActive ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
      if (state.origin) display(geojson);
    },
  };
}

// --- Circle (click center, click again to set radius) ---
export function makeCircleMode() {
  return {
    onSetup() {
      const circleFeature = this.newFeature({
        type: Constants.geojsonTypes.FEATURE,
        properties: {},
        geometry: { type: Constants.geojsonTypes.POLYGON, coordinates: [[]] },
      });
      this.addFeature(circleFeature);
      this.clearSelectedFeatures();
      doubleClickZoom.disable(this);
      this.updateUIClasses({ mouse: Constants.cursors.ADD });
      this.setActionableState({ trash: true });
      return { circleFeature, center: null };
    },
    updateCircle(state, cursor) {
      const radiusKm = Math.max(turf.distance(state.center, cursor, { units: 'kilometers' }), 0.001);
      const polygon = turf.circle(state.center, radiusKm, { steps: 64, units: 'kilometers' });
      state.circleFeature.setCoordinates([polygon.geometry.coordinates[0].slice(0, -1)]);
    },
    onClick(state, e) {
      const point = [e.lngLat.lng, e.lngLat.lat];
      if (!state.center) {
        state.center = point;
        return;
      }
      this.updateCircle(state, point);
      this.fire(Constants.events.CREATE, { features: [state.circleFeature.toGeoJSON()] });
      this.changeMode(Constants.modes.SIMPLE_SELECT, { featureIds: [state.circleFeature.id] });
    },
    onMouseMove(state, e) {
      if (!state.center) return;
      this.updateCircle(state, [e.lngLat.lng, e.lngLat.lat]);
    },
    onStop(state) {
      doubleClickZoom.enable(this);
      this.activateUIButton();
      if (this.getFeature(state.circleFeature.id) === undefined) return;
      if (!state.center || !state.circleFeature.isValid()) {
        this.deleteFeature([state.circleFeature.id], { silent: true });
      }
    },
    onTrash(state) {
      this.deleteFeature([state.circleFeature.id], { silent: true });
      this.changeMode(Constants.modes.SIMPLE_SELECT);
    },
    onKeyUp(state, e) {
      if (CommonSelectors.isEscapeKey(e)) {
        this.deleteFeature([state.circleFeature.id], { silent: true });
        this.changeMode(Constants.modes.SIMPLE_SELECT);
      }
    },
    toDisplayFeatures(state, geojson, display) {
      const isActive = geojson.properties.id === state.circleFeature.id;
      geojson.properties.active = isActive ? Constants.activeStates.ACTIVE : Constants.activeStates.INACTIVE;
      if (state.center) display(geojson);
    },
  };
}
