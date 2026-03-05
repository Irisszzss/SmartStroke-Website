import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import SSLogo from '../assets/SS_Logo.png';

export default function Auth({ onLogin }) {
  const [searchParams] = useSearchParams();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '', 
    email: '',
    password: '', 
    confirmPassword: '',
    firstName: '',
    middleInitial: '',
    surname: '',
    role: 'student'
  });
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setInfoMessage('');
    setFormData({
      username: '', email: '', password: '', confirmPassword: '',
      firstName: '', middleInitial: '', surname: '', role: 'student'
    });
  };

  const progressInfo = useMemo(() => {
    const loginFields = ['username', 'password'];
    const registerFields = ['firstName', 'surname', 'email', 'username', 'password', 'confirmPassword'];
    
    const fieldsToTrack = isLogin ? loginFields : registerFields;
    const filledFields = fieldsToTrack.filter(field => formData[field] && formData[field].trim().length > 0);
    const percentage = filledFields.length / fieldsToTrack.length;
    const isComplete = percentage === 1;
    
    const minWidth = isLogin ? 48 : 80;
    return {
      width: `calc(${minWidth}px + ${percentage} * (100% - ${minWidth}px))`,
      color: isComplete ? '#10b981' : '#FF8040',
      glow: isComplete ? 'rgba(16,185,129,0.3)' : 'rgba(255,128,64,0.3)'
    };
  }, [formData, isLogin]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      const response = isLogin 
        ? await api.login(formData.username, formData.password)
        : await api.register({ ...formData, middleInitial: (formData.middleInitial || '').toUpperCase() });
      
      if (response.data && response.data.success) {
        const userPayload = response.data.user || response.data;
        const joinCode = searchParams.get('joinCode');
        if (isLogin && userPayload.role === 'student' && joinCode) {
          try {
            const sid = userPayload.userId || userPayload._id;
            await api.joinClass(sid, joinCode.trim().toUpperCase());
          } catch (err) { console.error(err); }
        }
        if (!isLogin && formData.role === 'student') {
          setIsLoading(false); setShowSuccessModal(true); setIsLogin(true); return; 
        }
        if (userPayload.isApproved === false) {
            setIsLoading(false); setShowApprovalModal(true); setIsLogin(true); return; 
        } 
        onLogin(userPayload);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    } finally { setIsLoading(false); }
  };

  return (
    <div className="relative select-none flex flex-col items-center min-h-screen bg-[#FDFCF5] font-['Poppins'] overflow-x-hidden">
      
      <style>{`
        .bg-pattern {
          background-color: #fdfcf5;
          background-image: radial-gradient(#001BB7 0.6px, transparent 0.6px), radial-gradient(#FF8040 0.6px, #fdfcf5 0.6px);
          background-size: 40px 40px;
          background-position: 0 0, 20px 20px;
          opacity: 0.12;
        }
        .expandable-section { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        .expandable-section.open { grid-template-rows: 1fr; }
        .expandable-content { overflow: hidden; }
        .blue-glow:focus { border-color: #001BB7; box-shadow: 0 0 0 4px rgba(0, 27, 183, 0.05); }
      `}</style>

      {/* FIXED BRANDED BACKGROUND */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-pattern" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[#001BB7]/[0.02] -skew-x-12 translate-x-20" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-[#FF8040]/[0.02] skew-y-12 -translate-x-10" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-4 py-8 flex-shrink-0">
        
        {/* LOGO SECTION */}
        <div className="mb-10 text-center flex-shrink-0 animate-in fade-in slide-in-from-top-8 duration-1000">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-tr from-[#001BB7] to-[#FF8040] rounded-[38px] opacity-20 blur-xl animate-pulse" />
            <div className="relative bg-[#001BB7] w-20 h-20 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-2xl transition-transform hover:scale-105 active:scale-95">
              <img src={SSLogo} alt="SmartStroke Logo" width="100" height="100" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
          </div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Smart<span className="text-[#FF8040]">Stroke</span></h1>
          <p className="text-[#001BB7] font-bold text-[12px] uppercase tracking-[0.4em] mt-4 opacity-70">Get in sync with your ink</p>
        </div>

        {/* AUTH CARD */}
        <div className="bg-white/95 backdrop-blur-xl p-8 md:p-10 rounded-[48px] shadow-[0_30px_100px_rgba(0,0,0,0.06)] border border-white w-full flex-shrink-0 animate-in zoom-in-95 duration-700">
          
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight transition-all duration-500">
              {isLogin ? 'Sign In' : 'Get Started'}
            </h2>
            <div 
              className="h-1.5 rounded-full mt-2 transition-all duration-700 ease-out" 
              style={{ width: progressInfo.width, backgroundColor: progressInfo.color, boxShadow: `0 2px 10px ${progressInfo.glow}` }} 
            />
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className={`expandable-section ${!isLogin ? 'open' : ''}`}>
                <div className="expandable-content">
                    <div className="space-y-4 pb-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-5">
                                <label className="block text-[10px] font-black text-[#001BB7] uppercase tracking-widest mb-1.5 ml-1">First Name</label>
                                <input required={!isLogin} type="text" value={formData.firstName} placeholder="Juan" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-sm" onChange={e => setFormData({...formData, firstName: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 text-center">MI</label>
                                <input maxLength="2" type="text" value={formData.middleInitial} placeholder="C" className="w-full px-1 py-4 rounded-2xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-sm text-center uppercase" onChange={e => setFormData({...formData, middleInitial: e.target.value})} />
                            </div>
                            <div className="col-span-5">
                                <label className="block text-[10px] font-black text-[#001BB7] uppercase tracking-widest mb-1.5 ml-1">Surname</label>
                                <input required={!isLogin} type="text" value={formData.surname} placeholder="Dela Cruz" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-sm" onChange={e => setFormData({...formData, surname: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-[#001BB7] uppercase tracking-widest mb-1.5 ml-1">Email</label>
                            <input required={!isLogin} type="email" value={formData.email} placeholder="name@gmail.com" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-sm" onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                    </div>
                </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#001BB7] uppercase tracking-widest mb-1.5 ml-1">Email / Username</label>
              <input required type="text" value={formData.username} placeholder={isLogin ? "Username or Email" : "Create a username"} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-sm"
                onChange={e => setFormData({...formData, username: e.target.value})} />
            </div>

            <div className="relative">
              <label className="block text-[10px] font-black text-[#001BB7] uppercase tracking-widest mb-1.5 ml-1">Password</label>
              <input required type={showPassword ? "text" : "password"} value={formData.password} placeholder="Password" className="w-full px-5 pr-14 py-4 rounded-2xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-sm"
                onChange={e => setFormData({...formData, password: e.target.value})} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-11 text-slate-300 hover:text-[#FF8040] transition-colors">
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>

            <div className={`expandable-section ${!isLogin ? 'open' : ''}`}>
                <div className="expandable-content">
                    <div className="pt-2 pb-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="relative">
                            <label className="block text-[10px] font-black text-[#001BB7] uppercase tracking-widest mb-1.5 ml-1">Confirm Password</label>
                            <input required={!isLogin} type={showPassword ? "text" : "password"} value={formData.confirmPassword} placeholder="Re-enter password" 
                            className={`w-full px-5 pr-14 py-4 rounded-2xl border-2 transition-all outline-none font-bold text-sm ${
                                formData.confirmPassword && formData.password !== formData.confirmPassword 
                                ? 'bg-red-50 border-red-200' 
                                : 'bg-slate-50 border-transparent blue-glow'
                            }`}
                            onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-11 text-slate-300 hover:text-[#FF8040] transition-colors">
                              {showPassword ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                              )}
                            </button>
                        </div>

                        <div className="p-1.5 bg-slate-100 rounded-2xl flex gap-1.5">
                            <button type="button" className={`flex-1 py-3 rounded-xl text-[11px] font-black tracking-widest transition-all ${formData.role === 'student' ? 'bg-[#001BB7] text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setFormData({...formData, role: 'student'})}>STUDENT</button>
                            <button type="button" className={`flex-1 py-3 rounded-xl text-[11px] font-black tracking-widest transition-all ${formData.role === 'teacher' ? 'bg-[#FF8040] text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setFormData({...formData, role: 'teacher'})}>TEACHER</button>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-500 text-[11px] font-black p-4 rounded-2xl border border-red-100 animate-bounce uppercase tracking-widest text-center">{error}</div>}

            <button type="submit" disabled={isLoading} className="w-full bg-[#001BB7] text-white py-5 h-[68px] rounded-3xl font-black shadow-2xl hover:bg-[#00148a] hover:-translate-y-0.5 active:scale-[0.97] transition-all flex items-center justify-center disabled:opacity-70 group">
              {isLoading ? <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="text-sm tracking-[0.3em] ml-1 uppercase">{isLogin ? 'Sign In' : 'Create Account'}</span>}
            </button>
          </form>

          <button disabled={isLoading} onClick={handleToggleMode} className="w-full mt-8 text-[11px] font-black tracking-widest text-slate-400 hover:text-[#FF8040] transition-colors uppercase">
            {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>

      {/* MODALS */}
      {(showSuccessModal || showApprovalModal) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
          <div className="relative bg-white p-8 rounded-[40px] shadow-2xl w-full max-w-sm text-center border border-white animate-in zoom-in-95">
            {showSuccessModal ? (
              <>
                <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Success!</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed font-bold">Your student account is ready. Log in to start your trace.</p>
                <button onClick={() => setShowSuccessModal(false)} className="w-full bg-[#001BB7] text-white py-4 rounded-2xl font-black shadow-xl hover:bg-[#FF8040] transition-all active:scale-95 uppercase text-xs tracking-widest">Log In Now</button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Pending Approval</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed font-bold">Teacher account created! Please wait for an admin to verify your credentials.</p>
                <button onClick={() => setShowApprovalModal(false)} className="w-full bg-[#001BB7] text-white py-4 rounded-2xl font-black shadow-xl hover:bg-[#FF8040] transition-all active:scale-95 uppercase text-xs tracking-widest">Got it!</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
