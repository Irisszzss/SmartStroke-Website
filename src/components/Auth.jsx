import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import SSLogo from '../assets/SS_Logo.png';

export default function Auth({ onLogin }) {
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
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    // CLEAR FORM: This prevents the "username" from Login carrying over to "username" in Signup
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
    const minWidth = isLogin ? 40 : 60;
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

      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-pattern" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md px-4 py-6 flex-shrink-0">
        {/* LOGO SECTION */}
        <div className="mb-6 text-center animate-in fade-in slide-in-from-top-8 duration-1000">
          <div className="relative inline-block">
            <div className="absolute -inset-3 bg-gradient-to-tr from-[#001BB7] to-[#FF8040] rounded-[28px] opacity-20 blur-lg animate-pulse" />
            <div className="relative bg-[#001BB7] w-14 h-14 rounded-[20px] flex items-center justify-center mx-auto mb-3 shadow-xl">
              <img src={SSLogo} alt="Logo" width="35" height="35" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Smart<span className="text-[#FF8040]">Stroke</span></h1>
          <p className="text-[#001BB7] font-bold text-[9px] uppercase tracking-[0.3em] mt-2 opacity-70">Get in sync with your ink</p>
        </div>

        {/* AUTH CARD */}
        <div className="bg-white/95 backdrop-blur-xl p-6 md:p-8 rounded-[32px] shadow-xl border border-white w-full animate-in zoom-in-95 duration-700">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-800">
              {isLogin ? 'Sign In' : 'Get Started'}
            </h2>
            <div className="h-1 rounded-full mt-1.5 transition-all duration-700" style={{ width: progressInfo.width, backgroundColor: progressInfo.color }} />
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className={`expandable-section ${!isLogin ? 'open' : ''}`}>
                <div className="expandable-content">
                    <div className="space-y-3 pb-3">
                        <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-5">
                                <label className="block text-[8px] font-black text-[#001BB7] uppercase tracking-widest mb-1 ml-1">First Name</label>
                                <input required={!isLogin} type="text" value={formData.firstName} placeholder="Juan" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-xs" onChange={e => setFormData({...formData, firstName: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">MI</label>
                                <input maxLength="2" type="text" value={formData.middleInitial} placeholder="C" className="w-full px-1 py-3 rounded-xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-xs text-center uppercase" onChange={e => setFormData({...formData, middleInitial: e.target.value})} />
                            </div>
                            <div className="col-span-5">
                                <label className="block text-[8px] font-black text-[#001BB7] uppercase tracking-widest mb-1 ml-1">Surname</label>
                                <input required={!isLogin} type="text" value={formData.surname} placeholder="Dela Cruz" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-xs" onChange={e => setFormData({...formData, surname: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[8px] font-black text-[#001BB7] uppercase tracking-widest mb-1 ml-1">Email Address</label>
                            <input required={!isLogin} type="email" value={formData.email} placeholder="name@email.com" className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-xs" onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                    </div>
                </div>
            </div>

            {/* SHARED FIELD WITH FIXED LABEL */}
            <div>
              <label className="block text-[8px] font-black text-[#001BB7] uppercase tracking-widest mb-1 ml-1">
                {isLogin ? "Username or Email" : "Unique Username"}
              </label>
              <input required type="text" value={formData.username} placeholder={isLogin ? "Enter email or username" : "Create username"} className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-xs"
                onChange={e => setFormData({...formData, username: e.target.value})} />
            </div>

            <div className="relative">
              <label className="block text-[8px] font-black text-[#001BB7] uppercase tracking-widest mb-1 ml-1">Password</label>
              <input required type={showPassword ? "text" : "password"} value={formData.password} placeholder="Enter password" className="w-full px-4 pr-11 py-3 rounded-xl bg-slate-50 border-2 border-transparent blue-glow transition-all outline-none font-bold text-xs"
                onChange={e => setFormData({...formData, password: e.target.value})} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-8 text-slate-300 hover:text-[#FF8040]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {showPassword ? <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/> : <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>}
                </svg>
              </button>
            </div>

            <div className={`expandable-section ${!isLogin ? 'open' : ''}`}>
                <div className="expandable-content">
                    <div className="pt-1 pb-3 space-y-3">
                        <div className="relative">
                            <label className="block text-[8px] font-black text-[#001BB7] uppercase tracking-widest mb-1 ml-1">Confirm Password</label>
                            <input required={!isLogin} type={showPassword ? "text" : "password"} value={formData.confirmPassword} placeholder="Confirm" 
                            className={`w-full px-4 pr-11 py-3 rounded-xl border-2 transition-all outline-none font-bold text-xs ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-transparent blue-glow'}`}
                            onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                        </div>
                        <div className="p-1 bg-slate-100 rounded-xl flex gap-1">
                            <button type="button" className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${formData.role === 'student' ? 'bg-[#001BB7] text-white shadow-md' : 'text-slate-400'}`} onClick={() => setFormData({...formData, role: 'student'})}>STUDENT</button>
                            <button type="button" className={`flex-1 py-2 rounded-lg text-[9px] font-black tracking-widest transition-all ${formData.role === 'teacher' ? 'bg-[#FF8040] text-white shadow-md' : 'text-slate-400'}`} onClick={() => setFormData({...formData, role: 'teacher'})}>TEACHER</button>
                        </div>
                    </div>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-500 text-[9px] font-black p-3 rounded-xl border border-red-100 text-center">{error}</div>}

            <button type="submit" disabled={isLoading} className="w-full bg-[#001BB7] text-white h-[56px] rounded-2xl font-black shadow-lg hover:bg-[#00148a] active:scale-[0.97] transition-all flex items-center justify-center disabled:opacity-70 uppercase text-xs tracking-widest">
              {isLoading ? <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" /> : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <button disabled={isLoading} onClick={handleToggleMode} className="w-full mt-6 text-[9px] font-black tracking-widest text-slate-400 hover:text-[#FF8040] transition-colors uppercase">
            {isLogin ? "New here? Create account" : "Have an account? Sign in"}
          </button>
        </div>
      </div>

      {/* MODALS */}
      {(showSuccessModal || showApprovalModal) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md">
          <div className="relative bg-white p-6 rounded-[32px] shadow-2xl w-full max-w-xs text-center border border-white">
            <div className={`w-14 h-14 ${showSuccessModal ? 'bg-emerald-100 text-emerald-500' : 'bg-orange-100 text-orange-500'} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-1 uppercase">{showSuccessModal ? "Success!" : "Pending"}</h3>
            <p className="text-slate-500 text-[10px] mb-6 font-bold">{showSuccessModal ? "Account ready. Log in to start." : "Please wait for admin verification."}</p>
            <button onClick={() => { setShowSuccessModal(false); setShowApprovalModal(false); }} className="w-full bg-[#001BB7] text-white py-3 rounded-xl font-black text-[10px] tracking-widest">OKAY</button>
          </div>
        </div>
      )}
    </div>
  );
}