import React from "react";
import ContourLines from "../components/ContourLines";

const services = [
  {
    title: "Urban Planning and GIS Mapping",
    subtitle: "Strategic spatial frameworks for sustainable city growth.",
    description: "We provide comprehensive urban spatial analysis and digital base-map preparation. Our team specializes in transforming raw field data into actionable tools for infrastructure management.",
    // Image of a modern city layout with 3D building models
    imageUrl: "https://images.unsplash.com/photo-1573108595999-429c77484341?auto=format&fit=crop&q=80&w=800", 
    imageSide: "left",
  },
  {
    title: "Flood-prone Area and Disaster Risk Mapping",
    subtitle: "Advanced spatial modeling to enhance community resilience.",
    description: "Using hydrological modeling, we identify high-risk zones. Our maps are designed for emergency response teams to implement preventive measures and safeguard lives.",
    // Image of a topographical map showing water levels or terrain
    imageUrl: "https://images.unsplash.com/photo-1547233225-30581648055e?auto=format&fit=crop&q=80&w=800", 
    imageSide: "right",
  },
  {
    title: "Local-level GIS Solutions for Municipalities",
    subtitle: "Empowering local governance through digitized management.",
    description: "We build custom GIS portals for municipal needs, from house numbering to revenue collection systems. Our solutions bridge the gap between technology and administration.",
    // Image of a tablet displaying a map with data points
    imageUrl: "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?auto=format&fit=crop&q=80&w=800",
    imageSide: "left",
  },
  {
    title: "Customized Geo-visualization Dashboards",
    subtitle: "Turning complex datasets into interactive visual stories.",
    description: "Our dashboards allow users to interact with spatial data in real-time. We provide the tools to see the 'where' in your data through high-end web portals.",
    // Image of high-tech data visualization on multiple screens
    imageUrl: "https://images.unsplash.com/photo-1551288049-bbbda546697c?auto=format&fit=crop&q=80&w=800",
    imageSide: "right",
  }
];

const MapNitiServices = () => {
  return (
    <div className="font-sans text-slate-900 bg-theme-50/15">

      {/* --- HERO SECTION WITH BACKGROUND IMAGE --- */}
      <section className="relative h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            // Image of a high-tech digital map background
            src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1600"
            alt="MapNiti Hero"
            className="w-full h-full object-cover brightness-[0.3]"
          />
          {/* Blue gradient overlay for extra branding feel */}
          <div className="absolute inset-0 bg-theme-900/20 mix-blend-multiply"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-white">
          <div className="inline-block px-4 py-1 rounded-full bg-theme-700/30 border border-theme-400 mb-6 backdrop-blur-sm">
            <span className="text-theme-200 font-bold tracking-widest text-xs uppercase">
              Expertise in Location Intelligence
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight max-w-4xl">
            At <span className="text-blue-400">MapNiti</span>, we work on <span className="italic">ideas</span> that solve 
            complex <span className="text-blue-400">spatial problems.</span>
          </h1>
          <p className="mt-8 text-xl text-slate-300 max-w-2xl leading-relaxed font-light">
            We are a team dedicated to exploring and building localized innovations 
            through precision mapping and data-driven insights.
          </p>
        </div>
      </section>

      {/* --- SERVICES LIST SECTION --- */}
      <div className="relative overflow-hidden py-20">
        <ContourLines className="absolute inset-y-0 right-0 w-1/2 h-full text-theme-200 pointer-events-none" />
        {services.map((service, index) => (
          <section key={index} className="relative z-10 py-20 px-6 bg-theme-50/15">
            <div className={`max-w-7xl mx-auto flex flex-col ${service.imageSide === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-16`}>
              
              {/* Image with Decorative Border */}
              <div className="w-full md:w-1/2">
                <div className="relative group">
                  <div className="absolute -top-4 -left-4 w-24 h-24 border-t-4 border-l-4 border-theme-700 rounded-tl-2xl"></div>
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-4 border-r-4 border-theme-700 rounded-br-2xl"></div>
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 group-hover:shadow-theme-300">
                    <img 
                      src={service.imageUrl} 
                      alt={service.title}
                      className="w-full aspect-[4/3] object-cover transform transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                </div>
              </div>

              {/* Content Box */}
              <div className="w-full md:w-1/2">
                <div className="flex items-center gap-3 mb-6">
                   <div className="h-[2px] w-12 bg-theme-500"></div>
                   <span className="text-theme-500 font-bold uppercase tracking-widest text-sm">Service 0{index + 1}</span>
                </div>

                <h2 className="text-4xl font-bold text-slate-800 mb-6 leading-tight">{service.title}</h2>

                <p className="text-xl text-theme-700 font-semibold mb-8 border-l-4 border-theme-300 pl-4">
                  {service.subtitle}
                </p>

                <div className="bg-white p-10 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
                   {/* Subtle background detail for the text box */}
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                  </div>
                  <p className="text-slate-600 text-lg leading-relaxed relative z-10">
                    {service.description}
                  </p>
                </div>
              </div>

            </div>
          </section>
        ))}
      </div>

      {/* --- CONTACT CTA --- */}
      <section className="py-24 bg-theme-900 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        </div>
        
        <div className="max-w-4xl mx-auto text-center px-6 relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">Ready to transform your ideas into <span className="text-blue-400">spatial reality</span>?</h2>
          <p className="text-slate-400 text-xl mb-12">Contact MapNiti today for a consultation on your next GIS or Urban Planning project.</p>
          <button className="bg-theme-700 text-white px-12 py-5 rounded-xl font-bold text-lg hover:bg-theme-900 transition-all shadow-2xl hover:shadow-theme-900/20 active:scale-95">
            Start Your Journey with MapNiti
          </button>
        </div>
      </section>
      
    </div>
  );
};

export default MapNitiServices;