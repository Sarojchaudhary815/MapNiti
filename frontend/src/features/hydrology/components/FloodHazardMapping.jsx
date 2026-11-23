import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Loader2, Zap, ChevronDown, ChevronUp, Download,
  Trash2, FileText, MapPin, Pencil, Upload, CheckCircle2, ArrowRight,
  MoreVertical, Palette,
} from 'lucide-react';

import { API_BASE_URL } from '../../../config';

// Props:
//   selectedAOI      - { bbox, geojson, areaKm2 } set by drawing or upload
//   onAreaSelected   - (aoi) => void, same callback MapWindow's draw uses
//   setSelectedAOI   - (aoi|null) => void, same setter (used to clear/delete the AOI)
//   mapRef           - ref to the maplibregl.Map instance owned by MapWindow
//   onDrawAOI        - () => void, triggers MapWindow's draw_polygon mode
//   boundaryVisible  - bool, whether the AOI outline is shown on the map
//   setBoundaryVisible - (bool) => void, toggles the AOI outline on the map
export default function FloodHazardMapping({
  selectedAOI, onAreaSelected, setSelectedAOI, mapRef, onDrawAOI,
  boundaryVisible, setBoundaryVisible,
}) {
  const [openSection, setOpenSection] = useState('A');

  // ---- Section A: Area & Time ----
  const [preStart, setPreStart] = useState('');
  const [preEnd, setPreEnd] = useState('');
  const [postStart, setPostStart] = useState('');
  const [postEnd, setPostEnd] = useState('');
  const fileInputRef = useRef(null);

  const [beforeLoading, setBeforeLoading] = useState(false);
  const [beforeError, setBeforeError] = useState(null);
  const [afterLoading, setAfterLoading] = useState(false);
  const [afterError, setAfterError] = useState(null);
  const [combineLoading, setCombineLoading] = useState(false);
  const [combineError, setCombineError] = useState(null);

  // ---- Section B: Layers ----
  const [layers, setLayers] = useState([]); // [{layerId, name, visual_url, download_url, recolorable, color, visible}]
  const [recoloringId, setRecoloringId] = useState(null);

  // ---- Section C: Stats & Report ----
  const [stats, setStats] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [recolorError, setRecolorError] = useState(null);
  const reportRef = useRef(null); // hidden capture target for the PDF map snapshot

  const isBoundaryVisible = boundaryVisible !== false; // default to visible if prop not wired yet
  const hasPreLayer = layers.some((l) => l.layerId === 'pre_flood');
  const hasPostLayer = layers.some((l) => l.layerId === 'post_flood');

  // ---------- Map layer helpers ----------
  const addOrUpdateRasterLayer = (id, url, opacity = 0.8, visible = true) => {
    const map = mapRef?.current;
    if (!map || !url) return;
    if (map.getSource(id)) {
      map.getSource(id).setTiles([url]);
    } else {
      map.addSource(id, { type: 'raster', tiles: [url], tileSize: 256 });
      map.addLayer({
        id, type: 'raster', source: id,
        paint: { 'raster-opacity': opacity },
        layout: { visibility: visible ? 'visible' : 'none' },
      });
    }
  };

  const removeRasterLayer = (id) => {
    const map = mapRef?.current;
    if (!map) return;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  };

  const setLayerVisibility = (id, visible) => {
    const map = mapRef?.current;
    if (!map || !map.getLayer(id)) return;
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  };

  // Reset everything when the AOI changes
  useEffect(() => {
    layers.forEach((l) => removeRasterLayer(`data-${l.layerId}`));
    setLayers([]);
    setStats(null);
    setBeforeError(null);
    setAfterError(null);
    setCombineError(null);
    setOpenSection('A');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAOI]);

  // ---------- Section A: Upload a boundary file (GeoJSON) ----------
  const handleUploadBoundary = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);

        let geometry;
        if (parsed.type === 'FeatureCollection') {
          geometry = parsed.features[0];
        } else if (parsed.type === 'Feature') {
          geometry = parsed;
        } else {
          geometry = { type: 'Feature', properties: {}, geometry: parsed };
        }

        const coords = geometry.geometry.coordinates[0];
        let west = coords[0][0], east = coords[0][0], south = coords[0][1], north = coords[0][1];
        coords.forEach(([lng, lat]) => {
          if (lng < west) west = lng;
          if (lng > east) east = lng;
          if (lat < south) south = lat;
          if (lat > north) north = lat;
        });

        onAreaSelected?.({
          bbox: { south, north, west, east },
          geojson: geometry,
        });
        setBoundaryVisible?.(true);
      } catch (err) {
        console.error('Failed to parse uploaded boundary file:', err);
        setBeforeError('Could not read that file. Please upload a valid GeoJSON boundary.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteBoundary = () => {
    setSelectedAOI?.(null);
  };

  // ---------- Step 1 (Before Flood) ----------
  const handleRunBefore = async () => {
    if (!selectedAOI || !preStart || !preEnd) return;
    setBeforeLoading(true);
    setBeforeError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/flood-hazard-before`, {
        geometry: selectedAOI.geojson,
        pre_start_date: preStart,
        pre_end_date: preEnd,
      });

      if (response.data.status === 'success') {
        const layer = response.data.layers[0];
        const newLayer = { ...layer, visible: true, color: layer.color || '#2563eb' };
        setLayers((prev) => [...prev.filter((l) => l.layerId !== 'pre_flood'), newLayer]);
        addOrUpdateRasterLayer(`data-${newLayer.layerId}`, newLayer.visual_url, 0.8, true);
        setOpenSection('B');
      } else {
        setBeforeError(response.data.message || 'Before-flood analysis failed.');
      }
    } catch (error) {
      console.error('Before-flood analysis failed:', error);
      const serverMsg = error.response?.data?.message || error.response?.data?.detail;
      setBeforeError(serverMsg || `Request failed (status ${error.response?.status || 'unknown'}). Check the backend logs.`);
    } finally {
      setBeforeLoading(false);
    }
  };

  // ---------- Step 2 (After Flood) ----------
  const handleRunAfter = async () => {
    if (!selectedAOI || !postStart || !postEnd) return;
    setAfterLoading(true);
    setAfterError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/flood-hazard-after`, {
        geometry: selectedAOI.geojson,
        post_start_date: postStart,
        post_end_date: postEnd,
      });

      if (response.data.status === 'success') {
        const layer = response.data.layers[0];
        const newLayer = { ...layer, visible: true, color: layer.color || '#2563eb' };
        setLayers((prev) => [...prev.filter((l) => l.layerId !== 'post_flood'), newLayer]);
        addOrUpdateRasterLayer(`data-${newLayer.layerId}`, newLayer.visual_url, 0.8, true);
        setOpenSection('B');
      } else {
        setAfterError(response.data.message || 'After-flood analysis failed.');
      }
    } catch (error) {
      console.error('After-flood analysis failed:', error);
      const serverMsg = error.response?.data?.message || error.response?.data?.detail;
      setAfterError(serverMsg || `Request failed (status ${error.response?.status || 'unknown'}). Check the backend logs.`);
    } finally {
      setAfterLoading(false);
    }
  };

  // ---------- Step 3 (Combine) ----------
  const handleCombine = async () => {
    if (!selectedAOI || !postStart || !postEnd) return;
    setCombineLoading(true);
    setCombineError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/flood-hazard-combine`, {
        geometry: selectedAOI.geojson,
        post_start_date: postStart,
        post_end_date: postEnd,
      });

      if (response.data.status === 'success') {
        const newLayers = (response.data.layers || []).map((l) => ({
          ...l,
          visible: true,
          color: l.color || '#2563eb',
        }));
        setLayers((prev) => [
          ...prev.filter((l) => !['permanent_water', 'flood_extent'].includes(l.layerId)),
          ...newLayers,
        ]);
        setStats(response.data.stats || null);
        newLayers.forEach((l) => addOrUpdateRasterLayer(`data-${l.layerId}`, l.visual_url, 0.8, true));
        setOpenSection('C');
      } else {
        setCombineError(response.data.message || 'Combine step failed.');
      }
    } catch (error) {
      console.error('Combine step failed:', error);
      const serverMsg = error.response?.data?.message || error.response?.data?.detail;
      setCombineError(serverMsg || `Request failed (status ${error.response?.status || 'unknown'}). Check the backend logs.`);
    } finally {
      setCombineLoading(false);
    }
  };

  // ---------- Section B: Layer controls ----------
  const toggleLayerVisibility = (layerId) => {
    setLayers((prev) => prev.map((l) => {
      if (l.layerId !== layerId) return l;
      const nextVisible = !l.visible;
      setLayerVisibility(`data-${layerId}`, nextVisible);
      return { ...l, visible: nextVisible };
    }));
  };

  const deleteLayer = (layerId) => {
    removeRasterLayer(`data-${layerId}`);
    setLayers((prev) => prev.filter((l) => l.layerId !== layerId));
  };

  const changeLayerColor = async (layerId, newColor) => {
    setLayers((prev) => prev.map((l) => (l.layerId === layerId ? { ...l, color: newColor } : l)));

    const target = layers.find((l) => l.layerId === layerId);
    if (!target?.recolorable || !selectedAOI) return;

    setRecoloringId(layerId);
    setRecolorError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/hydrology/flood-recolor`, {
        geometry: selectedAOI.geojson,
        post_start_date: postStart,
        post_end_date: postEnd,
        flood_color: newColor,
      });
      if (response.data.status === 'success') {
        addOrUpdateRasterLayer(`data-${layerId}`, response.data.visual_url, 0.8, true);
      } else {
        setRecolorError(response.data.message || 'Could not recolor that layer.');
      }
    } catch (error) {
      console.error('Recolor request failed:', error);
      setRecolorError(error.response?.data?.message || error.response?.data?.detail || 'Could not recolor that layer.');
    } finally {
      setRecoloringId(null);
    }
  };

  const downloadLayer = (layer) => {
    if (!layer.download_url) return;
    window.open(layer.download_url, '_blank');
  };

  // ---------- Section C: PDF report ----------
  const handleGenerateReport = async () => {
    if (!selectedAOI || !stats) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const map = mapRef?.current;
      const mapCanvas = map?.getCanvas();
      const mapImageData = mapCanvas ? mapCanvas.toDataURL('image/png') : null;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      let y = 15;

      pdf.setFontSize(16);
      pdf.setFont(undefined, 'bold');
      pdf.text('Automated Flood Hazard Analysis Report', pageWidth / 2, y, { align: 'center' });
      y += 10;

      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, y); y += 6;
      pdf.text(`Pre-Flood Period: ${preStart} to ${preEnd}`, 14, y); y += 6;
      pdf.text(`Post-Flood Period: ${postStart} to ${postEnd}`, 14, y); y += 10;

      if (mapImageData) {
        pdf.setFont(undefined, 'bold');
        pdf.text('Final Result Map', 14, y); y += 4;
        pdf.addImage(mapImageData, 'PNG', 14, y, pageWidth - 28, 90);
        y += 96;
      }

      pdf.setFont(undefined, 'bold');
      pdf.text('Statistical Summary', 14, y); y += 6;
      pdf.setFont(undefined, 'normal');
      pdf.text(`Total Flooded Area: ${stats.flooded_area_km2 ?? 'N/A'} sq km`, 14, y); y += 6;
      pdf.text(
        `Affected Population Estimate: ${stats.affected_population != null ? stats.affected_population.toLocaleString() : 'N/A'}`,
        14, y
      );

      pdf.save(`flood-hazard-report-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Report generation failed:', error);
      setReportError('Could not generate the PDF report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  const areaKm2 = selectedAOI?.areaKm2 ?? computeAreaKm2FromBbox(selectedAOI?.bbox);

  return (
    <div className="p-5 space-y-3" ref={reportRef}>

      {/* ================= Section A: Area & Time Definition ================= */}
      <AccordionSection
        title="A. Area & Time Definition"
        isOpen={openSection === 'A'}
        onToggle={() => setOpenSection(openSection === 'A' ? null : 'A')}
      >
        <div className="space-y-4">

          {/* ---- Step 1: Draw / Upload AOI ---- */}
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Step 1 — Area of Interest</p>
            <div className="flex gap-2">
              <button
                onClick={onDrawAOI}
                className="flex-1 py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"
              >
                <Pencil size={14} /> Draw Area of Interest (AOI)
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-200"
              >
                <Upload size={14} /> Upload Boundary
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".geojson,.json"
                onChange={handleUploadBoundary}
                className="hidden"
              />
            </div>

            {selectedAOI && (
              <LayerRow
                name={`Boundary / AOI — ${areaKm2 != null ? `${areaKm2} sq km` : '—'}`}
                checked={isBoundaryVisible}
                onToggle={() => setBoundaryVisible?.(!isBoundaryVisible)}
                extraMenuItems={[
                  { label: 'Redraw AOI', icon: <Pencil size={12} />, onClick: onDrawAOI },
                  { label: 'Delete', icon: <Trash2 size={12} />, onClick: handleDeleteBoundary, danger: true },
                ]}
              />
            )}
            {!selectedAOI && (
              <p className="text-[10px] text-slate-400 italic">
                Draw an area on the map, or upload a GeoJSON boundary file.
              </p>
            )}
          </div>

          {/* ---- Step 2: Before Flood ---- */}
          {selectedAOI && (
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                Step 2 — Before Flood {hasPreLayer && <CheckCircle2 size={11} className="text-emerald-500" />}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Before-Flood Start</label>
                  <input type="date" value={preStart} onChange={(e) => setPreStart(e.target.value)}
                    className="w-full p-2 border-2 border-slate-100 rounded-lg text-[11px] font-bold outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">Before-Flood End</label>
                  <input type="date" value={preEnd} onChange={(e) => setPreEnd(e.target.value)}
                    className="w-full p-2 border-2 border-slate-100 rounded-lg text-[11px] font-bold outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button
                onClick={handleRunBefore}
                disabled={beforeLoading || !preStart || !preEnd}
                className="w-full py-2.5 bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {beforeLoading ? <Loader2 className="animate-spin" size={14} /> : <><Zap size={14} /> Run Before-Flood</>}
              </button>
              {beforeError && <p className="text-[9px] text-rose-600 font-bold">{beforeError}</p>}
            </div>
          )}

          {/* ---- Step 3: After Flood ---- */}
          {hasPreLayer && (
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                Step 3 — After Flood {hasPostLayer && <CheckCircle2 size={11} className="text-emerald-500" />}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">After-Flood Start</label>
                  <input type="date" value={postStart} onChange={(e) => setPostStart(e.target.value)}
                    className="w-full p-2 border-2 border-slate-100 rounded-lg text-[11px] font-bold outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase">After-Flood End</label>
                  <input type="date" value={postEnd} onChange={(e) => setPostEnd(e.target.value)}
                    className="w-full p-2 border-2 border-slate-100 rounded-lg text-[11px] font-bold outline-none focus:border-cyan-500" />
                </div>
              </div>
              <button
                onClick={handleRunAfter}
                disabled={afterLoading || !postStart || !postEnd}
                className="w-full py-2.5 bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {afterLoading ? <Loader2 className="animate-spin" size={14} /> : <><Zap size={14} /> Run After-Flood</>}
              </button>
              {afterError && <p className="text-[9px] text-rose-600 font-bold">{afterError}</p>}
            </div>
          )}

          {/* ---- Step 4: Combine ---- */}
          {hasPreLayer && hasPostLayer && (
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Step 4 — Combine</p>
              <button
                onClick={handleCombine}
                disabled={combineLoading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {combineLoading ? <Loader2 className="animate-spin" size={16} /> : <><ArrowRight size={16} /> Combine & Extract Flood Extent</>}
              </button>
              {combineError && <p className="text-[9px] text-rose-600 font-bold">{combineError}</p>}
            </div>
          )}
        </div>
      </AccordionSection>

      {/* ================= Section B: Dynamic Layer Management ================= */}
      <AccordionSection
        title="B. Layer Management"
        isOpen={openSection === 'B'}
        onToggle={() => setOpenSection(openSection === 'B' ? null : 'B')}
      >
        {!selectedAOI && layers.length === 0 ? (
          <p className="text-[10px] text-slate-400 italic">Draw or upload an AOI to get started.</p>
        ) : (
          <div className="space-y-2">
            {selectedAOI && (
              <LayerRow
                name={`Boundary / AOI — ${areaKm2 != null ? `${areaKm2} sq km` : '—'}`}
                checked={isBoundaryVisible}
                onToggle={() => setBoundaryVisible?.(!isBoundaryVisible)}
                extraMenuItems={[
                  { label: 'Redraw AOI', icon: <Pencil size={12} />, onClick: onDrawAOI },
                  { label: 'Delete', icon: <Trash2 size={12} />, onClick: handleDeleteBoundary, danger: true },
                ]}
              />
            )}
            {layers.length === 0 ? (
              <p className="text-[10px] text-slate-400 italic pt-1">Run Before/After/Combine to generate more layers here.</p>
            ) : (
              layers.map((layer) => (
                <LayerRow
                  key={layer.layerId}
                  name={layer.name}
                  checked={layer.visible}
                  onToggle={() => toggleLayerVisibility(layer.layerId)}
                  colorValue={layer.recolorable ? layer.color : undefined}
                  onColorChange={layer.recolorable ? (color) => changeLayerColor(layer.layerId, color) : undefined}
                  loading={recoloringId === layer.layerId}
                  extraMenuItems={[
                    ...(layer.download_url
                      ? [{ label: 'Download', icon: <Download size={12} />, onClick: () => downloadLayer(layer) }]
                      : []),
                    { label: 'Delete', icon: <Trash2 size={12} />, onClick: () => deleteLayer(layer.layerId), danger: true },
                  ]}
                />
              ))
            )}
            {recolorError && <p className="text-[9px] text-rose-600 font-bold">{recolorError}</p>}
          </div>
        )}
      </AccordionSection>

      {/* ================= Section C: Analytics Summary & Reporting ================= */}
      <AccordionSection
        title="C. Analytics Summary & Reporting"
        isOpen={openSection === 'C'}
        onToggle={() => setOpenSection(openSection === 'C' ? null : 'C')}
      >
        {!stats ? (
          <p className="text-[10px] text-slate-400 italic">Complete the Combine step to see summary statistics here.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <p className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1">
                  <MapPin size={10} /> Total Flooded Area
                </p>
                <p className="text-lg font-black text-blue-900">{stats.flooded_area_km2 ?? '—'} <span className="text-[10px] font-bold">sq km</span></p>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                <p className="text-[9px] font-black text-rose-500 uppercase flex items-center gap-1">
                  <MapPin size={10} /> Affected Population
                </p>
                <p className="text-lg font-black text-rose-900">
                  {stats.affected_population != null ? stats.affected_population.toLocaleString() : '—'}
                </p>
              </div>
            </div>

            <button
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="w-full py-3 bg-slate-800 text-white rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {reportLoading ? <Loader2 className="animate-spin" size={16} /> : <><FileText size={16} /> Generate PDF Report</>}
            </button>
            {reportError && <p className="text-[9px] text-rose-600 font-bold">{reportError}</p>}
          </div>
        )}
      </AccordionSection>
    </div>
  );
}

// ---------- Small helpers ----------

function computeAreaKm2FromBbox(bbox) {
  if (!bbox) return null;
  const { south, north, west, east } = bbox;
  const R = 6371;
  const dLat = ((north - south) * Math.PI) / 180;
  const dLng = ((east - west) * Math.PI) / 180;
  const avgLat = ((north + south) / 2) * (Math.PI / 180);
  const height = R * dLat;
  const width = R * dLng * Math.cos(avgLat);
  return Math.abs(Math.round(height * width * 10) / 10);
}

function AccordionSection({ title, isOpen, onToggle, children }) {
  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-white hover:bg-slate-50"
      >
        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wide">{title}</span>
        {isOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {isOpen && <div className="p-3 pt-0 border-t border-slate-100 bg-white">{children}</div>}
    </div>
  );
}

// Reusable layer row: checkbox + name + "⋮" menu (Symbology / Download / Delete / Redraw)
function LayerRow({ name, checked, onToggle, extraMenuItems = [], colorValue, onColorChange, loading }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const colorInputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const menuItems = [
    ...(colorValue !== undefined
      ? [{ label: 'Symbology', icon: <Palette size={12} />, onClick: () => colorInputRef.current?.click() }]
      : []),
    ...extraMenuItems,
  ];

  return (
    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 relative">
      <label className="flex items-center gap-2 min-w-0 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 accent-blue-600 rounded cursor-pointer shrink-0"
        />
        <span className="text-[10px] font-bold text-slate-700 truncate">{name}</span>
        {loading && <Loader2 className="animate-spin text-slate-400 shrink-0" size={11} />}
      </label>

      {colorValue !== undefined && (
        <input
          ref={colorInputRef}
          type="color"
          value={colorValue}
          onChange={(e) => onColorChange?.(e.target.value)}
          className="hidden"
        />
      )}

      {menuItems.length > 0 && (
        <div className="relative shrink-0" ref={containerRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => { item.onClick(); setMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[10px] font-bold flex items-center gap-2 hover:bg-slate-50 ${item.danger ? 'text-rose-600' : 'text-slate-700'}`}
                >
                  {item.icon}{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}