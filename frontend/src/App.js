import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Layout
import PublicLayout from './components/PublicLayout';

// Pages
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Projects from './pages/Projects';
import Login from './pages/Login';
import Register from './pages/Register';
import LearnPage from './pages/public/LearnPage';
import CertificatePage from './pages/public/CertificatePage';
import BookPage from './pages/public/BookPage';
import CodeLabPage from './pages/public/CodeLabPage';
import GisGuidePage from './pages/public/GisGuidePage';
import WhatsNewPage from './pages/public/WhatsNewPage';
import DataSourcesPage from './pages/public/DataSourcesPage';
import AiPage from './pages/public/AiPage';
import CaseStudiesPage from './pages/public/CaseStudiesPage';

// Features
import ToolDashboard from './features/tool-layout/ToolDashboard';
import DownloadPage from './features/billing/DownloadPage';
import PaywallModal from './features/billing/PaywallModal';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const isLoggedIn = !!localStorage.getItem("token");   // ← token check garne
  // Remember where the user was going (e.g. /tool?module=hydrology) so login can return there.
  const next = encodeURIComponent(location.pathname + location.search);
  return isLoggedIn ? children : <Navigate to={`/login?next=${next}`} replace />;
};

export default function App() {
  const [rasterData, setRasterData] = useState(null);
  const [activeTool, setActiveTool] = useState(null);

  const handleRasterGenerated = (data) => {
    if (data) setRasterData(data);
  };

  const handleToolChange = (toolId) => {
    setActiveTool(prevTool => (prevTool === toolId ? null : toolId));
    if (activeTool !== toolId) setRasterData(null);
  };

  return (
    <Router>
      <PaywallModal />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          {/* old links to the separate services page land on the home page section */}
          <Route path="/services" element={<Navigate to="/#services" replace />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/contact" element={<Contact />} />
          {/* Free public knowledge base — no login needed */}
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/:courseId" element={<LearnPage />} />
          <Route path="/certificate/:code" element={<CertificatePage />} />
          <Route path="/learn-programming" element={<BookPage />} />
          <Route path="/learn-programming/:chapterId" element={<BookPage />} />
          <Route path="/code-lab" element={<CodeLabPage />} />
          <Route path="/gis-guide" element={<GisGuidePage />} />
          <Route path="/whats-new" element={<WhatsNewPage />} />
          <Route path="/data-sources" element={<DataSourcesPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/case-studies" element={<CaseStudiesPage />} />
          <Route path="/case-studies/:slug" element={<CaseStudiesPage />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Tool Dashboard मा मात्र स्क्रोलिङ रोक्न सकिन्छ (यदि आवश्यक भए) */}
        <Route path="/tool" element={
          <ProtectedRoute>
            <div className="h-screen overflow-hidden">
              <ToolDashboard
                onRasterGenerated={handleRasterGenerated}
                rasterData={rasterData}
                activeTool={activeTool}
                setActiveTool={handleToolChange}
              />
            </div>
          </ProtectedRoute>
        } />

        {/* paid download links handed out by the API */}
        <Route path="/download/:token" element={<ProtectedRoute><DownloadPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
