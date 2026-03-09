import React, { useState, useEffect, useCallback } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ClassDetail from './components/ClassDetail';
import Profile from './components/Profile';
import AdminPage from './page/AdminPage'; 
import IMUCanvas from './page/IMUCanvas';
import SSLogo from './assets/SS_Logo.png';
import { io } from 'socket.io-client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Use environment variable for production, fallback for local dev
const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://smartstroke-api.onrender.com';

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: true
});

export default function App() {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedClass, setSelectedClass] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const ADMIN_EMAIL = "jonescolleeniris08@gmail.com";

  const triggerToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  }, []);

  const handleForceExit = useCallback(() => {
    setActiveView('detail');
    triggerToast("Session ended by teacher", "info");
  }, [triggerToast]);

  // Handle Socket Joining
  useEffect(() => {
    if (user && selectedClass?._id && activeView === 'whiteboard') {
      socket.emit('join-session', selectedClass._id);
    }
  }, [user, selectedClass, activeView]);

  // Session Restoration & Admin View Check
  useEffect(() => {
    const savedUser = sessionStorage.getItem('smartstroke_user');
    if (savedUser) {
      try { 
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        
        // Ensure Admin stays on Admin Panel after refresh
        if (parsedUser.email === ADMIN_EMAIL) {
          setActiveView('admin');
        }
      } catch (e) { 
        sessionStorage.removeItem('smartstroke_user'); 
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    const userPayload = userData.user || userData;

    if (userPayload.role === 'teacher' && userPayload.isApproved === false) {
      triggerToast("Access Denied: Account pending admin approval.", "error");
      return; 
    }

    if (!userPayload.firstName && userPayload.name) {
      const nameParts = userPayload.name.trim().split(/\s+/);
      userPayload.firstName = nameParts[0] || 'User';
      userPayload.surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    }

    setSelectedClass(null);
    setUser(userPayload);
    sessionStorage.setItem('smartstroke_user', JSON.stringify(userPayload));
    
    if (userPayload.email === ADMIN_EMAIL) {
      setActiveView('admin');
    } else {
      setActiveView('dashboard');
    }
    
    triggerToast(`Welcome back, ${userPayload.firstName || 'User'}!`, "success");
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedClass(null);
    sessionStorage.removeItem('smartstroke_user');
    sessionStorage.clear(); 
    setActiveView('dashboard');
    triggerToast("Logged out successfully", "info");
  };

  const handleUpdateUser = (updatedData) => {
    setUser(prevUser => {
      const newUser = { ...prevUser, ...updatedData };
      sessionStorage.setItem('smartstroke_user', JSON.stringify(newUser));
      return newUser;
    });
  };

  const handleSaveSuccess = (newFileData) => {
    if (newFileData) {
      if (selectedClass) {
        const updatedClass = {
          ...selectedClass,
          files: [...(selectedClass.files || []), newFileData]
        };
        setSelectedClass(updatedClass);
      }
      triggerToast("Note successfully saved!", "success");
    } else {
      triggerToast("Session ended", "info");
    }
    setActiveView('detail');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning,";
    if (hour < 18) return "Good Afternoon,";
    return "Good Evening,";
  };

  if (loading) return <div className="h-screen bg-[#FDFCF5]" />;

  const avatarUrl = user?.profilePicture 
    ? (user.profilePicture.startsWith('http') 
        ? user.profilePicture 
        : `https://smartstroke-api.onrender.com/${user.profilePicture}`)
    : null;

  return (
    <Router>
      <div className="h-[100dvh] bg-[#FDFCF5] font-['Poppins'] text-slate-800 flex flex-col overflow-hidden">
        
        {/* Toast Notification */}
        {toast.show && (
          /* Wrapper set to z-[999] and pointer-events-none so it's not a 'ghost' block */
          <div className="fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[999] w-[92%] md:w-auto pointer-events-none">
            <div className={`
              mx-auto px-4 md:px-6 py-3 rounded-2xl shadow-2xl font-bold 
              text-xs md:text-sm animate-in slide-in-from-top-4 duration-300 
              flex items-center justify-center md:justify-start gap-3 border 
              select-none outline-none pointer-events-auto
              ${toast.type === 'error' ? 'bg-red-500 text-white border-red-600' : 
                toast.type === 'info' ? 'bg-blue-600 text-white border-blue-700' : 
                'bg-emerald-600 text-white border-emerald-700'}
            `}>
              <span className="text-center md:text-left truncate">{toast.message}</span>
            </div>
          </div>
        )}

        <Routes>
          {/* Handle Login Path for QR Scans */}
          <Route path="/login" element={!user ? <Auth onLogin={handleLogin} /> : <Navigate to="/" />} />

          {/* Main App Path */}
          <Route path="/" element={
            !user ? <Auth onLogin={handleLogin} /> : (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Navigation */}
                <nav className="bg-[#001BB7]/95 backdrop-blur-md px-4 py-2.5 md:px-8 md:py-3 text-white flex justify-between items-center shadow-[0_4px_20px_rgba(0,0,0,0.1)] z-50 shrink-0 select-none border-b border-white/10">
  {/* Left Section: Logo & Brand */}
  <div 
    className="flex items-center gap-3 cursor-pointer group outline-none" 
    onClick={() => setActiveView(user.email === ADMIN_EMAIL ? 'admin' : 'dashboard')}
  >
    <div className="bg-orange-500 w-10 h-10 rounded-xl flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] group-hover:scale-105 group-hover:rotate-3 transition-all duration-300 shrink-0">
      <img src={SSLogo} alt="SmartStroke Logo" width="40" height="40" style={{ filter: 'brightness(0) invert(1)' }} />
    </div>
    <div className="flex flex-col">
      <h1 className="text-sm md:text-lg font-black tracking-tight uppercase leading-none">
        Smart<span className="text-orange-400">Stroke</span>
      </h1>
      <span className="text-[7px] md:text-[8px] font-bold tracking-[0.2em] opacity-60 uppercase mt-0.5 hidden sm:block">
        Handwriting Digitized
      </span>
    </div>
  </div>

  {/* Right Section: Actions & Profile */}
  <div className="flex items-center gap-3 md:gap-6">
    {user.email === ADMIN_EMAIL && (
      <button 
        onClick={() => setActiveView('admin')}
        className={`text-[9px] font-black tracking-widest px-3 py-2 rounded-xl border-2 transition-all active:scale-95 ${
          activeView === 'admin' 
            ? 'bg-orange-500 border-orange-400 shadow-lg shadow-orange-950/20' 
            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
        }`}
      >
        ADMIN
      </button>
    )}

    {/* Profile Section */}
    <div 
      className="flex items-center gap-3 cursor-pointer group select-none outline-none" 
      onClick={() => setActiveView('profile')}
    >
      <div className="hidden md:block text-right">
        <p className="text-[8px] uppercase font-black opacity-40 leading-none tracking-widest mb-1">
          {getGreeting()}
        </p>
        <p className="text-sm font-black group-hover:text-orange-400 transition-colors leading-none">
          {user.firstName || user.name}
        </p>
      </div>
      
      <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-white/10 border-2 border-white/10 flex items-center justify-center text-xs md:text-sm font-black group-hover:border-orange-500 group-hover:bg-orange-500/20 transition-all shadow-md overflow-hidden shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="profile" className="w-full h-full object-cover" />
        ) : (
          (user.firstName || user.name || 'U').charAt(0).toUpperCase()
        )}
      </div>
    </div>

    {/* Logout - Enhanced Button */}
    <button 
      onClick={handleLogout} 
      className="bg-white/5 hover:bg-red-500/90 border border-white/10 p-2.5 md:px-5 md:py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-90 shadow-sm flex items-center justify-center gap-2 group/logout"
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="3" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="group-hover/logout:-translate-x-0.5 transition-transform"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
      <span className="hidden lg:block">LOGOUT</span>
    </button>
  </div>
</nav>

                {/* Main Content Area */}
                <main className={`flex-1 flex flex-col ${
                  activeView === 'whiteboard' 
                    ? 'p-0 overflow-hidden' 
                    : 'p-4 md:p-8 overflow-y-auto overflow-x-hidden'
                }`}>
                  <div key={activeView} className={`${activeView === 'whiteboard' ? 'flex-1 w-full h-full' : 'flex-initial max-w-7xl mx-auto w-full'}`}>
                      
                      {activeView === 'admin' ? (
                        <AdminPage triggerToast={triggerToast} />
                      ) : activeView === 'dashboard' ? (
                        <Dashboard 
                          user={user} 
                          onSelectClass={(cls) => { setSelectedClass(cls); setActiveView('detail'); }} 
                          triggerToast={triggerToast}
                        />
                      ) : activeView === 'detail' ? (
                        <ClassDetail 
                          user={user} 
                          classroom={selectedClass} 
                          onBack={() => setActiveView(user.email === ADMIN_EMAIL ? 'admin' : 'dashboard')}
                          onStartSession={() => setActiveView('whiteboard')}
                          triggerToast={triggerToast}
                        />
                      ) : activeView === 'profile' ? (
                        <Profile 
                          user={user} 
                          onUpdateUser={handleUpdateUser} 
                          onBack={() => setActiveView(user.email === ADMIN_EMAIL ? 'admin' : 'dashboard')} 
                          triggerToast={triggerToast} 
                        />
                      ) : activeView === 'whiteboard' ? (
                        <div className="flex-1 flex flex-col h-full w-full bg-white overflow-hidden relative">
                          <button 
                            onClick={() => setActiveView('detail')} 
                            className="fixed bottom-6 right-6 lg:absolute lg:top-6 lg:left-70 lg:bottom-auto lg:right-auto z-[60] 
                            bg-white/90 backdrop-blur shadow-2xl border-2 border-[#001BB7]/10 px-5 py-3 rounded-2xl flex items-center 
                            gap-2 text-[#001BB7] font-black text-xs uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95">
                            Exit Session
                          </button>
                          <div className="w-full h-full">
                              <IMUCanvas 
                                classId={selectedClass?._id} 
                                onSaveSuccess={handleSaveSuccess}
                                onForceExit={handleForceExit}
                                role={user.role}
                                socket={socket}
                              />
                          </div>
                        </div>
                      ) : null}
                  </div>
                </main>
              </div>
            )
          } />
          
          {/* Redirect any other path to root */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}
