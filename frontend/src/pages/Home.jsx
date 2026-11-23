import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ChevronUp,
  Droplets, Building2, Zap, Sprout, Database,
  ShieldCheck, HardHat, Mail, Phone, MapPin, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { FaLinkedinIn, FaGlobe } from "react-icons/fa";
import { isAuthenticated } from "../api/authApi";
import { useT } from "../i18n";
import { sendContact } from "../api/websiteApi";
import FloatingField from "../components/FloatingField";
import { CASE_STUDIES } from "../features/casestudies/caseStudies";
import { CaseCard } from "./public/CaseStudiesPage";

const features = [
  {
    id: "hydrology",
    icon: Droplets,
    title: "Hydrology",
    desc: "Terrain, flow, and flood analysis powered by Google Earth Engine.",
    tools: [
      "Watershed Delineation",
      "Flood Hazard Mapping",
      "Drainage Network Analysis",
      "Rainfall-Runoff Modeling",
      "River Corridor Risk",
    ],
  },
  {
    id: "disaster",
    icon: Zap,
    title: "Disaster Risk",
    desc: "Multi-hazard risk mapping to strengthen community resilience.",
    tools: [
      "Flood Risk Analysis",
      "Wildfire Analysis",
      "Land Susceptibility",
      "Earthquake Assessment",
      "Multi-Hazard Risk",
      "Disaster Impact Assessment",
    ],
  },
  {
    id: "urban",
    icon: Building2,
    title: "Urban Planning",
    desc: "Plan smarter cities with land-use and growth modeling.",
    tools: [
      "Land Use / Land Cover",
      "Urban Growth Analysis",
      "Road Network Analysis",
      "Suitability Analysis",
    ],
  },
  {
    id: "agriculture",
    icon: Sprout,
    title: "Agriculture",
    desc: "Optimize land productivity with crop and soil intelligence.",
    tools: [
      "Crop Suitability Analysis",
      "Soil Fertility Analysis",
      "Irrigation Coverage Analysis",
      "Agricultural Risk Analysis",
    ],
  },
  {
    id: "data-management",
    icon: Database,
    title: "Data Management",
    desc: "General-purpose GIS utilities available across every module.",
    tools: [
      "Raster Data Analysis",
      "Vector Data Analysis",
      "Digitization Tool",
      "Measurement Toolbox",
    ],
  },
];

const services = [
  { title: "Urban Planning & GIS Mapping", desc: "Strategic spatial frameworks for sustainable city growth." },
  { title: "Flood-prone & Disaster Risk Mapping", desc: "Advanced spatial modeling to enhance community resilience." },
  { title: "Local-level GIS for Municipalities", desc: "Custom GIS portals for municipal governance and management." },
  { title: "Geo-visualization Dashboards", desc: "Turning complex datasets into interactive visual stories." },
];

// Nepal's position within world.svg's own 842x595 coordinate space. Found by
// parsing the actual SVG paths (not guessed): computed each path's bounding
// box via getCTM/getBBox, isolated the candidates near India's northern
// border, and rendered each in isolation to confirm the shape against real
// Nepal borders before picking this point (verified to fall inside the
// polygon via isPointInFill).
const MAP_NATURAL_WIDTH = 842;
const MAP_NATURAL_HEIGHT = 595;
const NEPAL_X = 599.8;
const NEPAL_Y = 267.6;

