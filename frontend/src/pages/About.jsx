import React, { useState } from "react";
import { ChevronUp } from "lucide-react";
import ContourLines from "../components/ContourLines";

export default function About() {
  const [activeTab, setActiveTab] = useState("All");

  // --- UPDATED PARTNER LOGOS PATH ---
  const partnerLogos = [
    { name: "UNDP", cat: "Non-Government", logo: "/assets/about/parter.jpg" },
    { name: "Nepal Government", cat: "Government", logo: "/assets/about/lmtc.jpg" },
    { name: "World Vision", cat: "Non-Government", logo: "/assets/about/ngo.jpg" },
    { name: "Naxa Pvt Ltd", cat: "Private", logo: "/assets/about/naxa.jpg" },
    { name: "UNOPS", cat: "Non-Government", logo: "/assets/about/unops.png" },
    { name: "Department of IT", cat: "Government", logo: "/assets/about/doit.png" },
    { name: "Oxfam", cat: "Non-Government", logo: "/assets/about/oxfam.png" }, 
  ];

  const filteredLogos = activeTab === "All" 
    ? partnerLogos 
    : partnerLogos.filter(logo => logo.cat === activeTab);

  return (
    <div className="min-h-screen bg-theme-50/15 font-sans text-slate-800">
      
      {/* --- SECTION 1: HERO (DIRECT IMAGE UPDATE) --- */}
      <section className="relative h-[70vh] flex items-center px-10 md:px-32 overflow-hidden text-white">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ 
            // Color/Gradient hatayera direct photo matra rakheko:
            backgroundImage: `url('/assets/about/hero-bg.jpg')`,
          }}
        ></div>
        
        {/* Halka dark overlay (Optional): Yadi image ekdam bright chha vane text padna sajilo hos vanna ko lagi yo rakheko chu */}
        <div className="absolute inset-0 bg-black/20 z-0"></div>

        <div className="relative z-10 max-w-4xl">
          <h2 className="text-theme-300 font-black text-xs uppercase tracking-[0.4em] mb-4">About Us</h2>
          <h1 className="text-6xl md:text-8xl font-black mb-2 tracking-tighter text-white">MapNiti</h1>
          <h2 className="text-3xl md:text-5xl font-light text-theme-300 mb-8 italic">Geo-Tech Solutions</h2>
          <p className="text-lg text-slate-200 max-w-2xl font-light opacity-90 leading-relaxed">
            MapNiti is a Geo-ICT technology consulting that strives for innovation in geospatial technologies to provide solutions to contemporary problems of humanity.
          </p>
        </div>
      </section>

      {/* --- SECTION 2: MISSION & VISION --- */}
      <section className="py-24 px-10 md:px-32 relative bg-theme-50/15 overflow-hidden">
        <ContourLines className="absolute inset-y-0 right-0 w-1/2 h-full text-theme-300 pointer-events-none" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 border-b border-slate-100 pb-20 relative z-10">
          <div className="md:col-span-3">
            <h2 className="text-theme-500 font-black text-xs uppercase tracking-widest mb-24">Our Mission</h2>
            <h2 className="text-theme-500 font-black text-xs uppercase tracking-widest">Our Vision</h2>
          </div>
          <div className="md:col-span-9 space-y-16">
            <div>
              <p className="text-xl text-slate-600 leading-relaxed mb-6">
                MapNiti's mission is to address contemporary problems in developing countries through technological innovation, particularly in digital and spatial technology.
              </p>
              <p className="text-xl text-slate-600 leading-relaxed">
                We build for engineers working at every scale, turning raw geospatial data into decisions that governments, private organizations, and communities can act on, in and outside of Nepal.
              </p>
            </div>
            <div>
              <p className="text-xl text-slate-600 leading-relaxed">
                MapNiti's vision is to be a leading geo-intelligence provider that helps the world navigates its future.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 3: OUR HISTORY --- */}
      <section className="py-24 px-10 md:px-32 bg-theme-50/15">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-theme-500 font-black text-xs uppercase tracking-widest mb-10">Our History</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start">
            <div className="space-y-8">
              <h1 className="text-4xl font-bold leading-tight text-slate-900">
                <span className="text-theme-700">MapNiti Pvt. Ltd.</span> is an outcome of the <span className="text-theme-700">willpower</span> to introduce location data as the foundational data for any developmental activity.
              </h1>
              <p className="text-slate-600 text-base leading-relaxed italic">
                The company was founded by Geomatics Engineers specialized in GIS mapping and geo-database management and visualization.
              </p>
              <p className="text-slate-600 text-base leading-relaxed">
                The team developed an app "CLEAN KTM" which is a crowdsourcing platform to report and manage waste problems in Kathmandu Valley during the NASA International Space Apps Challenge.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <img src="/assets/about/history-1.jpg" alt="Team" className="rounded-2xl w-full h-72 object-cover shadow-md" />
              </div>
              <div className="mt-4">
                <img src="/assets/about/history-2.jpg" alt="Award" className="rounded-2xl w-full h-48 object-cover shadow-lg" />
              </div>
              <div className="-mt-12">
                <img src="/assets/about/history-3.jpg" alt="Work" className="rounded-2xl w-full h-80 object-cover shadow-xl border-8 border-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 4: CLIENTELE --- */}
      <section className="py-24 px-10 md:px-32 bg-theme-50/15">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <h2 className="text-theme-500 font-black text-xs uppercase tracking-widest mb-6">Our Clientèle</h2>
            <h3 className="text-4xl font-bold mb-6 text-slate-900">We love working with network of <span className="text-theme-700">leading partners</span></h3>
          </div>

          <div className="flex flex-wrap gap-8 border-b border-slate-100 mb-16 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
            {["All", "Government", "Non-Government", "Private"].map((tab) => (
              <span
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-5 cursor-pointer transition-all border-b-4 ${
                  activeTab === tab ? "border-theme-900 text-slate-900" : "border-transparent hover:text-theme-900"
                }`}
              >
                {tab}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-12 gap-y-16 items-center">
             {filteredLogos.map((item, index) => (
               <div key={index} className="h-20 flex items-center justify-center transition-all duration-300">
                  <img 
                    src={item.logo} 
                    alt={item.name} 
                    className="max-h-full max-w-full object-contain transition-all hover:scale-110"
                    title={item.name}
                  />
               </div>
             ))}
          </div>
          
          {filteredLogos.length === 0 && (
            <p className="text-center text-slate-400 py-10 uppercase text-xs tracking-widest">No partners to show.</p>
          )}
        </div>
      </section>

      <div 
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-10 right-10 h-12 w-12 bg-white shadow-2xl rounded-full flex items-center justify-center text-theme-700 border border-slate-50 cursor-pointer hover:bg-theme-900 hover:text-white transition-all z-50"
      >
        <ChevronUp size={24} />
      </div>

    </div>
  );
}