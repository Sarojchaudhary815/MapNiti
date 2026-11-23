import React, { useState, useRef, useEffect } from 'react';
import { X, Layout, Folder, Share2 } from 'lucide-react';
import ToolSidebar from './ToolSidebar';
import MapWindow from './MapWindow';
import ProjectSelector from './ProjectSelector';
import OverviewDashboard from './OverviewDashboard';
import AdminDashboard from './AdminDashboard';
import ShareProjectModal from './ShareProjectModal';
import { getProjectsOverview, createProject, deleteProject } from '../../api/projectApi';

import UrbanTool from '../urban-planning/UrbanTool';
import DisasterTool from '../disaster-risk/DisasterTool';
import HydrologyTool from '../hydrology/HydrologyTool';
import AgricultureTool from '../agriculture/AgricultureTool';
import DataManagementTool from '../data-management/DataManagementTool';
import FloodHazardMapping from '../hydrology/components/FloodHazardMapping';
import GeeDataHub from '../gee-hub/GeeDataHub';
import EngineerToolkit from '../engineering/EngineerToolkit';
import AiAssistant from '../ai/AiAssistant';
import DataDownload from '../downloads/DataDownload';

// Full-page modules render instead of the map + tool panel.
const FULL_PAGE_MODULES = ['dashboard', 'admin', 'ai'];
const ALL_MODULES = ['dashboard', 'urban', 'disaster', 'hydrology', 'agriculture', 'data-management', 'gee-hub', 'engineer', 'downloads', 'ai', 'admin'];

const PANEL_TITLES = { 'gee-hub': 'GEE Data Hub', engineer: 'Engineer Toolkit', downloads: 'Data Download' };

