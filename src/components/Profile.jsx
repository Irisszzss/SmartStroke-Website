import React, { useState, useRef, useEffect, useCallback } from 'react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export default function Profile({ user, onUpdateUser, onBack, triggerToast }) {
  const fileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);

  // --- NAME INTEGRITY FIX START ---
  const getInitialNames = useCallback(() => {
    let fName = user?.firstName || '';
    let sName = user?.surname || '';
    if (!fName && user?.name) {
      const parts = user.name.trim().split(/\s+/);
      fName = parts[0];
      sName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    }
    return { fName, sName };
  }, [user]);

  const { fName, sName } = getInitialNames();
  // --- NAME INTEGRITY FIX END ---

  const [formData, setFormData] = useState({
    firstName: fName,
    middleInitial: user?.middleInitial || '',
    surname: sName,
    username: user?.username || '',
    email: user?.email || '',
    firstName: fName,
    middleInitial: user?.middleInitial || '',
    surname: sName,
    username: user?.username || '',
    email: user?.email || '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://smartstroke-api.onrender.com';

  useEffect(() => {
    const { fName: updatedFName, sName: updatedSName } = getInitialNames();
    setFormData(prev => ({
      ...prev,
      firstName: updatedFName,
      surname: updatedSName,
      username: user?.username || '',
      email: user?.email || '',
      middleInitial: user?.middleInitial || ''
    }));
  }, [user, getInitialNames]);

  const handleAvatarClick = () => {
    if (!isEditing) return;
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      return triggerToast("Image must be less than 2MB", "error");
    }
    setUploading(true);
    try {
      const res = await api.uploadAvatar(user.userId || user._id, file);
      const res = await api.uploadAvatar(user.userId || user._id, file);
      if (res.data.success) {
        triggerToast("Profile picture updated", "success");
        onUpdateUser({ profilePicture: res.data.profilePicture });
      }
    } catch (err) {
      triggerToast("Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    try {
      const res = await api.deleteAvatar(user.userId || user._id);
      const res = await api.deleteAvatar(user.userId || user._id);
      if (res.data.success) {
        triggerToast("Avatar removed", "info");
        onUpdateUser({ profilePicture: "" });
        setShowDeleteModal(false);
      }
    } catch (err) {
      triggerToast("Delete failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.surname || !formData.username || !formData.email) {
      return triggerToast("Required fields are missing", "error");
    }
    if (formData.password && formData.password !== formData.confirmPassword) {
      return triggerToast("Passwords do not match", "error");
    }

    setLoading(true);
    try {
      const res = await api.updateProfile(user.userId || user._id, formData);
      const res = await api.updateProfile(user.userId || user._id, formData);
      if (res.data.success) {
        triggerToast("Profile updated successfully", "success");
        onUpdateUser(res.data);
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        setIsEditing(false); 
      }
    } catch (err) {
      triggerToast(err.response?.data?.error || "Update failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const avatarUrl = user?.profilePicture
    ? (user.profilePicture.startsWith('http') 
        ? user.profilePicture 
        : `${API_BASE_URL}/${user.profilePicture}`)
  const avatarUrl = user?.profilePicture
    ? (user.profilePicture.startsWith('http') 
        ? user.profilePicture 
        : `${API_BASE_URL}/${user.profilePicture}`)
    : null;

  return (
    <div className="relative min-h-[80vh] animate-in fade-in duration-700 flex flex-col items-center pb-12 font-['Poppins']">
      
      {/* Background Brand Identity */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-[#FF8040] opacity-[0.08] blur-[100px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#001BB7] opacity-[0.08] blur-[100px] rounded-full animate-pulse" />
      </div>

      {/* Navigation */}
      <div className="w-full max-w-3xl flex justify-start mb-8 z-10 px-4 md:px-0">
        <button onClick={onBack} className="group flex items-center gap-3 text-[#001BB7] font-black uppercase text-[10px] tracking-widest outline-none">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 group-hover:-translate-x-1 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </div>
          Dashboard
        </button>
      </div>

      <div className="w-full max-w-3xl bg-white p-8 md:p-12 rounded-[48px] shadow-2xl border border-slate-50 z-10 overflow-hidden relative">
        <div className="flex items-center gap-8 mb-12 border-b border-slate-100 pb-12">
          <div className="relative">
            <div className={`relative ${isEditing ? 'cursor-pointer' : 'cursor-default'}`} onClick={handleAvatarClick}>
              <div className={`w-28 h-28 rounded-[38px] bg-[#001BB7] flex items-center justify-center text-white text-5xl font-black uppercase shadow-2xl overflow-hidden transition-all duration-500 ${isEditing ? 'ring-8 ring-[#001BB7]/10 scale-105' : ''}`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (formData.firstName?.charAt(0) || formData.username?.charAt(0) || 'U').toUpperCase()
                  (formData.firstName?.charAt(0) || formData.username?.charAt(0) || 'U').toUpperCase()
                )}

                {isEditing && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center transition-opacity">
                    {uploading ? (
                      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <div className="flex flex-col items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {user?.profilePicture && isEditing && (
            {user?.profilePicture && isEditing && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
                className="absolute -top-2 -right-2 bg-white p-2.5 rounded-2xl text-red-500 shadow-xl border border-red-50 hover:bg-red-50 transition-all z-20 hover:scale-110 active:scale-90"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /></svg>
              </button>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">
              {isEditing ? "Account Settings" : (formData.firstName + " " + formData.surname)}
            </h2>
            <div className="flex items-center gap-3 mt-2">
                <span className="bg-orange-50 text-[#FF8040] px-3 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-orange-100">{user?.role}</span>
                <span className="text-slate-300 font-bold text-[10px] uppercase tracking-[0.2em]">Verified Identity</span>
            </div>
          </div>
        </div>

        {!isEditing ? (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Display Name</p>
                <p className="text-slate-800 font-black text-lg uppercase tracking-tight">{formData.firstName} {user?.middleInitial ? user.middleInitial + '. ' : ''}{formData.surname}</p>
              </div>
              <div className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Workspace Username</p>
                <p className="text-[#001BB7] font-black text-lg">@{formData.username || 'user'}</p>
              </div>
              <div className="bg-slate-50/50 p-8 rounded-[32px] border border-slate-50 md:col-span-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Registered Email</p>
                <p className="text-slate-800 font-bold">{formData.email || 'N/A'}</p>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="w-full bg-[#001BB7] text-white py-6 rounded-3xl font-black shadow-[0_15px_30px_rgba(0,27,183,0.3)] hover:bg-[#0046FF] transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-widest group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="group-hover:rotate-12 transition-transform"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              Edit Profile
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
            {/* Identity Group */}
            <div className="space-y-4">
                <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-5">
                        <label className="text-[10px] font-black text-[#001BB7] uppercase tracking-widest ml-1 mb-1 block">First Name</label>
                        <input className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                    </div>
                    <div className="col-span-12 md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-1 block">M.I.</label>
                        <input maxLength="2" className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm text-center uppercase" value={formData.middleInitial} onChange={e => setFormData({ ...formData, middleInitial: e.target.value })} />
                    </div>
                    <div className="col-span-12 md:col-span-5">
                        <label className="text-[10px] font-black text-[#001BB7] uppercase tracking-widest ml-1 mb-1 block">Surname</label>
                        <input className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm" value={formData.surname} onChange={e => setFormData({ ...formData, surname: e.target.value })} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-[#001BB7] uppercase tracking-widest ml-1 mb-1 block">Username</label>
                        <input className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm" value={formData.username} maxLength={20} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-[#001BB7] uppercase tracking-widest ml-1 mb-1 block">Email</label>
                        <input type="email" className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                </div>
            </div>

            {/* Password Section with Eye Icons */}
            <div className="bg-[#FDFCF5] p-6 rounded-[32px] border border-[#001BB7]/5 space-y-4">
                <p className="text-[10px] font-black text-[#FF8040] uppercase tracking-[0.4em] mb-4">Security Update (Optional)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">New Password</label>
                        <input 
                            type={showPassword ? "text" : "password"} 
                            className="w-full bg-white border-2 border-slate-100 p-4 pr-12 rounded-2xl outline-none focus:border-[#001BB7] transition-all font-bold text-slate-800"
                            placeholder="Enter new password"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-10 text-slate-300 hover:text-[#001BB7] transition-colors">
                            {showPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                        </button>
                    </div>
                    <div className="relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Confirm Password</label>
                        <input 
                            type={showPassword ? "text" : "password"} 
                            className={`w-full border-2 p-4 pr-12 rounded-2xl outline-none transition-all font-bold text-slate-800 ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100 focus:border-[#001BB7]'}`}
                            placeholder="Re-enter password"
                            value={formData.confirmPassword}
                            onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-10 text-slate-300 hover:text-[#001BB7] transition-colors">
                            {showPassword ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-5 font-black text-slate-400 hover:text-slate-600 transition-all uppercase text-[10px] tracking-widest">Cancel</button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-[#001BB7] text-white py-5 rounded-2xl font-black shadow-xl hover:bg-[#0046FF] transition-all flex items-center justify-center gap-3 uppercase text-[10px] tracking-widest active:scale-95 disabled:opacity-50"
              >
                {loading ? <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : "Update Profile"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Delete Modal */}
      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => !uploading && setShowDeleteModal(false)} />
          <div className="relative bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-sm text-center border border-white animate-in zoom-in-95">
             <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500">
               <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /></svg>
             </div>
             <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tighter">Remove Avatar?</h3>
             <p className="text-slate-500 text-sm mb-10 leading-relaxed font-bold">This will clear your customized profile picture from the trace.</p>
             <div className="flex flex-col gap-3">
               <button onClick={handleRemoveAvatar} className="w-full bg-red-500 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-red-600 transition-all uppercase text-[10px] tracking-widest">Confirm Delete</button>
               <button onClick={() => setShowDeleteModal(false)} className="w-full bg-slate-50 py-5 rounded-2xl font-black text-slate-400 uppercase text-[10px] tracking-widest">Discard</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
