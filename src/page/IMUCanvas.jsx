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
  const [selectedStrokeIdxs, setSelectedStrokeIdxs] = useState([]);
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
  const lastUndoSignal = useRef(0);
  const lastRcSignal = useRef(0);

  const SMOOTHING = 0.4;
  const [zoomScale, setZoomScale] = useState(1);
  const lastTouchDistance = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [baseScale, setBaseScale] = useState(1);

  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });

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
      const isSelected = selectedStrokeIdxs.includes(idx) && activeTool === 'select';
      ctx.strokeStyle = isSelected ? '#22c55e' : stroke.color;

      if (isSelected) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#22c55e';
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      if (stroke.points.length === 2) {
        ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
      } else {
        let i;
        for (i = 1; i < stroke.points.length - 1; i++) {
          const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
          const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
        }
        ctx.lineTo(stroke.points[stroke.points.length - 1].x, stroke.points[stroke.points.length - 1].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  }, [pages, currentPageIndex, selectedStrokeIdxs, activeTool]);

  const handleColorUpdate = (color) => {
    setSelectedColor(color);
    if (selectedStrokeIdxs.length > 0 && activeTool === 'select') {
      const newPages = [...pages];
      
      selectedStrokeIdxs.forEach(idx => {
        if (newPages[currentPageIndex][idx]) {
          newPages[currentPageIndex][idx].color = color;
        }
      });

      setPages(newPages);
      socket?.emit('transmit-action', { classId, action: 'updateStrokes', pages: newPages });
      triggerToast(`${selectedStrokeIdxs.length} Strokes Updated`);
    }
  };

  const deleteSelected = () => {
    if (selectedStrokeIdxs.length === 0) return;
    
    const newPages = [...pages];
    newPages[currentPageIndex] = newPages[currentPageIndex].filter(
      (_, index) => !selectedStrokeIdxs.includes(index)
    );

    setPages(newPages);
    setSelectedStrokeIdxs([]); 
    socket?.emit('transmit-action', { classId, action: 'updateStrokes', pages: newPages });
    triggerToast("Selection Deleted");
  };

  const handleStartDraw = (e) => {
      if (isStudent && (activeTool === 'pen' || activeTool === 'eraser' || activeTool === 'select')) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const coords = {
        x: (clientX - rect.left) / (baseScale * zoomScale),
        y: (clientY - rect.top) / (baseScale * zoomScale)
      };

      if (activeTool === 'select') {
        const hitIndex = pageStrokesHitTest(coords);
        
        if (hitIndex !== -1 && selectedStrokeIdxs.includes(hitIndex)) {
          setIsDraggingStroke(true);
          setLastMousePos(coords);
        } 
        else if (hitIndex === -1) {
          setIsMarqueeSelecting(true);
          setMarqueeStart(coords);
          setMarqueeEnd(coords);
          if (!e.shiftKey) setSelectedStrokeIdxs([]);
        } 
        else {
          handleHitDetection(coords, e.shiftKey);
        }
      } else if (activeTool === 'pen') {
        setIsMouseDrawing(true);
        prevCoords.current = coords;
        currentStrokePoints.current = [coords];
      } else if (activeTool === 'eraser') {
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

    if (isMarqueeSelecting) {
      setMarqueeEnd(coords);
    } else if (isDraggingStroke && selectedStrokeIdxs.length > 0) {
      const dx = coords.x - lastMousePos.x;
      const dy = coords.y - lastMousePos.y;

      const newPages = [...pages];
      selectedStrokeIdxs.forEach(idx => {
        if (newPages[currentPageIndex][idx]) {
          newPages[currentPageIndex][idx].points = newPages[currentPageIndex][idx].points.map(p => ({
            x: p.x + dx,
            y: p.y + dy
          }));
        }
      });

      setPages(newPages);
      setLastMousePos(coords);
    } else if (isMouseDrawing) {
      const dist = Math.hypot(coords.x - prevCoords.current.x, coords.y - prevCoords.current.y);
      
      if (dist > 4) {
        const ctx = canvasRef.current.getContext('2d');
        
        ctx.beginPath();
        const dynamicWidth = data.p > 0 ? 1 + (data.p / 4095) * 5 : 4;
        
        ctx.lineWidth = dynamicWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = selectedColor;
        
        ctx.moveTo(prevCoords.current.x, prevCoords.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();

        socket?.emit('transmit-stroke', {
          classId,
          x: coords.x,
          y: coords.y,
          prevX: prevCoords.current.x,
          prevY: prevCoords.current.y,
          color: selectedColor,
          pageIndex: currentPageIndex,
          width: dynamicWidth
        });

        currentStrokePoints.current.push(coords);
        prevCoords.current = coords;
      }
    } else if (isPanning) {
      setOffset(prev => ({
        x: prev.x + (clientX - lastMousePos.x),
        y: prev.y + (clientY - lastMousePos.y)
      }));
      setLastMousePos({ x: clientX, y: clientY });
    }
  };

  const handleStopDraw = () => {
    if (isMarqueeSelecting) {
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

      const currentStrokes = pages[currentPageIndex] || [];
      const newlySelected = [];

      currentStrokes.forEach((stroke, sIdx) => {
        const isInside = stroke.points.some(p => 
          p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
        );
        if (isInside) newlySelected.push(sIdx);
      });

      setSelectedStrokeIdxs(prev => [...new Set([...prev, ...newlySelected])]);
      setIsMarqueeSelecting(false);
    }

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

  const pageStrokesHitTest = (coords) => {
    const pageStrokes = pages[currentPageIndex] || [];
    let hitIndex = -1;
    pageStrokes.forEach((stroke, sIdx) => {
      stroke.points.forEach(p => {
        const dist = Math.sqrt((p.x - coords.x) ** 2 + (p.y - coords.y) ** 2);
        if (dist < 40) hitIndex = sIdx;
      });
    });
    return hitIndex;
  };

  const handleHitDetection = (coords, isShiftKey = false) => {
    const hitIndex = pageStrokesHitTest(coords);

    if (hitIndex !== -1) {
      if (activeTool === 'eraser') {
        const newPages = [...pages];
        newPages[currentPageIndex].splice(hitIndex, 1);
        setPages(newPages);
        socket?.emit('transmit-action', { classId, action: 'updateStrokes', pages: newPages });
      } else {
        setSelectedStrokeIdxs(prev => {
          if (isShiftKey) {
            return prev.includes(hitIndex) 
              ? prev.filter(i => i !== hitIndex) 
              : [...prev, hitIndex];
          }
          return [hitIndex];
        });
      }
    } else {
      if (!isShiftKey) setSelectedStrokeIdxs([]);
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

  const handleUndo = useCallback(() => {
    if (isStudent) return;

    setPages(prev => {
      const newPages = [...prev];
      const currentStrokes = newPages[currentPageIndex];

      if (currentStrokes && currentStrokes.length > 0) {
        newPages[currentPageIndex] = currentStrokes.slice(0, -1);

        socket?.emit('transmit-action', { 
          classId, 
          action: 'updateStrokes', 
          pages: newPages 
        });

        triggerToast("Undo Successful");
      } else {
        triggerToast("Nothing to undo");
      }
      return newPages;
    });
  }, [currentPageIndex, isStudent, socket, classId]);

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

    socket.on('receive-cv-pos', (pos) => {
      console.log("📍 Coordinate received from Python:", pos);
      setCvPos({ x: pos.x, y: pos.y });
  });

  socket.on('receive-stroke', (s) => {
    if (s.pageIndex === currentIndexRef.current) {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.beginPath(); 
        ctx.lineWidth = 4; 
        ctx.lineCap = 'round'; 
        ctx.strokeStyle = s.color;
        ctx.moveTo(s.prevX, s.prevY); 
        ctx.lineTo(s.x, s.y); 
        ctx.stroke();
      }
    }

    if (isStudent) {
      setPages(prev => {
        const newPages = [...prev];
        if (!newPages[s.pageIndex]) {
          while (newPages.length <= s.pageIndex) newPages.push([]);
        }

        const currentStrokes = newPages[s.pageIndex];
        const lastStroke = currentStrokes[currentStrokes.length - 1];

        if (lastStroke && 
            lastStroke.color === s.color && 
            lastStroke.points[lastStroke.points.length - 1].x === s.prevX &&
            lastStroke.points[lastStroke.points.length - 1].y === s.prevY) {
          lastStroke.points.push({ x: s.x, y: s.y });
        } else {
          newPages[s.pageIndex].push({
            points: [{ x: s.prevX, y: s.prevY }, { x: s.x, y: s.y }],
            color: s.color
          });
        }
        return newPages;
      });
    }
  });

  socket.on('receive-action', (act) => {
    if (act.action === 'clear') {
      setPages(prev => { 
        const n = [...prev]; 
        if (n[act.pageIndex]) n[act.pageIndex] = []; 
        return n; 
      });
      if (act.pageIndex === currentIndexRef.current) {
        canvasRef.current?.getContext('2d')?.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
      }
    } else if (act.action === 'newPage') {
      setPages(prev => {
        const n = [...prev];
        while (n.length <= act.pageIndex) n.push([]);
        return n;
      });
      setCurrentPageIndex(act.pageIndex);
    } else if (act.action === 'updateStrokes') {
      setPages(act.pages);
    } else if (act.action === 'sessionEnded') {
      onSaveSuccess?.(null);
    }
  });

  socket.on('teacher-sync-request', (req) => {
    if (!isStudent) {
      socket.emit('teacher-sends-sync', { 
        requesterId: req.requesterId, 
        pages: pagesRef.current, 
        currentPageIndex: currentIndexRef.current 
      });
    }
  });

  socket.on('receive-sync-state', (syncData) => {
    if (isStudent) {
      setPages(syncData.pages);
      setCurrentPageIndex(syncData.currentPageIndex);
    }
  });

  return () => {
    socket.off('receive-cv-pos');
    socket.off('receive-stroke');
    socket.off('receive-action');
    socket.off('teacher-sync-request');
    socket.off('receive-sync-state');
  };
}, [socket, isStudent, onSaveSuccess, classId]);

  useEffect(() => {
    if (!canvasRef.current || !cursorRef.current || !isConnected || isStudent || activeTool !== 'imu') return;
    
    const ctx = canvasRef.current.getContext('2d');
    const cCtx = cursorRef.current.getContext('2d');
    
    // --- 1. ORIENTATION CALCULATION WITH NAN PROTECTION ---
    const sinp = 2 * (data.r * data.j - data.k * data.i);
    const clampedSinp = Math.max(-1, Math.min(1, sinp));
    const pitch = Math.asin(clampedSinp);

    const yaw = Math.atan2(
        2 * (data.r * data.k + data.i * data.j), 
        1 - 2 * (data.j * data.j + data.k * data.k)
    );

    // --- 2. CENTER CALIBRATION ---
    if (centerPos.current === null) { 
        centerPos.current = { yaw, pitch }; 
        prevCoords.current = { x: cvPos.x, y: cvPos.y };
        return; 
    }
    
    // --- 3. DYNAMIC SENSITIVITY & COORDINATE CALCULATION --- 
    const dynamicSens = 150 + (Math.abs(data.j) * 80); 
    
    const targetX = cvPos.x - (yaw - centerPos.current.yaw) * dynamicSens;
    const targetY = cvPos.y - (pitch - centerPos.current.pitch) * dynamicSens;

    // --- 4. SMOOTHING & CLAMPING ---
    let x = prevCoords.current 
        ? prevCoords.current.x + (targetX - prevCoords.current.x) * SMOOTHING 
        : targetX;
    let y = prevCoords.current 
        ? prevCoords.current.y + (targetY - prevCoords.current.y) * SMOOTHING 
        : targetY;

    x = Math.max(0, Math.min(x, BOARD_WIDTH));
    y = Math.max(0, Math.min(y, BOARD_HEIGHT));

    // --- 5. DRAWING & SYNC LOGIC ---
    if (data.down) {
        currentStrokePoints.current.push({ x, y });
        
        if (prevCoords.current && currentStrokePoints.current.length > 1) {
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.strokeStyle = selectedColor;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.moveTo(prevCoords.current.x, prevCoords.current.y);
            ctx.lineTo(x, y);
            ctx.stroke();
            
            socket?.emit('transmit-stroke', { 
                classId, 
                x, 
                y, 
                prevX: prevCoords.current.x, 
                prevY: prevCoords.current.y, 
                color: selectedColor, 
                pageIndex: currentPageIndex 
            });
        }
    } else {
        if (currentStrokePoints.current.length > 0) {
            const newStroke = { points: [...currentStrokePoints.current], color: selectedColor };
            setPages(prev => {
                const n = [...prev];
                n[currentPageIndex] = [...(n[currentPageIndex] || []), newStroke];
                return n;
            });

            socket?.emit('transmit-action', { 
                classId, 
                action: 'updateStrokes', 
                pages: [
                    ...pagesRef.current.slice(0, currentPageIndex), 
                    [...(pagesRef.current[currentPageIndex] || []), newStroke], 
                    ...pagesRef.current.slice(currentPageIndex + 1)
                ] 
            });
            
            currentStrokePoints.current = [];
        }
    }
    
    prevCoords.current = { x, y };

    // --- 6. CURSOR RENDERING ---
    cCtx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
    cCtx.beginPath();
    cCtx.arc(x, y, 6, 0, Math.PI * 2);
    cCtx.fillStyle = data.down ? selectedColor : '#FF8040';
    cCtx.fill();
    cCtx.strokeStyle = 'white';
    cCtx.lineWidth = 2;
    cCtx.stroke();

}, [data, cvPos, isConnected, activeTool, selectedColor, classId, socket, currentPageIndex]);

  const handleBLEData = useCallback((e) => {
    try {
        const p = JSON.parse(new TextDecoder().decode(e.target.value));

        // --- 1. HANDLE NEW PAGE SIGNAL (p.np) ---
        if (p.np === 1 && lastNpSignal.current !== 1) {
            if (!isStudent) {
                setPages(prev => {
                    const nextPages = [...prev, []];
                    const newIndex = nextPages.length - 1;
                    setCurrentPageIndex(newIndex);
                    socket?.emit('transmit-action', {
                        classId,
                        action: 'newPage',
                        pageIndex: newIndex
                    });
                    return nextPages;
                });
                triggerToast("New Page Created");
            }
        }
        lastNpSignal.current = p.np;

        // --- 2. HANDLE UNDO SIGNAL (p.un) ---
        if (p.un === 1 && lastUndoSignal.current !== 1) {
            if (!isStudent) {
                setPages(prev => {
                    const newPages = [...prev];
                    const activeIndex = currentIndexRef.current;
                    const currentStrokes = newPages[activeIndex] || [];
                    if (currentStrokes.length > 0) {
                        newPages[activeIndex] = currentStrokes.slice(0, -1);
                        socket?.emit('transmit-action', {
                            classId,
                            action: 'updateStrokes',
                            pages: newPages
                        });
                        triggerToast(`Undo on Page ${activeIndex + 1}`);
                    } else {
                        triggerToast("Nothing to undo");
                    }
                    return newPages;
                });
            }
        }
        lastUndoSignal.current = p.un;

        // --- 3. HANDLE RECENTER SIGNAL (p.rc) ---
        if (p.rc === 1 && lastRcSignal.current !== 1) {
            centerPos.current = null; 
            triggerToast("Sensor Synced to CV");
        }
        lastRcSignal.current = p.rc;

        // --- 4. HANDLE EXPORT/PDF SIGNAL (p.pdf) ---
        if (p.pdf === 1) {
            generatePreview();
        }

        // --- 5. UPDATE SENSOR DATA (Updates Tilt Viz) ---
        setData({ ...p, down: p.d === 1 || p.d === true });

    } catch (error) {
        console.error("BLE Parse Error:", error);
    }
}, [classId, isStudent, socket]);

  const connectBLE = async () => {
    if (!navigator.bluetooth) {
        triggerToast("Bluetooth not supported");
        return;
    }

    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'SmartStrokes-Pen' }],
            optionalServices: [SERVICE_UUID]
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        const char = await service.getCharacteristic(CHARACTERISTIC_UUID);

        char.removeEventListener('characteristicvaluechanged', handleBLEData);
        
        await char.startNotifications();
        char.addEventListener('characteristicvaluechanged', handleBLEData);

        // --- RESET SYSTEM STATE ---
        centerPos.current = null;
        setIsConnected(true);
        bleDevice.current = device;
        
        triggerToast("Pen Connected & Ready");

    } catch (error) {
        console.error("BLE Connection Error:", error);
        triggerToast("Connection failed");
    }
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
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scroll { scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent; }
      `}</style>

      {!isStudent && (
        <aside className="w-full lg:w-[260px] bg-white flex flex-col border-r border-slate-200 z-50 shadow-xl h-auto lg:h-full overflow-hidden shrink-0">
          <div className="p-3 bg-white border-b border-slate-100 z-20 shadow-sm">
            <div className="flex flex-row lg:flex-col gap-3 lg:gap-2 items-center lg:items-stretch">
                <div className="flex items-center justify-between flex-1 lg:flex-none">
                    <button 
                        onClick={() => {
                        const newIdx = Math.max(0, currentPageIndex - 1);
                        setCurrentPageIndex(newIdx);
                        socket?.emit('transmit-action', { classId, action: 'newPage', pageIndex: newIdx });
                        }} 
                        className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl border border-slate-100 bg-white font-black hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm"
                    >
                        ←
                    </button>
                    <span className="text-sm font-black text-slate-800">
                        {currentPageIndex + 1} / {pages.length}
                    </span>
                    <button 
                        onClick={() => {
                        const newIdx = Math.min(pages.length - 1, currentPageIndex + 1);
                        setCurrentPageIndex(newIdx);
                        socket?.emit('transmit-action', { classId, action: 'newPage', pageIndex: newIdx });
                        }} 
                        className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl border border-slate-100 bg-white font-black hover:bg-slate-50 transition-colors flex items-center justify-center shadow-sm"
                    >
                        →
                    </button>
                </div>
                <div className="flex gap-1.5 flex-1 lg:flex-none">
                    <button onClick={createNewPage} className="flex-1 py-2 rounded-lg bg-slate-900 text-white font-black text-[8px] uppercase tracking-widest active:scale-95 transition-all">+ Page</button>
                    <button onClick={generatePreview} className="flex-1 py-2 rounded-lg bg-[#001BB7] text-white font-black text-[8px] uppercase tracking-widest active:scale-95 transition-all shadow-md">Export</button>
                </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 lg:p-4 pb-6 lg:pb-10 custom-scroll">
            <div className="flex flex-col gap-2">
                
                <div className="space-y-1.5">
                    {!navigator.bluetooth && (
                        <div className="p-2 bg-red-50 rounded-lg border border-red-100 mb-1">
                            <p className="text-[7px] font-black text-red-500 uppercase text-center leading-tight">Bluetooth Unsupported</p>
                        </div>
                    )}
                    <button onClick={async () => { if (!navigator.bluetooth) { triggerToast("Bluetooth not supported"); return; } try { await connectBLE(); } catch (err) { triggerToast("Connection failed"); } }} className={`w-full p-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md transition-all ${isConnected ? 'bg-slate-100 text-slate-400' : 'bg-orange-500 text-white active:scale-95'}`}>
                        {isConnected ? 'Linked' : 'Connect Pen'}
                    </button>
                    <button onClick={() => { centerPos.current = null; triggerToast("Sensor Centered"); }} className="w-full p-2.5 rounded-xl bg-blue-50 text-[#001BB7] font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all">Recenter</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2">
                    {/* Palette Container */}
                    <div className="bg-white p-2 rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-h-[80px]">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Palette</span>
                        <div className="flex flex-wrap justify-center gap-1">
                            {COLORS.map(color => (
                                <div 
                                    key={color} 
                                    onClick={() => handleColorUpdate(color)} 
                                    className={`w-4 h-4 rounded-full cursor-pointer transition-all hover:scale-110 shadow-sm ${selectedColor === color ? 'ring-2 ring-[#001BB7]/30 border border-white scale-110' : ''}`} 
                                    style={{ backgroundColor: color }} 
                                />
                            ))}
                        </div>
                    </div>

                    {/* Tilt Viz Container */}
                    <div className="bg-slate-50 p-2 rounded-2xl border border-slate-100 flex flex-col items-center justify-center min-h-[80px]">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tilt</span>
                        <div className="h-10 flex items-center justify-center [perspective:150px]">
                            <div 
                                className="w-6 h-6 rounded-lg shadow-lg transition-transform duration-100" 
                                style={{ 
                                    backgroundColor: selectedColor, 
                                    transform: `rotateX(${data.j * 90}deg) rotateY(${data.i * 90}deg)`, 
                                    transformStyle: 'preserve-3d' 
                                }} 
                            />
                        </div>
                    </div>
                </div>
                {/* Pressure Visualizer */}
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="text-[7px] font-black text-slate-400 mb-1 uppercase flex justify-between tracking-tight"><span>Pressure Sense</span><span>{Math.round((data.p / 4095) * 100)}%</span></div>
                    <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full transition-all duration-100" style={{ width: `${(data.p / 4095) * 100}%`, backgroundColor: selectedColor }} />
                    </div>
                </div>

                {/* Workspace Tools Grid */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 shadow-inner">
                    <span className="text-[8px] font-black text-[#001BB7] uppercase block mb-2 text-center tracking-widest">Workspace Tools</span>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                        { id: 'imu', label: 'Sensor', icon: <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83"/> },
                        { id: 'pen', label: 'Digital', icon: <path d="m12 19 7-7 3 3-7 7-3-3ZM2 22 7 12"/> },
                        { id: 'eraser', label: 'Eraser', icon: <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6"/>, color: '#FF8040' },
                        { id: 'select', label: 'Select', icon: <path d="M12 3v18M3 12h18"/>, color: '#0f172a' }
                        ].map((tool) => (
                        <button 
                            key={tool.id}
                            onClick={() => {setActiveTool(tool.id); if(tool.id !== 'select') setSelectedStrokeIdxs([]);}} 
                            className={`p-2 lg:p-2.5 rounded-lg border transition-all flex flex-col items-center gap-1 ${activeTool === tool.id ? 'text-white shadow-md' : 'bg-white text-slate-400'}`}
                            style={activeTool === tool.id ? { backgroundColor: tool.color || '#001BB7', borderColor: tool.color || '#001BB7' } : {}}
                        >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">{tool.icon}</svg>
                            <span className="text-[7px] font-black uppercase">{tool.label}</span>
                        </button>
                        ))}
                    </div>

                    {activeTool === 'select' && selectedStrokeIdxs.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200 flex flex-col gap-1.5 animate-in slide-in-from-top-1">
                        <div className="flex gap-1.5">
                            <button onClick={deleteSelected} className="flex-1 py-1.5 rounded-md bg-red-500 text-white font-black text-[7px] uppercase tracking-widest shadow-sm">Delete ({selectedStrokeIdxs.length})</button>
                            <button onClick={() => setSelectedStrokeIdxs([])} className="flex-1 py-1.5 rounded-md bg-slate-200 text-slate-600 font-black text-[7px] uppercase tracking-widest">Clear</button>
                        </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="h-4 w-full" />
          </div>
        </aside>
      )}

      {/* Main Canvas Area */}
      <main ref={mainRef} className={`flex-1 relative bg-slate-200 overflow-hidden min-h-[50vh] ${isStudent ? 'cursor-grab active:cursor-grabbing' : (activeTool === 'pen' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing')}`} style={{ touchAction: 'none' }} onMouseDown={handleStartDraw} onMouseMove={handleDrawingMove} onMouseUp={handleStopDraw} onTouchStart={(e) => { if (e.touches.length === 2) { lastTouchDistance.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); } else { handleStartDraw(e); } }} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} >
          <div className="absolute origin-center transition-transform duration-75 ease-out" style={{ left: '50%', top: '50%', width: '2440px', height: '1170px', transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${baseScale * zoomScale})` }}>
            <div className="relative w-full h-full rounded-xl shadow-2xl border-[6px] border-[#001BB7] bg-white overflow-hidden">
              <canvas ref={canvasRef} width={2440} height={1170} className="absolute inset-0" />
              {!isStudent && <canvas ref={cursorRef} width={2440} height={1170} className="absolute inset-0 pointer-events-none" />}
            </div>
          </div>
        </main>

      {/* Export Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[1000] p-4">
          <div className="bg-white rounded-3xl w-full max-w-[900px] h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <header className="p-4 border-b border-slate-100 flex justify-between items-center"><h2 className="text-base font-black text-[#001BB7] uppercase italic">Digital Preview</h2><button className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 font-black" onClick={() => setShowPreview(false)}>✕</button></header>
            <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden">
              <object data={pdfBlobUrl} type="application/pdf" className="flex-1 bg-slate-100 rounded-xl border-none min-h-[250px]">
                <div className="flex flex-col items-center justify-center h-full p-4 text-center"><p className="text-slate-500 mb-2 text-xs font-bold">Preview not supported.</p><a href={pdfBlobUrl} download={`${fileName}.pdf`} className="p-2.5 bg-[#001BB7] text-white rounded-lg font-black uppercase text-[8px]">Download PDF</a></div>
              </object>
              <div className="w-full lg:w-[240px] flex flex-col gap-4">
                <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-400">File Name</label><input type="text" value={fileName} onChange={e => setFileName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-[#001BB7]" /></div>
                <div className="mt-auto space-y-2"><button disabled={isSaving} onClick={finalizeDownload} className="w-full p-3.5 bg-[#001BB7] text-white rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95">{isSaving ? "Saving..." : "Save"}</button><button onClick={() => setShowPreview(false)} className="w-full py-2 text-slate-400 font-black uppercase text-[8px]">Discard</button></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#001BB7] text-white px-5 py-2.5 rounded-full font-black text-[9px] uppercase z-[2000] shadow-xl animate-in slide-in-from-bottom-2">
          {toast.message}
        </div>
      )}
    </div>
  );
}