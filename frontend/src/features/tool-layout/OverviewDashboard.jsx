import React, { useState, useEffect } from 'react';
import { FolderOpen, Droplets, Sprout, Building2, Zap, Database, Loader2, TrendingUp } from 'lucide-react';
import { getProjectsOverview } from '../../api/projectApi';
import { getCurrentUser } from '../../api/authApi';

const MODULE_ICONS = {
  hydrology: { icon: Droplets, color: 'text-cyan-600', bg: 'bg-cyan-50', label: 'Hydrology' },
  agriculture: { icon: Sprout, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Agriculture' },
  urban: { icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Urban Planning' },
  disaster: { icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50', label: 'Disaster Risk' },
  'data-management': { icon: Database, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Data Management' },
};

export default function OverviewDashboard({ onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getCurrentUser();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getProjectsOverview();
        setProjects(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not load your projects.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalProjects = projects.length;
  const totalAnalyses = projects.reduce((sum, p) => sum + p.total_analyses, 0);

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black text-slate-800">
            Welcome back{user?.full_name ? `, ${user.full_name}` : ''}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Here's a summary of your GIS analysis work.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600"><FolderOpen size={24} /></div>
            <div>
              <p className="text-2xl font-black text-slate-800">{totalProjects}</p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Projects</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600"><TrendingUp size={24} /></div>
            <div>
              <p className="text-2xl font-black text-slate-800">{totalAnalyses}</p>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Analyses Run</p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-3">Your Projects</h2>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl mb-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
              <p className="text-sm text-slate-400 font-bold">
                No projects yet. All tools work without one — click "Choose project" in any tool panel to create a project and save your results.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onOpenProject && onOpenProject(p)}
                  className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-black text-slate-800">{p.name}</p>
                      {p.created_at && (
                        <p className="text-[10px] text-slate-400 font-bold">
                          Created {new Date(p.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">
                      {p.total_analyses} {p.total_analyses === 1 ? 'analysis' : 'analyses'}
                    </span>
                  </div>

                  {Object.keys(p.module_counts).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(p.module_counts).map(([module, count]) => {
                        const meta = MODULE_ICONS[module] || { icon: FolderOpen, color: 'text-slate-500', bg: 'bg-slate-50', label: module };
                        const Icon = meta.icon;
                        return (
                          <span
                            key={module}
                            className={`flex items-center gap-1.5 text-[10px] font-bold ${meta.color} ${meta.bg} px-2.5 py-1 rounded-lg`}
                          >
                            <Icon size={11} /> {meta.label}: {count}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No analysis run yet.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}