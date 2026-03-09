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
  
  const [isLive, setIsLive] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null); 
  const [isProcessing, setIsProcessing] = useState(false);

  const [sortBy, setSortBy] = useState('time'); 
  const [sortOrder, setSortOrder] = useState('desc'); 
  
  const qrRef = useRef();

  useEffect(() => {
    if (!classroom?._id) return;
    socket.emit('join-session', classroom._id);
    socket.emit('check-stream-status', classroom._id);
    const handleStreamStatus = (status) => setIsLive(status.isLive);
    socket.on('stream-status', handleStreamStatus);
    return () => socket.off('stream-status', handleStreamStatus);
  }, [classroom?._id]);

  useEffect(() => {
    if (classroom?.files) setLocalFiles(classroom.files);
  }, [classroom]);

  useEffect(() => {
    if (user?.role === 'teacher') loadStudents();
  }, [user, classroom?._id]);

  const loadStudents = async () => {
    try {
      const res = await api.getStudents(classroom._id);
      setStudents(Array.isArray(res.data) ? res.data : []);
    } catch (err) { console.error("Failed to load students", err); }
  };

  const handleConfirmDelete = async () => {
    setIsProcessing(true);
    try {
      await api.deleteClass(classroom._id);
      triggerToast("Classroom deleted successfully", "info");
      setShowDeleteConfirm(false);
      onBack(); 
    } catch (err) { triggerToast("Failed to delete classroom", "error"); }
    finally { setIsProcessing(false); }
  };

  const handleConfirmLeave = async () => {
    const idToSend = user.userId || user._id;
    if (!idToSend) { triggerToast("Error: User session not found", "error"); return; }
    setIsProcessing(true);
    try {
      await api.leaveClass(classroom._id, idToSend);
      triggerToast("You have left the classroom", "info");
      setShowLeaveConfirm(false);
      onBack(); 
    } catch (err) { triggerToast("Failed to leave classroom", "error"); }
    finally { setIsProcessing(false); }
  };

  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsProcessing(true);
    try {
        await api.deleteFile(classroom._id, fileToDelete._id);
        triggerToast("Note deleted", "success");
        setLocalFiles(prev => prev.filter(f => f._id !== fileToDelete._id));
        setFileToDelete(null);
    } catch (err) { triggerToast("Delete failed", "error"); }
    finally { setIsProcessing(false); }
  };

  const sortedFiles = useMemo(() => {
    const validFiles = localFiles.filter(file => file !== null && typeof file === 'object');
    return [...validFiles].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.filename || "").localeCompare(b.filename || "");
      } else {
        const dateA = new Date(a.uploadDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.uploadDate || b.createdAt || 0).getTime();
        comparison = dateA - dateB;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [localFiles, sortBy, sortOrder]);

  const toggleSort = (type) => {
    if (sortBy === type) { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }
    else { setSortBy(type); setSortOrder('desc'); }
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
    <div className="relative min-h-screen animate-in slide-in-from-bottom-4 duration-700 pb-6">
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 5px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        .custom-scroll { scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent; }
      `}</style>

      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#001BB7] opacity-10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[#FF8040] opacity-10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 px-4 md:px-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4 pt-4">
            <button onClick={onBack} className="group flex items-center gap-2 text-[#001BB7] font-black hover:opacity-70 transition-all uppercase text-[9px] tracking-widest">
              <div className="bg-white p-1.5 rounded-full shadow-sm border border-slate-100 group-hover:-translate-x-1 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </div>
              Back
            </button>
            <div className="bg-slate-900/5 px-3 py-1 rounded-full border border-slate-900/5">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{user?.role}</span>
            </div>
        </div>

        <div className="bg-white/70 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-xl border border-white mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1 w-full md:w-auto">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-1 bg-[#FF8040] rounded-full" />
                <span className="text-[#001BB7] font-black text-[9px] uppercase tracking-[0.3em]">Workspace</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter mb-3 break-words">{classroom?.name}</h2>
              
              <div className="flex flex-col gap-3">
                {user?.role === 'teacher' ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span className="bg-orange-50 text-[#FF8040] px-4 py-1.5 rounded-xl font-mono font-black text-lg border border-orange-100 shadow-sm">{classroom?.code}</span>
                      <button onClick={handleCopy} className="p-2 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-[#001BB7] transition-all active:scale-90">
                          {copied ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="20 6 9 17 4 12"/></svg> : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>}
                      </button>
                      <button onClick={() => setShowQRModal(true)} className="p-2 bg-[#001BB7] rounded-xl text-white hover:bg-[#0046FF] transition-all flex items-center gap-2 px-3 shadow-lg shadow-blue-200">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v.01"/></svg>
                          <span className="text-[9px] font-black tracking-widest uppercase">QR</span>
                      </button>
                    </div>
                    
                    <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 text-red-300 hover:text-red-500 transition-colors text-[9px] font-black uppercase tracking-widest w-fit group">
                      <div className="p-1 rounded bg-red-50 group-hover:bg-red-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </div>
                      Delete Class
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowLeaveConfirm(true)} className="flex items-center gap-1.5 text-red-300 hover:text-red-500 transition-colors text-[9px] font-black uppercase tracking-widest w-fit group">
                    <div className="p-1 rounded bg-red-50 group-hover:bg-red-100">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    </div>
                    Leave Class
                  </button>
                )}
              </div>
          </div>

          {user?.role === 'teacher' ? (
              <button onClick={onStartSession} className="w-full md:w-auto bg-[#001BB7] text-white px-6 py-4 rounded-2xl font-black shadow-lg hover:bg-[#0046FF] transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-[0.1em] active:scale-95">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5L4.5 5.5c-.3.3-.5.7-.5 1.1V21c0 .6.4 1 1 1h14c.6 0 1-.4 1-1V6.5c0-.4-.2-.8-.5-1.1l-3-3c-.3-.3-.7-.5-1.1-.5z"/><path d="M15 2v4c0 .6.4 1 1 1h4"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9h4"/></svg>
                  Whiteboard Session
              </button>
          ) : (
              <button disabled={!isLive} onClick={onStartSession} className={`w-full md:w-auto px-6 py-4 rounded-2xl font-black shadow-lg transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-[0.1em] ${isLive ? 'bg-[#FF8040] text-white hover:bg-[#e66a2e] animate-pulse active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 opacity-60'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
                  {isLive ? 'Join Session' : 'Offline'}
              </button>
          )}
        </div>

        <div className={`grid grid-cols-1 ${user?.role === 'teacher' ? 'lg:grid-cols-3' : ''} gap-6 mb-6`}>
            {/* Notes Column */}
            <div className={`${user?.role === 'teacher' ? 'lg:col-span-2' : ''} bg-white/60 backdrop-blur-md rounded-3xl border border-white overflow-hidden shadow-lg`}>
                <div className="p-4 md:p-5 border-b border-slate-100 flex flex-row justify-between items-center gap-3 bg-white/40">
                    <h3 className="font-black text-slate-800 uppercase tracking-[0.2em] text-[9px]">Digitized Notes</h3>
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg shrink-0">
                        <button onClick={() => toggleSort('time')} className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all ${sortBy === 'time' ? 'bg-white text-[#001BB7] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Time {sortBy === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}</button>
                        <button onClick={() => toggleSort('name')} className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest transition-all ${sortBy === 'name' ? 'bg-white text-[#001BB7] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}</button>
                    </div>
                </div>
                <div className="p-3 space-y-3 h-[170px] overflow-y-auto custom-scroll">
                    {sortedFiles?.length > 0 ? sortedFiles.map((file, idx) => (
                        <div key={file._id || idx} className="group flex flex-col sm:flex-row justify-between items-center p-3 md:p-4 bg-white/80 border border-slate-100/50 rounded-2xl hover:border-[#001BB7] transition-all duration-300 gap-3">
                            <div className="flex items-center gap-3 overflow-hidden w-full sm:w-auto">
                                <div className="bg-blue-50 p-2 rounded-lg text-[#001BB7] group-hover:bg-[#001BB7] group-hover:text-white transition-all">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </div>
                                <div className="flex flex-col overflow-hidden">
                                    <span className="text-xs font-black truncate text-slate-800">{file.filename}</span>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{formatTimestamp(file.uploadDate || file.createdAt)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                                <a href={`https://smartstroke-api.onrender.com/${file.path}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[8px] font-black hover:bg-[#001BB7] transition-all tracking-[0.1em]">VIEW</a>
                                <button onClick={() => handleDownload(file)} className="p-1.5 bg-blue-50 text-[#001BB7] rounded-lg hover:bg-[#001BB7] hover:text-white transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
                                {user?.role === 'teacher' && (
                                    <button onClick={() => setFileToDelete(file)} className="p-1.5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
                                )}
                            </div>
                        </div>
                    )) : <p className="text-center text-slate-300 py-10 text-[10px] font-black uppercase tracking-widest">No archives.</p>}
                </div>
            </div>

            {/* Students Column */}
            {user?.role === 'teacher' && (
                <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white overflow-hidden shadow-lg flex flex-col">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white/40">
                        <h3 className="font-black text-slate-800 uppercase tracking-[0.2em] text-[9px]">Students</h3>
                        <span className="text-[9px] font-black text-slate-400">{students?.length || 0}</span>
                    </div>
                    <div className="p-4 space-y-2 h-[300px] overflow-y-auto custom-scroll flex-1">
                        {students.map((s) => {
                            const avatar = s.profilePicture ? (s.profilePicture.startsWith('http') ? s.profilePicture : `https://smartstroke-api.onrender.com/${s.profilePicture}`) : null;
                            return (
                                <div key={s._id} className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-slate-100/50 group hover:bg-white transition-all">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-6 h-6 rounded-lg bg-slate-900 flex items-center justify-center text-[9px] font-black text-white shrink-0 overflow-hidden shadow-sm">
                                            {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="S" /> : (s.firstName ? s.firstName.charAt(0) : '?').toUpperCase()}
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-[10px] font-black text-slate-800 truncate uppercase">{s.firstName} {s.surname}</span>
                                            <span className="text-[8px] font-bold text-slate-400 truncate tracking-tight">{s.username}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveStudent(s._id)} className="p-1 text-slate-300 hover:text-red-500 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Confirmation Modals */}
      {[showLeaveConfirm, showDeleteConfirm, fileToDelete].some(Boolean) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isProcessing && (setShowLeaveConfirm(false) || setShowDeleteConfirm(false) || setFileToDelete(null))} />
          <div className="relative bg-white p-6 md:p-8 rounded-[32px] shadow-2xl w-full max-w-sm text-center border border-white animate-in zoom-in-95">
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{showLeaveConfirm ? "Leave Class?" : showDeleteConfirm ? "Delete Class?" : "Delete Note?"}</h3>
              <p className="text-slate-500 text-xs mb-8 leading-relaxed font-medium">{showLeaveConfirm ? "You will lose archive access." : showDeleteConfirm ? "This is permanent." : "This note will be gone forever."}</p>
              <div className="flex flex-col gap-2">
                  <button disabled={isProcessing} onClick={showLeaveConfirm ? handleConfirmLeave : showDeleteConfirm ? handleConfirmDelete : handleConfirmDeleteFile} className="w-full bg-red-500 text-white py-4 rounded-xl font-black shadow-lg hover:bg-red-600 transition-all uppercase text-[10px] tracking-widest">
                      {isProcessing ? "Processing..." : "Confirm"}
                  </button>
                  <button disabled={isProcessing} onClick={() => { setShowLeaveConfirm(false); setShowDeleteConfirm(false); setFileToDelete(null); }} className="w-full bg-slate-50 text-slate-400 py-4 rounded-xl font-black hover:bg-slate-100 transition-all uppercase text-[10px] tracking-widest">Cancel</button>
              </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowQRModal(false)} />
            <div className="relative bg-white p-6 md:p-8 rounded-[32px] shadow-2xl w-full max-w-xs text-center border border-white animate-in zoom-in-95">
                <button onClick={() => setShowQRModal(false)} className="absolute right-4 top-4 text-slate-300 hover:text-slate-900 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
                <h3 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-tight">Access QR</h3>
                <div ref={qrRef} className="bg-slate-50 p-4 rounded-2xl inline-block mb-6 shadow-inner">
                    <QRCodeCanvas value={`${window.location.origin}/login?joinCode=${classroom.code}`} size={140} level={"H"} />
                </div>
                <button onClick={downloadQR} className="w-full bg-[#001BB7] text-white py-4 rounded-xl font-black shadow-lg hover:bg-[#0046FF] transition-all uppercase text-[10px] tracking-widest">Save Image</button>
            </div>
        </div>
      )}
    </div>
  );
}