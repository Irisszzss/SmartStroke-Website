import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const AdminPage = ({ triggerToast }) => {
    const [pendingTeachers, setPendingTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingEmail, setProcessingEmail] = useState(null);
    
    // New state for the checkbox
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
            ? `Approve ${email}? They will get access immediately.`
            : `Decline ${email}? This will delete their request.`;
        
        // Reset checkbox whenever a new modal opens
        setIsConfirmed(false);
        setConfirmModal({ show: true, email, action, message });
    };

    const handleAction = async () => {
        if (!isConfirmed) return; // Guard clause
        
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
        <div className="max-w-5xl mx-auto w-full px-4 py-12 font-['Poppins']">
            
            {/* Confirmation Modal with Checkbox */}
            {confirmModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmModal({ ...confirmModal, show: false })} />
                    <div className="relative bg-white p-8 rounded-[32px] shadow-2xl w-full max-w-sm text-center animate-in zoom-in-95">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${confirmModal.action === 'approve' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                            {confirmModal.action === 'approve' ? '✓' : '✕'}
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">Are you sure?</h3>
                        <p className="text-slate-500 text-sm mb-6 font-medium">{confirmModal.message}</p>
                        
                        {/* THE MISSING CHECKBOX */}
                        <div className="flex items-center justify-center gap-3 mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100 cursor-pointer" onClick={() => setIsConfirmed(!isConfirmed)}>
                            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${isConfirmed ? 'bg-[#001BB7] border-[#001BB7]' : 'bg-white border-slate-300'}`}>
                                {isConfirmed && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">I understand this action</span>
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={handleAction} 
                                disabled={!isConfirmed}
                                className={`w-full py-4 rounded-2xl font-black text-white text-xs tracking-widest uppercase shadow-lg transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed ${confirmModal.action === 'approve' ? 'bg-[#001BB7]' : 'bg-red-500'}`}
                            >
                                Yes, Confirm
                            </button>
                            <button onClick={() => setConfirmModal({ ...confirmModal, show: false })} className="w-full py-4 rounded-2xl font-black text-slate-400 text-xs tracking-widest uppercase hover:text-slate-600 transition-colors">
                                No, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">Teacher <span className="text-[#001BB7]">Requests</span></h1>
                    <p className="text-[#FF8040] font-black text-[10px] uppercase tracking-[0.3em]">SmartStroke Admin Panel</p>
                </div>
                <div className="bg-[#FF8040] text-white px-5 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase shadow-md">
                    {pendingTeachers.length} Requests
                </div>
            </div>

            {/* List Container */}
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-20 text-center">
                        <div className="w-10 h-10 border-4 border-[#001BB7] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Loading Records...</p>
                    </div>
                ) : pendingTeachers.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="text-emerald-500 text-4xl mb-4">✓</div>
                        <h3 className="text-slate-800 font-black uppercase tracking-tight">All Caught Up!</h3>
                        <p className="text-slate-400 text-sm">No new requests to review.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {pendingTeachers.map((teacher) => (
                                    <tr key={teacher.email} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <p className="font-black text-slate-800 text-sm uppercase">{teacher.firstName} {teacher.surname}</p>
                                            <span className="text-[9px] font-bold text-[#001BB7] tracking-tighter">@{teacher.username}</span>
                                        </td>
                                        <td className="px-8 py-6 text-sm text-slate-500 font-medium">
                                            {teacher.email}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    disabled={processingEmail === teacher.email}
                                                    onClick={() => openConfirmModal(teacher.email, 'approve')}
                                                    className="bg-[#001BB7] text-white px-4 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase hover:bg-blue-700 transition-all disabled:opacity-30"
                                                >
                                                    Approve
                                                </button>
                                                <button 
                                                    disabled={processingEmail === teacher.email}
                                                    onClick={() => openConfirmModal(teacher.email, 'decline')}
                                                    className="bg-white border border-slate-200 text-slate-400 px-4 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase hover:border-red-500 hover:text-red-500 transition-all disabled:opacity-30"
                                                >
                                                    Decline
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