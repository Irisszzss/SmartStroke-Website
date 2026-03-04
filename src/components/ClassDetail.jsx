import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../utils/api';
import { QRCodeCanvas } from 'qrcode.react';
import { io } from 'socket.io-client';

const socket = io('https://smartstroke-api.onrender.com');

export default function ClassDetail({ user, classroom, onBack, onStartSession, triggerToast }) {
  const [students, setStudents] = useState([]);
  const [localFiles, setLocalFiles] = useState(classroom?.files || []);
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Live Stream State
  const [isLive, setIsLive] = useState(false);

  // MODAL STATES
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Sorting States
  const [sortBy, setSortBy] = useState('time'); 
  const [sortOrder, setSortOrder] = useState('desc'); 
  
  const qrRef = useRef();

  useEffect(() => {
    if (!classroom?._id) return;

    // Join the room to receive status updates
    socket.emit('join-session', classroom._id);

    // Initial check for stream status
    socket.emit('check-stream-status', classroom._id);

    // Listen for status changes
    socket.on('stream-status', (status) => {
      setIsLive(status.isLive);
    });

    return () => {
      socket.off('stream-status');
    };
  }, [classroom?._id]);

  useEffect(() => {
    if (classroom?.files) setLocalFiles(classroom.files);
  }, [classroom]);

  useEffect(() => {
    if (user?.role === 'teacher') loadStudents();
  }, [user]);

  const loadStudents = async () => {
    try {
      const res = await api.getStudents(classroom._id);
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error("Failed to load students"); }
  };

  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    try {
      await api.deleteClass(classroom._id);
      triggerToast("Classroom deleted successfully", "info");
      setShowDeleteConfirm(false);
      onBack(); 
    } catch (err) {
      triggerToast("Failed to delete classroom", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmLeave = async () => {
    setIsProcessing(true);
    try {
      await api.leaveClass(classroom._id, user.userId);
      triggerToast("You have left the classroom", "info");
      setShowLeaveConfirm(false);
      onBack(); 
    } catch (err) {
      triggerToast("Failed to leave classroom", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const sortedFiles = useMemo(() => {
    // 1. Filter out any null or undefined entries to prevent "reading properties of null"
    const validFiles = localFiles.filter(file => file !== null && typeof file === 'object');

    return validFiles.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.filename || "").localeCompare(b.filename || "");
      } else {
        // 2. Use a fallback date (0) if the property is missing
        const dateA = new Date(a.uploadDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.uploadDate || b.createdAt || 0).getTime();
        comparison = dateA - dateB;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [localFiles, sortBy, sortOrder]);

  const toggleSort = (type) => {
    if (sortBy === type) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('desc');
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return "Just Now"; 
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Just Now"; 
    return date.toLocaleString('en-US', { 
        hour: '2-digit', minute: '2-digit',
        month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const handleDownload = async (file) => {
    try {
      const response = await fetch(`https://smartstroke-api.onrender.com/${file.path}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename || "SmartStroke_Note.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      triggerToast("Download started", "success");
    } catch (err) { triggerToast("Download failed", "error"); }
  };

  const handleDeleteFile = async (fileId) => {
    try {
        await api.deleteFile(classroom._id, fileId);
        triggerToast("Note deleted", "success");
        setLocalFiles(prev => prev.filter(f => f._id !== fileId));
    } catch (err) { triggerToast("Delete failed", "error"); }
  };

  const handleRemoveStudent = async (studentId) => {
    try {
      await api.removeStudent(classroom._id, studentId);
      triggerToast("Student removed", "info");
      loadStudents(); 
    } catch (err) { triggerToast("Failed to remove", "error"); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(classroom.code);
    setCopied(true);
    triggerToast("Access Key copied!", "info");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQR = () => {
    const canvas = qrRef.current.querySelector('canvas');
    const image = canvas.toDataURL("image/png");
    const anchor = document.createElement("a");
    anchor.href = image;
    anchor.download = `QR_${classroom.code}.png`;
    anchor.click();
  };

  return (
    <div className="relative min-h-screen animate-in slide-in-from-bottom-4 duration-700 pb-0">
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#001BB7] opacity-10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#FF8040] opacity-10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-8">
            <button onClick={onBack} className="group flex items-center gap-2 text-[#001BB7] font-black hover:opacity-70 transition-all uppercase text-[10px] tracking-widest">
              <div className="bg-white p-2 rounded-full shadow-sm border border-slate-100 group-hover:-translate-x-1 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </div>
              Return to Dashboard
            </button>
            <div className="bg-slate-900/5 px-4 py-1.5 rounded-full border border-slate-900/5">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Role: {user?.role}</span>
            </div>
        </div>

        <div className="bg-white/70 backdrop-blur-xl p-10 rounded-[48px] shadow-2xl border border-white mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-1 bg-[#FF8040] rounded-full" />
                <span className="text-[#001BB7] font-black text-[10px] uppercase tracking-[0.4em]">Active Workspace</span>
              </div>
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">{classroom?.name}</h2>
              
              <div className="flex flex-col gap-4">
                {user?.role === 'teacher' ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="bg-orange-50 text-[#FF8040] px-6 py-2 rounded-2xl font-mono font-black text-2xl border border-orange-100 shadow-sm">{classroom?.code}</span>
                      <button onClick={handleCopy} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-[#001BB7] transition-all">
                          {copied ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>}
                      </button>
                      <button onClick={() => setShowQRModal(true)} className="p-3 bg-[#001BB7] rounded-2xl text-white hover:bg-[#0046FF] transition-all flex items-center gap-2 px-4 shadow-lg shadow-blue-200">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v.01"/></svg>
                          <span className="text-[10px] font-black tracking-widest uppercase">QR</span>
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-2 text-red-300 hover:text-red-500 transition-colors text-[10px] font-black uppercase tracking-widest w-fit group"
                    >
                      <div className="p-1 rounded-md bg-red-50 group-hover:bg-red-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </div>
                      Delete Classroom
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <button 
                      onClick={() => setShowLeaveConfirm(true)}
                      className="flex items-center gap-2 text-red-300 hover:text-red-500 transition-colors text-[10px] font-black uppercase tracking-widest w-fit group"
                    >
                      <div className="p-1 rounded-md bg-red-50 group-hover:bg-red-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      </div>
                      Leave Classroom
                    </button>
                  </div>
                )}
              </div>
          </div>

          {/* TEACHER BUTTON: START SESSION */}
          {user?.role === 'teacher' && (
              <button onClick={onStartSession} className="w-full md:w-auto bg-[#001BB7] text-white px-10 py-6 rounded-[28px] font-black shadow-2xl hover:bg-[#0046FF] transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5L4.5 5.5c-.3.3-.5.7-.5 1.1V21c0 .6.4 1 1 1h14c.6 0 1-.4 1-1V6.5c0-.4-.2-.8-.5-1.1l-3-3c-.3-.3-.7-.5-1.1-.5z"/><path d="M15 2v4c0 .6.4 1 1 1h4"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9h4"/></svg>
                  Start Whiteboard Session
              </button>
          )}

          {/* STUDENT BUTTON: JOIN LIVE STREAM */}
          {user?.role === 'student' && (
              <button 
                disabled={!isLive}
                onClick={onStartSession} 
                className={`w-full md:w-auto px-10 py-6 rounded-[28px] font-black shadow-2xl transition-all flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em] 
                  ${isLive 
                    ? 'bg-[#FF8040] text-white hover:bg-[#e66a2e] animate-pulse cursor-pointer' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none opacity-60'}`}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
                  {isLive ? 'Join Session' : 'Classroom Offline'}
              </button>
          )}
        </div>

        <div className={`grid grid-cols-1 ${user?.role === 'teacher' ? 'lg:grid-cols-3' : ''} gap-8`}>
            {/* Notes Section */}
            <div className={`${user?.role === 'teacher' ? 'lg:col-span-2' : ''} bg-white/60 backdrop-blur-md rounded-[40px] border border-white overflow-hidden shadow-xl`}>
                <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40">
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-[0.3em] text-[10px]">Digitized Notes</h3>
                        <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Ordered by: {sortBy} ({sortOrder})</p>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => toggleSort('time')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sortBy === 'time' ? 'bg-white text-[#001BB7] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Time {sortBy === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}</button>
                        <button onClick={() => toggleSort('name')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${sortBy === 'name' ? 'bg-white text-[#001BB7] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</button>
                    </div>
                </div>
                <div className="p-4 space-y-4 max-h-[280px] overflow-y-auto no-scrollbar">
                    {sortedFiles?.length > 0 ? sortedFiles.map((file, idx) => (
                        <div key={idx} className="group flex flex-col sm:flex-row justify-between items-center p-6 bg-white/80 border border-slate-100/50 rounded-[32px] hover:border-[#001BB7] hover:shadow-2xl transition-all duration-500 gap-4">
                            <div className="flex items-center gap-5 overflow-hidden w-full sm:w-auto">
                                <div className="bg-blue-50 p-4 rounded-2xl text-[#001BB7] group-hover:bg-[#001BB7] group-hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-sm font-black truncate text-slate-800">{file.filename}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Synced: {formatTimestamp(file.uploadDate || file.createdAt)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <a href={`https://smartstroke-api.onrender.com/${file.path}`} target="_blank" rel="noreferrer" className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-[#001BB7] transition-all tracking-[0.1em]">VIEW</a>
                                <button onClick={() => handleDownload(file)} className="p-2.5 bg-blue-50 text-[#001BB7] rounded-xl hover:bg-[#001BB7] hover:text-white transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                                {user?.role === 'teacher' && (
                                    <button onClick={() => handleDeleteFile(file._id)} className="p-2.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                                )}
                            </div>
                        </div>
                    )) : <p className="text-center text-slate-300 py-10">No archives yet.</p>}
                </div>
            </div>

            {/* Student Roster (Teacher Only) */}
            {user?.role === 'teacher' && (
                <div className="bg-white/60 backdrop-blur-md rounded-[40px] border border-white overflow-hidden shadow-xl flex flex-col">
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white/40">
                        <h3 className="font-black text-slate-800 uppercase tracking-[0.3em] text-[10px]">Enrolled Students</h3>
                        <span className="text-[10px] font-black text-slate-400">{students?.length || 0} TOTAL</span>
                    </div>
                    <div className="p-6 space-y-3 max-h-[300px] sm:max-h-[500px] overflow-y-auto no-scrollbar flex-1">
                        {students.map((s) => {
                            const studentAvatar = s.profilePicture ? (s.profilePicture.startsWith('http') ? s.profilePicture : `https://smartstroke-api.onrender.com/${s.profilePicture}`) : null;
                            return (
                                <div key={s._id} className="flex items-center justify-between p-4 bg-white/50 rounded-2xl border border-slate-100/50 group hover:bg-white transition-all">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shrink-0 overflow-hidden shadow-sm">
                                            {studentAvatar ? <img src={studentAvatar} className="w-full h-full object-cover" alt="Student" /> : (s.firstName ? s.firstName.charAt(0) : '?').toUpperCase()}
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-[11px] font-black text-slate-800 truncate uppercase">{s.firstName} {s.surname}</span>
                                            <span className="text-[9px] font-bold text-slate-400 truncate">{s.username}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveStudent(s._id)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      </div>

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isProcessing && setShowLeaveConfirm(false)} />
          <div className="relative bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-md text-center border border-white animate-in zoom-in-95 transition-all duration-500 hover:scale-[1.01] hover:shadow-red-900/5">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500 shadow-inner transition-transform duration-700 hover:rotate-12">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Leave Classroom?</h3>
              <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium">
                  You will no longer have access to the archives for <span className="font-bold text-slate-800">"{classroom.name}"</span>.
              </p>
              <div className="flex flex-col gap-3">
                  <button disabled={isProcessing} onClick={handleConfirmLeave} className="w-full bg-red-500 text-white py-5 rounded-[24px] font-black shadow-xl shadow-red-100 hover:bg-red-600 hover:shadow-red-200 transition-all active:scale-95 uppercase text-xs tracking-widest disabled:opacity-50">
                      {isProcessing ? "Leaving..." : "Confirm Leave"}
                  </button>
                  <button disabled={isProcessing} onClick={() => setShowLeaveConfirm(false)} className="w-full bg-slate-50 text-slate-400 py-5 rounded-[24px] font-black hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95 uppercase text-xs tracking-widest">
                      Cancel
                  </button>
              </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isProcessing && setShowDeleteConfirm(false)} />
          <div className="relative bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-md text-center border border-white animate-in zoom-in-95 transition-all duration-500 hover:scale-[1.01] hover:shadow-red-900/10">
              <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500 shadow-inner transition-transform duration-300 group-hover:rotate-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Delete Classroom?</h3>
              <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium">
                  This will permanently remove the class and all notes. <span className="text-red-500 font-bold uppercase text-[10px] block mt-1">This action cannot be undone.</span>
              </p>
              <div className="flex flex-col gap-3">
                  <button disabled={isProcessing} onClick={handleConfirmDelete} className="w-full bg-red-500 text-white py-5 rounded-[24px] font-black shadow-xl shadow-red-100 hover:bg-red-600 hover:shadow-red-200 transition-all active:scale-95 uppercase text-xs tracking-widest disabled:opacity-50 flex items-center justify-center min-h-[60px]">
                      {isProcessing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirm Permanent Delete"}
                  </button>
                  <button disabled={isProcessing} onClick={() => setShowDeleteConfirm(false)} className="w-full bg-slate-50 text-slate-400 py-5 rounded-[24px] font-black hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95 uppercase text-xs tracking-widest">
                      Cancel
                  </button>
              </div>
          </div>
        </div>
      )}

      {showQRModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowQRModal(false)} />
            <div className="relative bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-sm text-center border border-white animate-in zoom-in-95">
                <button onClick={() => setShowQRModal(false)} className="absolute right-6 top-6 text-slate-300 hover:text-slate-900"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                <h3 className="text-2xl font-black text-slate-900 mb-6 uppercase tracking-tight">Access QR</h3>
                <div ref={qrRef} className="bg-slate-50 p-6 rounded-[32px] inline-block mb-8">
                    <QRCodeCanvas value={classroom.code} size={200} level={"H"} />
                </div>
                <button onClick={downloadQR} className="w-full bg-[#001BB7] text-white py-5 rounded-[24px] font-black shadow-xl hover:bg-[#0046FF] transition-all uppercase text-xs tracking-widest">Save QR Image</button>
            </div>
        </div>
      )}
    </div>
  );
}