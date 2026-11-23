import React, { useEffect, useState } from 'react';
import { X, UserPlus, Trash2, Loader2, AlertCircle, Users } from 'lucide-react';
import { listCollaborators, addCollaborator, removeCollaborator } from '../../api/collaboratorApi';

export default function ShareProjectModal({ projectId, projectName, onClose }) {
  const [collaborators, setCollaborators] = useState([]);
  const [isOwner, setIsOwner] = useState(true);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listCollaborators(projectId);
      setCollaborators(data.collaborators || []);
      setIsOwner(data.is_owner);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not load collaborators.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError('');
    try {
      await addCollaborator(projectId, email.trim(), role);
      setEmail('');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not add that person.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (collaboratorId) => {
    try {
      await removeCollaborator(projectId, collaboratorId);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not remove collaborator.');
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Share Project</h2>
            <p className="text-xs text-slate-400 font-bold">{projectName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {isOwner && (
            <form onSubmit={handleAdd} className="space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                Invite by email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="someone@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
              <button
                disabled={adding}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-700 transition-all disabled:opacity-50"
              >
                {adding ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                {adding ? 'Adding...' : 'Add Collaborator'}
              </button>
            </form>
          )}

          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              <Users size={14} /> People with access
            </label>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-400" size={20} /></div>
            ) : collaborators.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium py-3 text-center">Not shared with anyone yet.</p>
            ) : (
              <div className="space-y-2">
                {collaborators.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{c.full_name || c.email}</p>
                      <p className="text-[11px] text-slate-400 truncate">{c.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-500">
                        {c.role}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => handleRemove(c.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove access"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
