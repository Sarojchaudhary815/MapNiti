import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Map as MapIcon, Droplets, Building2, Zap, Sprout, ArrowLeft } from "lucide-react";
const LogoImg = "/assets/MapNiti_logo_transparent.png";
import ContourLines from "../components/ContourLines";

const highlights = [
  { icon: Droplets, text: "Flood hazard mapping & watershed delineation" },
  { icon: Zap, text: "Multi-hazard disaster risk assessment" },
  { icon: Building2, text: "Urban growth & suitability analysis" },
  { icon: Sprout, text: "Crop suitability & soil fertility analysis" },
];

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen w-full flex bg-white font-sans">
      {/* --- LEFT BRANDING PANEL --- */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0080D9] via-[#015298] to-[#061639] text-white flex-col justify-between p-14 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <ContourLines className="absolute inset-0 w-full h-full text-white pointer-events-none" />
        <div
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #f5a300, transparent 70%)" }}
        />

        <Link to="/" className="relative z-10 flex items-center no-underline w-fit">
          <span className="bg-white rounded-2xl px-4 py-2.5 shadow-sm">
            <img src={LogoImg} alt="MapNiti" className="h-10 w-auto object-contain" />
          </span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-white/10 text-accent-400 text-xs font-bold uppercase tracking-widest">
            <MapIcon size={14} /> GIS &amp; Remote Sensing Platform
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight mb-6">
            One workspace for every spatial analysis you need.
          </h1>
          <ul className="space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-blue-100/90 text-sm">
                <span className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-accent-400" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </motion.div>

        <p className="relative z-10 text-blue-100/50 text-xs">
          © {new Date().getFullYear()} MapNiti Pvt. Ltd. · Engineering the future with GIS
        </p>
      </div>

      {/* --- RIGHT FORM PANEL --- */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 sm:px-10 py-12 bg-slate-50">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="lg:hidden flex items-center gap-2 text-slate-400 hover:text-brand-600 text-sm font-semibold mb-8">
            <ArrowLeft size={16} /> Back to home
          </Link>

          <div className="mb-8">
            <div className="h-14 w-14 bg-brand-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-brand-600/20">
              <MapIcon className="text-accent-400" size={26} />
            </div>
            <h2 className="text-3xl font-display font-bold text-slate-900">{title}</h2>
            <p className="text-slate-500 text-sm mt-2">{subtitle}</p>
          </div>

          {children}
        </motion.div>
      </div>
    </div>
  );
}
