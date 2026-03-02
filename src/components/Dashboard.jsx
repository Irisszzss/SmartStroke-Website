import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Dashboard({ user, onSelectClass, triggerToast }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);



  const loadClasses = async () => {
    try {
      setLoading(true);
      console.log("Fetching classes for role:", user.role); // Check this in the browser console
      const res = await api.getClasses(user.userId, user.role);
      setClasses(res.data);
    } catch (err) {
      console.error("Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClasses(); }, []);

  const handleAction = async () => {
    if (!inputValue.trim()) return;
    setIsSubmitting(true);
    try {
        if (user.role === 'teacher') {
          await api.createClass(inputValue, user.userId);
          triggerToast("Classroom created successfully", "success");
        } else {
          await api.joinClass(user.userId, inputValue);
          triggerToast("Joined classroom successfully", "success");
        }
        setInputValue('');
        setModalOpen(false);
        loadClasses();
    } catch (err) {
        triggerToast(err.response?.data?.error || "Action failed", "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[80vh] animate-in fade-in duration-700 select-none">
      
      {/* Background Energy Drifts - Matching the Auth Vibe */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#FF8040] opacity-10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#001BB7] opacity-10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">
              {user.role === 'teacher' ? 'Teaching Hub' : 'My Learning'}
            </h2>
            <p className="text-slate-400 font-medium mt-1">Manage your classrooms and digitized sessions.</p>
          </div>
          <button 
            onClick={() => setModalOpen(true)}
            className="group flex items-center gap-3 bg-[#FF8040] hover:bg-[#e66a2e] text-white px-8 py-4 rounded-[20px] font-black shadow-xl shadow-orange-100 transition-all hover:-translate-y-1 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            {user.role === 'teacher' ? 'CREATE' : 'JOIN'}
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-40">
              {[1,2,3].map(i => <div key={i} className="h-48 bg-white border border-slate-100 animate-pulse rounded-[32px]" />)}
          </div>
        ) : classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <div 
                key={cls._id} 
                onClick={() => onSelectClass(cls)}
                className="group bg-white/70 backdrop-blur-sm p-8 rounded-[32px] shadow-sm border border-slate-100 cursor-pointer hover:border-[#001BB7] hover:shadow-2xl hover:shadow-blue-900/5 transition-all duration-300"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="bg-blue-50 p-4 rounded-2xl text-[#001BB7] group-hover:bg-[#001BB7] group-hover:text-white transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1 text-right">Documents</span>
                    <span className="text-sm font-black text-slate-400">
                      {cls.files?.length || 0}
                    </span>
                  </div>
                </div>
                
                <h3 className="font-black text-2xl text-slate-800 mb-1 group-hover:text-[#001BB7] transition-colors">{cls.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">Access Code</span>
                  <span className="text-xs font-mono font-bold text-[#FF8040] bg-orange-50 px-2 py-0.5 rounded-lg">{cls.code}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/40 backdrop-blur-sm rounded-[40px] border-4 border-dashed border-slate-100">
             <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
             </div>
             <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No active classrooms</p>
             <p className="text-slate-300 text-sm mt-2 font-medium italic underline underline-offset-4 decoration-slate-100 cursor-pointer hover:text-[#001BB7] transition-colors" 
                onClick={() => setModalOpen(true)}
                >
                {user?.role === 'teacher' ? 'Create your first session' : 'Join your first class'}
            </p>
          </div>
        )}
      </div>

      {/* Modern Modal - No Emojis */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
            <div className="bg-white p-10 rounded-[48px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-500 border border-white">
              <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-[#001BB7]">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
              </div>
              
              <h3 className="text-3xl font-black mb-2 text-slate-900 tracking-tight">
                {user.role === 'teacher' ? 'Class Details' : 'Join Session'}
              </h3>
              <p className="text-slate-400 text-sm mb-8 font-medium">
                {user.role === 'teacher' ? 'Create a new digital workspace for your students.' : 'Enter the classroom code shared by your teacher.'}
              </p>
              
              <div className="relative mb-8">
                  <input 
                    autoFocus
                    className="w-full bg-slate-50 border-2 border-transparent p-5 rounded-3xl outline-none focus:border-[#001BB7] focus:bg-white transition-all font-bold text-slate-800 placeholder:text-slate-300"
                    placeholder={user.role === 'teacher' ? 'e.g. Algebra' : 'Enter Class Code'}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setModalOpen(false)} 
                  className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors uppercase text-xs tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAction} 
                  disabled={isSubmitting}
                  /* ✅ Added flex items-center justify-center here */
                  className="flex-1 py-4 bg-[#001BB7] text-white rounded-[20px] font-black hover:bg-[#0046FF] shadow-xl shadow-blue-100 transition-all uppercase text-xs tracking-[0.2em] active:scale-95 disabled:opacity-50 flex items-center justify-center min-h-[56px]"
                >
                  {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                      user.role === 'teacher' ? 'Create' : 'Join'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}