import React, { useCallback, useEffect, useRef, useState } from 'react';
import { bbox as turfBbox } from '@turf/turf';
import {
  MousePointer2, MapPin, Spline, Hexagon, Square, Circle as CircleIcon,
  Trash2, Upload, FilePlus2, AlertCircle, Magnet, Undo2, Redo2, Combine, Scissors, Save, Loader2,
} from 'lucide-react';
import LayerGroupRow from './digitization/LayerGroupRow';
import SymbologyPanel from './digitization/SymbologyPanel';
import AttributeTable from './digitization/AttributeTable';
import NewLayerModal from './digitization/NewLayerModal';
import FeatureAttributePanel from './digitization/FeatureAttributePanel';
import { SYSTEM_PROPS } from './digitization/constants';
import { exportGeoJSON, exportKML, exportShapefile } from '../../../utils/geoExport';
import { loadDigitizedData, saveDigitizedData } from '../../../api/dataMgmtApi';

const DRAW_TOOLS = [
  { tool: 'select', icon: MousePointer2, label: 'Select / Edit' },
  { tool: 'point', icon: MapPin, label: 'Point' },
  { tool: 'line', icon: Spline, label: 'Line' },
  { tool: 'polygon', icon: Hexagon, label: 'Polygon' },
  { tool: 'rectangle', icon: Square, label: 'Rectangle' },
  { tool: 'circle', icon: CircleIcon, label: 'Circle' },
];

const REQUIRED_GEOM = {
  point: 'Point', line: 'LineString', polygon: 'Polygon', rectangle: 'Polygon', circle: 'Polygon',
};
const MODE_NAME = {
  select: 'simple_select', point: 'snap_point', line: 'snap_line_string',
  polygon: 'snap_polygon', rectangle: 'draw_rectangle', circle: 'draw_circle',
};

const PALETTE = ['#3bb2d0', '#fb8b24', '#e63946', '#2a9d8f', '#8338ec', '#ffb703', '#3a86ff', '#d62839'];
const LINE_DEFAULT_COLOR = '#a3e635'; // roads/lines default to a lime centerline over the dark casing
let groupCounter = 0;

function createLayerGroup(name, geomType, colorIndex) {
  groupCounter += 1;
  return {
    id: `layer-${Date.now()}-${groupCounter}`,
    name,
    geomType,
    color: (geomType === 'LineString' || geomType === 'MultiLineString') ? LINE_DEFAULT_COLOR : PALETTE[colorIndex % PALETTE.length],
    opacity: geomType === 'Polygon' ? 0.6 : 1,
    lineWidth: 3,
    pointRadius: 6,
    dashed: false,
    pointShape: 'circle',
    labelField: null,
    visible: true,
    featureIds: [],
  };
}

const normalizeToFeatureCollection = (parsed) => {
  if (parsed.type === 'FeatureCollection') return parsed;
  if (parsed.type === 'Feature') return { type: 'FeatureCollection', features: [parsed] };
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: parsed }] };
};

