import React, { useState, useRef } from 'react';
import { api } from '../utils/api';

export default function Profile({ user, onUpdateUser, onBack, triggerToast }) {
  const fileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false); 
  const [formData, setFormData] = useState({
    firstName: user.firstName || '',
    middleInitial: user.middleInitial || '',
    surname: user.surname || '',
    username: user.username || '',
    email: user.email || '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleAvatarClick = () => {
    if (!isEditing) return; // ✅ Only clickable in Edit Mode
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
      const res = await api.uploadAvatar(user.userId, file);
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
      const res = await api.deleteAvatar(user.userId);
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
      const res = await api.updateProfile(user.userId, formData);
      if (res.data.success) {
        triggerToast("Profile updated successfully", "success");
        onUpdateUser(res.data);
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
        setIsEditing(false); 
        onBack();
      }
    } catch (err) {
      triggerToast(err.response?.data?.error || "Update failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const avatarUrl = user.profilePicture
    ? `https://smartstroke-api.onrender.com/${user.profilePicture}`
    : null;

  return (
    <div className="relative min-h-[80vh] animate-in fade-in duration-700 flex flex-col items-center pb-12">
      
      <style>{`
        @keyframes slow-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        .animate-pulse-slow { animation: slow-pulse 3s infinite ease-in-out; }
      `}</style>

      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#FF8040] opacity-10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#001BB7] opacity-10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-3xl flex justify-start mb-8 z-10">
        <button onClick={onBack} className="group flex items-center gap-2 text-[#001BB7] font-black uppercase text-[10px] tracking-widest">
          <div className="bg-white p-2 rounded-full shadow-sm border border-slate-100 group-hover:-translate-x-1 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </div>
          Return to Dashboard
        </button>
      </div>

      <div className="w-full max-w-3xl bg-white/70 backdrop-blur-xl p-10 rounded-[48px] shadow-2xl border border-white z-10 overflow-hidden">
        <div className="flex items-center gap-6 mb-10 border-b border-slate-100 pb-10">

          <div className="relative group">
            {/* ✅ Interactive Avatar Container */}
            <div className={`relative ${isEditing ? 'cursor-pointer' : 'cursor-default'}`} onClick={handleAvatarClick}>
              <div className={`w-24 h-24 rounded-[32px] bg-[#001BB7] flex items-center justify-center text-white text-4xl font-black uppercase shadow-xl overflow-hidden transition-all duration-500 ${isEditing ? 'ring-4 ring-[#001BB7]/20 scale-105 shadow-blue-200' : ''}`}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user.firstName?.charAt(0) || user.username?.charAt(0)
                )}

                {/* ✅ Camera Icon Overlay - Visible only in Edit Mode */}
                {isEditing && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-100 transition-opacity">
                    {uploading ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <div className="animate-pulse-slow flex flex-col items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        <span className="text-[8px] font-black text-white mt-1 uppercase tracking-tighter">Change</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ✅ REMOVE AVATAR BUTTON (Always shows if image exists, regardless of mode) */}
            {user.profilePicture && isEditing && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true); }}
                className="absolute -top-2 -right-2 bg-white p-2 rounded-xl text-red-500 shadow-lg border border-red-50 hover:bg-red-50 transition-all z-20 hover:scale-110"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
              </button>
            )}

            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
          </div>

          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {isEditing ? "Modify Profile" : user.firstName + " " + user.surname}
            </h2>
            <p className="text-[#FF8040] font-black text-[10px] uppercase tracking-[0.3em] mt-1">
              {user.role} Account Access
            </p>
          </div>
        </div>

        {!isEditing ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 transition-colors hover:bg-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Full Name</p>
                <p className="text-slate-800 font-bold">{user.firstName} {user.middleInitial ? user.middleInitial + '. ' : ''}{user.surname}</p>
              </div>
              <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 transition-colors hover:bg-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Username</p>
                <p className="text-slate-800 font-bold">@{user.username}</p>
              </div>
              <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 md:col-span-2 transition-colors hover:bg-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                <p className="text-slate-800 font-bold">{user.email}</p>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className="w-full bg-[#001BB7] text-white py-6 rounded-[28px] font-black shadow-xl shadow-blue-100 hover:bg-[#0046FF] transition-all flex items-center justify-center gap-3 uppercase text-[10px] tracking-[0.3em] group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:rotate-12 transition-transform"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              Edit Profile Info
            </button>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-5 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                <input
                  className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="col-span-12 md:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">M.I.</label>
                <input
                  maxLength="1"
                  className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm text-center uppercase"
                  value={formData.middleInitial}
                  onChange={e => setFormData({ ...formData, middleInitial: e.target.value })}
                />
              </div>
              <div className="col-span-12 md:col-span-5 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Surname</label>
                <input
                  className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm"
                  value={formData.surname}
                  onChange={e => setFormData({ ...formData, surname: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Username</label>
                  <span className={`text-[9px] font-bold ${formData.username.length > 15 ? 'text-red-400' : 'text-slate-300'}`}>{formData.username.length}/20</span>
                </div>
                <input
                  className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm"
                  value={formData.username}
                  maxLength={20}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <input
                  type="email"
                  className="w-full bg-slate-50 border-2 border-transparent p-4 rounded-2xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 shadow-sm"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50 mt-4">
              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-[#FF8040] uppercase tracking-widest ml-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="w-full bg-orange-50/30 border-2 border-transparent p-4 pr-12 rounded-2xl outline-none focus:border-[#FF8040] focus:bg-white transition-all font-bold text-slate-800 placeholder:text-orange-200 shadow-sm"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FF8040] transition-colors"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`w-full border-2 p-4 rounded-2xl outline-none transition-all font-bold text-slate-800 shadow-sm ${formData.confirmPassword && formData.password !== formData.confirmPassword
                      ? 'bg-red-50 border-red-200'
                      : 'bg-orange-50/30 border-transparent focus:border-[#FF8040] focus:bg-white'
                    }`}
                  value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-6 rounded-[28px] font-black text-slate-400 hover:text-slate-600 transition-all uppercase text-[10px] tracking-[0.3em]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] bg-[#001BB7] text-white py-6 rounded-[28px] font-black shadow-xl shadow-blue-100 hover:bg-[#0046FF] transition-all flex items-center justify-center gap-3 uppercase text-[10px] tracking-[0.3em] active:scale-95 disabled:opacity-50"
              >
                {loading ? <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !uploading && setShowDeleteModal(false)} />
          <div className="relative bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-sm text-center border border-white animate-in zoom-in-95">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Remove Photo?</h3>
            <p className="text-slate-500 text-sm mb-10 leading-relaxed">This will permanently delete your custom profile picture and revert to your initials.</p>
            <div className="flex flex-col gap-3">
              <button
                disabled={uploading}
                onClick={handleRemoveAvatar}
                className="w-full bg-red-500 text-white py-5 rounded-[24px] font-black shadow-xl hover:bg-red-600 uppercase text-xs tracking-widest transition-all"
              >
                {uploading ? "Removing..." : "Delete Photo"}
              </button>
              <button
                disabled={uploading}
                onClick={() => setShowDeleteModal(false)}
                className="w-full bg-slate-50 text-slate-400 py-5 rounded-[24px] font-black hover:bg-slate-100 uppercase text-xs tracking-widest transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}