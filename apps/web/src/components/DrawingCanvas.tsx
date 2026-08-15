import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { ServerToClientEvents, ClientToServerEvents, CompressedStroke, Point } from 'shared';
import { Eraser, Paintbrush, Undo, Trash2 } from 'lucide-react';

interface DrawingCanvasProps {
  isDrawer: boolean;
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  canvasHistory?: CompressedStroke[];
  chamberId: string;
}

const COLORS = ['#FFFFFF', '#FF2E63', '#00F5FF', '#252A34', '#FFEA00', '#FF00FF', '#00FF66'];
const BRUSH_SIZES = [3, 6, 12, 24];

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({
  isDrawer,
  socket,
  canvasHistory,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [customColor, setCustomColor] = useState('#FF00FF');
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  
  // React state for re-rendering button disabled states
  const [localHistory, setLocalHistory] = useState<CompressedStroke[]>([]);
  
  // Ref-based history for requestAnimationFrame rendering
  const localHistoryRef = useRef<CompressedStroke[]>([]);
  const redrawPendingRef = useRef(false);

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const batchPointsRef = useRef<number[]>([]);
  const batchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync canvasHistory from props
  useEffect(() => {
    if (canvasHistory === undefined) return;
    localHistoryRef.current = canvasHistory;
    setLocalHistory(canvasHistory);
    scheduleRedraw();
  }, [canvasHistory]);

  // Socket listener for remote drawing
  useEffect(() => {
    if (!socket) return;

    const onRemoteDraw = (stroke: CompressedStroke) => {
      localHistoryRef.current = [...localHistoryRef.current, stroke];
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawCompressedStroke(ctx, stroke);
        }
      }
      setLocalHistory(localHistoryRef.current);
    };

    const onRemoteClear = () => {
      localHistoryRef.current = [];
      scheduleRedraw();
    };

    const onRemoteUndo = () => {
      localHistoryRef.current = localHistoryRef.current.slice(0, -1);
      scheduleRedraw();
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

  // schedule redraw on next animation frame
  const scheduleRedraw = () => {
    if (redrawPendingRef.current) return;
    redrawPendingRef.current = true;

    requestAnimationFrame(() => {
      redrawPendingRef.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, 800, 600);
      localHistoryRef.current.forEach(stroke => {
        drawCompressedStroke(ctx, stroke);
      });
      
      // Update React state to sync undo/clear buttons
      setLocalHistory(localHistoryRef.current);
    });
  };

  const drawCompressedStroke = (ctx: CanvasRenderingContext2D, stroke: CompressedStroke) => {
    if (stroke.points.length < 2) return;

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
    ctx.moveTo(stroke.points[0], stroke.points[1]);

    for (let i = 2; i < stroke.points.length; i += 2) {
      ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
    }
    ctx.stroke();
    ctx.restore();
  };

  // Get canvas coordinates relative to virtual 800x600 space
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: ((e.clientX - rect.left) / rect.width) * 800,
      y: ((e.clientY - rect.top) / rect.height) * 600,
    };
  };

  // Start Batching Interval (every 25ms)
  const startBatching = () => {
    if (batchIntervalRef.current) clearInterval(batchIntervalRef.current);
    batchIntervalRef.current = setInterval(() => {
      if (batchPointsRef.current.length > 2 && socket) {
        const strokeSeg: CompressedStroke = {
          points: [...batchPointsRef.current],
          color,
          size: brushSize,
          isEraser,
        };
        socket.emit('drawStroke', strokeSeg);
        
        // Keep the last point coordinate pair
        const lastX = batchPointsRef.current[batchPointsRef.current.length - 2];
        const lastY = batchPointsRef.current[batchPointsRef.current.length - 1];
        batchPointsRef.current = [lastX, lastY];
      }
    }, 25);
  };

  const stopBatching = () => {
    if (batchIntervalRef.current) {
      clearInterval(batchIntervalRef.current);
      batchIntervalRef.current = null;
    }

    if (batchPointsRef.current.length > 2 && socket) {
      const strokeSeg: CompressedStroke = {
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
    batchPointsRef.current = [pt.x, pt.y];

    startBatching();

    // Create starting stroke
    const initialStroke: CompressedStroke = {
      points: [pt.x, pt.y],
      color,
      size: brushSize,
      isEraser,
    };

    localHistoryRef.current = [...localHistoryRef.current, initialStroke];
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
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushSize;

        if (isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = color;
        }

        ctx.beginPath();
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Update history cache inside ref (no React state updates during drag!)
    if (localHistoryRef.current.length > 0) {
      const last = { ...localHistoryRef.current[localHistoryRef.current.length - 1] };
      last.points = [...last.points, pt.x, pt.y];
      localHistoryRef.current[localHistoryRef.current.length - 1] = last;
    }

    batchPointsRef.current.push(pt.x, pt.y);
    lastPointRef.current = pt;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingRef.current) return;
    e.preventDefault();
    canvasRef.current?.releasePointerCapture(e.pointerId);

    isDrawingRef.current = false;
    lastPointRef.current = null;
    stopBatching();
    scheduleRedraw();
  };

  const handleClear = () => {
    if (!isDrawer || !socket) return;
    localHistoryRef.current = [];
    setLocalHistory([]);
    socket.emit('clearCanvas');
    scheduleRedraw();
  };

  const handleUndo = () => {
    if (!isDrawer || !socket) return;
    localHistoryRef.current = localHistoryRef.current.slice(0, -1);
    setLocalHistory(prev => prev.slice(0, -1));
    socket.emit('undoStroke');
    scheduleRedraw();
  };

  return (
    <div className="flex flex-col w-full h-full select-none">
      {/* Canvas Area */}
      <div 
        className="relative flex-1 bg-chamber-bg border border-chamber-cyan/20 rounded-lg overflow-hidden w-full h-full flex items-center justify-center min-h-0"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="max-w-full max-h-full bg-chamber-surface cursor-crosshair touch-none object-contain aspect-[4/3] rounded-lg"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      </div>

      {/* Toolbar - Scrollable single row with 44px touch targets on mobile */}
      {isDrawer && (
        <div className="mt-1.5 md:mt-2 p-1.5 hologram-panel rounded-lg flex flex-row items-center gap-4 z-10 shrink-0 w-full overflow-x-auto whitespace-nowrap scrollbar-none select-none min-h-[52px]">
          {/* Colors */}
          <div className="flex items-center gap-1.5 shrink-0">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => {
                  setColor(c);
                  setIsEraser(false);
                }}
                className={`w-11 h-11 md:w-7 md:h-7 rounded-full border transition-transform shrink-0 ${
                  color === c && !isEraser
                    ? 'border-chamber-cyan scale-110 shadow-cyan-glow'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
                title="Brush Color"
                aria-label={`Select brush color ${c}`}
              />
            ))}
            
            {/* Custom Color Selector */}
            <button
              onClick={() => {
                colorInputRef.current?.click();
              }}
              className={`w-11 h-11 md:w-7 md:h-7 rounded-full border transition-transform shrink-0 flex items-center justify-center relative overflow-hidden ${
                color === customColor && !isEraser
                  ? 'border-chamber-cyan scale-110 shadow-cyan-glow'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{
                background: `conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`
              }}
              title="Custom Color"
              aria-label="Select custom color"
            >
              {color === customColor && !isEraser && (
                <span className="absolute inset-1 rounded-full border border-chamber-bg" style={{ backgroundColor: customColor }} />
              )}
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setColor(e.target.value);
                setIsEraser(false);
              }}
              className="hidden"
            />

            <button
              onClick={() => setIsEraser(true)}
              className={`w-11 h-11 md:w-7 md:h-7 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                isEraser
                  ? 'border-chamber-red scale-110 shadow-red-glow text-chamber-red bg-chamber-red/20'
                  : 'border-transparent text-chamber-secondary hover:text-white bg-chamber-surface'
              }`}
              title="Eraser Mode"
              aria-label="Toggle Eraser Mode"
            >
              <Eraser className="w-5 h-5 md:w-3.5 md:h-3.5" />
            </button>
          </div>

          {/* Brush Sizes */}
          <div className="flex items-center gap-1.5 shrink-0">
            {BRUSH_SIZES.map(size => (
              <button
                key={size}
                onClick={() => setBrushSize(size)}
                className={`w-11 h-11 md:w-7 md:h-7 rounded-lg text-xs font-cyber tracking-wider border transition-colors flex items-center justify-center shrink-0 ${
                  brushSize === size
                    ? 'border-chamber-cyan text-chamber-cyan bg-chamber-cyan/10 shadow-cyan-glow'
                    : 'border-transparent text-chamber-secondary hover:text-chamber-text hover:bg-chamber-surface'
                }`}
                aria-label={`Brush size ${size === 3 ? 'Small' : size === 6 ? 'Medium' : size === 12 ? 'Large' : 'Extra Large'}`}
              >
                {size === 3 ? 'S' : size === 6 ? 'M' : size === 12 ? 'L' : 'XL'}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleUndo}
              disabled={localHistory.length === 0}
              className="w-11 h-11 md:w-7 md:h-7 rounded border border-chamber-cyan/10 hover:border-chamber-cyan/30 text-chamber-secondary hover:text-chamber-cyan disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center shrink-0"
              title="Undo Last Stroke"
              aria-label="Undo last stroke"
            >
              <Undo className="w-5 h-5 md:w-4 md:h-4" />
            </button>
            <button
              onClick={handleClear}
              disabled={localHistory.length === 0}
              className="w-11 h-11 md:w-7 md:h-7 rounded border border-chamber-red/10 hover:border-chamber-red/30 text-chamber-secondary hover:text-chamber-red disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center justify-center shrink-0"
              title="Clear Canvas"
              aria-label="Clear canvas"
            >
              <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
