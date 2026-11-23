import React, { useState } from 'react';
import { FolderPlus, Folder, Loader2, ArrowLeft, Trash2 } from 'lucide-react';

export default function ProjectSelector({ projects, loading, error, onSelect, onCreate, onDelete }) {
  const [mode, setMode] = useState('list'); // 'list' | 'create'
  const [projName, setProjName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleCreate = async () => {
    if (!projName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await onCreate(projName.trim());
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Could not create project.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e, projectId) => {
    e.stopPropagation(); // project select नहोस्, delete मात्र होस्
    setDeletingId(projectId);
    try {
      await onDelete(projectId);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (mode === 'create') {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in">
        <div className="p-4 bg-cyan-50 rounded-full text-cyan-600"><FolderPlus size={40} /></div>
        <div className="text-center">
          <h2 className="text-lg font-black text-slate-800 uppercase italic">New Project</h2>
          <p className="text-xs text-slate-500">Create a project folder to auto-save your analysis.</p>
        </div>
        {createError && (
          <div className="w-full p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl">
            {createError}
          </div>
        )}
        <input
          autoFocus
          className="w-full p-4 border-2 border-slate-100 rounded-2xl outline-none focus:border-cyan-500 transition-all text-sm font-bold"
          placeholder="Enter Project Name..."
          value={projName}
          onChange={(e) => setProjName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={creating}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Project'}
        </button>
        <button
          onClick={() => setMode('list')}
          className="text-[11px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Back to project list
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 h-full flex flex-col">
      <div>
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Select a Project</h2>
        <p className="text-[11px] text-slate-400 font-bold">
          Choose an existing project, or start a new one. All analysis you run gets saved here.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl">
          {error}
        </div>
      )}

      <div className="flex-grow overflow-y-auto space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-xs text-slate-400 font-bold text-center py-6">
            No projects yet. Create your first one below.
          </p>
        ) : (
          projects.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-cyan-500 hover:shadow-md transition-all group text-left cursor-pointer"
            >
              <div className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-cyan-50 transition-colors">
                <Folder size={18} className="text-slate-400 group-hover:text-cyan-600" />
              </div>
              <div className="flex-grow">
                <p className="text-[13px] font-bold text-slate-700 group-hover:text-cyan-700">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {p.created_at && (
                    <p className="text-[9px] text-slate-400 font-bold">
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  )}
                  {typeof p.total_analyses === 'number' && (
                    <span className="text-[9px] font-bold text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded">
                      {p.total_analyses} {p.total_analyses === 1 ? 'analysis' : 'analyses'}
                    </span>
                  )}
                </div>
              </div>

              {confirmDeleteId === p.id ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    disabled={deletingId === p.id}
                    className="text-[9px] font-black uppercase bg-red-500 text-white px-2 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50"
                  >
                    {deletingId === p.id ? '...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-1.5 rounded-lg hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); }}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <button
        onClick={() => setMode('create')}
        className="w-full py-4 bg-cyan-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-cyan-700 transition-all flex items-center justify-center gap-2"
      >
        <FolderPlus size={16} /> New Project
      </button>
    </div>
  );
}