const WorldMapHero = () => {
  const boxRef = useRef(null);
  const [dot, setDot] = useState(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const compute = () => {
      const { width: boxW, height: boxH } = el.getBoundingClientRect();
      if (!boxW || !boxH) return;
      const mapAR = MAP_NATURAL_WIDTH / MAP_NATURAL_HEIGHT;
      const boxAR = boxW / boxH;
      // object-fit: cover math — the map fills the box edge-to-edge on the
      // constrained axis and overflows (gets cropped) on the other.
      let contentW, contentH;
      if (boxAR > mapAR) {
        contentW = boxW;
        contentH = boxW / mapAR;
      } else {
        contentH = boxH;
        contentW = boxH * mapAR;
      }
      const offsetX = (boxW - contentW) / 2;
      const offsetY = (boxH - contentH) / 2;
      setDot({
        left: offsetX + (NEPAL_X / MAP_NATURAL_WIDTH) * contentW,
        top: offsetY + (NEPAL_Y / MAP_NATURAL_HEIGHT) * contentH,
      });
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="absolute inset-0">
      <img
        src="/world-mask.svg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transformOrigin: `${(NEPAL_X / MAP_NATURAL_WIDTH) * 100}% ${(NEPAL_Y / MAP_NATURAL_HEIGHT) * 100}%`,
          animation: "hero-map-zoom 5s ease-out forwards",
          opacity: 0.85,
          filter: "drop-shadow(0 0 1px rgba(56,189,248,0.5)) drop-shadow(0 0 3px rgba(56,189,248,0.25)) drop-shadow(0 0 6px rgba(56,189,248,0.12))",
        }}
      />
      {dot && (
        <div className="absolute" style={{ left: dot.left, top: dot.top, transform: "translate(-50%, -50%)" }}>
          {/* Opacity starts and ends at 0 so the scale reset at each loop
              boundary happens while invisible — avoids the visible "snap". */}
          <motion.span
            className="absolute inset-0 m-auto rounded-full border-2 border-[#F5AB6E]"
            style={{ width: 8, height: 8 }}
            animate={{ scale: [1, 1, 5.5], opacity: [0, 0.8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", times: [0, 0.05, 1] }}
          />
          <motion.span
            className="absolute inset-0 m-auto rounded-full border-2 border-[#F5AB6E]"
            style={{ width: 8, height: 8 }}
            animate={{ scale: [1, 1, 5.5], opacity: [0, 0.8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", times: [0, 0.05, 1], delay: 1.2 }}
          />
          <span className="relative block h-2.5 w-2.5 rounded-full bg-[#F5AB6E] border border-white shadow-[0_0_8px_rgba(245,171,110,0.95),0_0_20px_rgba(245,171,110,0.7),0_0_40px_rgba(245,171,110,0.4)]" />
        </div>
      )}
    </div>
  );
};

const BackToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-8 right-6 md:right-10 z-[999] h-12 w-12 rounded-full bg-theme-700 text-white shadow-[0_8px_24px_-6px_rgba(2,16,36,0.6)] flex items-center justify-center hover:bg-theme-900 hover:shadow-[0_8px_28px_-4px_rgba(2,16,36,0.75)] transition-all"
        >
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-theme-700"
            animate={{ scale: [1, 1, 1.6], opacity: [0, 0.6, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", times: [0, 0.05, 1] }}
          />
          <ChevronUp size={22} />
        </motion.button>
      )}
    </AnimatePresence>
  );
};

const founder = {
  name: "Saroj Chaudhary",
  designation: "Developer",
  photo: "/assets/team/Saroj-cutout.png",
  website: "https://chaudharysaroj.com.np",
  linkedin: "#",
};

const HomeContactSection = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      await sendContact(form);
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Could not send your message. Please try again.");
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="py-24 px-6 md:px-24 bg-theme-50/15">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mb-16">
          <h2 className="text-theme-500 font-black text-xs uppercase tracking-[0.3em] mb-4">Contact</h2>
          <h3 className="font-display text-3xl md:text-4xl font-bold text-slate-900">Let's talk about your next project</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
          <div className="lg:col-span-2">
            <div className="flex items-end gap-4">
              <div className="w-44 shrink-0">
                <p className="text-theme-700 font-bold uppercase tracking-widest text-xs mb-1">Developed By</p>
                <h4 className="text-lg font-black text-slate-800 whitespace-nowrap mb-3">{founder.name}</h4>
                <div className="flex gap-2 mb-5">
                  <a href={founder.website} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-theme-700 text-white flex items-center justify-center hover:bg-theme-900 transition-colors" title="Website">
                    <FaGlobe size={12} />
                  </a>
                  <a href={founder.linkedin} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-theme-800 text-white flex items-center justify-center hover:bg-theme-900 transition-colors" title="LinkedIn">
                    <FaLinkedinIn size={12} />
                  </a>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-slate-600 text-sm">
                    <Mail size={18} className="text-theme-700 shrink-0" />
                    <a href="mailto:info@chaudharysaroj.com.np" className="hover:text-theme-900 transition-colors">info@chaudharysaroj.com.np</a>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm">
                    <Phone size={18} className="text-theme-700 shrink-0" />
                    <a href="tel:+9779824646029" className="hover:text-theme-900 transition-colors">+977-9824646029</a>
                  </div>
                  <div className="flex items-center gap-3 text-slate-600 text-sm">
                    <MapPin size={18} className="text-theme-700 shrink-0" />
                    Dhangadhi, Kailali
                  </div>
                </div>
              </div>
              <img
                src={founder.photo}
                alt={founder.name}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="flex-1 h-64 md:h-72 w-full object-contain object-left-bottom select-none"
                style={{
                  WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                  maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
                  WebkitUserDrag: "none",
                }}
              />
            </div>
          </div>

          <div className="lg:col-span-3 relative bg-white rounded-[2rem] rounded-tr-md shadow-xl border border-slate-100 p-8 md:p-10 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-theme-100 rounded-full blur-3xl opacity-70 pointer-events-none" />

            {status === "success" ? (
              <div className="relative flex flex-col items-center text-center py-10">
                <CheckCircle2 className="text-green-500 mb-4" size={48} />
                <h3 className="text-xl font-black text-slate-800 mb-2">Message Sent</h3>
                <p className="text-slate-500 text-sm">Thank you for reaching out. We will get back to you soon.</p>
                <button onClick={() => setStatus("idle")} className="mt-6 text-theme-700 font-bold text-sm hover:underline">
                  Send another message
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="mb-7">
                  <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">Send a Message</h4>
                  <p className="text-slate-400 text-xs">We usually reply within a day</p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  {status === "error" && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      {errorMsg}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FloatingField label="Full Name" name="name" value={form.name} onChange={handleChange} required />
                    <FloatingField label="Email Address" name="email" type="email" value={form.email} onChange={handleChange} required />
                  </div>
                  <FloatingField label="What did not work for you, or how can we help?" name="message" as="textarea" rows={5} value={form.message} onChange={handleChange} required />
                  <button
                    disabled={status === "loading"}
                    className="w-full flex items-center justify-center gap-2 bg-theme-700 text-white font-black py-4 rounded-xl hover:bg-[#F2994A] shadow-xl transition-all uppercase tracking-widest disabled:opacity-50"
                  >
                    {status === "loading" && <Loader2 size={18} className="animate-spin" />}
                    {status === "loading" ? "Sending..." : "Send Message"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  const location = useLocation();
  const loggedIn = isAuthenticated();
  const t = useT();

  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-theme-50/15 font-sans overflow-x-hidden">

      {/* --- HERO SECTION --- */}
      <section className="relative h-[85vh] min-h-[600px] flex flex-col justify-center px-6 md:px-24 overflow-hidden bg-[#185DC3]">
        <WorldMapHero />
        <div className="absolute inset-0 bg-[#021024]/25" />

        <div className="relative z-20 max-w-3xl text-white">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-2"
          >
            <h2 className="font-bold text-sm tracking-[0.3em] uppercase text-theme-300">{t("Hello, Engineer's")}</h2>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-display text-4xl md:text-6xl font-black mb-6 leading-tight tracking-tight"
          >
            <span className="block text-[#F5F5F0]">{t('Welcome to')}</span>
            <span className="text-white">MapNiti</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="text-lg md:text-xl text-white/80 mb-10 max-w-xl leading-relaxed"
          >
            {t('A complete GIS and remote sensing platform for hydrology, disaster risk, urban planning, and agriculture analysis, powered by Google Earth Engine.')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          >
            <Link
              to={loggedIn ? "/tool" : "/register"}
              className="inline-flex items-center gap-2 bg-pop-500 text-white px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-pop-600 transition-all shadow-[0_10px_30px_-8px_rgba(242,153,74,0.6)] hover:shadow-[0_10px_30px_-8px_rgba(217,130,47,0.7)]"
            >
              {t('Get Started')}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* --- ABOUT MAPNITI --- */}
      <section id="about" className="py-24 px-6 md:px-24 bg-theme-50/15">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <h2 className="text-theme-500 font-black text-xs uppercase tracking-[0.3em] mb-4">About MapNiti</h2>
            <h3 className="font-display text-3xl md:text-4xl font-bold text-slate-900 mb-6 leading-tight">
              Built to make geospatial engineering simple, fast, and accessible.
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              MapNiti is a Geo-ICT platform for engineers who are done juggling scripts,
              satellite imagery and a dozen separate tools. Hydrology, disaster risk, urban
              planning and agriculture analysis live in one workspace, powered by Google Earth
              Engine, with data downloads, engineering calculators and an AI assistant built in.
            </p>
            <p className="text-slate-600 leading-relaxed mb-8">
              Our vision is to be Nepal's go-to geo-intelligence platform, helping engineers
              solve complex problems one map, one model and one dataset at a time, and helping
              the next generation learn GIS for free.
            </p>
            <Link to="/about" className="inline-flex items-center gap-2 text-theme-700 font-bold text-sm hover:gap-3 hover:text-theme-900 transition-all">
              Learn more about us <ArrowRight size={16} />
            </Link>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 gap-6">
            <div className="bg-theme-100 rounded-3xl p-8 flex flex-col gap-3">
              <ShieldCheck className="text-theme-700" size={28} />
              <h4 className="font-bold text-slate-800">Trusted Analysis</h4>
              <p className="text-slate-500 text-sm">Science-driven models backed by real satellite and terrain data.</p>
            </div>
            <div className="bg-theme-100 rounded-3xl p-8 flex flex-col gap-3 mt-8">
              <HardHat className="text-theme-700" size={28} />
              <h4 className="font-bold text-slate-800">Built for Engineers</h4>
              <p className="text-slate-500 text-sm">Civil, geomatics and environmental workflows, from site reports to DXF contours.</p>
            </div>
            <div className="bg-theme-100 rounded-3xl p-8 flex flex-col gap-3 col-span-2">
              <p className="text-4xl font-display font-black text-theme-700">300+ <span className="text-base font-semibold text-slate-500">projects delivered since 2014</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section id="features" className="py-24 px-6 md:px-24 bg-theme-50/15">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="text-theme-500 font-black text-xs uppercase tracking-[0.3em] mb-4">Features</h2>
            <h3 className="font-display text-3xl md:text-4xl font-bold text-slate-900">
              Five analysis modules. One GIS workspace.
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map(({ id, icon: Icon, title, desc, tools }) => (
              <div key={id} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className="h-12 w-12 rounded-2xl bg-theme-200 flex items-center justify-center mb-5">
                  <Icon className="text-theme-900" size={22} />
                </div>
                <h4 className="font-display text-xl font-bold text-slate-900 mb-2">{title}</h4>
                <p className="text-slate-500 text-sm mb-5">{desc}</p>
                <ul className="space-y-2 mb-6">
                  {tools.map((tool) => (
                    <li key={tool} className="flex items-center gap-2 text-slate-600 text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-theme-500 shrink-0" />
                      {tool}
                    </li>
                  ))}
                </ul>
                <Link to={`/tool?module=${id}`} className="inline-flex items-center gap-2 text-theme-700 font-bold text-xs uppercase tracking-widest hover:gap-3 hover:text-theme-900 transition-all">
                  Explore Tool <ArrowRight size={14} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- SERVICES SECTION --- */}
      <section id="services" className="py-24 px-6 md:px-24 bg-theme-50/15">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-16 gap-4">
            <div className="max-w-2xl">
              <h2 className="text-theme-500 font-black text-xs uppercase tracking-[0.3em] mb-4">Services</h2>
              <h3 className="font-display text-3xl md:text-4xl font-bold text-slate-900">What we offer beyond the platform</h3>
            </div>
            <Link to="/services" className="inline-flex items-center gap-2 text-theme-700 font-bold text-sm hover:gap-3 hover:text-theme-900 transition-all shrink-0">
              View all services <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div key={s.title} className="bg-theme-100 border border-theme-200 rounded-2xl p-6 hover:border-theme-900 hover:shadow-lg transition-all">
                <span className="text-theme-500 font-black text-xs uppercase tracking-widest">Service 0{i + 1}</span>
                <h4 className="font-bold text-slate-800 mt-3 mb-2">{s.title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FREE LEARNING & RESOURCES (public, no login) --- */}
      <section id="learn" className="py-24 px-6 md:px-24 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-12">
            <h2 className="text-theme-500 font-black text-xs uppercase tracking-[0.3em] mb-4">Free for everyone</h2>
            <h3 className="font-display text-3xl md:text-4xl font-bold text-slate-900">Learn GIS, find data, ask the AI</h3>
            <p className="text-slate-500 mt-3">No account needed. Log in only when you want to run analyses and download data.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { to: '/learn', title: 'Learn GIS — 15 courses', desc: 'From HTML and GIS basics to Earth Engine, GeoAI and cloud-native GIS, with code you run in the browser.' },
              { to: '/code-lab', title: 'Code Lab', desc: 'Run HTML/Leaflet maps, Python (numpy, pandas, shapely, scikit-learn), JavaScript + Turf and SQL — nothing to install.' },
              { to: '/gis-guide', title: 'GIS Guide', desc: 'What GIS can do in each sector, core concepts, the most powerful tools and step-by-step analysis guides.' },
              { to: '/whats-new', title: "What's New in GIS", desc: 'QGIS 4.0, GeoLibre, NISAR radar, Sentinel-1D, AlphaEarth embeddings and other 2026 updates.' },
              { to: '/data-sources', title: 'Data Sources', desc: 'Nepal government portals, global datasets, software and AI tools, and which data you need for each job.' },
              { to: '/ai', title: 'MapNiti AI', desc: 'Ask about drainage design, coordinate systems, GEE code or where to find data, in English or Nepali.' },
            ].map((c) => (
              <Link key={c.to} to={c.to} className="group p-6 rounded-2xl border border-theme-200 bg-theme-50/40 hover:bg-theme-100 hover:border-theme-700 transition-all">
                <h4 className="font-bold text-slate-800 group-hover:text-theme-800">{c.title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed mt-2">{c.desc}</p>
                <span className="inline-flex items-center gap-1 text-theme-700 font-bold text-sm mt-4 group-hover:gap-2 transition-all">Open <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --- RECENT ANALYSES SECTION --- */}
      <section className="relative z-20 py-24 bg-theme-50/15 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 className="font-display text-3xl font-black text-theme-700 tracking-tight border-l-8 border-theme-500 pl-6">
                What People Are Analyzing
              </h2>
              <p className="text-slate-500 mt-2 ml-8 font-medium italic">Real analyses run on MapNiti. Open one to see the data, steps and results.</p>
            </div>
            <Link to="/case-studies" className="hidden md:flex items-center gap-2 text-xs font-bold text-theme-700 hover:text-theme-900 hover:underline">
              All case studies <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {CASE_STUDIES.map((c) => <CaseCard key={c.slug} c={c} />)}
          </div>
          <div className="mt-10 text-center">
            <Link to="/tool" className="inline-flex items-center gap-2 text-sm font-bold text-theme-700 hover:underline">
              Run your own analysis <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* --- CONTACT SECTION --- */}
      <HomeContactSection />

      {/* --- CLOSING CTA --- */}
      <section className="py-24 px-6 md:px-24 bg-gradient-to-br from-[#0080D9] via-[#015298] to-[#061639] text-white text-center">
        <h3 className="font-display text-3xl md:text-5xl font-bold mb-6">
          Ready to run your first analysis?
        </h3>
        <p className="text-theme-200/70 max-w-xl mx-auto mb-10">
          Create a free account and start exploring the MapNiti GIS engine today.
        </p>
        <Link
          to={loggedIn ? "/tool" : "/register"}
          className="inline-flex items-center gap-2 bg-pop-500 text-white px-10 py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-pop-600 transition-all shadow-[0_10px_30px_-8px_rgba(242,153,74,0.6)] hover:shadow-[0_10px_30px_-8px_rgba(217,130,47,0.7)]"
        >
          Get Started
        </Link>
      </section>

      <BackToTop />

    </div>
  );
}
