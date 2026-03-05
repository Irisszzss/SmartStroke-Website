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
    <div className="relative min-h-[85vh] animate-in fade-in duration-700 select-none font-['Poppins'] pb-10">
      
      <style>{`
        .glass-modal {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .card-hover:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 30px 60px -15px rgba(0, 27, 183, 0.15);
        }
      `}</style>

      {/* Branded Energy Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#FF8040] opacity-[0.07] blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-[#001BB7] opacity-[0.07] blur-[120px] rounded-full animate-pulse" />
      </div>

      <div className="relative z-10 px-4 max-w-7xl mx-auto">
        {/* Modern Header */}
        <div className="flex flex-col sm:flex-row justify-between items-end gap-6 mb-16">
          <div className="animate-in slide-in-from-left-8 duration-1000">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-1.5 w-12 bg-[#001BB7] rounded-full" />
              <span className="text-[#FF8040] font-black text-[11px] uppercase tracking-[0.5em]">Workspace</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">
              {user.role === 'teacher' ? 'Teaching' : 'Learning'}<span className="text-[#001BB7]">.</span>
            </h2>
          </div>
          <button 
            onClick={() => setModalOpen(true)}
            className="group relative flex items-center gap-4 bg-slate-900 hover:bg-[#001BB7] text-white px-10 py-5 rounded-[24px] font-black transition-all hover:scale-105 active:scale-95 text-xs tracking-widest uppercase shadow-2xl overflow-hidden"
          >
            <div className="absolute inset-0 bg-[#FF8040] translate-y-full group-hover:translate-y-0 transition-transform duration-500 opacity-20" />
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            <span className="relative z-10">{user.role === 'teacher' ? 'New Class' : 'Enter Code'}</span>
          </button>
        </div>

        {/* Classes Display */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {[1,2,3].map(i => <div key={i} className="h-72 bg-white/40 border border-slate-100 animate-pulse rounded-[48px]" />)}
          </div>
        ) : classes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {classes.map((cls) => (
              <div 
                key={cls._id} 
                onClick={() => onSelectClass(cls)}
                className="card-hover group bg-white/80 p-10 rounded-[48px] shadow-[0_20px_40px_rgba(0,0,0,0.02)] border border-slate-100 cursor-pointer transition-all duration-500 overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#001BB7]/10 to-transparent rounded-full -translate-y-16 translate-x-16 blur-xl" />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-12">
                    <div className="bg-slate-900 p-5 rounded-[28px] text-white group-hover:bg-[#001BB7] transition-all duration-500 shadow-xl">
                      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Digitized Notes</p>
                      <p className="text-2xl font-black text-slate-800 group-hover:text-[#001BB7] transition-colors">{cls.files?.length || 0}</p>
                    </div>
                  </div>
                  <h3 className="font-black text-3xl text-slate-800 mb-3 tracking-tight transition-colors group-hover:text-[#001BB7]">{cls.name}</h3>
                  <div className="inline-flex items-center gap-2 bg-[#FDFCF5] px-4 py-2 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-[#FF8040] uppercase tracking-widest">Key</span>
                    <span className="text-sm font-mono font-bold text-slate-500 tracking-tighter">{cls.code}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/40 backdrop-blur-sm rounded-[60px] border border-slate-100 flex flex-col items-center animate-in zoom-in-95">
             <div className="bg-white w-28 h-28 rounded-[40px] flex items-center justify-center mb-8 shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-200"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
             </div>
             <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[11px]">No traces found in your system</p>
             <button onClick={() => setModalOpen(true)} className="mt-6 text-[#001BB7] font-black hover:text-[#FF8040] transition-colors uppercase text-xs tracking-widest underline underline-offset-8 decoration-[#001BB7]/20">
                {user?.role === 'teacher' ? 'Initialize First Classroom' : 'Connect to a Session'}
             </button>
          </div>
        )}
      </div>

      {/* RE-ENHANCED MODAL: Clean Glass Design */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-300">
          <div className="glass-modal p-10 md:p-14 rounded-[56px] w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-12 duration-500 relative overflow-hidden">
            
            {/* The "Trace" Accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-2 rounded-b-full bg-gradient-to-r from-[#001BB7] to-[#FF8040]" />
            
            <button onClick={() => setModalOpen(false)} className="absolute right-10 top-10 text-slate-300 hover:text-slate-900 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>

            <div className="mb-12">
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-3">
                    {user.role === 'teacher' ? 'Classroom' : 'Access Key'}
                </h3>
                <p className="text-slate-500 text-[13px] font-bold tracking-tight opacity-70">
                    {user.role === 'teacher' ? 'Name your digital workspace.' : 'Enter the class code to join.'}
                </p>
            </div>
            
            <div className="space-y-10">
                <div className="relative group">
                    <input 
                      autoFocus
                      className="w-full bg-transparent border-b-4 border-slate-200 p-0 pb-4 outline-none focus:border-[#001BB7] transition-all font-black text-slate-900 placeholder:text-slate-200 text-3xl"
                      placeholder={user.role === 'teacher' ? 'e.g. History' : 'e.g. PCUF8D'}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                    />
                    <div className="absolute bottom-0 left-0 w-0 h-1 bg-[#FF8040] transition-all group-focus-within:w-full" />
                </div>

                <button 
                  onClick={handleAction} 
                  disabled={isSubmitting || !inputValue.trim()}
                  className="w-full py-6 bg-[#001BB7] text-white rounded-[28px] font-black shadow-[0_15px_40px_rgba(0,27,183,0.3)] hover:bg-black transition-all uppercase text-[11px] tracking-[0.4em] active:scale-95 disabled:opacity-30 flex items-center justify-center group"
                >
                  {isSubmitting ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                      <>
                        <span>{user.role === 'teacher' ? 'Create Class' : 'Join Class'}</span>
                        <svg className="ml-3 group-hover:translate-x-1 transition-transform" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="m9 18 6-6-6-6"/></svg>
                      </>
                  )}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}