import React, { useEffect, useState, useRef } from 'react';
import { jsPDF } from "jspdf";
import { api } from '../utils/api';

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

const BOARD_WIDTH = 2440;
const BOARD_HEIGHT = 1170;

export default function SmartStrokeDashboard({ classId, onSaveSuccess, role = 'teacher', socket }) {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const mainRef = useRef(null); 
  const [data, setData] = useState({ r: 1, i: 0, j: 0, k: 0, down: false, p: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const isStudent = role === 'student';

  const [cvPos, setCvPos] = useState({ x: BOARD_WIDTH / 2, y: BOARD_HEIGHT / 2 });
  const [selectedColor, setSelectedColor] = useState('#1e3a8a');
  const COLORS = ['#1e3a8a', '#f97316', '#ef4444', '#22c55e', '#000000'];

  const [pages, setPages] = useState([[]]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [fileName, setFileName] = useState(`Notes_${new Date().toLocaleDateString().replace(/\//g, '-')}`);
  const [isSaving, setIsSaving] = useState(false); 
  const pdfInstance = useRef(null);

  const bleDevice = useRef(null);
  const currentStrokePoints = useRef([]);
  const centerPos = useRef(null);
  const prevCoords = useRef(null);
  const lastNpSignal = useRef(0);

  const SMOOTHING = 0.4;
  const THEME_NAVY = '#1e3a8a';

  const [zoomScale, setZoomScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const lastTouchDistance = useRef(null);

  useEffect(() => {
    if (!socket) return;
    const handleReceiveCVPos = (pos) => { if (!isStudent) setCvPos({ x: pos.x, y: pos.y }); };

    const handleReceiveStroke = (s) => {
      if (!isStudent || s.pageIndex !== currentPageIndex) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = s.color;
      ctx.moveTo(s.prevX, s.prevY);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    };

    const handleReceiveAction = (act) => {
      if (act.action === 'clear') {
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
        setPages(prev => {
          const newPages = [...prev];
          newPages[act.pageIndex] = [];
          return newPages;
        });
      } else if (act.action === 'newPage') {
        setPages(prev => [...prev, []]);
        setCurrentPageIndex(act.pageIndex);
      } else if (act.action === 'sessionEnded') {
        onSaveSuccess?.(null); 
      }
    };
    
    socket.on('receive-cv-pos', handleReceiveCVPos);
    socket.on('receive-stroke', handleReceiveStroke);
    socket.on('receive-action', handleReceiveAction);
    if (!isStudent) socket.emit('request-camera-sync', classId);

    return () => {
      socket.off('receive-cv-pos');
      socket.off('receive-stroke');
      socket.off('receive-action');
    };
  }, [isStudent, socket, currentPageIndex, classId]);

  const handleRecenter = () => {
    const { yaw, pitch } = getYawPitch(data.r, data.i, data.j, data.k);
    centerPos.current = { yaw, pitch };
    triggerToast("Cursor Recentered");
  };

  const createNewPage = () => {
    if(isStudent) return;
    const newIdx = pages.length;
    setPages(prev => [...prev, []]);
    setCurrentPageIndex(newIdx);
    socket?.emit('transmit-action', { classId, action: 'newPage', pageIndex: newIdx });
  };

  const clearCurrentPage = () => {
    if(isStudent) return;
    setPages(prev => {
      const newPages = [...prev];
      newPages[currentPageIndex] = [];
      return newPages;
    });
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    socket?.emit('transmit-action', { classId, action: 'clear', pageIndex: currentPageIndex });
  };

  useEffect(() => {
    const handleResize = () => {
      if (!mainRef.current) return;
      setBaseScale(Math.min((mainRef.current.clientWidth - 170) / BOARD_WIDTH, (mainRef.current.clientHeight - 170) / BOARD_HEIGHT));
    };
    const observer = new ResizeObserver(handleResize);
    if (mainRef.current) observer.observe(mainRef.current);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => { window.removeEventListener('resize', handleResize); observer.disconnect(); };
  }, [isStudent]);

  useEffect(() => {
    const mainElement = mainRef.current;
    const handleWheelNonPassive = (e) => {
      e.preventDefault();
      setZoomScale(prev => Math.min(Math.max(prev * (e.deltaY > 0 ? 0.9 : 1.1), 0.2), 10));
    };
    mainElement?.addEventListener('wheel', handleWheelNonPassive, { passive: false });
    return () => mainElement?.removeEventListener('wheel', handleWheelNonPassive);
  }, []);

  const getYawPitch = (r, i, j, k) => {
    const sinp = 2 * (r * j - k * i);
    const pitch = Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI) / 2 : Math.asin(sinp);
    const yaw = Math.atan2(2 * (r * k + i * j), 1 - 2 * (j * j + k * k));
    return { yaw, pitch };
  };

  useEffect(() => {
    if (!canvasRef.current || !isConnected || isStudent) return;
    const ctx = canvasRef.current.getContext('2d');
    const cCtx = cursorRef.current.getContext('2d');
    
    const { yaw, pitch } = getYawPitch(data.r, data.i, data.j, data.k);
    if (centerPos.current === null) { centerPos.current = { yaw, pitch }; return; }
    
    // --- DYNAMIC SENSITIVITY CALCULATION ---
    // Bases sensitivity on tilt (j) to maintain precision at angles
    const dynamicSens = 250 + (Math.abs(data.j) * 150);
    
    const targetX = cvPos.x - (yaw - centerPos.current.yaw) * dynamicSens;
    const targetY = cvPos.y - (pitch - centerPos.current.pitch) * dynamicSens;
    
    let x = prevCoords.current ? prevCoords.current.x + (targetX - prevCoords.current.x) * SMOOTHING : targetX;
    let y = prevCoords.current ? prevCoords.current.y + (targetY - prevCoords.current.y) * SMOOTHING : targetY;
    
    x = Math.max(0, Math.min(x, BOARD_WIDTH)); 
    y = Math.max(0, Math.min(y, BOARD_HEIGHT));

    if (data.down) {
      currentStrokePoints.current.push({ x, y });
      if (prevCoords.current) {
        ctx.beginPath(); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = selectedColor;
        ctx.moveTo(prevCoords.current.x, prevCoords.current.y); ctx.lineTo(x, y); ctx.stroke();
        socket?.emit('transmit-stroke', { classId, x, y, prevX: prevCoords.current.x, prevY: prevCoords.current.y, color: selectedColor, pageIndex: currentPageIndex });
      }
      prevCoords.current = { x, y };
    } else {
      if (currentStrokePoints.current.length > 0) {
        const strokeEntry = { points: [...currentStrokePoints.current], color: selectedColor };
        setPages(prev => {
          const newPages = [...prev];
          newPages[currentPageIndex] = [...(newPages[currentPageIndex] || []), strokeEntry];
          return newPages;
        });
        currentStrokePoints.current = [];
      }
      prevCoords.current = null;
    }
    cCtx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    cCtx.beginPath(); cCtx.arc(x, y, 6, 0, Math.PI * 2);
    cCtx.fillStyle = data.down ? selectedColor : '#f97316';
    cCtx.fill(); cCtx.strokeStyle = 'white'; cCtx.lineWidth = 2; cCtx.stroke();
  }, [data, cvPos, selectedColor, isConnected, isStudent, classId, socket, currentPageIndex]);

  useEffect(() => {
    if (!isStudent && socket) {
      socket.emit('start-stream', classId);
      return () => { 
        socket.emit('transmit-action', { classId, action: 'sessionEnded' });
        socket.emit('stop-stream', classId); 
      };
    }
  }, [isStudent, socket, classId]);

  const handleMouseDown = (e) => { if (e.button < 2 || e.shiftKey) { setIsPanning(true); setLastMousePos({ x: e.clientX, y: e.clientY }); } };
  const handleMouseMove = (e) => { if (!isPanning) return; setOffset(prev => ({ x: prev.x + (e.clientX - lastMousePos.x), y: prev.y + (e.clientY - lastMousePos.y) })); setLastMousePos({ x: e.clientX, y: e.clientY }); };
  const handleTouchStart = (e) => { if (e.touches.length === 1) { setIsPanning(true); setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY }); } else if (e.touches.length === 2) { lastTouchDistance.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); } };
  const handleTouchMove = (e) => { if (e.touches.length === 1 && isPanning) { setOffset(prev => ({ x: prev.x + (e.touches[0].clientX - lastMousePos.x), y: prev.y + (e.touches[0].clientY - lastMousePos.y) })); setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY }); } else if (e.touches.length === 2) { const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (lastTouchDistance.current) setZoomScale(prev => Math.min(Math.max(prev * (dist / lastTouchDistance.current), 0.2), 10)); lastTouchDistance.current = dist; } };
  const handleEnd = () => { setIsPanning(false); lastTouchDistance.current = null; };
  const triggerToast = (msg) => { setToast({ show: true, message: msg }); setTimeout(() => setToast({ show: false, message: '' }), 3000); };

  const renderStrokesToCtx = (ctx, strokesList) => {
    if (!ctx || !Array.isArray(strokesList)) return;
    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 4;
    strokesList.forEach(s => {
      const p = s.points || [];
      if (p.length >= 2) {
        ctx.beginPath(); ctx.strokeStyle = s.color || THEME_NAVY; ctx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
        ctx.stroke();
      }
    });
  };

  useEffect(() => {
    if (canvasRef.current && pages[currentPageIndex]) renderStrokesToCtx(canvasRef.current.getContext('2d'), pages[currentPageIndex]);
  }, [currentPageIndex, pages]);

  const generatePreview = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [BOARD_WIDTH, BOARD_HEIGHT] });
    const offCanvas = document.createElement('canvas');
    offCanvas.width = BOARD_WIDTH; offCanvas.height = BOARD_HEIGHT;
    const offCtx = offCanvas.getContext('2d');
    pages.forEach((pageStrokes, index) => {
      offCtx.fillStyle = "#ffffff";
      offCtx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      renderStrokesToCtx(offCtx, pageStrokes);
      const imgData = offCanvas.toDataURL("image/jpeg", 0.95);
      if (index > 0) pdf.addPage([BOARD_WIDTH, BOARD_HEIGHT], "landscape");
      pdf.addImage(imgData, "JPEG", 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    });
    setPdfBlobUrl(URL.createObjectURL(pdf.output('blob')));
    pdfInstance.current = pdf;
    setShowPreview(true);
  };

  const finalizeDownload = async () => {
    if (!pdfInstance.current || !classId) return;
    setIsSaving(true);
    try {
      const file = new File([pdfInstance.current.output('blob')], `${fileName || 'SmartStroke'}.pdf`, { type: 'application/pdf' });
      const res = await api.uploadFile(classId, file); 
      if (res.data.message === "Success") { onSaveSuccess?.(res.data.file); setShowPreview(false); URL.revokeObjectURL(pdfBlobUrl); }
    } catch (err) { triggerToast("Failed to save PDF"); } finally { setIsSaving(false); }
  };

  const connectBLE = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({ filters: [{ name: 'SmartStrokes-Pen' }], optionalServices: [SERVICE_UUID] });
      const server = await device.gatt.connect();
      const characteristic = await (await server.getPrimaryService(SERVICE_UUID)).getCharacteristic(CHARACTERISTIC_UUID);
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (e) => {
        try {
          const p = JSON.parse(new TextDecoder().decode(e.target.value));
          if (p.pdf === 1) generatePreview(); else if (p.np === 1 && lastNpSignal.current === 0) createNewPage();
          lastNpSignal.current = p.np || 0;
          setData({ ...p, down: p.d === 1 || p.d === true });
        } catch {}
      });
      setIsConnected(true); triggerToast("Pen Connected");
      bleDevice.current = device;
    } catch { triggerToast("Connection failed"); }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-slate-100 overflow-hidden font-['Poppins'] select-none">
      {!isStudent && (
        <aside className="w-full lg:w-[240px] bg-white p-3 lg:p-5 flex flex-row lg:flex-col border-b lg:border-r border-slate-200 z-50 overflow-x-auto lg:overflow-y-auto no-scrollbar gap-4 lg:gap-0 shrink-0">
          <div className="hidden lg:block text-xl font-extrabold tracking-tighter text-center mb-4 shrink-0"><span className="text-blue-900">Smart</span><span className="text-orange-500">Stroke</span></div>
          <div className="hidden lg:block h-px bg-slate-100 my-3" />
          <div className="flex lg:flex-col gap-2 shrink-0">
            {!isConnected ? ( <button onClick={connectBLE} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-orange-500 text-white font-bold cursor-pointer text-xs lg:text-sm">Connect Pen</button> ) : (
              <><button onClick={() => { bleDevice.current?.gatt.disconnect(); setIsConnected(false); }} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 font-bold cursor-pointer text-xs lg:text-sm">Disconnect</button><button onClick={handleRecenter} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-blue-100 text-blue-700 font-bold cursor-pointer text-xs lg:text-sm">Recenter</button></>
            )}
            <div className="flex lg:flex-col items-center gap-2"><div className="flex gap-2 justify-center">{COLORS.map(color => (<div key={color} onClick={() => setSelectedColor(color)} className="w-6 h-6 lg:w-5 lg:h-5 rounded-full cursor-pointer transition-transform shrink-0" style={{ backgroundColor: color, outline: selectedColor === color ? `2px solid #1e3a8a` : 'none', outlineOffset: '2px' }} />))}</div></div>
          </div>
          <div className="hidden lg:block h-px bg-slate-100 my-3" />
          <div className="flex items-center lg:justify-between gap-2 shrink-0">
            <button disabled={currentPageIndex === 0} onClick={() => setCurrentPageIndex(p => p - 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white font-bold disabled:opacity-30">←</button>
            <span className="whitespace-nowrap text-[10px] lg:text-xs font-bold text-slate-700">Pg. {currentPageIndex + 1}/{pages.length}</span>
            <button disabled={currentPageIndex === pages.length - 1} onClick={() => setCurrentPageIndex(p => p + 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white font-bold disabled:opacity-30">→</button>
          </div>
          <div className="flex lg:flex-col gap-2 mt-0 md:mt-2 shrink-0"><button onClick={createNewPage} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-blue-50 text-blue-900 font-bold text-xs lg:text-sm">+ Page</button><button onClick={clearCurrentPage} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-red-100 text-red-700 font-bold text-xs lg:text-sm">Clear</button><button onClick={generatePreview} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-blue-900 text-white font-bold text-xs lg:text-sm">Export</button></div>
          <div className="hidden lg:block h-px bg-slate-100 my-3" />
          <div className="hidden lg:flex flex-col gap-3">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="text-[8px] font-extrabold text-slate-400 mb-1.5 uppercase">Pressure</div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-100 ease-out" style={{ width: `${(data.p / 4095) * 100}%`, backgroundColor: selectedColor }} />
              </div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="text-[8px] font-extrabold text-slate-400 mb-1.5 uppercase">Tilt</div>
              <div className="h-16 flex items-center justify-center [perspective:200px]">
                <div className="w-8 h-8 rounded-lg shadow-md transition-transform duration-100" style={{ backgroundColor: selectedColor, transform: `rotateX(${data.j * 90}deg) rotateY(${data.i * 90}deg)`, transformStyle: 'preserve-3d' }} />
              </div>
            </div>
          </div>
        </aside>
      )}
      <main ref={mainRef} className={`flex-1 relative overflow-hidden bg-slate-200 p-2 md:p-4 touch-none ${isStudent ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleEnd} onMouseLeave={handleEnd} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleEnd}>
        <div className="absolute origin-center transition-transform duration-75 ease-out" style={{ left: '50%', top: '50%', width: '2440px', height: '1170px', transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${baseScale * zoomScale})`, flexShrink: 0 }}>
          <div className="relative w-full h-full rounded-lg shadow-2xl border-[12px] border-blue-900 bg-white">
            <canvas ref={canvasRef} width={2440} height={1170} className="absolute top-0 left-0" />
            {!isStudent && <canvas ref={cursorRef} width={2440} height={1170} className="absolute top-0 left-0 pointer-events-none" />}
          </div>
        </div>
      </main>
      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-[24px] w-full max-w-[1100px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <header className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center"><div><h2 className="text-lg md:text-2xl font-extrabold text-blue-900">Export Document</h2></div><button className="text-2xl md:text-3xl text-slate-400" onClick={() => { setShowPreview(false); URL.revokeObjectURL(pdfBlobUrl); }}>×</button></header>
            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden p-4 md:p-6 gap-4">
              <iframe src={pdfBlobUrl} className="flex-1 min-h-[300px] border-none rounded-lg bg-white" title="PDF Preview" />
              {!isStudent && (
                <div className="w-full md:w-[300px] flex flex-col gap-4 md:gap-6">
                   <div className="flex flex-col gap-2"><label className="text-xs md:text-sm font-bold text-slate-600">File Name</label><div className="flex items-center bg-slate-100 rounded-xl px-3"><input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="flex-1 border-none bg-transparent py-2 md:py-2.5 text-xs md:text-sm outline-none" /><span className="text-xs md:text-sm text-slate-400 font-semibold">.pdf</span></div></div>
                   <div className="mt-auto flex gap-2 md:flex-col"><button onClick={() => { setShowPreview(false); URL.revokeObjectURL(pdfBlobUrl); }} className="flex-1 p-2.5 md:p-3.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs md:text-sm">Discard</button><button disabled={isSaving} onClick={finalizeDownload} className="flex-[2] md:flex-none p-3 md:p-4 rounded-xl bg-blue-900 text-white font-bold text-xs md:text-sm disabled:opacity-50">{isSaving ? "Saving..." : "Save & Sync"}</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}