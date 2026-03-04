import React, { useState, useEffect, useCallback } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import ClassDetail from './components/ClassDetail';
import Profile from './components/Profile';
import AdminPage from './page/AdminPage'; 
import IMUCanvas from './page/IMUCanvas';
import SSLogo from './assets/SS_Logo.png';
import { io } from 'socket.io-client';

const socket = io('https://smartstroke-api.onrender.com');

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
    // 1. GATEKEEPER CHECK: 
    // If the user is a teacher but not approved, REJECT them here.
    if (userData.role === 'teacher' && userData.isApproved === false) {
      triggerToast("Access Denied: Account pending admin approval.", "error");
      return; // Stop the function here. Do not set user, do not save to session.
    }

    // 2. Data Integrity Check:
    if (!userData || !userData.email) {
      triggerToast("Authentication error. Please try again.", "error");
      return;
    }

    // 3. Clear old class data and set the verified user
    setSelectedClass(null);
    setUser(userData);
    sessionStorage.setItem('smartstroke_user', JSON.stringify(userData));
    
    // 4. Routing Logic
    if (userData.email === ADMIN_EMAIL) {
      setActiveView('admin');
    } else if (userData.role === 'teacher') {
      setActiveView('dashboard');
    } else {
      setActiveView('dashboard');
    }
    
    triggerToast(`Welcome back, ${userData.name || 'User'}!`, "success");
  };

  const handleLogout = () => {
    // 1. Clear State
    setUser(null);
    setSelectedClass(null); // Clear this so the next user doesn't see old class data
    
    // 2. Clear Storage
    sessionStorage.removeItem('smartstroke_user');
    sessionStorage.clear(); // Wipe everything to be safe
    
    // 3. Reset View
    setActiveView('dashboard');
    
    triggerToast("Logged out successfully", "info");
    
    // OPTIONAL: Force a reload to ensure a clean slate
    // window.location.reload(); 
  };

  const handleUpdateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    setUser(newUser);
    sessionStorage.setItem('smartstroke_user', JSON.stringify(newUser));
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
  if (!user) return <Auth onLogin={handleLogin} />;

  const avatarUrl = user.profilePicture 
    ? (user.profilePicture.startsWith('http') 
        ? user.profilePicture 
        : `https://smartstroke-api.onrender.com/${user.profilePicture}`)
    : null;

  return (
    <div className="h-[100dvh] bg-[#FDFCF5] font-['Poppins'] text-slate-800 flex flex-col overflow-hidden">
      
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-20 md:top-24 left-1/2 -translate-x-1/2 z-[100] 
          w-[92%] md:w-auto px-4 md:px-6 py-3 rounded-2xl shadow-2xl font-bold 
          text-xs md:text-sm animate-in slide-in-from-top-4 duration-300 
          flex items-center justify-center md:justify-start gap-3 border select-none outline-none ${
          toast.type === 'error' ? 'bg-red-500 text-white border-red-600' : 
          toast.type === 'info' ? 'bg-blue-600 text-white border-blue-700' : 
          'bg-emerald-600 text-white border-emerald-700'
        }`}>
          <span className="text-center md:text-left truncate">{toast.message}</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-[#001BB7] p-3 md:p-4 text-white flex justify-between items-center shadow-xl z-50 shrink-0 select-none">
        <div className="flex items-center gap-2 md:gap-3 cursor-pointer group outline-none" onClick={() => setActiveView(user.email === ADMIN_EMAIL ? 'admin' : 'dashboard')}>
          <div className="bg-orange-500 w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform shrink-0">
              <img src={SSLogo} alt="SmartStroke Logo" width="50" height="50" style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <h1 className="text-sm md:text-xl font-black tracking-tight uppercase whitespace-nowrap">SmartStroke</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          {user.email === ADMIN_EMAIL && (
            <button 
              onClick={() => setActiveView('admin')}
              className={`text-[10px] font-black tracking-widest px-3 py-2 rounded-xl border transition-all ${
                activeView === 'admin' ? 'bg-orange-500 border-orange-600' : 'bg-white/10 border-white/20 hover:bg-white/20'
              }`}
            >
              ADMIN PANEL
            </button>
          )}

          <div className="flex items-center gap-2 md:gap-3 cursor-pointer group select-none outline-none" onClick={() => setActiveView('profile')}>
            <div className="hidden md:block text-right">
              <p className="text-[9px] uppercase font-black opacity-40 leading-none tracking-widest mb-1">{getGreeting()}</p>
              <p className="text-sm font-bold group-hover:text-orange-400 transition-colors">{user.name}</p>
            </div>
            
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-xs md:text-sm font-black group-hover:border-orange-500 group-hover:bg-orange-500 transition-all shadow-lg overflow-hidden shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="profile" className="w-full h-full object-cover" />
              ) : (
                user.name?.charAt(0).toUpperCase()
              )}
            </div>
          </div>
          <button onClick={handleLogout} className="bg-white/5 hover:bg-red-500 border border-white/10 p-2 md:px-5 md:py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 shadow-sm outline-none select-none flex items-center gap-2">
            <span className="hidden sm:block">LOGOUT</span>
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
              // FIXED: Added triggerToast prop here
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
                  className="fixed bottom-6 right-6 lg:absolute lg:top-6 lg:left-10 lg:bottom-auto lg:right-auto z-[60] 
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
  );
}