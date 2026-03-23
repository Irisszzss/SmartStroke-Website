import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const AdminPage = ({ triggerToast }) => {
    const [pendingTeachers, setPendingTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingEmail, setProcessingEmail] = useState(null);
    const [isConfirmed, setIsConfirmed] = useState(false);

    const [confirmModal, setConfirmModal] = useState({ 
        show: false, 
        email: '', 
        action: '', 
        message: '' 
    });

    const fetchPending = async () => {
        setLoading(true);
        try {
            const response = await api.getPendingTeachers();
            setPendingTeachers(response.data || []);
        } catch (error) {
            triggerToast("Unable to connect to services.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const openConfirmModal = (email, action) => {
        const message = action === 'approve' 
            ? `Approve ${email}?`
            : `Decline ${email}?`;
        
        setIsConfirmed(false);
        setConfirmModal({ show: true, email, action, message });
    };

    const handleAction = async () => {
        if (!isConfirmed) return;
        
        const { email, action } = confirmModal;
        setConfirmModal(prev => ({ ...prev, show: false })); 
        setProcessingEmail(email);
        
        try {
            const response = await (action === 'approve' 
                ? api.approveTeacher(email)
                : api.declineTeacher(email));

            if (response.data.success) {
                triggerToast(response.data.message || "Done!", "success");
                await fetchPending(); 
            } else {
                triggerToast(response.data.error || "Failed", "error");
            }
        } catch (error) {
            triggerToast("An error occurred.", "error");
            fetchPending();
        } finally {
            setProcessingEmail(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto w-full px-4 py-6 font-['Poppins']">
            <style>{`
                .custom-scroll::-webkit-scrollbar { width: 5px; }
                .custom-scroll::-webkit-scrollbar-track { background: transparent; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scroll { scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent; }
            `}</style>
            
            {/* Confirmation Modal */}
            {confirmModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmModal({ ...confirmModal, show: false })} />
                    <div className="relative bg-white p-6 rounded-3xl shadow-2xl w-full max-w-xs text-center animate-in zoom-in-95">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${confirmModal.action === 'approve' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                            {confirmModal.action === 'approve' ? '✓' : '✕'}
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-1 uppercase tracking-tight">Confirm</h3>
                        <p className="text-slate-500 text-xs mb-6 font-medium">{confirmModal.message}</p>
                        
                        <div className="flex items-center justify-center gap-2 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100 cursor-pointer" onClick={() => setIsConfirmed(!isConfirmed)}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center border-2 transition-all ${isConfirmed ? 'bg-[#001BB7] border-[#001BB7]' : 'bg-white border-slate-300'}`}>
                                {isConfirmed && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">I understand</span>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button 
                                onClick={handleAction} 
                                disabled={!isConfirmed}
                                className={`w-full py-3 rounded-xl font-black text-white text-[10px] tracking-widest uppercase shadow-md transition-all disabled:opacity-30 ${confirmModal.action === 'approve' ? 'bg-[#001BB7]' : 'bg-red-500'}`}
                            >
                                Confirm
                            </button>
                            <button onClick={() => setConfirmModal({ ...confirmModal, show: false })} className="w-full py-3 rounded-xl font-black text-slate-400 text-[10px] tracking-widest uppercase hover:text-slate-600">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-6 flex items-end justify-between border-b border-slate-100 pb-4">
                <div>
                    <p className="text-[#FF8040] font-black text-[8px] uppercase tracking-[0.4em] mb-1">Administrator Control</p>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Teacher <span className="text-[#001BB7]">Requests</span></h1>
                </div>
                <div className="bg-[#001BB7] text-white px-3 py-1.5 rounded-lg text-[9px] font-black tracking-widest uppercase shadow-sm">
                    {pendingTeachers.length} Pending
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-slate-50 overflow-hidden relative">
                <div className="bg-slate-50/50 px-6 py-3 border-b border-slate-100 flex justify-between">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Applicant Details</span>
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Manage</span>
                </div>
                
                <div className="h-[330px] overflow-y-auto custom-scroll">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center p-10">
                            <div className="w-8 h-8 border-3 border-[#001BB7] border-t-transparent rounded-full animate-spin mb-3" />
                            <p className="text-slate-400 font-black text-[9px] uppercase tracking-widest">Loading...</p>
                        </div>
                    ) : pendingTeachers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-xl mb-3">✓</div>
                            <h3 className="text-slate-800 font-black text-xs uppercase tracking-tight">Queue Clear</h3>
                            <p className="text-slate-400 text-[10px] uppercase font-bold mt-1">No new requests</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {pendingTeachers.map((teacher) => (
                                <div key={teacher.email} className="px-6 py-3 hover:bg-slate-50/50 transition-all flex items-center justify-between group">
                                    <div className="flex flex-col gap-0.5 max-w-[60%]">
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-slate-800 text-xs uppercase truncate">{teacher.firstName} {teacher.surname}</p>
                                            <span className="text-[8px] font-black bg-blue-50 text-[#001BB7] px-1.5 py-0.5 rounded uppercase">@{teacher.username}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium truncate">{teacher.email}</p>
                                    </div>
                                    
                                    <div className="flex gap-1.5 shrink-0">
                                        <button 
                                            disabled={processingEmail === teacher.email}
                                            onClick={() => openConfirmModal(teacher.email, 'approve')}
                                            className="bg-[#001BB7] text-white px-3 py-1.5 rounded-lg text-[8px] font-black tracking-widest uppercase hover:bg-blue-700 transition-all disabled:opacity-30"
                                        >
                                            Approve
                                        </button>
                                        <button 
                                            disabled={processingEmail === teacher.email}
                                            onClick={() => openConfirmModal(teacher.email, 'decline')}
                                            className="bg-white border border-slate-200 text-slate-400 px-3 py-1.5 rounded-lg text-[8px] font-black tracking-widest uppercase hover:border-red-500 hover:text-red-500 transition-all disabled:opacity-30"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            <p className="mt-4 text-center text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">
                Secure Administrative Access • SmartStroke Website
            </p>
        </div>
    );
};

export default AdminPage;