import React, { useEffect, useState } from 'react';
import { Users, FolderOpen, TrendingUp, Share2, Loader2, ShieldCheck } from 'lucide-react';
import { listAllUsers, getAdminStats } from '../../api/adminApi';
import AdminPayments from '../billing/AdminPayments';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [userList, statData] = await Promise.all([listAllUsers(), getAdminStats()]);
        setUsers(userList);
        setStats(statData);
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not load admin data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statCards = stats ? [
    { icon: Users, label: 'Total Users', value: stats.total_users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { icon: FolderOpen, label: 'Total Projects', value: stats.total_projects, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: TrendingUp, label: 'Total Analyses Run', value: stats.total_analyses, color: 'text-purple-600', bg: 'bg-purple-50' },
    { icon: Share2, label: 'Shared Projects', value: stats.total_shared_projects, color: 'text-orange-600', bg: 'bg-orange-50' },
  ] : [];

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-brand-600" size={24} />
          <div>
            <h1 className="text-2xl font-black text-slate-800">Admin Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Users, platform activity and payments.</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
                  <div className={`p-3 rounded-xl ${s.bg} ${s.color}`}><s.icon size={22} /></div>
                  <div>
                    <p className="text-2xl font-black text-slate-800">{s.value}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <AdminPayments />

            <div>
              <h2 className="text-sm font-black text-slate-700 uppercase tracking-wide mb-3">All Users</h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wide">Name</th>
                      <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wide">Email</th>
                      <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wide">Country</th>
                      <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wide">Projects</th>
                      <th className="px-5 py-3 text-[10px] font-black uppercase text-slate-400 tracking-wide">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-700">
                          {u.full_name}
                          {u.is_admin && (
                            <span className="ml-2 text-[9px] font-black uppercase bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">Admin</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-500">{u.email}</td>
                        <td className="px-5 py-3 text-slate-500">{u.country || '—'}</td>
                        <td className="px-5 py-3 text-slate-500">{u.project_count}</td>
                        <td className="px-5 py-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