export default function DigitizationTool({ mapRef, projectId }) {
  const [activeMode, setActiveMode] = useState('simple_select');
  const [layerGroups, setLayerGroups] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'loading' | 'saving' | 'saved'
  const [selectedFeatureId, setSelectedFeatureId] = useState(null);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [featureCollection, setFeatureCollection] = useState({ type: 'FeatureCollection', features: [] });
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [pendingTool, setPendingTool] = useState(null);
  const [newLayerModalOpen, setNewLayerModalOpen] = useState(false);
  const [symbologyGroupId, setSymbologyGroupId] = useState(null);
  const [attributeGroupId, setAttributeGroupId] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const applyingTagsRef = useRef(false);
  const pendingUploadNameRef = useRef(null);
  const hiddenFeaturesRef = useRef(new Map()); // groupId -> cached GeoJSON features while hidden

  // Registered with MapWindow whenever it changes (see effect below), so it
  // always closes over the current activeLayerId. Reconciles deleted
  // feature ids out of every group's featureIds, then — guarded against the
  // reentrant call its own setFeatureProperties side effects trigger —
  // assigns any brand-new (untagged) feature to the active layer, or
  // auto-creates one grouped by geometry type (the upload path).
  const handleDigitizeChange = useCallback((fc) => {
    const features = fc?.features || [];
    setFeatureCollection(fc || { type: 'FeatureCollection', features: [] });

    const presentIds = new Set(features.map((f) => f.id));
    setLayerGroups((prevGroups) => {
      const groups = prevGroups.map((g) => ({ ...g, featureIds: g.featureIds.filter((id) => presentIds.has(id)) }));
      if (applyingTagsRef.current) return groups;

      const untagged = features.filter((f) => !f.properties?.layerId);
      if (!untagged.length) return groups;

      applyingTagsRef.current = true;
      const byGeomType = new Map();
      untagged.forEach((f) => {
        const list = byGeomType.get(f.geometry.type) || [];
        list.push(f);
        byGeomType.set(f.geometry.type, list);
      });

      // Collect every (featureId, styleProps) pair first and apply them in
      // ONE batched call — tagging a big upload one feature at a time (each
      // triggering its own resync) is what made large files hang/appear to
      // fail; a single call at the end scales to thousands of features.
      const entries = [];
      byGeomType.forEach((feats, geomType) => {
        let idx = groups.findIndex((g) => g.id === activeLayerId && g.geomType === geomType);
        if (idx === -1) {
          const name = pendingUploadNameRef.current
            ? `${pendingUploadNameRef.current} (${geomType})`
            : `New ${geomType} Layer`;
          groups.push(createLayerGroup(name, geomType, groups.length));
          idx = groups.length - 1;
        }
        const group = groups[idx];
        const props = {
          layerId: group.id, color: group.color, opacity: group.opacity,
          lineWidth: group.lineWidth, pointRadius: group.pointRadius,
          dashed: group.dashed, pointShape: group.pointShape,
        };
        feats.forEach((f) => entries.push([f.id, props]));
        groups[idx] = {
          ...group,
          featureIds: Array.from(new Set([...group.featureIds, ...feats.map((f) => f.id)])),
        };
      });

      mapRef?.current?.setManyFeatureProperties(entries);
      applyingTagsRef.current = false;
      return groups;
    });
    pendingUploadNameRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayerId]);

  useEffect(() => {
    mapRef?.current?.setDigitizeMode(true);
    mapRef?.current?.startDigitizeDraw('simple_select');
    return () => {
      mapRef?.current?.setDigitizeChangeHandler(null);
      mapRef?.current?.setDigitizeSelectionHandler(null);
      mapRef?.current?.clearDigitize();
      mapRef?.current?.setDigitizeMode(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef?.current?.setDigitizeChangeHandler(handleDigitizeChange);
  }, [handleDigitizeChange, mapRef]);

  // Clicking a single digitized feature (in select mode, not mid-draw) opens
  // its attribute form in place of the toolbar/layers panel — mirrors the
  // reference road-editor's click-to-edit flow.
  const handleDigitizeSelectionChange = useCallback((features) => {
    if (activeMode !== 'simple_select' || features.length !== 1) {
      setSelectedFeatureId(null);
      return;
    }
    setSelectedFeatureId(features[0].id);
  }, [activeMode]);

  useEffect(() => {
    mapRef?.current?.setDigitizeSelectionHandler(handleDigitizeSelectionChange);
  }, [handleDigitizeSelectionChange, mapRef]);

  // Load whatever was previously saved for this project, once, on entering
  // the tool — features already carry their layerId/style tags from the
  // save, so handleDigitizeChange's auto-tagging (untagged-only) is a no-op
  // here and the saved layerGroups are trusted as-is.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setSaveStatus('loading');
    loadDigitizedData(projectId)
      .then(({ layerGroups: savedGroups, featureCollection: savedFC }) => {
        if (cancelled) return;
        if (savedGroups?.length) {
          setLayerGroups(savedGroups);
          mapRef?.current?.addDigitizeFeatures(savedFC);
        }
        setSaveStatus('idle');
      })
      .catch((err) => {
        console.error('Failed to load saved digitize data:', err);
        if (!cancelled) setSaveStatus('idle');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaveStatus('saving');
    try {
      await saveDigitizedData(projectId, layerGroups, featureCollection);
      setSaveStatus('saved');
      setError('');
    } catch (err) {
      console.error('Failed to save digitized data:', err);
      setError('Could not save your changes. Please try again.');
      setSaveStatus('idle');
    }
  };

  useEffect(() => {
    mapRef?.current?.setSnappingEnabled(snappingEnabled);
  }, [snappingEnabled, mapRef]);

  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const t = setTimeout(() => setSaveStatus('idle'), 2000);
    return () => clearTimeout(t);
  }, [saveStatus]);

  useEffect(() => {
    mapRef?.current?.setSnapFeatures(featureCollection.features);
  }, [featureCollection, mapRef]);

  // --- Toolbar: draw tools ---
  const startTool = (tool) => {
    if (tool === 'select') {
      setActiveMode('simple_select');
      mapRef?.current?.startDigitizeDraw('simple_select');
      return;
    }
    const geomType = REQUIRED_GEOM[tool];
    const active = layerGroups.find((g) => g.id === activeLayerId);
    if (!active || active.geomType !== geomType || !active.visible) {
      setPendingTool(tool);
      setNewLayerModalOpen(true);
      return;
    }
    const mode = MODE_NAME[tool];
    setActiveMode(mode);
    mapRef?.current?.startDigitizeDraw(mode);
  };

  const handleCreateLayer = ({ name, geomType }) => {
    const group = createLayerGroup(name, geomType, layerGroups.length);
    setLayerGroups((prev) => [...prev, group]);
    setActiveLayerId(group.id);
    setNewLayerModalOpen(false);
    if (pendingTool) {
      const mode = MODE_NAME[pendingTool];
      setActiveMode(mode);
      mapRef?.current?.startDigitizeDraw(mode);
      setPendingTool(null);
    }
  };

  const handleDeleteSelected = () => mapRef?.current?.deleteDigitizeSelected();
  const handleCombine = () => mapRef?.current?.combineDigitizeSelected();
  const handleUncombine = () => mapRef?.current?.uncombineDigitizeSelected();
  const handleUndo = () => mapRef?.current?.undoDigitize();
  const handleRedo = () => mapRef?.current?.redoDigitize();

  const handleNewDigitization = () => {
    if (layerGroups.length > 0 && !window.confirm('Clear all layers and start fresh?')) return;
    mapRef?.current?.clearDigitize();
    hiddenFeaturesRef.current.clear();
    setLayerGroups([]);
    setActiveLayerId(null);
    setActiveMode('simple_select');
    mapRef?.current?.startDigitizeDraw('simple_select');
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const fc = normalizeToFeatureCollection(parsed);
        pendingUploadNameRef.current = file.name.replace(/\.(geojson|json)$/i, '');
        mapRef?.current?.addDigitizeFeatures(fc);
        setError('');
      } catch (err) {
        console.error('Failed to parse uploaded data:', err);
        setError('Could not read that file. Please upload a valid GeoJSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Layer operations ---
  const featuresOfGroup = (group) => featureCollection.features.filter((f) => f.properties?.layerId === group.id);

  const toggleLayerVisible = (group) => {
    if (group.visible) {
      const feats = featuresOfGroup(group);
      hiddenFeaturesRef.current.set(group.id, feats);
      group.featureIds.forEach((id) => mapRef?.current?.deleteDigitizeFeature(id));
    } else {
      const cached = hiddenFeaturesRef.current.get(group.id);
      if (cached?.length) mapRef?.current?.addDigitizeFeatures({ type: 'FeatureCollection', features: cached });
      hiddenFeaturesRef.current.delete(group.id);
    }
    setLayerGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, visible: !g.visible } : g)));
  };

  const renameLayer = (group, name) => {
    setLayerGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, name } : g)));
  };

  const deleteLayer = (group) => {
    if (!window.confirm(`Delete layer "${group.name}" and its ${group.featureIds.length} feature(s)?`)) return;
    group.featureIds.forEach((id) => mapRef?.current?.deleteDigitizeFeature(id));
    hiddenFeaturesRef.current.delete(group.id);
    setLayerGroups((prev) => prev.filter((g) => g.id !== group.id));
    if (activeLayerId === group.id) setActiveLayerId(null);
  };

  const duplicateLayer = (group) => {
    const feats = featuresOfGroup(group);
    const newGroup = { ...createLayerGroup(`${group.name} copy`, group.geomType, layerGroups.length),
      color: group.color, opacity: group.opacity, lineWidth: group.lineWidth,
      pointRadius: group.pointRadius, dashed: group.dashed, pointShape: group.pointShape, labelField: group.labelField };
    const clones = feats.map((f) => ({ type: 'Feature', properties: { ...f.properties, layerId: newGroup.id }, geometry: f.geometry }));
    const newIds = mapRef?.current?.addDigitizeFeatures({ type: 'FeatureCollection', features: clones }) || [];
    newGroup.featureIds = newIds;
    setLayerGroups((prev) => [...prev, newGroup]);
    setActiveLayerId(newGroup.id);
  };

  const zoomToLayer = (group) => {
    const feats = featuresOfGroup(group);
    if (!feats.length) return;
    const box = turfBbox({ type: 'FeatureCollection', features: feats });
    mapRef?.current?.fitBounds([[box[0], box[1]], [box[2], box[3]]], { padding: 60, duration: 800 });
  };

  const exportLayer = (group, format) => {
    const feats = featuresOfGroup(group);
    const fc = { type: 'FeatureCollection', features: feats };
    const safeName = (group.name.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase() || 'layer');
    if (format === 'geojson') exportGeoJSON(fc, `${safeName}.geojson`);
    else if (format === 'kml') exportKML(fc, `${safeName}.kml`);
    else if (format === 'shapefile') exportShapefile(fc, safeName);
  };

  const updateGroupStyle = (group, patch) => {
    setLayerGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, ...patch } : g)));
    const merged = { ...group, ...patch };
    group.featureIds.forEach((id) => {
      const props = {};
      ['color', 'opacity', 'lineWidth', 'pointRadius', 'dashed', 'pointShape'].forEach((k) => {
        if (k in patch) props[k] = merged[k];
      });
      if ('labelField' in patch) {
        const feature = featureCollection.features.find((f) => f.id === id);
        props.label = merged.labelField ? (feature?.properties?.[merged.labelField] ?? '') : '';
      }
      if (Object.keys(props).length) mapRef?.current?.setFeatureProperties(id, props);
    });
  };

  const updateFeatureProperty = (group, featureId, key, value) => {
    mapRef?.current?.setFeatureProperty(featureId, key, value);
    if (group.labelField === key) mapRef?.current?.setFeatureProperty(featureId, 'label', value);
  };

  const addFieldToGroup = (group, key) => {
    group.featureIds.forEach((id) => mapRef?.current?.setFeatureProperty(id, key, ''));
  };

  const deleteFieldFromGroup = (group, key) => {
    group.featureIds.forEach((id) => mapRef?.current?.setFeatureProperty(id, key, undefined));
  };

  const deleteFeatureFromGroup = (group, featureId) => mapRef?.current?.deleteDigitizeFeature(featureId);

  const availableFieldsForGroup = (group) => {
    const keys = new Set();
    featuresOfGroup(group).forEach((f) => Object.entries(f.properties || {}).forEach(([k, v]) => {
      if (!SYSTEM_PROPS.includes(k) && v !== undefined) keys.add(k);
    }));
    return Array.from(keys);
  };

  const symbologyGroup = layerGroups.find((g) => g.id === symbologyGroupId);
  const attributeGroup = layerGroups.find((g) => g.id === attributeGroupId);
  const canUndo = mapRef?.current?.canUndoDigitize?.() ?? false;
  const canRedo = mapRef?.current?.canRedoDigitize?.() ?? false;
  const activeGroup = layerGroups.find((g) => g.id === activeLayerId);

  const selectedFeature = selectedFeatureId
    ? featureCollection.features.find((f) => f.id === selectedFeatureId)
    : null;

  if (selectedFeature) {
    return (
      <FeatureAttributePanel
        feature={selectedFeature}
        onSave={(featureId, changedProps) => {
          if (Object.keys(changedProps).length) mapRef?.current?.setFeatureProperties(featureId, changedProps);
        }}
        onClose={() => {
          setSelectedFeatureId(null);
          mapRef?.current?.startDigitizeDraw('simple_select');
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* --- Toolbar --- */}
      <div className="border-b border-slate-100 bg-white p-3 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {DRAW_TOOLS.map(({ tool, icon: Icon, label }) => (
            <button
              key={tool}
              onClick={() => startTool(tool)}
              title={label}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
                activeMode === MODE_NAME[tool]
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
            >
              <Icon size={16} />
              <span className="text-[8px] font-black uppercase tracking-tight">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSnappingEnabled((v) => !v)}
            title="Snap to other digitized features"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
              snappingEnabled ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
            }`}
          >
            <Magnet size={16} />
            <span className="text-[8px] font-black uppercase tracking-tight">Snap</span>
          </button>
          <button onClick={handleUndo} disabled={!canUndo} title="Undo" className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:border-slate-400 disabled:opacity-30 transition-all">
            <Undo2 size={16} /><span className="text-[8px] font-black uppercase tracking-tight">Undo</span>
          </button>
          <button onClick={handleRedo} disabled={!canRedo} title="Redo" className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:border-slate-400 disabled:opacity-30 transition-all">
            <Redo2 size={16} /><span className="text-[8px] font-black uppercase tracking-tight">Redo</span>
          </button>
          <button onClick={handleCombine} title="Merge selected geometries" className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:border-slate-400 transition-all">
            <Combine size={16} /><span className="text-[8px] font-black uppercase tracking-tight">Merge</span>
          </button>
          <button onClick={handleUncombine} title="Split combined geometry" className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:border-slate-400 transition-all">
            <Scissors size={16} /><span className="text-[8px] font-black uppercase tracking-tight">Split</span>
          </button>
          <div className="w-px h-8 bg-slate-200 mx-1" />
          <button onClick={handleDeleteSelected} title="Delete selected" className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-red-500 hover:border-red-300 hover:bg-red-50 transition-all">
            <Trash2 size={16} /><span className="text-[8px] font-black uppercase tracking-tight">Delete</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} title="Upload your data" className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:border-slate-400 transition-all">
            <Upload size={16} /><span className="text-[8px] font-black uppercase tracking-tight">Upload</span>
          </button>
          <button onClick={() => { setPendingTool(null); setNewLayerModalOpen(true); }} title="New layer" className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:border-slate-400 transition-all">
            <FilePlus2 size={16} /><span className="text-[8px] font-black uppercase tracking-tight">New</span>
          </button>
          <button
            onClick={handleSave}
            disabled={!projectId || saveStatus === 'saving'}
            title="Save to project"
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-30 transition-all"
          >
            {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span className="text-[8px] font-black uppercase tracking-tight">
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept=".geojson,.json" onChange={handleUpload} className="hidden" />
        </div>

        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          {saveStatus === 'loading'
            ? 'Loading saved layers…'
            : activeGroup ? `Drawing into: ${activeGroup.name}` : 'Select or create a layer to start drawing'}
        </p>
      </div>

      {error && (
        <div className="m-3 flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold rounded-xl">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* --- Layer panel --- */}
      <div className="flex-grow overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Layers</span>
          <span className="text-[9px] font-bold text-slate-400">{layerGroups.length} layer{layerGroups.length === 1 ? '' : 's'}</span>
        </div>

        {layerGroups.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Create a layer, then draw a shape above, or upload existing data to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {layerGroups.map((group) => (
              <LayerGroupRow
                key={group.id}
                group={group}
                isActive={group.id === activeLayerId}
                onSetActive={() => setActiveLayerId(group.id)}
                onToggleVisible={() => toggleLayerVisible(group)}
                onRename={(name) => renameLayer(group, name)}
                onOpenSymbology={() => setSymbologyGroupId(group.id)}
                onOpenAttributes={() => setAttributeGroupId(group.id)}
                onExport={(format) => exportLayer(group, format)}
                onZoomTo={() => zoomToLayer(group)}
                onDuplicate={() => duplicateLayer(group)}
                onDelete={() => deleteLayer(group)}
              />
            ))}
          </div>
        )}
      </div>

      {newLayerModalOpen && (
        <NewLayerModal
          defaultGeomType={pendingTool ? REQUIRED_GEOM[pendingTool] : 'LineString'}
          onCreate={handleCreateLayer}
          onClose={() => { setNewLayerModalOpen(false); setPendingTool(null); }}
        />
      )}

      {symbologyGroup && (
        <SymbologyPanel
          group={symbologyGroup}
          availableFields={availableFieldsForGroup(symbologyGroup)}
          onChange={(patch) => updateGroupStyle(symbologyGroup, patch)}
          onClose={() => setSymbologyGroupId(null)}
        />
      )}

      {attributeGroup && (
        <AttributeTable
          group={attributeGroup}
          features={featuresOfGroup(attributeGroup)}
          onUpdateProperty={(featureId, key, value) => updateFeatureProperty(attributeGroup, featureId, key, value)}
          onAddField={(key) => addFieldToGroup(attributeGroup, key)}
          onDeleteField={(key) => deleteFieldFromGroup(attributeGroup, key)}
          onDeleteFeature={(featureId) => deleteFeatureFromGroup(attributeGroup, featureId)}
          onClose={() => setAttributeGroupId(null)}
        />
      )}
    </div>
  );
}
