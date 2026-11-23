import React, { useState } from "react";
import ContourLines from "../components/ContourLines";

// --- PROJECT DATA ---
const projectsData = [
  {
    id: 1,
    title: "Kathmandu Urban Expansion Mapping",
    category: "Urban Planning",
    description: "Detailed analysis of Kathmandu Valley's urban growth patterns from 2000-2023 using satellite imagery and GIS. Identified key areas for sustainable development.",
    imageUrl: "https://images.unsplash.com/photo-1572932400194-c189c445ac43?auto=format&fit=crop&q=80&w=800",
    client: "Kathmandu Metropolitan City",
    date: "August 2023",
    tags: ["GIS", "Urban Development", "Nepal"],
  },
  {
    id: 2,
    title: "Bhaktapur Flood Risk Assessment",
    category: "Disaster Management",
    description: "Developed high-resolution flood susceptibility maps for Bhaktapur municipality, identifying vulnerable areas and proposing mitigation strategies.",
    imageUrl: "https://images.unsplash.com/photo-1547233225-30581648055e?auto=format&fit=crop&q=80&w=800",
    client: "Ministry of Home Affairs",
    date: "June 2023",
    tags: ["Flood Mapping", "Risk Assessment", "Hydrology"],
  },
  {
    id: 3,
    title: "Local Government Asset Management",
    category: "Municipal Solutions",
    description: "Designed a web-based GIS platform for manage public assets, infrastructure, and property records for better local governance.",
    imageUrl: "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?auto=format&fit=crop&q=80&w=800",
    client: "Siddharthanagar Municipality",
    date: "April 2023",
    tags: ["Web GIS", "Asset Management", "Governance"],
  }
];

const MapNitiProjects = () => {
  const [filter, setFilter] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter Logic
  const categories = ["All", ...new Set(projectsData.map((p) => p.category))];
  const filteredProjects = filter === "All" ? projectsData : projectsData.filter((p) => p.category === filter);

  // Modal Toggle
  const toggleModal = () => setIsModalOpen(!isModalOpen);

  return (
    <div className="font-sans text-slate-900 bg-theme-50/15 min-h-screen">

      {/* --- HERO SECTION --- */}
      <section className="relative bg-theme-900 py-32 md:py-48 text-white overflow-hidden">
        {/* Background Overlay Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=1600"
            className="w-full h-full object-cover opacity-20"
            alt="Background"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-theme-900/40 to-theme-900"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
            Our <span className="text-theme-300">Projects</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            From urban transformation to disaster resilience, MapNiti delivers precision-driven spatial intelligence across Nepal.
          </p>
        </div>
      </section>

      {/* --- PROJECT FILTER & GRID --- */}
      <section className="relative overflow-hidden py-16 bg-theme-50/15">
        <ContourLines className="absolute inset-y-0 left-0 w-1/2 h-full text-theme-200 pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-6">

          {/* Filter Navigation */}
          <div className="flex flex-wrap justify-center gap-3 mb-16">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-8 py-3 rounded-full font-bold transition-all duration-300 transform active:scale-95 ${
                  filter === cat
                    ? "bg-theme-900 text-white shadow-xl shadow-theme-300"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Project Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredProjects.map((project) => (
              <div key={project.id} className="group bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500">
                <div className="relative h-64 overflow-hidden">
                  <img src={project.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={project.title} />
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 backdrop-blur-md text-theme-700 text-xs font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-sm">
                      {project.category}
                    </span>
                  </div>
                </div>

                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-3 group-hover:text-theme-900 transition-colors">{project.title}</h3>
                  <p className="text-slate-500 mb-6 leading-relaxed line-clamp-3">{project.description}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    {project.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold text-slate-400 border border-slate-200 px-3 py-1 rounded-md uppercase tracking-tighter">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                    <div className="text-xs">
                       <p className="text-slate-400 uppercase tracking-tighter font-bold">Client</p>
                       <p className="font-bold text-slate-800">{project.client}</p>
                    </div>
                    <div className="text-xs text-right">
                       <p className="text-slate-400 uppercase tracking-tighter font-bold">Date</p>
                       <p className="font-bold text-slate-800">{project.date}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="py-24 bg-theme-50/15 text-center">
        <div className="max-w-4xl mx-auto px-6 bg-theme-900 rounded-[3rem] py-20 text-white shadow-2xl shadow-theme-300">
          <h2 className="text-4xl font-black mb-6">Start a Project with MapNiti?</h2>
          <p className="text-theme-200 text-xl mb-10 max-w-xl mx-auto">
            Ready to bring your spatial data to life? Let's discuss how we can help your organization.
          </p>
          <button
            onClick={toggleModal}
            className="bg-white text-theme-900 px-12 py-5 rounded-2xl font-black text-lg hover:bg-theme-900 hover:text-white transition-all transform hover:-translate-y-1 active:scale-95 shadow-xl"
          >
            Discuss Your Project
          </button>
        </div>
      </section>

      {/* --- CONTACT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={toggleModal}></div>
          
          {/* Modal Card */}
          <div className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <button onClick={toggleModal} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="p-8 sm:p-12">
              <h2 className="text-3xl font-black text-slate-900 mb-2">Let's Talk.</h2>
              <p className="text-slate-500 mb-8 font-medium">Briefly tell us about your project requirements.</p>

              <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                    <input type="text" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-theme-500 transition-all outline-none" placeholder="yourname" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Work Email</label>
                    <input type="email" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-theme-500 transition-all outline-none" placeholder="name@gmail.com" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Interested In</label>
                  <select className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-theme-500 transition-all outline-none appearance-none cursor-pointer">
                    <option>Urban Planning & Design</option>
                    <option>Disaster Risk Mapping</option>
                    <option>Custom Web-GIS Dashboard</option>
                    <option>Field Data Collection</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Message</label>
                  <textarea className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-theme-500 transition-all outline-none h-32 resize-none" placeholder="How can MapNiti help you?"></textarea>
                </div>

                <button className="w-full bg-theme-700 text-white font-black py-5 rounded-2xl hover:bg-theme-900 transition-all shadow-xl shadow-theme-100 tracking-wide text-lg">
                  Submit Request
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapNitiProjects;