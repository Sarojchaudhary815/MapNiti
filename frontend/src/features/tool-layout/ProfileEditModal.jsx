import React, { useRef, useState } from 'react';
import { X, Camera, Loader2, AlertCircle, CheckCircle2, Briefcase, GraduationCap } from 'lucide-react';
import { updateProfile, uploadAvatar } from '../../api/authApi';
import { COUNTRIES } from '../../constants/countries';

import { API_ORIGIN } from '../../config';
export { API_ORIGIN };

export const avatarUrl = (user) => (user?.avatar_url ? `${API_ORIGIN}${user.avatar_url}` : null);

export default function ProfileEditModal({ user, onClose, onUpdated }) {
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [country, setCountry] = useState(user?.country || 'Nepal');
  const [occupation, setOccupation] = useState(user?.occupation || 'employed');
  const [organization, setOrganization] = useState(user?.organization || '');
  const [roleTitle, setRoleTitle] = useState(user?.role_title || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [localUser, setLocalUser] = useState(user);
  const fileInputRef = useRef(null);

  const handleAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const updated = await uploadAvatar(file);
      setLocalUser(updated);
      onUpdated?.(updated);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not upload photo.');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      const updated = await updateProfile({
        full_name: fullName,
        country,
        occupation,
        organization,
        role_title: roleTitle,
      });
      setLocalUser(updated);
      onUpdated?.(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all";

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Edit Profile</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-brand-600 flex items-center justify-center overflow-hidden shadow-lg">
                {avatarUrl(localUser) ? (
                  <img src={avatarUrl(localUser)} alt={localUser?.full_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-white text-2xl font-black">
                    {(localUser?.full_name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md hover:bg-black transition-colors"
                title="Change photo"
              >
                {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">{localUser?.full_name}</p>
              <p className="text-xs text-slate-400">{localUser?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Full Name</label>
              <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Country</label>
              <select className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Occupation</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOccupation('employed')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-all ${
                    occupation === 'employed' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <Briefcase size={14} /> Employed
                </button>
                <button
                  type="button"
                  onClick={() => setOccupation('student')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border font-semibold text-sm transition-all ${
                    occupation === 'student' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-slate-500'
                  }`}
                >
                  <GraduationCap size={14} /> Student
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  {occupation === 'student' ? 'Faculty' : 'Designation'}
                </label>
                <input className={inputClass} value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  {occupation === 'student' ? 'College' : 'Company'}
                </label>
                <input className={inputClass} value={organization} onChange={(e) => setOrganization(e.target.value)} />
              </div>
            </div>

            <button
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3.5 rounded-xl font-bold hover:bg-brand-700 transition-all disabled:opacity-50"
            >
              {saving && <Loader2 size={18} className="animate-spin" />}
              {success && <CheckCircle2 size={18} />}
              {saving ? 'Saving...' : success ? 'Saved' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
