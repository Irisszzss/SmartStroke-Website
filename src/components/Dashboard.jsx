import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function Dashboard({ user, onSelectClass, triggerToast }) {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadClasses = async () => {
    if (!user?.userId) return; 
    try {
      setLoading(true);
      const res = await api.getClasses(user.userId, user.role);
      setClasses(res.data);
    } catch (err) {
      console.error("Failed to load classes", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadClasses(); 
  }, [user?.userId, user?.role]);

  const closeModal = () => {
    setModalOpen(false);
    setInputValue('');
  };

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
        closeModal();
        loadClasses();
    } catch (err) {
        triggerToast(err.response?.data?.error || "Action failed", "error");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[85vh] animate-in fade-in duration-700 select-none font-['Poppins'] pb-10 px-4">
      
      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.8);
        }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -10px rgba(0, 27, 183, 0.1);
          border-color: rgba(0, 27, 183, 0.2);
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-[#FF8040] opacity-[0.05] blur-[100px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-[#001BB7] opacity-[0.05] blur-[100px] rounded-full animate-pulse" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-end gap-4 mb-10">
          <div className="animate-in slide-in-from-left-6 duration-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-1 w-8 bg-[#001BB7] rounded-full" />
              <span className="text-[#FF8040] font-black text-[9px] uppercase tracking-[0.4em]">Workspace</span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none">
              {user.role === 'teacher' ? 'Teaching' : 'Learning'}<span className="text-[#001BB7]">.</span>
            </h2>
          </div>
          <button 
            onClick={() => setModalOpen(true)}
            className="group relative flex items-center gap-3 bg-slate-900 hover:bg-[#001BB7] text-white px-7 py-3.5 rounded-2xl font-black transition-all active:scale-95 text-[10px] tracking-widest uppercase shadow-xl overflow-hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            <span className="relative z-10">{user.role === 'teacher' ? 'New Class' : 'Join Class'}</span>
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1,2,3,4].map(i => <div key={i} className="h-48 bg-white/40 border border-slate-100 animate-pulse rounded-[32px]" />)}
          </div>
        ) : classes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {classes.map((cls) => (
              <div 
                key={cls._id} 
                onClick={() => onSelectClass(cls)}
                className="card-hover glass-card group p-6 rounded-[32px] cursor-pointer transition-all duration-300 relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-8">
                    <div className="bg-slate-900 p-3 rounded-xl text-white group-hover:bg-[#001BB7] transition-colors shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Notes</p>
                      <p className="text-lg font-black text-slate-800">{cls.files?.length || 0}</p>
                    </div>
                  </div>
                  <h3 className="font-black text-xl text-slate-800 mb-2 tracking-tight line-clamp-1">{cls.name}</h3>
                  <div className="inline-flex items-center gap-1.5 bg-white/50 px-3 py-1 rounded-xl border border-slate-100">
                    <span className="text-[8px] font-black text-[#FF8040] uppercase tracking-widest">Key</span>
                    <span className="text-xs font-mono font-bold text-slate-500">{cls.code}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 glass-card rounded-[40px] flex flex-col items-center animate-in zoom-in-95 max-w-2xl mx-auto">
             <div className="bg-white w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-200"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
             </div>
             <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Empty Workspace</p>
             <button onClick={() => setModalOpen(true)} className="mt-4 text-[#001BB7] font-black hover:text-[#FF8040] transition-colors uppercase text-[10px] tracking-widest underline underline-offset-4">
                {user?.role === 'teacher' ? 'Create Class' : 'Join Class'}
             </button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[32px] w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#001BB7] to-[#FF8040]" />
            
            <button 
              onClick={closeModal} 
              className="absolute right-6 top-6 text-slate-300 hover:text-slate-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {user.role === 'teacher' ? 'New Class' : 'Enter Key'}
              </h3>
              <p className="text-slate-500 text-xs mt-1">
                {user.role === 'teacher' ? 'Name your digital workspace.' : 'Enter the code to join.'}
              </p>
            </div>
            
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  {user.role === 'teacher' ? 'Classroom Name' : 'Access Key'}
                </label>
                <input 
                  autoFocus
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-[#001BB7]/30 focus:bg-white transition-all font-bold text-slate-900 placeholder:text-slate-200 text-base"
                  placeholder={user.role === 'teacher' ? 'History 101' : 'PCUF8D'}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAction()}
                />
              </div>

              <button 
                onClick={handleAction} 
                disabled={isSubmitting || !inputValue.trim()}
                className="w-full py-3.5 bg-[#001BB7] text-white rounded-xl font-black shadow-lg shadow-blue-900/10 hover:bg-black transition-all uppercase text-[10px] tracking-widest active:scale-[0.98] disabled:opacity-30 flex items-center justify-center group"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>{user.role === 'teacher' ? 'Create' : 'Join'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}