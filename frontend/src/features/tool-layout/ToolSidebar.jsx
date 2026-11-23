import React, { useState } from 'react';
import {
  LayoutDashboard, Building2, Zap, Droplets, Sprout, Database, LogOut, ChevronRight, ShieldCheck,
  Globe2, HardHat, Sparkles, Download, GraduationCap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '../../api/authApi';
import ProfileEditModal, { avatarUrl } from './ProfileEditModal';

export default function ToolSidebar({ activeModule, setActiveModule }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser());
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
    window.location.reload();
  };

  const menus = [
    { id: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Overview' },
    { id: 'urban', icon: <Building2 size={18} />, label: 'Urban Planning' },
    { id: 'disaster', icon: <Zap size={18} />, label: 'Disaster Risk' },
    { id: 'hydrology', icon: <Droplets size={18} />, label: 'Hydrology Tool' },
    { id: 'agriculture', icon: <Sprout size={18} />, label: 'Agriculture Tool' },
    { id: 'data-management', icon: <Database size={18} />, label: 'Data Management' },
    { id: 'gee-hub', icon: <Globe2 size={18} />, label: 'GEE Data Hub' },
    { id: 'engineer', icon: <HardHat size={18} />, label: 'Engineer Toolkit' },
    { id: 'downloads', icon: <Download size={18} />, label: 'Data Download' },
    { id: 'ai', icon: <Sparkles size={18} />, label: 'AI Assistant' },
    ...(user?.is_admin ? [{ id: 'admin', icon: <ShieldCheck size={18} />, label: 'Admin' }] : []),
  ];

  return (
    <aside className="w-72 bg-[#0047AB] h-full flex flex-col justify-between py-6 px-3 shadow-2xl border-r border-white/10">
      <div>
        {/* --- BRANDING (only shown once the sidebar is expanded/hovered) --- */}
        <div className="mb-6 px-2 hidden group-hover:block whitespace-nowrap">
          <h2 className="text-white font-black text-2xl tracking-tighter italic">
            MAPNITI <span className="text-yellow-400 not-italic uppercase">TOOL</span>
          </h2>
          <p className="text-blue-200 text-[11px] font-medium opacity-80 tracking-wide mt-1">
            Good for Analysis
          </p>
          <div className="h-0.5 w-10 bg-yellow-400 mt-2 rounded-full opacity-50"></div>
        </div>
        <div className="h-2 group-hover:hidden" />

        {/* --- NAVIGATION --- */}
        <nav className="space-y-1">
          {menus.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              title={item.label}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                activeModule === item.id
                ? 'bg-white text-[#0047AB] shadow-lg font-bold'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="text-sm tracking-tight whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[160px] transition-all duration-300">
                {item.label}
              </span>
              {activeModule === item.id && (
                <ChevronRight size={14} className="text-[#0047AB] ml-auto hidden group-hover:block shrink-0" />
              )}
            </button>
          ))}
        </nav>

        <a href="/learn" target="_blank" rel="noopener noreferrer" title="Learn GIS, guides & data sources"
          className="mt-3 w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-yellow-300/90 hover:bg-white/10 hover:text-yellow-200 transition-all">
          <span className="shrink-0"><GraduationCap size={18} /></span>
          <span className="text-sm tracking-tight whitespace-nowrap overflow-hidden max-w-0 group-hover:max-w-[160px] transition-all duration-300">
            Learn & Guides ↗
          </span>
        </a>
      </div>

      {/* --- PROFILE WIDGET --- */}
      <div className="flex items-center gap-1.5 px-1">
        <button
          onClick={() => setProfileOpen(true)}
          className="flex-1 min-w-0 flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-white/10 transition-all text-left"
        >
          <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center overflow-hidden shrink-0">
            {avatarUrl(user) ? (
              <img src={avatarUrl(user)} alt={user?.full_name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-white text-sm font-black">
                {(user?.full_name || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 hidden group-hover:block whitespace-nowrap">
            <p className="text-sm font-bold text-white truncate">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-blue-200 truncate">{user?.email}</p>
          </div>
        </button>
        <button
          onClick={handleLogout}
          title="Logout"
          className="hidden group-hover:flex transition-opacity p-2.5 text-red-200 hover:text-red-100 hover:bg-red-500/20 rounded-xl shrink-0"
        >
          <LogOut size={16} />
        </button>
      </div>

      {profileOpen && (
        <ProfileEditModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onUpdated={(updated) => setUser(updated)}
        />
      )}
    </aside>
  );
}
