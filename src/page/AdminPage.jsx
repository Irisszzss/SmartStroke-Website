import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const AdminPage = ({ triggerToast }) => {
    const [pendingTeachers, setPendingTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingEmail, setProcessingEmail] = useState(null);

    // Modal State
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
            console.error("Error fetching teachers:", error);
            triggerToast("Unable to connect to administrative services.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const openConfirmModal = (email, action) => {
        const message = action === 'approve' 
            ? `Are you sure you want to approve ${email}? They will receive an automated access notification.`
            : `Are you sure you want to decline ${email}? This will permanently remove their registration data.`;
        
        setConfirmModal({ show: true, email, action, message });
    };

    const handleAction = async () => {
        const { email, action } = confirmModal;
        setConfirmModal(prev => ({ ...prev, show: false })); 
        setProcessingEmail(email);
        
        try {
            const response = await (action === 'approve' 
                ? api.approveTeacher(email)
                : api.declineTeacher(email));

            // If the backend returns success: true
            if (response.data.success) {
                triggerToast(response.data.message || "Action successful", "success");
                // This is what removes the user from the list:
                await fetchPending(); 
            } else {
                triggerToast(response.data.error || "Request failed", "error");
            }
        } catch (error) {
            console.error("Full Error Object:", error);
            
            // CHECK THIS: If the email failed but the user WAS approved in the DB,
            // you might still want to refresh the list.
            const errorMessage = error.response?.data?.error || "Internal Server Error occurred.";
            triggerToast(errorMessage, "error");
            
            // Refresh anyway so the UI matches the Database
            fetchPending();
        } finally {
            setProcessingEmail(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto w-full px-4 md:px-0 animate-in fade-in duration-500 relative">
            
            {/* Confirmation Modal */}
            {confirmModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setConfirmModal({ ...confirmModal, show: false })} />
                    <div className="relative bg-white p-8 md:p-10 rounded-[32px] md:rounded-[48px] shadow-2xl w-full max-w-md text-center border border-white animate-in zoom-in-95">
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ${confirmModal.action === 'approve' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                            {confirmModal.action === 'approve' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            )}
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Confirm {confirmModal.action}</h3>
                        <p className="text-slate-500 text-sm mb-10 leading-relaxed font-medium italic">"{confirmModal.message}"</p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleAction}
                                className={`w-full text-white py-5 rounded-[24px] font-black shadow-xl transition-all active:scale-95 uppercase text-xs tracking-widest ${confirmModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}
                            >
                                Confirm Action
                            </button>
                            <button 
                                onClick={() => setConfirmModal({ ...confirmModal, show: false })}
                                className="w-full bg-slate-50 text-slate-400 py-5 rounded-[24px] font-black hover:bg-slate-100 transition-all uppercase text-xs tracking-widest"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="mb-8 mt-6">
                <div className="flex flex-wrap items-center gap-4 mb-2">
                        <span className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg">
                            {pendingTeachers.length} PENDING
                        </span>
                </div>
            </div>

            {/* Main Card */}
            <div className="bg-white rounded-[2rem] border-4 border-[#001BB7]/5 shadow-2xl shadow-blue-900/5 overflow-hidden">
                {loading ? (
                    <div className="p-20 text-center">
                        <div className="w-12 h-12 border-4 border-[#001BB7] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-400 font-black text-xs tracking-widest uppercase">Synchronizing Records...</p>
                    </div>
                ) : pendingTeachers.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-slate-800 font-black text-lg mb-1 uppercase tracking-tight">Queue is Clear</h3>
                        <p className="text-slate-400 text-sm">No pending registration requests found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-y-hidden">
                        <table className="w-full border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-[#001BB7]/5 text-[#001BB7]">
                                    <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.2em]">Educator</th>
                                    <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.2em]">Email Address</th>
                                    <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.2em]">Username</th>
                                    <th className="px-8 py-5 text-right text-[11px] font-black uppercase tracking-[0.2em]">Authorization</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pendingTeachers.map((teacher) => (
                                    <tr key={teacher.email} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <p className="font-black text-slate-800 uppercase text-xs">{teacher.firstName} {teacher.surname}</p>
                                            <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-black uppercase tracking-widest">Pending</span>
                                        </td>
                                        <td className="px-8 py-6">
                                            <p className="text-sm font-bold text-slate-600">{teacher.email}</p>
                                        </td>
                                        <td className="px-8 py-6">
                                            <code className="text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-500 font-bold tracking-tight">@{teacher.username}</code>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    disabled={processingEmail === teacher.email}
                                                    onClick={() => openConfirmModal(teacher.email, 'approve')}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    APPROVE
                                                </button>
                                                <button 
                                                    disabled={processingEmail === teacher.email}
                                                    onClick={() => openConfirmModal(teacher.email, 'decline')}
                                                    className="bg-white border-2 border-slate-200 hover:border-red-500 hover:text-red-500 text-slate-500 px-5 py-2.5 rounded-xl text-[10px] font-black tracking-widest transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    DECLINE
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
