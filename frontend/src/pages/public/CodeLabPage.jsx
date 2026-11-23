import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Code2 } from 'lucide-react';
import CodeLab from '../../features/learn/CodeLab';

// Public Code Lab. A snippet sent from a lesson or the AI assistant arrives
// through localStorage ("Try it" → /code-lab).
function takeSeed() {
  try {
    const raw = localStorage.getItem('mapniti_codelab_seed');
    if (!raw) return null;
    localStorage.removeItem('mapniti_codelab_seed');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function CodeLabPage() {
  const [seed] = useState(takeSeed);
  return (
    <div className="bg-slate-50 min-h-screen">
      <section className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-300 flex items-center gap-2"><Code2 size={15} /> Code Lab</p>
          <h1 className="text-3xl md:text-4xl font-black mt-2">Write and run GIS code in your browser</h1>
          <p className="text-slate-300 mt-2 max-w-3xl text-sm">
            HTML & web maps (Leaflet, MapLibre), Python (numpy, pandas, shapely, pyproj, matplotlib, scikit-learn), JavaScript with Turf.js, and SQL.
            Nothing is installed and nothing runs on our server — it's safe to experiment. Lessons in <Link to="/learn" className="underline text-emerald-300">Learn GIS</Link> send their examples here.
          </p>
        </div>
      </section>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <CodeLab seed={seed} />
      </div>
    </div>
  );
}
