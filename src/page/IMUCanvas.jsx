import React, { useEffect, useState, useRef, useCallback } from 'react';
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

  const [activeTool, setActiveTool] = useState('imu'); 
  const [selectedStrokeIdx, setSelectedStrokeIdx] = useState(null);
  const [isMouseDrawing, setIsMouseDrawing] = useState(false);
  const [isDraggingStroke, setIsDraggingStroke] = useState(false);

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
  const [zoomScale, setZoomScale] = useState(1);
  const lastTouchDistance = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [baseScale, setBaseScale] = useState(1);

  // --- REFS FOR SOCKET SYNC STABILITY ---
  const pagesRef = useRef(pages);
  const currentIndexRef = useRef(currentPageIndex);
  useEffect(() => { 
    pagesRef.current = pages; 
    currentIndexRef.current = currentPageIndex; 
  }, [pages, currentPageIndex]);

  const redrawCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;

    const currentStrokes = pages[currentPageIndex] || [];
    currentStrokes.forEach((stroke, idx) => {
      if (!stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      const isSelected = selectedStrokeIdx === idx && activeTool === 'select';
      ctx.strokeStyle = isSelected ? '#22c55e' : stroke.color;
      if (isSelected) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#22c55e';
      }
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }, [pages, currentPageIndex, selectedStrokeIdx, activeTool]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  const handleColorUpdate = (color) => {
    setSelectedColor(color);
    if (selectedStrokeIdx !== null && activeTool === 'select') {
      const newPages = [...pages];
      newPages[currentPageIndex][selectedStrokeIdx].color = color;
      setPages(newPages);
      socket?.emit('transmit-action', { classId, action: 'updateStrokes', pages: newPages });
      triggerToast("Stroke Color Updated");
    }
  };

  const deleteSelected = () => {
    if (selectedStrokeIdx === null) return;
    const newPages = [...pages];
    newPages[currentPageIndex].splice(selectedStrokeIdx, 1);
    setPages(newPages);
    setSelectedStrokeIdx(null);
    socket?.emit('transmit-action', { classId, action: 'updateStrokes', pages: newPages });
    triggerToast("Stroke Deleted");
  };

  const handleStartDraw = (e) => {
    // FIX: Allow students to pan the board
    if (isStudent && (activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'select')) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const coords = {
      x: (clientX - rect.left) / (baseScale * zoomScale),
      y: (clientY - rect.top) / (baseScale * zoomScale)
    };

    if (activeTool === 'select' && selectedStrokeIdx !== null) {
      setIsDraggingStroke(true);
      setLastMousePos(coords);
    } else if (activeTool === 'pen') {
      setIsMouseDrawing(true);
      prevCoords.current = coords;
      currentStrokePoints.current = [coords];
    } else if (activeTool === 'eraser' || activeTool === 'select') {
      handleHitDetection(coords);
    } else {
      setIsPanning(true);
      setLastMousePos({ x: clientX, y: clientY });
    }
  };

  const handleDrawingMove = (e) => {
    if (isStudent && !isPanning) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const coords = {
      x: (clientX - rect.left) / (baseScale * zoomScale),
      y: (clientY - rect.top) / (baseScale * zoomScale)
    };

    if (isDraggingStroke && selectedStrokeIdx !== null) {
      const dx = coords.x - lastMousePos.x;
      const dy = coords.y - lastMousePos.y;
      const newPages = [...pages];
      newPages[currentPageIndex][selectedStrokeIdx].points = newPages[currentPageIndex][selectedStrokeIdx].points.map(p => ({
        x: p.x + dx,
        y: p.y + dy
      }));
      setPages(newPages);
      setLastMousePos(coords);
    } else if (isMouseDrawing) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.beginPath(); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = selectedColor;
      ctx.moveTo(prevCoords.current.x, prevCoords.current.y); ctx.lineTo(coords.x, coords.y); ctx.stroke();
      
      // FIX: TRANSMIT STROKE FOR REAL-TIME
      socket?.emit('transmit-stroke', { classId, x: coords.x, y: coords.y, prevX: prevCoords.current.x, prevY: prevCoords.current.y, color: selectedColor, pageIndex: currentPageIndex });

      currentStrokePoints.current.push(coords);
      prevCoords.current = coords;
    } else if (isPanning) {
      setOffset(prev => ({ x: prev.x + (clientX - lastMousePos.x), y: prev.y + (clientY - lastMousePos.y) }));
      setLastMousePos({ x: clientX, y: clientY });
    }
  };

  const handleStopDraw = () => {
    if (isMouseDrawing) {
      const newStroke = { points: [...currentStrokePoints.current], color: selectedColor };
      setPages(prev => {
        const n = [...prev];
        n[currentPageIndex] = [...(n[currentPageIndex] || []), newStroke];
        return n;
      });
      currentStrokePoints.current = [];
      setIsMouseDrawing(false);
    }
    if (isDraggingStroke) {
        socket?.emit('transmit-action', { classId, action: 'updateStrokes', pages: pages });
    }
    setIsDraggingStroke(false);
    setIsPanning(false);
  };

  const handleHitDetection = (coords) => {
    const pageStrokes = pages[currentPageIndex];
    let hitIndex = -1;
    pageStrokes.forEach((stroke, sIdx) => {
      stroke.points.forEach(p => {
        const dist = Math.sqrt((p.x - coords.x)**2 + (p.y - coords.y)**2);
        if (dist < 40) hitIndex = sIdx;
      });
    });

    if (hitIndex !== -1) {
      if (activeTool === 'eraser') {
        const newPages = [...pages];
        newPages[currentPageIndex].splice(hitIndex, 1);
        setPages(newPages);
        socket?.emit('transmit-action', { classId, action: 'updateStrokes', pages: newPages });
      } else {
        setSelectedStrokeIdx(hitIndex);
      }
    } else {
      setSelectedStrokeIdx(null);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1) { handleDrawingMove(e); return; }
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      if (lastTouchDistance.current !== null) {
        const delta = currentDistance / lastTouchDistance.current;
        setZoomScale(prev => Math.min(Math.max(prev * delta, 0.5), 4));
      }
      lastTouchDistance.current = currentDistance;
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
    handleStopDraw();
  };

  useEffect(() => {
    if (socket && classId) {
      socket.emit('join-session', classId);
      if (isStudent) {
        socket.emit('request-current-state', classId);
      } else {
        socket.emit('start-stream', classId);
        socket.emit('request-camera-sync', classId);
      }
      return () => {
        if (!isStudent) {
          socket.emit('transmit-action', { classId, action: 'sessionEnded' });
          socket.emit('stop-stream', classId);
        }
      };
    }
  }, [socket, classId, isStudent]);

  useEffect(() => {
    if (!socket) return;
    socket.on('receive-cv-pos', (pos) => setCvPos({ x: pos.x, y: pos.y }));
    socket.on('receive-stroke', (s) => {
      if (s.pageIndex !== currentIndexRef.current) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.beginPath(); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = s.color;
      ctx.moveTo(s.prevX, s.prevY); ctx.lineTo(s.x, s.y); ctx.stroke();
    });
    socket.on('receive-action', (act) => {
      if (act.action === 'clear') {
        setPages(prev => { const n = [...prev]; n[act.pageIndex] = []; return n; });
        canvasRef.current?.getContext('2d')?.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      } else if (act.action === 'newPage') {
        setPages(prev => [...prev, []]);
        setCurrentPageIndex(act.pageIndex);
      } else if (act.action === 'updateStrokes') {
        setPages(act.pages);
      } else if (act.action === 'sessionEnded') {
        onSaveSuccess?.(null);
      }
    });
    socket.on('teacher-sync-request', (req) => {
      if (!isStudent) {
        socket.emit('teacher-sends-sync', { requesterId: req.requesterId, pages: pagesRef.current, currentPageIndex: currentIndexRef.current });
      }
    });
    socket.on('receive-sync-state', (syncData) => {
      if (isStudent) {
        setPages(syncData.pages);
        setCurrentPageIndex(syncData.currentPageIndex);
      }
    });
    return () => socket.off();
  }, [socket, isStudent, onSaveSuccess, classId]);

  useEffect(() => {
    if (!canvasRef.current || !isConnected || isStudent || activeTool !== 'imu') return;
    const ctx = canvasRef.current.getContext('2d');
    const cCtx = cursorRef.current.getContext('2d');
    
    const sinp = 2 * (data.r * data.j - data.k * data.i);
    const pitch = Math.abs(sinp) >= 1 ? (Math.sign(sinp) * Math.PI) / 2 : Math.asin(sinp);
    const yaw = Math.atan2(2 * (data.r * data.k + data.i * data.j), 1 - 2 * (data.j * data.j + data.k * data.k));

    if (centerPos.current === null) { centerPos.current = { yaw, pitch }; return; }
    const dynamicSens = 250 + (Math.abs(data.j) * 150);
    const targetX = cvPos.x - (yaw - centerPos.current.yaw) * dynamicSens;
    const targetY = cvPos.y - (pitch - centerPos.current.pitch) * dynamicSens;
    
    let x = prevCoords.current ? prevCoords.current.x + (targetX - prevCoords.current.x) * SMOOTHING : targetX;
    let y = prevCoords.current ? prevCoords.current.y + (targetY - prevCoords.current.y) * SMOOTHING : targetY;
    x = Math.max(0, Math.min(x, BOARD_WIDTH)); y = Math.max(0, Math.min(y, BOARD_HEIGHT));

    if (data.down) {
      currentStrokePoints.current.push({ x, y });
      if (prevCoords.current) {
        ctx.beginPath(); ctx.lineWidth = 4; ctx.strokeStyle = selectedColor; ctx.lineCap = 'round';
        ctx.moveTo(prevCoords.current.x, prevCoords.current.y); ctx.lineTo(x, y); ctx.stroke();
        socket?.emit('transmit-stroke', { classId, x, y, prevX: prevCoords.current.x, prevY: prevCoords.current.y, color: selectedColor, pageIndex: currentPageIndex });
      }
      prevCoords.current = { x, y };
    } else if (currentStrokePoints.current.length > 0) {
      setPages(prev => {
        const n = [...prev];
        n[currentPageIndex] = [...(n[currentPageIndex] || []), { points: [...currentStrokePoints.current], color: selectedColor }];
        return n;
      });
      currentStrokePoints.current = [];
      prevCoords.current = null;
    }
    cCtx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    cCtx.beginPath(); cCtx.arc(x, y, 6, 0, Math.PI * 2);
    cCtx.fillStyle = data.down ? selectedColor : '#FF8040';
    cCtx.fill(); cCtx.strokeStyle = 'white'; cCtx.lineWidth = 2; cCtx.stroke();
  }, [data, cvPos, isConnected, activeTool, selectedColor, classId, socket, currentPageIndex]);

  const connectBLE = async () => {
    if (!navigator.bluetooth) { triggerToast("Bluetooth not supported"); return; }
    try {
      const device = await navigator.bluetooth.requestDevice({ filters: [{ name: 'SmartStrokes-Pen' }], optionalServices: [SERVICE_UUID] });
      const server = await device.gatt.connect();
      const char = await (await server.getPrimaryService(SERVICE_UUID)).getCharacteristic(CHARACTERISTIC_UUID);
      await char.startNotifications();
      char.addEventListener('characteristicvaluechanged', (e) => {
        const p = JSON.parse(new TextDecoder().decode(e.target.value));
        if (p.pdf === 1) generatePreview();
        setData({ ...p, down: p.d === 1 || p.d === true });
      });
      setIsConnected(true); bleDevice.current = device;
    } catch { triggerToast("Connection failed"); }
  };

  const finalizeDownload = async () => {
    if (!pdfInstance.current || !classId) return;
    setIsSaving(true);
    try {
      const blob = pdfInstance.current.output('blob');
      const file = new File([blob], `${fileName}.pdf`, { type: 'application/pdf' });
      const res = await api.uploadFile(classId, file); 
      if (res.data.message === "Success") { onSaveSuccess?.(res.data.file); setShowPreview(false); if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    } catch { triggerToast("Failed to save PDF"); } finally { setIsSaving(false); }
  };

  const generatePreview = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [BOARD_WIDTH, BOARD_HEIGHT] });
    const offCanvas = document.createElement('canvas');
    offCanvas.width = BOARD_WIDTH; offCanvas.height = BOARD_HEIGHT;
    const offCtx = offCanvas.getContext('2d');
    pages.forEach((pageStrokes, index) => {
      offCtx.fillStyle = "#ffffff"; offCtx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      pageStrokes.forEach(s => {
        if (!s.points || s.points.length < 2) return;
        offCtx.beginPath(); offCtx.strokeStyle = s.color; offCtx.lineWidth = 4;
        offCtx.moveTo(s.points[0].x, s.points[0].y);
        for(let i=1; i<s.points.length; i++) offCtx.lineTo(s.points[i].x, s.points[i].y);
        offCtx.stroke();
      });
      if (index > 0) pdf.addPage([BOARD_WIDTH, BOARD_HEIGHT], "landscape");
      pdf.addImage(offCanvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    });
    setPdfBlobUrl(URL.createObjectURL(pdf.output('blob')));
    pdfInstance.current = pdf; setShowPreview(true);
  };

  useEffect(() => {
    const handleResize = () => {
      if (!mainRef.current) return;
      setBaseScale(Math.min((mainRef.current.clientWidth - 170) / BOARD_WIDTH, (mainRef.current.clientHeight - 170) / BOARD_HEIGHT));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoomScale(prev => Math.min(Math.max(prev * delta, 0.5), 5));
      }
    };
    main.addEventListener('wheel', handleWheel, { passive: false });
    return () => main.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => { redrawCanvas(); }, [pages, currentPageIndex, redrawCanvas]);

  const triggerToast = (msg) => { setToast({ show: true, message: msg }); setTimeout(() => setToast({ show: false, message: '' }), 2000); };
  const createNewPage = () => { if(isStudent) return; setPages(prev => [...prev, []]); setCurrentPageIndex(pages.length); socket?.emit('transmit-action', { classId, action: 'newPage', pageIndex: pages.length }); };

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-slate-100 overflow-hidden font-['Poppins'] select-none">
      {!isStudent && (
        <aside className="w-full lg:w-[320px] bg-white flex flex-col border-r border-slate-200 z-50 shadow-2xl h-[40vh] lg:h-full overflow-hidden">
          <div className="p-4 lg:p-6 lg:pt-20 border-b border-slate-100 sticky top-0 bg-white z-30">
            <div className="text-xl lg:text-2xl font-black tracking-tighter text-center italic">
              <span className="text-[#001BB7]">Smart</span><span className="text-[#FF8040]">Stroke</span>
            </div>
          </div>

          <div className="p-4 lg:p-3 bg-white border-b border-slate-100 space-y-3 sticky top-[72px] lg:top-[88px] z-20 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setCurrentPageIndex(p => Math.max(0, p-1))} className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl border border-slate-100 bg-white font-black hover:bg-slate-50 transition-colors">←</button>
              <span className="text-md lg:text-lg font-black text-slate-800">{currentPageIndex + 1}/{pages.length}</span>
              <button onClick={() => setCurrentPageIndex(p => Math.min(pages.length-1, p+1))} className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl border border-slate-100 bg-white font-black hover:bg-slate-50 transition-colors">→</button>
            </div>
            <div className="flex gap-2">
              <button onClick={createNewPage} className="flex-1 p-3 lg:p-4 rounded-2xl bg-slate-900 text-white font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all">+ Page</button>
              <button onClick={generatePreview} className="flex-1 p-3 lg:p-4 rounded-2xl bg-[#001BB7] text-white font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-900/20">Export</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 pb-0 lg:pb-40 space-y-6 lg:space-y-4 no-scrollbar">
            <div className="space-y-2">
              {!navigator.bluetooth && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 mb-2">
                  <p className="text-[9px] font-black text-red-500 uppercase text-center leading-tight">Bluetooth Not Supported <br/> Use Chrome (Android) or Bluefy (iOS)</p>
                </div>
              )}
              <button onClick={async () => { if (!navigator.bluetooth) { triggerToast("Bluetooth not supported"); return; } try { await connectBLE(); } catch (err) { triggerToast("Connection failed"); } }} className={`w-full p-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all ${isConnected ? 'bg-slate-100 text-slate-400' : 'bg-orange-500 text-white shadow-orange-100 active:scale-95'}`}>
                {isConnected ? 'Linked' : 'Connect Pen'}
              </button>
              <button onClick={() => { centerPos.current = null; triggerToast("Sensor Centered"); }} className="w-full p-4 rounded-2xl bg-blue-50 text-[#001BB7] font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Recenter Sensor</button>
            </div>

            <div className="text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Color Palette</span>
              <div className="flex flex-wrap justify-center gap-3">
                {COLORS.map(color => (
                  <div key={color} onClick={() => handleColorUpdate(color)} className={`w-8 h-8 rounded-full cursor-pointer transition-all hover:scale-125 shadow-md ${selectedColor === color ? 'ring-4 ring-[#001BB7]/20 border-2 border-white scale-110' : ''}`} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-[32px] border border-slate-100 shadow-inner">
              <span className="text-[10px] font-black text-[#001BB7] uppercase block mb-3 text-center tracking-widest">Workspace Tools</span>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => {setActiveTool('imu'); setSelectedStrokeIdx(null);}} className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${activeTool === 'imu' ? 'bg-[#001BB7] text-white shadow-lg' : 'bg-white text-slate-400'}`}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/></svg><span className="text-[9px] font-black uppercase">Sensor</span></button>
                <button onClick={() => {setActiveTool('pen'); setSelectedStrokeIdx(null);}} className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${activeTool === 'pen' ? 'bg-[#001BB7] text-white shadow-lg' : 'bg-white text-slate-400'}`}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m12 19 7-7 3 3-7 7-3-3Z"/><path d="M2 22 7 12"/></svg><span className="text-[9px] font-black uppercase">Digital</span></button>
                <button onClick={() => setActiveTool('eraser')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${activeTool === 'eraser' ? 'bg-[#FF8040] text-white shadow-lg' : 'bg-white text-slate-400'}`}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6"/></svg><span className="text-[9px] font-black uppercase">Eraser</span></button>
                <button onClick={() => setActiveTool('select')} className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${activeTool === 'select' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400'}`}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3v18"/><path d="M3 12h18"/></svg><span className="text-[9px] font-black uppercase">Select</span></button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-[9px] font-black text-slate-400 mb-2 uppercase flex justify-between"><span>Pressure</span><span>{Math.round((data.p / 4095) * 100)}%</span></div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden"><div className="h-full transition-all duration-100" style={{ width: `${(data.p / 4095) * 100}%`, backgroundColor: selectedColor }} /></div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center">
                <div className="text-[9px] font-black text-slate-400 mb-4 uppercase w-full text-center tracking-widest">Tilt Viz</div>
                <div className="h-16 flex items-center justify-center [perspective:200px]"><div className="w-10 h-10 rounded-xl shadow-2xl transition-transform duration-100" style={{ backgroundColor: selectedColor, transform: `rotateX(${data.j * 90}deg) rotateY(${data.i * 90}deg)`, transformStyle: 'preserve-3d' }} /></div>
              </div>
            </div>
            <div className="h-4 w-full" />
          </div>
        </aside>
      )}

      <main ref={mainRef} className={`flex-1 relative bg-slate-200 overflow-hidden min-h-[50vh] ${isStudent ? 'cursor-grab active:cursor-grabbing' : (activeTool === 'pen' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing')}`} style={{ touchAction: 'none' }} onMouseDown={handleStartDraw} onMouseMove={handleDrawingMove} onMouseUp={handleStopDraw} onTouchStart={(e) => { if (e.touches.length === 2) { lastTouchDistance.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); } else { handleStartDraw(e); } }} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} >
        <div className="absolute origin-center transition-transform duration-75 ease-out" style={{ left: '50%', top: '50%', width: '2440px', height: '1170px', transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${baseScale * zoomScale})` }}>
          <div className="relative w-full h-full rounded-[24px] lg:rounded-[20px] shadow-2xl border-[8px] lg:border-[16px] border-[#001BB7] bg-white overflow-hidden">
            <canvas ref={canvasRef} width={2440} height={1170} className="absolute inset-0" />
            {!isStudent && <canvas ref={cursorRef} width={2440} height={1170} className="absolute inset-0 pointer-events-none" />}
          </div>
        </div>
      </main>

      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-in fade-in">
          <div className="bg-white rounded-[32px] lg:rounded-[48px] w-full max-w-[1200px] h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <header className="p-6 border-b border-slate-100 flex justify-between items-center"><h2 className="text-xl lg:text-2xl font-black text-[#001BB7] uppercase italic">Digital Preview</h2><button className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 font-black" onClick={() => setShowPreview(false)}>✕</button></header>
            <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden">
              <object data={pdfBlobUrl} type="application/pdf" className="flex-1 bg-slate-100 rounded-[24px] border-none min-h-[300px]">
                <div className="flex flex-col items-center justify-center h-full p-6 text-center"><p className="text-slate-500 mb-4 font-bold">PDF Preview not supported on this device.</p><a href={pdfBlobUrl} download={`${fileName}.pdf`} className="p-4 bg-[#001BB7] text-white rounded-2xl font-black uppercase text-[10px]">Open PDF Directly</a></div>
              </object>
              <div className="w-full lg:w-[320px] flex flex-col gap-6">
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400">File Name</label><input type="text" value={fileName} onChange={e => setFileName(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold outline-none" /></div>
                <div className="mt-auto space-y-3"><button disabled={isSaving} onClick={finalizeDownload} className="w-full p-6 bg-[#001BB7] text-white rounded-3xl font-black uppercase text-xs tracking-widest disabled:opacity-50">{isSaving ? "Saving..." : "Save"}</button><button onClick={() => setShowPreview(false)} className="w-full p-4 text-slate-400 font-black uppercase text-[10px]">Discard</button></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[#001BB7] text-white px-8 py-4 rounded-full font-black text-[11px] uppercase z-[2000] shadow-2xl">{toast.message}</div>
      )}
    </div>
  );
}