export default function ToolDashboard({ onRasterGenerated, rasterData, activeTool }) {
  // Deep links from the public website, e.g. /tool?module=downloads
  const initialModule = (() => {
    const m = new URLSearchParams(window.location.search).get('module');
    return ALL_MODULES.includes(m) ? m : 'dashboard';
  })();
  const [activeModule, setActiveModule] = useState(initialModule);
  const [isPanelOpen, setIsPanelOpen] = useState(!FULL_PAGE_MODULES.includes(initialModule));
  const [selectedAOI, setSelectedAOI] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);
  const [activeStep, setActiveStep] = useState('none');
  const [outletCoords, setOutletCoords] = useState([]);
  const [trainingSamples, setTrainingSamples] = useState([]); // colored markers for LULC sample points, rendered by MapWindow
  const [sampleClicks, setSampleClicks] = useState([]); // raw {lat,lng} clicks while activeStep === 'place-sample'
  const [showRaster, setShowRaster] = useState(false);
  const [boundaryVisible, setBoundaryVisible] = useState(true);
  const [mapLayers, setMapLayers] = useState([]);
  const [vectorLayers, setVectorLayers] = useState([]);
  const [show3DView, setShow3DView] = useState(false);

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  // Every module works without a project; a project is only needed to save
  // results, so the picker opens on demand instead of blocking the tools.
  const [pickerOpen, setPickerOpen] = useState(false);

  const mapRef = useRef();

  const fetchProjects = async () => {
    setLoadingProjects(true);
    setProjectError('');
    try {
      const data = await getProjectsOverview();
      setProjects(data);
    } catch (err) {
      setProjectError(err.response?.data?.detail || 'Could not load projects.');
    } finally {
      setLoadingProjects(false);
    }
  };

  // Phones: the panel was hidden to draw; bring it back once the AOI is finished.
  useEffect(() => {
    if (selectedAOI && window.innerWidth < 768) setIsPanelOpen(true);
  }, [selectedAOI]);

  // Load the project list whenever the picker opens.
  useEffect(() => {
    if (pickerOpen) {
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerOpen]);

  const handleModuleChange = (moduleId) => {
    setActiveModule(moduleId);
    setIsPanelOpen(!FULL_PAGE_MODULES.includes(moduleId));
    setActiveStep('none');
  };

  // "Try it" on AI code opens the public Code Lab in a new tab with the snippet.
  const handleOpenCodeLab = (lang, code) => {
    try {
      localStorage.setItem('mapniti_codelab_seed', JSON.stringify({ lang, code, t: Date.now() }));
    } catch {
      /* storage blocked — the lab still opens with its default example */
    }
    window.open('/code-lab', '_blank', 'noopener');
  };

  const triggerMapDraw = () => {
    // On phones the panel covers the map, so get it out of the way to draw.
    if (window.innerWidth < 768) setIsPanelOpen(false);
    if (mapRef.current && mapRef.current.startDrawing) {
      mapRef.current.startDrawing();
    }
  };

  const handleOutletPlaced = (latlng) => {
    setOutletCoords(prev => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
  };

  const handleSamplePlaced = (latlng) => {
    setSampleClicks(prev => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
  };

  const handleSelectProject = (project) => {
    setProjectInfo({ id: project.id, name: project.name, status: 'active' });
    setPickerOpen(false);
  };

  const handleCreateProject = async (name) => {
    const project = await createProject(name);
    setProjectInfo({ id: project.id, name: project.name, status: 'active' });
    setPickerOpen(false);
  };

  const handleDeleteProject = async (projectId) => {
    await deleteProject(projectId);
    localStorage.removeItem(`mapniti_hydrology_${projectId}`);
    if (projectInfo?.id === projectId) {
      setProjectInfo(null);
    }
    await fetchProjects();
  };

  const handleChangeProject = () => {
    setPickerOpen(true);
    setProjectInfo(null);
    setSelectedAOI(null);
    setOutletCoords([]);
    setTrainingSamples([]);
    setSampleClicks([]);
    setShowRaster(false);
    setMapLayers([]);
    setVectorLayers([]);
    onRasterGenerated(null);
  };

  const handleOpenProjectFromOverview = (project) => {
    setProjectInfo({ id: project.id, name: project.name, status: 'active' });
    setActiveModule('hydrology');
    setIsPanelOpen(true);
  };

  const commonProps = {
    selectedAOI,
    setSelectedAOI,
    onAreaSelected: setSelectedAOI,
    mapRef,
    onDrawAOI: triggerMapDraw,
    onRasterGenerated,
    onStartDrawing: triggerMapDraw,
    projectInfo,
    setProjectInfo,
    onChangeProject: handleChangeProject,
    activeStep,
    setActiveStep,
    outletCoords,
    setOutletCoords,
    trainingSamples,
    setTrainingSamples,
    sampleClicks,
    setSampleClicks,
    onSamplePlaced: handleSamplePlaced,
    setShowRaster,
    setBoundaryVisible,
    setMapLayers,
    setVectorLayers,
    rasterData,
    setShow3DView,
  };

  const isDashboard = activeModule === 'dashboard';
  const isAdmin = activeModule === 'admin';
  const isFullPage = FULL_PAGE_MODULES.includes(activeModule);

  const aiMapContext = selectedAOI?.bbox
    ? `User's current AOI bounding box (WGS84): west ${selectedAOI.bbox.west.toFixed(4)}, south ${selectedAOI.bbox.south.toFixed(4)}, east ${selectedAOI.bbox.east.toFixed(4)}, north ${selectedAOI.bbox.north.toFixed(4)}.`
    : null;

  const renderModule = () => {
    if (activeModule === 'urban') return <UrbanTool {...commonProps} />;
    if (activeModule === 'disaster') return <DisasterTool {...commonProps} />;
    if (activeModule === 'hydrology') return <HydrologyTool {...commonProps} />;
    if (activeModule === 'agriculture') return <AgricultureTool {...commonProps} />;
    if (activeModule === 'data-management') return <DataManagementTool {...commonProps} />;
    if (activeModule === 'gee-hub') return <GeeDataHub {...commonProps} />;
    if (activeModule === 'engineer') return <EngineerToolkit {...commonProps} />;
    if (activeModule === 'downloads') return <DataDownload {...commonProps} />;
    return null;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white relative font-sans">
      
      <div className="group w-16 md:w-20 hover:w-72 h-full z-30 shadow-2xl shrink-0 transition-all duration-300 ease-in-out overflow-hidden">
        <ToolSidebar
            activeModule={activeModule}
            setActiveModule={handleModuleChange}
        />
      </div>

      {pickerOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6"
          onClick={() => setPickerOpen(false)}>
          <div className="relative w-full max-w-lg h-[600px] max-h-[90vh] bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPickerOpen(false)} title="Close"
              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X size={16} />
            </button>
            <ProjectSelector
              projects={projects}
              loading={loadingProjects}
              error={projectError}
              onSelect={handleSelectProject}
              onCreate={handleCreateProject}
              onDelete={handleDeleteProject}
            />
          </div>
        </div>
      )}

        <>
          {/* On phones the panel overlays the map (there's no room for both side by side);
              from md up it sits beside the map as a 400px column. */}
          <div className={`h-full border-r border-slate-200 bg-white z-20 transition-all duration-500 ease-in-out
            ${(!isFullPage && isPanelOpen)
              ? 'absolute inset-y-0 left-16 right-0 md:static md:w-[400px] shadow-2xl md:shadow-none'
              : 'w-0 overflow-hidden opacity-0 invisible'}`}>

            <div className="flex items-center justify-between p-4 border-b bg-slate-50/50 md:min-w-[400px]">
              <div className="flex items-center gap-2">
                <Layout size={14} className="text-blue-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700 italic">
                  {PANEL_TITLES[activeModule] || `${activeModule.replace('-', ' ')} Engine`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!projectInfo && (
                  <button
                    onClick={() => setPickerOpen(true)}
                    title="Pick a project to save results"
                    className="flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md uppercase transition-colors"
                  >
                    <Folder size={10} /> Choose project
                  </button>
                )}
                {projectInfo && (
                  <>
                    <button
                      onClick={handleChangeProject}
                      title="Switch project"
                      className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md uppercase transition-colors"
                    >
                      <Folder size={10} /> {projectInfo.name}
                    </button>
                    <button
                      onClick={() => setShareOpen(true)}
                      title="Share this project"
                      className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md uppercase transition-colors"
                    >
                      <Share2 size={10} /> Share
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="p-1.5 hover:bg-red-50 text-slate-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto h-[calc(100%-57px)] custom-scrollbar bg-white md:min-w-[400px]">
              {renderModule()}
            </div>
          </div>

          <div className="flex-grow h-full relative z-0 bg-slate-100">
            {show3DView ? (
              <FloodHazardMapping selectedAOI={selectedAOI} onBack={() => setShow3DView(false)} />
            ) : isDashboard ? (
              <OverviewDashboard onOpenProject={handleOpenProjectFromOverview} />
            ) : isAdmin ? (
              <AdminDashboard />
            ) : activeModule === 'ai' ? (
              <AiAssistant onOpenCodeLab={handleOpenCodeLab} mapContext={aiMapContext} />
            ) : (
              <>
                {!isPanelOpen && (
                  <button
                    onClick={() => setIsPanelOpen(true)}
                    className="absolute top-4 left-4 z-[1000] bg-white px-5 py-2.5 rounded-xl shadow-2xl border border-slate-100 text-[#0047AB] font-black text-[11px] uppercase tracking-tighter hover:scale-105 transition-transform"
                  >
                    Open {PANEL_TITLES[activeModule] || activeModule} Tools
                  </button>
                )}
                <MapWindow
                  ref={mapRef}
                  isPanelOpen={!isFullPage && isPanelOpen}
                  onAreaSelected={(aoi) => setSelectedAOI(aoi)}
                  rasterData={rasterData}
                  showRaster={showRaster}
                  activeTool={activeTool}
                  activeStep={activeStep}
                  onOutletPlaced={handleOutletPlaced}
                  outletCoords={outletCoords}
                  onSamplePlaced={handleSamplePlaced}
                  trainingSamples={trainingSamples}
                  selectedAOI={selectedAOI}
                  layers={mapLayers}
                  vectorLayers={vectorLayers}
                  boundaryVisible={boundaryVisible}
                />
              </>
            )}
          </div>
        </>

      {shareOpen && projectInfo && (
        <ShareProjectModal
          projectId={projectInfo.id}
          projectName={projectInfo.name}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}