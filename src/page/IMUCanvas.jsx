import React, { useEffect, useState, useRef } from 'react';
import { jsPDF } from "jspdf";
import { api } from '../utils/api';

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

export default function SmartStrokeDashboard({ classId, onSaveSuccess }) {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);
  const mainRef = useRef(null); 
  const [data, setData] = useState({ r: 1, i: 0, j: 0, k: 0, down: false, p: 0 });
  const [isConnected, setIsConnected] = useState(false);

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

  const SENSITIVITY = 1800;
  const SMOOTHING = 0.4;
  const THEME_NAVY = '#1e3a8a';

  // --- ZOOM & PAN STATE ---
  const [zoomScale, setZoomScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [baseScale, setBaseScale] = useState(1);
  const lastTouchDistance = useRef(null);

  // --- RECENTER LOGIC ---
  const handleRecenter = () => {
    const { yaw, pitch } = getYawPitch(data.r, data.i, data.j, data.k);
    centerPos.current = { yaw, pitch };
    triggerToast("Cursor Recentered");
  };

  // --- RESPONSIVE LOGIC (ENABLED FOR ALL) ---
  useEffect(() => {
    const handleResize = () => {
      const isCompact = window.innerWidth < 1024;
      const occupiedWidth = isCompact ? 40 : 280; 
      const occupiedHeight = isCompact ? 180 : 80; 

      const availableWidth = window.innerWidth - occupiedWidth;
      const availableHeight = window.innerHeight - occupiedHeight; 
      
      const scaleW = availableWidth / 1400;
      const scaleH = availableHeight / 700; 
      
      setBaseScale(Math.min(scaleW, scaleH, 1.2)); 
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- WHEEL ZOOM (FOR ALL SCREENS) ---
  useEffect(() => {
    const mainElement = mainRef.current;
    const handleWheelNonPassive = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoomScale(prev => Math.min(Math.max(prev * delta, 0.2), 10));
    };
    if (mainElement) {
      mainElement.addEventListener('wheel', handleWheelNonPassive, { passive: false });
    }
    return () => {
      if (mainElement) mainElement.removeEventListener('wheel', handleWheelNonPassive);
    };
  }, []);

  // --- MOUSE HANDLERS ---
  const handleMouseDown = (e) => {
    if (e.button === 0 || e.button === 1 || e.shiftKey) { 
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  // --- TOUCH HANDLERS ---
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsPanning(true);
      setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = distance;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isPanning) {
      const dx = e.touches[0].clientX - lastMousePos.x;
      const dy = e.touches[0].clientY - lastMousePos.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDistance.current) {
        const delta = distance / lastTouchDistance.current;
        setZoomScale(prev => Math.min(Math.max(prev * delta, 0.2), 10));
      }
      lastTouchDistance.current = distance;
    }
  };

  const handleEnd = () => {
    setIsPanning(false);
    lastTouchDistance.current = null;
  };

  const triggerToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const renderStrokesToCtx = (ctx, strokesList) => {
    if (!ctx || !Array.isArray(strokesList)) return;
    ctx.clearRect(0, 0, 1400, 700);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    strokesList.forEach(strokeData => {
      const points = strokeData.points || [];
      if (points.length >= 2) {
        ctx.beginPath();
        ctx.strokeStyle = strokeData.color || THEME_NAVY;
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && pages[currentPageIndex]) {
      renderStrokesToCtx(canvas.getContext('2d'), pages[currentPageIndex]);
    }
  }, [currentPageIndex, pages]);

  const createNewPage = () => {
    setPages(prev => [...prev, []]);
    setCurrentPageIndex(prevCount => prevCount + 1);
    triggerToast("New page created");
  };

  const clearCurrentPage = () => {
    setPages(prev => {
      const newPages = [...prev];
      newPages[currentPageIndex] = [];
      return newPages;
    });
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 1400, 700);
    }
    triggerToast("Page cleared");
  };

  const resetSession = () => {
    setPages([[]]);
    setCurrentPageIndex(0);
    currentStrokePoints.current = [];
    prevCoords.current = null;
    const canvas = canvasRef.current;
    if (canvas) renderStrokesToCtx(canvas.getContext('2d'), []);
    setZoomScale(1);
    setOffset({ x: 0, y: 0 });
    triggerToast("Session reset successfully");
  };

  const generatePreview = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1400, 700] });
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 1400; offCanvas.height = 700;
    const offCtx = offCanvas.getContext('2d');
    pages.forEach((pageStrokes, index) => {
      offCtx.fillStyle = "#ffffff";
      offCtx.fillRect(0, 0, 1400, 700);
      renderStrokesToCtx(offCtx, pageStrokes);
      offCtx.globalCompositeOperation = "destination-over";
      offCtx.fillStyle = "#ffffff";
      offCtx.fillRect(0, 0, 1400, 700);
      offCtx.globalCompositeOperation = "source-over";
      const imgData = offCanvas.toDataURL("image/jpeg", 0.95);
      if (index > 0) pdf.addPage([1400, 700], "landscape");
      pdf.addImage(imgData, "JPEG", 0, 0, 1400, 700);
    });
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    pdfInstance.current = pdf;
    setPdfBlobUrl(url);
    setShowPreview(true);
  };

  const finalizeDownload = async () => {
    if (!pdfInstance.current) return;
    if (!classId) return triggerToast("Error: No Class ID found.");
    setIsSaving(true);
    try {
      const pdfBlob = pdfInstance.current.output('blob');
      const file = new File([pdfBlob], `${fileName || 'SmartStroke'}.pdf`, { type: 'application/pdf' });
      const res = await api.uploadFile(classId, file); 
      if (res.data.message === "Success") {
        if (onSaveSuccess) onSaveSuccess(res.data.file);
        setShowPreview(false);
        URL.revokeObjectURL(pdfBlobUrl);
        resetSession();
      }
    } catch (err) {
      console.error("Upload failed:", err);
      triggerToast("Failed to save PDF to Class");
    } finally {
      setIsSaving(false);
    }
  };

  const connectBLE = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'SmartStrokes-Pen' }],
        optionalServices: [SERVICE_UUID]
      });
      bleDevice.current = device;
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = new TextDecoder().decode(event.target.value);
        try {
          const parsed = JSON.parse(value);
          if (parsed.pdf === 1 || (parsed.np === 1 && lastNpSignal.current === 0)) {
            if (parsed.pdf === 1) generatePreview();
            else createNewPage();
          }
          lastNpSignal.current = parsed.np || 0;
          setData({ ...parsed, down: parsed.d === 1 || parsed.d === true });
        } catch (e) { }
      });
      setIsConnected(true);
      triggerToast("Pen Connected");
    } catch (error) {
      console.error(error);
      triggerToast("Connection failed");
    }
  };

  const disconnectBLE = () => {
    if (bleDevice.current && bleDevice.current.gatt.connected) {
      bleDevice.current.gatt.disconnect();
      setIsConnected(false);
      triggerToast("Pen Disconnected");
    }
  };

  const getYawPitch = (r, i, j, k) => {
    const sinp = 2 * (r * j - k * i);
    const pitch = Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI) / 2 : Math.asin(sinp);
    const yaw = Math.atan2(2 * (r * k + i * j), 1 - 2 * (j * j + k * k));
    return { yaw, pitch };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const cursorCanvas = cursorRef.current;
    if (!canvas || !cursorCanvas || !isConnected) return;
    const ctx = canvas.getContext('2d');
    const cCtx = cursorCanvas.getContext('2d');
    const { yaw, pitch } = getYawPitch(data.r, data.i, data.j, data.k);
    if (centerPos.current === null) { centerPos.current = { yaw, pitch }; return; }
    const targetX = canvas.width / 2 - (yaw - centerPos.current.yaw) * SENSITIVITY;
    const targetY = canvas.height / 2 - (pitch - centerPos.current.pitch) * SENSITIVITY;
    let x = prevCoords.current ? prevCoords.current.x + (targetX - prevCoords.current.x) * SMOOTHING : targetX;
    let y = prevCoords.current ? prevCoords.current.y + (targetY - prevCoords.current.y) * SMOOTHING : targetY;
    x = Math.max(0, Math.min(x, canvas.width));
    y = Math.max(0, Math.min(y, canvas.height));
    if (data.down) {
      currentStrokePoints.current.push({ x, y });
      if (prevCoords.current) {
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.strokeStyle = selectedColor;
        ctx.moveTo(prevCoords.current.x, prevCoords.current.y);
        ctx.lineTo(x, y);
        ctx.stroke();
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
    cCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    cCtx.beginPath(); cCtx.arc(x, y, 6, 0, Math.PI * 2);
    cCtx.fillStyle = data.down ? selectedColor : '#f97316';
    cCtx.fill();
    cCtx.strokeStyle = 'white'; cCtx.lineWidth = 2; cCtx.stroke();
  }, [data, selectedColor, isConnected]);

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-slate-100 overflow-hidden font-['Poppins'] select-none">
      <aside className="w-full lg:w-[240px] bg-white p-3 lg:p-5 flex flex-row lg:flex-col border-b lg:border-r border-slate-200 z-50 overflow-x-auto lg:overflow-y-auto no-scrollbar gap-4 lg:gap-0 shrink-0">
        <div className="hidden lg:block text-xl font-extrabold tracking-tighter text-center mb-4 shrink-0">
          <span className="text-blue-900">Smart</span>
          <span className="text-orange-500">Stroke</span>
        </div>
        <div className="hidden lg:block h-px bg-slate-100 my-3" />
        <div className="flex lg:flex-col gap-2 shrink-0">
          {!isConnected ? (
            <button onClick={connectBLE} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-orange-500 text-white font-bold cursor-pointer text-xs lg:text-sm">Connect Pen</button>
          ) : (
            <>
              <button onClick={disconnectBLE} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 font-bold cursor-pointer text-xs lg:text-sm">Disconnect</button>
              <button onClick={handleRecenter} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-blue-100 text-blue-700 font-bold cursor-pointer text-xs lg:text-sm">Recenter Cursor</button>
            </>
          )}
          <div className="flex lg:flex-col items-center gap-2">
            <div className="flex gap-2 justify-center">
              {COLORS.map(color => (
                <div key={color} onClick={() => setSelectedColor(color)} className="w-6 h-6 lg:w-5 lg:h-5 rounded-full cursor-pointer transition-transform shrink-0" style={{ backgroundColor: color, outline: selectedColor === color ? `2px solid #1e3a8a` : 'none', outlineOffset: '2px' }} />
              ))}
            </div>
          </div>
        </div>
        <div className="hidden lg:block h-px bg-slate-100 my-3" />
        <div className="flex items-center lg:justify-between gap-2 shrink-0">
          <button disabled={currentPageIndex === 0} onClick={() => setCurrentPageIndex(p => p - 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white font-bold disabled:opacity-30">←</button>
          <span className="whitespace-nowrap text-[10px] lg:text-xs font-bold text-slate-700">Pg. {currentPageIndex + 1}/{pages.length}</span>
          <button disabled={currentPageIndex === pages.length - 1} onClick={() => setCurrentPageIndex(p => p + 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white font-bold disabled:opacity-30">→</button>
        </div>
        <div className="flex lg:flex-col gap-2 mt-0 md:mt-2 shrink-0">
          <button onClick={createNewPage} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-blue-50 text-blue-900 font-bold text-xs lg:text-sm">+ Page</button>
          <button onClick={clearCurrentPage} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-red-100 text-red-700 font-bold text-xs lg:text-sm">Clear</button>
          <button onClick={generatePreview} className="whitespace-nowrap p-2 lg:p-2.5 rounded-xl bg-blue-900 text-white font-bold text-xs lg:text-sm">Export</button>
        </div>
        <div className="hidden lg:flex flex-col mt-10">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-2">
            <div className="text-[8px] font-extrabold text-slate-400 mb-1.5 uppercase">Pressure</div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full transition-all duration-100 ease-out" style={{ width: `${(data.p / 4095) * 100}%`, backgroundColor: selectedColor }} />
            </div>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 mb-2">
            <div className="text-[8px] font-extrabold text-slate-400 mb-1.5 uppercase">Tilt</div>
            <div className="h-16 flex items-center justify-center [perspective:200px]">
              <div className="w-8 h-8 rounded-lg shadow-md transition-transform duration-100" style={{ backgroundColor: selectedColor, transform: `rotateX(${data.j * 90}deg) rotateY(${data.i * 90}deg)`, transformStyle: 'preserve-3d' }} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 justify-center">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
            <span>{isConnected ? 'Active' : 'Offline'}</span>
          </div>
        </div>
      </aside>

      <main 
        ref={mainRef} 
        className="flex-1 relative overflow-hidden bg-slate-200 p-2 md:p-4 touch-none cursor-grab active:cursor-grabbing" 
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleEnd} 
        onMouseLeave={handleEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
      >
        <div 
          className="absolute origin-center transition-transform duration-75 ease-out" 
          style={{ 
            left: '50%', 
            top: '50%', 
            width: '1400px', 
            height: '700px', 
            transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${baseScale * zoomScale})`, 
            flexShrink: 0 
          }}
        >
          <div className="relative w-full h-full rounded-lg shadow-2xl border-[12px] border-blue-900 bg-white">
            <canvas ref={canvasRef} width={1400} height={700} className="absolute top-0 left-0" />
            <canvas ref={cursorRef} width={1400} height={700} className="absolute top-0 left-0 pointer-events-none" />
          </div>
        </div>

        {(zoomScale !== 1 || offset.x !== 0 || offset.y !== 0) && (
            <button onClick={() => { setZoomScale(1); setOffset({x:0, y:0}); }} className="absolute bottom-6 left-6 bg-white shadow-xl px-4 py-2 rounded-full text-[10px] font-black text-blue-900 border border-blue-100 uppercase tracking-widest animate-in fade-in z-[100]">Reset View</button>
        )}
      </main>

      {toast.show && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 bg-zinc-700 text-white px-6 py-3 rounded-xl shadow-lg text-xs md:text-sm font-semibold z-[2000] animate-bounce">{toast.message}</div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-[24px] w-full max-w-[1100px] max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <header className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center">
              <div><h2 className="text-lg md:text-2xl font-extrabold text-blue-900">Export Document</h2><p className="hidden md:block text-xs md:text-sm text-slate-500 mt-1">Preview before finishing.</p></div>
              <button className="text-2xl md:text-3xl text-slate-400" onClick={() => { setShowPreview(false); URL.revokeObjectURL(pdfBlobUrl); }}>×</button>
            </header>
            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden p-4 md:p-6 gap-4">
              <div className="flex-1 bg-slate-50 rounded-2xl p-2 md:p-3 flex min-h-[300px]"><iframe src={pdfBlobUrl} className="w-full h-full border-none rounded-lg" title="PDF Preview" /></div>
              <div className="w-full md:w-[300px] flex flex-col gap-4 md:gap-6">
                <div className="flex flex-col gap-2"><label className="text-xs md:text-sm font-bold text-slate-600">File Name</label><div className="flex items-center bg-slate-100 rounded-xl px-3"><input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="flex-1 border-none bg-transparent py-2 md:py-2.5 text-xs md:text-sm outline-none" /><span className="text-xs md:text-sm text-slate-400 font-semibold">.pdf</span></div></div>
                <div className="bg-blue-50 rounded-2xl p-4 md:p-5 border border-blue-100"><div className="flex justify-between text-xs md:text-sm"><span>Total Pages:</span><strong className="text-blue-900">{pages.length}</strong></div></div>
                <div className="mt-auto flex gap-2 md:flex-col"><button onClick={() => { setShowPreview(false); URL.revokeObjectURL(pdfBlobUrl); }} className="flex-1 p-2.5 md:p-3.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs md:text-sm">Discard</button><button disabled={isSaving} onClick={finalizeDownload} className="flex-[2] md:flex-none p-3 md:p-4 rounded-xl bg-blue-900 text-white font-bold text-xs md:text-sm disabled:opacity-50">{isSaving ? "Saving..." : "Save & Sync"}</button></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}