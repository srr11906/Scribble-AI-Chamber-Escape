import React, { useRef, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { StrokeSegment, Point } from 'shared';
import { Trash2, Undo, Paintbrush, Eraser } from 'lucide-react';

interface DrawingCanvasProps {
  isDrawer: boolean;
  socket: Socket | null;
  canvasHistory: StrokeSegment[];
  chamberId: string;
}

const COLORS = [
  '#00F5FF', // Cyber Cyan
  '#FF2E63', // Red Alert
  '#00FFA3', // Success Green
  '#FFE600', // Warning Yellow
  '#B500FF', // Purple Neon
  '#EAFBFF', // Secondary White
];

const BRUSH_SIZES = [3, 6, 12, 24];

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  isDrawer,
  socket,
  canvasHistory,
  chamberId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [localHistory, setLocalHistory] = useState<StrokeSegment[]>([]);

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const batchPointsRef = useRef<Point[]>([]);
  const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync canvasHistory from props
  useEffect(() => {
    setLocalHistory(canvasHistory);
  }, [canvasHistory]);

  // Setup Canvas High-DPI and Event Listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        redraw();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [localHistory]);

  // Trigger redraw on localHistory updates
  useEffect(() => {
    redraw();
  }, [localHistory]);

  // Socket listener for remote drawing
  useEffect(() => {
    if (!socket) return;

    const onRemoteDraw = (stroke: StrokeSegment) => {
      // Append to local history so redraw holds it
      setLocalHistory(prev => [...prev, stroke]);
    };

    const onRemoteClear = () => {
      setLocalHistory([]);
    };

    const onRemoteUndo = () => {
      setLocalHistory(prev => prev.slice(0, -1));
    };

    socket.on('drawStroke', onRemoteDraw);
    socket.on('clearCanvas', onRemoteClear);
    socket.on('undoStroke', onRemoteUndo);

    return () => {
      socket.off('drawStroke', onRemoteDraw);
      socket.off('clearCanvas', onRemoteClear);
      socket.off('undoStroke', onRemoteUndo);
    };
  }, [socket]);

  // Redraw all strokes in history
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    localHistory.forEach(stroke => {
      drawStrokeSegment(ctx, stroke);
    });
  };

  const drawStrokeSegment = (ctx: CanvasRenderingContext2D, stroke: StrokeSegment) => {
    if (stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.size;

    if (stroke.isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  };

  // Get canvas coordinates relative to CSS size
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Start Batching Interval (every 25ms)
  const startBatching = () => {
    if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
    batchIntervalRef.current = setInterval(() => {
      if (batchPointsRef.current.length > 1 && socket) {
        const strokeSeg: StrokeSegment = {
          points: [...batchPointsRef.current],
          color,
          size: brushSize,
          isEraser,
        };
        // Emit batched coordinates
        socket.emit('drawStroke', strokeSeg);
        
        // Keep the last point so next batch connects cleanly without gaps
        const last = batchPointsRef.current[batchPointsRef.current.length - 1];
        batchPointsRef.current = [last];
      }
    }, 25);
  };

  const stopBatching = () => {
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }

    // Flush remaining points
    if (batchPointsRef.current.length > 1 && socket) {
      const strokeSeg: StrokeSegment = {
        points: [...batchPointsRef.current],
        color,
        size: brushSize,
        isEraser,
      };
      socket.emit('drawStroke', strokeSeg);
    }
    batchPointsRef.current = [];
  };

  // Pointer Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    const pt = getCoordinates(e);
    if (!pt) return;

    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);

    isDrawingRef.current = true;
    lastPointRef.current = pt;
    batchPointsRef.current = [pt];

    startBatching();

    // Create starting stroke
    const initialStroke: StrokeSegment = {
      points: [pt],
      color,
      size: brushSize,
      isEraser,
    };

    setLocalHistory(prev => [...prev, initialStroke]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingRef.current) return;
    const pt = getCoordinates(e);
    if (!pt) return;

    e.preventDefault();

    // Draw locally instantly
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx && lastPointRef.current) {
        const segment: StrokeSegment = {
          points: [lastPointRef.current, pt],
          color,
          size: brushSize,
          isEraser,
        };
        drawStrokeSegment(ctx, segment);
      }
    }

    // Update history cache
    setLocalHistory(prev => {
      if (prev.length === 0) return prev;
      const last = { ...prev[prev.length - 1] };
      last.points = [...last.points, pt];
      return [...prev.slice(0, -1), last];
    });

    batchPointsRef.current.push(pt);
    lastPointRef.current = pt;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingRef.current) return;
    e.preventDefault();
    canvasRef.current?.releasePointerCapture(e.pointerId);

    isDrawingRef.current = false;
    lastPointRef.current = null;
    stopBatching();
  };

  const handleClear = () => {
    if (!isDrawer || !socket) return;
    setLocalHistory([]);
    socket.emit('clearCanvas');
  };

  const handleUndo = () => {
    if (!isDrawer || !socket) return;
    setLocalHistory(prev => prev.slice(0, -1));
    socket.emit('undoStroke');
  };

  return (
    <div className="flex flex-col w-full h-full select-none">
      {/* Canvas Area */}
      <div className="relative flex-1 bg-chamber-bg border border-chamber-cyan/20 rounded-lg overflow-hidden w-full h-full">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full bg-chamber-surface cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

      </div>

      {/* Toolbar - Optimized for drawer */}
      {isDrawer && (
        <div className="mt-2 p-2 hologram-panel rounded-lg flex flex-wrap items-center justify-between gap-3 z-10">
          {/* Colors */}
          <div className="flex items-center gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setIsEraser(false);
                }}
                className={`w-7 h-7 rounded-full border transition-transform ${
                  color === c && !isEraser
                    ? 'border-chamber-cyan scale-110 shadow-cyan-glow'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                title="Brush Color"
              />
            ))}
            <button
              onClick={() => setIsEraser(true)}
              className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all ${
                isEraser
                  ? 'border-chamber-red scale-110 shadow-red-glow text-chamber-red bg-chamber-red/20'
                  : 'border-transparent text-chamber-secondary hover:text-white bg-chamber-surface'
              }`}
              title="Eraser"
            >
              <Eraser size={14} />
            </button>
          </div>

          {/* Brush Sizes */}
          <div className="flex items-center gap-2">
            <Paintbrush size={14} className="text-chamber-secondary" />
            <div className="flex items-center gap-1">
              {BRUSH_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  className={`px-2 py-0.5 rounded text-xs font-cyber tracking-wider border transition-colors ${
                    brushSize === size
                      ? 'border-chamber-cyan text-chamber-cyan bg-chamber-cyan/10 shadow-cyan-glow'
                      : 'border-transparent text-chamber-secondary hover:text-chamber-text hover:bg-chamber-surface'
                  }`}
                >
                  {size === 3 ? 'S' : size === 6 ? 'M' : size === 12 ? 'L' : 'XL'}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={localHistory.length === 0}
              className="p-1.5 rounded border border-chamber-cyan/10 hover:border-chamber-cyan/30 text-chamber-secondary hover:text-chamber-cyan disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Undo Last Stroke"
            >
              <Undo size={16} />
            </button>
            <button
              onClick={handleClear}
              disabled={localHistory.length === 0}
              className="p-1.5 rounded border border-chamber-red/10 hover:border-chamber-red/30 text-chamber-secondary hover:text-chamber-red disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Clear Canvas"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
