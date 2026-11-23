import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Map as MapIcon, Menu, X, LogOut, ChevronDown, Sparkles, GraduationCap, Code2, Compass, Newspaper, Database, FileText, Terminal } from 'lucide-react';
import { isAuthenticated, logoutUser } from '../api/authApi';
import { useT, LanguageToggle } from '../i18n';

const LogoImg = '/assets/MapNiti_logo_transparent.png';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/#about', label: 'About Us' },
  { to: '/#services', label: 'Services' },
  { to: '/#contact', label: 'Contact' },
];

// Free knowledge base (public — no login required)
const resourceLinks = [
  { to: '/learn', label: 'Learn GIS — courses', desc: 'Zero to advanced, with runnable code', icon: GraduationCap },
  { to: '/learn-programming', label: 'Learn Programming', desc: 'Python for GIS, step by step, run every cell', icon: Terminal },
  { to: '/code-lab', label: 'Code Lab', desc: 'Run HTML, Python, JS & SQL in the browser', icon: Code2 },
  { to: '/gis-guide', label: 'GIS Guide', desc: 'What GIS can do, tools & analysis guides', icon: Compass },
  { to: '/whats-new', label: "What's New in GIS", desc: 'QGIS 4, GeoLibre, NISAR, GeoAI…', icon: Newspaper },
  { to: '/data-sources', label: 'Data Sources', desc: 'Nepal & global data portals', icon: Database },
  { to: '/case-studies', label: 'Case Studies', desc: 'Real analyses: data, steps & results', icon: FileText },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();
  const t = useT();

  const handleLogout = () => {
    logoutUser();
    setOpen(false);
    navigate('/');
  };

  const handleNavLinkClick = (to) => {
    setOpen(false);
    if (to === '/') window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const anchorLinkClass = 'whitespace-nowrap font-semibold text-[15px] text-slate-600 hover:text-theme-900 transition-colors';

  return (
    <nav className="sticky top-0 z-[1000] bg-white/95 backdrop-blur border-b border-slate-100 shadow-sm">
      <div className="flex justify-between items-center px-6 lg:px-12 xl:px-24 py-3">
        {/* --- LOGO --- */}
        <Link to="/" className="flex items-center gap-3 no-underline" onClick={() => setOpen(false)}>
          <img src={LogoImg} alt="MapNiti" className="h-9 w-auto object-contain" />
        </Link>

        {/* --- DESKTOP NAV --- */}
        <div className="hidden lg:flex gap-6 xl:gap-8 items-center font-sans">
          {navLinks.slice(0, 2).map((link) => (
            <Link key={link.to} to={link.to} onClick={() => handleNavLinkClick(link.to)} className={anchorLinkClass}>
              {t(link.label)}
            </Link>
          ))}

          <div className="relative" onMouseEnter={() => setResOpen(true)} onMouseLeave={() => setResOpen(false)}>
            <button className={`${anchorLinkClass} flex items-center gap-1`} onClick={() => setResOpen((o) => !o)}>
              {t('Learn & Resources')} <ChevronDown size={15} />
            </button>
            {resOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-80">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-2">
                  {resourceLinks.map((r) => (
                    <Link key={r.to} to={r.to} onClick={() => setResOpen(false)} className="flex items-start gap-3 p-3 rounded-xl hover:bg-theme-50">
                      <r.icon size={18} className="text-theme-700 mt-0.5 shrink-0" />
                      <span>
                        <span className="block text-[14px] font-bold text-slate-800">{t(r.label)}</span>
                        <span className="block text-[12px] text-slate-500">{t(r.desc)}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {navLinks.slice(2).map((link) => (
            <Link key={link.to} to={link.to} onClick={() => handleNavLinkClick(link.to)} className={anchorLinkClass}>
              {t(link.label)}
            </Link>
          ))}

          <Link to="/ai" className="flex items-center gap-1.5 text-[14px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 px-4 py-2 rounded-full">
            <Sparkles size={15} /> AI
          </Link>
          <LanguageToggle compact />

          {loggedIn ? (
            <div className="flex items-center gap-3">
              <Link
                to="/tool"
                className="bg-theme-700 text-white px-6 py-2 rounded-full flex items-center gap-2 hover:bg-theme-900 transition-all shadow-md font-bold text-[14px]"
              >
                <MapIcon size={18} />
                {t('MapNiti Tool')}
              </Link>
              <button
                onClick={handleLogout}
                title={t('Logout')}
                className="text-slate-400 hover:text-red-500 transition-colors p-2"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="border border-theme-700 text-theme-700 px-6 py-2 rounded-full font-bold text-[14px] hover:bg-theme-900 hover:text-white hover:border-theme-900 transition-all"
            >
              {t('Login')}
            </Link>
          )}
        </div>

        {/* --- MOBILE TOGGLE --- */}
        <button
          className="lg:hidden text-slate-700 p-2"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle navigation menu"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* --- MOBILE MENU --- */}
      {open && (
        <div className="lg:hidden flex flex-col gap-1 px-6 pb-6 border-t border-slate-100 bg-white">
          {[...navLinks, ...resourceLinks, { to: '/ai', label: 'AI Assistant' }].map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => handleNavLinkClick(link.to)}
              className="py-3 font-semibold text-[15px] border-b border-slate-50 text-slate-600"
            >
              {t(link.label)}
            </Link>
          ))}
          <div className="py-3"><LanguageToggle /></div>

          {loggedIn ? (
            <>
              <Link
                to="/tool"
                onClick={() => setOpen(false)}
                className="mt-4 bg-theme-700 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-[14px]"
              >
                <MapIcon size={18} />
                MapNiti Tool
              </Link>
              <button
                onClick={handleLogout}
                className="mt-3 flex items-center justify-center gap-2 text-red-500 font-semibold text-sm py-2"
              >
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="mt-4 text-center border border-theme-700 text-theme-700 px-6 py-3 rounded-xl font-bold text-[14px]"
            >
              Login
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
